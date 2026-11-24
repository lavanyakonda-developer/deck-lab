# Deck generation

Prompts from `evals/cases/generation-prompts.json`, sent to the running app's streaming `/api/generate` endpoint. Times are measured from sending the request. See `evals/README.md` for metric definitions.

- **date**: 2026-11-23
- **run**: run-3
- **model**: gpt-4o
- **prompts**: 20
- **runs per prompt**: 3
- **price per 1M tokens (input / output)**: $2.5 / $10

## Quality

| Metric | Value | Expected | Measured over |
| --- | --- | --- | --- |
| Success rate | 100.0% | 100% | 20 prompts × 3 runs |
| Slide-count match | 95.8% | 100% | successful runs of the 16 prompts with a stated count |
| Required structure met | 65.0% | 100% | successful runs |
| Decks with a chart | 91.7% | 100% (required) | successful runs |
| Decks with an image | 91.7% | 100% (required) | successful runs |
| Decks with a table | 15.0% | – (optional) | successful runs |
| Streamed slides match final deck | 100.0% | 100% | successful runs |
| Mean slides per deck | 6.9 | – | successful runs |

## Streaming

| Metric | p50 / p95 |
| --- | --- |
| Time to first slide | 1,272 / 1,957 ms |
| Time to full deck (`done`) | 4,915 / 8,706 ms |

## Tokens and cost

| Metric | Mean per deck |
| --- | --- |
| Prompt tokens | 1,159 |
| Completion tokens | 461 |
| Estimated cost (USD) | $0.0075 |

Image generation runs afterwards in the browser through a separate endpoint and is not included in the cost.

## Per prompt

| Prompt | Asked | Got (per run) | Chart / Table / Image | First slide / done p50 (ms) |
| --- | --- | --- | --- | --- |
| solar-energy-5 | 5 | 5, 5, 5 | 3/3 / 0/3 / 3/3 | 1,397 / 4,790 |
| remote-work-6 | 6 | 6, 6, 6 | 3/3 / 0/3 / 3/3 | 1,285 / 4,252 |
| q3-sales-review-7 | 7 | 7, 7, 7 | 3/3 / 2/3 / 2/3 | 1,249 / 4,832 |
| onboarding-4 | 4 | 4, 4, 4 | 2/3 / 0/3 / 3/3 | 1,133 / 3,430 |
| coffee-startup-pitch-8 | 8 | 8, 8, 8 | 3/3 / 0/3 / 3/3 | 1,184 / 5,748 |
| photosynthesis-5-words | 5 | 6, 6, 5 | 3/3 / 0/3 / 3/3 | 1,281 / 5,417 |
| cloud-comparison-6 | 6 | 6, 6, 6 | 3/3 / 0/3 / 3/3 | 1,932 / 5,654 |
| marathon-training-5 | 5 | 5, 5, 5 | 3/3 / 0/3 / 3/3 | 1,262 / 4,723 |
| cybersecurity-basics-10 | 10 | 10, 10, 10 | 1/3 / 1/3 / 2/3 | 1,404 / 6,276 |
| product-roadmap-6 | 6 | 6, 6, 6 | 3/3 / 0/3 / 3/3 | 1,289 / 3,784 |
| climate-policy-7 | 7 | 7, 7, 7 | 3/3 / 0/3 / 3/3 | 1,231 / 4,836 |
| team-retro-4 | 4 | 4, 4, 4 | 2/3 / 0/3 / 3/3 | 1,333 / 3,177 |
| ev-market-8 | 8 | 8, 8, 8 | 3/3 / 2/3 / 2/3 | 1,251 / 5,205 |
| nutrition-3 | 3 | 3, 3, 3 | 3/3 / 0/3 / 3/3 | 1,087 / 2,727 |
| ai-in-healthcare-12 | 12 | 12, 12, 12 | 2/3 / 1/3 / 2/3 | 1,606 / 8,060 |
| budget-proposal-6 | 6 | 6, 6, 6 | 3/3 / 3/3 / 2/3 | 1,253 / 4,718 |
| history-of-internet-open | – | 6, 10, 8 | 3/3 / 0/3 / 3/3 | 1,364 / 6,862 |
| customer-churn-open | – | 8, 9, 6 | 3/3 / 0/3 / 3/3 | 1,429 / 6,967 |
| space-tourism-open | – | 10, 10, 6 | 3/3 / 0/3 / 3/3 | 1,126 / 6,941 |
| kubernetes-intro-open | – | 8, 12, 12 | 3/3 / 0/3 / 3/3 | 1,217 / 7,153 |

## Runs that missed an expectation (23)

- **remote-work-6**: 2 chart blocks (expected 1)
- **q3-sales-review-7**: 0 image blocks (expected 1)
- **onboarding-4**: 0 chart blocks (expected 1)
- **onboarding-4**: image on the last slide
- **photosynthesis-5-words**: 6 slides (asked for 5)
- **photosynthesis-5-words**: 6 slides (asked for 5)
- **photosynthesis-5-words**: image on the last slide
- **cloud-comparison-6**: image on the last slide
- **cloud-comparison-6**: image on the last slide
- **marathon-training-5**: image on the last slide
- **marathon-training-5**: image on the last slide
- **cybersecurity-basics-10**: 0 chart blocks (expected 1)
- **cybersecurity-basics-10**: 0 chart blocks (expected 1); 0 image blocks (expected 1)
- **product-roadmap-6**: image on the last slide
- **climate-policy-7**: image on the last slide
- **team-retro-4**: 0 chart blocks (expected 1)
- **ev-market-8**: 0 image blocks (expected 1)
- **nutrition-3**: image on the last slide; 3 slides (the structure needs 4)
- **nutrition-3**: image on the last slide; 3 slides (the structure needs 4)
- **nutrition-3**: image on the last slide; 3 slides (the structure needs 4)
- **ai-in-healthcare-12**: 0 chart blocks (expected 1); 0 image blocks (expected 1)
- **budget-proposal-6**: image on the last slide
- **budget-proposal-6**: 0 image blocks (expected 1)
