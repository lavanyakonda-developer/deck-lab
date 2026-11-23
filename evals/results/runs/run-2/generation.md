# Deck generation

Prompts from `evals/cases/generation-prompts.json`, sent to the running app's streaming `/api/generate` endpoint. Times are measured from sending the request. See `evals/README.md` for metric definitions.

- **date**: 2026-11-23
- **run**: run-2
- **model**: gpt-4o
- **prompts**: 20
- **runs per prompt**: 3
- **price per 1M tokens (input / output)**: $2.5 / $10

## Quality

| Metric | Value | Expected | Measured over |
| --- | --- | --- | --- |
| Success rate | 100.0% | 100% | 20 prompts × 3 runs |
| Slide-count match | 72.9% | 100% | successful runs of the 16 prompts with a stated count |
| Required structure met | 91.7% | 100% | successful runs |
| Decks with a chart | 96.7% | 100% (required) | successful runs |
| Decks with an image | 98.3% | 100% (required) | successful runs |
| Decks with a table | 13.3% | – (optional) | successful runs |
| Streamed slides match final deck | 100.0% | 100% | successful runs |
| Mean slides per deck | 7.1 | – | successful runs |

## Streaming

| Metric | p50 / p95 |
| --- | --- |
| Time to first slide | 1,186 / 1,466 ms |
| Time to full deck (`done`) | 4,860 / 6,873 ms |

## Tokens and cost

| Metric | Mean per deck |
| --- | --- |
| Prompt tokens | 925 |
| Completion tokens | 513 |
| Estimated cost (USD) | $0.0074 |

Image generation runs afterwards in the browser through a separate endpoint and is not included in the cost.

## Per prompt

| Prompt | Asked | Got (per run) | Chart / Table / Image | First slide / done p50 (ms) |
| --- | --- | --- | --- | --- |
| solar-energy-5 | 5 | 5, 5, 5 | 3/3 / 0/3 / 3/3 | 1,215 / 4,031 |
| remote-work-6 | 6 | 6, 6, 6 | 3/3 / 0/3 / 3/3 | 1,078 / 4,986 |
| q3-sales-review-7 | 7 | 7, 7, 7 | 3/3 / 1/3 / 3/3 | 1,233 / 4,807 |
| onboarding-4 | 4 | 5, 6, 5 | 3/3 / 0/3 / 3/3 | 1,087 / 4,550 |
| coffee-startup-pitch-8 | 8 | 8, 8, 8 | 3/3 / 0/3 / 3/3 | 1,033 / 5,968 |
| photosynthesis-5-words | 5 | 6, 7, 6 | 3/3 / 0/3 / 3/3 | 1,244 / 5,027 |
| cloud-comparison-6 | 6 | 6, 6, 6 | 3/3 / 0/3 / 3/3 | 1,330 / 4,300 |
| marathon-training-5 | 5 | 7, 6, 5 | 3/3 / 0/3 / 3/3 | 1,224 / 4,406 |
| cybersecurity-basics-10 | 10 | 10, 10, 10 | 3/3 / 1/3 / 3/3 | 1,175 / 5,695 |
| product-roadmap-6 | 6 | 6, 7, 6 | 3/3 / 0/3 / 3/3 | 1,177 / 3,730 |
| climate-policy-7 | 7 | 7, 7, 7 | 3/3 / 0/3 / 3/3 | 1,189 / 5,764 |
| team-retro-4 | 4 | 5, 4, 4 | 2/3 / 0/3 / 3/3 | 976 / 2,780 |
| ev-market-8 | 8 | 8, 8, 8 | 3/3 / 2/3 / 3/3 | 1,182 / 5,520 |
| nutrition-3 | 3 | 5, 5, 4 | 2/3 / 0/3 / 2/3 | 1,232 / 2,950 |
| ai-in-healthcare-12 | 12 | 12, 12, 12 | 3/3 / 1/3 / 3/3 | 1,227 / 6,814 |
| budget-proposal-6 | 6 | 6, 6, 6 | 3/3 / 3/3 / 3/3 | 1,462 / 5,876 |
| history-of-internet-open | – | 7, 9, 9 | 3/3 / 0/3 / 3/3 | 1,148 / 6,576 |
| customer-churn-open | – | 8, 7, 7 | 3/3 / 0/3 / 3/3 | 1,119 / 6,018 |
| space-tourism-open | – | 8, 9, 8 | 3/3 / 0/3 / 3/3 | 1,023 / 4,677 |
| kubernetes-intro-open | – | 8, 9, 11 | 3/3 / 0/3 / 3/3 | 1,057 / 5,478 |

## Runs that missed an expectation (16)

- **remote-work-6**: 2 chart blocks (expected 1)
- **onboarding-4**: 5 slides (asked for 4)
- **onboarding-4**: 6 slides (asked for 4)
- **onboarding-4**: 5 slides (asked for 4)
- **photosynthesis-5-words**: 6 slides (asked for 5)
- **photosynthesis-5-words**: 7 slides (asked for 5)
- **photosynthesis-5-words**: 6 slides (asked for 5)
- **cloud-comparison-6**: 2 chart blocks (expected 1)
- **marathon-training-5**: 7 slides (asked for 5)
- **marathon-training-5**: 6 slides (asked for 5)
- **product-roadmap-6**: 7 slides (asked for 6)
- **team-retro-4**: 5 slides (asked for 4); 0 chart blocks (expected 1)
- **team-retro-4**: chart on the last slide
- **nutrition-3**: 5 slides (asked for 3)
- **nutrition-3**: 5 slides (asked for 3)
- **nutrition-3**: 4 slides (asked for 3); 0 chart blocks (expected 1); 0 image blocks (expected 1)
