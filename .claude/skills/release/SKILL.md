---
name: release
description: Put finished work live and prove it works there — the deploy gate (no open critical/high findings), pushing to main and watching the Supabase migration check and the GitHub Actions deploy, the post-deploy check against production (health, web shell, headers, deployed version, error logs, the owner clicking the critical path on the live app), recording the deploy, and rolling back safely when a deploy breaks production (Workers rollback, never a database rollback, revert on main so the next push doesn't redeploy the break). Called by /build when a feature, change or bug fix is done, when the owner says "put it live" / "deploy", and when production breaks right after a deploy.
---

# release — live, and proven live

A deploy isn't finished when Actions turns green. It's finished when production has been checked and the owner has seen the change working there. This skill is the last step of every feature, change and bug fix, and the first response when a deploy breaks something.

Two environments only: local and production (`CLAUDE.md`). Nothing here creates a staging environment.

## 0. When to deploy

When an item reaches `done`, `/build` asks, following `state.preferences.deploy`:

- `ask` (default): "F009 is finished and checked. Put it live now?" Recommend yes unless another item in `Now` is meant to ship together with it (say so).
- `auto`: the owner said something like "just put things live when they pass". Deploy without asking, then tell them. Record the preference once, in `state.preferences.deploy` and PROGRESS. Even on `auto`, always ask first when the push includes a migration that renames, drops or rewrites data.

Several finished items can go out in one deploy. Every item in it is listed in the deploy record.

## 1. Gate — before pushing

Stop, and explain in plain words (`explain-decisions`), if any of these fail:

| Check | How |
|---|---|
| No open critical or high findings | `state.verification.openFindings`. A critical is never deployed, even if the owner insists. For a high the owner insists on, explain the specific risk and still don't deploy. |
| A full verification has passed at least once | `state.verification.lastFull` is set. Also due again under verification §0 → run it first. |
| Nothing half-finished is going out | `git status` clean. Only branches of items at `done` get merged (see §2). `git log origin/main..main` shows nothing but those merges. |
| Local checks pass on exactly what will ship | after merging, on `main`: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` |
| Migrations are backwards compatible | `git diff origin/main --stat -- supabase/migrations`. For each new file: adds only (tables, nullable/defaulted columns, policies, functions)? A drop, rename, `not null` without default, or type change must have been split into "add now, remove later" (`CLAUDE.md`). If not, stop. |
| Mobile | If `apps/mobile` changed: decide OTA update vs store build (scaffold → mobile section). Native changes need a store build; that's a separate step with the owner. |

Note whether this push includes a migration. It matters for rollback (§5).

## 2. Deploy

Every feature, change and bug fix is built on its own branch (`/build` §3), because a push to `main` *is* a deploy. Bring each finished item's branch in:

```bash
git switch main && git pull --ff-only
git merge --no-ff f009-export-projects -m "Merge F009: Export projects to Excel"   # one per item going out
# run the §1 local checks here, on main
git push origin main
git push origin --delete f009-export-projects && git branch -d f009-export-projects
```

A merge conflict between two items is resolved on `main` before pushing, then the local checks run again. If it touched logic, re-run the affected tests and say so in PROGRESS.

Then watch it (Actions configured by scaffold):

```bash
gh run list --branch main --limit 3          # find the Deploy run for this commit
gh run watch <run-id> --exit-status          # waits; non-zero if any job fails
```

`deploy.yml` waits for the Supabase GitHub integration's migration check, then builds and deploys api → web (and site), then runs its `smoke` job. If Actions isn't set up (recorded in an ADR), deploy each app by hand with `pnpm --filter <app> exec wrangler deploy`, api first.

If a job fails, **nothing is fixed by guesswork**. Read the failing log (`gh run view <run-id> --log-failed`) and use the `debugging` skill's method (reproduce, locate, prove). A migration that failed on production is urgent: the Workers deploy was held back on purpose, so production is still on the old code and old schema. Tell the owner that, then diagnose.

Record the deploy as soon as the push lands (§6), with `status: "deploying"`.

## 3. Post-deploy check (automatic)

Run these against **production** once Actions is green. They're read-only. Never sign up fake users, send test attacks or write data on production (verification §0).

```bash
curl -fsS https://<api-host>/health                                   # 200
curl -fsSI https://<web-host>/ | head -20                              # 200, security headers present (verification §2.5)
curl -fsS https://<web-host>/ | rg -o 'assets/index-[A-Za-z0-9_-]+\.js' # the entry chunk exists…
curl -fsSI https://<web-host>/assets/<that-file>.js | head -1         # …and serves JS, not index.html (pwa SPA-fallback trap)
pnpm --filter api exec wrangler deployments list | head -20           # newest deployment is from this run (time matches)
```

If the web app is installable, also check `sw.js` and `manifest.webmanifest` are served with the right content type and `no-cache` (pwa skill). If there's a site, check its home page returns 200.

Then watch for errors for a few minutes while the owner does §4:

```bash
pnpm --filter api exec wrangler tail --format pretty --status error   # check --help for current filter flags; stop after ~5 minutes
```

Compare with what's normal. A handful of 401s from expired sessions is normal. New 500s, or errors on routes this deploy touched, are not. For anything older or wider, have the owner open Workers Observability for the api Worker (`guide-owner`: dash.cloudflare.com → Workers & Pages → `<project>-api` → **Observability**) and read out the error count for the last hour.

## 4. Post-deploy check (owner, on the live app)

Tell the owner exactly what to do on production, following `guide-owner` §5: the live URL, which account to use (their own real account, never a shared test password), each click, and what they should see. Always include:

1. Sign in (the critical path never breaks silently).
2. The thing that just shipped, step by step.
3. For an installable web app, if the shell or routing changed: open the installed app, switch away and back, and confirm the update toast appears and reloading shows the change.

The owner reports back. "Looks fine" plus a clean §3 means `postDeployCheck: "passed"`.

## 5. When production is broken

Decide with the owner quickly, in plain words (`explain-decisions`). Usually the recommendation is: **roll back now, diagnose after.**

| What's broken | Do |
|---|---|
| Users can't sign in, pay, or use the main flow; or data is exposed | Roll back the Workers immediately (below), then open a bug (`debugging`, severity critical/high). |
| One new screen or action is broken; everything else works | Recommend rollback if the owner agrees, otherwise open a high bug and fix forward quickly. |
| Cosmetic, or only affects the new feature in a minor way | No rollback. Open a bug or a backlog `change`, depending on severity. |

**Rolling back Workers:**

```bash
pnpm --filter <app> exec wrangler deployments list
pnpm --filter <app> exec wrangler rollback --help          # current flags; roll back to the previous version id
```

Roll back web and api **together** to the versions from the same earlier deploy, so the typed client and the API match.

**The database is never rolled back.** Because every migration only adds things, the previous Worker still works with the new schema. That rule exists for exactly this moment. If a migration itself caused the problem, the fix is a *new* migration that repairs it, through the normal bug flow. Never edit or delete a migration that already ran on production. Never run SQL by hand on production.

**Then make `main` match what's live.** A rollback only changes what Cloudflare serves. The next push would redeploy the broken code. Straight after rolling back:

```bash
git revert --no-commit -m 1 <merge-commit-of-the-bad-item>    # one per item merged in the bad deploy, newest first
git restore --staged --worktree supabase/migrations           # keep migrations that already ran on production
git commit -m "revert(F009): roll back export — production broke sign-in (B006)"
```

Don't revert a migration file: it already ran. Only the app code is reverted, and the migration stays in place. Push the revert once the local checks pass. The reverted item goes back to `started` at `build` (feature/change) or its bug is opened. Git ignores the item's original commits if the same branch is merged again. So the fix branch starts from `main` with `git revert <the revert commit>`, which brings the work back, and then adds the fix on top. Tell the owner what's live now, what was undone, and what happens next.

For an installable web app, users on the broken version get the rollback through the normal update toast. If a broken **service worker** shipped, use the pwa skill's kill switch instead.

## 6. Record

`state.deploys` (append; newest last):

```json
{ "at": "2026-09-20T10:14:00Z", "commit": "a1b2c3d", "items": ["F009", "C004"],
  "includesMigration": true, "method": "actions", "status": "live",
  "postDeployCheck": "passed", "rolledBackTo": null, "notes": null }
```

`status`: `deploying` → `live` | `failed` | `rolled-back`. `postDeployCheck`: `pending` → `passed` | `failed`.

PROGRESS entry `## <date> — release — <items>`: what went out, migration yes/no, Actions run link, §3 results, what the owner checked, anything odd. A rollback gets its own entry: what broke, what was rolled back to, the revert commit, the bug id.

Non-urgent things noticed while checking (a slow page, a noisy warning) → backlog items, `From: release <date>`.

Hand back with the live URL and what to click.
