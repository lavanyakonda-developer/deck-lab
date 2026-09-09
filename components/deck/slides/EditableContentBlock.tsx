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
import type { ContentBlock } from "@/lib/schema/slide";
import { InlineEditable } from "../InlineEditable";

const CHART_COLORS = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
];

// Only plain text (bullets, paragraphs - and slide title/subtitle,
// handled by the slide components) is manually editable in this project's
// scope. table/chart/image are read-only here by design - changing them
// goes through chat instead.
export function EditableContentBlock({
  block,
  onChange,
}: {
  block: ContentBlock;
  onChange: (next: ContentBlock) => void;
}) {
  switch (block.type) {
    case "bullets":
      return (
        <ul className="list-disc space-y-2 pl-5 text-zinc-700 dark:text-zinc-300">
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
          className="text-zinc-700 dark:text-zinc-300"
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
                  className="border-b border-zinc-300 px-3 py-2 font-semibold text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
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
                    className="border-b border-zinc-200 px-3 py-2 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "chart":
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
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              ) : block.chartType === "line" ? (
                <LineChart data={block.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </LineChart>
              ) : (
                <BarChart data={block.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    fill={CHART_COLORS[0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          {block.caption && (
            <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
              {block.caption}
            </p>
          )}
        </div>
      );
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
            <div className="flex h-40 w-full animate-pulse flex-col items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-600">
              <span className="text-2xl">🖼️</span>
              <span className="max-w-[80%] truncate text-xs">{block.alt}</span>
            </div>
          )}
          {block.caption && (
            <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
              {block.caption}
            </p>
          )}
        </div>
      );
  }
}
