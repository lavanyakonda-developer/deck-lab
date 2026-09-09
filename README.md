# Deck Lab

AI-powered presentation builder (Sarvam technical assignment).

This project is being built incrementally in phases — see `phases.txt` for
the full roadmap. Setup instructions, architecture overview, and known
issues will be documented here in full as part of the final phase.

## Development

```bash
npm install
cp .env.local.example .env.local   # fill in OPENAI_API_KEY when AI phases begin
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build (includes typechecking)
- `npm run lint` — ESLint
- `npm run format` / `npm run format:check` — Prettier
