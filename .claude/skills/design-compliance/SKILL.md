---
name: design-compliance
description: Keep every screen on-brand and consistent across web, site and mobile — lint rules forbidding raw colours and arbitrary values outside design tokens, a raw-element audit, and a written checklist (hierarchy, spacing, empty/loading/error states, focus, contrast, motion, mobile width), an axe accessibility scan, and the ux skill's review of every planned state walked for every new or changed screen against docs/style-guide.html. Called by /build as the compliance stage of every feature.
---

# design-compliance — matches the style guide, every time

`docs/style-guide.html` is the contract. This stage checks the feature's screens against it. Two halves: mechanical (lint + grep), then judgement (checklist, screen by screen).

## 1. Mechanical

```bash
pnpm lint    # design rules in packages/config/eslint.config.mjs must be clean — no disabling
```

Then these greps must return nothing outside `packages/design-system/src/tokens` and `docs/`:

```bash
# raw colours / arbitrary values in app code
rg -n '#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(' apps/*/src
rg -n '\b[a-z-]+-\[[^\]]+\]' apps/*/src               # tailwind arbitrary values
rg -n 'text-(gray|slate|zinc|neutral|stone|red|blue|green|yellow|indigo|purple|pink)-[0-9]' apps/*/src   # default palette leaked in
# raw form controls / buttons outside the design system
rg -n '<(button|input|select|textarea)\b' apps/web/src apps/site/src
rg -n '<(TouchableOpacity|Pressable|TextInput)\b' apps/mobile/src apps/mobile/app   # should be wrapped by native primitives
# fonts loaded at runtime
rg -n 'fonts.googleapis|fonts.gstatic' apps
# zoom blocked instead of fixed; broken mobile viewport height
rg -n 'maximum-scale|user-scalable' apps/*/index.html apps/*/src
rg -n '\b(min-)?h-screen\b|100vh' apps/web/src apps/site/src         # use h-dvh / min-h-dvh
# accessibility and motion red flags (each hit needs a reason, or a fix)
rg -n 'outline-none|outline: ?none' apps/*/src                      # only with a focus-visible replacement
rg -n 'tabIndex=\{?[1-9]|allowFontScaling=\{false\}' apps               # positive tab order; disabled font scaling
rg -n 'transition-all|duration-[0-9]|ease-(in|out|linear)\b' apps/*/src   # use motion token classes
rg -n 'setTimeout\([^)]*(200|300|500)\)' apps/*/src                    # animation choreography by timeout (motion §3)
```

Then the automated accessibility scan (`.claude/skills/accessibility/SKILL.md` §6): `pnpm --filter web exec playwright test e2e/a11y.spec.ts` with this feature's screens and forced states added. No `serious` or `critical` violations except exceptions listed in `docs/ACCESSIBILITY.md`.

Any hit: fix by using a token or a primitive. If the *token doesn't exist*, that's a design-system change — add it via the design-system skill (token + style guide + generated outputs together), never a local exception. The only sanctioned exception is a third-party embed you don't control; wrap it and note it in PROGRESS.

## 2. Checklist — walk it per screen

Open the screen locally next to the style guide. For each new or changed screen (web page, mobile screen, site page), answer every line; write "n/a" only with a reason.

**Matches the mock**
- If the style guide has a mock for this screen, the layout, hierarchy and component choices match it. Deviations are intentional and the mock is updated too.
- If there is no mock, one was added to the style guide before building (component-breakdown rule).

**Hierarchy & typography**
- One `Heading` at the page level, sizes descend with nesting; no skipped levels.
- Only `Text`/`Heading` components (or their classes) set type — no ad-hoc `font-*`/`text-*` combos.
- Line length for reading copy ≤ ~70 characters.

**Spacing & layout**
- All gaps from the spacing scale via `Stack`/`Inline`/gap tokens. No "one-off" margins.
- Container/gutters match the style guide's layout section. Content aligns to one left edge.
- Nothing touches the viewport edge on mobile widths.

