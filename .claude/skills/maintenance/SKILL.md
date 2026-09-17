---
name: maintenance
description: The regular health check for a live project, so it doesn't rot between features — dependency security advisories and outdated packages, runtime and platform deadlines (Node LTS end of life, Workers compatibility date, Supabase CLI and local images, Expo SDK and app-store target requirements), whether a full verification is due, production error trends, and hygiene drift (lint rules still on, leftover debug logs, stale branches, tests still passing). Fixes the small safe things as one change and turns everything else into dated backlog items. Called by /build when maintenance is due (30 days since the last run by default) or when the owner asks to "update things", "keep it healthy" or "check everything is OK".
---

# maintenance — keep it healthy between features

Apps rot while no one is looking. Packages get security advisories, platforms drop old versions, and app stores raise their minimums. This run finds that early, while it's still a small job. It is **not** the place for new work: small safe fixes are done here, and everything else becomes a backlog item for the owner to schedule.

## 0. When

- **Due** when `state.maintenance.lastRun` is more than `state.maintenance.cadenceDays` (default 30) ago, or has never run and a production deploy exists.
- `/build` offers it when due, never forces it. Say how long it takes (usually 15–30 minutes, mostly waiting) and what it protects against. If the owner says "not now", set `deferredUntil` to 7 days from today and don't mention it again before then.
- Run it straight away, without waiting for the date, when the owner asks, or before resuming a project nobody has touched in over 60 days.
- It never interrupts an item in progress. It runs between items, on its own branch `maint-YYYY-MM-DD`, and ships like a change (`release`).

## 1. Checks

Run everything first, then decide. Write each result into the report as you go (§3).

### 1.1 Security advisories

```bash
pnpm audit --prod
```

Treat each advisory as verification §2.5 does: critical/high **with a fix** → fix in this run (§2). Without a fix → check whether the vulnerable code path is used, then add a `security` backlog item, or a verification finding if the path is reachable.

### 1.2 Outdated packages

```bash
pnpm outdated -r
pnpm -r why <pkg>   # when it's unclear who pulls something in
```

Group the results:

| Kind | Action |
|---|---|
| patch / minor, within the ranges already allowed, companions fine (`choosing-versions`) | Update in this run: `pnpm -r update <pkgs>` (never edit `package.json` by hand) |
| new major | Don't update here. Check it against `choosing-versions`. Companions ready → `upgrade` backlog item in Next. Not ready → leave the existing "revisit when" note, or add one to PROGRESS. |
| deprecated package (`npm view <pkg> deprecated`) | `upgrade` item with the recommended replacement |

Keep one version per tool across the monorepo (`choosing-versions`).

### 1.3 Runtimes and platforms

| Thing | Check | Action if behind |
|---|---|---|
| Node | `.nvmrc` against the Node release schedule (nodejs.org/en/about/previous-releases) | End of life within 6 months → `upgrade` item with `Due` |
| Workers `compatibility_date` | each `apps/*/wrangler.jsonc` | Older than ~6 months → `upgrade` item (not a blind bump: read the compatibility flags changelog for what changes) |
| wrangler, Supabase CLI | `pnpm --filter api exec wrangler --version`, `supabase --version` vs `npm view wrangler version` / latest CLI release | behind → update per `choosing-versions`; Supabase CLI is the owner's machine install, so guide them (`guide-owner`) |
| Supabase local images | `supabase start` prints update notices | note in report; update with the CLI |
| Postgres major on hosted | owner reads it from the dashboard (`guide-owner`: Project Settings → **Infrastructure**) | upgrade offered by Supabase → `maintenance` item; never click upgrade without a plan and an ADR |
| Expo SDK (if mobile) | `pnpm --filter mobile exec expo --version`, Expo's SDK support policy and release notes | SDK nearing end of support, or store target-API/Xcode minimum changing → `upgrade` item with the store's `Due` date |
| Installable web app | `vite-plugin-pwa` major and the pwa skill still matching | behind → `upgrade` item |

Look up the current dates live (`WebSearch`/`WebFetch`, `npm view`). Don't go from memory.

### 1.4 Verification

