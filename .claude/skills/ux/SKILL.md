---
name: ux
description: Plan and review how each feature feels to use — a screen state map covering loading, empty, error, success, offline and transitions for every screen and action; feedback for every action; empty states and first-time use; forms that are quick to fill and never lose work; undo versus confirmation for destructive actions; navigation, wayfinding and preserved context; clear copy and locale-aware dates and numbers; toasts and notifications; touch ergonomics; and an accessibility pass. Pulls in the accessibility, loading-states, error-states and motion skills. Called by /build as the ux stage of every feature (after state, before build), and its review half is walked inside design-compliance. Also used when a bug fix or change alters what users see.
---

# ux — how it feels to use, planned before it's built

`component-breakdown` decides *what* is on each screen. `state-management` decides *where data lives*. This stage decides **what the person experiences in every situation**: while it loads, when there's nothing there yet, when it fails, when it works, and how the screen moves between those.

Most bad UX is unplanned states: a blank screen while loading, "No data" where onboarding should be, a toast that vanishes with an important error, a form that clears itself on failure. Planning them takes ten minutes. Retrofitting them is a rewrite.

Specialist skills this stage loads (read the relevant sections, not all of them every time):

| Topic | Skill |
|---|---|
| Keyboard, screen readers, zoom, contrast, owner trade-offs | `.claude/skills/accessibility/SKILL.md` |
| Skeletons, spinners, progress, optimistic updates | `.claude/skills/loading-states/SKILL.md` |
| Error messages, placement, recovery | `.claude/skills/error-states/SKILL.md` |
| Transitions, animation, reduced motion | `.claude/skills/motion/SKILL.md` |

## Part A — Plan (the `ux` stage)

Input: the approved breakdown and the state decision for this feature. Output: the UX plan in PROGRESS (§A6). Show the owner only the parts that change what their users see *and* involved a choice (§A5). The rest is for you.

### A1. The screen state map

For every screen, every independently loading region and every user action, fill in:

```markdown
| Screen / region / action | Loading | Empty | Error | Success feedback | Transition | Focus & announce |
|---|---|---|---|---|---|---|
| ProjectListPage — list | skeleton 6 rows after 300ms; refetch keeps rows + top bar | first-run: "Create your first project" + CTA · no results: "No projects match 'x'" + Clear filters | region ErrorState + Retry | — | rows fade in | h1 focused on route enter; results count announced after search |
| Create project (dialog form) | button "Creating…" | — | fields inline; name taken → field; 5xx → form summary, input kept | dialog closes, list shows new row highlighted, no toast (visible on screen) | dialog scale+fade; row expand+highlight | focus returns to "New project" button; "Project created" announced |
| Delete project | button pending in row menu | — | toast persistent + Retry | row collapses; toast "Project deleted · Undo" 8s | row collapse | focus to next row; toast is role=status |
```

Rules for each column come from the specialist skills. Every cell is filled or `n/a — <reason>`.

Also note, per screen: **offline behaviour** (read-only with cached data? disabled writes?), **permission variations** (what a viewer vs an admin sees; hide or explain unavailable actions), and **long/odd content** (a 200-character name, 0 / 1 / 10,000 items, missing avatar, RTL or accented names).

### A2. Feedback for every action

- Something visibly responds within ~100 ms of every tap or click (pressed state, pending button, optimistic change).
- Confirm success **in proportion**:
  - the result is visible where the user is looking (item appears, toggle flips) → no toast; highlight the change briefly;
  - the result is off-screen or the screen changes (dialog closes, navigated away, background job) → toast, or a highlight at the destination;
  - something important and irreversible happened (payment, invitation sent, submitted for review) → a clear confirmation screen or message with what happens next.
- Never a success message for something that hasn't actually succeeded on the server (unless state-management chose optimistic, which rolls back loudly on failure).

### A3. Patterns to apply

**Empty states** — three different situations, three different messages:
- *First use* ("You don't have any projects yet"): explain the value in one line, one primary action, maybe an illustration from the design system. This **is** the onboarding; no product tours by default.
- *No results* (search/filter): say what was searched, offer "Clear filters".
- *Cleared / done* (inbox zero, all tasks complete): a small positive message.
Never "No data", and never an empty table with just headers.

