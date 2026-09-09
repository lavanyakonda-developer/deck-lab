@AGENTS.md

# Deck Lab — Project Instructions

This file is the persistent source of truth for this project across sessions.
Read it fully before doing any work here. It captures: what we're building,
the requirement analysis, the phase roadmap, the workflow rules the user has
established, and the architecture decisions already locked in. Keep it
updated as phases complete or decisions change.

## What We're Building

The Sarvam AI Presentation Builder technical assignment: a web-based AI
presentation builder where a user can generate slides from a prompt, iterate
on them through conversation with an LLM, and edit them manually — with
manual and AI-driven edits coexisting without one destroying the other.

Full original assignment text: `problem_statement.txt` (repo root).
UI style reference (Sarvam's own "Indus" tool — chat pane + slide preview +
thumbnail rail): `ui-reference.png` (repo root).

- **Dev agent**: Claude Code (this tool).
- **Product LLM**: OpenAI (used inside the app for generation/refinement —
  not to be confused with Claude Code itself).
- **Timeline context**: assignment allows max 2 calendar days; we are
  building incrementally in reviewed phases instead, at the user's pace.

## Requirement Analysis

### Must Have

| #   | Requirement                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Chat interface — describe presentation or request changes, AI responds by generating/modifying slides                                        |
| M2  | Slide editor/preview panel rendering live deck state, with manual text editing                                                               |
| M3  | Manual slide ops: add (blank), delete, reorder, edit text                                                                                    |
| M4  | AI operates on real slide data, in real time, in the actual editor — no mocked integration                                                   |
| M5  | Structured JSON slide schema (slide type, title, body: bullets/paragraphs/tables, layout hints, speaker notes)                               |
| M6  | Agentic tool-use / function calling: `add_slide`, `update_slide`, `delete_slide`, `reorder_slides`, `change_layout` — model chooses the tool |
| M7  | Diff-based/targeted edits — no full-deck regeneration on refinement; manual edits must survive AI edits and vice versa                       |
| M8  | Two-phase generation — initial bulk structured generation vs. subsequent agentic targeted refinement                                         |
| M9  | Export — PDF/PPTX or, at minimum, clean print-to-PDF view (document the choice)                                                              |
| M10 | Streaming responses — slides appear incrementally, not spinner-then-dump                                                                     |
| M11 | Rich content — AI-generated images, charts, tables on slides                                                                                 |
| M12 | API key handling via env vars, never hardcoded/committed                                                                                     |
| M13 | Deployed, functional live URL                                                                                                                |
| M14 | Git repo with clean commit history + README (setup, architecture, known issues)                                                              |
| M15 | (Preferred, optional) AI chat transcripts exported alongside submission                                                                      |

### Nice to Have (only after all Must Haves work)

| #   | Requirement                                                      |
| --- | ---------------------------------------------------------------- |
| N1  | Slide themes/templates (visual style picker)                     |
| N2  | Unified undo/redo across AI + manual actions                     |
| N3  | Context window management (summarization/trimming as chat grows) |
| N4  | Multiple presentation projects (dashboard of saved decks)        |

### Explicitly Out of Scope

| #   | Item                     | Handling                                                                                                                               |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | Authentication           | None built. Single-user, no-auth. Never add "just in case."                                                                            |
| O2  | Backend persistence / DB | Not required. Use `localStorage`/IndexedDB. Any backend stays a thin stateless API proxy for the OpenAI key — not a persistence layer. |

## Locked-In Architecture Decisions

- **Framework**: Next.js 16 (App Router) + TypeScript, `npm` as package manager.
- **Styling**: Tailwind CSS v4.
- **State**: Zustand — single deck store (`store/deckStore.ts`) with pure
  reducer-style actions. Manual UI and AI tool calls both mutate the _same_
  store through the _same_ action set (`addSlide`, `updateSlide`,
  `deleteSlide`, `reorderSlides`, `changeLayout`) — this is what makes M7
  (manual + AI coexisting) actually true rather than asserted. Do not create
  a second/parallel mutation path for AI edits later — extend this store.
- **Schema/validation**: Zod (`lib/schema/slide.ts`) — one schema doubles as
  the TypeScript type source and (later) the JSON-schema fed to OpenAI's
  structured outputs / tool definitions.
