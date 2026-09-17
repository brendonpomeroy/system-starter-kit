---
name: verification
description: The independent check before anything is called done — verifies the design system is intact and actually used (tokens in sync, style guide matches, lint rules still on, no raw values anywhere) and that screens are accessible with every UX state handled (axe, keyboard, screen reader, reduced motion, API down/offline), then runs a security audit — every API route authenticated or deliberately public, authorisation and multi-tenant isolation tested with real requests as different users, Supabase RLS checked directly, auth pages and flows (sign-in, sign-up, reset, callback, sign-out) actually working, common vulnerabilities, and unsafe logging of personal data on client and server. Called by /build as the verify stage of every feature (scoped or full) and at the end of scaffold; also when the owner asks for a security check.
---

# verification — check it like someone trying to break it

`code-quality` and `design-compliance` are the builder checking their own work. This stage is the **auditor**. Its job is to find problems, not to confirm things are fine. Assume something is wrong until a command or a real request proves otherwise. "The middleware looks applied" is not evidence. A `401` from `curl` is.

**Independence.** Where the Agent tool is available, run this stage in a fresh subagent that didn't build the feature. Give it this file, `docs/DATA-MODEL.md`, `docs/ARCHITECTURE.md`, the feature's breakdown and the diff (`git diff <feature start>..HEAD`). Tell it to report findings, not fix them. The main session fixes, then re-runs the failing checks.

## 0. Scope

| Mode | When | Covers |
|---|---|---|
| **scoped** | default for a feature, a change or a bug fix | everything the feature's diff touched, plus the project-wide mechanical scans (§1.1, §2.1, §2.6 greps), which are cheap |
| **full** | end of scaffold; before the first production deploy; any feature touching auth, sessions, roles, invitations, tenancy/organisations, RLS policies, storage, payments or webhooks; 5 features since `state.verification.lastFull`; the owner asks ("is it secure?", "run a security check") | every section, whole project |

Say which mode and why in the PROGRESS entry.

**Local only.** Every dynamic test runs against the local stack (`supabase start`, `pnpm dev`) with seeded test users. Never send test attacks, fake sign-ups or matrix requests to production.

## 1. Design system verification

### 1.1 Mechanical (always, project-wide)

```bash
pnpm --filter design-system build:tokens
git diff --exit-code packages/design-system/src/generated   # generated files match tokens.ts — nobody hand-edited them
```

- The `:root` token block in `docs/style-guide.html` matches `src/generated/tokens.css` exactly (extract and diff). If not, the style guide is out of date, so regenerate that block.
- ESLint design rules still exist in `packages/config/eslint.config.mjs` and are set to `error`. Then `rg -n 'eslint-disable' apps packages --glob '!**/node_modules/**'`: every hit needs a written reason. Any disable of a design rule is a finding.
- Re-run every grep in `design-compliance` §1 across **all** of `apps/`, not just this feature. Earlier features can drift.
- `rg -n "from ['\"].*tokens/tokens" apps` returns nothing. Apps use the generated outputs, never the source.
- Primitives live only in `packages/design-system/src/components`. Look for look-alikes in feature folders (`rg -n 'export (function|const) (Button|Input|Dialog|Card|Select)\b' apps`).
- Every primitive exported from `components/index.ts` appears in the style guide's Components section, and vice versa.
- Contrast script from the design-system skill still passes, and gives the same ratios as the style guide's table.
- If mobile exists: `theme.native.ts` is regenerated and native primitives have the same names and props as web (compare the exports).

### 1.2 Rendered (full mode, or when the feature changed the shell or a primitive)

Run the web app locally and take Playwright screenshots of the sign-in screen, the main authenticated screen and the feature's screens at 375 px and 1280 px (light, and dark if enabled). Compare them with the matching mocks in `docs/style-guide.html`. Check fonts load from the self-hosted package, colours and radii match, the focus ring is visible (tab through), and there's no default browser styling. Save screenshots to `docs/verification/<date>/` and attach the paths to the report.

### 1.3 Accessibility and UX states (full mode, or when the feature added screens)

The builder already ran these in `compliance`. Re-run them independently, following `.claude/skills/accessibility/SKILL.md`:

- `e2e/a11y.spec.ts` (axe) over **every** screen, not just this feature's. Compare against `docs/ACCESSIBILITY.md`: a violation not listed as an owner-accepted exception is a finding.
- Keyboard-only walk of the PRD's critical path (sign in → main flow → sign out), and a VoiceOver pass of the same. Record where focus goes after each step.
- Reduced motion: one Playwright run of the smoke test with `reducedMotion: 'reduce'`.
- UX states on the critical path: with the API stopped, and with the network offline, every screen shows a helpful state (no blank screen, no fake success, input kept). See `ux` Part B.

