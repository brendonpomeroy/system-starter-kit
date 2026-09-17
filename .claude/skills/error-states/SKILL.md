---
name: error-states
description: What the person using the app sees and can do when something goes wrong — plain-language messages that say what happened, whether their work is safe and what to do next; the right placement (field, region, page, toast, banner); a catalogue mapping every API error code to a message and action; handling for validation, expired sessions, no access, not found, conflicts, rate limits, server and network failures, offline, partial failures, crashes and failed background jobs; never losing the user's input; preventing errors before they happen; accessible announcements; and tests that force each error. Complements code-quality's technical error plumbing. Called by the ux stage when planning a screen's states, by design-system for the error primitives, and by debugging when a fix changes what users see.
---

# error-states — errors that help people recover

`code-quality` §3 makes errors *travel correctly*: `AppError` in the API, one `{ error: { code, message } }` shape, a typed `ApiError` on the client, error boundaries. This skill decides what the **person** sees and can do next.

A good error message answers three questions, in this order:

1. **What happened?** In the user's words, not the system's.
2. **Is my work safe?** Say so when it is. Make sure it is.
3. **What can I do now?** A button or a clear next step. "Try again" is only useful if trying again might work.

## 1. Writing the message

- Plain, calm, specific. No codes, stack traces, Postgres messages, "Error 500", "Something went wrong" on its own, or exclamation marks.
- Don't blame the user ("You entered an invalid date"); describe what's needed ("Enter a date after today").
- Name the thing: "We couldn't save **Website refresh**", not "Save failed".
- Put the action on the button with a verb: "Retry", "Sign in again", "Reload the latest version", not "OK".
- For unexpected errors, include a short reference the user can quote to support: "Reference: 7f3a2c" (the request id: not personal data).
- Same terms as the PRD and the rest of the UI.

| Instead of | Write |
|---|---|
| Error: 23505 duplicate key value violates unique constraint | A project called "Website refresh" already exists. Choose a different name. |
| Invalid input | Enter an email address, like name@example.com. |
| Unauthorized | Your session has ended. Sign in again — your changes are kept. |
| Forbidden | You don't have access to this project. Ask its owner, Alex, to invite you. |
| Something went wrong | We couldn't load your invoices. Check your connection and try again. (Reference: 7f3a2c) |
| Network Error | You're offline. We'll save your changes when you're back online. *(only if that's true)* |

## 2. Where the error appears

| Placement | Use for | Rules |
|---|---|---|
| **Inline field** | validation of one field (client or server) | Below the field, text + icon, `aria-invalid` + `aria-describedby`. Appears on blur or on submit, then updates live as the user fixes it. Never while they're still typing their first attempt. |
| **Form summary** | submit rejected; long forms with several errors | At the top of the form: "Fix 2 things to continue", with links to each field. Focus moves here (or to the first invalid field on short forms). |
| **Region** | one part of a page failed to load | Replaces *that region* with `ErrorState`: message + Retry. The rest of the page keeps working. |
| **Page** | the page's main data failed, not found, no access, route crashed | Full `ErrorState` in the page body, shell still visible, with a way forward (Retry, back to list, home). |
| **Toast** | a mutation the user just triggered failed, when the form or item isn't on screen anymore (or for optimistic rollback) | Error toasts **persist** until dismissed, include the action (Retry / Undo) *and* that action is also available elsewhere, because toasts are easy to miss (a screen reader user may not reach it in time). Never the only record of an important failure. |
| **Banner** | app-wide conditions: offline, degraded service, maintenance, read-only mode, session expiring soon | Top of the shell, `InlineAlert` style, stays until the condition clears. |

## 3. Error catalogue — every case has a planned UX

The API's error `code` values are a shared enum in `@<project>/api-types` (`ErrorCode`). Each client has `apps/<app>/src/lib/error-messages.ts`:

```ts
export const errorMessages = {
  VALIDATION_FAILED: { title: "Check the highlighted fields", action: "fix-fields" },
  UNAUTHENTICATED:   { title: "Your session has ended", body: "Sign in again — your changes are kept.", action: "reauth" },
  // …
} satisfies Record<ErrorCode, ErrorCopy>;
```

`satisfies Record<ErrorCode, …>` makes TypeScript fail the build when the API adds a code with no message. Web and mobile use the same keys and copy. Feature-specific codes (`PROJECT_NAME_TAKEN`) belong in the enum too, and their copy can take parameters.