**Forms**
- Labels above fields; mark optional fields (or required ones, whichever is rarer) in text.
- Ask only for what the PRD needs; defaults for everything else. Group long forms into sections; multi-step only if it's really long, with a step indicator and back without losing input.
- `type`, `autocomplete`, `inputMode` so phones show the right keyboard and autofill works.
- Validation timing: on blur, then live once a field has an error, and all fields on submit (error-states §2).
- Submit button: verb + noun ("Create project"), enabled until pending; Enter submits single-line forms.
- **Save model** per form, decided in this plan: explicit Save (default), or autosave with a visible "Saved · 2s ago" status (settings pages, long documents). Never a mix on one screen.
- Unsaved changes warning on navigation; drafts for long forms (error-states §4).

**Destructive and irreversible actions**
| Situation | Pattern |
|---|---|
| Reversible and frequent (archive, remove from list, mark done) | Do it immediately + **Undo** in the toast (~8 s) and a way to restore later (Archived view). Needs soft delete or a delayed commit, a data-model decision (§A5). |
| Irreversible, occasional (delete a project with its tasks) | `Dialog` confirmation naming the thing and the consequence: "Delete 'Website refresh' and its 14 tasks? This can't be undone." Buttons: "Cancel" (focused by default) and "Delete project" (danger). |
| Catastrophic (delete the account or organisation, remove all data) | Confirmation where the user types the name, plus an email/notice afterwards. |
Don't confirm things that aren't destructive ("Are you sure you want to save?").

**Navigation and wayfinding**
- Every page has a clear title (h1 + document title) and the active nav item is marked.
- Deep hierarchies (more than 2 levels) show breadcrumbs or a back link to the parent; installable/mobile screens always have an in-app back. Each screen is top-level (in the main nav, no back), pushed (back to a declared parent) or a focused flow (Close/Cancel); back must still work when the screen was opened from a link, and redirects and submitted forms don't stay in history (pwa skill §7, which applies to every web app, installed or not).
- **Preserve context:** filters, sort, tab and pagination live in the URL (state-management), so back/refresh/share keep them. Scroll position is restored when returning to a list. After creating an item from a list, return to the list with it visible.
- Deep links work: a signed-out user opening a link signs in and lands on that page.
- Primary action in a consistent place per screen type (page header on desktop; bottom or floating on mobile within thumb reach).

