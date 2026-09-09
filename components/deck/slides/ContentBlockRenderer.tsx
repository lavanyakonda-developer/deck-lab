import type { ContentBlock } from "@/lib/schema/slide";

export function ContentBlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "bullets":
      return (
        <ul className="list-disc space-y-2 pl-5 text-zinc-700 dark:text-zinc-300">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "paragraph":
      return <p className="text-zinc-700 dark:text-zinc-300">{block.text}</p>;
    case "table":
      return (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              {block.headers.map((header, i) => (
                <th
                  key={i}
                  className="border-b border-zinc-300 px-3 py-2 font-semibold text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
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
  }
}
