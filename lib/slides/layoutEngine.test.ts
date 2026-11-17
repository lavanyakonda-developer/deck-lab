import { describe, expect, it } from "vitest";
import {
  STAGE_HEIGHT,
  STAGE_WIDTH,
  SlideSchema,
  type SlideContent,
} from "@/lib/schema/slide";
import {
  applyContentPatch,
  applyLayoutChange,
  getSlideContent,
  materializeSlide,
  migrateLegacySlide,
} from "./layoutEngine";

const samples: SlideContent[] = [
  { type: "title", title: "Cover", subtitle: "Sub", body: [] },
  {
    type: "content",
    title: "Content",
    body: [
      { type: "bullets", items: ["a", "b"] },
      { type: "paragraph", text: "p" },
      { type: "chart", chartType: "bar", data: [{ label: "x", value: 1 }] },
      { type: "image", url: null, alt: "photo" },
    ],
  },
  {
    type: "two-column",
    title: "Two",
    layout: { columnTitles: ["L", "R"] },
    body: [
      { type: "bullets", items: ["left"], column: 0 },
      { type: "bullets", items: ["right"], column: 1 },
    ],
  },
  {
    type: "comparison",
    title: "Compare",
    layout: { columnTitles: ["A", "B"] },
    body: [
      { type: "paragraph", text: "a", column: 0 },
      { type: "paragraph", text: "b", column: 1 },
    ],
  },
  {
    type: "table",
    title: "Table",
    body: [{ type: "table", headers: ["H"], rows: [["1"]] }],
  },
];

describe("materializeSlide", () => {
  it.each(samples.map((s) => [s.type, s] as const))(
    "lays out a %s slide into schema-valid elements",
    (_type, content) => {
      const slide = materializeSlide(content, "s1");
      expect(SlideSchema.safeParse(slide).success).toBe(true);
      expect(slide.id).toBe("s1");
      expect(slide.type).toBe(content.type);
    },
  );

  it.each(samples.map((s) => [s.type, s] as const))(
    "keeps every %s element's frame on the stage horizontally",
    (_type, content) => {
      for (const el of materializeSlide(content).elements) {
        expect(el.frame.x).toBeGreaterThanOrEqual(0);
        expect(el.frame.x + el.frame.w).toBeLessThanOrEqual(STAGE_WIDTH);
        expect(el.frame.y).toBeGreaterThanOrEqual(0);
        expect(el.frame.y).toBeLessThan(STAGE_HEIGHT);
      }
    },
  );

  it("gives every element a unique id", () => {
    const ids = materializeSlide(samples[1]).elements.map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("stacks body blocks top to bottom without overlap", () => {
    const body = materializeSlide(samples[1]).elements.filter(
      (el) => el.role === "body",
    );
    for (let i = 1; i < body.length; i++) {
      const prev = body[i - 1].frame;
      expect(body[i].frame.y).toBeGreaterThanOrEqual(prev.y + prev.h);
    }
  });

  it("places column-0 blocks left of column-1 blocks", () => {
    const body = materializeSlide(samples[2]).elements.filter(
      (el) => el.role === "body",
    );
    expect(body).toHaveLength(2);
    expect(body[0].frame.x + body[0].frame.w).toBeLessThanOrEqual(
      body[1].frame.x,
    );
  });

  it("gives comparison slides decorative cards that don't leak into content", () => {
    const slide = materializeSlide(samples[3]);
    expect(
      slide.elements.filter((el) => el.role === "decoration").length,
    ).toBeGreaterThan(0);
    expect(getSlideContent(slide).body).toHaveLength(2);
  });

  it("always gives a title slide a subtitle box, even when empty", () => {
    const slide = materializeSlide({ type: "title", title: "T", body: [] });
    expect(slide.elements.some((el) => el.role === "subtitle")).toBe(true);
    expect(getSlideContent(slide).subtitle).toBeUndefined();
  });
});

describe("getSlideContent", () => {
  it.each(samples.map((s) => [s.type, s] as const))(
    "round-trips %s content through elements",
    (_type, content) => {
      expect(getSlideContent(materializeSlide(content))).toEqual(content);
    },
  );

  it("finds content by role regardless of where elements were moved", () => {
    const slide = materializeSlide(samples[0]);
    for (const el of slide.elements) {
      el.frame = { x: 10, y: 10, w: 100, h: 100 };
    }
    expect(getSlideContent(slide).title).toBe("Cover");
    expect(getSlideContent(slide).subtitle).toBe("Sub");
  });
});

describe("applyContentPatch", () => {
  it("edits the title in place, keeping its element id and frame", () => {
    const slide = materializeSlide(samples[1]);
    const before = slide.elements.find((el) => el.role === "title")!;
    const after = applyContentPatch(slide, { title: "New" });
    const title = after.elements.find((el) => el.role === "title")!;
    expect(title.id).toBe(before.id);
    expect(title.frame).toEqual(before.frame);
    expect(getSlideContent(after).title).toBe("New");
    // untouched body elements are the very same objects
    expect(after.elements.filter((el) => el.role === "body")).toEqual(
      slide.elements.filter((el) => el.role === "body"),
    );
  });

  it("re-lays out on a body change, reusing element ids where roles match", () => {
    const slide = materializeSlide(samples[1]);
    const oldTitleId = slide.elements.find((el) => el.role === "title")!.id;
    const after = applyContentPatch(slide, {
      body: [{ type: "paragraph", text: "only this now" }],
    });
    expect(after.id).toBe(slide.id);
    expect(after.elements.find((el) => el.role === "title")!.id).toBe(
      oldTitleId,
    );
    expect(getSlideContent(after).body).toEqual([
      { type: "paragraph", text: "only this now" },
    ]);
    expect(getSlideContent(after).title).toBe("Content");
  });

  it("adds a subtitle box when patching a subtitle onto a slide without one", () => {
    const slide = materializeSlide(samples[1]);
    const after = applyContentPatch(slide, { subtitle: "Added" });
    expect(getSlideContent(after).subtitle).toBe("Added");
  });

  it("returns the slide unchanged for an empty patch", () => {
    const slide = materializeSlide(samples[1]);
    expect(applyContentPatch(slide, {})).toBe(slide);
  });
});

describe("applyLayoutChange", () => {
  it("re-lays out content under the new layout", () => {
    const slide = materializeSlide(samples[1]);
    const after = applyLayoutChange(slide, {
      type: "two-column",
      layout: { columnTitles: ["X", "Y"] },
    });
    expect(after.type).toBe("two-column");
    expect(getSlideContent(after).layout).toEqual({ columnTitles: ["X", "Y"] });
    expect(getSlideContent(after).body).toEqual(samples[1].body);
  });
});

describe("migrateLegacySlide", () => {
  it("converts a pre-element slide, keeping its id and content", () => {
    const legacy = { id: "old", ...samples[2] };
    const migrated = migrateLegacySlide(legacy);
    expect(migrated.id).toBe("old");
    expect(getSlideContent(migrated)).toEqual(samples[2]);
  });

  it("passes an element slide through untouched", () => {
    const slide = materializeSlide(samples[0]);
    expect(migrateLegacySlide(slide)).toBe(slide);
  });
});
