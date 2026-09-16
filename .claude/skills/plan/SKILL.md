---
name: plan
description: Interview the owner in plain language and write the three planning documents — PRD (docs/PRD.md), architecture decision (docs/ARCHITECTURE.md) and data + auth model (docs/DATA-MODEL.md). Called by /build for steps 2–4. No code is written by this skill.
---

# plan — PRD, architecture, data model

This skill runs three fixed steps of `/build`. Each is an interview followed by a document, followed by the owner's approval. Run only the section `/build` asked for.

Interview rules, all sections:

- Ask **one question at a time**. Wait for the answer. Reflect it back in a sentence before the next question.
- Prefer concrete examples over abstractions: "Walk me through what happens the first time someone uses it" beats "What are your user personas?".
- Offer options when the owner hesitates, and say which you'd pick and why.
- If the owner gives a long brain-dump, extract the answers to the questions below from it and only ask what's still missing.
- Keep documents short. A PRD the owner won't read is worthless. Target one screen per section.
- Write the document, then show the owner the *whole thing* and ask the approval question `/build` specifies. Edit until yes.

---

## Section A — PRD (`docs/PRD.md`)

### Questions (in order)

1. **In one sentence, what does this app do, and for whom?**
2. **What's the problem today?** How is it handled right now (spreadsheet, WhatsApp, nothing)?
3. **Who uses it?** List the kinds of people (e.g. "me", "my three staff", "customers"). For each: how often, on what device (laptop / phone / both), how technical.
4. **Walk me through the three most important things someone does in it, start to finish.** These become the *core flows*. Push for the minimum: "Is the app useful without this?"
5. **What does success look like in three months?** A number if possible (users, orders, hours saved).
6. **What is this app explicitly NOT going to do** in the first version? Write these down — they stop scope creep later.
7. **Internal tool or MVP for outsiders?** (Doesn't change the architecture, but changes tone, onboarding, and whether a marketing site is needed.)
8. **Does anyone need to log in?** Who, and do different people see different things (roles)?
9. **Does it need to work on a phone?** Follow up: on a phone *browser*, or as an *installed app*? Why? (Probe for real native needs: camera, push notifications, offline, background location, Bluetooth, App Store presence as a requirement.)
10. **Is there an existing brand** — logo, colours, a website, anything it should match?
11. **Anything it must connect to?** (Stripe, email, Google Sheets, an existing database…)

### Document template

```markdown
# <Project name> — PRD

_Approved: <date> · Status: living document; "Added later" section grows over time_

## One line
<sentence>

## The problem
<2–4 sentences: how it's done today and why that hurts>

## Who uses it
| Who | How often | Device | Technical? | Needs to log in? | Role |
|---|---|---|---|---|---|

## Core flows (in priority order)
### 1. <Flow name>
<numbered steps from the user's point of view, 3–8 steps>
### 2. …
### 3. …

## Success in 3 months
<measurable statement>

## Non-goals (v1 will NOT…)
- …

## Kind of project
Internal tool | MVP for external users — <one line on what that implies>

## Mobile needs
<"phone browser is fine" | "installed app because <specific native need>" | "unsure — decide in architecture">

## Brand
<existing brand assets, or "none — design system will create one">

## Integrations
<list or "none in v1">

## Added later
<empty at approval; /build appends features the owner asks for after the PRD>
```

Approval question: **"Does this describe what you want to build?"**

---

## Section B — Architecture (`docs/ARCHITECTURE.md`)

Read the approved PRD. Decide which apps to generate. Justify each in plain language. Everything below is a decision *you* make and *explain*; only ask the owner where the PRD leaves genuine ambiguity.

### Decision rules

| App | Generate when | Do NOT generate when |
|---|---|---|
| `api` (Hono on Workers) | always | — |
| `web` (Vite + React) | anyone logs in, or there is any interactive UI | the whole product is a static site with no logged-in area (rare) |
| `site` (Astro) | PRD says "MVP for external users" AND there's a need for a public landing/marketing/SEO page; or the owner has an existing marketing site to replace | internal tool; or a single landing page can live as a public route in `web` for now |
| `mobile` (Expo) | **only** if the PRD names a specific native need: camera/scanning as a core flow, push notifications that must be reliable, offline-first, background location, Bluetooth/NFC, or App Store presence is a hard business requirement | "it needs to work on phones" — that's responsive web; "it would be nice as an app" — that's a PWA later |

**The mobile gate.** If the PRD's mobile need is anything but a named native capability, write the decision as "responsive web app; PWA install prompt; revisit mobile when <specific trigger>". Explain the cost honestly: a native app roughly doubles UI work, adds App Store review cycles measured in days, needs Apple Developer ($99/yr) and Google Play ($25) accounts, and every release is slower. If the native need is real, generate it — but say the first feature slices will be web-first with mobile catching up, unless mobile *is* the product.

Also decide and record: auth method (Supabase email+password by default; magic link if users are non-technical and low-frequency; OAuth providers only if the PRD names them), roles (none / single admin flag / role table — pick the simplest that satisfies the PRD), and whether the API is the only path to the DB (**yes by default**: web and mobile use Supabase only for auth and call the Hono API for data; direct Supabase queries from the client are allowed only for read-heavy, RLS-protected, per-user data and must be recorded as an ADR).

### Document template

```markdown
# <Project name> — Architecture

_Approved: <date>_

## What we're building
| Piece | Building it? | Why (or why not) |
|---|---|---|
| Supabase (auth + database) | Yes | … |
| API — Hono on Cloudflare Workers | Yes | … |
| Web app — Vite + React | Yes/No | … |
| Website — Astro | Yes/No | … |
| Mobile app — Expo | Yes/No | … (state the gate outcome explicitly) |

## How the pieces talk to each other
<one paragraph, then an ASCII diagram: browser/phone → web → api → supabase; site standalone>

## Signing in
Method: … · Roles: … · Where enforced: API middleware + Postgres RLS

## Data access rule
All reads and writes go through the API. Exceptions: <none | list with ADR link>.

## Environments
Local (Supabase CLI in Docker, wrangler dev) and Production (Cloudflare Workers, hosted Supabase). No staging.

## Deployment
Push to `main` → GitHub Actions → migrations, then Workers deploy. Mobile: EAS (if applicable).

## Revisit triggers
- Add `site` when: …
- Add `mobile` when: …
- Consider splitting the API when: …
```

Update `.claude/state.json → apps` to match. Approval question: **"Happy with which pieces we're building and why?"**

---

## Section C — Data model (`docs/DATA-MODEL.md`)

From the PRD's core flows, derive the tables. Nouns in flows become tables; "belongs to" becomes foreign keys; "who can see" becomes RLS.

### Method

1. List every noun in the core flows. Merge synonyms. Drop anything not needed for v1.
2. For each: fields (name, type, required?, example value), and which flow creates / reads / updates / deletes it.
3. Relationships: one-to-many and many-to-many, named from both sides in English ("a Project has many Tasks; a Task belongs to one Project").
4. Ownership: every table that holds user data gets `owner_id` (or an org/tenant id if the PRD has teams). This drives RLS.
5. Auth model: roles from ARCHITECTURE.md → who may do what on each table. Express it as a matrix.
6. Show the owner in plain English *before* the SQL-ish detail: "The app remembers Projects, Tasks and Comments. Each Task belongs to a Project. You can only see Projects you own or were invited to."

### Conventions (the scaffold and build steps depend on these)

- Table names: `snake_case`, plural. Columns: `snake_case`. Primary key `id uuid default gen_random_uuid()`.
- Every table: `created_at timestamptz default now()`, `updated_at timestamptz` (trigger).
- User reference: `auth.users(id)` via a `profiles` table that mirrors public user data; never join to `auth.users` from app code.
- Soft-delete only if the PRD needs undo/audit; otherwise real deletes.
- RLS **enabled on every table** with policies matching the matrix, even though the API uses the service role — defence in depth, and it allows client reads later.
- Enumerations as Postgres enums when values are fixed by the business (order status); as a lookup table when the owner will add values in the app.

### Document template

```markdown
# <Project name> — Data model

_Approved: <date>_

## In plain English
<3–6 sentences>

## Tables
### profiles
| column | type | required | example | notes |
…
### <table>
…

## Relationships
- A Project has many Tasks (`tasks.project_id → projects.id`)
- …

## Who can do what
| Table | anon | user (own rows) | user (org rows) | admin |
|---|---|---|---|---|
| projects | — | read/write | read | all |

## First migration plan
1. `profiles` + trigger from `auth.users`
2. <tables in dependency order>
3. RLS policies
4. `updated_at` trigger function
5. Seed: <what goes in seed.sql for local dev, e.g. one admin, two sample projects>

## Open questions
<anything the owner should decide later; empty if none>
```

Approval question: **"Does this cover everything the app needs to remember?"**

The actual SQL is written in the `scaffold` step via `supabase migration new`, following "First migration plan". This document is the spec, not the code.
