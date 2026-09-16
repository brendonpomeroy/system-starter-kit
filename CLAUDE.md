# CLAUDE.md — project map and rules

This repository was created from the **System Starter Kit**. The owner is very likely a non-developer. Speak plainly, explain what you are about to do before doing it, and never assume they know a term.

## The one entry point

The owner types `build`. That invokes `.claude/skills/build/SKILL.md`, a resumable orchestrator. It reads `.claude/state.json` and `docs/PROGRESS.md`, reports where the project is, and continues from the first incomplete step. **If the owner asks for anything that changes the app, route it through `/build`** so the log and state stay truthful. Do not free-hand features outside the feature loop.

## Fixed step order (do not reorder)

1. `setup` — verify tools on this machine (`.claude/skills/build` → setup section)
2. `prd` — `docs/PRD.md` (`.claude/skills/plan`)
3. `architecture` — `docs/ARCHITECTURE.md` (`.claude/skills/plan`)
4. `data-model` — `docs/DATA-MODEL.md` (`.claude/skills/plan`)
5. `design-system` — `packages/design-system` + `docs/style-guide.html` (`.claude/skills/design-system`)
6. `scaffold` — generate the chosen apps (`.claude/skills/scaffold`)
7. `features` — the open-ended loop; each feature runs `component-breakdown → state-management → build → code-quality → design-compliance → documentation`

Each fixed step ends with the owner explicitly approving the artifact. Record every step start/finish in `docs/PROGRESS.md` and `.claude/state.json`.

## Repository layout (after scaffolding)

```
apps/
  api/      Hono on Cloudflare Workers. Zod on every route. Exports AppType for the RPC client.
  web/      Vite + React. Talks to api via hc<AppType>. Deployed as a Worker with static assets.
  site/     Astro static site (optional). Deployed as a Worker with static assets.
  mobile/   Expo + Expo Router (optional, gated). EAS Build/Submit/Update.
packages/
  design-system/   tokens (source of truth) → tailwind preset + RN theme; primitive components (web + native)
  api-types/       re-exports AppType and shared Zod schemas
  config/          tsconfig base, eslint config, prettier config
supabase/          migrations, seed, config.toml (Supabase CLI owns this)
docs/              PRD, ARCHITECTURE, DATA-MODEL, style-guide.html, PROGRESS, adr/, api.md
templates/         files the scaffold step copies; do not edit after scaffolding, edit the copies
```

## Non-negotiable rules

- **Generate with the latest official CLI.** Never hand-write a `package.json`, `tsconfig`, or app skeleton that a CLI can create. Before running a CLI, run `<cli> --help` (or `npx <cli>@latest --help`) so you use *current* flags, not remembered ones.
- **Add dependencies with `pnpm add`** (and `pnpm add -D`) in the correct workspace (`pnpm --filter <app> add …`). Never edit dependency lists by hand.
- **Migrations only via Supabase CLI.** `supabase migration new <name>`, then edit the generated SQL. Never modify the hosted database directly.
- **TypeScript strict. No `any`.** If you need an escape hatch, write `unknown` and narrow it.
- **Design tokens only.** No arbitrary Tailwind values (`text-[#333]`, `p-[13px]`). No raw hex, px or rgb in component code. The ESLint config enforces this; do not disable the rule.
- **Every route in `apps/api` has a Zod validator** and is reachable via the typed `hc` client. No untyped `fetch` in app code.
- **Two environments.** Local (Supabase CLI + `wrangler dev`) and production. Do not invent staging.
- **Secrets never in git.** `.env*` files are ignored. Production secrets live in `wrangler secret` and GitHub Actions secrets.
- **Log everything.** Start and finish of every step goes in `docs/PROGRESS.md`. Non-obvious decisions get an ADR in `docs/adr/`.
- **Ask before destructive actions.** Deleting files, resetting the database, force-pushing, or re-running a completed step all need an explicit yes from the owner.

## Skill index

| Skill | Path | Called by |
|---|---|---|
| build (orchestrator) | `.claude/skills/build/SKILL.md` | the owner |
| plan | `.claude/skills/plan/SKILL.md` | build |
| design-system | `.claude/skills/design-system/SKILL.md` | build |
| scaffold | `.claude/skills/scaffold/SKILL.md` | build |
| component-breakdown | `.claude/skills/component-breakdown/SKILL.md` | build (feature loop) |
| state-management | `.claude/skills/state-management/SKILL.md` | build (feature loop) |
| code-quality | `.claude/skills/code-quality/SKILL.md` | build (feature loop) |
| design-compliance | `.claude/skills/design-compliance/SKILL.md` | build (feature loop) |
| documentation | `.claude/skills/documentation/SKILL.md` | build (feature loop + after scaffold) |
| pwa (helper) | `.claude/skills/pwa/SKILL.md` | scaffold (if installable) · build (feature "make it installable") |

## Commands (after scaffolding)

```
pnpm dev            # everything locally (turbo)
pnpm --filter api dev
pnpm --filter web dev
pnpm lint / pnpm typecheck / pnpm test
supabase start | supabase db reset | supabase migration new <name> | supabase db push
pnpm --filter <app> exec wrangler deploy
```
