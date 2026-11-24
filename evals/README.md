# Evals

Scripts that measure the AI features of the running app over HTTP. They
call the real OpenAI API through the app, so they cost money and results
vary run to run — which is why they are **not** part of `npm test` and every
case runs several times (`--runs`, default 3) with metrics averaged.

## Running

1. Put `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) in `.env.local` or
   `.env`, as for the app itself. The eval scripts load the same files (same
   precedence as Next.js), so the model recorded in each summary matches the
   one the app uses.
2. Start the app: `npm run dev`, or `npm run build && npm start`.
3. In a second terminal, run an eval (below).

Shared flags:

| Flag         | Default                 | Meaning                                                                                          |
| ------------ | ----------------------- | ------------------------------------------------------------------------------------------------ |
| `--run-id`   | required                | Names the run; results go to `evals/results/runs/<run-id>/`                                      |
| `--runs`     | `3`                     | Times each case runs; metrics are means                                                          |
| `--base-url` | `http://localhost:3000` | Where the app is running                                                                         |
| `--filter`   | –                       | Only cases whose id or category contains this; comma-separate several terms to match any of them |
| `--label`    | –                       | Names a server configuration (required by the context eval)                                      |

Pass flags after `--`, e.g. `npm run eval:edit -- --run-id run-2 --runs 5`.

Each eval writes:

- `evals/results/runs/<run-id>/<eval>.md` — the summary (committed). A run
  only ever writes into its own folder, so runs can be compared side by side.
- `evals/results/raw/<run-id>/<eval>-<timestamp>.json` — every run's full
  data, including replies and tool calls (gitignored).

Rates are measured over every run of every case. With 3 runs per case the
edit eval's overall rates carry roughly ±4–5 points of noise at 95%
(shown as Wilson intervals in its summary), and per-category or per-case
numbers much more, so small differences between runs are not meaningful.

## Edit accuracy — `npm run eval:edit`

Sends the requests in `cases/edit-cases.json` to `/api/chat` against the
seed deck, applies the streamed `tool-call` events through the app's own
deck store (the same `applyToolCall` path the chat panel uses), and scores
the result. A case expects either specific tool calls, or a clarifying
question for ambiguous requests. Cases may set a selected slide, as the
editor does:

- `named-and-selected`: the request names the slide that is also selected.
- `named-with-selection`: selected-slide variants of named edits (update by
  number, update by title, delete, change_layout, add). Each edit appears
  twice: once with a different slide selected than the one named, once
  with the named slide selected.

In both, a slide named in the request must be acted on directly, with no
confirmation question.

| Metric                          | Meaning                                                                                                                                                                                                                                                                                                        | Expected            |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Tool accuracy                   | The set of tools called is exactly the expected set (plus any the case lists as `optional`, e.g. an `update_slide` alongside `change_layout`).                                                                                                                                                                 | 100%                |
| Target accuracy                 | Every expected call hit the right target: the right slide id for update/delete/change_layout, the right final position for an added slide, the right final order for a reorder, and any required content (e.g. "has a table") present.                                                                         | 100%                |
| Preservation rate               | Of runs that changed the deck, the share where every slide the request didn't target is deep-equal to before.                                                                                                                                                                                                  | 100%                |
| Answered in text (no tool call) | A tool call was expected, but none arrived and none was rejected: the model replied in text only (a description of the edit, a confirmation question, …).                                                                                                                                                      | 0%                  |
| Invalid tool call               | The model called a tool but the server rejected the arguments. The app reports these as `invalid-tool-call` events (tool + validation error) instead of applying them.                                                                                                                                         | 0%                  |
| Clarification accuracy          | For ambiguous cases: no tool call was made and the reply contains a question.                                                                                                                                                                                                                                  | 100%                |
| Clarification accuracy (strict) | For ambiguous cases, no tool call, and: with a slide selected, the reply names that slide's number ("slide 3") and title, as the system prompt's confirmation asks; with no slide selected, an LLM judge decides the reply asks which slide the user means rather than guessing one (see below).               | 100%                |
| Invented selection              | Over replies to every case sent with no selected slide: the reply says or implies a slide is selected ("currently selected", "shown as selected", "the selected slide", "you're viewing slide N"). A rule check in `evals/lib/inventedSelection.ts`, not the judge; matched phrases are listed in the summary. | 0%                  |
| Overall pass rate               | Every check for the case passed in that run.                                                                                                                                                                                                                                                                   | 100%                |
| Cases passing all runs          | Cases that passed in every one of their runs — the stricter, per-case view of the pass rate.                                                                                                                                                                                                                   | all cases           |
| Latency to done (p50 / p95)     | Request start until the `done` event, successful runs only.                                                                                                                                                                                                                                                    | – (tracked, no bar) |
| Errors                          | Runs that ended in an `error` event or HTTP failure.                                                                                                                                                                                                                                                           | 0                   |

