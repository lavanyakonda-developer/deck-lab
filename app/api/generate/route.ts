import { NextResponse } from "next/server";
import { generateDeckFromPrompt } from "@/lib/ai/generateDeck";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = (body as { prompt?: unknown } | null)?.prompt;
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json(
      { error: "A non-empty 'prompt' string is required" },
      { status: 400 },
    );
  }

  try {
    const deck = await generateDeckFromPrompt(prompt.trim());
    return NextResponse.json({ deck });
  } catch (error) {
    console.error("POST /api/generate failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate deck";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
