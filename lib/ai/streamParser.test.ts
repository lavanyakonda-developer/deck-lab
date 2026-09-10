import { describe, expect, it } from "vitest";
import {
  DeckSlideStreamParser,
  IncrementalJsonObjectExtractor,
} from "./streamParser";

function chunkString(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

describe("IncrementalJsonObjectExtractor", () => {
  it("extracts a single object fed in one chunk", () => {
    const extractor = new IncrementalJsonObjectExtractor();
    expect(extractor.feed('{"a":1}')).toEqual([{ a: 1 }]);
  });

  it("extracts an object fed one character at a time", () => {
    const extractor = new IncrementalJsonObjectExtractor();
    const json = '{"a":1,"b":"two","c":[1,2,3]}';
    const results: unknown[] = [];
    for (const ch of json) {
      results.push(...extractor.feed(ch));
    }
    expect(results).toEqual([{ a: 1, b: "two", c: [1, 2, 3] }]);
  });

  it("extracts multiple sibling objects across arbitrary chunk boundaries", () => {
    const extractor = new IncrementalJsonObjectExtractor();
    const json = '{"a":1},{"a":2},{"a":3}';
    const results: unknown[] = [];
    for (const chunk of chunkString(json, 3)) {
      results.push(...extractor.feed(chunk));
    }
    expect(results).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
  });

  it("does not let braces inside string values corrupt depth tracking", () => {
    const extractor = new IncrementalJsonObjectExtractor();
    const results = extractor.feed(
      '{"text":"contains a } brace and a { too, plus \\"quotes\\""}',
    );
    expect(results).toEqual([
      { text: 'contains a } brace and a { too, plus "quotes"' },
    ]);
  });

  it("does not emit anything for an incomplete object", () => {
    const extractor = new IncrementalJsonObjectExtractor();
    expect(extractor.feed('{"a":1,"b":')).toEqual([]);
  });

  it("skips a malformed boundary without throwing, and recovers for the next object", () => {
    const extractor = new IncrementalJsonObjectExtractor();
    // First "object" is malformed (trailing comma before close) - our
    // depth tracker still finds its closing brace, JSON.parse just fails
    // for that one; the next well-formed object should still come through.
    const first = extractor.feed('{"a":1,}');
    expect(first).toEqual([]);
    const second = extractor.feed(',{"b":2}');
    expect(second).toEqual([{ b: 2 }]);
  });
});

describe("DeckSlideStreamParser", () => {
  const deckJson = JSON.stringify({
    title: "Q3 Roadmap",
    slides: [
      {
        type: "title",
        title: "Q3 Roadmap",
        subtitle: null,
        body: [],
        layout: null,
      },
      {
        type: "content",
        title: "Objectives",
        subtitle: null,
        body: [{ type: "bullets", items: ["Grow", "Ship"], column: null }],
        layout: null,
      },
      {
        type: "content",
        title: "Conclusion",
        subtitle: null,
        body: [],
        layout: null,
      },
    ],
  });

  it("extracts every slide, in order, when fed the whole payload at once", () => {
    const parser = new DeckSlideStreamParser();
    const slides = parser.feed(deckJson);
    expect(slides).toHaveLength(3);
    expect((slides[0] as { title: string }).title).toBe("Q3 Roadmap");
    expect((slides[1] as { title: string }).title).toBe("Objectives");
    expect((slides[2] as { title: string }).title).toBe("Conclusion");
  });

  it("extracts every slide correctly when fed in small arbitrary chunks", () => {
    const parser = new DeckSlideStreamParser();
    const results: unknown[] = [];
    for (const chunk of chunkString(deckJson, 7)) {
      results.push(...parser.feed(chunk));
    }
    expect(results).toHaveLength(3);
    expect((results[0] as { title: string }).title).toBe("Q3 Roadmap");
    expect((results[1] as { title: string }).title).toBe("Objectives");
    expect((results[2] as { title: string }).title).toBe("Conclusion");
    expect((results[1] as { body: unknown[] }).body).toEqual([
      { type: "bullets", items: ["Grow", "Ship"], column: null },
    ]);
  });

  it("extracts nothing before the slides array is reached, even mid-title", () => {
    const parser = new DeckSlideStreamParser();
    const results = parser.feed('{"title":"A {weird} title with a } brace",');
    expect(results).toEqual([]);
  });

  it("handles the slides key split across a chunk boundary", () => {
    const parser = new DeckSlideStreamParser();
    const before = '{"title":"X","sli';
    const after = 'des":[{"type":"title","title":"Y"}]}';
    expect(parser.feed(before)).toEqual([]);
    expect(parser.feed(after)).toEqual([{ type: "title", title: "Y" }]);
  });
});
