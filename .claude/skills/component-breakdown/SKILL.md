---
name: component-breakdown
description: Turn a feature into a concrete plan before building — screens, components by tier (primitive / composed / feature), API routes, database changes — using the feature-folder structure. Called by /build as the first stage of every feature. Also the reference for where any piece of UI belongs.
---

# component-breakdown — from feature to plan

Output: a short plan appended to the feature's PROGRESS entry and shown to the owner in plain language before any code. Keep it to one screen.

## The three tiers

| Tier | Lives in | Knows about | Examples | Promotion rule |
|---|---|---|---|---|
| **Primitive** | `packages/design-system/src/components/{web,native}` | tokens only. No app data, no API, no routing. | Button, Input, Card, Dialog, Table cells | Only the design-system skill adds these. A feature that needs a new primitive logs it and asks; don't sneak one into a feature folder. |
| **Composed** | `apps/<app>/src/components/composed/` | primitives + generic props. Still no API calls, no app-specific types. | DataTable (sorting, pagination), FormLayout, ConfirmDialog, PageWithSidebar, FilterBar, FileDropzone | Created when a **second feature** needs the same pattern. First use stays in the feature. |
| **Feature** | `apps/<app>/src/features/<feature>/` | everything: API via `hc`, feature types, state, routes. | ProjectList, ProjectForm, InviteMemberDialog, useProjects | Never imported by another feature except through the feature's `index.ts`. |

Astro (`apps/site`) has no feature tier: `src/components/` (composed-equivalent, `.astro` files using tokens) and `src/pages/`. Interactive islands, if any, import primitives from the design system's web components.

The API (`apps/api`) breaks down by **resource**, not by UI: `routes/<resource>.ts` + `schemas/<resource>.ts` + `services/<resource>.ts` (DB access). A feature that touches two resources touches two route files.

## Feature folder anatomy (web and mobile)

```
src/features/<feature>/
  index.ts              public surface: pages/screens, and hooks other features may use. Nothing else is importable.
  routes.tsx            (web) route objects; (mobile) file-based routes live in app/, which import from here
  pages/                one file per screen: <Name>Page.tsx — layout + composition only, no fetch logic
  components/           feature-specific pieces used by the pages
  hooks/                use<Thing>.ts — data fetching/mutations via lib/api, per state-management skill
  state/                (only if needed) zustand store or reducer for this feature's client state
  types.ts              feature-local types; API types are imported from @<project>/api-types, never redefined
  __tests__/            tests for hooks and logic-bearing components
```

Rules:

- A page composes; it does not fetch. Fetching lives in hooks so it's testable and swappable.
- A component gets its own file when it has its own state, its own test, or is used twice. Otherwise inline it.
- Props over context. Context only for things that are truly ambient (session, theme, toast).
- Max ~150 lines per component file. Past that, split by responsibility, not by "top half / bottom half".
- No prop drilling more than two levels — that's the signal for a hook or a small store.
- Names: `PascalCase` components, `use*` hooks, `*Page`/`*Screen` for route targets, verbs for handlers (`onSave`, `handleSubmit`).

## The plan (what this stage produces)

```markdown
### F00N — <title> — breakdown
**Owner-facing:** <two sentences: what they'll be able to do, in their words>

**Screens** (match style guide §Key screens where they exist)
- /projects — ProjectListPage (top-level): table of projects, empty state, "New" button
- /projects/new — ProjectFormPage (focused flow, parent /projects; on save replaces itself with /projects/:id)
- Screen kind (top-level / pushed / focused flow) and parent are required for every web screen; see pwa skill §7

**Components**
- feature: ProjectTable, ProjectForm, ProjectRow
- composed (new): none  |  composed (reuse): FormLayout
- primitive (new — needs design-system skill): none

**Hooks / state** → decided in the next stage (state-management)

**Loading / empty / error / transitions / accessibility** → planned in the ux stage (`.claude/skills/ux/SKILL.md`), which may come back and add to this plan (e.g. undo needs a `deleted_at` column)

**API** (apps/api)
- GET /projects · POST /projects · GET /projects/:id · PATCH /projects/:id — schemas/projects.ts
- Auth: user must own or be a member. Enforced in service + RLS.

**Database**
- migration `add_projects`: table exists from init; add `archived_at`. Update DATA-MODEL.md.

**Mobile** (if applicable): same screens under app/(tabs)/projects, same hooks, native components.

**Out of scope for this feature:** …
**Tests:** hook happy path + one failure; API route validation + auth; axe scan of the new screens; smoke test step if this is the critical path.
```

Show it to the owner. They approve the *owner-facing* part; the rest is for you. Then `/build` moves to `state`.

## Anti-patterns to refuse

- A `components/` folder at `src/` root that becomes a junk drawer. Composed is the only shared UI folder in an app.
- `utils.ts` with 40 unrelated functions. Name the file for what it does.
- Feature A importing `features/B/components/Thing`. Go through `features/B/index.ts` or promote Thing to composed.
- Copy-pasting a primitive into a feature "to tweak it". Add a variant to the primitive via the design-system skill.
- Building a screen that isn't in the style guide without first mocking it there (add the mock, get a quick yes, then build).
