# templates/

Files the `scaffold` skill copies into the generated monorepo. They are **starting points**: the CLI-generated apps are authoritative for their own structure, and these files layer the kit's conventions on top.

| File | Copied to | Purpose |
|---|---|---|
| `pnpm-workspace.yaml` | `/pnpm-workspace.yaml` | Declares `apps/*` and `packages/*` |
| `turbo.json` | `/turbo.json` | Task graph for dev/build/lint/test/typecheck |
| `root-package.json` | `/package.json` (merged) | Root scripts; scaffold merges, never overwrites a CLI-made one |
| `tsconfig.base.json` | `packages/config/tsconfig.base.json` | Strict TS shared by every app |
| `eslint.config.mjs` | `packages/config/eslint.config.mjs` | Flat config incl. the no-arbitrary-value design rules |
| `prettier.config.mjs` | `packages/config/prettier.config.mjs` | Formatting, Tailwind class sorting |
| `wrangler.api.jsonc` | `apps/api/wrangler.jsonc` | Worker config for the Hono API |
| `wrangler.web.jsonc` | `apps/web/wrangler.jsonc` | Worker + static assets for the Vite app |
| `wrangler.site.jsonc` | `apps/site/wrangler.jsonc` | Worker + static assets for the Astro site |
| `github-workflows/ci.yml` | `.github/workflows/ci.yml` | Lint, typecheck, test on every PR |
| `github-workflows/deploy.yml` | `.github/workflows/deploy.yml` | Deploy on push to `main` |
| `env.example` | `apps/*/.env.example` (adapted) | Documents every env var each app needs |

After scaffolding, **edit the copies, not these templates.** The scaffold skill checks each CLI's current output before copying and adapts (for example if `create-vite` now ships its own ESLint flat config, it merges rather than replaces).
