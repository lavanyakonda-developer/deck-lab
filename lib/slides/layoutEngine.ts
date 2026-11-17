import { createId } from "@/lib/id";
import {
  STAGE_HEIGHT,
  STAGE_WIDTH,
  type ContentBlock,
  type Deck,
  type ElementRole,
  type ElementStyle,
  type Frame,
  type LayoutHints,
  type Slide,
  type SlideContent,
  type SlideElement,
  type SlideType,
} from "@/lib/schema/slide";

// The layout engine: turns semantic slide content (what a slide says - the
// shape the AI generates and edits) into positioned elements on the
// 1920x1080 stage, and projects elements back into semantic content.
//
// A layout only decides where elements START. Once materialized, a slide is
// just its elements - the `type` it keeps is a record of the template it
// came from, not a constraint on it.

const MARGIN_X = 104;
const TOP = 80;
const BOTTOM = 86;
const CONTENT_W = STAGE_WIDTH - MARGIN_X * 2;

const TITLE_H = 80;
const SUBTITLE_H = 50;
const TITLE_GAP = 50;
const BLOCK_GAP = 34;

const BODY_FONT = 34;
const BODY_LINE = BODY_FONT * 1.5;

const COLUMN_TITLE_H = 44;
const COLUMN_TITLE_GAP = 26;

const MEDIA_H = 480; // chart / image default height
const MEDIA_MIN_H = 200;
const CAPTION_H = 40;

const TITLE_STYLE: ElementStyle = {
  fontSize: 52,
  fontWeight: "semibold",
  tone: "foreground",
};
const SUBTITLE_STYLE: ElementStyle = { fontSize: 32, tone: "muted" };
const COLUMN_TITLE_STYLE: ElementStyle = {
  fontSize: 30,
  fontWeight: "semibold",
  tone: "muted",
  uppercase: true,
};
const BODY_STYLE: ElementStyle = { fontSize: BODY_FONT, tone: "foreground" };

const COMPARISON_DEFAULT_TITLES = ["Option A", "Option B"];

type Draft = Omit<SlideElement, "id">;

function textElement(
  role: ElementRole,
  text: string,
  frame: Frame,
  style: ElementStyle,
): Draft {
  return { role, frame, style, content: { type: "text", text } };
}

// Rough line count for text of `chars` length in a box `width` wide - an
// average glyph is about half the font size. Deliberately an estimate:
// text may still overflow its box slightly, the same as in Google Slides.
function estimateLines(chars: number, width: number, fontSize: number) {
  const perLine = Math.max(1, Math.floor(width / (fontSize * 0.5)));
  return Math.max(1, Math.ceil(chars / perLine));
}

function estimateBlockHeight(block: ContentBlock, width: number): number {
  switch (block.type) {
    case "bullets": {
      const indent = BODY_FONT * 1.25;
      const lines = block.items.reduce(
        (sum, item) =>
          sum + estimateLines(item.length, width - indent, BODY_FONT),
        0,
      );
      return lines * BODY_LINE + (block.items.length - 1) * (BODY_FONT * 0.5);
    }
    case "paragraph":
      return estimateLines(block.text.length, width, BODY_FONT) * BODY_LINE;
    case "table":
      return (block.rows.length + 1) * 76;
    case "chart":
    case "image":
      return MEDIA_H + (block.caption ? CAPTION_H : 0);
  }
}

function isMedia(block: ContentBlock) {
  return block.type === "chart" || block.type === "image";
}

// Stacks blocks top-to-bottom inside a region. If they don't fit, media
// (charts/images) shrink first - text keeps its estimated height.
function stackBlocks(blocks: ContentBlock[], region: Frame): Draft[] {
  if (blocks.length === 0) return [];
  const heights = blocks.map((b) => estimateBlockHeight(b, region.w));
  const gaps = BLOCK_GAP * (blocks.length - 1);
  const total = heights.reduce((a, b) => a + b, 0) + gaps;
  const overflow = total - region.h;

  if (overflow > 0) {
    const mediaTotal = blocks.reduce(
      (sum, b, i) => sum + (isMedia(b) ? heights[i] : 0),
      0,
    );
    if (mediaTotal > 0) {
      const factor = Math.max(0, (mediaTotal - overflow) / mediaTotal);
      blocks.forEach((b, i) => {
        if (isMedia(b)) {
          heights[i] = Math.max(MEDIA_MIN_H, heights[i] * factor);
        }
      });
    }
  }

  let y = region.y;
  return blocks.map((block, i) => {
    const frame = { x: region.x, y, w: region.w, h: heights[i] };
    y += heights[i] + BLOCK_GAP;
    return { role: "body", frame, style: BODY_STYLE, content: block };
  });
}

