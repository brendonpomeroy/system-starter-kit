---
name: accessibility
description: Make the app usable by everyone — people using keyboards, screen readers, zoom, voice control, reduced motion or large text, and anyone in a bright, noisy or one-handed situation. Sets the target (WCAG 2.2 AA by default), builds accessibly without asking, and when accessibility conflicts with something the owner wants, guides them with a recommendation and an accessible alternative but lets them make the call and records it in docs/ACCESSIBILITY.md. Per-platform build rules (web, site, mobile), automated checks (jsx-a11y lint, role-based tests, axe in Playwright) and a short manual walk (keyboard, screen reader, zoom, reduced motion). Called by design-system, the ux stage, design-compliance and verification; also when the owner asks "is it accessible?".
---

# accessibility — usable by everyone, decided with the owner

Accessibility is how a person who can't see the screen, can't use a mouse, zooms to 300%, gets motion-sick from animation or is using the app one-handed on a bus still gets their job done. It isn't a separate feature. It is part of every screen being built properly.

Two rules for this skill:

1. **Build accessibly by default.** Almost everything here costs nothing extra if it's done while building. Don't ask permission to label a button.
2. **The owner makes the calls when there's a real trade-off.** When accessibility conflicts with something they want (a brand colour, a look, a feature, a deadline), explain who is affected, recommend the accessible option, offer a way to keep what they wanted, then **respect their decision** and record it. Guide; don't lecture, and don't quietly override them.

## 1. How decisions work

| Kind | Examples | What you do |
|---|---|---|
| **Built in (just do it)** | semantic elements, labels on every control, keyboard access, visible focus, alt text, headings in order, page titles, 16px+ inputs, no zoom blocking, reduced-motion support, errors in text (not only red), 44px touch targets on mobile | Build it. Never mention it unless asked. It's the professional baseline, like closing a SQL connection. |
| **Decide and tell** | the WCAG target level; using a headless accessible library for dialogs; adding a skip link; darkening a grey that failed contrast by a shade the eye barely notices | Do it. One line in the step summary. |
| **Owner's call** | a brand colour that fails contrast for text; removing focus outlines "because they look ugly"; placeholder-only labels for a minimal look; icon-only navigation; auto-playing video or carousels; a time limit; a drag-only interaction; a CAPTCHA or puzzle at sign-in; shipping a feature before its accessibility follow-up is done; turning an accessibility check off | Ask using §2. Build what they choose. Record it (§3). |

**Never silent.** If the owner's choice (or a deadline) means a flow won't work for some people, they must know that in plain words before it ships. That is the one thing you insist on.

### Common conflicts and the alternative to offer

Most conflicts have a version that keeps the owner's intent and stays accessible. Lead with it.

| The owner wants | Who it affects | Offer instead |
|---|---|---|
| Light grey text / pale brand colour on white | people with low vision, older users, anyone in sunlight | Keep the brand colour for large headings, backgrounds and accents; use a darker shade from the same scale for body text and buttons. Show both side by side. |
| No focus outline | everyone using a keyboard (including power users and people with tremors) | `:focus-visible` ring: it shows only for keyboard users, so mouse users never see it. Style it in the brand colour. |
| Placeholder text instead of labels | screen reader users; anyone who forgets what the field was once they start typing | Small labels above fields; or floating labels that stay visible. |
| Icon-only buttons/navigation | screen reader users; new users who don't know the icons | Icons with visible text on desktop; icon-only on mobile with an accessible name and a tooltip. |
| Auto-playing carousel or video | screen reader users (content changes under them); people with attention or vestibular conditions | No autoplay; or autoplay with a visible pause button, stopping on hover/focus, and never under reduced motion. |
| Drag to reorder / swipe-only actions | keyboard, switch and voice-control users; people with tremors | Keep drag, and add "Move up/down" buttons or a menu action. |
| Session timeout / timed checkout | people who read or type slowly, screen reader users | Warn before expiry with "Stay signed in"; save their work so re-signing in doesn't lose it. |
| Puzzle CAPTCHA at sign-up | blind users; people with cognitive disabilities | Cloudflare Turnstile (invisible) and rate limiting. |
| Tiny text to fit more on screen | low vision, older users, phones | Denser layout with the normal text size; progressive disclosure. |

