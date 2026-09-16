---
name: state-management
description: Decide how data flows for a feature, per codebase — server state vs client state, caching, mutations, realtime, offline — and record the decision. Called by /build as the second stage of every feature. Includes the rule to re-validate the approach when transaction rates or cloud side-effects make a query cache messy, rather than over-committing.
---

# state-management — decide, don't default

State management is decided **per codebase and per feature**, not once for the project. The only fixed rule is the classification below; the tools follow from the feature's actual load and side-effects. Record the decision in the feature's PROGRESS entry; write an ADR the first time each app adopts a library.

## 1. Classify every piece of state in the feature

| Kind | Definition | Lives in |
|---|---|---|
| **Server state** | Comes from the API/DB; other users or processes can change it | a fetch layer with caching (see §2) |
| **Client state** | Only this device cares: filters, open panels, draft forms, wizard step | component `useState`, or a small store if shared across the feature |
| **URL state** | Should survive refresh/sharing: selected id, page, filters | the router (search params) — not a store |
| **Session state** | Who is logged in | Supabase auth listener → one context/store at the app root |
| **Form state** | Field values, validation, dirty/submitting | a form library (`react-hook-form` + the Zod schema from `@<project>/api-types`) — never a global store |

If something is server state, the client never owns the truth of it. If it's client state, it never goes through the API.

## 2. Server state — pick per feature by load profile

Ask, for this feature: how often does the data change, how many writes per minute at peak, and what happens after a write (emails, webhooks, payments, third-party calls)?

| Profile | Approach | Notes |
|---|---|---|
| **Read-mostly, low write** (settings, profiles, lists edited by one person at a time) | `@tanstack/react-query` around `hc` calls. Query keys `[resource, id?, params?]`. Mutations invalidate the resource key. | The default. Simple, cached, retries for free. |
| **High transaction rate** (many users writing the same rows; counters; queues; anything > ~1 write/sec on shared data) | **Re-validate before committing to a query cache.** Options in order: (a) server-authoritative reads after every write, no optimistic updates; (b) Supabase Realtime (`postgres_changes` or broadcast) feeding a small store that *is* the cache, with Query only for initial load; (c) polling with a short interval if realtime isn't warranted. | Optimistic updates + invalidation get very messy here: stale flashes, double-applied changes, invalidation storms. Say so in the ADR and pick (a)/(b)/(c) deliberately. |
| **Cloud side-effects on write** (payment, email, external API, long job) | Treat the write as a *command*, not a cache update: POST returns a job/record id, UI shows pending state, completion arrives via a status query or realtime. Never optimistic. | Idempotency key on the request (`crypto.randomUUID()` per submit) so retries don't double-charge/double-send. |
| **Offline-capable** (mobile field use) | Only if the PRD's mobile need says offline. Local-first store (e.g. an SQLite/`expo-sqlite` layer or a sync engine) with explicit sync; not Query's cache. | Big decision → ADR, and confirm with the owner, because it changes the API design (versioning, conflict rules). |
| **Static / rarely changing** (reference lists, enums) | Fetch once at app start into a context, or ship with the bundle. | Don't put a cache around what never changes. |

**The re-validation rule.** Whenever a feature's profile changes (a list that was "my projects" becomes "everyone's live orders"), or you notice invalidation logic growing conditionals, stop and re-classify. Write the finding in PROGRESS and an ADR if the approach changes. Over-committing to one pattern is more expensive than switching early.

## 3. Client state — smallest thing that works

1. `useState` in the component.
2. Lift to the nearest common parent.
3. `useReducer` when transitions have rules.
4. A feature-local store (`zustand`, one file in `features/<f>/state/`) when three or more components in the feature need it and lifting makes props absurd.
5. App-level store only for session, theme, toasts. Nothing else.

Never mirror server state into a client store "for convenience". That creates two truths.

## 4. Per-codebase notes

**apps/web (Vite + React)** — Query is available by default (`pnpm --filter web add @tanstack/react-query` on first use; `QueryClientProvider` at root; devtools in dev). `hc` client in `lib/api.ts` attaches the Supabase access token. Session via `supabase.auth.onAuthStateChange` in `features/auth/useSession.ts`. URL state via router search params.

**apps/mobile (Expo)** — same libraries and hook names as web so feature code is portable. Add `onlineManager`/`focusManager` wiring for React Native (AppState + NetInfo) when Query is used. Secure token storage via `expo-secure-store`. Be more conservative about background refetching (battery, data).

**apps/site (Astro)** — no client state framework. Static pages; islands use `useState` only. Any data comes at build time or from a public API route, never from Supabase directly.

**apps/api (Hono)** — stateless per request. Per-request context via `c.set/c.get` (user, request id). No in-memory caches across requests (Workers isolates aren't shared); use Supabase or Cloudflare KV/Durable Objects only if a feature's profile demands it — that's an ADR. Long work → Cloudflare Queues or a `jobs` table + a scheduled Worker; never `await` a slow third party inside the request path when the user is waiting.

**Supabase** — RLS is the last line of defence, not the state layer. Realtime is enabled per table only when a feature needs it; record which tables in DATA-MODEL.md.

## 5. What this stage produces

```markdown
### F00N — state decision
| State | Kind | Approach |
|---|---|---|
| project list | server, read-mostly | Query `['projects', params]`, invalidate on create/update |
| selected filter | URL | search param `?status=` |
| new-project draft | form | react-hook-form + ProjectCreateSchema |
| session | session | existing useSession |
Side-effects on write: none · Realtime: no · Idempotency: n/a
Re-validate if: project list becomes shared across >1 team editing concurrently.
```

Then `/build` moves to `build`.