function headerElements(content: SlideContent): {
  drafts: Draft[];
  bodyTop: number;
} {
  const drafts: Draft[] = [
    textElement(
      "title",
      content.title,
      { x: MARGIN_X, y: TOP, w: CONTENT_W, h: TITLE_H },
      TITLE_STYLE,
    ),
  ];
  let bottom = TOP + TITLE_H;
  // Only title slides always get a subtitle box; other layouts show one
  // only when there's subtitle text to show.
  if (content.subtitle) {
    drafts.push(
      textElement(
        "subtitle",
        content.subtitle,
        { x: MARGIN_X, y: bottom + 10, w: CONTENT_W, h: SUBTITLE_H },
        SUBTITLE_STYLE,
      ),
    );
    bottom += 10 + SUBTITLE_H;
  }
  return { drafts, bodyTop: bottom + TITLE_GAP };
}

function layoutTitle(content: SlideContent): Draft[] {
  const drafts: Draft[] = [
    textElement(
      "title",
      content.title,
      { x: MARGIN_X, y: 230, w: CONTENT_W, h: 340 },
      {
        fontSize: 77,
        fontWeight: "bold",
        align: "center",
        valign: "bottom",
        tone: "foreground",
      },
    ),
    textElement(
      "subtitle",
      content.subtitle ?? "",
      { x: 240, y: 604, w: STAGE_WIDTH - 480, h: 220 },
      { fontSize: 39, align: "center", tone: "muted" },
    ),
  ];
  // A title slide normally has no body, but never drop content that's
  // there - stack it beneath the subtitle.
  const bodyTop = 850;
  return drafts.concat(
    stackBlocks(content.body, {
      x: MARGIN_X,
      y: bodyTop,
      w: CONTENT_W,
      h: STAGE_HEIGHT - BOTTOM - bodyTop,
    }),
  );
}

function layoutSingleColumn(content: SlideContent): Draft[] {
  const { drafts, bodyTop } = headerElements(content);
  // A table slide leads with its table; any other blocks follow it.
  const body =
    content.type === "table"
      ? [
          ...content.body.filter((b) => b.type === "table"),
          ...content.body.filter((b) => b.type !== "table"),
        ]
      : content.body;
  return drafts.concat(
    stackBlocks(body, {
      x: MARGIN_X,
      y: bodyTop,
      w: CONTENT_W,
      h: STAGE_HEIGHT - BOTTOM - bodyTop,
    }),
  );
}

function layoutColumns(content: SlideContent): Draft[] {
  const { drafts, bodyTop } = headerElements(content);
  const isComparison = content.type === "comparison";
  const bodyH = STAGE_HEIGHT - BOTTOM - bodyTop;

  // comparison: card | gap | "vs" | gap | card ; two-column: col | gap | col
  const gap = isComparison ? 51 : 68;
  const vsW = isComparison ? 60 : 0;
  const middle = isComparison ? gap * 2 + vsW : gap;
  const colW = (CONTENT_W - middle) / 2;
  const colX = [MARGIN_X, MARGIN_X + colW + middle];
  const inset = isComparison ? 34 : 0;

  const titles =
    content.layout?.columnTitles ??
    (isComparison ? COMPARISON_DEFAULT_TITLES : []);

  if (isComparison) {
    for (const x of colX) {
      drafts.push({
        role: "decoration",
        frame: { x, y: bodyTop, w: colW, h: bodyH },
        content: { type: "shape", shape: "rect" },
      });
    }
    drafts.push(
      textElement(
        "decoration",
        "vs",
        { x: MARGIN_X + colW + gap, y: bodyTop, w: vsW, h: bodyH },
        {
          fontSize: 30,
          fontWeight: "semibold",
          align: "center",
          valign: "middle",
          tone: "muted",
        },
      ),
    );
  }

  [0, 1].forEach((column) => {
    const x = colX[column] + inset;
    const w = colW - inset * 2;
    let y = bodyTop + inset;
    drafts.push(
      textElement(
        "column-title",
        titles[column] ?? "",
        { x, y, w, h: COLUMN_TITLE_H },
        COLUMN_TITLE_STYLE,
      ),
    );
    y += COLUMN_TITLE_H + COLUMN_TITLE_GAP;
    const blocks = content.body.filter((b) => (b.column ?? 0) === column);
    drafts.push(
      ...stackBlocks(blocks, { x, y, w, h: bodyTop + bodyH - inset - y }),
    );
  });

  return drafts;
}

const LAYOUTS: Record<SlideType, (content: SlideContent) => Draft[]> = {
  title: layoutTitle,
  content: layoutSingleColumn,
  table: layoutSingleColumn,
  "two-column": layoutColumns,
  comparison: layoutColumns,
};

// Semantic content -> positioned elements. Used for AI-generated slides,
// new blank slides, layout changes and migrating pre-element saved decks.
export function materializeSlide(
  content: SlideContent,
  id: string = createId("slide"),
): Slide {
  return {
    id,
    type: content.type,
    elements: LAYOUTS[content.type](content).map((draft) => ({
      id: createId("el"),
      ...draft,
    })),
  };
}

