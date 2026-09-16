---
name: build
description: The one command the project owner runs. Resumable orchestrator that checks which required docs and artifacts exist, reports where the project is up to, and continues from the first incomplete step — setup, PRD, architecture, data model, design system, scaffold, then the feature loop. Use whenever the owner types "build", asks to continue, asks where things are at, or asks for a new feature or change.
---

# /build — the resumable orchestrator

You are driving a non-developer's project from an empty template to a deployed app. This skill is a **state machine**, not a script. Every time it runs it (1) reads the state, (2) reports, (3) does exactly one step or one feature stage, (4) records what it did, (5) tells the owner what happens next.

Speak plainly. One idea per sentence. Before each step say what you're about to do and roughly how long it takes. Never assume the owner knows what a "migration", "token" or "route" is — define it the first time in a project.

## 0. Load state

Read, in this order:

1. `.claude/state.json` — the machine state. If missing or unparsable, stop and tell the owner the template is damaged; offer to recreate it from `.claude/state.schema.json` defaults.
2. `docs/PROGRESS.md` — the human log. Cross-check: the last entry should agree with `state.json`. If they disagree, trust the artifacts on disk, fix both files, and say so.
3. `CLAUDE.md` — the rules.

Then run the **gate check**: for each fixed step in order, does its artifact exist, and what does state say?

| Artifact on disk | state.status | Action |
|---|---|---|
| missing | pending | This is the current step. Run it. |
| missing | started / completed | Something was deleted. Tell the owner, set status back to `pending`, run it. |
| present | pending | Someone made it by hand. Ask: "Shall I review and approve this, or redo it with you?" |
| present | started | Work was interrupted. Show the owner what's there and ask: resume or redo? |
| present | completed, hash matches | Skip. |
| present | completed, hash differs | The owner edited an approved doc. Mark it and every later step `stale`; ask whether to re-approve as-is (rehash) or re-run dependents. |

Hashes: `artifactHashes[step]` is the sha256 of the artifact at approval time. Compute with `shasum -a 256 <file>` (or `sha256sum`).

The `setup` step has no artifact; re-verify it silently on every run (it takes seconds) and only speak if something is missing.

## 1. Report

Always begin with a short status block the owner can read in ten seconds:

```
Project: <name or "not named yet">
Done:    setup, PRD, architecture
Now:     data model (started yesterday, not yet approved)
Next:    design system → scaffold → first feature
Apps:    api ✓  web ✓ (installable)  site ✗  mobile ✗ (decided in ARCHITECTURE.md)
```

If the owner asked for something specific ("add a login page", "change the colours"), map it to a step or a feature and say which one you'll run. If they asked for something that belongs to a completed fixed step (e.g. "change the colours" → design-system), that's a **redo**, which needs an explicit yes and marks downstream steps `stale`.

## 2. Run exactly one step

### Fixed steps

| # | id | Skill to load | Artifact | Approval prompt |
|---|---|---|---|---|
| 1 | `setup` | this file, §setup | — | none (auto) |
| 2 | `prd` | `.claude/skills/plan/SKILL.md` → PRD section | `docs/PRD.md` | "Does this describe what you want to build?" |
| 3 | `architecture` | `.claude/skills/plan/SKILL.md` → Architecture section | `docs/ARCHITECTURE.md` | "Happy with which pieces we're building and why?" |
| 4 | `data-model` | `.claude/skills/plan/SKILL.md` → Data model section | `docs/DATA-MODEL.md` | "Does this cover everything the app needs to remember?" |
| 5 | `design-system` | `.claude/skills/design-system/SKILL.md` | `docs/style-guide.html` + `packages/design-system` | "Open the style guide in your browser. Does it look like your brand?" |
| 6 | `scaffold` | `.claude/skills/scaffold/SKILL.md` | `apps/*`, `packages/*`, `supabase/` running locally | "Everything runs on your machine. Ready to start building features?" |

Approval is a literal yes from the owner. On yes: set `completedAt`, hash the artifact, log to PROGRESS, commit to git with message `chore(build): approve <step>`. On no: iterate within the step; never advance.

### setup (step 1) — verify, don't assume

Check each tool with a real command and record the version. Missing → point the owner at the exact section of `docs/GETTING-SET-UP.md`, wait, re-check.

