---
name: loading-states
description: Keep people informed while they wait — the right loading pattern for how long the wait is (nothing, skeleton, inline spinner, progress, background job), no flicker on fast responses, no layout shift, refetches that don't wipe the screen, pending buttons that prevent double submits, optimistic updates only where state-management allows them, route and auth bootstrap loading, and announcing progress to screen readers without noise. Per-platform patterns for web, mobile and site, plus how to test slow networks. Called by the ux stage when planning a screen's states, and by design-system for the Skeleton/Spinner/ProgressBar primitives.
---

# loading-states — the wait should feel short and never confusing

A loading state answers three questions: **is something happening, what is it, and roughly how long?** A blank screen answers none of them. A spinner that flashes for 80 ms makes a fast app feel slow and jumpy.

Load `.claude/skills/state-management/SKILL.md`'s decision for the feature first. Whether a write is optimistic, a command with a pending state, or realtime decides most of what's below.

## 1. Match the pattern to the wait

| Expected wait | Pattern | Why |
|---|---|---|
| **< ~300 ms** (most cached reads, small writes) | Show nothing new. Keep the current screen. Only the pressed button shows it's pending. | An indicator that appears and vanishes looks like a glitch. |
| **~300 ms – 2 s** (first load of a list, page data) | **Skeleton** shaped like the real content, in the place the content will appear. For actions: spinner *inside* the button + label change ("Saving…"). | Shows the layout early, so the page feels already there. |
| **2 – 10 s** (uploads, imports, reports) | **Progress indicator**: determinate (`ProgressBar` with %) when the size is known, otherwise an indeterminate bar plus a sentence saying what's happening ("Importing 240 contacts…"). Keep the rest of the UI usable. | People tolerate waits they understand. |
| **> 10 s or unknown** (AI generation, exports, payments waiting on a provider) | **Background job**: the request returns immediately with a job id (state-management "command" pattern); show a pending row/status; let the user leave; notify on completion (toast if still in the app, email/push if the PRD has it). | Nobody should have to watch a spinner for a minute, or lose the result by navigating away. |

Delay and minimum-duration rules (implement once, in a hook, and reuse):

- **Delay before showing** a skeleton or spinner: ~300 ms (`useDelayedFlag(isPending, 300)`). If data arrives first, the user never sees a loading state.
- **Minimum display** once shown: ~500 ms, so it doesn't flash.
- Button pending states show **immediately** (no delay). The button *is* the feedback that the tap registered.

## 2. The rules

**First load vs refetch.** The skeleton is for when there is *nothing* to show yet. When refetching (focus, filter change, pagination, invalidation after a mutation), **keep the existing content** on screen and show a subtle indicator: a thin top progress bar in the region, or reduced opacity on the stale list. With React Query that means `placeholderData: keepPreviousData` for paginated or filtered queries and checking `isPending` (no data yet) separately from `isFetching` (updating). Never swap a full list for a skeleton because a background refetch started.

**No layout shift.** Skeletons match the real content's size: same row height, same number of rows as a typical page (or the previous count), same card grid. Images reserve their space (`width`/`height` or `aspect-ratio`). Buttons keep their width when the label changes to "Saving…" (min-width or the spinner replaces the icon, not the text). Content that loads in after the main content (a count, a badge) reserves its slot.

**Pending actions.**
- The submit button shows `loading` (design-system `Button loading` prop): spinner, `aria-busy`, disabled against a second click. Other fields stay readable; they can be disabled if editing mid-submit would be confusing.
- Protect against double submission on the server as well: idempotency key per submit for anything with side effects (state-management §2).
- If a save takes over ~2 s, change the label again ("Still saving…") so it doesn't look frozen.
- Navigation away mid-save: either let it finish in the background with a toast on success/failure, or warn about unsaved work. Decide per form in the ux plan.

**Optimistic updates** (only where state-management chose them: low-risk, reversible, no side effects, low contention). Examples: ticking a checkbox, renaming, reordering, starring. The UI changes instantly; on failure, roll back **and** tell the user with an error toast that includes Retry (`.claude/skills/error-states/SKILL.md`). Never optimistic for payments, emails, invitations, deletes of shared data or anything state-management marked as a command.

**Route loading.** Lazy routes have a `Suspense` fallback that renders the *page shell* (header + skeleton), not a blank page or a centred spinner. Prefetch the likely next route's code and data on hover/focus/intent (`queryClient.prefetchQuery`, the router's prefetch where available) for the core flows.

