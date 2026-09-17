---
name: debugging
description: Find the real cause of a bug before changing any code. Treats the owner's report as evidence to test, not a diagnosis; reproduces the problem (ideally as a failing test), traces it layer by layer through UI → API → Supabase, captures client↔server traffic with tests and Playwright instead of asking for devtools screenshots, decodes Supabase errors (error codes, silent RLS failures, container logs, policies), uses targeted temporary logging and the right debugging tool for each layer, rules competing explanations in or out with cheap experiments, proves the root cause, then fixes it with a regression test and removes the diagnostic noise. Called by /build whenever the owner reports something broken, wrong, slow or "weird"; also when a test, deploy or verification check fails for a reason that isn't obvious.
---

# debugging — prove it, then fix it

A bug report describes a **symptom**, and often comes with a **theory** about the cause. The symptom is usually real. The theory often isn't. "The save button is broken" might be a form validation message that never shows, a `400` from the API, a database security policy (RLS) quietly hiding the row, an old cached copy of the app, or the owner being signed in as a different user. Change code before you know which, and you'll fix the wrong thing, hide the real problem, or add a second bug.

The rules of this skill:

1. **No fix before a reproduction.** If you can't make it happen, you can't show it's gone.
2. **No fix before a proven root cause.** "This looks like it could be it" doesn't count. A test that fails, then passes when you change just that one thing, does.
3. **The owner's account is evidence, not a verdict.** Take it seriously, write it down, and test it like any other hypothesis. Sometimes they're right, and saying so matters too.
4. **One change at a time.** Every experiment changes one thing and records what happened.
5. **Observe, don't infer.** A log line, a network response, a failing test or a SQL result beats reading code and reasoning about what "should" happen.

Speak plainly throughout. The owner doesn't need to follow the technique, but they should always know what you're checking, what you found and what happens next.

## 0. Triage — is anything on fire?

Before investigating, check how bad it is:

| Situation | Do first |
|---|---|
| Production is down, or users can't sign in or pay | Tell the owner straight away. Offer to **roll back the last deploy** so users are unblocked while you investigate. Follow `.claude/skills/release/SKILL.md` §5: roll back web and api together, never the database, then revert `main` so the next push doesn't redeploy the break. `state.deploys` shows whether the last deploy included a migration. This is an **ask** under `explain-decisions`. |
| Users' data may be exposed to other users, or being corrupted | Treat as **critical**. Stop and tell the owner. Roll back if it helps. Don't try to repair data by hand; that's a separate, owner-approved step (§10). |
| Wrong, annoying, but not harmful | Normal flow below. |

## 1. Open a bug record

Give the bug an id `B001`, `B002`, … Add it to `state.bugs` with `stage: "intake"`. Create `docs/bugs/B00N-<short-slug>.md` from the template in §12. That file is the investigation notebook: every hypothesis, experiment and result goes in it as you go, so a later run can pick up exactly where this one stopped. Add a `# B00N — <title>` heading to `docs/PROGRESS.md`.

## 2. Intake — separate what they saw from what they think

Ask only what you can't find out yourself. Usually that's:

- **What did you do?** The exact steps, starting from where you were in the app.
- **What did you expect, and what happened instead?** The exact wording of any error. A screenshot is ideal.
- **Where?** Website, installed app on the home screen, phone app (iPhone or Android), or the marketing site. On your computer while developing (local), or the live app (production)?
- **Which account?** Their own, a test user, a teammate's?
- **How often?** Every time, sometimes, or just once? For everyone or one person?
- **Since when?** Did it ever work? Anything change around then (a deploy, a new feature, a new phone)?

Then write two separate lists in the bug file:

- **Observations**: what they actually saw. ("Clicked Save. Spinner showed, then the list didn't include the new project.")
- **Owner's theory**: what they believe is going on. ("Saving is broken.") Record it as hypothesis **H0**. It gets tested in §7 like everything else.