**Copy and content**
- Terms from the PRD, used identically everywhere. Sentence case. Buttons are verbs. Plain words at roughly a 12-year-old reading level for consumer apps.
- Dates, times, numbers and currency via `Intl` (`Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.RelativeTimeFormat`) in the user's locale, never hand-formatted strings. Relative times ("2 hours ago") show the full date on hover/focus (`<time dateTime title>`). Store UTC; display in the user's time zone; say the zone where it matters (bookings, deadlines).
- Plurals handled ("1 project", "2 projects": `Intl.PluralRules`).
- Truncate long text with an ellipsis and make the full text reachable (title/tooltip/detail view); never cut off the only identifying text.
- Keep UI strings in the component for now; if the PRD mentions more than one language, raise i18n as a decision before the first feature (it's much cheaper early).

**Toasts and notifications**
- One region, bottom (mobile) or bottom-right (desktop), max ~3 visible, newest on top.
- Success/info: auto-dismiss after ~5 s, paused while hovered or focused. Errors: persist (error-states §2).
- A toast's action (Undo, Retry, View) is also reachable elsewhere; toasts are `role="status"` via the shell announcer.
- Don't toast things the user can already see, and don't stack a toast on every item in a bulk action. One summary toast.

**Touch and small screens**
- Targets ≥ 44 px, with space between destructive and primary actions.
- Primary actions within thumb reach on phones; no essential hover-only UI.
- Inputs don't get hidden by the on-screen keyboard; dialogs become full-height sheets on small screens.
- Tables become cards or scroll within their container (design-compliance).

**Trust and safety cues** (where the feature touches them)
- Say who will see something before it's shared ("Visible to everyone in Acme").
- Show what happens next after irreversible steps; show sending states for emails/invites.
- Sign-out, session expiry and permission changes never silently drop unsaved work.

**Accessibility** — every item in `accessibility` §5 applies. In this plan, note only the feature-specific parts: focus destination after each action, what gets announced, keyboard alternatives for any drag or gesture, and any conflict with the owner's wishes (which goes to §A5).

**Motion** — pick transitions from `motion` §2 for each state change in the map. Nothing bespoke without a reason.

### A4. Primitives and patterns check

List every loading/empty/error/feedback piece the plan needs and confirm it exists in the design system and style guide (`Skeleton`, `Spinner`, `ProgressBar`, `EmptyState`, `ErrorState`, `InlineAlert`, `Toast`, `Dialog`, `Announcer`, `AsyncRegion`, motion variants). Missing → add via the design-system skill before `build` (primitive) or log it for the composed tier (component-breakdown rules).

### A5. What to bring to the owner

Most UX choices are **decide and tell** (`.claude/skills/explain-decisions/SKILL.md`). Ask only when their users' experience really depends on their priorities:

| Ask about | Why it's theirs |
|---|---|
| Undo (needs soft delete: a data-model change) vs confirmation dialog | changes the data model and how forgiving the app feels |
| Autosave vs explicit Save | changes how users trust the app with their work |
| Writes while offline: blocked vs queued | queueing is real extra work and changes the architecture |
| Collaborative conflicts: last-write-wins vs "someone changed this" | changes the data model; matters only if people edit the same things |
| An accessibility trade-off | always the owner's call, handled per `accessibility` §2 |
| Tone of copy and celebratory moments (confetti, playful empty states) | brand voice |

Use the explain-decisions format: recommendation first, what their users would notice, how hard to change later. Mock the choice in the style guide or show a two-line example of the copy when that's clearer than words.

### A6. What this stage produces

```markdown
### F00N — ux plan
**What your users will notice:** <2–3 plain sentences — e.g. "Deleting a project can be undone for 8 seconds. Lists show placeholder rows while loading. If saving fails, what they typed stays put.">
**Decisions:** undo for delete (owner, needs `deleted_at` → breakdown updated) · explicit Save (default)
<screen state map from A1>
Offline: read-only with banner · Permissions: viewers don't see "New project"
Focus/announce: <notes> · Transitions: <tokens used>
Primitives needed: none new | InlineAlert (added via design-system)
a11y conflicts: none | A2 recorded in docs/ACCESSIBILITY.md
```

If a decision changes the database or API (undo → soft delete, conflicts → version column), update the breakdown before `build`. Then `/build` moves to `build`, which implements the map.

## Part B — Review (inside `design-compliance`)

Run the app locally and **force every state in the map**. Don't just read the code.

| State | How to force it |
|---|---|
| Loading | DevTools Network → Slow 4G; or MSW `delay('infinite')` in dev |
| Empty | a seeded user with no data (add one to `supabase/seed.sql` if missing) |
| Error | DevTools → block the request URL; stop `wrangler dev`; MSW handler returning 400/401/403/404/409/500 |
| Offline | DevTools → Offline; Playwright `setOffline` |
| Session expired | delete the session from storage, then act |
| Long content | edit seed data: long names, many items, missing images |
| Permissions | sign in as each seeded role |
| Reduced motion / zoom / keyboard / screen reader | `accessibility` §7 |

Walk it and answer:

- [ ] Every cell in the state map behaves as planned (loading-states §6, error-states §9, motion §7 checklists).
- [ ] Every action gives feedback within ~100 ms and success is confirmed in proportion.
- [ ] Empty states distinguish first use, no results and done, each with a way forward.
- [ ] Forms: right keyboards and autofill, sensible validation timing, input never lost, unsaved changes protected.
- [ ] Destructive actions follow the plan (undo or a named confirmation).
- [ ] Back, refresh and shared links keep filters and position; deep links survive sign-in.
- [ ] Copy uses PRD terms; dates/numbers via `Intl`; long content handled.
- [ ] Accessibility manual walk done (`accessibility` §7) and axe scan clean or exceptions recorded.
- [ ] Nothing surprising: no flashing, jumping layout, lost focus or disappearing important messages.

Record in the compliance entry:

```markdown
UX review: states forced 7/7 ✓ · feedback ✓ · forms ✓ · a11y walk ✓ (axe 0 serious) · reduced motion ✓ · Slow 4G ✓
Deviations from ux plan: delete uses confirm, not undo (owner changed mind — plan updated)
Follow-ups: I022 design — empty state illustration
```

## Anti-patterns

- Building the happy path first and "adding states later".
- One global spinner for the whole page; a blank page while loading.
- "Something went wrong" with no action; errors only in toasts that vanish.
- Clearing a form on failure; losing work on session expiry.
- A confirmation dialog for everything (people stop reading them) and none for the one thing that matters.
- Animation added for flair, or animation that ignores Reduce motion.
- Asking the owner about things a professional would just decide, or hiding things they should decide.
