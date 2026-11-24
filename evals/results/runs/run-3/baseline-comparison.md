# Tool calling vs. full-deck regeneration

Single-slide edit requests from the edit-accuracy cases. Before each one, the deck is edited by hand: `MY MANUAL EDIT` is appended to slide 2's title, and slide 4's title is moved, resized and restyled. The same request then goes to the app (targeted tool calls) and to a baseline that sends the full deck JSON to the same model and asks for the full updated deck back (same structured-output schema). Text is compared by slide position and visible content; layout by element frames and styles. The baseline rebuilds every slide's layout from scratch, so its manual-layout survival is 0% by construction, not by chance. See `evals/README.md` for metric definitions.

- **date**: 2026-11-23
- **run**: run-3
- **model**: gpt-4o
- **cases**: 12
- **runs per case**: 3
- **decks**: seed (6 slides), large (20 slides)

## Seed deck (6 slides)

| Metric | Tool calling (`/api/chat`) | Full-deck baseline | Expected |
| --- | --- | --- | --- |
| Manual text edit survived (27 runs) | 100.0% | 100.0% | 100% |
| Manual layout survived (33 runs) | 100.0% | 0.0% | 100% |
| Non-target slides preserved | 100.0% | 97.2% | 100% |
| Target slide changed | 91.7% | 100.0% | 100% |
| Slide count changed | 0.0% | 0.0% | 0% |
| Prompt tokens / edit (mean) | 3,395 | 889 | – |
| Completion tokens / edit (mean) | 77 | 395 | – |
| Est. cost / edit (USD) | $0.0093 | $0.0062 | – |
| Latency p50 / p95 (ms) | 1,495 / 2,366 | 3,380 / 4,282 | – |
| Errors | 0 | 0 | 0 |

### Per case

| Case | Target | Tool: changed / preserved / text / layout | Baseline: changed / preserved / text / layout |
| --- | --- | --- | --- |
| number-concise-2 | slide 2 | 0/3 / 3/3 / n/a / 3/3 | 3/3 / 2/3 / n/a / 0/3 |
| number-retitle-3 | slide 3 | 3/3 / 3/3 / 3/3 / 3/3 | 3/3 / 3/3 / 3/3 / 0/3 |
| number-add-bullet-2 | slide 2 | 3/3 / 3/3 / n/a / 3/3 | 3/3 / 3/3 / n/a / 0/3 |
| number-rewrite-column-5 | slide 5 | 3/3 / 3/3 / 3/3 / 3/3 | 3/3 / 3/3 / 3/3 / 0/3 |
| number-subtitle-1 | slide 1 | 3/3 / 3/3 / 3/3 / 3/3 | 3/3 / 3/3 / 3/3 / 0/3 |
| number-table-row-6 | slide 6 | 3/3 / 3/3 / 3/3 / 3/3 | 3/3 / 3/3 / 3/3 / 0/3 |
| title-expand-paragraph | slide 3 | 3/3 / 3/3 / 3/3 / 3/3 | 3/3 / 3/3 / 3/3 / 0/3 |
| title-rename-table-slide | slide 6 | 3/3 / 3/3 / 3/3 / 3/3 | 3/3 / 3/3 / 3/3 / 0/3 |
| title-add-to-column | slide 4 | 3/3 / 3/3 / 3/3 / n/a | 3/3 / 3/3 / 3/3 / n/a |
| title-fix-subtitle | slide 1 | 3/3 / 3/3 / 3/3 / 3/3 | 3/3 / 3/3 / 3/3 / 0/3 |
| title-punchier-comparison | slide 5 | 3/3 / 3/3 / 3/3 / 3/3 | 3/3 / 3/3 / 3/3 / 0/3 |
| title-remove-bullet | slide 2 | 3/3 / 3/3 / n/a / 3/3 | 3/3 / 3/3 / n/a / 0/3 |

### Tool-calling runs that left the target unchanged