Don't ask for developer-tools screenshots up front. You can usually capture the network traffic and console errors yourself with a test (§5). Only if the bug happens in production and can't be reproduced locally, ask for the specific thing you need (a console error, one network response, the app version) following `guide-owner`: exact steps to open developer tools, which tab, what to screenshot. Ask them to crop anything personal.

**Is it actually a bug?** Check the PRD and the feature's breakdown. If the app is doing what was agreed and the owner wants something different, that's a **feature request**. Say so kindly, close the bug record as `not-a-bug`, and route it to the feature loop in `/build`.

## 3. Reproduce

Choose the cheapest reliable way to make it happen, in this order:

1. **An automated test that fails.** A Vitest route test through `app.request()` for API behaviour, React Testing Library for component logic, Playwright for a flow across screens. This is the best option because it becomes the regression test later.
2. **A direct request** to the local API with `curl -v` (or the typed client in a scratch script), signed in as a specific test user.
3. **Driving the local app** (Playwright script, or the `run` skill) through the owner's exact steps.
4. **Watching production** when it only happens there (§4, production rows). Don't experiment on live user data.

Write the reproduction steps in the bug file. Run them **twice**. If it only happens sometimes, run them in a loop (`for i in $(seq 20); do …; done`) and write down the failure rate. A flaky bug needs that number to prove a fix.

**Before going further, rule out "not running the code we think":**

| Check | How |
|---|---|
| Is the fix/feature actually deployed? | `git log origin/main -1`, `wrangler deployments list`, GitHub Actions run status (`gh run list`) |
| Did the migration reach production? | Supabase GitHub integration check on the commit (`gh api repos/{owner}/{repo}/commits/<sha>/check-runs`); `supabase migration list` against local |
| Installed web app showing an old version? | The service worker is serving the old app shell. Ask the owner to use the "update available" prompt, or guide them to Application → Service workers in developer tools |
| Phone app on an old update? | `eas update:list` and compare with the build's runtime version and channel |
| Local database out of date? | `supabase migration list`; `supabase db reset` only with the owner's yes (it wipes local data) |
| Stale local build/cache | Restart `pnpm dev`; clear Vite/Turbo cache only if evidence points there |

**If you can't reproduce it:** don't guess a fix. Say so honestly, then add instrumentation (§8) around the suspected path. Ask the owner to try again and tell you the time it happened, then read the logs for that time. Set the bug stage to `waiting-for-evidence`.

## 4. Locate — find the first place the data goes wrong

Every request in this stack goes through the same layers. Draw the path for *this* bug in the bug file, then check **at each boundary** whether the data is still correct. The bug lives between the last good checkpoint and the first bad one. Check the middle of the path first and halve from there. Don't walk it top to bottom.

```
UI component → hook / query cache → hc client → network
  → Hono middleware (auth, CORS) → Zod validator → route → service
  → Supabase client → RLS policies → Postgres → back up the same path
```

| Layer | Look with | What to confirm |
|---|---|---|
| Screen & components | React DevTools; RTL test | Props and state are what you expect; the error/empty/loading state isn't hiding a failure |
| Query cache | TanStack Query Devtools (dev only) | Right query key; data stale or fresh; mutation invalidated the key |
| Network | A capture test (§5), not the owner's devtools | Request actually sent; URL, method, `Authorization` header **present** (don't copy its value); status code; response body |
| API | `wrangler dev` terminal output; `pnpm --filter api test -- -t "<name>"` | Which middleware returned; Zod error details; which branch the service took |
| Database & RLS | §6; Supabase Studio (local URL from `supabase status`); `psql` with the local DB URL | Row exists; the query returns it **as that user** (below) |
| Production API | `pnpm --filter api exec wrangler tail` (filter by status or search; see `--help`); Workers Observability in the Cloudflare dashboard | Errors and the request id around the reported time |
| Production database | Supabase dashboard → Logs (API, Postgres, Auth) | Rejected queries, auth failures, slow queries |
| Phone app | Expo dev tools (`npx expo start`, then the debugger hotkey it prints); device logs | Same as web, plus secure-store session present |

