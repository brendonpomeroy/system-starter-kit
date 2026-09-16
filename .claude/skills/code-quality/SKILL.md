---
name: code-quality
description: The quality bar every feature must clear before it is done — TypeScript strict, ESLint + Prettier clean, pragmatic tests (Vitest for API routes and logic, React Testing Library for logic-bearing components, one Playwright smoke test for the critical path), error handling, security basics — with per-codebase specifics for api, web, site and mobile. Called by /build as the quality stage of every feature.
---

# code-quality — the bar

Run this after `build` and before `compliance`. It is a checklist you *execute*, not read. Each item is a command or a concrete inspection; record results in the feature's PROGRESS entry. If anything fails, fix it here — do not hand the owner a feature with a known red.

## 1. Mechanical gates (all apps)

```bash
pnpm typecheck        # tsc --noEmit per app; zero errors
pnpm lint             # zero errors; warnings must be justified in PROGRESS or fixed
pnpm format:check     # or `pnpm format` then commit
pnpm test             # zero failures
pnpm build            # every app builds; catches env and import issues dev mode hides
```

Rules that no gate catches but you must check by reading the diff:

- No `any`, no `as unknown as X` to silence errors, no `// @ts-ignore`. `// @ts-expect-error` only with a reason and a link.
- No `console.log` left behind. Structured logging in the API (`c.get('logger')` or a tiny wrapper) with request id.
- No secrets, keys or hosted URLs hard-coded. Everything from env, and every env var is in the app's `.env.example`.
- No dead code, commented-out blocks, or TODOs without a feature id.
- Dependencies added with `pnpm add` in the right workspace, and each one justified (would a 20-line function do?). `pnpm ls --depth 0 --filter <app>` shows nothing unexpected.
- Imports respect the tiers (component-breakdown skill). `import-x/no-cycle` is an error for a reason.

## 2. Testing — pragmatic, not performative

Principle: test the things that would embarrass you if they broke, at the cheapest level that catches them. No coverage percentage target. Every feature adds tests in these places:

| Layer | Tool | What to test | What not to test |
|---|---|---|---|
| API routes | Vitest + `@cloudflare/vitest-pool-workers` (or Hono's `app.request()` for pure route tests) | validation rejects bad input (400 shape); auth rejects missing/invalid token (401) and wrong owner (403); happy path returns the typed shape; service-layer logic with a mocked Supabase client | Supabase itself; Hono itself |
| Pure logic | Vitest | anything with branches: pricing, permissions, date maths, formatters, reducers | trivial getters |
| Components | Vitest + React Testing Library (`@testing-library/react`, `jest-dom`) | components with logic: conditional rendering, form validation messages, interaction → callback. Query by role/label (what the user sees). | pure presentational primitives (the style guide is their test); layout |
| Hooks | RTL `renderHook` with a mocked `hc` client (`msw` if network mocking is cleaner) | loading/success/error states; mutation invalidation | React Query internals |
| Critical path | Playwright (web only), one spec `e2e/smoke.spec.ts` | sign in → reach main screen → perform the single most important core flow from the PRD → sign out. Extend it when a feature *is* on the critical path; otherwise leave it. | everything else |
| Mobile | Vitest/Jest with `@testing-library/react-native` for hooks and logic only | same as web hooks/logic | UI snapshots; Detox/Maestro unless the owner asks |
| Site | Astro's `astro check` + a build | links resolve, build succeeds | rendering |

Test files live next to the code (`__tests__/` in a feature, `*.test.ts` beside a service). Names describe behaviour: `rejects a project name over 80 characters`, not `test1`.

First-time setup per app happens the first time the feature loop needs it (`pnpm --filter <app> add -D vitest @testing-library/react …`, config from the tool's current docs), logged in PROGRESS.

## 3. Error handling

- **API**: one `onError` handler → `{ error: { code, message, details? } }` with the right status. `AppError(code, status, message)` class; throw it from services. Zod errors → 400 with field paths. Unknown errors → 500 with a request id, full error logged, message *not* leaked to the client.
- **Web/mobile**: every `hc` call goes through `lib/api.ts` which turns non-2xx into a typed `ApiError`. Hooks expose `error`; pages render the design-system error state, never a blank screen. One React error boundary at the shell, one per page. Toast for mutation failures with a retry where it makes sense.
- **Forms**: server validation errors map back onto fields (Zod paths → `setError`).
- **Never** swallow an error (`catch {}`), and never show the user a stack trace or a raw Postgres message.

## 4. Security basics (every feature)

- API verifies the Supabase JWT on every non-public route; ownership/role checks happen in the service, *and* RLS policies exist for the same rule.
- Service-role key is only ever in `apps/api` bindings. Grep for it in `apps/web`, `apps/mobile`, `apps/site` — must be zero hits.
- Input: Zod on all params/query/body; length limits on strings; ids validated as uuid.
- Output: never return whole rows blindly; select the columns the client needs. No `auth.users` data beyond what `profiles` mirrors.
- CORS on the API limited to the web origin(s) from env. Rate limiting via Cloudflare if the route is public or expensive.
- Uploads (if any) go to Supabase Storage with bucket policies; the API signs URLs, clients never hold storage keys.
- Migrations reviewed for: RLS enabled on new tables, policies for each role in the matrix, no `grant all` shortcuts.

## 5. Performance sanity (cheap checks only)

- Web bundle: `pnpm --filter web build` and look at the size report; a feature shouldn't add > ~50 kB gzipped without a reason. Route-level code splitting via lazy routes.
- API: no N+1 (a loop of Supabase calls) — use a join or `in()`; add an index in the migration for any column you filter/sort on.
- Lists: paginate at the API from day one (`limit`/`cursor`), even for internal tools.
- Images on the site: Astro's `<Image>` with sizes; no raw multi-MB assets.

## 6. Per-codebase quick reference

**apps/api** — vitest config uses the Workers pool so `env` bindings work; tests set `SUPABASE_*` to local values; `wrangler dev --test-scheduled` for cron routes. Run `pnpm --filter api exec wrangler deploy --dry-run` to catch config errors before CI.

**apps/web** — `vitest` with `jsdom` environment and `@testing-library/jest-dom/vitest` setup file; `playwright.config.ts` pointing at `pnpm dev` with a `webServer` block; smoke test uses a seeded local user from `supabase/seed.sql`.

**apps/site** — `astro check` is the typecheck; Lighthouse in CI is optional but a build-size check is not.

**apps/mobile** — `jest-expo` preset is what Expo's CLI generates; keep it unless Vitest works cleanly with the current Expo SDK (check docs at the time). Typecheck with `tsc --noEmit`. `expo-doctor` clean.

## 7. What this stage produces

```markdown
### F00N — quality
typecheck ✓ · lint ✓ (0 warnings) · format ✓ · test ✓ (api 6, web 4) · build ✓
Tests added: routes/projects.test.ts (validation, auth, create), useProjects.test.tsx, smoke extended (create project)
Security: service key grep clean; RLS policies for projects verified in migration
Notes: added index on projects(owner_id, created_at)
```

Then `/build` moves to `compliance`.
