import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SlideThemeTokens } from "@/lib/themes";
import type { ContentBlock } from "@/lib/schema/slide";
import { InlineEditable } from "../InlineEditable";

// Renders one content block inside its element's frame. Sizes are in em
// (relative to the element's font size) so blocks scale with the stage.
// Text color, weight, style and alignment are inherited from the element
// (SlideElementView applies the element's style), so formatting from the
// toolbar applies to bullets, paragraphs and tables alike. Bullets,
// paragraphs and table cells are editable in place; charts and images are
// changed through the format toolbar or chat.
export function EditableContentBlock({
  block,
  theme,
  onChange,
}: {
  block: ContentBlock;
  theme: SlideThemeTokens;
  onChange: (next: ContentBlock) => void;
}) {
  switch (block.type) {
    case "bullets":
      return (
        <ul className="list-disc space-y-[0.5em] pl-[1.25em]">
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineEditable
                value={item}
                onCommit={(next) => {
                  const items = block.items.map((it, idx) =>
                    idx === i ? next : it,
                  );
                  onChange({ ...block, items });
                }}
                placeholder="Bullet text"
                ariaLabel={`Bullet ${i + 1}`}
              />
            </li>
          ))}
        </ul>
      );
    case "paragraph":
      return (
        <InlineEditable
          value={block.text}
          onCommit={(next) => onChange({ ...block, text: next })}
          placeholder="Paragraph text"
          ariaLabel="Paragraph"
        />
      );
    case "table": {
      const setHeader = (index: number) => (next: string) =>
        onChange({
          ...block,
          headers: block.headers.map((h, i) => (i === index ? next : h)),
        });
      const setCell = (row: number, col: number) => (next: string) =>
        onChange({
          ...block,
          rows: block.rows.map((r, ri) =>
            ri === row ? r.map((c, ci) => (ci === col ? next : c)) : r,
          ),
        });
      return (
        <table className="w-full border-collapse text-[0.875em]">
          <thead>
            <tr>
              {block.headers.map((header, hi) => (
                <th
                  key={hi}
                  className="border-b px-[0.75em] py-[0.5em] font-semibold [text-align:inherit]"
                  style={{
                    borderColor: theme.border,
                    backgroundColor: theme.headerFill,
                  }}
                >
                  <InlineEditable
                    value={header}
                    onCommit={setHeader(hi)}
                    placeholder="Header"
                    ariaLabel={`Column ${hi + 1} header`}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="border-b px-[0.75em] py-[0.5em]"
                    style={{ borderColor: theme.border }}
                  >
                    <InlineEditable
                      value={cell}
                      onCommit={setCell(ri, ci)}
                      placeholder=" "
                      ariaLabel={`Row ${ri + 1}, column ${ci + 1}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "chart": {
      const axisTick = { fill: theme.muted, fontSize: 26 };
      const tooltipStyle = {
        background: theme.background,
        border: `1px solid ${theme.border}`,
        color: theme.foreground,
      };
      return (
        <div className="flex h-full flex-col gap-[0.5em]">
          <div className="min-h-0 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              {block.chartType === "pie" ? (
                <PieChart>
                  <Pie
                    data={block.data}
                    dataKey="value"
                    nameKey="label"
                    outerRadius="80%"
                    label
                    isAnimationActive={false}
                  >
                    {block.data.map((_, i) => (
                      <Cell
                        key={i}
                        fill={theme.chartColors[i % theme.chartColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              ) : block.chartType === "line" ? (
                <LineChart data={block.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                  <XAxis
                    dataKey="label"
                    tick={axisTick}
                    stroke={theme.border}
                  />
                  <YAxis tick={axisTick} stroke={theme.border} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={theme.chartColors[0]}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </LineChart>
              ) : (
                <BarChart data={block.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                  <XAxis
                    dataKey="label"
                    tick={axisTick}
                    stroke={theme.border}
                  />
                  <YAxis tick={axisTick} stroke={theme.border} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="value"
                    fill={theme.chartColors[0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          {block.caption && (
            <p
              className="text-center text-[0.75em]"
              style={{ color: theme.muted }}
            >
              {block.caption}
            </p>
          )}
        </div>
      );
    }
    case "image":
      return (
        <div className="flex h-full flex-col gap-[0.5em]">
          {block.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URIs, not an optimizable remote image
            <img
              src={block.url}
              alt={block.alt}
              className="min-h-0 w-full flex-1 rounded-xl object-contain"
            />
          ) : (
            <div
              className="flex min-h-0 w-full flex-1 animate-pulse flex-col items-center justify-center gap-[0.5em] rounded-xl border-2 border-dashed"
              style={{ borderColor: theme.border, color: theme.muted }}
            >
              <span className="text-[1.5em]">🖼️</span>
              <span className="max-w-[80%] truncate text-[0.75em]">
                {block.alt}
              </span>
            </div>
          )}
          {block.caption && (
            <p
              className="text-center text-[0.75em]"
              style={{ color: theme.muted }}
            >
              {block.caption}
            </p>
          )}
        </div>
      );
  }
}
