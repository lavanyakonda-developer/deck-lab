import { NextResponse } from "next/server";
import { z } from "zod";
import { DeckSchema } from "@/lib/schema/slide";
import { serializeDeckContext } from "@/lib/ai/deckContext";
import { generateDeckFromPrompt } from "@/lib/ai/generateDeck";
import { getOpenAIClient, OPENAI_MODEL } from "@/lib/ai/openaiClient";
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
      { role: "user" as const, content: message.trim() },
    ];

    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
      tools: TOOL_DEFINITIONS,
    });

    const choice = completion.choices[0];
    const rawToolCalls = choice?.message?.tool_calls ?? [];

    const toolCalls: ValidatedToolCall[] = [];
    for (const rawCall of rawToolCalls) {
      if (rawCall.type !== "function") continue;
      let parsedArgs: unknown;
      try {
        parsedArgs = JSON.parse(rawCall.function.arguments);
      } catch {
        continue;
      }
      const validated = validateToolCall(rawCall.function.name, parsedArgs);
      if (validated) {
        toolCalls.push(validated);
      }
    }

    // generate_deck replaces the whole deck via the existing bulk-
    // generation pipeline - it's exclusive of the targeted editing tools,
    // so if present it wins and any other tool calls in the same turn are
    // ignored (the model was told not to combine them, but don't trust it).
    const generateCall = toolCalls.find(
      (call) => call.tool === "generate_deck",
    );
    if (generateCall) {
      const generatedDeck = await generateDeckFromPrompt(
        generateCall.args.prompt,
      );
      const reply = `Generated "${generatedDeck.title}" — ${generatedDeck.slides.length} slide${
        generatedDeck.slides.length === 1 ? "" : "s"
      }: ${generatedDeck.slides.map((slide) => slide.title).join(", ")}.`;
      return NextResponse.json({ reply, toolCalls: [], generatedDeck });
    }

    const reply =
      choice?.message?.content?.trim() || summarizeToolCalls(toolCalls);

    return NextResponse.json({ reply, toolCalls });
  } catch (error) {
    console.error("POST /api/chat failed:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to process message";
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
