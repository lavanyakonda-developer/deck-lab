import type jsPDF from "jspdf";
import type { autoTable as AutoTable } from "jspdf-autotable";
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

function fontStyle(text: { bold: boolean; italic: boolean }): string {
  if (text.bold && text.italic) return "bolditalic";
  if (text.bold) return "bold";
  if (text.italic) return "italic";
  return "normal";
}

function lineHeightFor(fontSize: number) {
  return (fontSize / 72) * 1.35;
}

// Wraps `text` to the region width and draws as many lines as fit in the
// region's height (jsPDF has no layout engine - overflow is truncated
// rather than spilling onto a new page). `prefix` is drawn on the first
// line only (a bullet). Returns the y after the last line drawn.
function drawWrapped(
  doc: jsPDF,
  text: string,
  region: Region,
  startY: number,
  style: ResolvedTextStyle,
  prefix = "",
): number {
  doc.setFont("helvetica", fontStyle(style));
  doc.setFontSize(style.fontSize);
  doc.setTextColor(style.color);

  const lineHeight = lineHeightFor(style.fontSize);
  const indent = prefix ? doc.getTextWidth(prefix) : 0;
  const lines: string[] = doc.splitTextToSize(text, region.w - indent);
  const remaining = region.y + region.h - startY;
  const maxLines = Math.max(0, Math.floor(remaining / lineHeight));
  const shown = lines.slice(0, maxLines);

  const x =
    style.align === "center"
      ? region.x + region.w / 2
      : style.align === "right"
        ? region.x + region.w
        : region.x + indent;
  shown.forEach((line, i) => {
    const baseline = startY + lineHeight * (i + 1) - lineHeight * 0.3;
    if (i === 0 && prefix) doc.text(prefix, region.x, baseline);
    doc.text(line, x, baseline, { align: style.align });
  });
  return startY + lineHeight * shown.length;
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

const CAPTION_H = 0.25;

function drawCaption(
  doc: jsPDF,
  caption: string,
  region: Region,
  theme: SlideThemeTokens,
) {
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(theme.muted);
  doc.text(caption, region.x + region.w / 2, region.y + region.h - 0.08, {
    align: "center",
  });
}

// Draws one content block filling its element's region.
function renderBlock(
  doc: jsPDF,
  autoTable: typeof AutoTable,
  block: ContentBlock,
  region: Region,
  text: ResolvedTextStyle,
  theme: SlideThemeTokens,
) {
  switch (block.type) {
    case "bullets": {
      let y = region.y;
      const gap = lineHeightFor(text.fontSize) * 0.35;
      for (const item of block.items) {
        y = drawWrapped(doc, item, region, y, text, "•  ") + gap;
      }
      return;
    }

    case "paragraph":
      drawWrapped(doc, block.text, region, region.y, text);
      return;

    case "table":
      autoTable(doc, {
        head: [block.headers],
        body: block.rows,
        startY: region.y,
        margin: { left: region.x, right: SLIDE_W - region.x - region.w },
        tableWidth: region.w,
        styles: {
          fontSize: text.fontSize * 0.875,
          textColor: text.color,
          fontStyle: text.italic ? "italic" : "normal",
          halign: text.align,
          cellPadding: 0.04,
          fillColor: text.fill ?? theme.background,
        },
        headStyles: {
          fillColor: theme.headerFill,
          textColor: text.color,
          fontStyle: "bold",
        },
        theme: "grid",
        tableLineColor: theme.border,
        tableLineWidth: 0.005,
      });
      return;

    case "chart": {
      const chartRegion: Region = {
        ...region,
        h: region.h - (block.caption ? CAPTION_H : 0),
      };
      if (block.chartType === "bar")
        drawBarChart(doc, block.data, chartRegion, theme);
      else if (block.chartType === "line")
        drawLineChart(doc, block.data, chartRegion, theme);
      else drawPieChart(doc, block.data, chartRegion, theme);
      if (block.caption) drawCaption(doc, block.caption, region, theme);
      return;
    }

    case "image": {
      const boxH = region.h - (block.caption ? CAPTION_H : 0);
      if (block.url) {
        // Fit ("contain") using the image's real aspect ratio - uploaded
        // images aren't square like generated ones.
        let ratio = 1;
        try {
          const props = doc.getImageProperties(block.url);
          ratio = props.width / props.height || 1;
        } catch {
          // Unknown format - fall back to square.
        }
        let w = region.w;
        let h = w / ratio;
        if (h > boxH) {
          h = boxH;
          w = h * ratio;
        }
        doc.addImage(
          block.url,
          region.x + (region.w - w) / 2,
          region.y + (boxH - h) / 2,
          w,
          h,
        );
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(11);
        doc.setTextColor(theme.muted);
        doc.text(
          `[Image: ${block.alt}]`,
          region.x + region.w / 2,
          region.y + boxH / 2,
          { align: "center", baseline: "middle" },
        );
      }
      if (block.caption) drawCaption(doc, block.caption, region, theme);
      return;
    }
  }
}

// Draws one element at its exact canvas position and size.
function renderElement(
  doc: jsPDF,
  autoTable: typeof AutoTable,
  element: SlideElement,
  theme: SlideThemeTokens,
) {
  const region = toRegion(element.frame);
  const text = resolveTextStyle(element, theme);
  const { content } = element;

  if (content.type === "shape") {
    doc.setDrawColor(element.style?.color ?? theme.border);
    doc.setLineWidth(0.02);
    if (text.fill) doc.setFillColor(text.fill);
    const mode = text.fill ? "FD" : "S";
    if (content.shape === "ellipse") {
      doc.ellipse(
        region.x + region.w / 2,
        region.y + region.h / 2,
        region.w / 2,
        region.h / 2,
        mode,
      );
    } else {
      doc.roundedRect(region.x, region.y, region.w, region.h, 0.12, 0.12, mode);
    }
    return;
  }

  if (text.fill) {
    doc.setFillColor(text.fill);
    doc.rect(region.x, region.y, region.w, region.h, "F");
  }

  if (content.type === "text") {
    if (!content.text) return; // empty placeholder box
    const value = text.uppercase ? content.text.toUpperCase() : content.text;
    // Vertical alignment: measure the wrapped height, then offset.
    doc.setFont("helvetica", fontStyle(text));
    doc.setFontSize(text.fontSize);
    const lines: string[] = doc.splitTextToSize(value, region.w);
    const blockH = Math.min(
      region.h,
      lines.length * lineHeightFor(text.fontSize),
    );
    const startY =
      text.valign === "middle"
        ? region.y + (region.h - blockH) / 2
        : text.valign === "bottom"
          ? region.y + region.h - blockH
          : region.y;
    drawWrapped(doc, value, region, startY, text);
    return;
  }

  if (isContentBlock(content)) {
    renderBlock(doc, autoTable, content, region, text, theme);
  }
}

function buildSlide(
  doc: jsPDF,
  autoTable: typeof AutoTable,
  slide: Slide,
  theme: SlideThemeTokens,
) {
  paintBackground(doc, theme);
  // Array order is stacking order - later elements draw on top, same as
  // the canvas.
  for (const element of slide.elements) {
    renderElement(doc, autoTable, element, theme);
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
