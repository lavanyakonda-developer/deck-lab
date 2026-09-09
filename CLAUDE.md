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
- **LLM**: OpenAI SDK, server-side only (Next.js Route Handlers under
  `app/api/`). `OPENAI_API_KEY` is read only in server code, never shipped to
  the client bundle. Default model: `gpt-4o` (see `.env.local.example`).
- **Testing**: Vitest (`vitest.config.mts`) for schema/store unit tests.
  `npm run test`.
- **Drag/reorder** (Phase 2): `dnd-kit`.
- **Charts** (Phase 6): Recharts.
- **Images** (Phase 6): OpenAI image generation via a server route, with a
  graceful placeholder fallback.
- **Export** (Phase 7): CSS print stylesheet baseline (`window.print()` →
  PDF). `pptxgenjs` as a stretch add-on in the same phase if time permits.
- **Deployment**: Vercel.
- **Persistence**: `localStorage` via Zustand `persist` middleware (Phase 2
  onward). No backend DB (per O2).

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

| Phase | Name                                                              | Status                                                                                                          |
| ----- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 0     | Project Scaffolding & Shell UI                                    | ✅ Done — committed `chore: scaffold Next.js app with two-pane shell UI`, pushed to `origin/main`               |
| 1     | Slide Schema & Deck State Model                                   | ✅ Done — committed `feat: add slide schema and deck state model`, **not yet pushed**; user is manually testing |
| 2     | Manual Editing (Complete, AI-Free Product)                        | Not started                                                                                                     |
| 3     | AI Initial Generation (two-phase gen, phase 1)                    | Not started                                                                                                     |
| 4     | Agentic Tool-Use & Diff-Based Refinement (two-phase gen, phase 2) | Not started                                                                                                     |
| 5     | Streaming                                                         | Not started                                                                                                     |
| 6     | Rich Content: Images, Charts, Tables                              | Not started                                                                                                     |
| 7     | Export                                                            | Not started                                                                                                     |
| 8     | Unified Undo/Redo (Nice to Have)                                  | Not started                                                                                                     |
| 9     | Themes / Templates (Nice to Have)                                 | Not started                                                                                                     |
| 10    | Context Window Management (Nice to Have)                          | Not started                                                                                                     |
| 11    | Multiple Presentation Projects (Nice to Have)                     | Not started                                                                                                     |
| 12    | Deployment, README, and Final Polish                              | Not started                                                                                                     |

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
- Commit at the end of each phase (one commit per phase is the norm so far,
  named for the phase's dominant change).
- Every commit ends with the standard attribution footer (Co-Authored-By /
  Claude-Session lines) — this is handled automatically by the assistant,
  not something to ask the user about.
- **Never push without an explicit, separate request.** Commit locally as
  part of finishing a phase; push only when the user says so. Remote
  `origin` is already set to
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
