# System Starter Kit

A template for building a real, scalable web app with Claude Code — even if you have never written code.

You describe what you want. Claude Code plans it with you, designs it with you, generates the codebase with the official tools, and keeps building feature by feature. Every step is logged, so you can stop at any time and pick up later by typing one word.

## What you get

| Piece | What it is | When it's built |
|---|---|---|
| **Supabase** | Sign-in and the database | Always |
| **API** (Hono on Cloudflare Workers) | The server that the apps talk to | Always |
| **Web app** (Vite + React) | The app your users log into | Almost always |
| **Website** (Astro) | A fast, search-friendly marketing / landing site | If you need one |
| **Mobile app** (Expo / React Native) | An iOS + Android app | Only if the web app truly can't do the job |
| **Design system** | Your colours, type, spacing and components, plus a style guide page | Always |

Everything deploys to Cloudflare Workers and lives in one GitHub repository.

## The one command

```
build
```

That's it. Open Claude Code inside this folder and type `build`. It will:

1. Check your computer has the tools it needs (and walk you through installing anything missing).
2. Interview you and write a short plan (`docs/PRD.md`) — nothing is built until you approve it.
3. Decide which of the pieces above you actually need, and explain why.
4. Sketch the data your app stores and who is allowed to see what.
5. Interview you about the look and feel, then build your design system and a style guide you can open in a browser.
6. Generate the codebase using the official command-line tools.
7. Build your app one feature at a time, checking quality, design consistency and security as it goes — including testing that one customer can never see another's data.
8. When something breaks, find the real cause before changing anything: reproduce it, prove why it happens, then fix it with a test so it can't quietly come back.
9. Keep improving it: one list of everything you'd like next (`docs/BACKLOG.md`), a lighter path for small tweaks, a check on the live app after every release (with a safe undo if it went wrong), and a regular health check so the app doesn't fall behind on updates.

Stop whenever you like. Next time you type `build`, it reads `docs/PROGRESS.md`, tells you where things are, and continues.

## Start here

1. **[Getting set up](docs/GETTING-SET-UP.md)** — install the handful of tools you need (about 30 minutes, once).
2. **[Starting a new project](docs/STARTING-A-NEW-PROJECT.md)** — make your copy of this template and run `build`.
3. **[Architecture explained](docs/ARCHITECTURE-EXPLAINED.md)** — what each piece does and why it's there. Optional reading, but useful when Claude asks you a question.

## What's in this folder

```
.
├── README.md                    ← you are here
├── CLAUDE.md                    ← Claude Code's map of the project and its rules
├── .claude/
│   ├── state.json               ← where /build is up to (machine-readable)
│   └── skills/                  ← the instructions Claude follows
│       ├── build/               ← the orchestrator (the only one you run)
│       ├── plan/                ← interview → PRD, architecture, data model
│       ├── design-system/       ← interview → tokens, components, style guide
│       ├── scaffold/            ← generates the apps with official CLIs
│       ├── code-quality/        ← standards + pragmatic testing
│       ├── documentation/       ← READMEs, ADRs, API reference
│       ├── component-breakdown/ ← how UI is split into pieces
│       ├── state-management/    ← how data flows through each app
│       ├── design-compliance/   ← keeps every screen on-brand
│       ├── verification/        ← independent design + security check before anything goes live
│       ├── backlog/             ← keeps the list of what to do next
│       ├── release/             ← puts work live, checks it on the live app, undoes a bad release
│       ├── maintenance/         ← regular health check: updates, deadlines, errors
│       ├── ux/                  ← plans how every screen behaves: loading, empty, errors, feedback, transitions
│       ├── accessibility/       ← makes the app work for everyone, and lets you make the calls on trade-offs
│       ├── loading-states/      ← keeps people informed while they wait
│       ├── error-states/        ← error messages that help people recover
│       ├── motion/              ← smooth transitions that respect "Reduce motion"
│       ├── pwa/                 ← makes the web app installable and self-updating
│       ├── choosing-versions/   ← picks stable, compatible tool versions
│       ├── guide-owner/         ← step-by-step directions (with links) when you need to do something in a browser
│       └── explain-decisions/   ← explains technical choices to you in plain language
├── docs/
│   ├── GETTING-SET-UP.md
│   ├── STARTING-A-NEW-PROJECT.md
│   ├── ARCHITECTURE-EXPLAINED.md
│   ├── PROGRESS.md              ← the human-readable log of every step
│   ├── BACKLOG.md               ← what's next: ideas, features and follow-ups (you can edit it)
│   ├── ACCESSIBILITY.md         ← who the app is built to work for, and any trade-offs you chose
│   ├── adr/                     ← records of decisions made along the way
│   └── verification/            ← design and security check reports
└── templates/                   ← config files the scaffold step copies into place
```

After `build` has run, you'll also see `apps/` (your generated applications), `packages/` (shared code and the design system) and `supabase/` (database migrations).

## Rules the kit lives by

- **Generated, not hand-written.** Apps are created with the official CLI (`create-vite`, `create-hono`, `create-astro`, `create-expo-app`, `supabase init`). Dependencies are added with `pnpm add`, never by editing `package.json` by hand.
- **Stable, not bleeding edge.** Tools are kept on the newest version that everything else already works with — not the newest release on day one, which is where the surprises live.
- **You get a recommendation, not a quiz.** When Claude needs you to make a technical choice, it explains it in plain language, says what it would pick and why, and tells you how easy it is to change later.
- **Nothing is built before it's planned.** The PRD, architecture and data model are approved by you first.
- **One design system.** Every screen, on every platform, is built from the same tokens and components. No one-off colours.
- **Two environments only.** Your laptop (local) and production. Simple to reason about, cheap to run.
- **Designed for real situations, and for everyone.** Every screen is planned for waiting, empty, error and success, not just the happy path. Animations are smooth but respect people who turn on "Reduce motion". The app is built to work with keyboards, screen readers and zoom. When that clashes with something you want, you get a recommendation and you make the call.
- **Checked before it goes live.** Every feature gets an independent design and security check. Serious problems block the deploy until they're fixed.
- **Everything is logged.** `docs/PROGRESS.md` says what was done and when. `docs/adr/` says why. `docs/BACKLOG.md` says what's next.
- **Checked again once it's live.** After every release, the live app is checked. If something broke, the release is undone safely, and your data is never rolled back.

## For the technically curious

pnpm workspaces + Turborepo, TypeScript strict everywhere, ESLint + Prettier, Tailwind (no component library — the design-system skill builds your own), Hono RPC client for end-to-end types, Supabase CLI for migrations, Cloudflare Workers with static assets for every deployable, GitHub Actions for deploys. See [Architecture explained](docs/ARCHITECTURE-EXPLAINED.md).

## Licence

MIT. Copy it, change it, give it to your own friends.
