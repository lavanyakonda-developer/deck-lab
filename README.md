# Deck Lab — AI Presentation Maker

**Describe a presentation in plain English and watch it build itself, slide by slide.**
Then refine it by chatting, edit any text by hand, and export a polished PDF or
PowerPoint file in one click.

🔗 **Live demo:** https://deck-lab-vert.vercel.app/

---

## ✨ Features

### 🤖 AI-powered generation

- **Prompt-to-deck** — type a topic and get a complete, well-structured
  presentation: a title slide, content slides, a data chart, an AI-generated
  image and a closing summary.
- **Live streaming** — slides appear on screen one by one as the model writes
  them, and chat replies type out in real time. No spinner-then-dump.
- **AI-generated images** — every image on a slide is created on the fly from
  a description, filling in asynchronously so it never blocks the rest of the
  deck.
- **Charts and tables** — bar, line and pie charts plus data tables, generated
  from real structured data.

### 💬 Conversational editing (agentic tool use)

- **Chat to refine** — "make slide 3 more concise", "add a pricing slide after
  the intro", "turn this into a table", "move the summary to the end".
- **The AI picks the tool** — the model decides between `add_slide`,
  `update_slide`, `delete_slide`, `reorder_slides`, `change_layout` or
  generating a whole new deck, based on what you ask.
- **Targeted, diff-based edits** — only the slides you mention change. The
  rest of the deck, including your manual edits, is left untouched.
- **Context-aware** — the AI knows which slide you're looking at and asks to
  confirm before changing it when your request is ambiguous.

### ✍️ Manual editing

- **Click-to-edit text** — titles, subtitles, bullets and paragraphs, edited
  directly on the slide.
- **Add, delete and drag-to-reorder slides** from the thumbnail rail.
- **Five layouts** — title, content, two-column, comparison and table.
- **AI and manual edits coexist** — both go through the same state actions, so
  neither one overwrites the other.

### 🧰 Productivity

- **Unified undo / redo** across both AI and manual changes (`⌘Z` / `⌘⇧Z`).
- **Light and dark slide themes**, carried through to exports.
- **One-click export** to **PDF** and **PPTX**, with charts redrawn as native
  vector graphics (not screenshots).
- **Auto-save** — your deck and chat history persist across page reloads.

---

## 🛠️ Tech Stack

| Area            | Technologies                                                            |
| --------------- | ----------------------------------------------------------------------- |
| **Language**    | TypeScript                                                              |
| **Framework**   | Next.js 16 (App Router, Route Handlers), React 19                       |
| **Styling**     | Tailwind CSS v4,                                                        |
| **State**       | Zustand (with `persist` middleware + custom undo/redo history)          |
| **AI**          | OpenAI API — GPT-4o (structured outputs, function calling), gpt-image-1 |
| **Validation**  | Zod, JSON Schema                                                        |
| **Streaming**   | Server-Sent Events (SSE), custom incremental JSON parser                |
| **Charts**      | Recharts                                                                |
| **Drag & drop** | dnd-kit                                                                 |
| **Export**      | pptxgenjs (PowerPoint), jsPDF + jspdf-autotable (PDF)                   |
| **Testing**     | Vitest, jsdom                                                           |
| **Tooling**     | ESLint, Prettier                                                        |
| **Deployment**  | Vercel                                                                  |

---

## 🏗️ How It Works

```
 ┌───────────────┐   prompt + deck + history   ┌────────────────────┐
 │  Chat panel   │ ──────────────────────────▶ │  /api/chat (SSE)   │
 │  (React)      │                             │  OpenAI tool calls │
 │               │ ◀── text · tool-call ·  ─── │                    │
 └──────┬────────┘     slide · done events     └────────────────────┘
        │ apply each event as it arrives
        ▼
 ┌───────────────┐   same actions for AI and manual edits
 │  Deck store   │ ◀──────────────────────────── Slide canvas & thumbnails
 │  (Zustand)    │   addSlide · updateSlide · deleteSlide · reorderSlides · changeLayout
 └──────┬────────┘
        ▼
  Undo/redo history · localStorage · PDF / PPTX export
```

1. **Generation** — a new-deck request produces one structured JSON response,
   streamed and parsed slide by slide.
2. **Refinement** — later requests become small tool calls that patch only
   the slides involved.
3. **Images** — slides land immediately with a placeholder; images are
   generated in the background and patched in when ready.

---

## 🚀 Getting Started

**Prerequisites:** Node.js 20+, npm and an
[OpenAI API key](https://platform.openai.com/api-keys).

```bash
git clone https://github.com/lavanyakonda-developer/deck-lab.git
cd deck-lab
npm install
```

Create a `.env.local` file:

```bash
OPENAI_API_KEY=sk-...   # required
OPENAI_MODEL=gpt-4o     # optional (default)
```

Start the app:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command          | Description              |
| ---------------- | ------------------------ |
| `npm run dev`    | Start the dev server     |
| `npm run build`  | Production build         |
| `npm run start`  | Run the production build |
| `npm run test`   | Run unit tests           |
| `npm run lint`   | Lint the codebase        |
| `npm run format` | Format with Prettier     |

---

## 📁 Project Structure

```
app/
  api/chat/            # Agentic chat endpoint (streaming tool calls)
  api/generate/        # Bulk deck generation (streaming)
  api/generate-image/  # AI image generation
components/
  chat/                # Chat panel
  deck/                # Slide canvas, thumbnails, layouts, inline editing
  toolbar/             # Undo/redo, theme picker
lib/
  ai/                  # Prompts, tool definitions, stream parser, SSE helpers
  schema/              # Zod slide schema
  export/              # PDF and PPTX exporters
  themes/              # Slide theme tokens
store/                 # Zustand deck and chat stores, undo/redo history
```

---

## 🔒 Security

The OpenAI API key is read only in server-side route handlers and never
reaches the browser bundle. Keys live in environment variables and are never
committed.
