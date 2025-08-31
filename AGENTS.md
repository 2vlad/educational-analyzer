# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages and API routes (`app/api/**/route.ts`) plus feature folders like `(auth)`, `programs`, and `settings`.
- `src/`: Core code — `services/` (adapters, crypto), `lib/supabase/` (client/server), `hooks/`, `utils/`, `providers/`, `types/`.
- `components/`: Reusable UI.
- `__tests__/`: Unit/integration tests; `e2e/`: Playwright tests. Other: `migrations/` (SQL), `public/` (assets), `styles/`.

## Build, Test, and Development Commands
- `npm run dev`: Start local dev server.
- `npm run build` / `npm run start`: Production build/serve.
- `npm run dev:clean` / `build:clean`: Run via `start.sh`/`build.sh` (unsets system API keys to prefer `.env.local`).
- `npm run lint` / `format` / `typecheck`: ESLint, Prettier, TypeScript.
- `npm run test` / `test:watch` / `test:coverage`: Jest (+ Testing Library) with coverage.
- `npm run e2e` / `e2e:ui`: Playwright; auto-starts dev server at `http://localhost:3000`.
- `npm run ci`: Lint → typecheck → test → build.

## Coding Style & Naming Conventions
- TypeScript, strict mode; 2-space indent.
- Prettier: single quotes, no semicolons, trailing commas, width 100.
- ESLint: `@typescript-eslint` + `prettier`; unused vars via TS rule (prefix unused args with `_`).
- Naming: components `PascalCase.tsx`; API handlers `app/api/**/route.ts` exporting `GET/POST`; tests `*.test.ts{,x}`.
- Imports: use `@/*` path alias (see `tsconfig.json`).

## Testing Guidelines
- Unit/integration: Jest `jsdom` with `jest.setup.js` (mocks `ResizeObserver`/`IntersectionObserver`).
- Coverage: global threshold 90% (branches, funcs, lines, statements). Run `npm run test:coverage`.
- E2E: Playwright in `e2e/`; configure in `playwright.config.ts` (projects for Chromium/Firefox/WebKit).

## Commit & Pull Request Guidelines
- Messages: imperative, concise; Conventional Commits encouraged (`feat:`, `fix:`, `refactor:`) — matches history.
- Branches: `feature/<name>`, `fix/<name>`.
- Pre-commit: Husky + lint-staged formats/lints staged files. Before PR: run `lint`, `typecheck`, `test`.
- PRs: clear description, linked issues, screenshots for UI, and note any env or DB migration changes (`migrations/`).

## Security & Configuration Tips
- Copy `.env.example` → `.env.local`; never commit secrets. Prefer `dev:clean`/`build:clean` to avoid system-level keys.
- Required keys: Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, service role where needed) and at least one LLM provider key. See `docs/DEPLOYMENT.md`.
