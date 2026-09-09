"use client";

import { useEffect, useRef, useState } from "react";

interface InlineEditableProps {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

const NBSP_PATTERN = new RegExp("\u00A0", "g");

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function InlineEditable({
  value,
  onCommit,
  placeholder = "Click to edit",
  className = "",
  ariaLabel,
}: InlineEditableProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Set once for SSR/first paint; later changes are applied imperatively below so React never re-diffs contentEditable children.
  const [initialValue] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== value) {
      el.textContent = value;
    }
  }, [value]);

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const next = (el.textContent ?? "").replace(NBSP_PATTERN, " ").trim();
    if (next === "") {
      el.replaceChildren();
    } else if (el.textContent !== next) {
      el.textContent = next;
    }
    if (next !== value) onCommit(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      if (ref.current) ref.current.textContent = value;
      e.currentTarget.blur();
    }
  };

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={commit}
      onKeyDown={handleKeyDown}
      data-placeholder={placeholder}
      aria-label={ariaLabel}
      role="textbox"
      tabIndex={0}
      dangerouslySetInnerHTML={{ __html: escapeHtml(initialValue) }}
      className={`cursor-text rounded-sm break-words whitespace-pre-wrap outline-none empty:before:text-zinc-400 empty:before:content-[attr(data-placeholder)] focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-700 ${className}`}
    />
  );
}
