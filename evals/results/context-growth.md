# Context growth

A scripted 30-turn editing conversation on the seed deck (`evals/cases/context-conversation.json`), sent to `/api/chat` with the deck and chat history carried forward the way the chat panel does. Each row is one server configuration (`CHAT_MAX_HISTORY_MESSAGES`), labelled when it was run. Per-turn prompt tokens for plotting are in `context-growth.csv`. See `evals/README.md` for details.

- **date**: 2026-11-22
- **model**: gpt-4o, gpt-4o
- **runs**: capped-10 (2026-11-22), uncapped (2026-11-22)

| Run | Prompt tokens, turn 1 | Turn 10 | Turn 30 | Total prompt tokens (30 turns) | Est. cost / conversation | Turns with a tool call | Errors | Runs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| capped-10 | 3,253 | 3,533 | 3,548 | 105,425 | $0.278 | 50.0% | 0 | 1 |
| uncapped | 3,253 | 3,905 | 4,814 | 123,102 | $0.329 | 63.3% | 0 | 1 |

**capped-10** sends 14.4% fewer prompt tokens over the conversation than **uncapped**.
