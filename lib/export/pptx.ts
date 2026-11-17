import type PptxGenJS from "pptxgenjs";
import type { SlideThemeTokens } from "@/lib/themes";
import type {
  ContentBlock,
  Deck,
  Slide,
  SlideElement,
} from "@/lib/schema/slide";
import {
  SLIDE_H,
  SLIDE_W,
  isContentBlock,
  resolveTextStyle,
  toRegion,
  type Region,
  type ResolvedTextStyle,
} from "./elementLayout";

// pptxgenjs wants hex colors without a leading "#"; lib/themes stores
// them with one (CSS convention), so every color use strips it here.
function hex(color: string): string {
  return color.replace(/^#/, "");
}

function fileNameFor(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "deck"}.pptx`;
}

const CAPTION_H = 0.3;

function textOptions(text: ResolvedTextStyle) {
  return {
    fontSize: text.fontSize,
    bold: text.bold,
    italic: text.italic,
    align: text.align,
    color: hex(text.color),
    margin: 0,
  };
}

function addCaption(
  slide: PptxGenJS.Slide,
  caption: string,
  region: Region,
  theme: SlideThemeTokens,
) {
  slide.addText(caption, {
    x: region.x,
    y: region.y + region.h - CAPTION_H,
    w: region.w,
    h: CAPTION_H,
    fontSize: 10,
    italic: true,
    align: "center",
    color: hex(theme.muted),
  });
}

// Draws one content block filling its element's region. Text stays real,
// editable PowerPoint text; charts are native PowerPoint charts.
function renderBlock(
  slide: PptxGenJS.Slide,
  block: ContentBlock,
  region: Region,
  text: ResolvedTextStyle,
  theme: SlideThemeTokens,
) {
  switch (block.type) {
    case "bullets":
      slide.addText(
        block.items.map((item) => ({
          text: item,
          options: { bullet: true, breakLine: true },
        })),
        { ...region, ...textOptions(text), valign: "top" },
      );
      return;

    case "paragraph":
      slide.addText(block.text, {
        ...region,
        ...textOptions(text),
        valign: "top",
      });
      return;

    case "table": {
      const fontSize = text.fontSize * 0.875;
      const rows = [block.headers, ...block.rows];
      slide.addTable(
        rows.map((row, ri) =>
          row.map((cell) => ({
            text: cell,
            options: {
              bold: ri === 0 || text.bold,
              italic: text.italic,
              align: text.align,
              fill: ri === 0 ? { color: hex(theme.headerFill) } : undefined,
              fontSize,
              color: hex(text.color),
            },
          })),
        ),
        {
          x: region.x,
          y: region.y,
          w: region.w,
          colW: Array(block.headers.length).fill(
            region.w / block.headers.length,
          ),
          border: { type: "solid", color: hex(theme.border), pt: 0.75 },
        },
      );
      return;
    }

    case "chart": {
      const chartH = region.h - (block.caption ? CAPTION_H : 0);
      slide.addChart(
        block.chartType,
        [
          {
            name: "Series 1",
            labels: block.data.map((d) => d.label),
            values: block.data.map((d) => d.value),
          },
        ],
        {
          x: region.x,
          y: region.y,
          w: region.w,
          h: chartH,
          showLegend: block.chartType === "pie",
          chartColors: theme.chartColors.map(hex),
          catAxisLabelColor: hex(theme.muted),
          valAxisLabelColor: hex(theme.muted),
        },
      );
      if (block.caption) addCaption(slide, block.caption, region, theme);
      return;
    }

    case "image": {
      const imageH = region.h - (block.caption ? CAPTION_H : 0);
      if (block.url) {
        slide.addImage({
          data: block.url,
          x: region.x,
          y: region.y,
          w: region.w,
          h: imageH,
          sizing: { type: "contain", w: region.w, h: imageH },
        });
      } else {
        slide.addText(`[Image: ${block.alt}]`, {
          x: region.x,
          y: region.y,
          w: region.w,
          h: imageH,
          fontSize: 12,
          italic: true,
          align: "center",
          valign: "middle",
          color: hex(theme.muted),
        });
      }
      if (block.caption) addCaption(slide, block.caption, region, theme);
      return;
    }
  }
}

// Draws one element at its exact canvas position and size.
function renderElement(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  element: SlideElement,
  theme: SlideThemeTokens,
) {
  const region = toRegion(element.frame);
  const text = resolveTextStyle(element, theme);
  const { content } = element;

  if (content.type === "shape") {
    slide.addShape(
      content.shape === "ellipse"
        ? pres.ShapeType.ellipse
        : pres.ShapeType.roundRect,
      {
        ...region,
        rectRadius: content.shape === "ellipse" ? undefined : 0.12,
        fill: text.fill ? { color: hex(text.fill) } : { type: "none" },
        line: {
          color: hex(element.style?.color ?? theme.border),
          width: 1.5,
        },
      },
    );
    return;
  }

  // Text and block elements with a fill get a background box first.
  if (text.fill) {
    slide.addShape(pres.ShapeType.rect, {
      ...region,
      fill: { color: hex(text.fill) },
      line: { type: "none" },
    });
  }

  if (content.type === "text") {
    if (!content.text) return; // empty placeholder box
    slide.addText(text.uppercase ? content.text.toUpperCase() : content.text, {
      ...region,
      ...textOptions(text),
      valign: text.valign,
    });
    return;
  }

  if (isContentBlock(content)) {
    renderBlock(slide, content, region, text, theme);
  }
}

function buildSlide(pres: PptxGenJS, slide: Slide, theme: SlideThemeTokens) {
  const pptxSlide = pres.addSlide();
  pptxSlide.background = { color: hex(theme.background) };
  // Array order is stacking order - later elements draw on top, same as
  // the canvas.
  for (const element of slide.elements) {
    renderElement(pres, pptxSlide, element, theme);
  }
}

// Builds a .pptx from the current deck and triggers a browser download -
// pptxgenjs's writeFile() handles the Blob/anchor-click download itself in
// a browser context. Dynamically imported so this (and its dependency
// graph) never loads during SSR, where its browser-only APIs don't exist.
// `theme` is the deck's currently-selected slide theme (lib/themes) -
// passing it through here, rather than re-deriving colors, is what makes
// the selected theme carry into the download.
export async function downloadDeckAsPptx(
  deck: Deck,
  theme: SlideThemeTokens,
): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pres = new PptxGenJS();
  pres.defineLayout({ name: "DECK_LAB_WIDE", width: SLIDE_W, height: SLIDE_H });
  pres.layout = "DECK_LAB_WIDE";
  pres.title = deck.title;

  for (const slide of deck.slides) {
    buildSlide(pres, slide, theme);
  }

  await pres.writeFile({ fileName: fileNameFor(deck.title) });
}
