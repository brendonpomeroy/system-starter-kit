---
name: documentation
description: Keep the project's documentation truthful — per-app READMEs, the root CLAUDE.md map, Architecture Decision Records in docs/adr/, an API reference (docs/api.md) regenerated from the Hono routes and Zod schemas, and the PROGRESS log. Called by /build after scaffold and as the final stage of every feature.
---

# documentation — what must stay true

Documentation in this kit has one reader who matters most: the *next* `/build` run, which may be weeks later, in a fresh context, possibly on a different machine. The second reader is the owner, who is not a developer. Write for both: precise paths and commands, plain-language framing.

## 1. What exists and who owns it

| Document | Purpose | Updated when |
|---|---|---|
| `README.md` (root) | The project's own front page: what it is, live URLs, how to run locally, how to deploy, where to look next. Replaces the kit's README after scaffold. | URLs, commands or apps change |
| `CLAUDE.md` | Claude's map: layout, rules, skill index, commands | any path/convention changes; new app added |
| `apps/<app>/README.md` | Run, env vars (name + what it's for, never the value), test, deploy, folder map for that app | any of those change; new feature folder added |
| `packages/design-system/README.md` | How to add a token / component, regenerate, "the style guide is the spec" | design-system changes |
| `docs/PRD.md` · `ARCHITECTURE.md` · `DATA-MODEL.md` | The approved plan (living after scaffold) | DATA-MODEL on every migration; PRD "Added later" when a feature's breakdown is approved; ARCHITECTURE on any app/auth/data-access change (→ ADR too). **Rehash in the same commit** (build §0) |
| `docs/style-guide.html` | Design contract | via design-system skill, or a mock updated in design-compliance. **Rehash in the same commit** |
| `docs/BACKLOG.md` | Everything waiting to be done | via the backlog skill, whenever something is captured, started or finished |
| `docs/api.md` | Generated API reference | every feature that touches `apps/api` |
| `docs/adr/NNNN-*.md` | Why a non-obvious choice was made | when such a choice is made |
| `docs/PROGRESS.md` | The log | every step/stage, by `/build` |
| `docs/maintenance/YYYY-MM-DD.md` | Maintenance reports | each maintenance run |

## 2. ADRs — short, dated, honest

File: `docs/adr/NNNN-kebab-title.md`, numbered sequentially from `0001` (`0000-template.md` is the template). Write one when: a library is adopted, an approach deviates from the kit default, a state-management profile changes, something is done "the ugly way" on purpose, or the owner makes a product call that constrains the code.

```markdown
# NNNN — <Title in the form of a decision: "Use Supabase Realtime for order board">

Date: YYYY-MM-DD · Status: accepted | superseded by NNNN · Feature: F00N

## Context
<2–4 sentences: the situation that forced a choice>

## Decision
<what we're doing, one paragraph>

## Alternatives considered
- <alt> — rejected because …
- <alt> — rejected because …

## Consequences
<what gets easier, what gets harder, what to revisit and when>
```

Ten lines is fine. A missing ADR is worse than a short one.

## 3. `docs/api.md` — generated, not written

Regenerate from `apps/api/src/routes/*.ts` and `apps/api/src/schemas/*.ts` every time a route changes. Write a small script at `apps/api/scripts/gen-api-docs.ts` (run via `pnpm --filter api docs`) the first time this is needed; it should import the schemas and walk the route definitions (or parse them — keep it simple and deterministic). If Hono's OpenAPI tooling is adopted later, generate from the spec instead and record the swap as an ADR.

Format per route:

```markdown
### POST /projects
Create a project. Auth: user.
**Body** — `ProjectCreateSchema`
| field | type | required | rules |
|---|---|---|---|
| name | string | yes | 1–80 chars |
**Response 201** — `Project`
**Errors** — 400 validation · 401 unauthenticated
```

Top of the file: base URL (local + production), auth header format, error envelope shape, pagination convention. The owner should be able to read the headings and understand what their backend can do.

## 4. READMEs — the shape

Root `README.md` (project's own):

```markdown
# <Project>
<one line from the PRD>

**Live:** web <url> · api <url> · site <url>
**Docs:** [PRD](docs/PRD.md) · [Architecture](docs/ARCHITECTURE.md) · [Data model](docs/DATA-MODEL.md) · [Style guide](docs/style-guide.html) · [API](docs/api.md) · [Progress](docs/PROGRESS.md)

## Run it on your computer
1. `supabase start`
2. `pnpm dev`
3. open http://localhost:5173 — sign in with <seeded user from seed.sql>

## Make changes
Open Claude Code here and type `build`.

## Deploy
Finished work goes live when `build` merges it into `main`: Supabase applies migrations, then GitHub Actions deploys. Watch it at <actions url>. To undo a bad deploy, type `build` and say so.

## What's next
See [the backlog](docs/BACKLOG.md). Add ideas there any time.

## Structure
<short tree with one line per folder>
```

Per-app README: what it is (one line), run, env vars table (name · purpose · where to get it), test, deploy, folder map, "conventions specific to this app" (link to the skills for the rest).

## 5. PROGRESS.md entry format

Defined at the top of `docs/PROGRESS.md`. Every entry has: date-time, step or feature id + stage, what was done (bullets of real actions and files), decisions (with ADR links), what the owner should look at, next. Errors are logged verbatim with what was tried. Never rewrite history; append.

## 6. Plain-language rule

Every document the owner is expected to read (README, PRD, ARCHITECTURE, DATA-MODEL "In plain English", PROGRESS "what to look at") must pass this test: a sentence that contains a technical term either defines it inline or links to `docs/ARCHITECTURE-EXPLAINED.md`. Commands are shown in code blocks the owner can copy without editing.

## 7. What this stage produces

```markdown
### F00N — docs
Updated: apps/api/README.md (env), apps/web/README.md (features map), docs/api.md (regenerated: +4 routes), docs/DATA-MODEL.md (projects.archived_at)
ADRs: 0004-tanstack-query-for-web.md
PRD: no change
Rehashed: docs/DATA-MODEL.md
```

Then `/build` marks the feature `done`.

For a **change** (build → change track), this stage is smaller: update only what the change made untrue. Most changes need nothing beyond the PROGRESS entry.