**Colour**
- Semantic tokens only (`bg-*`, `fg-*`, `border-*`, status colours for status).
- Brand colour used for the primary action and active state, not for decoration or body text.
- Dark mode (if enabled) checked — toggle it; nothing unreadable.

**Components & states**
- Primitives used for every control; variants used as designed (one primary button per area).
- Every screen matches its **ux plan** state map. Walk `.claude/skills/ux/SKILL.md` Part B: force each loading, empty, error, offline and permission state in the running app, not just in code.
- Every list/table has: empty state, loading state (skeleton, not spinner-in-void), error state with retry.
- Every form has: labels, help text where needed, inline field errors, disabled + loading submit while pending, success feedback (toast or navigation).
- Destructive actions follow the ux plan: Undo, or a `Dialog` confirmation naming the thing with the danger button.

**Interaction & accessibility**
- Everything reachable by keyboard in a sensible order; visible focus ring (the token one) on every focusable thing.
- Icon-only buttons have `aria-label`. Images have `alt`. Form controls have associated labels.
- Contrast: any *new* colour pairing checked ≥ 4.5:1 (text) / 3:1 (UI). Existing token pairs are pre-verified in the style guide.
- Motion uses the motion tokens; nothing animates for longer than `slow`; with Reduce motion on, movement becomes a fade or instant (`.claude/skills/motion/SKILL.md` §4, §7).
- Manual accessibility walk done: keyboard only, screen reader quick pass, zoom 400%, reduced motion, colour-blind emulation (`accessibility` §7). Anything below the target that the owner hasn't accepted is fixed; a conflict with the owner's wishes goes to them per `accessibility` §2.

**Responsive**
- Web: checked at 375 px, 768 px, 1280 px. No horizontal scroll, no overlapping, tables collapse or scroll within a container.
- Web on iPhone (Simulator or device): focusing every input/select/textarea on the screen does **not** zoom the page.
- Installable web app (ARCHITECTURE.md PWA: Yes): opened from the home screen, content clears the notch and home indicator (safe-area utilities), every screen outside the main nav has an in-app back (or Close, for focused flows) that works after opening the screen from a direct link, submitted forms and redirects aren't left in the back history (pwa skill §7), and the update toast still works (pwa skill §10 update test) if the shell or routing changed.
- Mobile: safe areas respected; tap targets ≥ 44 pt; keyboard doesn't cover the focused input.
- Site: Lighthouse-style basics — text readable without zoom, images sized.

**Copy**
- Sentence case for buttons and headings (unless the style guide says otherwise). Consistent terms with the PRD (if the PRD says "project", the UI never says "workspace").
- Error messages say what happened, whether work is safe and what to do next, not what went wrong internally (`.claude/skills/error-states/SKILL.md` §1).
- Dates, times and numbers formatted with `Intl` in the user's locale.

## 3. Cross-platform consistency (if mobile exists)

Same feature on web and mobile: same screen names, same component *names and props*, same empty/loading/error copy, same order of actions. Differences are platform conventions only (tabs vs sidebar, sheet vs dialog) and are documented in the style guide's Components section.

## 4. What this stage produces

```markdown
### F00N — design compliance
lint ✓ · raw-colour grep ✓ · raw-element grep ✓ · a11y/motion grep ✓ · axe ✓ (0 serious/critical)
Screens checked: ProjectListPage (375/768/1280, dark ✓), ProjectFormPage
Deviations from mock: table shows "Owner" column not in mock — mock updated (style guide rehashed)
UX review: states forced 7/7 ✓ · keyboard ✓ · VoiceOver ✓ · zoom 400% ✓ · reduced motion ✓ · Slow 4G ✓
Accessibility exceptions: none | A2 (owner accepted, docs/ACCESSIBILITY.md)
New tokens needed: none
Follow-ups: none  (any → backlog `design` items, listed here by id)
```

Then `/build` moves to `verify`.
