import type { ContentBlock } from "@/lib/schema/slide";
import { InlineEditable } from "../InlineEditable";

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
                  <InlineEditable
                    value={header}
                    onCommit={(next) => {
                      const headers = block.headers.map((h, idx) =>
                        idx === hi ? next : h,
                      );
                      onChange({ ...block, headers });
                    }}
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
                    className="border-b border-zinc-200 px-3 py-2 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
                  >
                    <InlineEditable
                      value={cell}
                      onCommit={(next) => {
                        const rows = block.rows.map((r, rIdx) =>
                          rIdx === ri
                            ? r.map((c, cIdx) => (cIdx === ci ? next : c))
                            : r,
                        );
                        onChange({ ...block, rows });
                      }}
                      placeholder="Cell"
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
}
