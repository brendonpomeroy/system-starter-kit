---
name: design-system
description: Interview the owner about brand, mood and references, then build the project's design system — a token source of truth that generates the Tailwind preset and a React Native theme, a primitive component library for web and native, and a vanilla HTML style guide (docs/style-guide.html) showing branding, typography, radii, component styling and key mock screens. Called by /build for step 5; also used for a redo when the owner wants to change the look.
---

# design-system — tokens, components, style guide

The style guide page is the contract. Every screen in every app is later checked against it. Build the tokens first, the page second, the components third, and make the page and the components agree byte-for-byte on names.

## Part 1 — Interview

One question at a time. Show, don't ask, wherever you can: after the first three answers, generate a quick throwaway palette + type sample as an HTML snippet in `docs/design-drafts/draft-1.html`, ask the owner to open it, and iterate. Two or three drafts is normal. Delete the drafts folder once the style guide is approved.

1. **Existing brand?** Logo file, colours (hex if they have them), a website, a competitor they like. If they have a logo, ask for the file and place it at `packages/design-system/assets/logo.svg` (or png). Extract the dominant colour and use it as the primary candidate.
2. **Three words for how it should feel.** Offer pairs to react to: calm/energetic, playful/serious, dense/spacious, warm/cool, classic/modern.
3. **Who looks at it all day?** (From PRD.) Internal tools favour density and neutral colour; consumer MVPs favour more whitespace and a stronger accent.
4. **Light, dark, or both?** Default: light with dark tokens defined but dark mode off unless the PRD's users work at night or it's a developer-facing tool.
5. **References.** Two or three apps or sites they like the look of. Ask *what* they like about each (the type? the roundness? the colours?). Do not copy any of them; extract the principle.
6. **Anything they hate?** (Surprisingly useful.)
7. **Rounded or sharp?** Show three radius scales in the draft.
8. **Type.** Offer three system-friendly pairings from Google Fonts (a humanist sans, a geometric sans, a serif+sans pair). Fonts must be self-hosted via `@fontsource-variable/*` packages — never a runtime `<link>` to Google Fonts in the apps.

## Part 2 — Tokens (source of truth)

Create `packages/design-system` with `pnpm` (`pnpm init` in the folder, then `pnpm add`), never a hand-typed `package.json`. Layout:

```
packages/design-system/
  package.json                  (pnpm-generated, name "@<project>/design-system")
  src/
    tokens/
      tokens.ts                 ← THE source of truth (typed object)
      build.ts                  ← generates the three outputs below; `pnpm --filter design-system build:tokens`
    generated/
      tailwind.preset.ts        ← consumed by apps/web and apps/site tailwind config
      theme.native.ts           ← consumed by apps/mobile
      tokens.css                ← CSS custom properties; also inlined into docs/style-guide.html
    components/
      web/                      ← React DOM primitives
      native/                   ← React Native primitives (only if mobile chosen)
      index.ts
    utils/cn.ts                 ← clsx + tailwind-merge
  assets/                       ← logo, favicon sources
```

`tokens.ts` shape (keep names boring; these names appear in every app):

```ts
export const tokens = {
  color: {
    brand:   { 50:…, 100:…, …, 900:…, DEFAULT: … },   // primary
    accent:  { … },                                    // secondary / highlight
    neutral: { 0: "#fff", 50…950 },                    // greys incl. text/bg
    success: { … }, warning: { … }, danger: { … }, info: { … },
    // semantic aliases — components use THESE, not the scales above
    bg: { base, subtle, muted, inverted }, fg: { base, muted, subtle, inverted, onBrand },
    border: { base, strong }, focus: { ring },
  },
  font: { sans: "…", mono: "…", display?: "…" },
  text: { xs, sm, base, lg, xl, "2xl", "3xl", "4xl" },   // [size, lineHeight]
  weight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  space: { 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24 },  // px values on a 4px grid
  radius: { none, sm, md, lg, xl, full },
  shadow: { sm, md, lg },
  motion: { fast: "120ms", base: "200ms", slow: "320ms", ease: "cubic-bezier(.2,.8,.2,1)" },
  breakpoint: { sm: 640, md: 768, lg: 1024, xl: 1280 },
} as const;
```

`build.ts` writes the generated files. It is the *only* place hex values are translated; apps never import `tokens.ts` directly except the build script and the native theme. Semantic colours (`bg.base`, `fg.muted`) are what components use — this is what makes dark mode a token swap rather than a rewrite.

