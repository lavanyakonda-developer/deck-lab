# Deck Lab

An AI-powered presentation builder — describe a deck in chat, watch it get
built slide by slide, refine it conversationally, edit text by hand, and
export to PDF or PPTX. Built for the Sarvam AI technical assignment.

#### Deployed on - https://deck-lab-vert.vercel.app/

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

## Known issues / incomplete features

- **Only text is directly editable on a slide**: titles, subtitles, bullet
  items, and paragraph text — click any of these on the canvas and type. **Nothing else is manually editable.** Tables, charts, and images have **no**
  manual editing UI at all:

- No cell editing on tables.
- No editing a chart's type or its underlying data.
- No replacing/re-generating an image by clicking it.

Any change to a table, chart, or image has to go through chat (e.g. "turn
this into a bar chart", "add a row for Q3", "change this image to...")

- **Context window management** — long chat histories and the full deck are
  sent to OpenAI on every request with no summarization or trimming. Very
  long sessions or very large decks could hit token limits or get slow/costly.
- **Multiple presentation projects** — there's only ever one deck. Generating
  a new one replaces the current deck; there's no project list/dashboard to
  switch between saved decks.
