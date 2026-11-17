import { describe, expect, it } from "vitest";
import { SlideSchema } from "./schema/slide";
import { getSlideContent } from "./slides/layoutEngine";
import { createBlankSlide } from "./blankSlide";

describe("createBlankSlide", () => {
  it("produces a schema-valid, laid-out slide", () => {
    const result = SlideSchema.safeParse(createBlankSlide());
    expect(result.success).toBe(true);
  });

  it("gets a fresh id each time", () => {
    expect(createBlankSlide().id).not.toBe(createBlankSlide().id);
  });

  it("has an empty title and one editable bullet", () => {
    const content = getSlideContent(createBlankSlide());
    expect(content.title).toBe("");
    expect(content.type).toBe("content");
    expect(content.body).toHaveLength(1);
    expect(content.body[0]).toMatchObject({
      type: "bullets",
      items: ["New bullet point"],
    });
  });
});
