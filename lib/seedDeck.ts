import type { Deck } from "@/lib/schema/slide";

export const seedDeck: Deck = {
  id: "deck-seed-1",
  title: "Sample Deck",
  slides: [
    {
      id: "slide-1",
      type: "title",
      title: "Deck Lab",
      subtitle: "A schema-driven presentation builder",
      body: [],
      speakerNotes: "Welcome the audience and introduce the topic.",
    },
    {
      id: "slide-2",
      type: "content",
      title: "What This Deck Demonstrates",
      body: [
        {
          type: "bullets",
          items: [
            "A structured slide schema",
            "Multiple slide layouts",
            "Bullets, paragraphs, and tables as body content",
          ],
        },
      ],
      speakerNotes: "",
    },
    {
      id: "slide-3",
      type: "content",
      title: "Why A Schema Matters",
      body: [
        {
          type: "paragraph",
          text: "A well-designed schema is the contract between the AI and the UI — every downstream feature depends on it being predictable.",
        },
      ],
      speakerNotes: "",
    },
    {
      id: "slide-4",
      type: "two-column",
      title: "Manual vs. AI-Driven Edits",
      layout: { columns: 2, columnTitles: ["Manual", "AI-Driven"] },
      body: [
        {
          type: "bullets",
          items: [
            "Click to edit text",
            "Drag to reorder",
            "Add or delete slides",
          ],
          column: 0,
        },
        {
          type: "bullets",
          items: [
            "Chat-based refinement",
            "Targeted tool calls",
            "Diff-based updates",
          ],
          column: 1,
        },
      ],
      speakerNotes: "",
    },
    {
      id: "slide-5",
      type: "comparison",
      title: "Full Regeneration vs. Targeted Patches",
      layout: {
        columns: 2,
        columnTitles: ["Full Regeneration", "Targeted Patch"],
      },
      body: [
        {
          type: "paragraph",
          text: "Destroys manual edits on every AI turn.",
          column: 0,
        },
        {
          type: "paragraph",
          text: "Preserves everything except the requested change.",
          column: 1,
        },
      ],
      speakerNotes: "",
    },
    {
      id: "slide-6",
      type: "table",
      title: "Slide Types At A Glance",
      body: [
        {
          type: "table",
          headers: ["Type", "Purpose"],
          rows: [
            ["title", "Cover slide"],
            ["content", "Single column body"],
            ["two-column", "Side-by-side content"],
            ["comparison", "Contrast two options"],
            ["table", "Tabular data"],
          ],
        },
      ],
      speakerNotes: "",
    },
  ],
};
