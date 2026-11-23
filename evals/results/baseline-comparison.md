# Tool calling vs. full-deck regeneration

Single-slide edit requests from the edit-accuracy cases. Before each one, slide 2's title is manually changed to "MY MANUAL EDIT". The same request then goes to the app (targeted tool calls) and to a baseline that sends the full deck JSON to the same model and asks for the full updated deck back (same structured-output schema). Slides are compared by position and visible content. See `evals/README.md` for metric definitions.

- **date**: 2026-11-22
- **model**: gpt-4o
- **cases**: 12
- **runs per case**: 3

## Comparison

| Metric | Tool calling (`/api/chat`) | Full-deck baseline |
| --- | --- | --- |
| Manual-edit survival (27 runs) | 100.0% | 100.0% |
| Non-target slides preserved | 100.0% | 100.0% |
| Target slide changed | 75.0% | 91.7% |
| Slide count changed | 0.0% | 0.0% |
| Prompt tokens / edit (mean) | 3,241 | 882 |
| Completion tokens / edit (mean) | 70 | 389 |
| Latency p50 / p95 (ms) | 1,113 / 1,831 | 2,388 / 2,742 |
| Errors | 0 | 0 |

## Per case

| Case | Target | Tool: preserved / survived | Baseline: preserved / survived |
| --- | --- | --- | --- |
| number-concise-2 | slide 2 | 3/3 / n/a | 3/3 / n/a |
| number-retitle-3 | slide 3 | 3/3 / 3/3 | 3/3 / 3/3 |
| number-add-bullet-2 | slide 2 | 3/3 / n/a | 3/3 / n/a |
| number-rewrite-column-5 | slide 5 | 3/3 / 3/3 | 3/3 / 3/3 |
| number-subtitle-1 | slide 1 | 3/3 / 3/3 | 3/3 / 3/3 |
| number-table-row-6 | slide 6 | 3/3 / 3/3 | 3/3 / 3/3 |
| title-expand-paragraph | slide 3 | 3/3 / 3/3 | 3/3 / 3/3 |
| title-rename-table-slide | slide 6 | 3/3 / 3/3 | 3/3 / 3/3 |
| title-add-to-column | slide 4 | 3/3 / 3/3 | 3/3 / 3/3 |
| title-fix-subtitle | slide 1 | 3/3 / 3/3 | 3/3 / 3/3 |
| title-punchier-comparison | slide 5 | 3/3 / 3/3 | 3/3 / 3/3 |
| title-remove-bullet | slide 2 | 3/3 / n/a | 3/3 / n/a |
