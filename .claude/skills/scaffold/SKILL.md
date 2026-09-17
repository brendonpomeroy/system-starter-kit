---
name: scaffold
description: Generate the monorepo and every chosen app with the official CLIs (pnpm, Turborepo, create-hono, create-vite, create-astro, create-expo-app, supabase init, wrangler), wire in the design system, write the first migration from DATA-MODEL.md, set up GitHub Actions and Cloudflare, and prove everything runs locally. Called by /build for step 6.
---

# scaffold — generate the codebase

Nothing here is typed from memory. Every skeleton comes from a CLI, every dependency from `pnpm add`, every config template from `templates/` **after** checking what the CLI already produced. Before each CLI, run it with `--help` so you use its *current* flags — do not trust remembered ones.

**Versions:** load `.claude/skills/choosing-versions/SKILL.md` before section 1 and apply it throughout. Generators run at `@latest` (the stable channel), but after each one, check what it installed against the anchor pairs in that skill, and settle on the newest *stable, mutually supported* versions — not simply the newest. A version conflict is normally a decide-and-tell (`.claude/skills/explain-decisions/SKILL.md`); record every choice in the ADR's Versions table.

Work through the sections in order. Log each section's completion in `docs/PROGRESS.md` as a sub-entry of the `scaffold` step so an interrupted run resumes at the right section. Read `docs/ARCHITECTURE.md` for which apps to build and `.claude/state.json → apps`.

Project name: kebab-case from PRD title; used as `PROJECT_NAME` in templates and as the `@<project>/` package scope.

## 1. Monorepo root

```bash
corepack enable && corepack prepare pnpm@latest --activate   # or verify pnpm --version (pnpm's `latest` tag is its stable release)
pnpm init                                                    # only if no package.json yet
cp templates/pnpm-workspace.yaml ./
cp templates/turbo.json ./
cp templates/nvmrc .nvmrc
pnpm add -D -w turbo typescript prettier prettier-plugin-tailwindcss   # check typescript against typescript-eslint's peer range first; pin the major (e.g. typescript@^6) if needed
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

- `pnpm --filter api add @supabase/supabase-js zod @hono/zod-validator` and `pnpm --filter api add -D wrangler vitest @cloudflare/vitest-pool-workers` (check each package still exists and is the current recommendation with `npm view <pkg>`, and that the versions agree per `choosing-versions`).
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

## 4b. Installable web app (if ARCHITECTURE.md says PWA: Yes)

Load `.claude/skills/pwa/SKILL.md` and work through it for `apps/web`. Do this now, before the first deploy, so the very first installed copy already has the update prompt. The on-phone checks in its §9 happen after section 8 below, once there's a live URL.

## 5. Website — `apps/site` (if chosen)

```bash
pnpm create astro@latest apps/site   # minimal/empty template, TypeScript strict
pnpm --filter site exec astro add tailwind
pnpm --filter site exec astro add cloudflare   # check: current adapter may generate wrangler config itself
```

Wire the design-system preset into the Tailwind config; import `tokens.css` in the base layout. Copy `templates/wrangler.site.jsonc` only if the adapter didn't create one; otherwise merge the `name`. Build the landing hero from the style guide. Favicons + apple-touch-icon from the design-system icon (pwa skill §2, icons only; no service worker on the site). `.env` from the site section. Prove: `pnpm --filter site dev`.

## 6. Mobile — `apps/mobile` (only if ARCHITECTURE.md passed the gate)

First check tooling the setup step skipped: `xcode-select -p` (macOS, iOS), Android Studio + `adb`, `pnpm dlx eas-cli --version`, Expo account (`eas login`). Missing → `docs/GETTING-SET-UP.md → Mobile`, with the steps inline per `guide-owner` (Expo signup link; Apple/Google accounts only when releasing), and wait.

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

## 7b. UX foundations (web, and mobile if chosen)

Every feature relies on these, so build them once here using `.claude/skills/ux/SKILL.md` and its helper skills:

- ESLint `jsx-a11y` is on (installed with the other plugins in §1).
- In `AppShell`: `SkipLink`, the `Announcer` live region, the toast region, focus-and-title handling on route change (`accessibility` §5), the offline banner and the app-level error boundary (`error-states` §3).
- Auth bootstrap splash so neither the sign-in screen nor protected content flashes (`loading-states` §2).
- `lib/error-messages.ts` covering the `ErrorCode` values the API has so far, with `ErrorCode` exported from `@<project>/api-types`.
- `components/composed/AsyncRegion.tsx` and `lib/useDelayedFlag.ts` (`loading-states` §4).
- `MotionConfig reducedMotion="user"` at the root if a motion library was chosen; the View Transitions route cross-fade (`motion` §5).
- Playwright: `pnpm --filter web add -D @axe-core/playwright` and `e2e/a11y.spec.ts` scanning the sign-in screen and the empty shell. Check the package and API are current first (`choosing-versions`).
- `docs/ACCESSIBILITY.md` exists (created in design-system); add the "Last checked" line after verification.

## 8. GitHub + Cloudflare

- `git init` if needed, `.gitignore` present, initial commit `chore(scaffold): generate monorepo`.
Everything in this section that the owner does in a browser follows `.claude/skills/guide-owner/SKILL.md` — one task at a time, direct links with their real ids, exact button labels, verified from the terminal afterwards.

- `gh repo create <project> --private --source . --push` (ask the owner: private or public — recommend private — and confirm the GitHub account from `gh auth status`).
- Copy `templates/github-workflows/ci.yml` and `deploy.yml` to `.github/workflows/`; delete the `deploy-site` job if no site; mobile is never deployed from Actions. `deploy.yml` doesn't run migrations — it waits for the Supabase GitHub integration's check (below) before deploying Workers.
- Cloudflare: `wrangler whoami` for account id. For each app: `pnpm --filter <app> exec wrangler deploy` once, manually, so the Workers exist and the owner sees a live URL. Then the api's Worker secrets (`wrangler secret put SUPABASE_SERVICE_ROLE_KEY` etc.) using the **hosted** Supabase project's values — the owner runs these in their own terminal (guide-owner §2); confirm with `wrangler secret list`.
- Hosted Supabase: the owner creates the project in the dashboard (guide-owner: new-project link, which organisation, project name, a generated database password saved in their password manager *before* clicking create, region nearest their users, free plan). Then `supabase link --project-ref …` (for type generation and advisors — **not** for pushing migrations). Set the hosted project's auth `site_url` and redirect URLs to the web Worker URL in the dashboard: the integration does not deploy auth settings from `config.toml`.
- **Supabase ↔ GitHub (the default way migrations reach production).** Guide the owner through connecting it: Project Settings → Integrations (`https://supabase.com/dashboard/project/<ref>/settings/integrations`) → **Authorize GitHub** → choose the repo → **Working directory** `.` (the folder that contains `supabase/`) → production branch `main` → **Deploy to production** on → **Automatic branching** off (preview databases are a paid feature and would be a staging environment, which the kit doesn't use) → **Enable integration**. Check the current docs for the labels first (`https://supabase.com/docs/guides/deployment/branching/github-integration`). From then on, a push to `main` applies new migration files (and storage buckets declared in `config.toml`); seed data never reaches production. Verify after the first push: the commit shows a Supabase check (`gh api repos/<owner>/<repo>/commits/<sha>/check-runs` and `/status`), and `supabase migration list --linked` shows local and remote in step. Tighten the check-name filter in `deploy.yml`'s `wait-for-supabase` job to the real name you see. If the integration truly can't be connected (e.g. an organisation policy blocks the GitHub app), use the commented CLI `migrate` job in `deploy.yml` instead and record why in an ADR.
- GitHub secrets: list every name from the comment at the top of `deploy.yml`; for each, send the owner to the exact page that shows the value (guide-owner §4 links) and have them run `gh secret set NAME` **in their own terminal window** so the value never enters the chat. Non-secret values (project ref, account id, URLs) you can set yourself, including the repository variable `gh variable set WEB_URL --body https://<web-host>` for the smoke job. Confirm with `gh secret list` and `gh variable list`.
- Push to `main`, watch `gh run watch`, confirm green.

