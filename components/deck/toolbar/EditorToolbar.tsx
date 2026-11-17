"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Circle,
  ImagePlus,
  ImageUp,
  Italic,
  List,
  Minus,
  Plus,
  Square,
  Table,
  Trash2,
  Type,
} from "lucide-react";
import type { ElementStyle, SlideElement } from "@/lib/schema/slide";
import {
  createDefaultElement,
  createElement,
  imageFrame,
  type InsertKind,
} from "@/lib/slides/elementFactory";
import { loadImageFile } from "@/lib/slides/imageUpload";
import { getSlideTheme } from "@/lib/themes";
import { useDeckStore } from "@/store/deckStore";

const FONT_STEP = 4;
const MIN_FONT = 12;
const MAX_FONT = 200;

function ToolButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep focus (and any in-progress text edit) where it is.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-zinc-600 transition-colors hover:bg-zinc-200 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800 ${
        active ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-700" />;
}

// A native color picker that commits once, when the picker closes (the
// native "change" event), not on every intermediate color while dragging -
// so one color choice is one undo step.
function ColorButton({
  label,
  value,
  onCommit,
  children,
}: {
  label: string;
  value: string;
  onCommit: (hex: string) => void;
  children: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const commitRef = useRef(onCommit);
  useEffect(() => {
    commitRef.current = onCommit;
  });
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const handle = () => commitRef.current(input.value);
    input.addEventListener("change", handle);
    return () => input.removeEventListener("change", handle);
  }, []);
  useEffect(() => {
    if (inputRef.current) inputRef.current.value = value;
  }, [value]);

  return (
    <label
      title={label}
      className="relative flex h-8 min-w-8 cursor-pointer flex-col items-center justify-center rounded-md px-1.5 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {children}
      <span
        className="mt-0.5 h-1 w-4 rounded-sm"
        style={{ background: value }}
      />
      <input
        ref={inputRef}
        type="color"
        aria-label={label}
        defaultValue={value}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}

