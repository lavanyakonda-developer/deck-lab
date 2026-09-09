import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Slide } from "@/lib/schema/slide";
import { findPendingImageAlts, generateImageForSlide } from "./generateImage";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

describe("findPendingImageAlts", () => {
  it("returns the alt text of every image block with a null url", () => {
    const slide: Slide = {
      id: "s1",
      type: "content",
      title: "Photos",
      body: [
        { type: "paragraph", text: "intro" },
        { type: "image", url: null, alt: "A modern office" },
        {
          type: "image",
          url: "data:image/png;base64,abc",
          alt: "already generated",
        },
        { type: "image", url: null, alt: "A city skyline" },
      ],
      speakerNotes: "",
    };
    expect(findPendingImageAlts(slide)).toEqual([
      "A modern office",
      "A city skyline",
    ]);
  });

  it("returns an empty array when there are no pending images", () => {
    const slide: Slide = {
      id: "s1",
      type: "content",
      title: "Text only",
      body: [{ type: "paragraph", text: "hi" }],
      speakerNotes: "",
    };
    expect(findPendingImageAlts(slide)).toEqual([]);
  });
});

function makeSlideWithPendingImage(): Slide {
  return {
    id: "s1",
    type: "content",
    title: "Photos",
    body: [
      { type: "paragraph", text: "intro" },
      { type: "image", url: null, alt: "A modern office" },
    ],
    speakerNotes: "",
  };
}

describe("generateImageForSlide", () => {
  it("patches the matching image block's url on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "data:image/png;base64,xyz" }),
    });
    const slide = makeSlideWithPendingImage();
    const updateSlide = vi.fn();
    const actions = { getSlide: () => slide, updateSlide };

    await generateImageForSlide(actions, "s1", "A modern office");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/generate-image",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ prompt: "A modern office" }),
      }),
    );
    expect(updateSlide).toHaveBeenCalledWith("s1", {
      body: [
        { type: "paragraph", text: "intro" },
        {
          type: "image",
          url: "data:image/png;base64,xyz",
          alt: "A modern office",
        },
      ],
    });
  });

  it("leaves the block untouched (silently) when the request fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Image generation is down" }),
    });
    const updateSlide = vi.fn();
    const actions = {
      getSlide: () => makeSlideWithPendingImage(),
      updateSlide,
    };

    await expect(
      generateImageForSlide(actions, "s1", "A modern office"),
    ).resolves.toBeUndefined();
    expect(updateSlide).not.toHaveBeenCalled();
  });

  it("leaves the block untouched (silently) when fetch itself throws", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));
    const updateSlide = vi.fn();
    const actions = {
      getSlide: () => makeSlideWithPendingImage(),
      updateSlide,
    };

    await expect(
      generateImageForSlide(actions, "s1", "A modern office"),
    ).resolves.toBeUndefined();
    expect(updateSlide).not.toHaveBeenCalled();
  });

  it("does nothing if the slide was deleted before generation finished", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "data:image/png;base64,xyz" }),
    });
    const updateSlide = vi.fn();
    const actions = { getSlide: () => undefined, updateSlide };

    await generateImageForSlide(actions, "s1", "A modern office");
    expect(updateSlide).not.toHaveBeenCalled();
  });

  it("does nothing if the block was already resolved/removed by the time generation finishes", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "data:image/png;base64,xyz" }),
    });
    const updateSlide = vi.fn();
    // No image block with a matching, still-null-url "alt" anymore.
    const slide: Slide = {
      id: "s1",
      type: "content",
      title: "Photos",
      body: [{ type: "paragraph", text: "no images here anymore" }],
      speakerNotes: "",
    };
    const actions = { getSlide: () => slide, updateSlide };

    await generateImageForSlide(actions, "s1", "A modern office");
    expect(updateSlide).not.toHaveBeenCalled();
  });

  it("only replaces the matching block, leaving other blocks untouched", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "data:image/png;base64,new" }),
    });
    const slide: Slide = {
      id: "s1",
      type: "content",
      title: "Photos",
      body: [
        {
          type: "image",
          url: "data:image/png;base64,already-there",
          alt: "existing",
        },
        { type: "image", url: null, alt: "A modern office" },
      ],
      speakerNotes: "",
    };
    const updateSlide = vi.fn();
    const actions = { getSlide: () => slide, updateSlide };

    await generateImageForSlide(actions, "s1", "A modern office");

    expect(updateSlide).toHaveBeenCalledWith("s1", {
      body: [
        {
          type: "image",
          url: "data:image/png;base64,already-there",
          alt: "existing",
        },
        {
          type: "image",
          url: "data:image/png;base64,new",
          alt: "A modern office",
        },
      ],
    });
  });
});