**Test RLS as the real user, not as the admin.** The service role and Studio's SQL editor bypass RLS, so "the row is there" proves nothing about what the user sees. Locally:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<user uuid>","role":"authenticated"}';
select … ;          -- what this user actually gets
rollback;
```

An RLS denial on `select` returns **zero rows, not an error**. That one fact explains a large share of "my data disappeared" reports.

**It worked before?** Find the commit that broke it instead of reasoning about it: `git bisect start <bad> <good>`, then `git bisect run <command that exits non-zero when broken>` with the reproduction test. Also useful: `git log -S "<identifier>" -p` to see when a piece of code changed.

## 5. See the traffic between client and server — with tests, not screenshots

Most bugs are decided by one request: what the client sent and what came back. Don't depend on the owner opening developer tools and screenshotting the Network tab. That's slow, easy to get wrong, and the screenshot can include tokens and personal data. **Capture the traffic yourself, locally, with code you can re-run.** Only fall back to the owner's browser when the bug happens in production and nowhere else (then follow `guide-owner`, and have them crop anything personal).

Pick the narrowest capture that answers the question:

**a) Is the API's answer wrong? → an API test with a real user.** Call the route in-process with Hono's `app.request()` against the local Supabase, signed in as a seeded test user (reuse the sign-in helpers from the authorisation matrix test in `verification` §2.4 rather than writing new ones). Assert on status and body. Now you can change one input at a time (different user, missing field, other tenant's id) and see exactly what the server does, with its `wrangler`/console output next to it.

```ts
const res = await app.request('/projects', { method: 'POST', headers: authHeaders(ownerA), body: JSON.stringify(input) }, env)
expect(res.status).toBe(201)          // when it fails, print status + (await res.json()).error
```

**b) Is the client sending the wrong request? → run the real client code against the real API in a test.** Hono's typed client accepts a custom `fetch`, so a hook or service test can route the actual `hc` calls into `app.request` and record each one. No server, no mocks, and the same code path as the app:

```ts
const calls: Array<{ method: string; path: string; status: number; bodyKeys: string[] }> = []
const client = hc<AppType>('http://local', {
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await app.request(input, init, env)
    const body: unknown = init?.body ? JSON.parse(String(init.body)) : {}
    calls.push({ method: init?.method ?? 'GET', path: new URL(String(input)).pathname, status: res.status,
      bodyKeys: body && typeof body === 'object' ? Object.keys(body) : [] })
    return res
  },
})
```

Use a request mocking library (`msw`) only to pin down *what the UI sends* in a component test. A mock can't tell you what the server would do, so pair it with (a).

**c) Is it the whole flow in a real browser? → a Playwright capture spec.** Write a temporary `e2e/debug/B00N.spec.ts` that signs in as a seeded user, follows the owner's exact steps, and records the traffic and console to a file you read yourself:

```ts
const log: unknown[] = []
page.on('response', async (r) => {
  if (!r.url().includes('/api/') && !r.url().includes('/rest/v1/') && !r.url().includes('/auth/v1/')) return
  const failed = r.status() >= 400
  log.push({ t: Date.now(), method: r.request().method(), path: new URL(r.url()).pathname, status: r.status(),
    // error bodies use the standard { error: { code, message } } shape; keep only those fields
    error: failed ? await r.json().then((b) => b?.error?.code ?? b?.code ?? b?.message).catch(() => null) : undefined })
})
page.on('requestfailed', (r) => log.push({ t: Date.now(), failed: r.url(), reason: r.failure()?.errorText }))
page.on('console', (m) => m.type() === 'error' && log.push({ t: Date.now(), console: m.text() }))
page.on('pageerror', (e) => log.push({ t: Date.now(), pageerror: e.message }))
// …steps…
await fs.writeFile('test-results/debug/B00N-network.json', JSON.stringify(log, null, 2))
```

This shows the order of requests (races), which ones failed, whether the browser talked to Supabase directly (`/auth/v1`, `/rest/v1`) or to the API, and any console error, all timed against each other. For a step-by-step replay with screenshots and full network detail, run with `--trace on` and open it with `npx playwright show-trace`.

Rules for captures:
- **Never record or print** `Authorization` or `Cookie` headers, request bodies, or full response bodies. Record method, path, status, timing, body *keys* and error *codes*. `recordHar` and traces do contain tokens and personal data, so keep them in `test-results/` (git-ignored), read them locally, and delete them when the bug is closed.
- Local stack only (`supabase start`, `pnpm dev`) with seeded users, never production accounts.
- When the bug is found, **turn the capture into the regression test** (usually (a) or (b), or extend `e2e/smoke.spec.ts` if it's the critical path) and delete `e2e/debug/B00N.spec.ts`.

**Server side of the same request:** make sure the API logs one line per request (method, route, status, duration, `requestId`, and for `400`s the Zod field *paths* that failed). If that middleware doesn't exist yet, adding it is a legitimate permanent fix (§8). With it, the client capture and the `wrangler dev` / `wrangler tail` output join up by request id.

## 6. Supabase errors

Supabase problems are hard to debug for three reasons: errors come back as values rather than being thrown, security policies often fail **silently**, and the real message is in a container log you weren't looking at. Work through these.

**1. Is the error being checked at all?** `supabase-js` doesn't throw. It returns `{ data, error }`. If code ignores `error`, `data` is `null` and the crash shows up somewhere else later ("cannot read properties of null"). Find ignored errors:

```bash
rg -n 'const \{ data(: \w+)? \} = await' apps packages   # destructures data without error
```

Every call should check `error` and turn it into the API's `AppError` with the Supabase `code`. Log `code`, `message` and `hint`. **Don't log `details`**: it often contains row values, e.g. `Key (email)=(someone@example.com) already exists`.

**2. Read the code, not just the message.**

| Code | Means | Usually |
|---|---|---|
| `42501` | permission denied / "new row violates row-level security policy" | An `insert` (or the new version of an `update`) failed an RLS `with check`; or the role has no `grant` on the table |
| `PGRST116` | `.single()` got zero (or several) rows | Often **RLS hid the row**, not that it's missing. Test as the user (§4) |
| `23505` | unique violation | Double submit (no idempotency / button not disabled); upsert conflict target wrong |
| `23503` | foreign key violation | Parent row missing, or not visible to this user, or created in a different order |
| `23502` / `22P02` | not-null violation / invalid input syntax | Zod schema and the table disagree; empty string sent for a uuid |
| `42P01` / `42703` | table / column doesn't exist | Migration not applied to this database (§3), or a typo |
| `PGRST2xx` (e.g. `PGRST204`, `PGRST205`) | API doesn't know that table/column | Migration applied but the API's schema cache is stale: `notify pgrst, 'reload schema';` locally, or the migration never ran |
| `PGRST3xx` | JWT problems | Expired or malformed token; token from another Supabase project (local vs production keys mixed up) |
| `P0001` | exception raised in a database function or trigger | Read the function; the message is the one you wrote in `raise exception` |

For codes not listed, look them up (Postgres SQLSTATE codes or the PostgREST error reference) instead of guessing.

**3. Silent failures. No error doesn't mean it worked.**
- A `select` blocked by RLS returns **empty**, not an error.
- An `update` or `delete` blocked by RLS returns **success and changes nothing**. To detect it, chain `.select()` and check how many rows came back, or pass `{ count: 'exact' }`.
- Check **which client** the code path uses. The API may have a user-scoped client (RLS applies) and a service-role client (RLS bypassed). A bug that "works in the test but not in the app" is often the two using different clients.

**4. Read the real logs.** Locally, each Supabase service is a Docker container, and the full error (including the SQL statement that failed) is in its log:

```bash
docker ps --format '{{.Names}}' | rg supabase        # find the exact names for this project
docker logs --since 5m <supabase_db_…>               # Postgres: failed statements, RLS errors, raise log output
docker logs --since 5m <supabase_rest_…>             # PostgREST: schema cache, JWT errors
docker logs --since 5m <supabase_auth_…>             # Auth: sign-in, sign-up, refresh, email sending
```

These logs can contain row values and emails. Read them in the terminal. Don't copy them into the bug file, PROGRESS or a commit; summarise instead ("insert into projects rejected by policy `projects_insert_member`"). In production, use the Supabase dashboard's Logs (`https://supabase.com/dashboard/project/<project-ref>/logs/explorer`: Postgres, API and Auth sources), following `guide-owner` if the owner needs to look.

