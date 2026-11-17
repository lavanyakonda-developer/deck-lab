"use client";

import type { CSSProperties, PointerEvent, MouseEvent, ReactNode } from "react";
import type { ElementRole, Frame, SlideElement } from "@/lib/schema/slide";
import type { SlideThemeTokens } from "@/lib/themes";
import { useDeckStore } from "@/store/deckStore";
import { InlineEditable } from "../InlineEditable";
import { EditableContentBlock } from "./EditableContentBlock";

const DEFAULT_FONT_SIZE = 34;

const FONT_WEIGHTS = { normal: 400, semibold: 600, bold: 700 } as const;
const VERTICAL_ALIGN = {
  top: "flex-start",
  middle: "center",
  bottom: "flex-end",
} as const;

const PLACEHOLDERS: Partial<Record<ElementRole, string>> = {
  textbox: "Type something",
  title: "Slide title",
  subtitle: "Subtitle (optional)",
  "column-title": "Column title (optional)",
};

const ARIA_LABELS: Partial<Record<ElementRole, string>> = {
  title: "Slide title",
  subtitle: "Slide subtitle",
  "column-title": "Column title",
};

// One positioned element on the stage. Position/size come from `frame`
// (stage units - the element's own frame, or an in-progress drag frame);
// typography comes from its style, with colors resolved against the
// current theme so a theme switch recolors everything.
//
// Outside text-edit mode a transparent overlay covers the element so a
// press selects/drags it instead of landing in its text; SlideStage owns
// what a press does. While editing, the overlay is removed and the text is
// directly editable; leaving the element (blur) ends edit mode.
export function SlideElementView({
  slideId,
  element,
  frame,
  theme,
  isEditing,
  onPointerDown,
  onDoubleClick,
  onEditEnd,
}: {
  slideId: string;
  element: SlideElement;
  frame: Frame;
  theme: SlideThemeTokens;
  isEditing: boolean;
  onPointerDown: (e: PointerEvent) => void;
  onDoubleClick: (e: MouseEvent) => void;
  onEditEnd: () => void;
}) {
  const updateElement = useDeckStore((state) => state.updateElement);
  const { style = {}, content } = element;
  const fontSize = style.fontSize ?? DEFAULT_FONT_SIZE;

  const box: CSSProperties = {
    position: "absolute",
    left: frame.x,
    top: frame.y,
    width: frame.w,
    height: frame.h,
  };

  // Wraps every kind of element with the same id hook, blur tracking and
  // drag overlay.
  const shell = (
    children: ReactNode,
    extraStyle: CSSProperties,
    className = "",
  ) => (
    <div
      data-element-id={element.id}
      className={className}
      style={{ ...box, ...extraStyle }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          onEditEnd();
        }
      }}
    >
      {children}
      {!isEditing && (
        <div
          className="absolute inset-0 cursor-move"
          onPointerDown={onPointerDown}
          onDoubleClick={onDoubleClick}
        />
      )}
    </div>
  );

  if (content.type === "shape") {
    return shell(
      null,
      {
        borderColor: style.color ?? theme.border,
        background: style.fill,
        borderRadius: content.shape === "ellipse" ? "50%" : undefined,
      },
      content.shape === "ellipse" ? "border-2" : "rounded-2xl border-2",
    );
  }

  const textBox: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    justifyContent: VERTICAL_ALIGN[style.valign ?? "top"],
    fontSize,
    lineHeight: fontSize >= 48 ? 1.2 : 1.5,
    fontWeight: FONT_WEIGHTS[style.fontWeight ?? "normal"],
    textAlign: style.align ?? "left",
    color: style.color ?? theme[style.tone ?? "foreground"],
    fontStyle: style.italic ? "italic" : undefined,
    background: style.fill,
    textTransform: style.uppercase ? "uppercase" : undefined,
    letterSpacing: style.uppercase ? "0.025em" : undefined,
  };

  if (content.type === "text") {
    // Decorative text (the comparison layout's "vs") isn't editable.
    if (element.role === "decoration") {
      return shell(content.text, textBox);
    }
    return shell(
      <InlineEditable
        value={content.text}
        onCommit={(text) =>
          updateElement(slideId, element.id, { type: "text", text })
        }
        placeholder={PLACEHOLDERS[element.role] ?? "Text"}
        ariaLabel={ARIA_LABELS[element.role] ?? "Text box"}
      />,
      textBox,
    );
  }

  return shell(
    <EditableContentBlock
      block={content}
      theme={theme}
      onChange={(next) => updateElement(slideId, element.id, next)}
    />,
    textBox,
  );
}