## 9. Verification (full)

Load `.claude/skills/verification/SKILL.md` in **full** mode. Scaffold is where sign-in, the first tables and their RLS policies are created, so prove them now: route inventory, auth flows on the sign-in screen, the first version of the authorisation matrix test (`authz.matrix.test.ts`) with the seeded users, RLS checked directly, design system in sync, axe clean and keyboard-operable sign-in (§1.3). Fix every critical and high before the approval question. Set `state.verification`.

## 10. Documentation and hand-off

Load `.claude/skills/documentation/SKILL.md` and produce: root `README.md` (replace the template's — the project's own, with the live URLs), per-app READMEs, `docs/api.md`, and update `CLAUDE.md` if any path differs from the kit default. ADR `0001-scaffold.md` recording every CLI version used, a **Versions** table of key packages (with the reason and revisit condition for anything held back from its newest major), and any place a template was adapted. Confirm `pnpm install` shows no unmet peer-dependency warnings.

Seed `docs/BACKLOG.md` from the PRD's core flows (backlog skill §7). The first item is auth end-to-end. Record the first production deploy in `state.deploys` (items `["scaffold"]`) and run the release skill's post-deploy check (§3) against it.

Tell the owner, in plain words: the verification summary, the three URLs (api, web, site), how to run locally (`pnpm dev` + `supabase start`), that the next `build` starts feature F001 (auth end-to-end), and that from now on ideas go in `docs/BACKLOG.md` (they can add to it themselves).

Approval question from `/build`: **"Everything runs on your machine. Ready to start building features?"**

## When a CLI has changed

If a CLI's prompts or output differ from what this file describes, follow the CLI — it is the source of truth for *structure* (not for versions: if it pulls in a major its companions don't support, apply `choosing-versions`) — and note the difference in `docs/adr/0001-scaffold.md` and in PROGRESS so the kit author can update the template. Never fight the CLI's structure; adapt ours.