**5. Inspect the policy and schema that actually exist**, not the ones you think the migrations created:

```sql
select relname, relrowsecurity from pg_class where relname = '<table>';                  -- RLS on?
select policyname, cmd, roles, qual, with_check from pg_policies where tablename = '<table>';
select grantee, privilege_type from information_schema.role_table_grants where table_name = '<table>';
```

Then run the failing statement **as the user** (the `set local role authenticated` block in §4) and change one thing at a time: a different user, the tenant id, one condition from the policy's `qual`. To debug a function or trigger locally, add a temporary `raise log '[debug B00N] …', <ids only>;` and watch the db container log. For schema drift, `supabase migration list` shows which migrations each database has, and `supabase db diff` shows local changes that no migration contains (check `--help` for current flags). Any fix is a new migration via `supabase migration new`, never a manual edit.

**6. Auth errors.** Read `error.code` on the auth error (`invalid_credentials`, `email_not_confirmed`, `over_email_send_rate_limit`, `otp_expired`, `refresh_token_not_found`, `session_not_found`, …) rather than the message. Locally, confirmation and reset emails land in the local mail viewer (its URL is in `supabase status`), so you can follow the real link. Redirect problems are almost always the allowed URLs: `site_url` / `additional_redirect_urls` in `supabase/config.toml` locally, and **Authentication → URL Configuration** in the dashboard for production.

