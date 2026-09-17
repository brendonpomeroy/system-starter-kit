---
name: build
description: The one command the project owner runs. Resumable orchestrator that checks which required docs and artifacts exist, reports where the project is up to, and continues from the first incomplete step — setup, PRD, architecture, data model, design system, scaffold — then runs the ongoing cycle: features, small changes, bugs, releases with post-deploy checks, maintenance and the backlog. Use whenever the owner types "build", asks to continue, asks where things are at, asks for a new feature or change, reports a bug, wants to deploy, or asks what's next.
---

# /build — the resumable orchestrator

You are driving a non-developer's project from an empty template to a deployed app. This skill is a **state machine**, not a script. Every time it runs it (1) reads the state, (2) reports, (3) does exactly one step, or one stage of one item (feature, change, bug, release, maintenance), (4) records what it did, (5) tells the owner what happens next.

Speak plainly. One idea per sentence. Before each step say what you're about to do and roughly how long it takes. Never assume the owner knows what a "migration", "token" or "route" is — define it the first time in a project.

Whenever a step or stage needs the owner to make a technical choice, or you made one on their behalf, follow `.claude/skills/explain-decisions/SKILL.md`: most technical choices are yours to make and mention in one line; when you do ask, recommend an option and explain why in terms of their project. Never hand them a bare "A or B?".

Whenever the owner has to do something outside the terminal — create an account or project, copy a key, change a dashboard setting, try something on their phone — follow `.claude/skills/guide-owner/SKILL.md`: direct link with their real ids filled in, numbered steps with exact button labels, what success looks like, secrets typed into their own terminal (never the chat), then verify from the terminal.

## 0. Load state

Read, in this order:

1. `.claude/state.json` — the machine state. If missing or unparsable, stop and tell the owner the template is damaged; offer to recreate it from `.claude/state.schema.json` defaults. If it parses but lacks keys the schema now has (`changes`, `deploys`, `maintenance`, `preferences`), add them with their defaults, and add `docs/BACKLOG.md` if it's missing (backlog skill §7). Say so in one line.
2. `docs/PROGRESS.md` — the human log. Cross-check: the last entry should agree with `state.json`. If they disagree, trust the artifacts on disk, fix both files, and say so.
3. `CLAUDE.md` — the rules.
4. After scaffold: `docs/BACKLOG.md` and `git branch --show-current`. An in-progress item should be on its own branch (§3).

Then run the **gate check**: for each fixed step in order, does its artifact exist, and what does state say?

| Artifact on disk | state.status | Action |
|---|---|---|
| missing | pending | This is the current step. Run it. |
| missing | started / completed | Something was deleted. Tell the owner, set status back to `pending`, run it. |
| present | pending | Someone made it by hand. Ask: "Shall I review and approve this, or redo it with you?" |
| present | started | Work was interrupted. Show the owner what's there and ask: resume or redo? |
| present | completed, hash matches | Skip. |
| present | completed, hash differs | Work out who changed it (below) before doing anything. |