export function materializeDeck(deck: {
  id: string;
  title: string;
  slides: (SlideContent & { id?: string })[];
}): Deck {
  return {
    id: deck.id,
    title: deck.title,
    slides: deck.slides.map(({ id, ...content }) =>
      materializeSlide(content, id),
    ),
  };
}

function textOf(element: SlideElement | undefined): string | undefined {
  return element?.content.type === "text" ? element.content.text : undefined;
}

// Positioned elements -> semantic content: what the AI context, AI patches
// and (until they become position-aware) the exporters read. Elements are
// found by role, so this keeps working however elements are arranged.
export function getSlideContent(slide: Slide): SlideContent {
  const byRole = (role: ElementRole) =>
    slide.elements.filter((element) => element.role === role);

  const subtitle = textOf(byRole("subtitle")[0]);
  const columnTitles = byRole("column-title")
    .slice()
    .sort((a, b) => a.frame.x - b.frame.x)
    .map((element) => textOf(element) ?? "");

  const content: SlideContent = {
    type: slide.type,
    title: textOf(byRole("title")[0]) ?? "",
    body: byRole("body")
      .map((element) => element.content)
      .filter(
        (c): c is ContentBlock => c.type !== "text" && c.type !== "shape",
      ),
  };
  if (subtitle) content.subtitle = subtitle;
  if (columnTitles.some((title) => title.length > 0)) {
    content.layout = { columnTitles };
  }
  return content;
}

export function getSlideTitle(slide: Slide): string {
  return getSlideContent(slide).title;
}

// Re-lays out a slide from new semantic content, keeping element ids
// stable where the same role still exists (the i-th body element keeps the
// i-th body element's id, etc.) so the editor doesn't remount everything.
// With `keepPlacement`, reused non-body elements (title, subtitle, column
// headings, decorations) also keep their frame and style - so an AI body
// edit doesn't undo where the user moved the title. Body elements are
// always re-laid out, since their content (and so their size) changed.
function rematerialize(
  slide: Slide,
  content: SlideContent,
  keepPlacement = false,
): Slide {
  const fresh = materializeSlide(content, slide.id);
  const oldByRole = new Map<ElementRole, SlideElement[]>();
  for (const element of slide.elements) {
    const list = oldByRole.get(element.role) ?? [];
    list.push(element);
    oldByRole.set(element.role, list);
  }
  return {
    ...fresh,
    elements: fresh.elements.map((element) => {
      const reused = oldByRole.get(element.role)?.shift();
      if (!reused) return element;
      if (keepPlacement && element.role !== "body") {
        return {
          ...element,
          id: reused.id,
          frame: reused.frame,
          style: reused.style,
        };
      }
      return { ...element, id: reused.id };
    }),
  };
}

export type SlideContentPatch = Partial<
  Pick<SlideContent, "title" | "subtitle" | "body" | "layout">
>;

// Applies a semantic patch (an AI update_slide call). A title/subtitle-only
// change edits the existing text element in place, keeping its position and
// style; anything that changes the body or column structure re-lays out
// the slide from the merged content.
export function applyContentPatch(
  slide: Slide,
  patch: SlideContentPatch,
): Slide {
  const keys = (Object.keys(patch) as (keyof SlideContentPatch)[]).filter(
    (key) => patch[key] !== undefined,
  );
  if (keys.length === 0) return slide;

  const textOnly = keys.every((key) => key === "title" || key === "subtitle");
  const hasElementFor = (role: ElementRole) =>
    slide.elements.some((element) => element.role === role);

  if (textOnly && keys.every((key) => hasElementFor(key as ElementRole))) {
    return {
      ...slide,
      elements: slide.elements.map((element) => {
        const text =
          element.role === "title"
            ? patch.title
            : element.role === "subtitle"
              ? patch.subtitle
              : undefined;
        return text === undefined
          ? element
          : { ...element, content: { type: "text", text } };
      }),
    };
  }

  return rematerialize(slide, { ...getSlideContent(slide), ...patch }, true);
}

// Re-applies a layout template (AI change_layout). This resets element
// positions to the new layout's defaults.
export function applyLayoutChange(
  slide: Slide,
  changes: { type?: SlideType; layout?: LayoutHints },
): Slide {
  const content = getSlideContent(slide);
  return rematerialize(slide, {
    ...content,
    type: changes.type ?? content.type,
    layout: { ...content.layout, ...changes.layout },
  });
}

// Converts a slide persisted before the element model existed (semantic
// fields stored directly on the slide) into an element slide. Anything
// already in element form passes through unchanged.
export function migrateLegacySlide(slide: unknown): Slide {
  const value = slide as Partial<Slide> & Partial<SlideContent>;
  if (Array.isArray(value.elements)) return value as Slide;
  return materializeSlide(
    {
      type: value.type ?? "content",
      title: value.title ?? "",
      subtitle: value.subtitle,
      body: value.body ?? [],
      layout: value.layout,
    },
    value.id,
  );
}