**7. Prove it with a test.** Once you know the cause, reproduce it with `supabase-js` (anon key, signed in as the seeded user) or through the API test in §5a, so the regression test covers the database behaviour and not just the TypeScript around it.

## 7. Hypotheses — compete them, don't pick a favourite

In the bug file, list **at least three** explanations that fit the observations. H0 (the owner's theory) is one of them. For each, write:

| # | Hypothesis | If true, we'd see… | If false, we'd see… | Cheapest test |
|---|---|---|---|---|

Run the test that **separates the most hypotheses for the least effort** first. It's usually a single log line or one request. Record the actual result and mark each hypothesis **ruled out**, **still possible** or **confirmed**. Never delete a ruled-out row; the notebook shows how you got there.

When a result surprises you, trust the result. Write down what you assumed that turned out wrong. That assumption is often closer to the bug than anything else.

Common symptoms in this stack and what's often behind them. **Use these as hypotheses to test, never as answers:**

| Symptom | Often actually |
|---|---|
| "My data disappeared" / list is empty | RLS policy filters it out (no error); wrong tenant/org id; query key missing a parameter, so cached data from another view |
| "Save does nothing" | `400` from Zod shown nowhere in the UI; client form validation blocking submit silently; mutation succeeded but didn't invalidate the list |
| Works locally, broken live | Missing `wrangler secret` or env var; migration not applied; CORS origin not listed; Supabase auth redirect URL not set for the live domain |
| "My change isn't showing" | Not deployed; service worker serving the old shell; EAS update not published to that channel; aggressive cache headers |
| Randomly logged out / `401` | Token refresh failing; session read before the auth listener fires; wrong Supabase project keys in one environment |
| Sometimes wrong, sometimes right | Race between two requests; optimistic update overwritten by a stale refetch; missing `await`; time zones / date boundaries |
| Slow | Missing index (`explain analyze`); N+1 requests from the UI; RLS policy with a per-row subquery |
| Phone only | Safe-area/keyboard layout; secure-store vs web storage difference; the app is running an older update |

## 8. Logging that actually finds things

Temporary diagnostic logs are the main tool. Use them deliberately:

- **Tag every temporary line** with the bug id so it can be found and removed: `console.log('[debug B007] …')`. Nothing tagged survives the fix (§10).
- **Log at boundaries, not everywhere.** Where data enters and leaves the layer you're suspicious of: route entry, after validation, before and after the Supabase call, in the error branch.
- **Log which path the code took.** `branch: 'cache-hit'`, `authorised: false`, `rowsReturned: 0`. Most bugs are a branch you didn't expect.
- **Log shapes, not contents.** This project's rule is no personal data, tokens or request bodies in logs, client or server (`verification` §2.6), **and that includes temporary debug logs**. Log `userId`, `orgId`, `requestId`, `rows: data.length`, `keys: Object.keys(body)`, `hasAuthHeader: Boolean(h)`, `status`, `error.code`, never the email, the body, the token or the user object.
- **Correlate.** Include the request id on the server, and the same id in the client log if you can, so one user action can be followed across layers.
- **Timestamps and ordering** for anything intermittent: `performance.now()` or `Date.now()` before and after, so you can see if two things overlap.
- **Say what you expected** in the line itself when it helps: `[debug B007] expected 1 row, got ${rows.length}`.

**Local first.** Only add diagnostic logging to a production deploy when the bug can't be reproduced locally. Then it's a real change: it goes through `pnpm lint`/`typecheck`, follows the no-PII rule, and the owner is told it's temporary. Read it with `wrangler tail` or Workers Observability, and remove it in the fix.

**Permanent logging.** If this bug was hard to find because something important wasn't logged (an unhandled error branch, a failed third-party call, a rejected auth), add one **permanent**, structured log line at the right level through the API's logger, with ids only. Note it in the fix.

**Other tools, when logs aren't enough:**

- Breakpoints: `debugger;` in web code with devtools open; the inspector `wrangler dev` offers (check its printed hotkeys); `node --inspect` for scripts. Remove `debugger;` afterwards.
- `pnpm --filter <app> test -- -t "<name>" --reporter verbose` to run one test fast while iterating.
- Playwright `--trace on` then `npx playwright show-trace` to watch a failing flow step by step, with network and console.
- `explain analyze` for slow queries, run as the `authenticated` role (§6) so RLS cost is included.
- `git bisect run` for regressions (§4).

## 9. Prove the root cause

You've found the root cause when **all** of these are true. Write each one in the bug file:

- **Causal chain.** You can explain, step by step, how the trigger leads to the symptom the owner saw.
- **Explains everything.** It accounts for *every* observation, including "only sometimes", "only on my phone" and "it worked last week". Anything unexplained means you're not done.
- **On/off switch.** Changing just that one thing makes the reproduction pass. Undoing it makes it fail again. Do this for real.
- **Right depth.** Ask "why did that happen?" until the answer is the place a sensible fix belongs. "The value was undefined" is a symptom. "The query key didn't include the org id, so switching orgs served the previous org's cache" is a cause.
- **Siblings checked.** Search for the same pattern elsewhere (`rg -n '<pattern>' apps packages`). If it exists, list the other places in the bug file; fix them in the same change if small, otherwise record a follow-up.

## 10. Tell the owner, then fix

**Report before changing code** (a short message, using `explain-decisions`):

```
What you saw:     <their symptom, in their words>
What's going on:  <the actual cause, in one or two plain sentences>
Your hunch:       <right / partly right / it turned out to be something else — say it kindly and concretely>
The fix:          <what will change, and anything users will notice>
Risk:             <low / what could be affected>
```

A small, clearly correct fix is **decide and tell**. **Ask** if the fix changes what users see or can do, touches auth, permissions or RLS, needs a migration, or if production data was damaged. Repairing damaged data is its own step: write it as a migration or a reviewed one-off script, run it locally against a copy first, and never edit the hosted database by hand.

**Fix, in this order:**

1. Turn the reproduction into a **regression test** (if it isn't one already) and watch it **fail** for the right reason.
2. Make the smallest change that fixes the root cause. Don't fix the symptom instead:
   - no `?.` or `?? []` to silence an undefined value that shouldn't be undefined;
   - no `try/catch` that swallows the error;
   - no longer timeouts or retries to cover a race;
   - no "clear the cache" as the fix;
   - no disabled test, lint rule or RLS policy.
3. Watch the test **pass**. For an intermittent bug, run the loop from §3 again and show the failure rate is now zero.
4. **Remove the diagnostics:** `rg -n '\[debug B00N\]|debugger;' apps packages` returns nothing.
5. Run the feature-loop checks that apply: `code-quality` (lint, typecheck, all tests); `design-compliance` and `ux` Part B if a screen changed (a fix that changes what users see when something fails follows `error-states`); `verification` **scoped** if the fix touched routes, auth, RLS, tenancy or logging (**full** if it touched auth, roles or RLS policies, per its §0); `documentation` (README/api.md/ADR if behaviour changed).
6. Run the owner's original steps in the real app (local, then production after deploy) and tell them exactly what to click to see it fixed.

Then hand over to `.claude/skills/release/SKILL.md`. The same deploy gate as features applies (no production deploy with open critical or high verification findings), and its post-deploy check is where step 6's "then production" happens.

## 11. Record

- `state.bugs[n]`: update `stage` as you go (`intake → reproduce → diagnose → fix → verify → done`, or `waiting-for-evidence` / `not-a-bug` / `wont-fix`), set `rootCause` (one line) and `completedAt`.
- `docs/bugs/B00N-<slug>.md`: complete, including ruled-out hypotheses.
- `docs/PROGRESS.md`: one entry per stage under the `# B00N` heading, using the normal entry format. **Decided:** includes the root cause and whether H0 held.
- Commit: `fix(B00N): <what was wrong, not what was changed>`.
- If a symptom-table row from §7 was the answer and isn't already there, or you hit a new stack-specific trap, add a row to the §7 table in this skill so the next bug starts smarter.

## 12. Bug file template

```markdown
# B00N — <short title>

**Status:** intake | reproduce | diagnose | fix | verify | done | waiting-for-evidence | not-a-bug | wont-fix
**Reported:** YYYY-MM-DD · **Where:** web / installed web app / iOS / Android / site · local / production
**Severity:** critical / high / medium / low

## Observations (what the owner saw)
- …

## Owner's theory (H0)
- …

## Reproduction
Steps / test name / command. Runs: N, failures: M.

## Path
UI → … → DB (mark last good ✓ and first bad ✗ checkpoints)

## Hypotheses
| # | Hypothesis | Test | Result | Status |
|---|---|---|---|---|
| H0 | <owner's theory> | … | … | ruled out / possible / confirmed |
| H1 | … | … | … | … |

## Experiment log
- HH:MM — changed/checked … → saw …

## Root cause
Causal chain · explains all observations? · on/off proven? · siblings found:

## Fix
Change · regression test · diagnostics removed · checks run · confirmed in real app
```

## Never

- Change code "to see if it helps" before reproducing the bug.
- Tell the owner it's fixed without a test or real run that failed before and passes now.
- Take the owner's explanation as the diagnosis, or wave it away without testing it.
- Log personal data, tokens, headers or request bodies, even temporarily, even locally.
- Leave `[debug B00N]` logs or `debugger;` statements in a commit that finishes a bug.
- Check RLS behaviour with the service role or Studio's SQL editor as admin and call it proven.
- Edit the production database by hand, or `supabase db reset` locally without the owner's yes.
- Hide a failure with optional chaining, empty catches, retries or longer timeouts.
- Ask the owner for devtools screenshots when a local capture test (§5) could show the same thing.
- Ignore a Supabase `error`, or treat "no error" from an update or delete as proof that rows changed.
- Record HAR files, traces or container logs anywhere git can see, or paste their contents into docs.
