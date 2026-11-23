# Deck generation

Prompts from `evals/cases/generation-prompts.json`, sent to the running app's streaming `/api/generate` endpoint. Times are measured from sending the request. See `evals/README.md` for metric definitions.

- **date**: 2026-11-22
- **model**: gpt-4o
- **prompts**: 20
- **runs per prompt**: 3
- **price per 1M tokens (input / output)**: $2.5 / $10

## Quality

| Metric | Value | Measured over |
| --- | --- | --- |
| Success rate | 100.0% | 20 prompts × 3 runs |
| Slide-count match | 77.1% | successful runs of the 16 prompts with a stated count |
| Decks with a chart | 93.3% | successful runs |
| Decks with a table | 11.7% | successful runs |
| Decks with an image | 95.0% | successful runs |
| Streamed slides match final deck | 100.0% | successful runs |
| Mean slides per deck | 7.1 | successful runs |

## Streaming

| Metric | p50 / p95 |
| --- | --- |
| Time to first slide | 893 / 1,252 ms |
| Time to full deck (`done`) | 3,099 / 4,414 ms |

## Tokens and cost

| Metric | Mean per deck |
| --- | --- |
| Prompt tokens | 925 |
| Completion tokens | 495 |
| Estimated cost (USD) | $0.0073 |

Image generation runs afterwards in the browser through a separate endpoint and is not included in the cost.

## Per prompt

| Prompt | Asked | Got (per run) | Chart / Table / Image | First slide / done p50 (ms) |
| --- | --- | --- | --- | --- |
| solar-energy-5 | 5 | 5, 5, 5 | 3/3 / 0/3 / 3/3 | 976 / 2,532 |
| remote-work-6 | 6 | 6, 6, 6 | 3/3 / 0/3 / 3/3 | 907 / 2,902 |
| q3-sales-review-7 | 7 | 7, 7, 7 | 3/3 / 0/3 / 3/3 | 837 / 3,095 |
| onboarding-4 | 4 | 5, 4, 4 | 1/3 / 0/3 / 3/3 | 783 / 2,338 |
| coffee-startup-pitch-8 | 8 | 8, 8, 8 | 3/3 / 0/3 / 3/3 | 915 / 4,485 |
| photosynthesis-5-words | 5 | 6, 7, 11 | 3/3 / 0/3 / 3/3 | 955 / 3,252 |
| cloud-comparison-6 | 6 | 6, 7, 6 | 3/3 / 0/3 / 2/3 | 859 / 2,772 |
| marathon-training-5 | 5 | 6, 6, 6 | 3/3 / 0/3 / 3/3 | 892 / 3,049 |
| cybersecurity-basics-10 | 10 | 10, 10, 10 | 3/3 / 0/3 / 2/3 | 912 / 3,873 |
| product-roadmap-6 | 6 | 6, 6, 6 | 3/3 / 0/3 / 3/3 | 1,083 / 3,398 |
| climate-policy-7 | 7 | 7, 7, 7 | 3/3 / 0/3 / 3/3 | 966 / 3,407 |
| team-retro-4 | 4 | 4, 4, 4 | 2/3 / 0/3 / 3/3 | 790 / 1,734 |
| ev-market-8 | 8 | 8, 8, 8 | 3/3 / 1/3 / 3/3 | 870 / 3,368 |
| nutrition-3 | 3 | 4, 3, 6 | 2/3 / 0/3 / 2/3 | 779 / 2,535 |
| ai-in-healthcare-12 | 12 | 12, 12, 12 | 3/3 / 1/3 / 3/3 | 788 / 3,738 |
| budget-proposal-6 | 6 | 6, 7, 6 | 3/3 / 3/3 / 3/3 | 824 / 2,980 |
| history-of-internet-open | – | 8, 8, 9 | 3/3 / 1/3 / 3/3 | 833 / 3,573 |
| customer-churn-open | – | 7, 8, 8 | 3/3 / 0/3 / 3/3 | 937 / 3,346 |
| space-tourism-open | – | 9, 9, 7 | 3/3 / 0/3 / 3/3 | 821 / 3,073 |
| kubernetes-intro-open | – | 9, 10, 9 | 3/3 / 1/3 / 3/3 | 926 / 4,005 |

## Failed runs (0)

None.
