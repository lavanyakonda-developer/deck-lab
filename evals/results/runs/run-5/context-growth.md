# Context growth

A scripted 30-turn editing conversation on the seed deck (`evals/cases/context-conversation.json`), sent to `/api/chat` with the deck and chat history carried forward the way the chat panel does. Each row is one server configuration (`CHAT_MAX_HISTORY_MESSAGES`), labelled when it was run. Per-turn prompt tokens for plotting are in `context-growth.csv`. See `evals/README.md` for details.

- **date**: 2026-11-24
- **run**: run-5
- **model**: gpt-4o
- **runs**: capped-10 (2026-11-24)

| Run | Prompt tokens, turn 1 | Turn 10 | Turn 30 | Total prompt tokens (30 turns) | Est. cost / conversation | Turns with a tool call | Errors | Runs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| capped-10 | 3,296 | 3,538 | 3,548 | 105,387 | $0.284 | 90.0% | 0 | 3 |

## Turns without a tool call

Every scripted message asks for an edit, so each of these is a miss. Later messages refer to slide numbers that assume earlier turns worked, so one miss can cause the next.

### capped-10 (9 of 90 turns)

- run 1, turn 8: "Change the subtitle of slide 5 to "Why targeted edits win"" → "It seems that slide 5 does not currently have a subtitle. Would you like me to add this subtitle to slide 5?"
- run 1, turn 9: "Add a row to the table on slide 6 for charts" → "I'll add a row to the table on slide 6 for charts. Please provide the details you'd like to include in this row."
- run 1, turn 28: "Add one more bullet to slide 2" → "What bullet point would you like to add to slide 2?"
- run 1, turn 29: "Change the title of the last slide to "Thanks!"" → "I couldn't make this change - could you try rephrasing your request?"
- run 2, turn 8: "Change the subtitle of slide 5 to "Why targeted edits win"" → "It seems that slide 5 does not currently have a subtitle. Would you like me to add this subtitle to slide 5?"
- run 2, turn 9: "Add a row to the table on slide 6 for charts" → "Please provide the details for the new row you would like to add to the table on slide 6. Specifically, what would you like to include in the "Type" and "Purpose" columns for charts?"
- run 2, turn 28: "Add one more bullet to slide 2" → "Could you please specify the content of the bullet you'd like to add to slide 2?"
- run 3, turn 8: "Change the subtitle of slide 5 to "Why targeted edits win"" → "Slide 5 does not currently have a subtitle. Would you like me to add "Why targeted edits win" as a new subtitle for this slide?"
- run 3, turn 28: "Add one more bullet to slide 2" → "Could you please specify the content of the bullet you'd like to add to slide 2?"
