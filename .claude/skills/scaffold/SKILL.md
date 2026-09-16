---
name: scaffold
description: Generate the monorepo and every chosen app with the latest official CLIs (pnpm, Turborepo, create-hono, create-vite, create-astro, create-expo-app, supabase init, wrangler), wire in the design system, write the first migration from DATA-MODEL.md, set up GitHub Actions and Cloudflare, and prove everything runs locally. Called by /build for step 6.
---

# scaffold — generate the codebase

Nothing here is typed from memory. Every skeleton comes from a CLI, every dependency from `pnpm add`, every config template from `templates/` **after** checking what the CLI already produced. Before each CLI, run it with `--help` so you use its *current* flags — do not trust remembered ones.

Work through the sections in order. Log each section's completion in `docs/PROGRESS.md` as a sub-entry of the `scaffold` step so an interrupted run resumes at the right section. Read `docs/ARCHITECTURE.md` for which apps to build and `.claude/state.json → apps`.

Project name: kebab-case from PRD title; used as `PROJECT_NAME` in templates and as the `@<project>/` package scope.

## 1. Monorepo root

```bash
corepack enable && corepack prepare pnpm@latest --activate   # or verify pnpm --version
pnpm init                                                    # only if no package.json yet
cp templates/pnpm-workspace.yaml ./
cp templates/turbo.json ./
cp templates/nvmrc .nvmrc
pnpm add -D -w turbo typescript prettier prettier-plugin-tailwindcss
```

Merge `templates/root-package.json` scripts into the root `package.json` (keep whatever `pnpm init` wrote; set `packageManager` to the real pnpm version). Create `packages/config` (`pnpm init` inside it, name `@<project>/config`), copy `tsconfig.base.json`, `eslint.config.mjs`, `prettier.config.mjs` there, and install the ESLint plugins listed at the top of the eslint template. Root `prettier.config.mjs` re-exports the config one.

## 2. Supabase

```bash
supabase init            # creates supabase/config.toml
supabase start           # pulls Docker images the first time — warn the owner it takes a few minutes
supabase status          # capture local URL, anon key, service role key → .env files
```

Write the first migration from `docs/DATA-MODEL.md → First migration plan`:

```bash
supabase migration new init_schema
```

Edit the generated SQL file: `profiles` + trigger on `auth.users`, tables in dependency order, `updated_at` trigger function, `enable row level security` and policies for every table exactly as the "Who can do what" matrix says. Then `supabase/seed.sql` from the seed plan. Run `supabase db reset` and confirm it applies cleanly. Generate types: `pnpm db:types` (creates `packages/api-types/src/database.types.ts`; make `packages/api-types` first with `pnpm init`).

Auth config in `supabase/config.toml`: enable the method chosen in ARCHITECTURE.md; set `site_url` and `additional_redirect_urls` for local web (and the Expo scheme if mobile).

## 3. API — `apps/api` (always)

```bash
pnpm create hono@latest apps/api    # choose the cloudflare-workers template, pnpm
```

Then:

- `pnpm --filter api add @supabase/supabase-js zod @hono/zod-validator` and `pnpm --filter api add -D wrangler vitest @cloudflare/vitest-pool-workers` (check each package still exists and is the current recommendation with `npm view <pkg>`).
- Replace the CLI's `wrangler.*` with `templates/wrangler.api.jsonc` **merged** with anything the CLI set (keep its `main`, take our `name`, `compatibility_flags`, `vars`). Set `compatibility_date` to today.
- Structure:

  ```
  src/
    index.ts          app + route mounting; `export type AppType = typeof routes`
    env.ts            typed Bindings (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, …)
    middleware/auth.ts  verifies the Supabase JWT from Authorization: Bearer; sets c.var.user
    routes/health.ts  GET /health
    routes/me.ts      GET /me (returns profile) — proves auth end to end
    lib/supabase.ts   service-role client factory (server only)
    lib/errors.ts     AppError + onError handler → consistent JSON { error: { code, message } }
  ```
- Every route: `zValidator` on `param`/`query`/`json`. Chain routes so `AppType` is fully typed for `hc`.
- `packages/api-types/src/index.ts`: `export type { AppType } from "../../../apps/api/src/index"` (or via a TS path alias); also re-export shared Zod schemas from `apps/api/src/schemas`.
- `.dev.vars` from `templates/env.example` (api section) with the local Supabase values. Add `.dev.vars` to `.gitignore` (already there).
- Prove it: `pnpm --filter api dev` → `curl localhost:8787/health` → 200.

## 4. Web app — `apps/web` (if chosen)

```bash
pnpm create vite@latest apps/web    # React + TypeScript (SWC variant if offered)
```

Then:

- `pnpm --filter web add react-router @supabase/supabase-js hono @<project>/design-system @<project>/api-types` (`hono` is needed for the `hc` client; `react-router` — check whether the current major is `react-router` or `react-router-dom`).
- Tailwind: follow the *current* Tailwind + Vite install docs (`npm view tailwindcss version`, then the docs' Vite plugin steps). Wire the design-system preset.
- ESLint: if `create-vite` produced an `eslint.config.*`, replace its contents with `export { default } from "@<project>/config/eslint.config.mjs";` and remove plugins it installed that the shared config already provides.
- `templates/wrangler.web.jsonc` → `apps/web/wrangler.jsonc`. `pnpm --filter web add -D wrangler`. Add script `"deploy": "wrangler deploy"` via `pnpm pkg set scripts.deploy="wrangler deploy"` (not by hand-editing).
- Structure (the component-breakdown skill depends on it):

  ```
  src/
    main.tsx, App.tsx, router.tsx
    lib/api.ts          hc<AppType>(import.meta.env.VITE_API_URL, { headers: () => auth header })
    lib/supabase.ts     browser client (anon key) — auth only
    features/
      auth/             sign-in page, session hook, ProtectedRoute
      shell/            AppShell (sidebar/nav from style guide), 404, error boundary
    components/composed/   shared patterns (DataTable, FormLayout…) — empty at scaffold
  ```
- Replace the CLI's demo page with the AppShell + sign-in from the style guide's key screens, using only design-system components. This is the "empty authenticated shell"; feature F001 finishes auth.
- `.env.local` from the template's web section. `.env.example` committed.
- Prove it: `pnpm --filter web dev` → sign-in page renders with the right fonts and colours.

## 5. Website — `apps/site` (if chosen)

```bash
pnpm create astro@latest apps/site   # minimal/empty template, TypeScript strict
pnpm --filter site exec astro add tailwind
pnpm --filter site exec astro add cloudflare   # check: current adapter may generate wrangler config itself
```

Wire the design-system preset into the Tailwind config; import `tokens.css` in the base layout. Copy `templates/wrangler.site.jsonc` only if the adapter didn't create one; otherwise merge the `name`. Build the landing hero from the style guide. `.env` from the site section. Prove: `pnpm --filter site dev`.

## 6. Mobile — `apps/mobile` (only if ARCHITECTURE.md passed the gate)

First check tooling the setup step skipped: `xcode-select -p` (macOS, iOS), Android Studio + `adb`, `pnpm dlx eas-cli --version`, Expo account (`eas login`). Missing → `docs/GETTING-SET-UP.md → Mobile` and wait.

```bash
pnpm create expo-app@latest apps/mobile   # choose the Expo Router (tabs) TypeScript template
pnpm --filter mobile add @supabase/supabase-js hono @<project>/design-system @<project>/api-types expo-secure-store
```

- Supabase client with `expo-secure-store` as storage; `hc<AppType>` in `lib/api.ts` mirroring web.
- pnpm + Expo: check current Expo docs for the monorepo `metro.config.js` (watchFolders + nodeModulesPaths) and whether `node-linker=hoisted` is still recommended in `.npmrc`.
- Theme provider from `theme.native.ts` at the root layout. Screens from the style guide's phone mocks, using `components/native`.
- EAS: `eas init`, `eas build:configure` → `eas.json` with `development`, `preview`, `production` profiles. Add `docs/MOBILE-RELEASE.md` explaining the App Store / Play flow in plain language, including the developer-account costs.
- Prove: `pnpm --filter mobile start` and the sign-in screen opens in Expo Go or a dev build.

## 7. Design system package

Should already exist from step 5 of `/build`. Verify it builds (`pnpm --filter design-system build:tokens`) and that each app resolves it (workspace protocol `workspace:*` — check with `pnpm ls --filter web`).

## 8. GitHub + Cloudflare

- `git init` if needed, `.gitignore` present, initial commit `chore(scaffold): generate monorepo`.
- `gh repo create <project> --private --source . --push` (ask the owner: private or public, and confirm the GitHub account from `gh auth status`).
- Copy `templates/github-workflows/ci.yml` and `deploy.yml` to `.github/workflows/`; delete the `deploy-site` job if no site; mobile is never deployed from Actions.
- Cloudflare: `wrangler whoami` for account id. For each app: `pnpm --filter <app> exec wrangler deploy` once, manually, so the Workers exist and the owner sees a live URL. Then `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` etc. for the api, using the **hosted** Supabase project's values.
- Hosted Supabase: the owner creates the project in the dashboard (walk them through it); `supabase link --project-ref …`; `supabase db push`; set the hosted project's auth `site_url` to the web Worker URL.
- GitHub secrets: list every name from the comment at the top of `deploy.yml`; set them with `gh secret set NAME` one at a time, asking the owner to paste each value (never echo secrets back).
- Push to `main`, watch `gh run watch`, confirm green.

## 9. Documentation and hand-off

Load `.claude/skills/documentation/SKILL.md` and produce: root `README.md` (replace the template's — the project's own, with the live URLs), per-app READMEs, `docs/api.md`, and update `CLAUDE.md` if any path differs from the kit default. ADR `0001-scaffold.md` recording every CLI version used and any place a template was adapted.

Tell the owner, in plain words: the three URLs (api, web, site), how to run locally (`pnpm dev` + `supabase start`), and that the next `build` starts feature F001 (auth end-to-end).

Approval question from `/build`: **"Everything runs on your machine. Ready to start building features?"**

## When a CLI has changed

If a CLI's prompts or output differ from what this file describes, follow the CLI — it is the source of truth — and note the difference in `docs/adr/0001-scaffold.md` and in PROGRESS so the kit author can update the template. Never fight the CLI's structure; adapt ours.