## 2. Asking the owner

Use the format in `.claude/skills/explain-decisions/SKILL.md`, with three additions:

- **Who this affects, in human terms.** "People who can't use a mouse", "about 1 in 12 men, who have some colour blindness", "anyone reading their phone outside in sunlight". Include people with situational limits (a broken arm, a baby in one hand, a noisy room) so it doesn't sound like an edge case. Don't guess at precise percentages you can't back up.
- **What it looks like for them.** "A screen reader would say 'button, button, button' with no names." One sentence, concrete.
- **Legal context, honestly and in proportion.** Many places have accessibility laws for public-facing products (for example the ADA in the US, the European Accessibility Act for many consumer products and services in the EU, the Equality Act in the UK, AODA in Ontario). Say when it might apply to *their* PRD (public-facing, selling to consumers, government or education customers), say you're not a lawyer, and recommend they check if it matters. Don't use legal risk as a scare tactic for an internal tool used by three staff.

Recommend the accessible option or the alternative from §1. If they still choose otherwise, say "Understood — building it your way", do it, and record it. Don't reopen it unless something material changes (a new audience, a legal requirement, a complaint), and when you do, say what changed.

## 3. The record — `docs/ACCESSIBILITY.md`

Created during the design-system step (the first place real trade-offs appear) or the first time this skill runs. Living document, not hashed.

```markdown
# Accessibility

## Target
WCAG 2.2 level AA — web app, site and mobile app. Decided: <date>, <recommended default | owner>.
Why this level: <one line — e.g. "industry standard; expected by public-facing products">

## What we support
Keyboard only · screen readers (VoiceOver, NVDA, TalkBack) · zoom to 400% / large text · reduced motion · colour-blind safe status colours · <dark mode if enabled>

## Owner decisions and known exceptions
| # | Date | What | Who it affects | Decided | Alternative offered | Revisit when | Backlog |
|---|---|---|---|---|---|---|---|
| A1 | 2026-09-17 | Brand teal used for button text on white (3.9:1, below 4.5:1) | low-vision users, sunlight | owner | darker teal-700 for text | before public launch | I021 |

## Last checked
<date> — <verification report link> — axe: 0 serious/critical · keyboard walk ✓ · VoiceOver pass ✓
```

Every exception also becomes a `design` backlog item (`.claude/skills/backlog/SKILL.md`) with its revisit condition.

## 4. The target

Default: **WCAG 2.2 AA** for every app. It's decide-and-tell. Ask only if:

- the PRD's users include people who are likely to rely on assistive technology (older people, a disability service, education, government, healthcare); recommend AA plus the specific AAA items that matter to them (e.g. larger targets, simpler language); or
- the owner has a contract or legal requirement naming a standard (Section 508, EN 301 549): use that.

## 5. Build rules

### Web (`apps/web`) and islands in `apps/site`

**Structure**
- Real elements: `<button>` for actions, `<a href>` for navigation (both via design-system primitives), `<main>`, `<nav>`, `<header>`, lists as lists, tables as tables with `<th scope>`. `div` with `onClick` is a bug.
- `<html lang>` set. Every route sets `document.title` to "<Page> — <App>".
- One `h1` per page; headings in order. The `Heading` primitive takes `level` separately from `size`, so looks and structure don't fight.
- Skip link ("Skip to content") as the first focusable element in `AppShell`.

**Keyboard and focus**
- Every interactive thing is reachable with Tab, works with Enter/Space, and has the token focus ring via `:focus-visible`. Tab order follows the visual order; no positive `tabIndex`.
- **Route changes:** move focus to the new page's `h1` (with `tabIndex={-1}`) or its main region, and update the title. Without this, screen reader users don't know the page changed.
- **Dialogs, sheets, menus:** use the headless accessible library the design system chose (focus trap, Escape to close, focus returns to the trigger). Never hand-roll.
- After deleting an item, focus goes somewhere sensible (the next item, or the list heading), not to `<body>`.
- Sticky headers and footers must not cover the focused element (WCAG 2.4.11): add `scroll-padding-top` equal to the header height.

