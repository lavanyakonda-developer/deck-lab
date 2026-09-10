# Deck Lab

An AI-powered presentation builder describe a deck in chat, watch it get
built slide by slide, refine it conversationally, edit text by hand, and
export to PDF or PPTX. Built for the Sarvam AI technical assignment.

#### Deployed on - https://deck-lab-vert.vercel.app/

#### claude transcript - https://github.com/lavanyakonda-developer/deck-lab/blob/main/AI%20Session%20Transcript%201.pdf

## Setup

**Prerequisites:** Node.js 20+, npm, an [OpenAI API key](https://platform.openai.com/api-keys).

```bash
npm install
```

create `.env` and fill in:

```bash
OPENAI_API_KEY=sk-...        # required
OPENAI_MODEL=gpt-4o          # optional, this is the default
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app loads with a
seed example deck already in place.

### Scripts

| Command       | What it does         |
| ------------- | -------------------- |
| `npm run dev` | Start the dev server |

## Known issues / incomplete features

- **Only text is directly editable on a slide**: titles, subtitles, bullet
  items, and paragraph text — click any of these on the canvas and type. **Nothing else is manually editable.** Tables, charts, and images have **no**
  manual editing UI at all: No cell editing on tables, No editing a chart's type or its underlying data , No replacing/re-generating an image by clicking it. Any change to a table, chart, or image has to go through chat (e.g. "tur this into a bar chart", "add a row for Q3", "change this image to...")
- **Context window management** — This Nice to have feature is not developed
- **Multiple presentation projects** — This Nice to have feature is not developed
- **The Light/Dark toggle is a _presentation_ theme, not a website theme** —
  don't assume it's a dark-mode switch for the app itself, it only
  changes the color theme of the **deck** (canvas, thumbnails, and — this is
  the point — both exports). Whichever one is selected when you click
  Download PDF/PPTX is the theme baked into that file, so you can download a
  dark-themed or light-themed presentation independent of what the rest of
  the app's UI looks like. The chat panel and header are never themed by
  this control.
- **No speaker notes** — the original schema had a `speakerNotes` field
  (generatable by the AI, editable via `update_slide`),it's unused
  ,so didn't consider in schema.
- **Tool calls aren't reported back to the model** — after OpenAI picks a
  tool, this app validates and applies it directly (client-side, against the
  real store) rather than sending a `role: "tool"` result back for a second
  model turn, the pattern OpenAI's own docs recommend for general agentic
  loops. That second round-trip lets a model react to a tool's real outcome
  or chain calls off another call's result; skipped here since these tools
  are deterministic store writes with no failure mode to react to. The
  tradeoff: the model can't chain tool calls that depend on each other's
  result within one turn (e.g. add a slide, then reorder using its
  server-assigned id, in the same turn) — that has to span two user turns
  instead.
- **Tool-call outcomes aren't verified or reported back to the user** — a
  validated tool call can still be silently rejected by the store itself:
  `update_slide`/`change_layout`/`delete_slide` no-op if their target `id`
  no longer exists, and `reorder_slides` no-ops if `orderedIds` isn't an
  exact permutation of the current slides — both are realistic if the deck
  changed (another tool call earlier in the same turn, a manual edit, a
  second browser tab) between when the AI's context was built and when its
  call was applied. The chat's "Done — ..." reply is generated from the
  _validated_ call, before the client ever applies it, so a silently
  rejected mutation is still reported as a success. Root cause: no
  `role: "tool"` result is sent back to the model (see above), and more
  specifically, the store actions don't return success/failure for
  `applyToolCall` to inspect — a real fix means changing every store
  action's return type and threading that result into the reply, not a
  small patch.
- **`generate_deck` combined with other tool calls in one turn can silently
  discard them** — any `update_slide`/`add_slide`
  applied earlier in that turn along with generate is wiped out when the generated deck's
  `loadDeck()` call replaces the entire deck object at the end of the
  stream, with no warning.
- **A mid-stream failure doesn't roll back tool calls already applied** — if
  the OpenAI stream errors out partway through a multi-tool-call turn, the
  tool calls already streamed and applied client-side stay applied. The
  user only sees a generic error message, with no indication the deck
  already partially changed.
- **No cross-tab or concurrent-edit sync** — nothing listens for `storage`
  events, so two tabs open to the app silently diverge; whichever tab's
  debounced write lands last wins, with no merge and no conflict warning.

## Resetting to the default starting deck

There is currently **no in-app "reset" control**. The deck, chat history, and
your chosen theme all persist in the browser's `localStorage`, so closing or
reloading the tab keeps everything as you left it.

The simplest option is opening the app in a private/incognito window.

(or `localStorage.clear()` to remove everything this app has stored at that
origin), then reload the page. This can also be done via
DevTools → Application (Chrome) / Storage (Firefox) → Local Storage → delete
the `deck-lab:deck` / `deck-lab:chat` entries by hand.

## Architecture overview

**Stack:** Next.js 16 (App Router) + TypeScript, Tailwind CSS v4, Zustand
(state), Zod (schema/validation), the OpenAI SDK (server-side only), Recharts
(charts), `@dnd-kit` (drag-to-reorder), `pptxgenjs` + `jsPDF`/`jspdf-autotable`
(exports), `lucide-react` (icons), Inter (font). No backend database —
`localStorage` is the only persistence layer. No authentication.

### What lives where

```
app/
  layout.tsx                     Root layout: header, font, global chrome
  page.tsx                       Main two-pane screen (chat + canvas)
  api/chat/route.ts              Agentic refinement — the one endpoint nearly every chat message goes through (see Data flow below)
  api/generate/route.ts          Standalone bulk-generation endpoint (kept for reuse; not called directly by the client anymore)
  api/generate-image/route.ts    Generates one image for one pending block

components/
  chat/ChatPanel.tsx             Chat UI + SSE stream handling/dispatch
  deck/
    SlideCanvas.tsx              The live, editable slide view
    ThumbnailRail.tsx            Bottom rail: thumbnails, add/delete, drag-reorder, arrow-key navigation
    SlideThumbnail.tsx           One thumbnail card
    InlineEditable.tsx           The click-to-edit text primitive (see Editing scope below)
    SlideRenderer.tsx            Picks the right layout component for a slide
    slides/*.tsx                 One component per slide layout (title, content, two-column, comparison, table)
    slides/EditableContentBlock.tsx   Renders bullets/paragraph/table/chart/image
  toolbar/UndoRedo.tsx,ThemePicker.tsx   Header controls
  ExportActions.tsx                       Download PDF / PPTX buttons

store/
  deckStore.ts                    Deck content, selection, slide theme, undo/redo history — the single source of truth manual edits  AND AI tool calls both write through
  chatStore.ts                   Chat message list
  historyMiddleware.ts           Pure undo/redo stack (no Zustand dependency)

lib/
  schema/slide.ts                Canonical Zod schema — source of truth for the
                                 Deck/Slide/ContentBlock TypeScript types
  ai/                            The generation + refinement pipeline: JSON-schema fragments for OpenAI structured outputs/tool
                                calling, streaming JSON parsers, deck-context
                                summarization, tool validation, and applying a
                                validated tool call to the store
  export/pptx.ts, pdf.ts         Independently rebuild the deck as a .pptx/.pdf
                                  from data (not a screenshot of the DOM)
  themes/                         The 2 slide-content color themes (light/dark)
```

### Data flow

**Chat / AI editing** — every chat message (the first one included) goes to
`POST /api/chat` with the current message, the full deck, prior chat history,
and the currently-selected slide id. The server builds a compact text summary
of the deck (not the full JSON) and asks OpenAI, with 6 available tools
(`generate_deck` for a wholesale new deck, plus `add_slide`/`update_slide`/
`delete_slide`/`reorder_slides`/`change_layout` for targeted edits) — the
model decides which apply. The response streams back over Server-Sent Events
as `text-delta` (plain reply text), `tool-call` (one validated call at a
time), `slide` (during a fresh generation), `done`, or `error`. The client
applies each tool call **through the exact same Zustand store actions manual
editing uses** — this is what lets manual and AI-driven edits coexist without
one clobbering the other, since there's only one mutation path either way.

**Manual editing** — text fields call the store's `updateSlide` action
directly; no server round-trip. Add/delete/reorder go through the store too.

**Export** — `ExportActions.tsx` reads the current deck + selected theme from
the store and hands them to `pptxgenjs`/`jsPDF`, which independently redraw
every slide (including charts, as native PPTX charts / hand-drawn PDF vector
shapes) — not a screenshot of what's on screen, so the export can differ
slightly from the live render (see Known issues).

**Persistence** — the deck, chat messages, and chosen slide theme persist to
`localStorage` (keys `deck-lab:deck`, `deck-lab:chat`) via Zustand's `persist`
middleware. Undo/redo history is intentionally **session-only** and is never
written to `localStorage`.
