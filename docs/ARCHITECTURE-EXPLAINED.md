# Architecture explained

What each piece of your app is, why it's there, and how they fit together. Written for someone who has never built software; the last section is for developers.

## The picture

```
                     ┌──────────────────────────┐
   your users        │   Website (Astro)        │   public pages: landing, pricing, blog
   in a browser ───▶ │   fast, found by Google  │   (only if you need one)
                     └──────────────────────────┘

                     ┌──────────────────────────┐        ┌──────────────────────┐
   your users        │   Web app (Vite+React)   │ ─────▶ │   API (Hono)         │
   signed in ──────▶ │   the thing they use     │        │   the rules & logic  │
                     └──────────────────────────┘        └──────────┬───────────┘
                     ┌──────────────────────────┐                   │
   phone app ──────▶ │   Mobile (Expo)          │ ──────────────────┤
   (only if needed)  └──────────────────────────┘                   ▼
                                                          ┌──────────────────────┐
                              sign-in goes here ────────▶ │   Supabase           │
                                                          │   sign-in + database │
                                                          └──────────────────────┘

   All of the boxes on the left and the API run on Cloudflare. The code lives on GitHub.
```

## The pieces

### Supabase — sign-in and the database

Your app has to remember things (users, orders, projects) and know who's who. Supabase is a hosted **Postgres database** (the most widely used database in the world) plus a **sign-in service** (email/password, magic links, Google sign-in and so on). You get a dashboard where you can look at your data in a spreadsheet-like view.

Why this one: it's free to start, scales to millions of rows without changes, and has a command-line tool that lets Claude create and change your database in a controlled, repeatable way. Those controlled changes are called **migrations** — think of them as a numbered list of every change ever made to the database's shape, so the same changes can be applied to your laptop's copy and to the real one identically.

### API — the rules and logic (Hono on Cloudflare Workers)

The API is the part of your app that nobody sees. When the web app says "create a project", it asks the API, and the API checks who's asking, checks the request makes sense, writes to the database, and answers. Putting the rules here (rather than in the web app) means the phone app and the website get the same rules for free, and nobody can bypass them by fiddling with their browser.

**Hono** is a small, fast framework for writing APIs. **Cloudflare Workers** run it in hundreds of locations worldwide, so it's fast for everyone, and you pay nothing until you have real traffic.

Every request is checked against a **schema** (a description of what valid input looks like), so bad data is rejected before it can do harm.

### Web app — what people use (Vite + React)

The screens your users sign in to. **React** is the most common way to build interactive interfaces; **Vite** is the tool that packages it up. It runs entirely in the browser and talks to the API. It's built so that it works on a phone's browser too — which is usually all the "mobile" you need.

### Website — public pages (Astro), optional

If outsiders need to find you on Google, read about the product, and click "sign up", that's a different job from the app itself: it must load instantly and be readable by search engines. **Astro** builds plain, fast pages for exactly this. An internal tool doesn't need one. An MVP for the public usually does — but it can wait until you have something to show.

### Mobile app — Expo / React Native, optional and gated

A real iOS/Android app. **Expo** lets one codebase produce both, reusing the same React knowledge and the same design system. But it is by far the slowest, most complex path: every screen is built a second time, every release goes through Apple's and Google's review (days, not minutes), and you need paid developer accounts.

So the planning step asks a hard question: do you need something only a real app can do — camera scanning as a core feature, reliable push notifications, working offline, background location, Bluetooth, or being in the App Store as a business requirement? If not, the web app on a phone browser (installable as a "PWA", with an icon on the home screen) does the job. You can always add the mobile app later; the API and design system are ready for it.

### Design system — your look, once

Instead of picking colours screen by screen, the kit builds a **design system**: a single file of **tokens** (your colours, fonts, spacing, corner roundness), a set of building-block components (buttons, inputs, cards…) made from those tokens, and a **style guide** page you can open in a browser showing all of it plus mock-ups of your key screens. Every screen in every app is built from these parts and checked against the guide, which is how the web app and the phone app end up looking like the same product. Change a token, and everything updates.

### Cloudflare — where it runs

Everything (API, web app, website) is deployed to **Cloudflare Workers**. One provider, one login, global by default, generous free tier. Deploys happen automatically when code is pushed to the `main` branch on GitHub. Supabase is connected to the same GitHub repository, so database changes go out from that same push. The app waits for the database changes to finish before it goes live.

### GitHub — where the code lives

Every change to your code is recorded in **git** and stored on GitHub. You can see the history, go back, and hand the project to a developer. GitHub also runs the automated checks and deployments (**GitHub Actions**).

## Two environments, not three

- **Local** — your laptop. Docker runs a copy of Supabase; the API and apps run with `pnpm dev`. Break things freely.
- **Production** — the real thing on Cloudflare and hosted Supabase.

Bigger companies add a "staging" environment in between. For an MVP or internal tool it doubles the setup and cost for little benefit; the kit deliberately skips it. If you outgrow this, a developer can add one in an afternoon.

## Why it's the same for an internal tool and an MVP

Because the hard parts — sign-in, a database that can grow, a clean boundary between rules and screens, automatic deploys — are the same either way, and getting them right at the start is cheap while retrofitting them is not. The difference between the two shows up in *what* gets built (a marketing site, onboarding, billing), not in *how*.

## Scaling — what happens when it takes off

Nothing dramatic. Supabase Postgres handles far more than an MVP will see; when you need more, you move up a plan. Cloudflare Workers scale automatically. The API is stateless, so there's nothing to "add more of" by hand. The first real scaling work is usually adding indexes to the database and caching — both routine, both visible in the logs long before they hurt.

## For developers

pnpm workspaces + Turborepo monorepo. `apps/api` is Hono on Workers exporting `AppType`; clients use `hc<AppType>` from `packages/api-types` for end-to-end types with no codegen. Zod validators on every route; Supabase JWT verified in middleware; service-role key only in the Worker; RLS on every table as defence in depth. `apps/web` is Vite + React with feature folders and a three-tier component model (design-system primitives → app composed → feature). Server state via TanStack Query by default, re-evaluated per feature for high-write or side-effect-heavy flows (see `.claude/skills/state-management`). `apps/site` is Astro static; `apps/mobile` is Expo Router + EAS, sharing hook and component *names* with web. `packages/design-system` holds a typed token source that generates a Tailwind preset, an RN theme object, and CSS custom properties; ESLint bans arbitrary values and raw hex outside it. Migrations authored via Supabase CLI and applied to production by the Supabase GitHub integration on push to `main` (automatic branching off); the deploy workflow gates the Workers deploy on the integration's commit check, and migrations are kept expand/contract-compatible. TypeScript strict with `noUncheckedIndexedAccess`; ESLint flat config + Prettier shared from `packages/config`. Tests: Vitest (Workers pool for the API), RTL for logic-bearing components, one Playwright smoke spec. Everything is generated by the current official CLIs at scaffold time; `.claude/skills/` documents every convention.