**Names, roles, states**
- Icon-only buttons have `aria-label`; decorative icons have `aria-hidden="true"`.
- Images: meaningful `alt`; decorative `alt=""`. User-uploaded images get an alt field if they carry meaning.
- Toggles expose state (`aria-pressed`, `aria-expanded`, `aria-current="page"` on active nav).
- Prefer visible text over ARIA. No ARIA is better than wrong ARIA.

**Forms**
- Every control has a visible, associated label (`FormField` does this). Required fields are marked in text, not only with colour or `*`.
- Errors: text next to the field, linked with `aria-describedby`, `aria-invalid="true"`; on submit, focus moves to the first invalid field (or an error summary for long forms). See `.claude/skills/error-states/SKILL.md`.
- Correct `type`, `autocomplete` and `inputMode` (`email`, `current-password`, `one-time-code`, `tel`) so password managers, autofill and the right phone keyboard work.
- Sign-in allows paste and password managers; no cognitive puzzles (WCAG 3.3.8). Don't ask for information the user already gave in the same flow (3.3.7).

**Announcements**
- One polite live region in the shell (`Announcer` primitive / `useAnnounce()`). Toasts use `role="status"`; blocking errors use `role="alert"`. Loading and saving announcements follow `.claude/skills/loading-states/SKILL.md`, so they aren't too noisy.

**Visual**
- Contrast from the token table: text ≥ 4.5:1, large text and UI parts (borders of inputs, focus ring, icons that carry meaning) ≥ 3:1.
- Never colour alone: status badges have text or an icon, errors have text, charts have labels or patterns.
- Works at 400% zoom / 320 px wide without horizontal scrolling (except tables and code, which scroll inside their container). Text spacing can be increased without clipping: no fixed heights on text containers.
- Targets at least 24×24 px with spacing (2.5.8); 44×44 px for primary actions and anything on touch screens.
- Reduced motion: `.claude/skills/motion/SKILL.md`. Dark mode and Windows High Contrast (`forced-colors`) don't hide focus rings or borders.
- Anything that moves, blinks or auto-updates for more than 5 seconds can be paused. Nothing flashes more than three times a second.

**Interaction patterns**
- Every drag action has a non-drag alternative (2.5.7). Hover-only content (tooltips) also appears on focus, can be dismissed with Escape, and never holds essential information.
- Help (contact, docs link) appears in the same place on every page if it exists (3.2.6).

### Mobile (`apps/mobile`, React Native)

- Every touchable has `accessibilityRole` and an `accessibilityLabel` if it has no text; state via `accessibilityState` (`selected`, `disabled`, `checked`, `expanded`). The native primitives set these, so feature code passes `label` props.
- Group related text into one element (`accessible` on the row) so a list row reads as one sentence, not five fragments.
- **Dynamic Type / font scaling stays on.** Never set `allowFontScaling={false}` globally. Test at the largest size; layouts wrap, they don't clip. Use `maxFontSizeMultiplier` only on tight chrome (tab labels), never on body text.
- Touch targets ≥ 44×44 pt (`hitSlop` for small icons).
- Screen change: focus the header (`AccessibilityInfo.setAccessibilityFocus`) when a screen's content changes without navigation; announce results with `AccessibilityInfo.announceForAccessibility`.
- Reduced motion: `AccessibilityInfo.isReduceMotionEnabled()` / Reanimated's `useReducedMotion` (see motion skill).
- Custom gestures (swipe to delete) have an `accessibilityActions` equivalent.

### Site (`apps/site`, Astro)

Same structure, contrast, alt text, `lang`, skip link and heading rules as web. Astro's `<Image>` requires `alt`; keep it meaningful. Link text makes sense on its own ("Read the pricing guide", not "click here"). Run `astro check` and the axe scan against the built pages.

