import { describe, expect, it } from "vitest";
import { SlideSchema } from "./schema/slide";
import { createBlankSlide } from "./blankSlide";

describe("createBlankSlide", () => {
  it("produces a schema-valid slide once an id is attached", () => {
    const blank = createBlankSlide();
    const result = SlideSchema.safeParse({ id: "test-id", ...blank });
    expect(result.success).toBe(true);
  });

  it("has an empty title and one editable bullet", () => {
    const blank = createBlankSlide();
    expect(blank.title).toBe("");
    expect(blank.type).toBe("content");
    expect(blank.body).toHaveLength(1);
    expect(blank.body[0]).toMatchObject({
      type: "bullets",
      items: ["New bullet point"],
    });
  });
});