Severity comes from `accessibility` §8. Accessibility findings the owner has knowingly accepted (recorded in `docs/ACCESSIBILITY.md`) are listed but not counted in `openFindings`. Undecided critical/high ones block `done` like any other finding until fixed or decided.

## 2. Security audit

### 2.1 Route inventory — nothing unprotected by accident

Generate the real list of routes from the running app, not from memory. In a small script or test, import the Hono app and print `app.routes` (method + path), or use `showRoutes` from `hono/dev`.

Build this table for **every** route and put it in the report:

| Method | Path | Public? (and why) | Auth middleware | Zod validator | Authorisation rule | Rule source (DATA-MODEL matrix row) |
|---|---|---|---|---|---|---|

- The allowed public routes are explicit: `GET /health`, and anything DATA-MODEL.md marks public. Any other route without the auth middleware is **critical**.
- Any route with no validator on its params, query or body is **high**. Use the exact names used in §3 (critical, high, medium, low).
- Any non-public route with no authorisation rule beyond "is signed in" is **high**, unless the matrix really says "any signed-in user".

Then prove it with real requests. For every non-public route, call it locally with no token, a malformed token, and an expired or wrongly signed token. All must return `401` with the standard error shape.

### 2.2 Authentication

- The API verifies the token cryptographically: Supabase `auth.getUser(token)` / `auth.getClaims()` or JWKS verification. It never just base64-decodes the JWT. It checks expiry. It doesn't accept `alg: none` or a token from another project.
- User identity comes **only** from the verified token (`c.var.user`). Grep route handlers and services for `userId`, `user_id`, `owner_id`, `tenant_id`, `org_id` read from `c.req` (body, query, params, headers). Using any of these as *who is calling* is **critical**.
- Authorisation decisions never read `user_metadata` (users can edit it themselves). Roles come from `app_metadata`, a membership table, or a custom claim set server-side. Check both API code and RLS policies (`rg -n 'user_metadata' apps supabase`).
- Service-role key appears only in `apps/api`. Build every client (`pnpm build`) and grep the output: `rg -n 'service_role|SERVICE_ROLE|sb_secret_' apps/web/dist apps/site/dist apps/mobile` → zero hits. Also check that every `VITE_*`, `PUBLIC_*` and `EXPO_PUBLIC_*` variable holds only public values.

### 2.3 Auth pages and flows — actually use them

