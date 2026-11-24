# Deck generation

Prompts from `evals/cases/generation-prompts.json`, sent to the running app's streaming `/api/generate` endpoint. Times are measured from sending the request. See `evals/README.md` for metric definitions.

- **date**: 2026-11-24
- **run**: run-4
- **model**: gpt-4o
- **prompts**: 20
- **runs per prompt**: 3
- **price per 1M tokens (input / output)**: $2.5 / $10

## Quality

| Metric | Value | Expected | Measured over |
| --- | --- | --- | --- |
| Success rate | 96.7% | 100% | 20 prompts × 3 runs |
| Slide-count match | 89.1% | 100% | successful runs of the 16 prompts with a stated count |
| Required structure met | 93.1% | 100% | successful runs |
| Decks with a chart | 98.3% | 100% (required) | successful runs |
| Decks with an image | 98.3% | 100% (required) | successful runs |
| Decks with a table | 6.9% | – (optional) | successful runs |
| Streamed slides match final deck | 100.0% | 100% | successful runs |
| Mean slides per deck | 6.4 | – | successful runs |

## Streaming

| Metric | p50 / p95 |
| --- | --- |
| Time to first slide | 1,130 / 1,581 ms |
| Time to full deck (`done`) | 3,684 / 5,732 ms |

## Tokens and cost

| Metric | Mean per deck |
| --- | --- |
| Prompt tokens | 1,157 |
| Completion tokens | 448 |
| Estimated cost (USD) | $0.0074 |

Image generation runs afterwards in the browser through a separate endpoint and is not included in the cost.

## Per prompt

| Prompt | Asked | Got (per run) | Chart / Table / Image | First slide / done p50 (ms) |
| --- | --- | --- | --- | --- |
| solar-energy-5 | 5 | 5, 5, 5 | 3/3 / 0/3 / 3/3 | 1,554 / 3,090 |
| remote-work-6 | 6 | 6, 6, 6 | 3/3 / 0/3 / 3/3 | 1,048 / 3,522 |
| q3-sales-review-7 | 7 | 7, 7, 7 | 3/3 / 1/3 / 3/3 | 1,230 / 3,988 |
| onboarding-4 | 4 | 4, 4, 4 | 3/3 / 0/3 / 3/3 | 1,207 / 3,687 |
| coffee-startup-pitch-8 | 8 | 8, 8, 8 | 3/3 / 0/3 / 3/3 | 1,131 / 3,794 |
| photosynthesis-5-words | 5 | 6, 6, 5 | 3/3 / 0/3 / 3/3 | 1,189 / 3,245 |
| cloud-comparison-6 | 6 | 6, 6, ✗ | 2/3 / 0/3 / 2/3 | 1,129 / 3,379 |
| marathon-training-5 | 5 | 5, 6, 6 | 3/3 / 0/3 / 3/3 | 1,133 / 3,886 |
| cybersecurity-basics-10 | 10 | 10, 10, 10 | 3/3 / 0/3 / 3/3 | 1,160 / 4,915 |
| product-roadmap-6 | 6 | 6, 6, 6 | 3/3 / 0/3 / 3/3 | 1,052 / 3,291 |
| climate-policy-7 | 7 | ✗, 7, 7 | 2/3 / 0/3 / 2/3 | 1,338 / 4,095 |
| team-retro-4 | 4 | 4, 4, 4 | 2/3 / 0/3 / 3/3 | 1,180 / 2,378 |
| ev-market-8 | 8 | 8, 8, 8 | 3/3 / 0/3 / 3/3 | 1,128 / 4,284 |
| nutrition-3 | 3 | 3, 2, 3 | 3/3 / 0/3 / 2/3 | 1,024 / 1,940 |
| ai-in-healthcare-12 | 12 | 12, 12, 12 | 3/3 / 0/3 / 3/3 | 1,127 / 5,533 |
| budget-proposal-6 | 6 | 6, 6, 6 | 3/3 / 3/3 / 3/3 | 1,341 / 3,581 |
| history-of-internet-open | – | 6, 4, 4 | 3/3 / 0/3 / 3/3 | 1,023 / 2,744 |
| customer-churn-open | – | 6, 6, 6 | 3/3 / 0/3 / 3/3 | 1,225 / 3,172 |
| space-tourism-open | – | 4, 11, 7 | 3/3 / 0/3 / 3/3 | 1,125 / 3,584 |
| kubernetes-intro-open | – | 7, 10, 6 | 3/3 / 0/3 / 3/3 | 1,027 / 3,996 |

## Runs that missed an expectation (10)

- **photosynthesis-5-words**: 6 slides (asked for 5)
- **photosynthesis-5-words**: 6 slides (asked for 5)
- **cloud-comparison-6**: OpenAI response failed schema validation: [
  {
    "origin": "array",
    "code": "too_big",
    "maximum": 2,
    "inclusive": true,
    "path": [
      "slides",
      2,
      "layout",
      "columnTitles"
    ],
    "message": "Too big: expected array to have <=2 items"
  }
]
- **marathon-training-5**: 6 slides (asked for 5)
- **marathon-training-5**: 6 slides (asked for 5)
- **climate-policy-7**: OpenAI returned a response that was not valid JSON
- **team-retro-4**: 0 chart blocks (expected 1)
- **nutrition-3**: 2 slides (asked for 3); 2 slides (a 3-slide deck is title, chart, image); 0 image blocks (expected 1)
- **budget-proposal-6**: 2 chart blocks (expected 1)
- **kubernetes-intro-open**: 2 image blocks (expected 1)
