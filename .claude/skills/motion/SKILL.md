---
name: motion
description: Smooth, purposeful transitions between states — motion tokens (durations, easings, distances), what to animate and when (state changes, enter/exit, route transitions, list changes, feedback), performance rules (transform and opacity only, interruptible, never blocking input), and full reduced-motion support that swaps movement for fades or instant changes rather than just switching everything off. Tools per platform — CSS transitions and Tailwind motion variants first, the View Transitions API for routes, the Motion library for presence and layout animation on web, Reanimated on mobile. Called by design-system for motion tokens, by the ux stage when planning transitions, and by design-compliance when checking a screen.
---

# motion — transitions that explain, never decorate

Motion exists to help people follow what changed: where a panel came from, which row was added, that a tap registered. If an animation doesn't answer "what just changed and where?", it probably shouldn't exist. Good motion is quick enough that nobody notices it as "animation". They notice the app feels smooth.

And some people get dizzy, nauseous or distracted from movement on screen (vestibular disorders, migraines, ADHD). They turn on **Reduce motion** in their device settings. The app always respects that.

## 1. Tokens (design-system owns these)

Extend `tokens.motion` in `packages/design-system/src/tokens/tokens.ts`. Generated into CSS variables, the Tailwind preset and the native theme like every other token:

```ts
motion: {
  fast: "120ms", base: "200ms", slow: "320ms",   // durations
  ease:      "cubic-bezier(.2,.8,.2,1)",         // standard: most state changes
  easeEnter: "cubic-bezier(0,0,.2,1)",           // decelerate: things arriving
  easeExit:  "cubic-bezier(.4,0,1,1)",           // accelerate: things leaving
  distance: { sm: "4px", md: "8px", lg: "16px" }, // how far things slide in
},
```

(Keep `fast`/`base`/`slow`/`ease` names stable; existing components use them. For "instant", use no transition.)

**Reduced motion lives in the tokens**, so components don't each reinvent it. In `tokens.css`:

```css
@media (prefers-reduced-motion: reduce) {
  :root { --motion-distance-sm: 0px; --motion-distance-md: 0px; --motion-distance-lg: 0px; }
}
```

Slides become fades automatically, because the distance is zero and the opacity change still happens. Durations stay short. Anything more complex than a fade uses `motion-safe:`/`motion-reduce:` variants or the hooks in §5.

Style guide: a **Motion** section showing each duration and easing as a live demo, plus a "Reduced motion" toggle on the page that sets a class which mimics the media query, so the owner can see both.

## 2. When to animate, and how long

