# Deck Lab — AI Presentation Maker

## 📖 About

Most AI presentation tools are good at the first draft and bad at everything
after it. Ask them for one small change and they regenerate the whole deck, and
any fix you made by hand is gone.

Deck Lab is built around the opposite idea: **after the first draft, the AI
only ever touches what you ask it to.** You start with a prompt ("a 6-slide
pitch for a coffee subscription startup") and get a complete deck with a title
slide, content slides, a chart, an AI-generated image and a closing slide. From
there you can keep talking to it ("make slide 3 more concise", "turn these
bullets into a table") or edit directly on the canvas, the way you would in
Google Slides. Both kinds of edits go through the same set of actions, so the
AI never overwrites your manual changes and you can undo either one.

When you're done, you download the deck as a PowerPoint or PDF file, with the
theme you picked and every element exactly where you placed it.

🔗 **Link to the project:** https://deck-lab-vert.vercel.app/

## ✨ Features

### 🤖 AI-powered generation

- **Prompt-to-deck** — type a topic and get a complete, well-structured
  presentation: a title slide, content slides, a data chart, an AI-generated
  image and a closing summary. Ask for a specific number of slides ("five
  slides", "a 6-slide deck") and you get exactly that.
- **Live streaming** — slides appear on screen one by one as the model writes
  them, and chat replies type out in real time. No spinner-then-dump.
- **AI-generated images** — each image is created from a short description in
  the background. The slide shows a placeholder right away and the image fills
  in when it's ready, so it never holds up the rest of the deck.
- **Charts and tables** — bar, line and pie charts plus data tables. When the
  AI has to invent example figures for a chart, it labels them as illustrative.

### 💬 Conversational editing (agentic tool use)

- **Chat to refine** — "make slide 3 more concise", "add a pricing slide after
  the intro", "turn this into a table", "move the summary to the end".
- **The AI picks the tool** — the model decides between `add_slide`,
  `update_slide`, `delete_slide`, `reorder_slides`, `change_layout` or
  generating a whole new deck, based on what you ask.
- **Targeted, diff-based edits** — only the slides you mention change. The
  rest of the deck, including your manual edits, is left untouched.
- **Knows what you're looking at** — if you say "change the title to X"
  without naming a slide, it offers to change the slide you have open and
  waits for a "yes". If you name a slide ("slide 4", or by its title), it
  edits that slide directly.

### ✍️ Manual editing (Google Slides-style canvas)

- **Everything is an element** — titles, text, bullets, tables, charts,
  images and shapes can each be selected, dragged, resized (Shift keeps
  proportions), nudged with the arrow keys or deleted, with snapping guides to
  the slide and to other elements.
- **Insert** — text boxes, bullet lists, rectangles, ellipses, tables and
  images uploaded from your computer.
- **Format** — font size, bold, italic and alignment for text; border colour
  for shapes; switch a chart between bar, line and pie; replace an image.
- **Click-to-edit text** — click a selected element again (or double-click)
  to type into titles, bullets, paragraphs and table cells.
- **Add, delete and drag-to-reorder slides** from the thumbnail rail.
- **Five starting layouts** — title, content, two-column, comparison and
  table. A layout only places elements initially; after that you can
  rearrange freely.
- **Undo / redo for everything** — one history covers both AI and manual
  changes, so you can undo an AI edit exactly like a manual one. Use the
  toolbar buttons or `⌘Z` / `⌘⇧Z` (`Ctrl+Z` / `Ctrl+Shift+Z` on Windows).
  While you're typing inside a text box, the shortcut undoes your typing
  instead, as you'd expect.
- **Slide themes** — five colour themes (Classic Light, Midnight, Corporate
  Blue, Warm Sand, Forest), picked from a dropdown. A theme changes the
  slides' background, text, accent and chart colours, and it carries through
  to the downloaded files.
- **One-click download** — export to **PDF** or **PowerPoint (PPTX)** with no
  print dialog. Every element lands at its exact on-canvas position with its
  formatting and theme. Charts are drawn as real vector graphics (not
  screenshots), and text in the PowerPoint file stays editable.
- **Auto-save** — your deck, theme and chat history are saved in the browser
  and come back after a page reload.

---

## 🧪 AI Evals

Unit tests check the code, but they can't tell you whether the AI behaves
well, and it doesn't answer the same way every time. So Deck Lab has an eval
harness (`evals/`): scripts that send real requests to the running app, check
what the AI actually did, and run every test case 3 times. Results are
reported as rates with 95% confidence intervals, and each run is saved in its
own folder so runs can be compared side by side.

| Eval                      | What it checks                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Edit accuracy**         | 61 chat requests: did the AI pick the right tool, change the right slide, leave every other slide alone, and ask when it was ambiguous? |
| **Targeted vs full deck** | After a manual edit, the same request is done with targeted tool calls and by regenerating the whole deck, on a 6- and a 20-slide deck  |
| **Deck generation**       | 20 prompts: does each deck arrive, with the exact slide count asked for and the required structure (title, chart, image, closing)?      |
| **Context growth**        | A scripted 30-message editing conversation, with the chat history capped vs uncapped: how cost grows and whether the AI keeps editing   |

Ambiguous requests are partly graded by an **LLM judge** (gpt-4o-mini with a
written rubric), whose failing verdicts were checked by hand.

### Latest results

| Metric                                               | Result                            |
| ---------------------------------------------------- | --------------------------------- |
| Edit requests handled correctly                      | 100% (61 requests × 3 runs)       |
| Other slides left untouched by an edit               | 100%                              |
| Manual layout edits kept (targeted vs full deck)     | 100% vs 0%                        |
| Time per edit, 20-slide deck (targeted vs full deck) | 1.2 s vs 6.4 s (median)           |
| Cost per edit, 20-slide deck (targeted vs full deck) | $0.0106 vs $0.0172                |
| New decks with the exact slide count asked for       | 89%                               |
| New decks following the required structure           | 93%                               |
| Time until the first slide appears                   | ~1.1 s (median); full deck ~3.7 s |
| Turns that made an edit in a 30-message conversation | 90% (history capped)              |

On a small deck, regenerating everything is slightly cheaper, because each
targeted request carries the tool definitions. As decks grow, the full rewrite
has to send and return every slide, so targeted edits become cheaper and
several times faster. And they're the only approach that keeps manual layout
changes.

The edit and conversation figures are from the latest run, after the last
fix. The targeted-vs-full-deck and generation figures are from the previous
full run; those two evals weren't re-run after it.

### Results run by run

The tests were re-run after each round of changes. Every row uses the same
tests in every column, and each test is tried 3 times.

| Same tests in every run                                        | Run 1<br>First measurement | Run 2<br>Better tests | Run 3<br>Fix 1 | Run 4<br>Fix 2 | Run 5<br>Fix 3 |
| -------------------------------------------------------------- | -------------------------- | --------------------- | -------------- | -------------- | -------------- |
| Edit requests handled correctly (48 requests)                  | 93.1%                      | 90.3%                 | 99.3%          | 96.5%          | **100%**       |
| Editing a named slide while that same slide is open            | –                          | 10/15                 | 9/15           | 15/15          | **15/15**      |
| Subjective edits on a named slide ("more concise", "punchier") | 3/6                        | 2/6                   | 5/6            | 1/6            | **6/6**        |
| Turns that made an edit in a 30-message conversation           | 50%                        | 51%                   | 63%            | 62%            | **90%**        |
| AI claiming a slide was selected when none was                 | –                          | 3/9                   | 0/9            | 0/9            | **0/9**        |
| Edits rejected because the AI sent invalid arguments           | –                          | 1.5%                  | 0%             | 0%             | **0%**         |
| New decks with the exact slide count asked for                 | 77%                        | 73%                   | 96%            | **89%**        | –              |
| New decks following the required structure                     | –                          | 88%                   | 70%            | **93%**        | –              |
| Targeted edits that made the requested change (20-slide deck)  | –                          | 86%                   | 97%            | **75%**        | –              |

**What each run was**

- **Run 1 — First measurement:** the app as built, with the first version of
  the tests.
- **Run 2 — Better tests:** the app was unchanged; only the tests improved. A
  broken test was fixed, and new checks were added: a 20-slide deck, manual
  layout edits, requests made while a slide is selected, and a stricter check
  for ambiguous requests. Differences from Run 1 are measurement noise, not
  changes in the app.
- **Run 3 — Fix 1:** rewrote the AI's rules for named vs selected slides, made
  its answers more consistent (lower temperature), made slide counts exact and
  labelled invented chart figures as illustrative. Slide counts jumped, but
  the deck structure dropped. The tests caught it.
- **Run 4 — Fix 2:** removed an example question the AI was copying word for
  word, stopped showing the AI which slide is selected when you name one,
  restored the required deck structure, and tidied small mistakes in the AI's
  edits instead of rejecting them. The "slide is open" bug was fixed, but
  subjective edits got worse.
- **Run 5 — Fix 3:** the "ask before editing" rule is now only given to the AI
  when it actually applies. Subjective edits and long conversations recovered.
  Only the edit and conversation tests were re-run.

"–" means the test didn't exist yet in that run, or wasn't re-run. Bold marks
the latest result for each row. Run 1's conversation test ran once instead of
3 times.

Full summaries for every run are in [`evals/results/runs/`](evals/results/runs/),
and every metric is defined, with its expected value, in
[`evals/README.md`](evals/README.md).

### Running the evals

The evals call the real OpenAI API through the app, so they cost money (a few
dollars for a full run) and aren't part of `npm run test`. They use the same
`.env.local` as the app.

```bash
# 1. Start the app
npm run dev

# 2. In a second terminal (pick any run id; results go to evals/results/runs/<run-id>/)
npm run eval:edit       -- --run-id my-run
npm run eval:baseline   -- --run-id my-run
npm run eval:generation -- --run-id my-run
npm run eval:context    -- --run-id my-run --label capped-10

# 3. Context growth, uncapped: stop the app, restart it with the history cap off, then
CHAT_MAX_HISTORY_MESSAGES=0 npm run dev
npm run eval:context    -- --run-id my-run --label uncapped
```

Useful flags: `--runs N` (default 3), `--filter <term>` to run only matching
cases (comma-separate several terms), and `--base-url` if the app isn't on
`localhost:3000`.

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
OPENAI_IMAGE_MODEL=gpt-image-2  # optional (default)
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

## 🛠️ Tech Stack

| Area            | Technologies                                                            |
| --------------- | ----------------------------------------------------------------------- |
| **Language**    | TypeScript                                                              |
| **Framework**   | Next.js 16 (App Router, Route Handlers), React 19                       |
| **Styling**     | Tailwind CSS v4                                                         |
| **State**       | Zustand (with `persist` middleware + custom undo/redo history)          |
| **AI**          | OpenAI API — GPT-4o (structured outputs, function calling), gpt-image-2 |
| **Validation**  | Zod, JSON Schema                                                        |
| **Streaming**   | Server-Sent Events (SSE), custom incremental JSON parser                |
| **Charts**      | Recharts                                                                |
| **Drag & drop** | dnd-kit                                                                 |
| **Export**      | pptxgenjs (PowerPoint), jsPDF + jspdf-autotable (PDF)                   |
| **Testing**     | Vitest, jsdom, custom AI eval harness                                   |
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

Every chat message goes to one endpoint, `/api/chat`, and the model decides
what kind of work it is.

1. **The request** — the chat panel sends your message together with the
   current deck, the slide you have open and the recent conversation. The
   deck is summarised compactly (each slide's id, layout, title and a short
   content summary), so the model can refer to exact slides without the full
   deck filling its context. Only the last 10 chat messages are resent, which
   keeps cost flat as a conversation grows.
2. **Generation (a new deck)** — if you're asking for a new presentation, the
   model calls `generate_deck`. The server then makes one structured-output
   call that returns the whole deck as JSON matching a strict schema. That
   response is parsed _while it streams_: each slide is sent to the browser
   the moment its JSON closes, which is why slides appear one by one.
3. **Refinement (targeted edits)** — for anything else, the model calls one or
   more small tools such as `update_slide` or `reorder_slides`. Each tool call
   is checked against a schema on the server before it's sent on. Small
   flaws, such as an empty bullet, are tidied up rather than failing the whole
   edit; anything still invalid is rejected and reported, never applied.
4. **Applying the change** — the browser applies each tool call through the
   same store actions that manual editing uses. That's what makes AI and
   manual edits safe together: there is only one way to change the deck, so
   every change lands in the same undo history and is saved the same way.
5. **Images** — slides land immediately with a placeholder. Images are
   generated in the background through a separate route and patched into the
   right slide when ready, even if you've edited the deck in the meantime.
6. **Export** — the PDF and PowerPoint exporters redraw every slide from the
   deck data (element positions, styles and theme), rather than taking
   screenshots of the page.

The OpenAI API key is only ever read on the server.