Run each flow in the browser locally (Playwright where practical; Supabase's local email inbox — see `supabase status` for its URL — catches emails). Each one must work end to end:

- **Sign up** (if enabled): creates the user and the `profiles` row. Email confirmation link works. Duplicate email gives a neutral message.
- **Sign in**: wrong password and unknown email show **the same** message (no way to check which emails have accounts). Success lands on the intended page.
- **Password reset / magic link / OTP** (whichever are enabled): the email arrives, the link or code works once, then stops working. The reset page requires the recovery session. Can't be reused.
- **Callback / redirect handling**: any `redirect`, `next` or `returnTo` parameter only accepts same-origin relative paths. Try `?next=https://evil.example` and `?next=//evil.example`. Both must be ignored (open redirect = **high**). Supabase redirect allowlist (`additional_redirect_urls`) contains only this project's URLs, no wildcards on shared domains.
- **Protected pages**: open each authenticated URL directly in a signed-out browser. You're sent to sign-in with no flash of data. After signing in, you're returned to that page.
- **Sign out**: clears the session **and** the client data cache (React Query `queryClient.clear()` or equivalent). Sign in as user B in the same tab: no trace of user A's data. The back button after sign-out shows no data.
- **Session expiry**: with an expired access token, the app refreshes silently or sends the user to sign-in. No blank screen, no error loop.
- **Installable app on iOS** (if PWA): the sign-in method works from the home-screen app (see pwa skill, "Auth gotcha to raise with the owner").

A broken or missing flow is **high**. A flow that leaks data between users is **critical**.

### 2.4 Authorisation and multi-tenant isolation — test with real users

Read the "Who can do what" matrix in `docs/DATA-MODEL.md`. Make sure `supabase/seed.sql` has, at minimum:

- two separate tenants (organisations, workspaces, accounts — whatever DATA-MODEL calls them), or two unrelated owners if single-user;
- in each tenant, one user per role (e.g. owner/admin, member, viewer);
- one signed-in user with no membership;
- at least one row of every table in each tenant.

Then write the matrix as an **automated test that stays in the repo** (`apps/api/src/__tests__/authz.matrix.test.ts`, running against the local stack), so every later change is checked again. For **every route × every actor** (anonymous, each role in tenant A, tenant-B user, no-membership user):

- expected status from the matrix (`200/201`, `401`, `403`, or `404`; prefer `404` for other tenants' resources so ids can't be probed);
- **cross-tenant reads**: tenant-B user requests tenant-A resources by id → not found. List endpoints return zero tenant-A rows. Search, filters, counts and exports too;
- **cross-tenant writes**: update or delete a tenant-A id as tenant B → no change in the database (check the row afterwards, not just the status);
- **mass assignment**: send `owner_id`, `tenant_id`, `org_id`, `role`, `created_by`, `id` in create or update bodies → ignored or rejected. Zod schemas for writes must not include server-owned fields;
- **role escalation**: a member can't change their own role, invite into a tenant they don't administer, remove the owner, or add themselves to another tenant;
- **nested resources**: `/projects/:projectId/tasks/:taskId` checks that the task belongs to that project **and** the project belongs to the caller's tenant;
- **service-role paths**: the API's service-role client bypasses RLS, so every query through it must filter by the caller's tenant or ownership explicitly. List each service-role query in the report with its scoping clause. Any missing clause is **critical**.

**RLS directly, not through the API.** Clients hold the anon/publishable key, and Supabase's REST API is reachable from the internet. So the database has to protect itself:

```sql
-- every table in exposed schemas has RLS on (expect zero rows)
select schemaname, tablename from pg_tables
where schemaname in ('public') and rowsecurity = false;
-- tables with RLS on but no policies (locked, or forgotten) — review each
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname);
```

- Using `supabase-js` with the anon key, signed in as each seeded actor, `select`/`insert`/`update`/`delete` on every table. Results must match the matrix. Tenant-B sees zero tenant-A rows.
- Policies: no `using (true)` on anything non-public, `with check` present on insert and update, policies scoped `to authenticated` where appropriate.
- Views: `security_invoker = true` (or not exposed). `security definer` functions: `set search_path = ''`, not callable by `anon` unless intended, and they check the caller themselves.
- Storage buckets: private unless DATA-MODEL says public. Object policies scope paths by tenant or user.
- Run `supabase db lint`. In full mode, once hosted exists, also have the owner open the hosted **Security Advisor** (follow `.claude/skills/guide-owner/SKILL.md`; link pattern in its §4) and report every warning.

### 2.5 Common vulnerabilities

- **Dependencies**: `pnpm audit --prod`. Critical or high with a fix available → upgrade (per `choosing-versions`). Without a fix → note whether the vulnerable code path is used.
- **Secrets in git**: `git ls-files | rg '(^|/)\.env|\.dev\.vars'` → only `.env.example` files. `git log -p --all | rg -n 'service_role|sb_secret_|eyJhbGciOi|-----BEGIN|sk_live_|ghp_'` → review every hit. A real secret ever committed is **critical**: rotate it (guide the owner), don't just delete the file.
- **CORS**: origins from env, never `*` on authenticated routes. Test an `Origin: https://evil.example` preflight → not allowed.
- **Security headers** on the web and site Workers: `Content-Security-Policy` (at least `frame-ancestors 'none'` or `'self'`, `object-src 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`. Check with `curl -sI` against `wrangler dev` / preview.
- **XSS**: `rg -n 'dangerouslySetInnerHTML|set:html|innerHTML\s*=' apps` → each hit must render only trusted or sanitised content.
- **Injection**: no SQL or filter strings built by concatenating user input (`rg -n '\.(rpc|or|filter|textSearch)\(' apps/api` and inspect). Postgres functions use parameters, not `execute format(...)` with raw input.
- **Error leakage**: force a 500 and a Postgres constraint error. The response body contains only `{ error: { code, message } }` with a request id. No stack, SQL or table names.
- **Rate limiting / abuse**: sign-in-adjacent, invite, email-sending, upload and expensive routes have a Cloudflare rate-limiting rule or binding. Missing on a public or email-sending route is **medium** (or **high** if it sends email to arbitrary addresses).
- **Uploads**: size limit, content-type allowlist, stored under a tenant/user path, served via signed URLs.
- **Webhooks**: signature verified before parsing. Replay protected (timestamp or id).
- **IDs**: resources addressed by uuid, not guessable sequential ids.

### 2.6 Personal data in logs — client and server

List the PII fields from `docs/DATA-MODEL.md` (typically email, name, phone, address, date of birth, IP, payment details, free-text notes) plus always-sensitive values: passwords, tokens, `Authorization` headers, cookies, reset links, one-time codes.

**Server (`apps/api`)** — Workers logs are kept and are visible in the Cloudflare dashboard:

```bash
rg -n 'console\.(log|info|warn|error|debug)|logger\.(info|warn|error|debug)' apps/api/src
```

For every hit, check what's actually being logged. Findings:
- whole request bodies (`await c.req.json()` passed to a logger), whole headers, `c.req.raw`, user or profile objects, Supabase `session`/`user` objects, query results → **high** (**critical** if tokens or passwords);
- emails, names or other PII in log messages → **medium**. Log ids (user id, tenant id, request id) instead;
- error logging that dumps objects which may contain request data → make sure the error handler logs `code`, `message`, `requestId`, `stack`, not the input.

Recommend a single `redact()` helper in `apps/api/src/lib/log.ts` if more than one place needs it.

**Client (`apps/web`, `apps/mobile`, `apps/site`)**:

```bash
rg -n 'console\.(log|info|debug|warn|error)' apps/web/src apps/mobile apps/site/src --glob '!**/node_modules/**' --glob '!**/*.test.*'
pnpm --filter web build && rg -n 'console\.(log|debug|info)' apps/web/dist   # production bundle
```

- No PII, tokens or API responses logged in the browser or app console.
- Error reporting or analytics (Sentry, PostHog, etc., if added): `sendDefaultPii` off, no email/name in events or user context beyond an id, request bodies and `Authorization` scrubbed from breadcrumbs.
- No PII in URLs (query strings end up in server logs, browser history and `Referer`). Search `navigate(` / `href=` / `searchParams.set(` for emails or names.
- Storage: nothing beyond the Supabase session in `localStorage`/`sessionStorage`. Persisted query caches don't hold PII unless there's an ADR. Mobile uses `expo-secure-store` for tokens, never `AsyncStorage`.
- Error messages shown to users contain nothing about other users.

## 3. Severity and what happens next

| Severity | Examples | Consequence |
|---|---|---|
| **critical** | unprotected data route; cross-tenant read or write; RLS off on a table; service-role key in a client bundle; secret in git history; identity taken from the request body | Fix now. Feature can't reach `done`. **Deploy is blocked**. If it's already live, tell the owner immediately in plain language and recommend deploying the fix before anything else. |
| **high** | missing validator; open redirect; broken auth flow; tokens or whole bodies logged; role escalation | Fix before `done`. Deploy is blocked. |
| **medium** | PII in log messages; missing rate limit; missing security header; dependency advisory with no reachable path | Fix now if small. Otherwise ask the owner (per `explain-decisions`) whether to fix now or add a `security` backlog item in Next (backlog skill). Deploy allowed. |
| **low** | hardening, tidy-ups | Add a `security` backlog item in Later. |

After fixes, re-run **only the failed checks** plus the matrix test, and record the before and after.

## 4. Output

Write `docs/verification/YYYY-MM-DD-<F00N|scaffold|full>.md`:

```markdown
# Verification — F00N <title> (scoped | full) — YYYY-MM-DD

## Summary for the owner
<2–4 plain sentences: what was checked, what was found, what was fixed, anything they need to decide. No jargon.>

## Design system
tokens in sync ✓ · style guide matches ✓ · lint rules on ✓ · project-wide raw-value scan ✓ · contrast ✓ · screenshots: docs/verification/…/

## Accessibility and UX states
axe: 0 serious/critical (N accepted exceptions) · keyboard critical path ✓ · VoiceOver ✓ · reduced motion ✓ · API down / offline states ✓

## Route inventory
<table from §2.1>

## Findings
| # | Severity | Area | Finding | Evidence (command / request + result) | Status |
|---|---|---|---|---|---|

## Checks run
<list of commands and tests with pass/fail — enough that someone could re-run them>

## Not covered
<anything skipped and why — e.g. hosted Security Advisor pending owner, mobile not built yet>
```

PROGRESS entry (short): mode, counts by severity, link to the report, and the next step. Update `.claude/state.json → verification` (`lastFull`, `lastReport`, `openFindings` by severity).

Tell the owner the summary in plain words (`explain-decisions`). Be honest about the limits: this is a thorough automated and manual check, **not** a professional penetration test. If the PRD involves payments, health, children's data or other sensitive information, recommend an external security review before launch, and say roughly what that involves.

Then `/build` moves to `docs`.
