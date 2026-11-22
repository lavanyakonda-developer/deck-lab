# Evals

Scripts that measure the AI features of the running app over HTTP. They
call the real OpenAI API through the app, so they cost money and results
vary run to run — which is why they are **not** part of `npm test` and every
case runs several times (`--runs`, default 3) with metrics averaged.

## Running

1. Put `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) in `.env.local`, as
   for the app itself. The eval scripts load the same file, so the model
   recorded in each summary matches the one the app uses.
2. Start the app: `npm run dev`, or `npm run build && npm start`.
3. In a second terminal, run an eval (below).

Shared flags:

| Flag         | Default                 | Meaning                                       |
| ------------ | ----------------------- | --------------------------------------------- |
| `--runs`     | `3`                     | Times each case runs; metrics are means       |
| `--base-url` | `http://localhost:3000` | Where the app is running                      |
| `--filter`   | –                       | Only cases whose id or category contains this |
| `--label`    | –                       | Free-form label stored with the results       |

Pass flags after `--`, e.g. `npm run eval:edit -- --runs 5`.

Each run writes:

- `evals/results/<eval>.md` — the summary table (committed)
- `evals/results/raw/<eval>-<timestamp>.json` — every run's full data
  (gitignored)

## Edit accuracy — `npm run eval:edit`

Sends the requests in `cases/edit-cases.json` to `/api/chat` against the
seed deck, applies the streamed `tool-call` events through the app's own
deck store (the same `applyToolCall` path the chat panel uses), and scores
the result. A case expects either specific tool calls, or a clarifying
question for ambiguous requests.

| Metric                   | Meaning                                                                                                                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool accuracy            | The set of tools called is exactly the expected set (plus any the case lists as `optional`, e.g. an `update_slide` alongside `change_layout`).                                                                                         |
| Target accuracy          | Every expected call hit the right target: the right slide id for update/delete/change_layout, the right final position for an added slide, the right final order for a reorder, and any required content (e.g. "has a table") present. |
| Preservation rate        | Of runs that changed the deck, the share where every slide the request didn't target is deep-equal to before.                                                                                                                          |
| Missed/invalid call rate | A tool call was expected but no `tool-call` event arrived — the model answered in text, or its call failed validation (the route drops invalid calls silently).                                                                        |
| Clarification accuracy   | For ambiguous cases: no tool call was made and the reply contains a question.                                                                                                                                                          |
| Overall pass rate        | Every check for the case passed in that run.                                                                                                                                                                                           |

The summary also has a per-category breakdown and lists every case that
failed in any run, with the calls and reply that came back.

## Tool calling vs. full-deck baseline — `npm run eval:baseline`

Uses the single-slide `update_slide` cases from `cases/edit-cases.json`
(those with no chat history or selected slide, so both approaches get
exactly the same input). Before each case, slide 2's title is changed to
`MY MANUAL EDIT` through the deck store's `updateElement` — the same action
a manual canvas edit uses. The request is then run two ways:

- **Tool calling**: `/api/chat` on the running app; its `tool-call` events
  are applied through the deck store.
- **Full-deck baseline**: a direct OpenAI call (same model, read from
  `.env.local`) with the whole deck as JSON and "return the full updated
  deck", using the app's own `deckJsonSchema` structured output. The deck is
  sent in exactly the shape the schema returns, so echoing unchanged slides
  verbatim is always possible.

Both results are compared with the manually edited deck by slide position
and visible content (title, subtitle, column titles, body), ignoring ids and
element positions, which the baseline can't preserve by construction.

| Metric                      | Meaning                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Manual-edit survival        | Slide 2 still contains `MY MANUAL EDIT`. Only counted for cases that target a slide other than slide 2.               |
| Non-target slides preserved | Same slide count, and every slide except the target is unchanged.                                                     |
| Target slide changed        | The requested slide actually changed (a sanity check that the edit happened at all).                                  |
| Slide count changed         | Slides were added or dropped by a request that only edits one slide.                                                  |
| Prompt / completion tokens  | Mean per edit. Tool calling reports the app's own usage from the `done` event; the baseline reports its call's usage. |
| Latency p50 / p95           | Request start until the edit is complete (`done` event, or the baseline's response).                                  |

Errored runs count as failures in every rate and are excluded from token and
latency figures.

## Deck generation — `npm run eval:generation`

Sends each prompt in `cases/generation-prompts.json` to the app's streaming
`/api/generate` endpoint and scores the final deck from the `done` event.
Most prompts state a slide count (`expectedSlides`); a few leave it open.

| Metric                           | Meaning                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Success rate                     | The stream ended with a `done` event carrying a non-empty deck (no `error` event, no HTTP error).       |
| Slide-count match                | The deck has exactly the requested number of slides. Only prompts that state a count.                   |
| Decks with a chart/table/image   | Share of successful decks containing at least one block of that type.                                   |
| Streamed slides match final deck | The `slide` events are exactly the final deck's slides, same ids and order (what the client relies on). |
| Time to first slide / full deck  | p50 / p95 from sending the request to the first `slide` event and to the `done` event.                  |
| Tokens / estimated cost          | Mean per deck, from the usage in the `done` event, priced with `evals/pricing.ts`.                      |

Prices live in `evals/pricing.ts` (USD per 1M tokens). Edit them if
OpenAI's prices change or you use a model that isn't listed — the summary
shows `n/a` for an unpriced model. Cached-input discounts are ignored, and
image generation (a separate call the browser makes afterwards) is not
included.

## Context growth — `npm run eval:context`

Plays the 30-turn editing conversation in `cases/context-conversation.json`
against `/api/chat`. Like the chat panel, each turn sends the current deck
(with earlier edits applied through the deck store), the selected slide
and the full chat history so far; the server trims that history to its cap
before calling OpenAI. Each turn's prompt tokens come from the `done`
event's usage.

The cap is a server setting, so the two runs need a restart in between:

```bash
# 1. Capped (the default, 10 messages)
npm run dev
npm run eval:context -- --label capped-10

# 2. Uncapped - stop the server, then
CHAT_MAX_HISTORY_MESSAGES=0 npm run dev
npm run eval:context -- --label uncapped
```

`--label` is required and is how runs are told apart. If
`CHAT_MAX_HISTORY_MESSAGES` is set in `.env.local`, the value on the
command line overrides it. After each run, the outputs are rebuilt from
the latest run of every label:

- `evals/results/context-growth.csv`: turn, then one mean prompt-token
  column per label, for plotting.
- `evals/results/context-growth.md`: one row per label.

| Column                   | Meaning                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Prompt tokens, turn N    | Mean prompt tokens of that turn across runs. Includes the system prompt and deck context, which change a little as the deck is edited.                       |
| Total prompt tokens      | Sum of the per-turn means over the conversation.                                                                                                             |
| Est. cost / conversation | Prompt + completion tokens priced with `evals/pricing.ts`.                                                                                                   |
| Turns with a tool call   | Share of turns that made at least one tool call. Every scripted message asks for an edit, so a drop here means the model answered in text instead of acting. |
| Errors                   | Turns that ended in an `error` event or HTTP error; their tokens are left out of the means.                                                                  |