Due in full (verification §0) if 5 or more features since `lastFull`, or `lastFull` older than 90 days → run it in full now, as its own entry. Otherwise run the cheap project-wide scans only (verification §1.1, §2.1, §2.6 greps) and note it.

### 1.5 Production health

- `state.deploys`: any `failed`, `rolled-back` or `postDeployCheck: failed` without a follow-up bug → open one.
- Errors over the last 7 days: have the owner open Workers Observability for the api Worker (`guide-owner`) and read out the error count and the top 3 error messages. Compare with the previous report. New or growing errors → a bug if users are affected, otherwise a `change` item.
- Supabase: owner opens **Advisors** (Security and Performance) for the hosted project (`guide-owner` link pattern). Every security warning → verification finding. Performance warnings (missing indexes, slow queries) → `change` items.
- Usage against free-tier limits (Supabase database size and egress, Workers requests): owner reads them out. Over 70% of any limit → tell the owner in plain words what it costs to go up a tier (`explain-decisions`) and add a `maintenance` item.

### 1.6 Hygiene drift

```bash
git diff <state.maintenance.lastCommit> -- packages/config   # nobody weakened the lint/ts rules since last run (first run: the scaffold approval commit)
rg -n 'eslint-disable|@ts-ignore|@ts-expect-error' apps packages --glob '!**/node_modules/**'
rg -n '\[debug [BCF][0-9]{3}\]|debugger;' apps packages
git branch -a --merged main; git branch -a --no-merged main   # leftover branches
pnpm lint && pnpm typecheck && pnpm test
```

Each `eslint-disable`/`@ts-ignore` added since the last run (`git diff <lastCommit> -G 'eslint-disable|ts-ignore|ts-expect-error'`) needs a reason next to it, or it becomes a `change` item. Leftover debug lines get removed in this run. Merged branches get deleted. Unmerged branches with no `started` item get listed for the owner: keep or delete (deleting needs a yes).

### 1.7 Backlog health

If the backlog skill's review conditions are met (§5 there), offer the review at the end of this run.

## 2. Fix the small, safe things

Everything below goes into **one** maintenance change on the branch:

- patch/minor updates from §1.2, and critical/high advisories that have a fix;
- removal of leftover debug lines and merged branches;
- nothing that changes behaviour the owner would notice.

Then run the `code-quality` checks (lint, typecheck, all tests, `pnpm build`), plus the project-wide mechanical verification scans. If something breaks after an update, bisect it: update packages in smaller groups, find the one that caused it, and hold that one back as an `upgrade` item. Don't patch app code to suit a minor update unless the change is trivial and obviously correct.

`release` puts it live like any other item.

## 3. Report

Write `docs/maintenance/YYYY-MM-DD.md`:

```markdown
# Maintenance — YYYY-MM-DD

## Summary for the owner
<2–4 plain sentences: is anything urgent, what was updated, what's coming up and when.>

## Done in this run
- updated: <pkg old → new>, …
- security: <advisory> fixed by <pkg> update
- removed: 2 leftover debug lines, 3 merged branches

## Added to the backlog
- I021 upgrade · Node 22 → 24 (Due 2027-04-30, Node 22 end of life)
- I022 security · rate limit on /invites (verification scan)

## Checks
| Area | Result |
|---|---|
| Advisories | 0 critical · 0 high · 1 moderate (no fix, not reachable) |
| Outdated | 9 patch/minor updated · 2 majors → backlog |
| Platforms | Node ok until … · compat date 2026-03-01 · Expo SDK n/a |
| Verification | scans clean · full not due (2 features since 2026-08-30) |
| Production | 12 errors/7d (was 15) · advisors: 1 perf warning → I023 |
| Hygiene | lint/typecheck/tests ✓ · no new disables |

## Not checked
<anything skipped and why, e.g. owner not available for dashboard readings>
```

## 4. Record

- `state.maintenance`: `lastRun` (now), `lastReport` (path), `lastCommit` (the maintenance commit's sha once merged), clear `deferredUntil`.
- PROGRESS: `## <date> — maintenance — completed`, with the summary, a link to the report, the backlog ids added and what's next.
- Commit `chore(maintenance): <date> updates` on the branch. The report and the backlog changes go in the same commit.
- Tell the owner the summary, plus any `Due` date within 60 days, in plain words.
