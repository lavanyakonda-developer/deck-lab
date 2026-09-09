import { NextResponse } from "next/server";
import { z } from "zod";
import { DeckSchema } from "@/lib/schema/slide";
import { serializeDeckContext } from "@/lib/ai/deckContext";
import { generateDeckStreamed } from "@/lib/ai/generateDeckStream";
import { getOpenAIClient, OPENAI_MODEL } from "@/lib/ai/openaiClient";
import { formatSSE } from "@/lib/ai/sse";
import { IncrementalJsonObjectExtractor } from "@/lib/ai/streamParser";
import {
  TOOL_DEFINITIONS,
  validateToolCall,
  type ValidatedToolCall,
} from "@/lib/ai/tools";

const HistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const SYSTEM_INSTRUCTIONS = `You are the AI behind a presentation deck builder. You have tools to add, update, delete, and reorder slides, to change a slide's layout/type, and to generate a brand new deck from scratch.

Rules:
- If the user is asking for an entirely new/different presentation (not a change to the current one), call generate_deck with a prompt describing what they want - this includes a first-ever message that describes a topic to build a deck about, since the current deck may just be an unedited starting point. Do not combine generate_deck with any other tool call in the same turn.
- For everything else - any request that refers to, adds to, removes from, or modifies the current deck's actual slides - use the targeted tools below instead of generate_deck, even if it's the very first message.
- Make the SMALLEST change that satisfies the request. Never touch slides that weren't asked about.
- For update_slide, delete_slide, and change_layout, reference the exact "id" from the deck context below - never invent or guess an id.
- On update_slide and change_layout, every field is nullable: null means "leave this field unchanged". Only set a field when the user actually wants it changed.
- For update_slide, if you are changing any part of the body (e.g. one bullet, one table cell), you must supply the FULL new body array reflecting that one change, since body replaces the slide's entire body - do not drop unrelated content blocks.
- change_layout only changes a slide's "type" and layout hints - it does NOT touch body content. If the request implies reshaping the actual content (e.g. "change it to a table", "turn these bullets into a comparison"), you must ALSO call update_slide with a new body containing a properly-shaped content block (e.g. a "table" block with real headers/rows derived from the existing content) in the SAME turn - change_layout alone would leave the old content block behind, rendering nothing.
- The conversation history below is real - if you previously asked a clarifying question and the user's next message answers it (e.g. a slide number, "yes", "the bullets one"), resolve it using that history and proceed with a tool call. Do not ask the same question again.
- If the request is ambiguous or could reasonably mean several different things, ask a clarifying question in your normal text response instead of guessing with a tool call.`;

function buildSystemPrompt(deckContext: string): string {
  return `${SYSTEM_INSTRUCTIONS}\n\nCurrent deck:\n${deckContext}`;
}

function summarizeToolCalls(toolCalls: ValidatedToolCall[]): string {
  if (toolCalls.length === 0) {
    return "I didn't make any changes.";
  }
  const parts = toolCalls.map((call) => {
    switch (call.tool) {
      case "generate_deck":
        return "generated a new deck";
      case "add_slide":
        return `added "${call.args.slide.title || "a new slide"}"`;
      case "update_slide":
        return "updated a slide";
      case "delete_slide":
        return "deleted a slide";
      case "reorder_slides":
        return "reordered the slides";
      case "change_layout":
        return "changed a slide's layout";
    }
  });
  return `Done — ${parts.join(", ")}.`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message, deck, history } = (body ?? {}) as {
    message?: unknown;
    deck?: unknown;
    history?: unknown;
  };

  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json(
      { error: "A non-empty 'message' string is required" },
      { status: 400 },
    );
  }

  const deckResult = DeckSchema.safeParse(deck);
  if (!deckResult.success) {
    return NextResponse.json(
      { error: "A valid 'deck' is required for context" },
      { status: 400 },
    );
  }

  // history is optional (older clients / first-ever call may omit it) -
  // default to no prior turns rather than rejecting the request.
  const historyResult = HistoryMessageSchema.array().safeParse(history ?? []);
  const priorTurns = historyResult.success ? historyResult.data : [];
  const trimmedMessage = message.trim();

  const encoder = new TextEncoder();

  // Once this stream starts, the HTTP status is fixed at 200 - a failure
  // partway through (or even immediately) can only be signaled via an
  // "error" SSE event, not a different status code. The client must
  // check event type, not response.ok, to detect failure.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(formatSSE(event, data)));

      try {
        const client = getOpenAIClient();
        const systemPrompt = buildSystemPrompt(
          serializeDeckContext(deckResult.data),
        );
        const messages = [
          { role: "system" as const, content: systemPrompt },
          ...priorTurns.map((turn) => ({
            role: turn.role,
            content: turn.content,
          })),
          { role: "user" as const, content: trimmedMessage },
        ];

        const chatStream = await client.chat.completions.create({
          model: OPENAI_MODEL,
          messages,
          tools: TOOL_DEFINITIONS,
          stream: true,
        });

        let textContent = "";
        let generateDeckPrompt: string | null = null;
        const appliedTools: ValidatedToolCall[] = [];
        const toolCallState = new Map<
          number,
          { name: string; extractor: IncrementalJsonObjectExtractor }
        >();

        for await (const chunk of chatStream) {
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            textContent += delta.content;
            emit("text-delta", { text: delta.content });
          }

          for (const toolCallDelta of delta.tool_calls ?? []) {
            const index = toolCallDelta.index;
            let state = toolCallState.get(index);
            if (!state) {
              state = {
                name: toolCallDelta.function?.name ?? "",
                extractor: new IncrementalJsonObjectExtractor(),
              };
              toolCallState.set(index, state);
            } else if (toolCallDelta.function?.name) {
              state.name = toolCallDelta.function.name;
            }

            const argsDelta = toolCallDelta.function?.arguments;
            if (!argsDelta) continue;

            for (const rawArgs of state.extractor.feed(argsDelta)) {
              const validated = validateToolCall(state.name, rawArgs);
              if (!validated) continue;
              if (validated.tool === "generate_deck") {
                generateDeckPrompt = validated.args.prompt;
              } else {
                appliedTools.push(validated);
                emit("tool-call", validated);
              }
            }
          }
        }

        if (generateDeckPrompt) {
          const generatedDeck = await generateDeckStreamed(
            generateDeckPrompt,
            (slide) => emit("slide", slide),
          );
          const reply = `Generated "${generatedDeck.title}" — ${generatedDeck.slides.length} slide${
            generatedDeck.slides.length === 1 ? "" : "s"
          }: ${generatedDeck.slides.map((s) => s.title).join(", ")}.`;
          emit("done", { reply, generatedDeck });
        } else {
          const reply = textContent.trim() || summarizeToolCalls(appliedTools);
          emit("done", { reply });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to process message";
        emit("error", { error: errorMessage });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