Hashes: `artifactHashes[step]` is the sha256 of the artifact as last approved or last updated by `/build`. Compute with `shasum -a 256 <file>` (or `sha256sum`). Only the four documents are hashed: `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `docs/style-guide.html`. The `scaffold` artifact (`apps/`) changes with every feature by design, so it's checked for existence only.

**Approved docs keep changing after approval, and that's expected.** Features add migrations (→ DATA-MODEL), new features are added to the PRD's "Added later", design-compliance updates a mock in the style guide, and the pwa feature edits ARCHITECTURE. **Whenever `/build` or a skill it runs edits one of the four documents, re-hash it in the same commit**: update `artifactHashes[step]`, and add `Rehashed: docs/DATA-MODEL.md (F004 — projects.archived_at)` to that stage's PROGRESS entry.

**When a hash differs**, find out who changed it:

1. `git log -1 --format='%h %s' -- <file>` and `git status --short -- <file>`. If the last change is committed, the commit is a `/build` commit (`<type>(<F|C|B>NNN|build|maintenance|backlog): …`, or a `Merge F00N/C00N/B00N` merge commit), and that item's PROGRESS entries mention the file, then `/build` edited it and the rehash was missed. Rehash, log one line, carry on without bothering the owner.
2. Otherwise **the owner edited it**. Show them a plain summary of `git diff` for that file (uncommitted) or of the commit, then:
   - **Before scaffold is completed:** mark it and every later fixed step `stale`; ask whether to re-approve as-is (rehash) or re-run dependents. (Unchanged kit behaviour.)
   - **After scaffold:** sort the edit. New wishes added to the PRD → backlog items (backlog skill), then rehash. Wording or clarification → rehash. A real change of direction (different apps, auth model, who-can-see-what, brand) → that's a **redo** of that step: explain what it touches and ask. Only a redo marks anything `stale`. Always confirm your reading of the edit with the owner in one question before rehashing.

The `setup` step has no artifact; re-verify it silently on every run (it takes seconds) and only speak if something is missing.

## 1. Report

Always begin with a short status block the owner can read in ten seconds:

```
Project: <name or "not named yet">
Done:    setup, PRD, architecture
Now:     data model (started yesterday, not yet approved)
Next:    design system → scaffold → first feature
Apps:    api ✓  web ✓ (installable)  site ✗  mobile ✗ (decided in ARCHITECTURE.md)
Bugs:    B002 open (diagnose) — only shown if any bug isn't done
```

After scaffold, the block describes the cycle instead of the steps:

```
Project: <name>
Working on: F009 Export projects to Excel (build stage)  |  nothing in progress
Live:       deployed 2026-09-15 (F008, C003) · checked ✓   |  F008 done, not live yet
Up next:    I015 Dark mode (backlog: 4 in Next, 7 ideas)
Health:     maintenance due (last run 34 days ago) · security check ✓ 2026-09-01
Bugs:       B002 open (diagnose) — only if any
```

If the owner asked for something specific ("add a login page", "change the colours", "saving is broken"), map it to a step, feature, change, bug or other entry using the table in §2 "After scaffold", and say which one you'll run. If they asked for something that belongs to a completed fixed step (e.g. "change the colours" → design-system), that's a **redo**, which needs an explicit yes and marks downstream steps `stale`.

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

Check each tool with a real command and record the version. Missing → point the owner at the exact section of `docs/GETTING-SET-UP.md` (with the steps from that section inline, per `guide-owner`), wait, re-check.

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

### After scaffold: the cycle

Once `scaffold` is approved there are no more fixed steps. The project becomes a loop: **pick → build → check → release → learn → pick**. `docs/BACKLOG.md` holds everything waiting, and each run does one item or one stage of one item.

**What the owner asked for → what runs:**

| Owner says | Entry | Skill |
|---|---|---|
| a new capability ("add export to Excel") | **feature** `F00N`. If something else is in progress, capture it and finish the current item first, unless they say it's more urgent. | feature loop below |
| a small tweak to something that exists ("make the button say Save", "this page is slow", "tidy this up") | **change** `C00N` (escalates to a feature if it outgrows the limits) | change track below |
| something is broken, wrong or odd | **bug** `B00N` | `debugging` |
| "later", "one day", an idea, forwarded user feedback | **backlog capture** only | `backlog` §2 |
| "what's next?", "let's plan", "reorder" | **backlog review** | `backlog` §3, §5 |
| "put it live", "deploy" | **release** | `release` |
| production broke after a deploy | **release §5** (rollback decision), then a bug | `release`, `debugging` |
| "update things", "keep it healthy" | **maintenance** | `maintenance` |
| "is it secure?" | **verification (full)** | `verification` |
| change the look, the data model or the apps | **redo** of that fixed step | see "Redo, stale and rollback" |

**The owner just typed `build`:** stop at the first match and say why.

1. An item is `started` (feature, change, bug, maintenance) → resume it at its stage.
2. The last deploy is `deploying`, `failed`, or `postDeployCheck` is `pending`/`failed` → finish that in `release`.
3. Open critical or high verification findings → fix them (a bug if it's in shipped code, otherwise a change).
4. Items at `done` that aren't live yet (not listed in any `live` entry of `state.deploys`; their branch still exists unmerged) → offer `release`.
5. Maintenance is due and not deferred (`maintenance` §0) → offer it. The owner can say "not now".
6. Otherwise → `backlog` §3: recommend one item, and the owner confirms or picks another. An empty backlog → ask what they'd like next and capture it.

### Feature loop (after step 6)

A feature is a vertical slice the owner can see and use: "sign in and see an empty dashboard", "create and list projects", "invite a teammate". Each gets an id `F001`, `F002`, … in `state.features` and a heading in PROGRESS.

Stages, in order, each loading its skill and logging its start and finish:

| Stage | Skill | Output |
|---|---|---|
| `breakdown` | `.claude/skills/component-breakdown/SKILL.md` | a short plan: screens, components by tier, API routes, DB changes — shown to the owner before building |
| `state` | `.claude/skills/state-management/SKILL.md` | the data-flow decision for this feature, per app |
| `ux` | `.claude/skills/ux/SKILL.md` Part A (loads `accessibility`, `loading-states`, `error-states`, `motion` as needed) | the screen state map (loading, empty, error, success, transitions, focus) for every screen and action; UX choices the owner needs to make (undo vs confirm, autosave, accessibility trade-offs); breakdown updated if a choice changes the data model |
| `build` | (implement) `CLAUDE.md` rules + the plans above, including every state in the ux plan; migrations must work with the code already live (add first, remove in a later feature — Supabase applies them on push to `main` alongside the Workers deploy); `.claude/skills/choosing-versions/SKILL.md` for any new or upgraded dependency | migrations via Supabase CLI, API routes with Zod, UI from design-system components |
| `quality` | `.claude/skills/code-quality/SKILL.md` | lint, typecheck, tests passing; smoke test updated if this is the critical path |
| `compliance` | `.claude/skills/design-compliance/SKILL.md` + `.claude/skills/ux/SKILL.md` Part B | checklist walked, lint clean, no raw elements; every planned state forced and checked; accessibility walk done (axe clean or owner-accepted exceptions in `docs/ACCESSIBILITY.md`) |
| `verify` | `.claude/skills/verification/SKILL.md` (independent subagent where possible; **scoped** or **full** per its §0) | design system intact; security audit — route inventory, auth flows, authorisation/tenant matrix test, RLS, common vulns, PII in logs; report in `docs/verification/`; no open critical/high |
| `docs` | `.claude/skills/documentation/SKILL.md` | READMEs, `docs/api.md`, ADR if a non-obvious choice was made, PROGRESS entry |

When a feature reaches `done`, run the app locally, tell the owner exactly what to click to see it, commit on its branch with `feat(F00N): <title>`, and move its backlog item to `Done`. Then hand over to `.claude/skills/release/SKILL.md`: it owns the **deploy gate** (never deploy while `state.verification.openFindings` has any critical or high, or before a full verification has ever passed), merging to `main`, the post-deploy check on production, and rollback. Aim to release a finished item before starting the next one, so each deploy stays small and easy to undo.

Where do features come from? From `docs/BACKLOG.md` (`.claude/skills/backlog/SKILL.md`). At the end of scaffold it's seeded with the PRD's "Core flows", in order. The first feature is always **auth + an empty authenticated shell** because everything else sits on it. After that, the backlog skill recommends the next item and the owner confirms or picks another. When a feature's breakdown is approved, add it to the PRD's "Added later" section (and rehash, §0).

Things noticed mid-feature that aren't part of the plan (a tidy-up, a slow query, an idea) are captured in the backlog in one line. They're never slipped into the current feature.

If the owner asks to make an existing web app installable ("can people put it on their home screen?"), that's a feature, not a redo of `architecture`: update ARCHITECTURE.md's PWA row and `state.apps.pwa`, then run the feature with `.claude/skills/pwa/SKILL.md` as the `build` stage's plan.

If the owner interrupts mid-feature, the feature stays `started` at its current `stage`; next run resumes from that stage.

### Change track

Most work on a live product isn't a new feature. It's wording, spacing, a slow page, a refactor, a dependency bump, a small security fix. Running eight stages for that is too heavy, and a process that feels heavy gets skipped. A **change** is the light path: id `C001`, `C002`, … in `state.changes`, a `# C00N — <title>` heading in PROGRESS, branch `c00n-<slug>`.

