# Edit accuracy

Targeted edit requests against the seed deck, sent to the running app's `/api/chat` and applied through the real deck store. See `evals/README.md` for metric definitions.

- **date**: 2026-11-24
- **run**: run-5
- **model**: gpt-4o
- **cases**: 61
- **runs per case**: 3

## Overall

| Metric | Value (95% CI) | Expected | Measured over |
| --- | --- | --- | --- |
| Tool accuracy | 100.0% (97.7–100.0%) | 100% | 55 tool cases × 3 runs |
| Target accuracy | 100.0% (97.7–100.0%) | 100% | 55 tool cases × 3 runs |
| Preservation rate | 100.0% (97.7–100.0%) | 100% | runs that changed the deck |
| Answered in text (no tool call) | 0.0% (0.0–2.3%) | 0% | 55 tool cases × 3 runs |
| Invalid tool call | 0.0% (0.0–2.3%) | 0% | 55 tool cases × 3 runs |
| Clarification accuracy | 100.0% (82.4–100.0%) | 100% | 6 ambiguous cases × 3 runs |
| Clarification accuracy (strict) | 100.0% (82.4–100.0%) | 100% | 6 ambiguous cases × 3 runs |
| Invented selection | 0.0% (0.0–3.0%) | 0% | 123 runs of cases with no slide selected |
| Overall pass rate | 100.0% (97.9–100.0%) | 100% | 61 cases × 3 runs |
| Cases passing all runs | 61 / 61 | 61 / 61 | 61 cases |
| Latency to done (p50 / p95) | 1,305 / 2,083 ms | – | successful runs |
| Errors | 0 | 0 | error events or HTTP failures |

## By category

| Category | Cases | Tool acc. | Target acc. | Preserved | In text | Invalid | Clarify acc. | Clarify (strict) | Pass |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| update-by-number | 6 | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | – | – | 100.0% |
| update-by-title | 6 | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | – | – | 100.0% |
| add | 5 | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | – | – | 100.0% |
| delete | 4 | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | – | – | 100.0% |
| reorder | 4 | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | – | – | 100.0% |
| change-layout | 4 | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | – | – | 100.0% |
| bullets-to-table | 3 | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | – | – | 100.0% |
| multi-step | 5 | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | – | – | 100.0% |
| follow-up | 3 | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | – | – | 100.0% |
| selection-override | 2 | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | – | – | 100.0% |
| named-and-selected | 3 | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | – | – | 100.0% |
| named-with-selection | 10 | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | – | – | 100.0% |
| ambiguous-no-selection | 3 | – | – | – | – | – | 100.0% | 100.0% | 100.0% |
| ambiguous-with-selection | 3 | – | – | – | – | – | 100.0% | 100.0% | 100.0% |

## Failed cases (0)

None.

## Clarify runs failing the strict check (0)

None.

Judge (gpt-4o-mini, temperature 0): 9 calls, 2,529 prompt + 185 completion tokens, est. $0.0005, 0 errors. Not included in any app token figure.

## Replies claiming a selected slide when none was selected (0)

None.