**App bootstrap and auth.** While Supabase restores the session, show the app-level splash (logo on `bg.base`, or the shell skeleton). Never flash the sign-in screen and then jump into the app, and never flash protected content before the redirect to sign-in (verification checks this).

**Partial loading.** Independent regions load independently: a slow "activity" panel doesn't hold the main list back. Each region owns its loading, empty and error state. Don't wrap a whole page in one loading gate unless the regions really depend on each other.

**Long lists.** Paginate or use "Load more" with the button showing its own pending state. Infinite scroll only if the PRD's use suits it, and never on a page with a footer the user needs to reach.

**Images and media.** Reserve the space, show a neutral `bg.muted` block, fade the image in (motion tokens; instant under reduced motion). Lazy-load below the fold.

## 3. Accessibility of loading

- The region being loaded gets `aria-busy="true"` while pending.
- A `Spinner` on its own has `role="status"` and a visually hidden label ("Loading projects"). A spinner inside a button relies on the button's `aria-busy` and changed label instead.
- Skeletons are `aria-hidden="true"`: screen readers hear the region is busy, not a pile of empty boxes.
- **Announce sparingly** via the shell's `Announcer`: announce waits over ~2 s ("Loading report…"), completion of anything the user explicitly started and might not see ("Import finished: 240 contacts added"), and never every background refetch.
- Focus stays where the user left it. When content replaces a skeleton, don't move focus. When a user-initiated load completes (search results), announce the count; don't steal focus.
- Skeleton shimmer and indeterminate animations respect reduced motion: static or a slow opacity pulse (`.claude/skills/motion/SKILL.md`).

## 4. Implementation — build it once

**Design-system primitives** (design-system skill): `Skeleton` (+ `SkeletonText`, `SkeletonCircle`; sizes from tokens), `Spinner` (sizes, `label`), `ProgressBar` (determinate/indeterminate, `label`, `valueText`), `Button` with `loading`. Style guide Patterns shows: list first load, list refetching, button saving, upload progress, background job row.

**Composed (web and mobile):** `apps/<app>/src/components/composed/AsyncRegion.tsx`. It takes a query result plus `skeleton`, `empty` and `renderData`, and applies the delay, first-load vs refetch, `aria-busy`, the empty state and the error state (with retry) the same way everywhere. It is **pre-approved as a composed component from F001** (an exception to component-breakdown's "second feature" rule), because every data screen needs it.

**Hooks:** `useDelayedFlag(flag, delayMs, minVisibleMs)` in `apps/<app>/src/lib/`, tested with fake timers.

### Per platform

- **Web:** as above. Tailwind `motion-safe:animate-pulse` for skeletons. The top-of-region refetch bar is a composed piece of `AsyncRegion`.
- **Mobile:** same `AsyncRegion` API with native primitives. Pull-to-refresh (`RefreshControl`) on lists, showing the native indicator only while a user-triggered refresh runs. `ActivityIndicator` is wrapped by `Spinner`. On slow mobile networks the 2 s / 10 s thresholds come sooner, so plan background jobs for anything over ~5 s.
- **Site (Astro):** mostly static, so no loading states. For islands that fetch, use the same rules with the web primitives. Images via `<Image>` with dimensions.

## 5. Testing

- **Hooks/components (RTL + MSW):** a handler with `delay()` → skeleton appears after the delay, not before; data replaces it; refetch keeps the old rows visible; button shows pending and a second click doesn't send a second request.
- **Fake timers** for `useDelayedFlag`: fast response → never visible; slow → visible for at least the minimum.
- **By eye:** Chrome DevTools → Network → "Slow 4G" and "3G", walk the feature's screens. Also test a fast connection to catch flicker.
- **Playwright** (critical path only): throttle via CDP (`Network.emulateNetworkConditions`) and assert no blank screen: the page header is visible while data loads.

## 6. Checklist (used by the ux review)

- [ ] Each async region has a first-load pattern matched to its expected wait.
- [ ] Refetches keep content on screen.
- [ ] No flash for fast responses; no layout shift when content arrives.
- [ ] Every submit shows pending immediately and can't double-submit.
- [ ] Optimistic updates only where state-management allowed, with rollback and message.
- [ ] Waits over 10 s are background jobs the user can leave.
- [ ] `aria-busy` on loading regions; long waits and completions announced; skeletons hidden from screen readers.
- [ ] Shimmer/indeterminate animation respects reduced motion.
- [ ] Checked on Slow 4G.