**Only for small work.** It becomes a feature (status `escalated`, `escalatedTo: "F00N"`, start the feature at `breakdown`, reusing what's done) as soon as it needs any of:

- a migration, a new table or column, or an RLS policy change;
- a new API route, or a change to who can call one (auth, roles, tenancy);
- a new screen or route in an app, or a new primitive in the design system;
- a `state-management` decision (new cache, realtime, offline);
- a new dependency, or a major upgrade (`choosing-versions`);
- more than about a session of work.

Say so in one line when it escalates: "This needs a database change, so I'm treating it as a full feature (F010). It adds a planning step and a security check."

Stages, each logged:

| Stage | What |
|---|---|
| `plan` | Three lines for the owner: what will change, where, how they'll see it. Files touched. Check against the limits above. No separate approval for S-sized changes the owner asked for in those exact words; otherwise wait for a yes. |
| `build` | Implement. Same `CLAUDE.md` rules. Refactors keep behaviour identical: existing tests pass untouched, and a missing test for the code being moved gets written *first*. |
| `quality` | `code-quality`: lint, typecheck, all tests, build. `design-compliance` checklist and `ux` Part B too, if any screen changed (its mechanical half always runs). A change that alters loading, error or empty behaviour updates that screen's state map first. |
| `verify` | `verification` **scoped** to the diff (plus its project-wide scans). If the diff touches anything in verification §0's full list, the change should already have escalated. Stop and escalate. |
| `docs` | Only what the change made untrue: README, `docs/api.md`, an ADR if a non-obvious choice was made. Most changes need just the PROGRESS entry. |
| `done` | Commit `<type>(C00N): <what>`, where the type is `fix`, `refactor`, `perf`, `style`, `chore` or `feat` for a small visible tweak. Backlog item → `Done`. Then `release`, same as a feature. |

Changes don't count toward `verification.featuresSinceFull`.

### Bugs

If the owner reports something broken, wrong, slow or odd ("saving doesn't work", "my list is empty", "it logged me out"), that's a **bug**, not a feature and not a redo. Run `.claude/skills/debugging/SKILL.md`. It gets an id `B001`, `B002`, … in `state.bugs`, a notebook in `docs/bugs/` and a `# B00N — <title>` heading in PROGRESS. Its stages are `intake → reproduce → diagnose → fix → verify → done`. No code changes before `diagnose` is complete and the root cause is proven. The `fix` stage uses the same checks as a feature (`code-quality`, `design-compliance` if a screen changed, `verification` scoped or full, `documentation`). Work on branch `b00n-<slug>`, commit with `fix(B00N): <what was wrong>`, then `release` (same deploy gate). An urgent bug may interrupt a feature or change in progress: commit the current item's work on its branch first (`wip(F00N): <stage>`), then branch the fix from `main`. If the investigation shows the app does what was agreed and the owner wants something different, close the bug as `not-a-bug` and start a feature instead.

If a step or stage fails for a reason that isn't obvious (a test that should pass, a deploy error, a verification check), use the same skill's method (reproduce, locate, hypotheses, prove) before changing anything. It doesn't need its own bug id unless it turns out to be a real defect in shipped code.

If a bug is interrupted it stays at its current `stage`; next run resumes from there, starting by re-reading its notebook.

### Security checks

If the owner asks "is it secure?" or for a security or design check outside a feature, run `verification` in **full** mode as its own entry (`## <date> — verification (full)`), not as a feature. Findings it doesn't fix straight away go to the backlog (medium → Next, low → Later).

### Release, maintenance and backlog

- **Release** (`.claude/skills/release/SKILL.md`): after any item reaches `done`, when the owner asks to deploy, or when production breaks after a deploy. Records to `state.deploys`.
- **Maintenance** (`.claude/skills/maintenance/SKILL.md`): offered when due (`state.maintenance`), or when the owner asks. Branch `maint-YYYY-MM-DD`, released like a change.
- **Backlog** (`.claude/skills/backlog/SKILL.md`): every "later", follow-up and idea from any skill lands in `docs/BACKLOG.md`. It recommends the next item, and reviews the list with the owner every ~5 completed items or when the list gets long.

## 3. Record

After every step or stage, and before telling the owner you're done:

1. Update `.claude/state.json` (status, timestamps, stage). If this stage edited PRD, ARCHITECTURE, DATA-MODEL or the style guide, re-hash it (§0) and note `Rehashed:` in the entry.
2. Append to `docs/PROGRESS.md` using the entry format documented at the top of that file. Include: what was done, what was decided, what the owner should look at, what's next.
3. Update `docs/BACKLOG.md` if anything was captured, started or finished.
4. `git add -A && git commit` with a conventional message.

**Branches.** Fixed steps 1–6 commit straight to `main`: nothing deploys from it until scaffold sets up Actions. After scaffold, **a push to `main` is a production deploy**, so every feature, change, bug and maintenance run works on its own branch (`f009-export-projects`, `c004-save-label`, `b002-empty-list`, `maint-2026-10-01`), created from an up-to-date `main` when the item starts. Stage commits go there. Pushing the branch is safe (CI runs, nothing deploys). Push if `origin` exists and `state.preferences.push` is `true` (ask once and record it). Only `release` merges into `main`.

Never leave state and log out of sync. If a tool call fails midway, record the failure in PROGRESS with the error text so the next run can pick it up.

## 4. Hand back

End every run with:

```
Done this run: <one line>
You can check:  <a URL, a file to open, or a thing to click>
Next time you type build: <one line>
```

## Redo, stale and rollback

- **Redo a completed fixed step**: needs explicit yes. Mark it and all later fixed steps `stale`. Features are *not* deleted, but the owner is warned that a redo of `design-system` or `data-model` may require touching existing features. Add those as backlog items `reconcile <thing>` in `Now`.
- **Abandon a feature or change**: set `status: abandoned`, keep its PROGRESS entries, and move its backlog item to `Done` as `abandoned <date> — <reason>` (or back to `Later` if the owner may return to it). Unreleased work lives only on its branch: ask before deleting the branch. Released work is removed with `git revert` through a new change.
- **Roll back production**: `.claude/skills/release/SKILL.md` §5. Workers are rolled back and `main` is reverted to match. The database is never rolled back. It's repaired forward with a new migration.
- **Never** silently delete generated apps, drop tables, or reset the local DB without asking. `supabase db reset` is fine during scaffold (empty DB); afterwards it wipes local data, so ask.

## Things you must never do inside /build

- Hand-write an app skeleton or `package.json` that a CLI can generate (see `scaffold`).
- Skip a fixed step because "it's obvious". The docs are the contract with the owner.
- Advance without the owner's yes.
- Mark a feature `done`, or deploy, with an open critical or high verification finding.
- After scaffold, commit or push unfinished work to `main`. Only `release` merges into `main`.
- Start unplanned work in the middle of an item. Capture it in the backlog instead.
- Edit an approved planning doc without rehashing it in the same commit.
- Change code to fix a reported bug before reproducing it and proving the root cause (see `debugging`).
- Ask the owner to paste a secret into the chat.
- Invent a staging environment.
- Use `any`, arbitrary Tailwind values, or raw `<button>`/`<input>` in app code.
- Ship a screen with a blank loading state, a vague or vanishing error, or animation that ignores Reduce motion (see `ux`).
- Quietly make the app less accessible. Accessibility trade-offs are the owner's call, made knowingly and recorded in `docs/ACCESSIBILITY.md` (see `accessibility`).
- Install a pre-release, or a new major its companion tools don't support yet, without the owner's informed yes (see `choosing-versions`).
- Leave PROGRESS.md unchanged after doing work.
