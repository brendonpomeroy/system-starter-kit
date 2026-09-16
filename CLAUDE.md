# CLAUDE.md — project map and rules

This repository was created from the **System Starter Kit**. The owner is very likely a non-developer. Speak plainly, explain what you are about to do before doing it, and never assume they know a term. **Before asking the owner any question with technical content — or reporting a technical choice made for them — follow `.claude/skills/explain-decisions/SKILL.md`**: decide it yourself where a professional clearly would, otherwise lead with a recommendation and explain the trade-off in terms they care about (will it break, cost, data safety, how hard to undo). **Whenever the owner has to do something outside the terminal** (Supabase, Cloudflare, GitHub, Expo, app stores, their phone), follow `.claude/skills/guide-owner/SKILL.md`: a direct link filled in with their real ids, click-by-click steps with the exact button labels, what success looks like, and secrets entered in their own terminal — never pasted into chat.

## The one entry point

The owner types `build`. That invokes `.claude/skills/build/SKILL.md`, a resumable orchestrator. It reads `.claude/state.json` and `docs/PROGRESS.md`, reports where the project is, and continues from the first incomplete step. **If the owner asks for anything that changes the app, route it through `/build`** so the log and state stay truthful. Do not free-hand features outside the feature loop. When the owner reports something broken, `/build` runs `.claude/skills/debugging/SKILL.md`: reproduce and prove the root cause before changing code.

## Fixed step order (do not reorder)

1. `setup` — verify tools on this machine (`.claude/skills/build` → setup section)
2. `prd` — `docs/PRD.md` (`.claude/skills/plan`)
3. `architecture` — `docs/ARCHITECTURE.md` (`.claude/skills/plan`)
4. `data-model` — `docs/DATA-MODEL.md` (`.claude/skills/plan`)
5. `design-system` — `packages/design-system` + `docs/style-guide.html` (`.claude/skills/design-system`)
6. `scaffold` — generate the chosen apps (`.claude/skills/scaffold`)
7. `features` — the open-ended loop; each feature runs `component-breakdown → state-management → build → code-quality → design-compliance → verification → documentation`. Verification (design system + security audit) also runs in full at the end of `scaffold`, and critical/high findings block `done` and every production deploy

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
docs/              PRD, ARCHITECTURE, DATA-MODEL, style-guide.html, PROGRESS, adr/, api.md, verification/ (audit reports), bugs/ (investigation notebooks)
templates/         files the scaffold step copies; do not edit after scaffolding, edit the copies
```

## Non-negotiable rules

- **Generate with the official CLI.** Never hand-write a `package.json`, `tsconfig`, or app skeleton that a CLI can create. Before running a CLI, run `<cli> --help` (or `npx <cli>@latest --help`) so you use *current* flags, not remembered ones.
- **Stable, not bleeding edge.** Use the newest *stable* version that the rest of the stack already supports — no pre-releases, no new major that its companion tools (ESLint plugins, Vite plugins, test runners, the Expo SDK) don't support yet. Check live with `npm view`, never from memory. See `.claude/skills/choosing-versions/SKILL.md`.
- **Add dependencies with `pnpm add`** (and `pnpm add -D`) in the correct workspace (`pnpm --filter <app> add …`). Never edit dependency lists by hand.
- **Migrations only via Supabase CLI.** `supabase migration new <name>`, then edit the generated SQL. Never modify the hosted database directly.
- **Production migrations deploy through Supabase's GitHub integration** ("Deploy to production" on `main`, automatic branching off). Don't `supabase db push` to production by hand. Because migrations and the Workers deploy start from the same push, every migration must be backwards compatible with the code already live: add columns or tables first, and remove old ones in a later change.
- **TypeScript strict. No `any`.** If you need an escape hatch, write `unknown` and narrow it.
- **Design tokens only.** No arbitrary Tailwind values (`text-[#333]`, `p-[13px]`). No raw hex, px or rgb in component code. The ESLint config enforces this; do not disable the rule.
- **Every route in `apps/api` has a Zod validator** and is reachable via the typed `hc` client. No untyped `fetch` in app code.
- **Two environments.** Local (Supabase CLI + `wrangler dev`) and production. Do not invent staging.
- **Secrets never in git.** `.env*` files are ignored. Production secrets live in `wrangler secret` and GitHub Actions secrets.
- **Log everything.** Start and finish of every step goes in `docs/PROGRESS.md`. Non-obvious decisions get an ADR in `docs/adr/`.
- **Security is verified, not assumed.** Every API route is authenticated or listed as deliberately public; identity comes only from the verified token; every table has RLS; tenant isolation is proven by the committed authorisation matrix test; no PII, tokens or request bodies in logs, client or server. See `.claude/skills/verification/SKILL.md`.
- **Bugs are diagnosed, not guessed.** No fix without a reproduction and a proven root cause; the owner's explanation is a hypothesis to test. Capture client↔server traffic with tests, not devtools screenshots. Every fix lands with a regression test and no leftover debug logs. See `.claude/skills/debugging/SKILL.md`.
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
| verification | `.claude/skills/verification/SKILL.md` | build (feature loop, scoped or full) · scaffold (full) · owner asks for a security check |
| documentation | `.claude/skills/documentation/SKILL.md` | build (feature loop + after scaffold) |
| debugging | `.claude/skills/debugging/SKILL.md` | build (owner reports a bug) · any skill when a test, deploy or check fails for a non-obvious reason |
| pwa (helper) | `.claude/skills/pwa/SKILL.md` | scaffold (if installable) · build (feature "make it installable") |
| choosing-versions (helper) | `.claude/skills/choosing-versions/SKILL.md` | scaffold · build (any feature that adds or upgrades a dependency) |
| guide-owner (helper) | `.claude/skills/guide-owner/SKILL.md` | every skill, whenever the owner must act in a browser, dashboard or on a device |
| explain-decisions (helper) | `.claude/skills/explain-decisions/SKILL.md` | every skill, whenever the owner is asked a technical question |

## Commands (after scaffolding)

```
pnpm dev            # everything locally (turbo)
pnpm --filter api dev
pnpm --filter web dev
pnpm lint / pnpm typecheck / pnpm test
supabase start | supabase db reset | supabase migration new <name>   # production: push to main (GitHub integration)
pnpm --filter <app> exec wrangler deploy
```
