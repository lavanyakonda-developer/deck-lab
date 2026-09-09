import type jsPDF from "jspdf";
import type { autoTable as AutoTable } from "jspdf-autotable";
import type { SlideThemeTokens } from "@/lib/themes";
import type { ContentBlock, Deck, Slide } from "@/lib/schema/slide";

// 16:9 widescreen, in inches - matches the proportions of the on-screen
// canvas (SlideCanvas.tsx's aspect-video) and lib/export/pptx.ts's layout,
// so a PDF and a PPTX export of the same deck look the same shape.
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

// jspdf-autotable attaches this after drawing a table; its own types
// declare the doc parameter as `any`, so this is the narrowest true shape.
type DocWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

function fileNameFor(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "deck"}.pdf`;
}

// Pages default to white - for a dark theme the background must be
// painted explicitly, once per page, before anything else draws on it.
function paintBackground(doc: jsPDF, theme: SlideThemeTokens) {
  doc.setFillColor(theme.background);
  doc.rect(0, 0, SLIDE_W, SLIDE_H, "F");
}

function addSlideTitle(doc: jsPDF, title: string, theme: SlideThemeTokens) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(theme.foreground);
  doc.text(title, MARGIN, 0.85);
}

// Wraps `text` to `region.w` and draws as many lines as fit in the
// remaining vertical space, returning the new cursor y. There's no layout
// engine to measure against here (same constraint as lib/export/pptx.ts),
// so overflow is truncated rather than shrinking the font or spilling
// onto a new page.
function drawWrapped(
  doc: jsPDF,
  text: string,
  region: Region,
  cursorY: number,
  remaining: number,
  options: { fontSize: number; color: string; bold?: boolean },
): number {
  doc.setFont("helvetica", options.bold ? "bold" : "normal");
  doc.setFontSize(options.fontSize);
  doc.setTextColor(options.color);

  const lineHeight = (options.fontSize / 72) * 1.35;
  const lines: string[] = doc.splitTextToSize(text, region.w);
  const maxLines = Math.max(1, Math.floor(remaining / lineHeight));
  const shown = lines.slice(0, maxLines);

  shown.forEach((line, i) => {
    doc.text(line, region.x, cursorY + lineHeight * (i + 1) - lineHeight * 0.3);
  });

  return cursorY + lineHeight * shown.length;
}

// Chart label/legend text is drawn with jsPDF's own doc.text(), not
// context2d's fillText(): context2d.font's "px" parsing multiplies the
// numeric size by the document's unit scale factor (72, since this doc is
// in "in") instead of converting real pixels to points, so an "8px" label
// rendered ~576pt tall and bled across the page. doc.text()'s font sizes
// are always real points regardless of document unit, so it doesn't have
// that bug - context2d is used here only for vector shapes (arc/rect/line).
function setLabelFont(doc: jsPDF, theme: SlideThemeTokens) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(theme.muted);
}

function drawBarChart(
  doc: jsPDF,
  data: { label: string; value: number }[],
  region: Region,
  theme: SlideThemeTokens,
) {
  const ctx = doc.context2d;
  const plotH = region.h - 0.3;
  const max = Math.max(...data.map((d) => d.value), 1);
  const slotW = region.w / data.length;
  const barW = slotW * 0.6;

  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 0.01;
  ctx.beginPath();
  ctx.moveTo(region.x, region.y + plotH);
  ctx.lineTo(region.x + region.w, region.y + plotH);
  ctx.stroke();

  data.forEach((point, i) => {
    const barH = (point.value / max) * (plotH - 0.1);
    const x = region.x + i * slotW + (slotW - barW) / 2;
    ctx.fillStyle = theme.chartColors[i % theme.chartColors.length];
    ctx.fillRect(x, region.y + plotH - barH, barW, barH);

    setLabelFont(doc, theme);
    doc.text(point.label, x + barW / 2, region.y + plotH + 0.18, {
      align: "center",
    });
  });
}

function drawLineChart(
  doc: jsPDF,
  data: { label: string; value: number }[],
  region: Region,
  theme: SlideThemeTokens,
) {
  const ctx = doc.context2d;
  const plotH = region.h - 0.3;
  const max = Math.max(...data.map((d) => d.value), 1);
  const points = data.map((point, i) => ({
    x:
      data.length > 1
        ? region.x + (i / (data.length - 1)) * region.w
        : region.x + region.w / 2,
    y: region.y + plotH - (point.value / max) * (plotH - 0.1),
    label: point.label,
  }));

  ctx.strokeStyle = theme.chartColors[0];
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  points.forEach((point, i) => {
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  points.forEach((point) => {
    ctx.fillStyle = theme.chartColors[0];
    ctx.beginPath();
    ctx.arc(point.x, point.y, 0.035, 0, Math.PI * 2, false);
    ctx.fill();

    setLabelFont(doc, theme);
    doc.text(point.label, point.x, region.y + plotH + 0.18, {
      align: "center",
    });
  });
}

function drawPieChart(
  doc: jsPDF,
  data: { label: string; value: number }[],
  region: Region,
  theme: SlideThemeTokens,
) {
  const ctx = doc.context2d;
  const total = data.reduce((sum, point) => sum + point.value, 0) || 1;
  const legendH = Math.min(0.22 * data.length, region.h * 0.4);
  const pieH = region.h - legendH - 0.1;
  const radius = Math.min(region.w, pieH) / 2 - 0.05;
  const cx = region.x + region.w / 2;
  const cy = region.y + pieH / 2;

  let angle = -Math.PI / 2;
  data.forEach((point, i) => {
    const sweep = (point.value / total) * Math.PI * 2;
    ctx.fillStyle = theme.chartColors[i % theme.chartColors.length];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle, angle + sweep, false);
    ctx.closePath();
    ctx.fill();
    angle += sweep;
  });

  const legendTop = region.y + pieH + 0.15;
  const colW = region.w / Math.min(data.length, 3) || region.w;
  data.forEach((point, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = region.x + col * colW;
    const y = legendTop + row * 0.2;
    ctx.fillStyle = theme.chartColors[i % theme.chartColors.length];
    ctx.fillRect(x, y - 0.08, 0.1, 0.1);

    setLabelFont(doc, theme);
    doc.text(`${point.label}: ${point.value}`, x + 0.16, y);
  });
}

// Lays blocks out top-to-bottom within `region`, same approach (and same
// height-estimation caveat) as lib/export/pptx.ts's renderBlocks.
function renderBlocks(
  doc: jsPDF,
  autoTable: typeof AutoTable,
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
        for (const item of block.items) {
          const itemRemaining = bottom - cursorY;
          if (itemRemaining <= 0.15) break;
          cursorY = drawWrapped(
            doc,
            `•  ${item}`,
            region,
            cursorY,
            itemRemaining,
            { fontSize: 12, color: theme.foreground },
          );
        }
        cursorY += 0.1;
        break;
      }

      case "paragraph": {
        cursorY =
          drawWrapped(doc, block.text, region, cursorY, remaining, {
            fontSize: 12,
            color: theme.foreground,
          }) + 0.1;
        break;
      }

      case "table": {
        autoTable(doc, {
          head: [block.headers],
          body: block.rows,
          startY: cursorY,
          margin: { left: region.x, right: SLIDE_W - region.x - region.w },
          tableWidth: region.w,
          styles: {
            fontSize: 9,
            textColor: theme.foreground,
            cellPadding: 0.04,
            fillColor: theme.background,
          },
          headStyles: {
            fillColor: theme.headerFill,
            textColor: theme.foreground,
            fontStyle: "bold",
          },
          theme: "grid",
          tableLineColor: theme.border,
          tableLineWidth: 0.005,
        });
        cursorY =
          (doc as DocWithAutoTable).lastAutoTable?.finalY ?? cursorY + 1;
        cursorY += 0.2;
        break;
      }

      case "chart": {
        const captionH = block.caption ? 0.25 : 0;
        const chartRegion: Region = {
          ...region,
          y: cursorY,
          h: Math.min(3, remaining - captionH),
        };
        if (block.chartType === "bar")
          drawBarChart(doc, block.data, chartRegion, theme);
        else if (block.chartType === "line")
          drawLineChart(doc, block.data, chartRegion, theme);
        else drawPieChart(doc, block.data, chartRegion, theme);
        cursorY += chartRegion.h;
        if (block.caption) {
          cursorY = drawWrapped(doc, block.caption, region, cursorY, captionH, {
            fontSize: 9,
            color: theme.muted,
          });
        }
        cursorY += 0.15;
        break;
      }

      case "image": {
        const captionH = block.caption ? 0.25 : 0;
        const boxH = Math.min(3, remaining - captionH);
        if (block.url) {
          // Generated images are always 1024x1024 (see
          // app/api/generate-image/route.ts) - square, so a centered
          // square fit needs no measured aspect ratio.
          const size = Math.min(region.w, boxH);
          doc.addImage(
            block.url,
            region.x + (region.w - size) / 2,
            cursorY + (boxH - size) / 2,
            size,
            size,
          );
        } else {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(11);
          doc.setTextColor(theme.muted);
          doc.text(
            `[Image: ${block.alt}]`,
            region.x + region.w / 2,
            cursorY + boxH / 2,
            {
              align: "center",
              baseline: "middle",
            },
          );
        }
        cursorY += boxH;
        if (block.caption) {
          cursorY = drawWrapped(doc, block.caption, region, cursorY, captionH, {
            fontSize: 9,
            color: theme.muted,
          });
        }
        cursorY += 0.15;
        break;
      }
    }
  }
}

function addColumnHeading(
  doc: jsPDF,
  text: string,
  region: Region,
  theme: SlideThemeTokens,
): Region {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(theme.muted);
  doc.text(text.toUpperCase(), region.x, region.y + 0.15);
  return { ...region, y: region.y + 0.35, h: region.h - 0.35 };
}

function buildSlide(
  doc: jsPDF,
  autoTable: typeof AutoTable,
  slide: Slide,
  theme: SlideThemeTokens,
) {
  paintBackground(doc, theme);
  const fullRegion: Region = {
    x: MARGIN,
    y: BODY_TOP,
    w: SLIDE_W - MARGIN * 2,
    h: SLIDE_H - BODY_TOP - BODY_BOTTOM,
  };

  switch (slide.type) {
    case "title": {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(32);
      doc.setTextColor(theme.foreground);
      doc.text(slide.title, SLIDE_W / 2, SLIDE_H / 2 - 0.15, {
        align: "center",
      });
      if (slide.subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(14);
        doc.setTextColor(theme.muted);
        doc.text(slide.subtitle, SLIDE_W / 2, SLIDE_H / 2 + 0.45, {
          align: "center",
        });
      }
      break;
    }

    case "content": {
      addSlideTitle(doc, slide.title, theme);
      renderBlocks(doc, autoTable, slide.body, fullRegion, theme);
      break;
    }

    case "table": {
      addSlideTitle(doc, slide.title, theme);
      const tableBlock = slide.body.find((block) => block.type === "table");
      if (tableBlock)
        renderBlocks(doc, autoTable, [tableBlock], fullRegion, theme);
      break;
    }

    case "two-column":
    case "comparison": {
      addSlideTitle(doc, slide.title, theme);
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

      if (leftTitle)
        leftRegion = addColumnHeading(doc, leftTitle, leftRegion, theme);
      if (rightTitle)
        rightRegion = addColumnHeading(doc, rightTitle, rightRegion, theme);

      renderBlocks(doc, autoTable, left, leftRegion, theme);
      renderBlocks(doc, autoTable, right, rightRegion, theme);
      break;
    }
  }
}

// Builds a .pdf from the current deck and triggers a browser download via
// jsPDF's save() - no print dialog, same one-click UX as
// lib/export/pptx.ts's downloadDeckAsPptx(). Charts are redrawn as PDF
// vector shapes with jsPDF's built-in context2d (a canvas-like API that
// emits real PDF drawing operators, not an actual <canvas> - so this has
// no DOM dependency and works the same in a test/Node context). Dynamically
// imported by its caller so this never loads during SSR. `theme` is the
// deck's currently-selected slide theme (lib/themes) - passing it through
// here, rather than re-deriving colors, is what makes the selected theme
// carry into the download.
export async function downloadDeckAsPdf(
  deck: Deck,
  theme: SlideThemeTokens,
): Promise<void> {
  const [{ default: JsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new JsPDF({
    orientation: "landscape",
    unit: "in",
    format: [SLIDE_W, SLIDE_H],
  });

  deck.slides.forEach((slide, i) => {
    if (i > 0) doc.addPage([SLIDE_W, SLIDE_H], "landscape");
    buildSlide(doc, autoTable, slide, theme);
  });

  doc.save(fileNameFor(deck.title));
}