```
node --version          # must be an LTS version (see templates/nvmrc)
pnpm --version
git --version && gh auth status
docker info             # Supabase local needs Docker running, not just installed
supabase --version
pnpm dlx wrangler --version   # or `wrangler --version` if installed globally
```

Also verify: `gh auth status` succeeds, `wrangler whoami` succeeds (Cloudflare login), and the repo has an `origin` remote on GitHub. Mobile tooling (Xcode / Android Studio / EAS CLI) is checked later, only if `architecture` chooses mobile.

Record versions in `docs/PROGRESS.md` under the setup entry so future debugging has them.

### Feature loop (after step 6)

A feature is a vertical slice the owner can see and use: "sign in and see an empty dashboard", "create and list projects", "invite a teammate". Each gets an id `F001`, `F002`, … in `state.features` and a heading in PROGRESS.

Stages, in order, each loading its skill and logging its start and finish:

| Stage | Skill | Output |
|---|---|---|
| `breakdown` | `.claude/skills/component-breakdown/SKILL.md` | a short plan: screens, components by tier, API routes, DB changes — shown to the owner before building |
| `state` | `.claude/skills/state-management/SKILL.md` | the data-flow decision for this feature, per app |
| `build` | (implement) `CLAUDE.md` rules + the plan above | migrations via Supabase CLI, API routes with Zod, UI from design-system components |
| `quality` | `.claude/skills/code-quality/SKILL.md` | lint, typecheck, tests passing; smoke test updated if this is the critical path |
| `compliance` | `.claude/skills/design-compliance/SKILL.md` | checklist walked, lint clean, no raw elements |
| `docs` | `.claude/skills/documentation/SKILL.md` | READMEs, `docs/api.md`, ADR if a non-obvious choice was made, PROGRESS entry |

When a feature reaches `done`, run the app locally, tell the owner exactly what to click to see it, and ask whether to deploy (`pnpm exec wrangler deploy` per app, or push to `main` if Actions are configured) before starting the next feature. Commit at `done` with `feat(F00N): <title>`.

Where do features come from? First from `docs/PRD.md` → "Core flows", in order. The first feature is always **auth + an empty authenticated shell** because everything else sits on it. When the PRD's flows are exhausted, ask the owner what's next, and append it to the PRD under "Added later".

If the owner asks to make an existing web app installable ("can people put it on their home screen?"), that's a feature, not a redo of `architecture`: update ARCHITECTURE.md's PWA row and `state.apps.pwa`, then run the feature with `.claude/skills/pwa/SKILL.md` as the `build` stage's plan.

If the owner interrupts mid-feature, the feature stays `started` at its current `stage`; next run resumes from that stage.

## 3. Record

After every step or stage, and before telling the owner you're done:

1. Update `.claude/state.json` (status, timestamps, stage, hashes).
2. Append to `docs/PROGRESS.md` using the entry format documented at the top of that file. Include: what was done, what was decided, what the owner should look at, what's next.
3. `git add -A && git commit` with a conventional message. Push if `origin` exists and the owner has said pushing is fine (ask once, record the answer in PROGRESS).

Never leave state and log out of sync. If a tool call fails midway, record the failure in PROGRESS with the error text so the next run can pick it up.

## 4. Hand back

End every run with:

```
Done this run: <one line>
You can check:  <a URL, a file to open, or a thing to click>
Next time you type build: <one line>
```

## Redo, stale and rollback

- **Redo a completed fixed step**: needs explicit yes. Mark it and all later fixed steps `stale`. Features are *not* deleted, but the owner is warned that a redo of `design-system` or `data-model` may require touching existing features; log that as follow-up features `F0NN: reconcile <thing>`.
- **Abandon a feature**: set `status: abandoned`, keep its PROGRESS entries, `git revert` or branch-delete as appropriate, ask before deleting code.
- **Never** silently delete generated apps, drop tables, or reset the local DB without asking. `supabase db reset` is fine during scaffold (empty DB); afterwards it wipes local data, so ask.

## Things you must never do inside /build

- Hand-write an app skeleton or `package.json` that a CLI can generate (see `scaffold`).
- Skip a fixed step because "it's obvious". The docs are the contract with the owner.
- Advance without the owner's yes.
- Invent a staging environment.
- Use `any`, arbitrary Tailwind values, or raw `<button>`/`<input>` in app code.
- Leave PROGRESS.md unchanged after doing work.