| Situation (status / code) | What the user sees | What the app does |
|---|---|---|
| **Field validation** (400 `VALIDATION_FAILED` with field paths; or client Zod) | Inline field errors; summary on long forms | Map Zod paths to fields (`setError`); focus first invalid; keep all input. Same Zod schema on client and server, so most errors are caught before sending. |
| **Business rule** (409/422, specific code, e.g. `PROJECT_NAME_TAKEN`) | Inline on the relevant field if there is one, otherwise form summary | Specific message from the catalogue. |
| **Session expired** (401) | Dialog or banner "Your session has ended — Sign in again" | Try a silent token refresh first. If that fails: **keep the unsaved form state** (in memory, or `sessionStorage` without sensitive fields), sign in (in a dialog where possible), then retry or restore and return to the same page. |
| **No access** (403) | Page: "You don't have access to <thing>" + who can give access, if known + link home | Don't retry. Don't show what the thing contains. |
| **Not found** (404) | Page: "This <project> doesn't exist or was deleted" + link to the list | Remove stale cache entries for that id. Same message for other tenants' ids (verification prefers 404). Unknown route → shell 404 page with search/home. |
| **Conflict** (409 `STALE_VERSION`) — someone else changed it | "Alex changed this project while you were editing." Options: "See their changes" / "Keep mine" (overwrite) — or a merge view if the data allows | Needs a version column or `updated_at` check (a data-model decision; ask via explain-decisions if the PRD has collaborative editing). Never silently overwrite. |
| **Too many requests** (429) | "Too many attempts. Try again in 30 seconds." with countdown | Read `Retry-After`. Disable the action until then. On sign-in, don't reveal whether the account exists. |
| **Payload too large / wrong file type** (413/415) | Inline on the upload control: "Files must be under 10 MB" / "Upload a PDF or image" | Check size and type on the client before uploading. |
| **Server error** (5xx `INTERNAL`) | Region or toast: "We couldn't <do thing>. Try again." + Reference | Queries: automatic retry with backoff (React Query default, max 2–3; never retry 4xx). Mutations: no automatic retry unless idempotent; offer Retry with the same idempotency key. |
| **Network failure / timeout** | "Couldn't connect. Check your connection and try again." | Same as 5xx. Distinguish from server errors in copy. Timeout for slow requests (e.g. 15 s) rather than hanging forever. |
| **Offline** (`navigator.onLine` false / NetInfo) | Banner "You're offline" | Reads show cached data marked as possibly out of date. Writes: disabled with explanation, *or* queued, **only** if state-management chose offline support. Don't pretend a write succeeded. Banner clears and queries refetch on reconnect. |
| **Partial failure** (bulk actions, imports) | "18 of 20 invoices sent. 2 couldn't be sent:" + list with reasons + "Retry the 2" | API returns per-item results; never report the batch as all-or-nothing when it wasn't. |
| **Render crash** (error boundary) | Page-level: "This page hit a problem. Reload the page" + Reference; shell and navigation still work | Boundary per page and at the shell (code-quality). Report to error tracking if the project has it. Reload clears the boundary. |
| **Stale app after deploy** (chunk load failure) | Nothing, or a one-time reload | Handled by the pwa skill's `vite:preloadError` reload, used for all web apps. |
| **Background job failed** | Status on the job's row ("Export failed — Retry") + toast/notification if the user is elsewhere | Job record stores a safe error code, never raw provider messages. |
| **Third-party down** (payments, email provider) | "Payments are temporarily unavailable. Your basket is saved — try again in a few minutes." | Never double-charge on retry (idempotency). Banner if it affects the whole app. |

## 4. Never lose the user's work

- Failed submits leave every field as it was, including file selections where the platform allows.
- Long forms (more than ~5 fields, or free text over a sentence) keep a local draft (`sessionStorage`, or `localStorage` with an expiry) until submitted successfully. Never store passwords, payment details or other sensitive fields.
- Navigating away from unsaved changes asks first (router blocker + `beforeunload`). Only when there really are unsaved changes.
- Re-authentication returns the user to the same place with their work.

## 5. Prevent before explaining

The best error is one that can't happen:

- Constrain inputs (date pickers with min/max, `type`, `inputMode`, max length shown as a counter).
- Validate on the client with the shared Zod schema before sending.
- Explain *why* an action isn't available instead of a mysterious disabled button (help text or a tooltip that also works on focus). Better still, keep it enabled and explain on click.
- Confirm destructive actions, or better, offer **Undo** (see the ux skill).
- Sensible defaults and remembered choices.

## 6. Accessibility

- Errors are text, with an icon; never colour alone.
- Inline field errors: `aria-invalid="true"`, message linked with `aria-describedby`; on submit, focus the summary or first invalid field.
- Errors that appear after a user action without moving focus (toast, region error after Retry) use `role="alert"` (assertive) for failures that block the task, and `role="status"` for less urgent ones. Don't make every error assertive.
- Error pages set the document title ("Not found — <App>") and focus the heading.
- Retry buttons have specific names ("Retry loading invoices") when there are several on a page.
- Time-limited toasts don't hold the only copy of an action.

## 7. Design-system pieces

Primitives (design-system skill): `ErrorState` (icon, title, body, action slot, optional reference), `InlineAlert` (tones: info, success, warning, danger; used for banners and form summaries), `FormField` error slot, `Toast` with `tone="danger"` and persistent option. Style guide Patterns shows: field error, form summary, region error with retry, 404 page, offline banner, error toast with retry, conflict dialog.

## 8. Testing

- **Handlers per error class (MSW):** for each hook/screen in the feature, tests for at least: 400 with field paths → fields show messages; 401 → re-auth path keeps input; 403/404 → page state; 500 → region error with Retry, and Retry refetches; network error → connection copy.
- **Catalogue completeness:** TypeScript `satisfies` does it. Add a test that every `ErrorCode` has non-empty `title` copy.
- **API side (code-quality):** error responses never include internals (verification §2.5 checks too).
- **Playwright (critical path):** `context.setOffline(true)` mid-flow → offline banner, no blank screen, no false success; back online → recovers.
- **By hand:** kill the API (`Ctrl+C` on `wrangler dev`) with the web app open and click around: every screen degrades to a helpful state.

## 9. Checklist (used by the ux review)

- [ ] Every async region and every action has a planned error state and placement.
- [ ] Messages say what happened, whether work is safe, and what to do, in PRD terms, with no internals.
- [ ] Every API error code used by the feature has catalogue copy.
- [ ] Input is never lost on failure; re-auth returns to the same place.
- [ ] Queries retry automatically only for network/5xx; mutations only when idempotent.
- [ ] Offline and slow network handled honestly (no fake success).
- [ ] Error toasts persist and their action exists elsewhere.
- [ ] Errors are announced appropriately and never rely on colour.
- [ ] Tests force each error class the feature can hit.