Contrast check: for every `fg` on its intended `bg`, and `fg.onBrand` on `brand.DEFAULT`, compute WCAG contrast (write a tiny script; ≥ 4.5:1 for text, ≥ 3:1 for large text and UI borders). Adjust before proceeding and note the ratios in the style guide.

## Part 3 — Style guide page (`docs/style-guide.html`)

Start from `.claude/skills/design-system/references/style-guide-template.html`. It is vanilla HTML + CSS with **no build step and no external requests** except the self-hosted font files copied into `docs/style-guide-assets/`. It must open by double-clicking the file.

Fill every section; do not leave placeholders:

1. **Brand** — logo, name, the three feeling words, one paragraph on the principle behind the choices.
2. **Colour** — every scale as swatches with token name + hex; the semantic aliases; light/dark side-by-side if both; the contrast table.
3. **Typography** — font families, the type scale rendered at real size with token names, weights, a paragraph of real body copy, headings h1–h4 as they'll appear in the app.
4. **Spacing & layout** — the spacing scale as bars; the grid/container widths; page gutter rules.
5. **Radii & elevation** — the radius scale on cards; the shadow scale.
6. **Components** — every primitive from Part 4, in every variant and state (default, hover, focus, disabled, loading, error), built here in plain HTML/CSS using the CSS custom properties from `tokens.css`. Web and native columns where they differ.
7. **Patterns** — form layout, empty state, loading state, error state, toast, confirmation dialog, table/list row, page header. These are the "composed" tier components reference.
8. **Key screens** — mock the 3–5 most important screens from the PRD's core flows, as static HTML at real proportions: at least the sign-in screen, the main authenticated screen, and one primary create/edit flow. If mobile was chosen, show the same screens in a 390px phone frame. If `site` was chosen, show the landing page hero. These are *the* reference: the feature loop builds to match them.
9. **Do / don't** — 6–10 short rules with a visual each (e.g. "Don't use brand colour for body text").

Serve it locally (`python3 -m http.server` in `docs/` or just open the file) and ask the owner to look at it in their browser. Iterate until they say yes to `/build`'s approval question.

## Part 4 — Primitive components

Web (`components/web`), built with Tailwind classes that reference **only** preset tokens, using `cva` for variants and `cn` for merging. Install with `pnpm --filter design-system add class-variance-authority clsx tailwind-merge`.

Required set (v1): `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Label`, `FormField` (label+control+help+error), `Card`, `Badge`, `Avatar`, `Spinner`, `Skeleton`, `Dialog`, `Sheet` (side panel), `Toast` + `useToast`, `Tooltip`, `Tabs`, `Table` (headless-ish: `Table`, `THead`, `TRow`, `TCell`), `EmptyState`, `PageHeader`, `Stack`/`Inline` (layout with gap tokens), `Container`, `Text` and `Heading` (typography with `size`/`weight`/`tone` props), `Link`.

Accessibility is not optional: keyboard-operable, visible focus ring from `focus.ring`, `aria-*` where the role needs it, labels associated with controls. For Dialog/Tooltip/Select use a headless accessible primitive (`@radix-ui/react-*` or `@base-ui-components/react`, whichever is current — check npm) rather than hand-rolling focus traps; style it with tokens.

Native (`components/native`), only if `apps/mobile` was chosen: the same names, same prop names, same variants, implemented with React Native primitives and `theme.native.ts`. Where a web component has no native equivalent (Tooltip), export a no-op with a comment. Consistency of *names and props* across web and native is what lets the feature loop write near-identical feature code.

Each component: one file, one named export, props typed and documented with a one-line JSDoc, and a usage snippet in the style guide's Components section that matches the real props.

## Part 5 — Wire it in

- `apps/web` and `apps/site` Tailwind config: `presets: [preset]` from `@<project>/design-system/tailwind`. Remove any default colour usage the CLI scaffold left behind (e.g. `text-gray-500` → `text-fg-muted`).
- `apps/mobile`: theme provider at the root reading `theme.native.ts`.
- Add `packages/design-system` to the ESLint ignore for the token folder only; the design-compliance rules apply to `components/`.
- Write `packages/design-system/README.md`: how to add a token, how to add a component, how to regenerate, and "the style guide is the spec".
- ADR `docs/adr/000N-design-system.md`: fonts chosen, why, dark mode decision, accessible primitive library chosen.

## Redo

If `/build` runs this as a redo (owner wants a new look): keep token *names* stable and change values; that way existing features re-skin without edits. Only add/remove names when the owner asks for a new kind of thing. Regenerate the style guide, re-run contrast, then the feature loop's `compliance` stage on every completed feature (log as `F0NN: reconcile design`).