| Change | Motion | Duration / ease |
|---|---|---|
| Hover, press, focus ring, toggle, checkbox | colour/background/shadow transition; press scale 0.98 at most | `fast`, standard |
| Something appears in place (inline error, helper text, badge count) | fade + slight slide (`distance.sm`) | `fast`–`base`, enter |
| Dialog, popover, menu, tooltip opening | fade + scale from 0.96 (popovers from their trigger's side) | `base`, enter; exit `fast`, exit ease |
| Sheet / side panel / mobile bottom sheet | slide from its edge + backdrop fade | `slow`, enter; exit `base` |
| Toast | slide in from its edge (`distance.md`) + fade; exits fade | `base` |
| Route / screen change (web) | cross-fade of the main region (View Transition); shared element only where it genuinely links two screens (list row → detail header) | `base` |
| Screen push (mobile) | the platform's native stack transition. Don't customise. | native |
| List item added | fade + expand height, briefly highlight the new row (`bg.subtle` fading out) | `base` |
| List item removed | fade + collapse; items below move up smoothly (layout animation) | `fast`–`base`, exit |
| Reorder / filter / sort | layout animation of items to new positions | `base` |
| Skeleton → content | content fades in (no slide) | `fast` |
| Tab / segment change | indicator slides; content cross-fades | `base` |
| Success confirmation | a check icon draws or pops once; no confetti unless the PRD's tone calls for it (and never under reduced motion) | `slow` max |
| Numbers changing (counts, totals) | no count-up animation by default; they delay reading the value | — |

Rules of thumb:

- **Nothing longer than `slow` (320 ms)** except progress indicators and deliberate one-off moments.
- **Exits are faster than entrances.** Leaving things should get out of the way.
- **Small distances.** Things nudge into place (4–16 px), they don't fly across the screen.
- **One thing moves at a time** where possible. Stagger list entries only on first load, at most ~5 items × 30 ms; the rest appear together.
- **Don't animate on every render.** Animate *changes the user caused or needs to notice*, not data arriving on a background refetch.

## 3. Performance and behaviour rules

- Animate **`transform` and `opacity` only**. Animating `width`, `height`, `top`, `margin` or `box-shadow` on large areas causes jank on phones. For height expand/collapse, use the library's layout animation (it uses transforms) or `grid-template-rows: 0fr → 1fr`.
- **Never block input.** The user can click, type or navigate during any transition. A dialog's buttons work before its entrance finishes.
- **Interruptible.** Opening and immediately closing a menu reverses smoothly from where it is; CSS transitions and Motion/Reanimated do this if you don't chain timeouts.
- **No `setTimeout` choreography** tied to durations. Use transition/animation end events or the library's presence handling, so reduced motion (0-length) and interruptions don't break logic.
- **Focus management doesn't wait for animation.** Move focus when the dialog mounts, not when its animation ends.
- No layout shift: entering elements take their space immediately (or animate height via layout animation). Nothing jumps when an animation finishes.
- Test on a mid-range phone or with CPU throttling (DevTools → Performance → 4× slowdown). If it stutters, simplify.

## 4. Reduced motion — reduce, don't just remove

When `prefers-reduced-motion: reduce` (web) or Reduce Motion (iOS/Android) is on:

| Normal | Reduced |
|---|---|
| Slide, scale, zoom, parallax, shared-element flight | **Opacity fade** only (same or shorter duration) or instant |
| Layout animation of reordering lists | Instant reposition; a brief highlight on the moved item is fine |
| Skeleton shimmer | Static skeleton (or a very slow opacity pulse) |
| Indeterminate progress bar sweeping | Keep it (it communicates activity) but slower, or a static bar with "Loading…" text |
| Spinner | Keep (essential), no bounce or elastic effects |
| Autoplaying video, animated illustrations, looping backgrounds, confetti | Off; show a static frame |
| Smooth scrolling (`scroll-behavior: smooth`, `scrollIntoView({behavior:"smooth"})`) | Instant jump |
| Route cross-fade | Instant or fade |

Fades are generally safe; *movement across space* is what causes problems. Keeping a short fade keeps the "what changed?" cue for everyone.

Default: honour the OS setting only. Add an in-app "Reduce motion" preference only if the PRD's users suggest it (e.g. a shared kiosk, an audience likely to be affected). That's an owner's call via `explain-decisions`.

Also regardless of setting (WCAG): anything that moves or auto-updates for more than 5 seconds has a pause control, and nothing flashes more than three times per second.

## 5. Tools per platform

Check current versions and APIs before adding anything (`choosing-versions`: `npm view <pkg> version`, read the docs). Adding a motion library is a decide-and-tell with an ADR the first time.

### Web (`apps/web`)

1. **CSS transitions via Tailwind + tokens** for hover/press/focus, simple enter states and anything the primitives do: `transition-colors duration-fast ease-standard` (whatever class names the preset generates for the tokens), `motion-safe:animate-…`, `motion-reduce:transition-none`. Most of the app needs nothing else.
2. **Headless primitive animations** (dialog, popover, tooltip, sheet): the accessible library the design system chose exposes open/closed data attributes. Animate with CSS on those (`data-[state=open]:animate-in`-style classes defined in the preset). Presence is handled by the library.
3. **Route transitions: the View Transitions API.** React Router supports it (`viewTransition` on `Link`/`navigate`, check the current docs for the exact API). Define the cross-fade in CSS with `::view-transition-old/new(root)` using tokens, and disable movement under `prefers-reduced-motion`. Browsers without support just navigate instantly, which is fine.
4. **The Motion library** (`motion`, import from `motion/react`) only when you need presence animations outside a headless primitive (toasts stack, list add/remove), layout animations (reorder, filter) or shared elements. Wrap the app once in `<MotionConfig reducedMotion="user">`. Transforms and layout animations are then disabled for reduced-motion users while opacity still animates. Put reusable variants (`fadeIn`, `slideUp`, `listItem`) in `packages/design-system/src/motion/` reading token values, so features don't hand-type durations.
5. `useReducedMotion()` (from Motion, or a tiny `matchMedia` hook in the design system) for JS-driven decisions: autoplay, smooth scroll, confetti.

### Mobile (`apps/mobile`)

- **Reanimated** (ships with the Expo templates; check the SDK's bundled version): layout animations (`entering={FadeIn.duration(...)}`, `exiting`, `layout={LinearTransition}`) with durations from `theme.native.ts`. Set `.reduceMotion(ReduceMotion.System)` on animations, or read `useReducedMotion()` (check the current Reanimated API).
- Navigation transitions: Expo Router / React Navigation native stack defaults. They already respect platform reduce-motion settings.
- `Pressable` feedback via the native primitives (opacity/scale), `fast` duration.
- Haptics (`expo-haptics`) for confirmations and destructive actions is motion's cousin: light, only on meaningful events, never as the only feedback.

### Site (`apps/site`)

CSS only. Astro's view transitions (`<ClientRouter />`) if the site has multiple pages and the owner wants smoother navigation; it respects reduced motion by default. Check the current Astro docs. Scroll-triggered reveal animations: avoid by default (content hidden until scrolled hurts reading, SEO tools and reduced-motion users); if the owner wants them, content must be visible without JS and under reduced motion.

## 6. Testing

- **Unit/RTL:** animations don't affect logic. In the test setup, mock `matchMedia('(prefers-reduced-motion: reduce)')` to `true` and set `MotionGlobalConfig.skipAnimations = true` (check the current Motion API) so tests are deterministic.
- **Playwright:** `test.use({ reducedMotion: 'reduce' })` for one pass of the smoke test, plus the axe scan. Assert the flow still works (dialogs open, toasts appear) with motion reduced.
- **By eye:** walk the feature with Reduce motion on and off. On (§4 table): nothing slides, zooms or flies. Off: nothing feels slow, nothing jumps at the end, rapid open/close doesn't glitch. With 4× CPU throttling: still smooth.

## 7. Checklist (used by the ux review)

- [ ] Every animation answers "what changed and where?"
- [ ] Durations and easings come from tokens; nothing over `slow` without a reason.
- [ ] Only `transform`/`opacity` animated; no layout shift; interruptible; input never blocked.
- [ ] Reduced motion: movement becomes fade or instant; shimmer, autoplay, smooth scroll and confetti off.
- [ ] Focus moves without waiting for animations.
- [ ] Anything moving longer than 5 s can be paused; nothing flashes.
- [ ] Checked with Reduce motion on, and with CPU throttling.