## 6. Automated checks (catch roughly a third of issues — cheap, so always on)

| Check | Where | Set up |
|---|---|---|
| `eslint-plugin-jsx-a11y` (recommended rules, `error`) | `packages/config/eslint.config.mjs` | installed by scaffold with the other ESLint plugins; never disabled per file without a reason in PROGRESS |
| Role-based tests | RTL tests query `getByRole` / `getByLabelText`. If a test can't find a control by role and name, neither can a screen reader. | code-quality skill |
| axe scan | `@axe-core/playwright` in `e2e/a11y.spec.ts`: visit each key screen (signed in with a seed user) and each state you can force (empty, error, open dialog), and run `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze()`. Fails on `serious` or `critical` violations not listed as exceptions in ACCESSIBILITY.md. | added in F001; each feature adds its screens |
| Contrast script | design-system skill Part 2 | already there |
| Mobile | `eslint-plugin-react-native-a11y` if it supports the current ESLint (check with `choosing-versions`); otherwise rely on native primitives + the manual pass | decide-and-tell at scaffold |

Check current package names and APIs with `npm view` and the docs before installing; don't trust the snippets above blindly.

## 7. Manual walk — per new or changed screen (about 10 minutes)

Automated tools can't tell whether something *makes sense*. Walk it:

1. **Keyboard only.** Unplug the mouse mentally. Tab through the whole screen: can you reach and use everything, in a sensible order, always seeing where focus is? Open and close every dialog with the keyboard. Submit the form with errors: where did focus go?
2. **Screen reader, quick pass.** macOS VoiceOver (Cmd+F5) in Safari: the rotor (Ctrl+Option+U) lists headings, landmarks and form controls that make sense on their own; buttons have names; the page change after navigation is announced; errors and toasts are read. On mobile: VoiceOver on an iPhone or TalkBack on Android for the main flow (ask the owner to help per `guide-owner` if no device/simulator is available).
3. **Zoom.** Browser zoom 200% and 400% (or a 320 px wide window): nothing cut off, no sideways scroll for the page. Mobile: largest text size.
4. **Reduced motion.** macOS System Settings → Accessibility → Display → Reduce motion (or DevTools → Rendering → emulate `prefers-reduced-motion: reduce`): no sliding, zooming or parallax; the app still makes sense.
5. **Colour.** DevTools → Rendering → emulate vision deficiencies (achromatopsia, deuteranopia): status and errors are still clear.

Record in the feature's compliance entry: `a11y: axe ✓ · keyboard ✓ · VoiceOver ✓ · zoom 400% ✓ · reduced motion ✓`.

## 8. Severity (used by verification)

| Severity | Examples |
|---|---|
| **critical** | a core flow (sign-in, the PRD's main flow) can't be completed by keyboard or screen reader; a keyboard trap; an unlabelled sign-in form |
| **high** | axe `serious`/`critical` on a key screen; dialog without focus management; errors only shown in colour; content lost at 200% zoom; text contrast below 3:1 |
| **medium** | missing route focus/title change; text contrast between 3:1 and 4.5:1; touch targets under 44 px on mobile; decorative images announced |
| **low** | best-practice gaps: redundant ARIA, link text like "here" on a secondary page |

Accessibility findings go in the verification report under their own heading. Critical and high block `done` **unless the owner has accepted them** as a recorded exception (§2, §3). Accepted exceptions are not counted in `state.verification.openFindings`; undecided ones are. Security findings never have this override. Accessibility does, because it is the owner's product decision, but they must make it knowingly.

## 9. Anti-patterns

- `div`/`span` with click handlers; `outline: none` without a replacement.
- `aria-label` on everything "just in case"; `role="button"` on a real button; `aria-hidden` on focusable elements.
- Disabling font scaling or pinch zoom to protect a layout.
- An "accessibility overlay" widget. They don't fix the underlying problems and often make things worse for screen reader users. Recommend against it if the owner asks.
- Treating the axe scan passing as "accessible". It's the floor, not the proof.
- Moralising. Explain the effect on people, recommend, then respect the decision.
