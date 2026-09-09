import type PptxGenJS from "pptxgenjs";
import type { SlideThemeTokens } from "@/lib/themes";
import type { ContentBlock, Deck, Slide } from "@/lib/schema/slide";

// 16:9 widescreen, in inches (pptxgenjs's native unit).
const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const MARGIN = 0.5;
const BODY_TOP = 1.3;
const BODY_BOTTOM = 0.3;

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

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

function addSlideTitle(
  slide: PptxGenJS.Slide,
  title: string,
  theme: SlideThemeTokens,
) {
  slide.addText(title, {
    x: MARGIN,
    y: 0.4,
    w: SLIDE_W - MARGIN * 2,
    h: 0.8,
    fontSize: 28,
    bold: true,
    color: hex(theme.foreground),
  });
}

// Lays blocks out top-to-bottom within `region`, estimating each block's
// height from its content (rows/items/fixed chart-image size) rather than
// measuring real text - pptxgenjs has no layout engine to measure against,
// so this is an approximation, not pixel-perfect reflow.
function renderBlocks(
  slide: PptxGenJS.Slide,
  blocks: ContentBlock[],
  region: Region,
  theme: SlideThemeTokens,
) {
  let cursorY = region.y;
  const bottom = region.y + region.h;

  for (const block of blocks) {
    const remaining = bottom - cursorY;
    if (remaining <= 0.2) break;

    switch (block.type) {
      case "bullets": {
        const h = Math.min(0.32 * block.items.length + 0.1, remaining);
        slide.addText(
          block.items.map((item) => ({
            text: item,
            options: { bullet: true, breakLine: true },
          })),
          {
            x: region.x,
            y: cursorY,
            w: region.w,
            h,
            fontSize: 14,
            color: hex(theme.foreground),
            valign: "top",
          },
        );
        cursorY += h + 0.15;
        break;
      }

      case "paragraph": {
        const h = Math.min(1.4, remaining);
        slide.addText(block.text, {
          x: region.x,
          y: cursorY,
          w: region.w,
          h,
          fontSize: 14,
          color: hex(theme.foreground),
          valign: "top",
        });
        cursorY += h + 0.15;
        break;
      }

      case "table": {
        const rows = [block.headers, ...block.rows];
        const h = Math.min(0.32 * rows.length, remaining);
        slide.addTable(
          rows.map((row, ri) =>
            row.map((cell) => ({
              text: cell,
              options: {
                bold: ri === 0,
                fill: ri === 0 ? { color: hex(theme.headerFill) } : undefined,
                fontSize: 11,
                color: hex(theme.foreground),
              },
            })),
          ),
          {
            x: region.x,
            y: cursorY,
            w: region.w,
            h,
            border: { type: "solid", color: hex(theme.border), pt: 0.75 },
          },
        );
        cursorY += h + 0.2;
        break;
      }

      case "chart": {
        const captionH = block.caption ? 0.35 : 0;
        const h = Math.min(3.2, remaining - captionH);
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
            y: cursorY,
            w: region.w,
            h,
            showLegend: false,
            chartColors: theme.chartColors.map(hex),
          },
        );
        cursorY += h;
        if (block.caption) {
          slide.addText(block.caption, {
            x: region.x,
            y: cursorY,
            w: region.w,
            h: 0.3,
            fontSize: 10,
            italic: true,
            align: "center",
            color: hex(theme.muted),
          });
          cursorY += 0.3;
        }
        cursorY += 0.15;
        break;
      }

      case "image": {
        const captionH = block.caption ? 0.35 : 0;
        const h = Math.min(3.2, remaining - captionH);
        if (block.url) {
          slide.addImage({
            data: block.url,
            x: region.x,
            y: cursorY,
            w: region.w,
            h,
            sizing: { type: "contain", w: region.w, h },
          });
        } else {
          slide.addText(`[Image: ${block.alt}]`, {
            x: region.x,
            y: cursorY,
            w: region.w,
            h,
            fontSize: 12,
            italic: true,
            align: "center",
            valign: "middle",
            color: hex(theme.muted),
          });
        }
        cursorY += h;
        if (block.caption) {
          slide.addText(block.caption, {
            x: region.x,
            y: cursorY,
            w: region.w,
            h: 0.3,
            fontSize: 10,
            italic: true,
            align: "center",
            color: hex(theme.muted),
          });
          cursorY += 0.3;
        }
        cursorY += 0.15;
        break;
      }
    }
  }
}

function addColumnHeading(
  slide: PptxGenJS.Slide,
  text: string,
  region: Region,
  theme: SlideThemeTokens,
): Region {
  slide.addText(text.toUpperCase(), {
    x: region.x,
    y: region.y,
    w: region.w,
    h: 0.35,
    fontSize: 11,
    bold: true,
    color: hex(theme.muted),
  });
  return { ...region, y: region.y + 0.45, h: region.h - 0.45 };
}

function buildSlide(pres: PptxGenJS, slide: Slide, theme: SlideThemeTokens) {
  const pptxSlide = pres.addSlide();
  pptxSlide.background = { color: hex(theme.background) };
  const fullRegion: Region = {
    x: MARGIN,
    y: BODY_TOP,
    w: SLIDE_W - MARGIN * 2,
    h: SLIDE_H - BODY_TOP - BODY_BOTTOM,
  };

  switch (slide.type) {
    case "title": {
      pptxSlide.addText(slide.title, {
        x: MARGIN,
        y: SLIDE_H / 2 - 0.9,
        w: SLIDE_W - MARGIN * 2,
        h: 1.2,
        fontSize: 40,
        bold: true,
        align: "center",
        valign: "middle",
        color: hex(theme.foreground),
      });
      if (slide.subtitle) {
        pptxSlide.addText(slide.subtitle, {
          x: MARGIN,
          y: SLIDE_H / 2 + 0.35,
          w: SLIDE_W - MARGIN * 2,
          h: 0.7,
          fontSize: 18,
          align: "center",
          color: hex(theme.muted),
        });
      }
      break;
    }

    case "content": {
      addSlideTitle(pptxSlide, slide.title, theme);
      renderBlocks(pptxSlide, slide.body, fullRegion, theme);
      break;
    }

    case "table": {
      addSlideTitle(pptxSlide, slide.title, theme);
      const tableBlock = slide.body.find((block) => block.type === "table");
      if (tableBlock) renderBlocks(pptxSlide, [tableBlock], fullRegion, theme);
      break;
    }

    case "two-column":
    case "comparison": {
      addSlideTitle(pptxSlide, slide.title, theme);
      const gap = 0.4;
      const colW = (fullRegion.w - gap) / 2;
      const left = slide.body.filter((block) => (block.column ?? 0) === 0);
      const right = slide.body.filter((block) => (block.column ?? 0) === 1);
      const [leftTitle, rightTitle] =
        slide.layout?.columnTitles ??
        (slide.type === "comparison" ? ["Option A", "Option B"] : []);

      let leftRegion: Region = { ...fullRegion, w: colW };
      let rightRegion: Region = {
        ...fullRegion,
        x: fullRegion.x + colW + gap,
        w: colW,
      };

      if (leftTitle) {
        leftRegion = addColumnHeading(pptxSlide, leftTitle, leftRegion, theme);
      }
      if (rightTitle) {
        rightRegion = addColumnHeading(
          pptxSlide,
          rightTitle,
          rightRegion,
          theme,
        );
      }

      renderBlocks(pptxSlide, left, leftRegion, theme);
      renderBlocks(pptxSlide, right, rightRegion, theme);
      break;
    }
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
