import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentBlock, Slide } from "@/lib/schema/slide";
import { materializeSlide } from "@/lib/slides/layoutEngine";
import { findPendingImageAlts, generateImageForSlide } from "./generateImage";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

function slideWith(body: ContentBlock[]): Slide {
  return materializeSlide({ type: "content", title: "Photos", body }, "s1");
}

function elementIdFor(slide: Slide, alt: string): string {
  return slide.elements.find(
    (el) => el.content.type === "image" && el.content.alt === alt,
  )!.id;
}

describe("findPendingImageAlts", () => {
  it("returns the alt text of every image element with a null url", () => {
    const slide = slideWith([
      { type: "paragraph", text: "intro" },
      { type: "image", url: null, alt: "A modern office" },
      {
        type: "image",
        url: "data:image/png;base64,abc",
        alt: "already generated",
      },
      { type: "image", url: null, alt: "A city skyline" },
    ]);
    expect(findPendingImageAlts(slide)).toEqual([
      "A modern office",
      "A city skyline",
    ]);
  });

  it("returns an empty array when there are no pending images", () => {
    const slide = slideWith([{ type: "paragraph", text: "hi" }]);
    expect(findPendingImageAlts(slide)).toEqual([]);
  });
});

function makeSlideWithPendingImage(): Slide {
  return slideWith([
    { type: "paragraph", text: "intro" },
    { type: "image", url: null, alt: "A modern office" },
  ]);
}

describe("generateImageForSlide", () => {
  it("patches the matching image element's url on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "data:image/png;base64,xyz" }),
    });
    const slide = makeSlideWithPendingImage();
    const updateElement = vi.fn();
    const actions = { getSlide: () => slide, updateElement };

    await generateImageForSlide(actions, "s1", "A modern office");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/generate-image",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ prompt: "A modern office" }),
      }),
    );
    expect(updateElement).toHaveBeenCalledWith(
      "s1",
      elementIdFor(slide, "A modern office"),
      {
        type: "image",
        url: "data:image/png;base64,xyz",
        alt: "A modern office",
      },
    );
  });

  it("leaves the element untouched (silently) when the request fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Image generation is down" }),
    });
    const updateElement = vi.fn();
    const actions = {
      getSlide: () => makeSlideWithPendingImage(),
      updateElement,
    };

    await expect(
      generateImageForSlide(actions, "s1", "A modern office"),
    ).resolves.toBeUndefined();
    expect(updateElement).not.toHaveBeenCalled();
  });

  it("leaves the element untouched (silently) when fetch itself throws", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));
    const updateElement = vi.fn();
    const actions = {
      getSlide: () => makeSlideWithPendingImage(),
      updateElement,
    };

    await expect(
      generateImageForSlide(actions, "s1", "A modern office"),
    ).resolves.toBeUndefined();
    expect(updateElement).not.toHaveBeenCalled();
  });

  it("does nothing if the slide was deleted before generation finished", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "data:image/png;base64,xyz" }),
    });
    const updateElement = vi.fn();
    const actions = { getSlide: () => undefined, updateElement };

    await generateImageForSlide(actions, "s1", "A modern office");
    expect(updateElement).not.toHaveBeenCalled();
  });

  it("does nothing if the image was already resolved/removed by the time generation finishes", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "data:image/png;base64,xyz" }),
    });
    const updateElement = vi.fn();
    // No image element with a matching, still-null-url "alt" anymore.
    const slide = slideWith([
      { type: "paragraph", text: "no images here anymore" },
    ]);
    const actions = { getSlide: () => slide, updateElement };

    await generateImageForSlide(actions, "s1", "A modern office");
    expect(updateElement).not.toHaveBeenCalled();
  });

  it("only updates the matching element, leaving other images untouched", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "data:image/png;base64,new" }),
    });
    const slide = slideWith([
      {
        type: "image",
        url: "data:image/png;base64,already-there",
        alt: "existing",
      },
      { type: "image", url: null, alt: "A modern office" },
    ]);
    const updateElement = vi.fn();
    const actions = { getSlide: () => slide, updateElement };

    await generateImageForSlide(actions, "s1", "A modern office");

    expect(updateElement).toHaveBeenCalledTimes(1);
    expect(updateElement).toHaveBeenCalledWith(
      "s1",
      elementIdFor(slide, "A modern office"),
      {
        type: "image",
        url: "data:image/png;base64,new",
        alt: "A modern office",
      },
    );
  });
});