Overall rates are shown with a 95% Wilson interval. The summary also has a
per-category breakdown and lists every case that failed in any run, with
the calls (including rejected ones) and reply that came back, plus every
clarify run that failed the strict check, with the reason. The strict check
is reported next to the original one and doesn't change any case's
pass/fail.

**The clarify judge.** For ambiguous requests with no slide selected, the
reply is graded by `JUDGE_MODEL` from `evals/pricing.ts` (gpt-4o-mini) at
temperature 0, with the rubric in `evals/lib/judge.ts`: pass if the reply
asks which slide the user means (listing candidates is fine), or - when the
request could apply to the whole deck, like "make it better" - if it asks
what the user wants changed without picking a slide; fail if it picks or
assumes one slide, even to confirm it. The saved run-2b summary was graded
with the first version of the rubric, which only accepted asking which
slide. The judge's verdict and reason are saved in the raw results. Its
tokens and estimated cost are reported on their own line and never added
to the app's figures. A judge error counts as a strict failure and is
listed with its reason.

## Tool calling vs. full-deck baseline — `npm run eval:baseline`

Uses the single-slide `update_slide` cases from `cases/edit-cases.json`
(those with no chat history or selected slide, so both approaches get
exactly the same input). Before each case, the deck is edited by hand
through the same store actions the canvas uses:

- **Text**: `MY MANUAL EDIT` is appended to slide 2's title. It is appended,
  not replaced, so no text a case's message refers to disappears — a unit
  test fails if a case ever refers to text the manual edit removes.
- **Layout**: slide 4's title is moved, resized and restyled (italic, red).

The request is then run two ways:

- **Tool calling**: `/api/chat` on the running app; its `tool-call` events
  are applied through the deck store.
- **Full-deck baseline**: a direct OpenAI call (same model, read from
  the same env files) with the whole deck as JSON and "return the full updated
  deck", using the app's own `deckJsonSchema` structured output. The deck is
  sent in exactly the shape the schema returns, so echoing unchanged slides
  verbatim is always possible.

Everything runs on two decks, each reported in its own table: the 6-slide
seed deck, and a 20-slide deck made of the seed slides followed by the 14
fixed slides in `cases/large-deck-extra-slides.json`. The seed slides keep
their ids and positions, so every case means the same thing on both decks.
Token cost scales differently for the two approaches (tool calling carries a
fixed system prompt and tool schemas; the baseline returns the whole deck),
so the comparison depends on deck size.

Text is compared by slide position and visible content (title, subtitle,
column titles, body), ignoring ids and element positions. Layout is compared
by the elements' roles, frames and styles. Errored runs count as failures in
every rate and are excluded from token, cost and latency figures.

