---
name: choosing-versions
description: The version policy for every CLI, package and runtime in the project — use the newest *stable, mainstream* release that the rest of the stack already supports, not the newest release on npm. Covers how to check dist-tags, release age and peer-dependency compatibility, keeping one version per tool across the monorepo, and when a version conflict is the owner's call. Called by scaffold before generating anything and by /build whenever a feature adds or upgrades a dependency.
---

# choosing-versions — stable over shiny

The owner is not a developer and cannot debug a broken toolchain. The job is a project that installs cleanly, lints cleanly and keeps working. **"Latest" means the latest version the ecosystem has caught up with, not the newest number on npm.**

A brand-new major version often looks fine but breaks tools that plug into it. ESLint plugins, Vite plugins, test runners and type generators lag behind by weeks or months. Being first buys nothing the owner can see, and it risks a day of confusing errors.

## The rule

Pick, for each package, the **newest stable release that every package depending on it officially supports.**

- **Stable only.** Never a pre-release: `next`, `beta`, `rc`, `canary`, `alpha`, `experimental`, `0.0.0-*`, unless the owner has explicitly accepted it for a stated reason (see "When to ask").
- **Supported by its companions.** If a companion's `peerDependencies` range doesn't include the new major, the new major isn't ready for us yet. Use the newest version inside that range.
- **Settled.** Be wary of a major released in the last ~4 weeks with no patch release yet (`x.0.0` only). Prefer it once it has had a `.1` or has been out a month, and its companions support it.
- **Within a major, always take the newest patch and minor.** Those carry security and bug fixes. Loosening applies to *major* jumps, never to fixes.
- **Runtimes use LTS.** Node: the current *Active LTS* line (even-numbered), not "Current". See `templates/nvmrc`.
- **One version per tool across the monorepo.** TypeScript, ESLint, React, Vite, Zod and friends are the same version in every workspace. Check with `pnpm ls -r <pkg>`.

Generator CLIs (`pnpm create vite@latest`, `create-hono@latest`, …) are fine to run at `@latest`. That npm tag is the stable channel, and the generator decides the current recommended template. But **check what the generator installed** (below). Generators sometimes pull in a major version their neighbours don't support yet.

## How to check (do this, don't remember it)

Your memory of "the current version" is out of date by definition. Look it up every time.

```bash
npm view <pkg> dist-tags                 # what "latest" and "next" point at
npm view <pkg> versions --json | tail    # recent releases; spot x.0.0-only majors
npm view <pkg> time --json | tail        # release dates
npm view <companion> peerDependencies    # what the companion actually supports
```

After installing, confirm there are no problems:

```bash
pnpm install                             # read the output: "unmet peer" / "missing peer" warnings are failures, not noise
pnpm ls -r <pkg>                         # same version everywhere
pnpm lint && pnpm typecheck              # the real test that the toolchain agrees with itself
```

Only pin a version when the default doesn't fit. Use a range, not an exact number, so fixes still flow: `pnpm --filter <app> add -D typescript@~6` or `@^6`. Never edit `package.json` by hand.

## Known anchor pairs in this stack

These are the pairs that most often disagree. The *right-hand* package usually sets the limit. Check its peer range before settling the left-hand version. The list is a starting point, not a fixed record; always check live.

| Package | Held back by |
|---|---|
| `typescript` | `typescript-eslint` peer range; also `astro check`, `vue-tsc`-style checkers, `@supabase` type generation |
| `eslint` | every ESLint plugin in `templates/eslint.config.mjs` (`eslint-plugin-react-hooks`, `eslint-plugin-import-x`, `eslint-config-prettier`, …) |
| `vite` | `@vitejs/plugin-react(-swc)`, `@tailwindcss/vite`, `vite-plugin-pwa`, `vitest`, `@cloudflare/vite-plugin` if used |
| `vitest` | `@cloudflare/vitest-pool-workers` |
| `react`, `react-dom` | `react-router`, testing-library, and — for mobile — the Expo SDK |
| `react-native`, `react`, every `expo-*` | **the Expo SDK decides.** In `apps/mobile` add packages with `pnpm --filter mobile exec expo install <pkg>` so Expo picks compatible versions; run `npx expo install --check` |
| `astro` | `@astrojs/cloudflare`, `@astrojs/*` integrations (use `astro add`, which picks compatible ones) |
| `zod` | `@hono/zod-validator` and any other Zod-consuming library's peer range |
| `tailwindcss` | `prettier-plugin-tailwindcss`, the Vite plugin, the design-system preset format |
| `wrangler` | `@cloudflare/vitest-pool-workers`, the Astro Cloudflare adapter |
| Node | `engines` fields of wrangler, Expo CLI, Supabase CLI |

## When to decide, and when to ask

Most version choices are **not** the owner's decision. Make them, then mention them in one line in the step summary: "Using TypeScript 6. Version 7 is out, but the code checker doesn't support it yet."

Ask the owner only when there is a real trade-off they could care about:

- The newer major has something the PRD actually needs (a feature, a platform requirement, a security fix that isn't backported), **and** using it means accepting unsupported companions, a pre-release, or dropping a tool.
- The stable path means giving up something they'd notice (a slower build they already complained about, a feature they asked for).

When you ask, **load `.claude/skills/explain-decisions/SKILL.md` and follow it.** Recommend the stable option by default. Explain the risk in terms of their project, not version numbers.

Never offer "use the unsupported version anyway" as an equal choice with no recommendation. That hands a developer's judgement call to someone who can't make it.

## Record it

- Scaffold: list every CLI and key package version in `docs/adr/0001-scaffold.md` under **Versions**. Wherever you held something back, add a one-line reason and the condition to revisit it ("revisit when typescript-eslint supports TS 7").
- Later changes: a held-back major gets a PROGRESS note. When its companions catch up, suggest the upgrade to the owner as its own feature (`F0NN: upgrade <tool> to <major>`), never slipped into another feature.
- Upgrading a major is a feature like any other: breakdown (what changes), build, then `quality` must pass clean.