- **LLM**: OpenAI SDK (`openai` npm package, v6), server-side only (Next.js
  Route Handlers under `app/api/`). `OPENAI_API_KEY` is read only in server
  code (`lib/ai/openaiClient.ts`, lazy singleton — never called at module
  load, so a missing key can't break `npm run build`), never shipped to the
  client bundle (verified: `grep` over `.next/static` for the key/client
  factory function finds nothing). Default model: `gpt-4o` via `OPENAI_MODEL`
  (see `.env.local.example`).
- **AI generation pipeline** (`lib/ai/`): `deckJsonSchema.ts` is a
  hand-written (not zod-derived) JSON Schema passed as OpenAI's
  `response_format: { type: "json_schema", json_schema: ... }` — hand-written
  because OpenAI's strict structured-output mode only supports a subset of
  JSON Schema (no `minItems`/`minLength`/etc.), so those content-quality
  minimums are enforced separately, after the fact, by
  `deckGenerationSchema.ts` (a zod schema mirroring `lib/schema/slide.ts` but
  with every optional field `.nullable()` instead of `.optional()`, since
  strict mode requires every property present and uses `null` for "not
  provided"). `normalizeGeneratedDeck.ts` converts that
  nulls-instead-of-optional shape into the canonical `Deck`/`Slide` type
  (assigning real ids — the model never generates ids) and the result is
  re-validated against the canonical `DeckSchema` before ever reaching the
  store. `generateDeck.ts` orchestrates the OpenAI call + both validation
  passes + normalization; `app/api/generate/route.ts` is the thin HTTP
  wrapper (400 on bad input; see Streaming below for how it now reports
  generation failures - no longer a 502, since the route streams). This is
  deliberately a one-shot Chat Completions call with no tool calls.
  **Not called directly by the client anymore** (see the `generate_deck`
  tool under Agentic refinement pipeline below) — the route stays as a
  standalone, independently-usable endpoint (e.g. a future "New Deck"
  button), and `generateDeckFromPrompt()` is the non-streaming function
  Phase 5's streaming sibling (`generateDeckStreamed`, see Streaming below)
  is built alongside, not on top of. Phase 4's `/api/chat` route calls
  `generateDeckStreamed()` internally when the model
  decides a wholesale new deck is needed. `lib/ai/jsonSchemaFragments.ts`
  holds the
  JSON-schema pieces (content block anyOf, layout hints, slide type enum)
  shared between `deckJsonSchema.ts` and Phase 4's tool parameter schemas;
  `lib/ai/normalize.ts` holds the null→undefined conversion shared between
  `normalizeGeneratedDeck.ts` and Phase 4's `applyToolCalls.ts` — don't
  duplicate either, extend the shared file.
- **Agentic refinement pipeline** (Phase 4, `app/api/chat/route.ts` +
  `lib/ai/tools.ts` + `lib/ai/deckContext.ts` + `lib/ai/applyToolCalls.ts`):
  since the OpenAI key must stay server-side but the Zustand deck store
  only exists client-side, tool _execution_ can't happen on the server —
  the route runs the OpenAI tool-calling turn and returns a list of
  validated `{tool, args}` calls; the client (`ChatPanel.tsx`) applies each
  one via `applyToolCalls.ts`, which calls the exact same `useDeckStore`
  actions manual editing uses (`addSlide`/`updateSlide`/`deleteSlide`/
  `reorderSlides`/`changeLayout`) — no separate mutation path, so a tool
  call is a targeted patch by construction. Each tool's parameters are a
  hand-written strict JSON Schema (same subset-of-JSON-Schema constraint as
  `deckJsonSchema.ts`); on `update_slide`/`change_layout`, every field is
  nullable and `null` means "leave unchanged" (not "clear it") — the
  system prompt spells this convention out explicitly, and
  `applyToolCalls.ts` only includes non-null fields in the store patch.
  `update_slide`/`change_layout` also call `selectSlide(id)` after
  applying, so the canvas follows a chat-driven edit onto whatever slide
  it targeted even if the user was looking at a different one — `add_slide`
  doesn't need this (the store's own `addSlide` already auto-selects the
  new slide), and `delete_slide`/`reorder_slides` have no single target to
  select.
  `lib/ai/deckContext.ts` compacts the current deck (every slide's real
  id + type + title + a short content summary, no speaker notes) into the
  system prompt so the model can reference exact slide ids without the
  full deck JSON eating the context budget. **Verified against the live
  OpenAI API**: "make slide 2 more concise" produced exactly one
  `update_slide` call on the correct id; "add a pricing slide after X"
  produced a correctly-indexed `add_slide` call.
  - **The reverse direction ("selection informs unqualified edits") also
    holds, but confirms before acting rather than applying directly**:
    `ChatPanel.tsx` sends `selectedSlideId` (the slide currently shown in
    the canvas) alongside `message`/`deck`/`history`; `serializeDeckContext`
    marks that slide's line with `(currently selected/viewed by the
user)`. When a request doesn't name a specific slide ("change the title
    to X", "make this more concise"), the system prompt tells the model to
    ask for confirmation in its text reply - naming the slide by number
    and title and restating the change (e.g. `Update slide 3 ("Pricing")
    - set the title to "1234"?`) - and only make the tool call once the
user's next message confirms, resolved via the existing chat-history
mechanism below (the same one that already handles "which slide?" →
"3rd slide"). If the user's reply names a different slide instead of
confirming, that's what gets applied. **This replaced an earlier
design that applied the change to the selected slide directly with no
confirmation step** - dropped at the user's request after the direct-
apply version misidentified which slide was selected in practice
(root cause not fully isolated; confirming first removes the failure
mode regardless of cause, at the cost of one extra turn). No slide
marked and none named → the model still just asks which slide.
`selectedSlideId` is optional server-side (defaults to no slide
      marked) so older/partial requests don't fail.
  - **Bug found + fixed: stale-title answers after a manual edit**. User
    report: manually renamed slide 12's title on the canvas, then asked
    the chat "what is title of this slide???" - it answered with the
    slide's _old_ title, from an assistant reply several turns earlier in
    the conversation, ignoring that the deck had since changed. Traced
    the full data path (`ChatPanel.tsx` reads `useDeckStore.getState()`
    fresh at send time → posts the live deck → `serializeDeckContext`
    rebuilds context from that exact payload every request) and found no
    staleness in the code - the deck sent per request is always current.
    The likely cause is a prompt gap: nothing told the model the "Current
    deck" block should win over its own earlier statements in chat
    history, and the model apparently favored its most recent assistant
    message (which literally names the old title) over re-reading the
    fresh context. Fixed by adding an explicit rule: the Current deck
    section is authoritative, may reflect manual edits the model was
    never told about via a message, and must be trusted over anything
    said earlier in the conversation, including the model's own prior
    replies. Not yet verified live (no API key in the session that made
    this fix) - re-test the exact repro (rename a slide manually, then
    ask a factual question about it) before considering this closed.
  - **Follow-up bug found in the same session, distinct root cause: a
    named slide _number_ resolving to the wrong id.** User pointed out
    (with console evidence) that the client was sending the fresh,
    correct selected-slide title, yet the chat kept insisting "slide 4"
    had titles like "adf"/"etuoo"/"ABCDEF" across consecutive turns, none
    of which matched the real slide 4 ("Adaptations", confirmed live in
    both the canvas and the console log). The user was naming the slide
    explicitly by number every time - this isn't the selection-confirm
    flow above, it's rule 4 (reference the exact id). Root cause: a
    slide's number is purely its array position, recalculated fresh
    every request by `serializeDeckContext` - it is not a stable id, and
    can point at a different slide turns later if the deck's slide order
    or count changed in between (adds/deletes earlier in the same
    conversation). The model was apparently reusing an id it associated
    with "slide 4" from an earlier turn instead of re-deriving it from
    the current numbered list every time - the same underlying failure
    pattern as the bug above (trusting conversational memory over fresh
    context), but for id-resolution rather than content. Fixed by adding
    an explicit rule stating slide numbers are recalculated every request
    and must never be resolved from an earlier turn's mapping. Also not
    yet verified live for the same reason - re-test with the exact repro
    (name a slide by number across several turns while the deck's slide
    count/order has changed earlier in the conversation).
  - **Bug found + fixed after initial ship**: the very first version only
    sent `[system, currentMessage]` to OpenAI on every `/api/chat` call —
    no prior turns — so any multi-turn exchange (model asks "which
    slide?", user replies "3rd slide") lost all context and the model
    just asked another generic clarifying question forever. Fixed by
    having `ChatPanel.tsx` send the chatStore message history (everything
    before the just-added current message) as `history` in the request
    body, and the route now builds `[system, ...history, currentMessage]`.
    Verified live: the exact "which slide? → 3rd slide" exchange now
    resolves correctly instead of looping. `history` is validated
    server-side (`HistoryMessageSchema.array()`) and defaults to `[]` if
    omitted, so it degrades gracefully rather than 400ing.
  - Also found+fixed while verifying the above: `change_layout` only sets
    `type`/`layout`, never `body` — so "change slide 3 to a table" alone
    produced a slide with `type: "table"` but the OLD bullets block still
    in `body`, which `TableSlide.tsx` can't render ("No table content
    yet."). The system prompt now explicitly tells the model that
    reshaping content (not just relabeling it) requires pairing
    `change_layout` with an `update_slide` call carrying a properly-shaped
    body in the same turn. Verified live: now correctly returns both
    tool calls together with a real table body derived from the bullets.
  - `console.log` at every stage (unconditional, not gated behind an env
    check — the user asked for this directly, not the earlier
    dev-only-gated version, since this is a single-environment project and
    they'll strip the logs themselves before a real commit): incoming
    request, exact messages array sent to OpenAI, raw model response,
    dropped/invalid tool calls, outgoing response, and each tool call as
    the client applies it, in both `route.ts` and `ChatPanel.tsx`. This is
    what surfaced every bug on this list — keep it (or something like it)
    when extending the chat flow.
  - **Bigger bug found + fixed after that**: the original design routed by
    a client-side `hasGeneratedOnce` flag — the very first message in a
    session always went to `/api/generate` (bulk generation) regardless of
    content, every message after went to `/api/chat` (targeted tools).
    Reported symptom: "delete slide 2" did nothing. Root cause: since the
    app always has _some_ deck loaded (the seed deck counts), a first
    message that isn't actually a generation request (like "delete slide
    2") still got sent to `/api/generate` as if it were a topic prompt —
    confirmed live: that exact string generated an unrelated "Renewable
    Energy" deck, silently replacing everything, with nothing deleted.
    **Fixed by unifying into one endpoint and one real decision-maker**:
    added a sixth tool, `generate_deck(prompt)`, alongside the five
    editing tools in `lib/ai/tools.ts` / `TOOL_DEFINITIONS` — now _every_
    message, from the first one on, goes to `/api/chat`, and the model
    itself decides whether to call `generate_deck` (wholesale new deck) or
    one/more targeted tools, using real judgment instead of a client-side
    guess. When the model calls `generate_deck`, the route itself invokes
    the existing `generateDeckFromPrompt()` (Phase 3's pipeline, reused
    as-is, zero duplication) and returns `{ reply, toolCalls: [],
generatedDeck }`; `ChatPanel.tsx` calls `loadDeck()` on that instead of
    applying tool calls. `chatStore.ts`'s `hasGeneratedOnce`/
    `markGenerated` were removed entirely (no longer meaningful).
    `applyToolCalls.ts` has a defensive (should-be-unreachable)
    `generate_deck` case that warns and no-ops, since the server should
    always intercept it first. Verified live both ways: "delete slide 2"
    (as literally the first message) now correctly calls `delete_slide`;
    "Create a 4-slide deck about X" still correctly calls `generate_deck`
    and replaces the deck. This also resolves the "no UI path to trigger
    regeneration after the first prompt" limitation from the initial
    Phase 4 report — the model can now call `generate_deck` at any point.
- **Chat UI**: `store/chatStore.ts` (message list, persisted; `isGenerating`
  flag deliberately excluded via `partialize` so a mid-request refresh
  never restores a stuck loading state; `addMessage` returns the new
  message's id, and `appendToMessage`/`setMessageContent` support building
  a message up progressively as it streams) and
  `components/chat/ChatPanel.tsx` (textarea + submit, always posts to
  `/api/chat` with the current deck + prior history, then reads the SSE
  response - see Streaming below - reacting to whichever events arrive
  rather than anything decided client-side in advance).
- **Streaming** (Phase 5, M10): both `/api/generate` and `/api/chat` return
  `text/event-stream` (SSE) responses instead of one JSON blob, so slides
  and text appear incrementally rather than spinner-then-dump.
  - `lib/ai/sse.ts` (server: `formatSSE(event, data)`) / `lib/ai/sseClient.ts`
    (client: `parseSSEStream(response)`, an async generator yielding
    `{event, data}` as each `"event: X\ndata: Y\n\n"` block completes,
    correctly reassembling one split across arbitrary chunk/byte
    boundaries - not naive line-splitting).
  - `lib/ai/streamParser.ts`: the core of streaming structured-output
    parsing. `IncrementalJsonObjectExtractor` is a small, deliberately
    narrow string-aware JSON scanner - it only tracks `{`/`}` depth
    (string- and escape-aware) and ignores `[`/`]` entirely, which is
    sufficient (not a general JSON tokenizer) because every element we
    feed it starts with `{` and any nested `[`/`]` is always balanced
    within a `{ }` already being tracked. `DeckSlideStreamParser` wraps it
    with a regex search for `"slides":[` to know when to start extracting.
    Used twice: (1) `generateDeckStream.ts`'s `generateDeckStreamed()`
    feeds it the raw `response_format: json_schema` content stream to
    emit each slide the moment it closes; (2) `app/api/chat/route.ts`
    feeds one instance per streamed tool-call index (`delta.tool_calls[i]`)
    to detect when that tool call's `arguments` JSON is complete.
  - `generateDeckStream.ts`'s `generateDeckStreamed(prompt, onSlide)` is
    the streaming sibling of Phase 3's `generateDeckFromPrompt` (kept,
    unchanged, for any non-streaming caller) - shares its system prompt
    (`DECK_GENERATION_SYSTEM_PROMPT`, exported from `generateDeck.ts`) and
    the same final zod validation as a safety net against a
    truncated/corrupted stream. Critically, the `Deck` it resolves with
    reuses the _exact same_ `Slide` objects (same ids) already handed to
    `onSlide` - never a second, differently-id'd set - so a client
    applying slides live and then reconciling on the final event never
    sees duplicates or a mismatch.
  - `app/api/generate/route.ts` and `app/api/chat/route.ts` both build a
    `ReadableStream` and return `new Response(stream, {headers: {
"Content-Type": "text/event-stream", ... }})`. Request-validation
    failures (bad JSON, empty message/prompt, invalid deck) still return
    a plain `NextResponse.json(..., {status:400})` _before_ the stream
    starts. Once the stream starts, **the HTTP status is fixed at 200
    even on failure** - a mid-stream (or immediate) failure can only be
    signaled via an `event: error` SSE frame, never a different status
    code. Any client reading these streams must check event type, not
    `response.ok`/status, to detect failure - `ChatPanel.tsx` does this
    correctly (throws on an `error` event, caught by the same try/catch
    that already handles network/400 failures).
  - `/api/chat`'s event vocabulary: `text-delta` (`{text}` fragment, for
    plain assistant replies/clarifying questions), `tool-call` (one
    validated `ValidatedToolCall`, emitted the moment that tool call's
    arguments finish streaming - not batched at the end, so multiple
    tool calls in one turn, e.g. `change_layout` + `update_slide`, apply
    progressively as each completes), `slide` (one `Slide`, only when
    `generate_deck` fired), `done` (`{reply}` or `{reply, generatedDeck}`),
    `error` (`{error}`). `/api/generate`'s vocabulary is just `slide` /
    `done: {deck}` / `error`.
  - `ChatPanel.tsx` client handling: on the first `text-delta` it creates
    an empty assistant message (`addMessage("assistant", "")`) and
    `appendToMessage`s each fragment into it - a real progressive typing
    effect. On the first `slide` event it replaces the deck with an empty
    `{title: "Generating…", slides: []}` shell via the existing `loadDeck`
    action, then `addSlide`s each streamed slide (already carrying its
    real id) as it arrives; on `done` with a `generatedDeck`, a final
    `loadDeck(generatedDeck)` reconciles the title and guarantees exact
    final consistency. `tool-call` events `applyToolCall` immediately, one
    at a time, as they arrive. A local `showThinking` boolean (not the
    shared `isGenerating`, which still gates input for the whole request)
    shows a "Thinking…" bubble only until the _first_ substantive event
    arrives, then gets out of the way of the real incremental content.
  - **Verified live against the real OpenAI API**, not just mocked, for
    all four paths: `/api/generate` streamed 5 `slide` events with a
    matching final `done`; a targeted refinement streamed exactly one
    `tool-call` the moment its arguments completed; an ambiguous request
    streamed 49 real `text-delta` fragments; `generate_deck` fired through
    the unified `/api/chat` endpoint streamed 5 `slide` events + `done`.
- **Rich content** (Phase 6, M11): `chart` and `image` are **content block
  types** (like `bullets`/`paragraph`/`table`), not new `SlideType` values -
  this follows the Phase 1 design note above, not `phases.txt`'s literal
  (looser, earlier-written) file list naming `ChartSlide.tsx`/
  `ImageSlide.tsx`. Both extend `lib/schema/slide.ts`'s
  `ContentBlockSchema`, the shared JSON-schema fragments
  (`jsonSchemaFragments.ts`), the AI generation validation schema
  (`deckGenerationSchema.ts`), and `normalize.ts` (extended to convert a
  chart/image block's nullable `caption`, and to stamp `url: null` onto an
  image block since the model never provides one). Rendering/editing lives
  in `EditableContentBlock.tsx`'s existing switch, alongside
  bullets/paragraph/table: `chart` renders via Recharts (bar/line/pie
  chosen by `chartType`, `Cell` used for pie-slice colors — deprecated in
  Recharts 3.x in favor of a `shape` prop but still functional through
  3.x, not migrated since it's a cosmetic IDE hint, not a real issue);
  `image` renders the real `<img>` when `url` is set, else an animated-
  pulse placeholder showing the alt text (this same placeholder is also
  the permanent "generation failed" fallback - there's no separate error
  state).
  - **Scope decision**: manual editing is plain text only (title/subtitle,
    bullets, paragraphs). table/chart/image are deliberately **read-only**
    in `EditableContentBlock.tsx` - no `InlineEditable` on table
    headers/cells or on chart/image captions (captions still _display_
    when the AI sets one, just aren't click-to-edit), and there is no
    manual "add row"/similar control for any of the three. Changing any of
    these three block types goes through chat, not manual click - don't
    add InlineEditable back onto them without an explicit ask to reopen
    this scope.
  - **Bulk generation always includes rich content by default**:
    `DECK_GENERATION_SYSTEM_PROMPT` (`generateDeck.ts`) requires a specific
    structure for every deck it generates - title slide first, a dedicated
    closing/summary slide last, and _exactly one_ chart slide + _exactly
    one_ image slide somewhere in between (never as the closing slide,
    never last). The first version of this instruction just said "use a
    chart/image when it fits" and the model reliably skipped the chart
    and/or tacked the image on as the last slide with no closing slide at
    all - verified live across multiple prompts before landing on the
    stronger, structural wording above (also verified live, consistently
    correct across multiple different topics after the change). This only
    applies to bulk generation (`generateDeckFromPrompt`/
    `generateDeckStreamed`) - the separate chat-refinement system prompt
    in `app/api/chat/route.ts` intentionally stays request-driven (add a
    chart/image only when asked), not defaulted.
  - **Charts render with `isAnimationActive={false}`** on `Pie`/`Line`/
    `Bar` - no entry animation (bars growing, lines drawing in, pie
    sweeping), just an immediate static render. Explicit ask, not a
    default Recharts behavior to leave alone.
  - **Images are generated asynchronously, after the fact, client-side** -
    not by the model itself. The model only ever supplies `alt` text (no
    `url` field exists in its tool/generation schema at all); `lib/ai/
generateImage.ts`'s `generateImageForSlide()` POSTs that alt text to
    `app/api/generate-image/route.ts`, and on success patches the
    resulting `url` into the _matching_ block (found by `slideId` + `alt`
    - `url === null`, not a fixed array index, since the slide may have
      been edited elsewhere while generation was in flight). This keeps
      Phase 5's fast slide/tool-call streaming un-blocked by slow (several-
      second) image calls - a slide or edit lands immediately with a
      placeholder, the image fills in later. `ChatPanel.tsx` calls
      `triggerPendingImageGeneration()` after every SSE event in the loop,
      scanning the _whole current deck_ for any block with `url === null`
      not already triggered this turn (a `Set` de-dupes across the many
      events in one response) and firing generation for each,
      fire-and-forget (`void ...`, never awaited).
  - **`/api/generate-image/route.ts`** (plain JSON request/response, not
    streamed - phases.txt's tech-work list doesn't call for that, and a
    single image isn't meaningfully incremental): calls
    `client.images.generate()`. **Real API behavior differed from the
    installed SDK's type hints, discovered only via live testing**: the
    account this project uses has no `dall-e-3` access at all ("model
    does not exist"), so the model is `gpt-image-1`; `quality: "standard"`
    (a dall-e-3-only value) is invalid for it (must be
    `low`/`medium`/`high`/`auto` - using `medium`); and `response_format`
    is entirely unrecognized as a parameter for GPT image models (they
    always return `b64_json`, never a `url`, so the field doesn't need
    requesting). This turned out to conveniently match the original
    design intent anyway - a permanent `data:` URI, not a URL that expires
    after OpenAI's ~60 minutes (which would break a deck already sitting
    in localStorage). Uses `output_format: "jpeg"` +
    `output_compression: 70` to keep the base64 payload manageable against
    localStorage's quota - confirmed live this cuts payload size roughly
    13x (a lossless 1024×1024 PNG ran ~1.6MB; jpeg70 ran ~165KB). **If
    testing against a different OpenAI account/project, re-verify which
    image model is actually available** before assuming this config is
    portable - don't trust the SDK's TypeScript types alone here, they
    documented options this account's API rejected.
- **Layout**: fixed desktop/MacBook layout, not responsive — the user
  explicitly deprioritized cross-device support. `app/page.tsx` is always
  `flex-row` (no `md:` breakpoints): a fixed `w-[380px]` chat sidebar
  (`ChatPanel.tsx`) + a `flex-1 min-w-0` deck area. The `min-w-0` on every
  level of that right-hand flex chain (`main`, `SlideCanvas.tsx`,
  `ThumbnailRail.tsx`) is load-bearing, not decorative — without it, flex
  items default to `min-width: auto` and refuse to shrink below their
  content's intrinsic width, so `ThumbnailRail`'s `overflow-x-auto` silently
  stops scrolling and instead widens the whole layout once enough
  thumbnails are added. Keep `min-w-0` on any new element added to that
  chain.
- **Testing**: Vitest (`vitest.config.mts`, `environment: "jsdom"`) for
  schema/store unit tests. `npm run test`.
- **Drag/reorder**: `@dnd-kit/core` + `@dnd-kit/sortable` — in use since
  Phase 2 (`components/deck/SlideThumbnail.tsx` + `ThumbnailRail.tsx`).
- **Manual text editing**: `components/deck/InlineEditable.tsx` — a
  contentEditable div rendered once via `dangerouslySetInnerHTML` (HTML-
  escaped) for SSR/first-paint, then updated imperatively via a ref on later
  value changes so React never re-diffs contentEditable children. Every
  field (title/subtitle/bullets/paragraphs/table cells) commits through the
  store's `updateSlide` on blur/Enter; Escape reverts. Used by
  `EditableContentBlock.tsx` (replaced the old read-only
  `ContentBlockRenderer.tsx`, which was deleted).
- **Persistence**: `localStorage` via Zustand `persist` middleware — both
  the deck (`store/deckStore.ts`, key `deck-lab:deck`) and chat history
  (`store/chatStore.ts`, key `deck-lab:chat`). Both use `skipHydration:
true` so SSR/first paint always match their in-code defaults;
  `components/StoreHydrator.tsx` calls `persist.rehydrate()` for both once
  on mount. Any new persisted store should follow the same
  skipHydration + StoreHydrator pattern. No backend DB (per O2).
- **Charts** (Phase 6): Recharts.
- **Images** (Phase 6): OpenAI image generation via a server route, with a
  graceful placeholder fallback.
- **Export** (Phase 7): both PDF and PPTX are one-click, direct-download
  exports - no print dialog. `lib/export/pptx.ts` (`pptxgenjs`) and
  `lib/export/pdf.ts` (`jsPDF` + `jspdf-autotable`) each independently
  rebuild every slide as a 16:9 page from the deck data (not a DOM
  screenshot), including redrawing bar/line/pie charts as native
  vector shapes - `pdf.ts` uses jsPDF's own `context2d` API for this
  (emits real PDF drawing operators, no `<canvas>`/DOM dependency, so
  it's unit-testable in Node) rather than an actual browser canvas.
  Superseded an earlier `window.print()` → "Save as PDF" baseline,
  replaced at the user's request for a true one-click download matching
  the PPTX button's UX.
  - **Bug found + fixed**: `context2d.font`'s `"Npx"` parsing multiplies
    the number by the document's unit scale factor (72, since the PDF is
    built in inches) instead of converting real pixels to points - an
    "8px" chart label silently became a ~576pt font, bleeding across the
    page. Fixed by drawing all chart text via jsPDF's core `doc.text()`
    (real point sizes, unaffected by document unit) and using
    `context2d` only for vector shapes (arcs/rects/lines) - confirmed by
    inspecting the raw PDF's `Tf` (font-size) operators directly.
- **Undo/redo** (Phase 8): `store/historyMiddleware.ts` is a small, pure,
  framework-agnostic undo/redo stack (`pushHistory`/`undoHistory`/
  `redoHistory` over a plain `{undoStack, redoStack}` shape) - not a real
  Zustand middleware, since `set()` has no per-call metadata to hook a
  generic wrapper into. Every content-mutating `deckStore.ts` action
  (`addSlide`, `updateSlide`, `deleteSlide`, `reorderSlides`,
  `changeLayout`, `loadDeck`) pushes the pre-mutation `{deck,
selectedSlideId}` snapshot onto `history` as part of its own `set()`
  call, before applying its change - this is what makes undo/redo cover
  manual edits and AI tool calls identically with no separate mutation
  path, the same reason M7 holds: both sources already go through these
  exact actions. `selectSlide` deliberately does NOT push history - it's
  navigation, not a content change, so switching slides never creates an
  undo step. `history` is excluded from `persist`'s `partialize` (session
  -only; a reload starts with an empty stack - resuming a stale undo
  stack across sessions isn't expected UX, and it would otherwise persist
  every past snapshot's full deck into localStorage indefinitely). UI:
  `components/toolbar/UndoRedo.tsx` (buttons in the header, disabled at
  the ends of history) plus a Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z window
  keydown listener that explicitly skips when the event target is an
  editable field (`InlineEditable`'s contentEditable divs, inputs,
  textareas) so the browser's native per-field undo isn't hijacked while
  typing.
- **Deployment**: Vercel.

### Current Slide Schema Shape (`lib/schema/slide.ts`)

- `SlideType`: `"title" | "content" | "two-column" | "comparison" | "table"`
  — this list is exactly the set of slide-layout components that exist
  (`components/deck/slides/*`). Don't add a new `SlideType` value without
  also building its renderer component and adding it to `SlideRenderer.tsx`.
- `ContentBlock` (a slide's `body: ContentBlock[]`): discriminated union of
  `bullets | paragraph | table`, each with an optional `column?: 0 | 1` for
  two-column/comparison layouts. `image` and `chart` block kinds are planned
  additions for Phase 6 — extend the union then, don't pre-add unused
  variants now.
- `LayoutHints`: `align`, `columns`, `columnTitles`, `density` — all optional.
- `Slide`: `id`, `type`, `title`, `subtitle?`, `body` (defaults to `[]`),
  `layout?`, `speakerNotes` (defaults to `""`).
- `Deck`: `id`, `title`, `slides: Slide[]`.
- Store actions are intentionally named to match the AI tool names Phase 4
  will define 1:1 (`add_slide` → `addSlide`, etc.) so tool-call handlers can
  call store actions directly with no translation layer.

## Phase Roadmap & Status

Full detail for every phase (objective, requirements, technical work, files,
manual testing checklist, automated verification, DoD) lives in
`phases.txt` — treat that as the authoritative per-phase spec. This table is
the status tracker.

| Phase | Name                                                              | Status                                                                                                                        |
| ----- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 0     | Project Scaffolding & Shell UI                                    | ✅ Done — committed `chore: scaffold Next.js app with two-pane shell UI`, pushed to `origin/main`                             |
| 1     | Slide Schema & Deck State Model                                   | ✅ Done — committed `feat: add slide schema and deck state model`, pushed to `origin/main`                                    |
| 2     | Manual Editing (Complete, AI-Free Product)                        | ✅ Done — 6 commits (creation/deletion/reordering/text-editing/SSR fix/persistence), reviewed and manually tested by the user |
| 3     | AI Initial Generation (two-phase gen, phase 1)                    | ✅ Done — committed, not yet pushed; verified end-to-end against the live OpenAI API                                          |
| 4     | Agentic Tool-Use & Diff-Based Refinement (two-phase gen, phase 2) | ✅ Done — committed, not yet pushed; verified end-to-end against the live OpenAI API                                          |
| 5     | Streaming                                                         | ✅ Done — committed, not yet pushed; verified end-to-end against the live OpenAI API                                          |
| 6     | Rich Content: Images, Charts, Tables                              | ✅ Done — uncommitted (user commits themselves); verified end-to-end against the live OpenAI API                              |
| 7     | Export                                                            | ✅ Done — committed by the user; direct-download PDF + PPTX, no print dialog                                                  |
| 8     | Unified Undo/Redo (Nice to Have)                                  | ✅ Done — uncommitted; unit tested, not yet manually verified live                                                            |
| 9     | Themes / Templates (Nice to Have)                                 | Not started                                                                                                                   |
| 10    | Context Window Management (Nice to Have)                          | Not started                                                                                                                   |
| 11    | Multiple Presentation Projects (Nice to Have)                     | Not started                                                                                                                   |
| 12    | Deployment, README, and Final Polish                              | Not started                                                                                                                   |

Must-Haves = Phases 0–7 (fallback submission point if time runs out).
Nice-to-Haves = Phases 8–11 (additive, droppable individually).
Phase 12 (deploy + README) should happen regardless of how far the
Nice-to-Haves get.

## Workflow Rules (apply to every phase, no exceptions)

The user has stated this workflow repeatedly and expects it followed exactly
for every remaining phase without being re-asked:

1. **Before writing any code for a phase**, briefly restate:
   - Phase objective
   - Requirements being implemented (by ID, from the tables above)
   - Definition of Done
2. **Then implement the phase completely.**
3. Constraints while implementing:
   - Follow the locked-in architecture above — don't deviate without asking.
   - Do not implement features belonging to later phases, even if related or
     easy to add while you're in the area.
   - Do not create temporary/mock architecture that will need to be replaced
     later (e.g. no throwaway UI buttons "just for testing" — if a real
     control is needed to exercise a feature, decide whether it actually
     belongs in this phase or should wait).
   - Keep the implementation compatible with subsequent phases — check this
     table and `phases.txt` for what's coming so you don't paint into a
     corner, but don't build ahead of schedule either.
   - Run typecheck, lint, tests, and a production build. Fix any issues you
     encounter within the current phase's scope before reporting done.
4. **When the phase is complete: STOP.** Do not start the next phase. Wait
   for the user's explicit approval before proceeding, every time — approval
   of one phase is not approval to auto-continue to the next.
5. Report back in exactly this format:
   1. What was implemented
   2. Files changed
   3. Requirements covered
   4. Tests/checks performed
   5. Exact manual test steps
   6. Expected results
   7. Known issues
   8. Definition-of-Done status

## Git Conventions

- Commit message prefixes (user-specified):
  - `feat:` — new functionality
  - `fix:` — bug fix
  - `refactor:` — code restructuring without behavior change
  - `test:` — tests
  - `docs:` — README/documentation
  - `chore:` — tooling/config/dependencies
  - `style:` — formatting/UI-only changes
- Examples the user gave: `feat: add slide data model`,
  `feat: render slides in preview panel`, `feat: add manual slide creation`,
  `feat: add slide deletion`, `feat: add slide reordering`,
  `feat: add manual text editing`.
- **Do not commit at the end of a phase.** As of Phase 2's completion, the
  user commits locally themselves — leave changes staged/unstaged when a
  phase is done. Do not run `git commit` unless the user explicitly asks for
  it in that turn. (Phases 0–2 were committed by the assistant, following the
  convention below; that practice stopped after Phase 2.)
- When the user does ask for a commit, use the prefixes below and end the
  message with the standard attribution footer (Co-Authored-By /
  Claude-Session lines).
- **Never push without an explicit, separate request**, regardless of who
  made the commit. Remote `origin` is already set to
  `https://github.com/lavanyakonda-developer/deck-lab.git`.
- Prefer new commits over amending, except when the user explicitly asks to
  fix up the most recent commit message/content (as happened once for the
  Phase 0 commit, to apply the conventional-commit prefix retroactively).

## Environment / Secrets

- `.env.local.example` documents `OPENAI_API_KEY` and `OPENAI_MODEL=gpt-4o`.
  Real values go in `.env.local`, which is gitignored (`.gitignore` has
  `.env*` with an explicit `!.env.local.example` negation — keep that
  pattern if `.gitignore` is touched again).
- OpenAI key must only ever be read server-side (Route Handlers). Never pass
  it to client components, never log it, never put it in a URL/query string.

## Useful Commands

```bash
npm run dev           # start dev server
npm run build          # production build (includes typecheck)
npm run lint            # ESLint
npm run format           # Prettier write
npm run format:check      # Prettier check
npm run test               # Vitest unit tests, run once
npm run test:watch          # Vitest watch mode
```