| Metric                      | Meaning                                                                                                                                                                                                      | Expected (tool calling / baseline) |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| Manual text edit survived   | Slide 2 still contains `MY MANUAL EDIT`. Only counted for cases that target a slide other than slide 2.                                                                                                      | 100% / 100%                        |
| Manual layout survived      | Slide 4's elements have the same frames and styles as after the manual edit. Only counted for cases that target a slide other than slide 4. The baseline rebuilds every layout, so it is 0% by construction. | 100% / 0%                          |
| Non-target slides preserved | Same slide count, and every slide except the target shows the same content.                                                                                                                                  | 100% / 100%                        |
| Target slide changed        | The requested slide actually changed (a check that the edit happened at all).                                                                                                                                | 100% / 100%                        |
| Slide count changed         | Slides were added or dropped by a request that only edits one slide.                                                                                                                                         | 0% / 0%                            |
| Prompt / completion tokens  | Mean per edit. Tool calling reports the app's own usage from the `done` event; the baseline reports its call's usage.                                                                                        | – (compared, no bar)               |
| Est. cost / edit            | Prompt + completion tokens priced with `evals/pricing.ts`.                                                                                                                                                   | – (compared, no bar)               |
| Latency p50 / p95           | Request start until the edit is complete (`done` event, or the baseline's response).                                                                                                                         | – (compared, no bar)               |
| Errors                      | Runs that ended in an error.                                                                                                                                                                                 | 0 / 0                              |

The summary also lists every tool-calling run that left the target
unchanged, with its calls and reply.

## Deck generation — `npm run eval:generation`

Sends each prompt in `cases/generation-prompts.json` to the app's streaming
`/api/generate` endpoint and scores the final deck from the `done` event.
Most prompts state a slide count (`expectedSlides`); a few leave it open.

The generation prompt (`lib/ai/generateDeck.ts`) requires a structure for
every deck: a title slide first, exactly one chart block and exactly one
image block on two different slides, neither on the first or last slide,
and a closing slide last — so at least 4 slides. This applies to every
deck with no requested count or a requested count of 4 or more.

A requested count under 4 drops parts in a fixed order (closing slide,
then image, then chart), and the check expects exactly that many slides in
this order: 3 = title, chart, image; 2 = title, chart; 1 = title. Summaries
from runs before run-4 used the full structure for every deck, so a
3-slide request always failed it there.

| Metric                           | Meaning                                                                                                   | Expected        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------- |
| Success rate                     | The stream ended with a `done` event carrying a non-empty deck (no `error` event, no HTTP error).         | 100%            |
| Slide-count match                | The deck has exactly the requested number of slides. Only prompts that state a count.                     | 100%            |
| Required structure met           | The deck follows the structure above. The summary names every broken rule per run.                        | 100%            |
| Decks with a chart / an image    | Share of successful decks containing at least one block of that type. Both are required by the structure. | 100%            |
| Decks with a table               | Share of successful decks containing a table. Optional; reported for information.                         | – (optional)    |
| Streamed slides match final deck | The `slide` events are exactly the final deck's slides, same ids and order (what the client relies on).   | 100%            |
| Mean slides per deck             | Over successful runs.                                                                                     | – (information) |
| Time to first slide / full deck  | p50 / p95 from sending the request to the first `slide` event and to the `done` event.                    | – (tracked)     |
| Tokens / estimated cost          | Mean per deck, from the usage in the `done` event, priced with `evals/pricing.ts`.                        | – (tracked)     |

The summary lists every run that missed an expectation (error, wrong slide
count, or broken structure). The raw results keep each deck's slide
content for review.

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
event's usage, and each turn's reply and tool calls are saved.

The cap is a server setting, so the two configurations need a restart in
between. Use the same `--run-id` for both:

```bash
# 1. Capped (the default, 10 messages)
npm run dev
npm run eval:context -- --run-id run-2 --label capped-10

# 2. Uncapped - stop the server, then
CHAT_MAX_HISTORY_MESSAGES=0 npm run dev
npm run eval:context -- --run-id run-2 --label uncapped
```

Each label runs the whole conversation 3 times by default (`--runs`).
`--label` is required and is how configurations are told apart. If
`CHAT_MAX_HISTORY_MESSAGES` is set in an env file, the value on the
command line overrides it. After each label, the run's outputs are rebuilt
from the latest result of every label in that run:

- `context-growth.csv`: turn, then one mean prompt-token column per label,
  for plotting.
- `context-growth.md`: one row per label, then every turn without a tool
  call, with its message and reply.

The script's later messages refer to slide numbers that assume earlier
turns worked, so one missed edit can make later turns miss too.

| Column                   | Meaning                                                                                                                                | Expected                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Prompt tokens, turn N    | Mean prompt tokens of that turn across runs. Includes the system prompt and deck context, which change a little as the deck is edited. | flat after turn ~6 when capped |
| Total prompt tokens      | Sum of the per-turn means over the conversation.                                                                                       | lower when capped              |
| Est. cost / conversation | Prompt + completion tokens priced with `evals/pricing.ts`.                                                                             | – (compared)                   |
| Turns with a tool call   | Share of turns that made at least one tool call. Every scripted message asks for an edit.                                              | 100%                           |
| Errors                   | Turns that ended in an `error` event or HTTP error; their tokens are left out of the means.                                            | 0                              |
