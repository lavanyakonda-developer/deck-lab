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