- **number-concise-2** (seed deck): no tool calls; reply: "Slide 2 is titled "What This Deck Demonstrates (MY MANUAL EDIT)" and contains the following bullet points: - A structured slide schema - Multiple slide layouts - Bullets, paragraphs, and tables as bod…"
- **number-concise-2** (seed deck): no tool calls; reply: "Slide 2 is titled "What This Deck Demonstrates (MY MANUAL EDIT)" and contains the following bullet points: - A structured slide schema - Multiple slide layouts - Bullets, paragraphs, and tables as bod…"
- **number-concise-2** (seed deck): no tool calls; reply: "Slide 2 is titled "What This Deck Demonstrates (MY MANUAL EDIT)" and contains the following bullet points: - A structured slide schema - Multiple slide layouts - Bullets, paragraphs, and tables as bod…"

## Large deck (20 slides)

| Metric | Tool calling (`/api/chat`) | Full-deck baseline | Expected |
| --- | --- | --- | --- |
| Manual text edit survived (27 runs) | 100.0% | 100.0% | 100% |
| Manual layout survived (33 runs) | 100.0% | 0.0% | 100% |
| Non-target slides preserved | 100.0% | 100.0% | 100% |
| Target slide changed | 97.2% | 100.0% | 100% |
| Slide count changed | 0.0% | 0.0% | 0% |
| Prompt tokens / edit (mean) | 3,992 | 1,773 | – |
| Completion tokens / edit (mean) | 79 | 1,278 | – |
| Est. cost / edit (USD) | $0.0108 | $0.0172 | – |
| Latency p50 / p95 (ms) | 1,635 / 2,789 | 9,837 / 11,581 | – |
| Errors | 0 | 0 | 0 |

### Per case

| Case | Target | Tool: changed / preserved / text / layout | Baseline: changed / preserved / text / layout |
| --- | --- | --- | --- |
| number-concise-2 | slide 2 | 2/3 / 3/3 / n/a / 3/3 | 3/3 / 3/3 / n/a / 0/3 |
| number-retitle-3 | slide 3 | 3/3 / 3/3 / 3/3 / 3/3 | 3/3 / 3/3 / 3/3 / 0/3 |
| number-add-bullet-2 | slide 2 | 3/3 / 3/3 / n/a / 3/3 | 3/3 / 3/3 / n/a / 0/3 |
| number-rewrite-column-5 | slide 5 | 3/3 / 3/3 / 3/3 / 3/3 | 3/3 / 3/3 / 3/3 / 0/3 |
| number-subtitle-1 | slide 1 | 3/3 / 3/3 / 3/3 / 3/3 | 3/3 / 3/3 / 3/3 / 0/3 |
| number-table-row-6 | slide 6 | 3/3 / 3/3 / 3/3 / 3/3 | 3/3 / 3/3 / 3/3 / 0/3 |
| title-expand-paragraph | slide 3 | 3/3 / 3/3 / 3/3 / 3/3 | 3/3 / 3/3 / 3/3 / 0/3 |
| title-rename-table-slide | slide 6 | 3/3 / 3/3 / 3/3 / 3/3 | 3/3 / 3/3 / 3/3 / 0/3 |
| title-add-to-column | slide 4 | 3/3 / 3/3 / 3/3 / n/a | 3/3 / 3/3 / 3/3 / n/a |
| title-fix-subtitle | slide 1 | 3/3 / 3/3 / 3/3 / 3/3 | 3/3 / 3/3 / 3/3 / 0/3 |
| title-punchier-comparison | slide 5 | 3/3 / 3/3 / 3/3 / 3/3 | 3/3 / 3/3 / 3/3 / 0/3 |
| title-remove-bullet | slide 2 | 3/3 / 3/3 / n/a / 3/3 | 3/3 / 3/3 / n/a / 0/3 |

### Tool-calling runs that left the target unchanged

- **number-concise-2** (large deck): no tool calls; reply: "Slide 2 is titled "What This Deck Demonstrates (MY MANUAL EDIT)" and contains the following bullet points: - A structured slide schema - Multiple slide layouts - Bullets, paragraphs, and tables as bod…"
