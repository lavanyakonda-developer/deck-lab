# Deck Lab: AI presentation maker

## About

Most AI presentation tools are good at the first draft and bad at everything
after it. Ask them for one small change and they regenerate the whole deck, and
any fix you made by hand is gone.

Deck Lab works the other way round. After the first draft, the AI only touches
what you ask it to. You start with a prompt ("a 6-slide pitch for a coffee
subscription startup") and get a complete deck with a title slide, content
slides, a chart, an AI-generated image and a closing slide. From there you can
keep talking to it ("make slide 3 more concise", "turn these bullets into a
table") or edit directly on the canvas, the way you would in Google Slides.
Both kinds of edits go through the same set of actions, so the AI never
overwrites your manual changes and you can undo either one.

When you're done, you download the deck as a PowerPoint or PDF file, with the
theme you picked and every element where you placed it.

Live app: https://deck-lab-vert.vercel.app/

## Features

### Generating a deck

Type a topic and you get a full presentation: a title slide, content slides, a
data chart, an AI-generated image and a closing summary. If you ask for a
specific number of slides ("five slides", "a 6-slide deck"), you get exactly
that many.

Slides appear one by one as the model writes them, and chat replies type out
as they stream in, so you never sit watching a spinner.

Images are generated in the background from a short description. The slide
shows a placeholder right away and the image fills in when it's ready, so a
slow image never holds up the rest of the deck.

Charts can be bar, line or pie, and slides can also hold data tables. When the
AI has to make up example figures for a chart, it labels them as illustrative.

### Editing through chat (agentic tool use)

You can keep refining the deck in chat: "make slide 3 more concise", "add a
pricing slide after the intro", "turn this into a table", "move the summary to
the end". The model picks the tool for the request: `add_slide`,
`update_slide`, `delete_slide`, `reorder_slides`, `change_layout`, or
generating a whole new deck.

Edits are targeted and diff-based. Only the slides you mention change, and the
rest of the deck, including your manual edits, stays as it was.

The chat also knows which slide you have open. If you say "change the title to
X" without naming a slide, it offers to change the open slide and waits for a
"yes". If you name a slide ("slide 4", or by its title), it edits that slide
directly.

### Editing by hand (Google Slides-style canvas)

Titles, text, bullets, tables, charts, images and shapes are each a separate
element. You can select, drag, resize (Shift keeps proportions), nudge with the
arrow keys or delete any of them, and snapping guides line them up with the
slide and with each other.

- Insert text boxes, bullet lists, rectangles, ellipses, tables, and images
  uploaded from your computer.
- Format text (font size, bold, italic, alignment), set a shape's border
  colour, switch a chart between bar, line and pie, or replace an image.
- Click a selected element again (or double-click it) to type into titles,
  bullets, paragraphs and table cells.
- Add, delete and drag-to-reorder slides from the thumbnail rail.
- Start a slide from one of five layouts: title, content, two-column,
  comparison and table. A layout only sets where elements start, and you can
  rearrange them freely after that.
- Undo and redo cover everything. AI and manual changes share one history, so
  you undo an AI edit the same way you undo your own. Use the toolbar buttons
  or `⌘Z` / `⌘⇧Z` (`Ctrl+Z` / `Ctrl+Shift+Z` on Windows). While you're typing
  inside a text box, the shortcut undoes your typing instead.
- Pick one of five colour themes from a dropdown: Classic Light, Midnight,
  Corporate Blue, Warm Sand or Forest. A theme changes the slides' background,
  text, accent and chart colours, and the downloaded files use it too.
- Download the deck as a PDF or PowerPoint (PPTX) file in one click, with no
  print dialog. Every element keeps its on-canvas position, formatting and
  theme. Charts are drawn as vector graphics instead of screenshots, and text
  in the PowerPoint file stays editable.
- Your deck, theme and chat history are saved in the browser and come back
  after a page reload.

## AI evals

Unit tests check the code, but they can't tell you whether the AI behaves well,
and its answers vary from one run to the next. So Deck Lab has an eval harness
(`evals/`): scripts that send real requests to the running app, check what the
AI actually did, and run every test case 3 times. Results are reported as rates
with 95% confidence intervals, and each run is saved in its own folder so runs
can be compared side by side.

| Eval                      | What it checks                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Edit accuracy             | 61 chat requests: did the AI pick the right tool, change the right slide, leave every other slide alone, and ask when it was ambiguous? |
| Targeted vs full deck     | After a manual edit, the same request is done with targeted tool calls and by regenerating the whole deck, on a 6- and a 20-slide deck  |
| Deck generation           | 20 prompts: does each deck arrive, with the exact slide count asked for and the required structure (title, chart, image, closing)?      |
| Context growth            | A scripted 30-message editing conversation, with the chat history capped vs uncapped: how cost grows and whether the AI keeps editing   |

Ambiguous requests are graded partly by an LLM judge (gpt-4o-mini with a
written rubric). Its failing verdicts were checked by hand.

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
has to send and return every slide, so targeted edits get cheaper and several
times faster, on top of being the only approach that keeps manual layout
changes.

The edit and conversation figures come from the latest run, after the last
fix. The targeted-vs-full-deck and generation figures come from the full run
before that, because those two evals weren't re-run afterwards.

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

What changed in each run:

- Run 1, first measurement: the app as built, with the first version of the
  tests.
- Run 2, better tests: the app was unchanged and only the tests improved. A
  broken test was fixed, and new checks were added for a 20-slide deck, manual
  layout edits, requests made while a slide is selected, and a stricter check
  for ambiguous requests. Any difference from Run 1 is measurement noise.
- Run 3, fix 1: rewrote the AI's rules for named vs selected slides, lowered
  the temperature so its answers are more consistent, made slide counts exact
  and labelled invented chart figures as illustrative. Slide counts jumped but
  deck structure dropped, which the tests caught.
- Run 4, fix 2: removed an example question the AI was copying word for word,
  stopped showing the AI which slide is selected when you name one, restored
  the required deck structure, and tidied small mistakes in the AI's edits
  instead of rejecting them. That fixed the "slide is open" bug, but subjective
  edits got worse.
- Run 5, fix 3: the "ask before editing" rule is now only given to the AI when
  it actually applies, and subjective edits and long conversations recovered.
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

## Getting started

You'll need Node.js 20+, npm and an
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

## Tech stack

| Area        | Technologies                                                            |
| ----------- | ----------------------------------------------------------------------- |
| Language    | TypeScript                                                              |
| Framework   | Next.js 16 (App Router, Route Handlers), React 19                       |
| Styling     | Tailwind CSS v4                                                         |
| State       | Zustand (with `persist` middleware + custom undo/redo history)          |
| AI          | OpenAI API: GPT-4o (structured outputs, function calling), gpt-image-2  |
| Validation  | Zod, JSON Schema                                                        |
| Streaming   | Server-Sent Events (SSE), custom incremental JSON parser                |
| Charts      | Recharts                                                                |
| Drag & drop | dnd-kit                                                                 |
| Export      | pptxgenjs (PowerPoint), jsPDF + jspdf-autotable (PDF)                   |
| Testing     | Vitest, jsdom, custom AI eval harness                                   |
| Tooling     | ESLint, Prettier                                                        |
| Deployment  | Vercel                                                                  |

## How it works

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

1. The chat panel sends your message along with the current deck, the slide
   you have open and the recent conversation. The deck is summarised compactly
   (each slide's id, layout, title and a short content summary), so the model
   can refer to exact slides without the full deck filling its context. Only
   the last 10 chat messages are resent, which keeps cost flat as a
   conversation grows.
2. If you're asking for a new presentation, the model calls `generate_deck`.
   The server then makes one structured-output call that returns the whole
   deck as JSON matching a strict schema. That response is parsed while it
   streams, and each slide is sent to the browser as soon as its JSON closes,
   which is why slides appear one by one.
3. Anything else is a targeted edit: the model calls one or more small tools
   such as `update_slide` or `reorder_slides`. The server checks each tool
   call against a schema before passing it on. Small flaws, such as an empty
   bullet, are tidied up instead of failing the whole edit. Anything still
   invalid is rejected and reported, never applied.
4. The browser applies each tool call through the same store actions that
   manual editing uses. That's what lets AI and manual edits live together:
   there is only one way to change the deck, so every change lands in the same
   undo history and is saved the same way.
5. Slides land immediately with a placeholder. Images are generated in the
   background through a separate route and patched into the right slide when
   they're ready, even if you've edited the deck in the meantime.
6. The PDF and PowerPoint exporters redraw every slide from the deck data
   (element positions, styles and theme) instead of taking screenshots of the
   page.

The OpenAI API key is only ever read on the server.