function FilePickButton({
  label,
  onFile,
  children,
}: {
  label: string;
  onFile: (file: File) => void;
  children: ReactNode;
}) {
  return (
    <label
      title={label}
      className="flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-md px-1.5 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {children}
      <input
        type="file"
        accept="image/*"
        aria-label={label}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

function isTextual(element: SlideElement) {
  const type = element.content.type;
  return (
    type === "text" ||
    type === "bullets" ||
    type === "paragraph" ||
    type === "table"
  );
}

// The editor's toolbar above the canvas: Insert tools are always present;
// Format tools and Delete appear for the selected element. Every action
// goes through the same deck store actions as everything else, so it's
// all undoable.
export function EditorToolbar() {
  const slide = useDeckStore(
    (state) =>
      state.deck.slides.find((s) => s.id === state.selectedSlideId) ?? null,
  );
  const selectedElementId = useDeckStore((state) => state.selectedElementId);
  const slideTheme = useDeckStore((state) => state.slideTheme);
  const addElement = useDeckStore((state) => state.addElement);
  const updateElement = useDeckStore((state) => state.updateElement);
  const updateElementStyle = useDeckStore((state) => state.updateElementStyle);
  const deleteElement = useDeckStore((state) => state.deleteElement);
  const theme = getSlideTheme(slideTheme);

  const element =
    slide?.elements.find((el) => el.id === selectedElementId) ?? null;

  const insert = (kind: InsertKind) => {
    if (!slide) return;
    // Offset each new insert a little so they don't land exactly on top of
    // one another.
    const offset = (slide.elements.length % 5) * 24;
    addElement(slide.id, createDefaultElement(kind, offset));
  };

  const insertImage = async (file: File) => {
    if (!slide) return;
    try {
      const image = await loadImageFile(file);
      addElement(
        slide.id,
        createElement(
          { type: "image", url: image.url, alt: file.name || "Image" },
          imageFrame(image.width, image.height),
        ),
      );
    } catch {
      // Unreadable file - nothing to insert.
    }
  };

  const style: ElementStyle = element?.style ?? {};
  const setStyle = (patch: Partial<ElementStyle>) => {
    if (slide && element) updateElementStyle(slide.id, element.id, patch);
  };
  const fontSize = style.fontSize ?? 34;
  const isBold = style.fontWeight === "bold" || style.fontWeight === "semibold";

  return (
    <div
      className="flex h-11 w-full min-w-0 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950"
      role="toolbar"
      aria-label="Slide editor"
    >
      <ToolButton
        label="Text box"
        onClick={() => insert("text")}
        disabled={!slide}
      >
        <Type size={16} />
      </ToolButton>
      <ToolButton
        label="Bulleted list"
        onClick={() => insert("bullets")}
        disabled={!slide}
      >
        <List size={16} />
      </ToolButton>
      <ToolButton
        label="Rectangle"
        onClick={() => insert("rect")}
        disabled={!slide}
      >
        <Square size={16} />
      </ToolButton>
      <ToolButton
        label="Ellipse"
        onClick={() => insert("ellipse")}
        disabled={!slide}
      >
        <Circle size={16} />
      </ToolButton>
      <ToolButton
        label="Table"
        onClick={() => insert("table")}
        disabled={!slide}
      >
        <Table size={16} />
      </ToolButton>
      {slide && (
        <FilePickButton label="Upload image" onFile={insertImage}>
          <ImagePlus size={16} />
        </FilePickButton>
      )}

      {element && slide && (
        <>
          {isTextual(element) && (
            <>
              <Divider />
              <ToolButton
                label="Decrease font size"
                onClick={() =>
                  setStyle({
                    fontSize: Math.max(MIN_FONT, fontSize - FONT_STEP),
                  })
                }
              >
                <Minus size={14} />
              </ToolButton>
              <span className="w-8 text-center text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
                {Math.round(fontSize / 2)}
              </span>
              <ToolButton
                label="Increase font size"
                onClick={() =>
                  setStyle({
                    fontSize: Math.min(MAX_FONT, fontSize + FONT_STEP),
                  })
                }
              >
                <Plus size={14} />
              </ToolButton>
              <ToolButton
                label="Bold"
                active={isBold}
                onClick={() =>
                  setStyle({ fontWeight: isBold ? "normal" : "bold" })
                }
              >
                <Bold size={16} />
              </ToolButton>
              <ToolButton
                label="Italic"
                active={style.italic === true}
                onClick={() =>
                  setStyle({ italic: style.italic ? undefined : true })
                }
              >
                <Italic size={16} />
              </ToolButton>
              {(["left", "center", "right"] as const).map((align) => {
                const Icon =
                  align === "left"
                    ? AlignLeft
                    : align === "center"
                      ? AlignCenter
                      : AlignRight;
                return (
                  <ToolButton
                    key={align}
                    label={`Align ${align}`}
                    active={(style.align ?? "left") === align}
                    onClick={() => setStyle({ align })}
                  >
                    <Icon size={16} />
                  </ToolButton>
                );
              })}
            </>
          )}

          {element.content.type === "shape" && (
            <>
              <Divider />
              <ColorButton
                label="Border color"
                value={style.color ?? theme.border}
                onCommit={(color) => setStyle({ color })}
              >
                <Square size={14} />
              </ColorButton>
            </>
          )}

          {element.content.type === "chart" && (
            <>
              <Divider />
              <select
                aria-label="Chart type"
                value={element.content.chartType}
                onChange={(e) => {
                  if (element.content.type !== "chart") return;
                  updateElement(slide.id, element.id, {
                    ...element.content,
                    chartType: e.target.value as "bar" | "line" | "pie",
                  });
                }}
                className="h-8 rounded-md border border-zinc-200 bg-transparent px-2 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-200"
              >
                <option value="bar">Bar chart</option>
                <option value="line">Line chart</option>
                <option value="pie">Pie chart</option>
              </select>
            </>
          )}

          {element.content.type === "image" && (
            <>
              <Divider />
              <FilePickButton
                label="Replace image"
                onFile={async (file) => {
                  if (element.content.type !== "image") return;
                  try {
                    const image = await loadImageFile(file);
                    updateElement(slide.id, element.id, {
                      ...element.content,
                      url: image.url,
                      alt: file.name || element.content.alt,
                    });
                  } catch {
                    // Unreadable file - keep the current image.
                  }
                }}
              >
                <ImageUp size={16} />
              </FilePickButton>
            </>
          )}

          <Divider />
          <ToolButton
            label="Delete element"
            onClick={() => deleteElement(slide.id, element.id)}
          >
            <Trash2 size={16} />
          </ToolButton>
        </>
      )}
    </div>
  );
}
