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

// Only plain text (bullets, paragraphs - and slide title/subtitle,
// handled by the slide components) is manually editable in this project's
// scope. table/chart/image are read-only here by design - changing them
// goes through chat instead.
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
        <ul
          className="list-disc space-y-2 pl-5"
          style={{ color: theme.foreground }}
        >
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
          style={{ color: theme.foreground }}
        />
      );
    case "table":
      return (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              {block.headers.map((header, hi) => (
                <th
                  key={hi}
                  className="border-b px-3 py-2 font-semibold"
                  style={{
                    borderColor: theme.border,
                    color: theme.foreground,
                    backgroundColor: theme.headerFill,
                  }}
                >
                  {header}
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
                    className="border-b px-3 py-2"
                    style={{
                      borderColor: theme.border,
                      color: theme.foreground,
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "chart": {
      const axisTick = { fill: theme.muted, fontSize: 12 };
      const tooltipStyle = {
        background: theme.background,
        border: `1px solid ${theme.border}`,
        color: theme.foreground,
      };
      return (
        <div className="flex flex-col gap-2">
          <div className="h-56 w-full">
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
            <p className="text-center text-xs" style={{ color: theme.muted }}>
              {block.caption}
            </p>
          )}
        </div>
      );
    }
    case "image":
      return (
        <div className="flex flex-col gap-2">
          {block.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URIs, not an optimizable remote image
            <img
              src={block.url}
              alt={block.alt}
              className="max-h-56 w-full rounded-md object-contain"
            />
          ) : (
            <div
              className="flex h-40 w-full animate-pulse flex-col items-center justify-center gap-2 rounded-md border border-dashed"
              style={{ borderColor: theme.border, color: theme.muted }}
            >
              <span className="text-2xl">🖼️</span>
              <span className="max-w-[80%] truncate text-xs">{block.alt}</span>
            </div>
          )}
          {block.caption && (
            <p className="text-center text-xs" style={{ color: theme.muted }}>
              {block.caption}
            </p>
          )}
        </div>
      );
  }
}
