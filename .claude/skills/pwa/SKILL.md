---
name: pwa
description: Make apps/web an installable Progressive Web App — web app manifest, icon set generated from one source logo, a service worker that caches only the app shell, an "update available" prompt with periodic update checks, Cloudflare Workers cache headers, iOS/Android install UX, app-style back navigation (top-level vs pushed screens, a back action that works after a deep link, history that matches the Android back gesture), safe areas and standalone-mode gotchas. Called by scaffold when ARCHITECTURE.md says the web app is installable, or by /build as a feature ("make it installable") added later.
---

# pwa — installable web app that stays up to date

A PWA is the web app with an icon on the home screen that opens full-screen, like an app. For the owner: "people can install it from the browser, no App Store, and every deploy reaches them automatically."

Three things matter more than anything else here, in this order:

1. **Installed copies must update.** A service worker (SW) that caches too hard leaves users stuck on an old build forever. Every choice below is biased towards freshness.
2. **Never cache user data.** Cache the app shell (HTML, JS, CSS, fonts, icons) only. API responses and Supabase auth calls always go to the network.
3. **It must feel native on iPhone.** No zoom on input focus, no content under the notch, a way back from every screen that isn't in the main nav, because there is no browser back button or address bar once installed (§7).

Only `apps/web` becomes a PWA. `apps/site` gets favicons and theme colour (§3) but no service worker.

**Check current docs before writing code.** PWA tooling and iOS behaviour change often. Before starting: `npm view vite-plugin-pwa version`, `npm view @vite-pwa/assets-generator version`, and read the current guide at https://vite-pwa-org.netlify.app/guide/ (React + prompt-for-update + assets generator pages). If an API below differs from the docs, follow the docs and note the difference in the ADR.

Log start/finish of each section in `docs/PROGRESS.md` (as a sub-entry of `scaffold`, or of the feature running this).

## 0. Prerequisites

- `docs/ARCHITECTURE.md` records "Installable (PWA): Yes" and `.claude/state.json → apps.pwa` is `true`. If this runs as a later feature, update both first (+ ADR, see §10).
- Design system exists with: `packages/design-system/assets/app-icon.svg` (square mark, no fine text) and the generated browser-chrome colours in `generated/meta.ts` (`themeColor`, `themeColorDark`, `backgroundColor`). Missing → go back to the design-system skill for just those pieces; don't hand-pick hex values here.
- The `Toast` primitive exists (the update prompt uses it).

## 1. Install

```bash
pnpm --filter web add -D vite-plugin-pwa @vite-pwa/assets-generator
```

Add the client types via the CLI-generated `tsconfig.app.json` (`"types": ["vite-plugin-pwa/react", "vite-plugin-pwa/info"]` — confirm the current type entry names in the docs).

## 2. Icons — one source, every size

Source: `packages/design-system/assets/app-icon.svg`. Maskable icons get cropped to a circle or squircle by Android, so the mark must sit inside the central ~80% with a solid background. If the logo doesn't survive that, ask the design-system skill for a separate `app-icon-maskable.svg`.

Create `apps/web/pwa-assets.config.ts` using the `minimal-2023` preset (check the exported preset name in the docs), pointing `images` at the source SVG. Use the brand background colour from `meta.ts` for the maskable and apple-touch padding, not the default white, unless the icon is designed on white.

Wire it through the plugin's `pwaAssets` option so icons and `<link>` tags regenerate on build, rather than committing a pile of PNGs by hand. Expected outputs: `favicon.ico`, `favicon.svg`, `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`.

Add the icon at real sizes (180, 192, maskable preview in a circle mask) to the style guide's Brand section so the owner approves how it looks on a home screen.

If `apps/site` exists: run the same generator for `apps/site/public` (favicons + apple-touch-icon only).

## 3. `index.html` head

In `apps/web/index.html` (edit the CLI-generated file, don't replace it):

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="…themeColor…" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="…themeColorDark…" media="(prefers-color-scheme: dark)" />  <!-- only if dark mode is on -->
<meta name="apple-mobile-web-app-title" content="<short name>" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />  <!-- "black-translucent" only if the shell pads for safe areas, §6 -->
<meta name="description" content="…from PRD…" />
```

Colours come from `meta.ts`. Inject them with a tiny Vite `transformIndexHtml` hook in `vite.config.ts` rather than pasting hex into HTML. That keeps the no-raw-hex rule true.

**Never** add `maximum-scale=1` or `user-scalable=no`. They stop input zoom by blocking pinch-zoom for everyone, which is an accessibility failure. Zoom-on-focus is fixed by 16px inputs in the design system (§6).

## 4. Manifest + service worker config

In `apps/web/vite.config.ts`, add `VitePWA({...})`:

- `registerType: "prompt"`: the user decides when to reload, so we never swap code under someone mid-form.
- `injectRegister: false`: we register from React (§5).
- `manifest`:
  - `id: "/"`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`
  - `name` (full product name), `short_name` (≤ 12 characters, what shows under the icon, so ask the owner)
  - `description`, `theme_color`, `background_color` (from `meta.ts`)
  - `icons`: filled by `pwaAssets`; confirm `any` and `maskable` purposes are separate entries
  - Leave out `orientation` unless the PRD needs it.
  - Optional: `screenshots` (one `wide`, one `narrow`) for Android's richer install sheet. Add them once there are real screens.
- `workbox`:
  - `globPatterns`: JS, CSS, HTML, fonts (`woff2`), icons, `svg`. This is the precached app shell.
  - `navigateFallback: "index.html"`, so client-side routes work offline-ish and after reload in standalone.
  - `navigateFallbackDenylist`: any path the Worker must serve itself (e.g. `/^\/api\//` if the API is ever same-origin, auth callback routes if they're server-handled).
  - `cleanupOutdatedCaches: true`
  - **No `runtimeCaching` for the API or Supabase.** Both are on other origins today, and even if that changes, data is never cached by the SW. Offline data is a `state-management` decision with its own ADR.
- `devOptions.enabled: false` (default). Test the SW against a production build (§10), not `vite dev`. A dev SW causes confusing stale-code bugs.

## 5. Update flow — "New version available"

Create `apps/web/src/features/shell/UpdatePrompt.tsx`, mounted once in `AppShell`:

- Use `useRegisterSW` from `virtual:pwa-register/react`. It gives `needRefresh`, `offlineReady` and `updateServiceWorker`.
- In `onRegisteredSW(swUrl, registration)`, check for updates:
  - **every 60 minutes** on an interval;
  - **when the app returns to the foreground** (`visibilitychange` → `visible`). This is the one that matters on phones: installed apps sit suspended for days and are resumed, not reloaded.
  - Before calling `registration.update()`, skip if `registration.installing` or `!navigator.onLine`, then `fetch(swUrl, { cache: "no-store", headers: { "cache-control": "no-cache" } })` and only update on a 200. This is the documented pattern and avoids errors while offline.
- When `needRefresh` is true, show a persistent `Toast`: "A new version is available." with a primary action **Reload** → `updateServiceWorker(true)`, and a dismiss. Don't auto-reload. If a form in the app has unsaved changes, the toast is still just a prompt; the user chooses.
- `offlineReady`: show nothing (don't confuse users with "ready to work offline" unless the PRD promises offline).
- Show the build version somewhere quiet (settings/about or the account menu footer): inject `import.meta.env.VITE_APP_VERSION` (git short SHA from CI) so the owner can confirm an installed copy updated.

**Stale lazy chunks.** After a deploy, Cloudflare no longer serves the old build's hashed chunks. A tab still running the old build that lazy-loads a route gets `index.html` back (SPA fallback) and throws "Failed to fetch dynamically imported module". Add a `window.addEventListener("vite:preloadError", …)` in `main.tsx` that reloads once (guard with a `sessionStorage` flag so it can't loop).

**Kill switch.** If a broken SW ever ships, set `selfDestroying: true` in the `VitePWA` options and deploy. That unregisters the SW for every user on their next visit. Document this in `apps/web/README.md` under "Emergency".

## 6. Native feel (mostly design-system, enforced in compliance)

- **No zoom on input focus (iOS).** Safari zooms when a focused `input`, `textarea` or `select` has a computed font size below 16px. The design-system `Input`, `Textarea` and `Select` use at least `text-base` (16px) **at every breakpoint**. No `sm:text-sm` downshift, because iPads hit that breakpoint and zoom too. Verify on a real iPhone or the iOS Simulator.
- **Safe areas.** With `viewport-fit=cover`, the shell pads with `env(safe-area-inset-top|bottom|left|right)`. Expose these as Tailwind utilities in the design-system preset (e.g. `pt-safe`, `pb-safe`) so app code never writes raw `env()`. Bottom nav bars and sticky footers need `pb-safe`.
- **Viewport height.** Use `min-h-dvh`/`h-dvh`, never `h-screen`/`100vh`. Mobile browser chrome makes `100vh` taller than the visible area.
- **Back navigation.** Standalone mode has no address bar and no back button. §7 covers it in full.
- **No pull-to-refresh in iOS standalone.** That's another reason the §5 foreground update check matters. Screens with live data use their query's refetch-on-focus, not a manual refresh.
- **Links.** External links open outside the app (`target="_blank" rel="noopener"`). Internal links stay client-side so they don't bounce the user into Safari.
- `overscroll-behavior-y: none` on the app shell's root scroll container stops the whole app from rubber-banding. Scroll areas inside it keep native bounce.

## 7. Navigation without browser controls

Once installed, the app has no address bar, no back or forward buttons and no reload. On iOS there is no system back button either, and the edge swipe can't be relied on. A user who taps into a detail screen and finds no way out has to force-quit the app. So navigation is designed the way native apps do it, and the same rules apply in a normal browser tab (they cost nothing there and keep the app consistent).

### 7.1 Three kinds of screen

Every route in `router.tsx` is one of:

| Kind | Examples | Header | Main nav |
|---|---|---|---|
| **Top-level**: a destination in the main nav (bottom tab bar on phones, sidebar on wide screens) | Home, Projects, Inbox, Account | Title only. **No back button**; the nav is how you move between these. | Visible, with this item marked active |
| **Pushed**: reached by going *into* something from another screen | a project's detail page, Settings → Notifications, an edit page | `PageHeader` with a **back action** on the left, then the title | Visible, with the *parent's* nav item marked active, so the user still knows where they are |
| **Focused flow**: a task you finish or abandon (create, multi-step setup, checkout, a full-screen editor) | New project, onboarding | **Close** (✕) or **Cancel** instead of back; inside the flow, back goes to the previous step | Hidden, so the user finishes or cancels |

Each non-top-level route declares its **parent** in its route definition (React Router `handle`, e.g. `handle: { kind: "pushed", parent: "/projects", backLabel: "Projects" }`; parents that depend on params build the path from them). The component-breakdown plan lists kind and parent for every new screen. A route with no declared kind fails a unit test that walks the route tree, so a new screen can't ship without a way back.

### 7.2 What the back button does

"Go back one step in history" alone is wrong in an installed app. If the user opened the screen from a shared link, a notification or a cold start, there is no earlier in-app page: `history.back()` does nothing on iOS and closes the app on Android. So the back action is one shared hook, `useBack()` in `src/features/shell/`:

- **The user got here from inside the app** (React Router: `location.key !== "default"`) → `navigate(-1)`. This returns them to the exact list they came from, with its filters, tab and scroll position intact (scroll needs React Router's `<ScrollRestoration />` in the root layout).
- **This is the first screen of the session** (deep link, reload, cold start) → `navigate(parent, { replace: true })`. They land on the logical parent instead of leaving the app.

`PageHeader`'s back action always calls `useBack()`, never `history.back()` or a hard-coded `<Link>` to the parent (a hard-coded link adds a *forward* history entry, so the system back gesture then bounces them back into the detail screen).

### 7.3 Keep the history sensible

Android's system back button and gesture work in an installed PWA and walk the browser history; when the history runs out, the app closes. The history must therefore match what the user thinks "back" means:

- **Switching between top-level tabs replaces, except when leaving Home.** History ends up as `[Home, current tab]`, so back from any tab goes to Home, and back from Home closes the app, like a native Android app. (Put this in the nav component, not in each link.)
- **Redirects replace.** Sign-in → app, `/` → `/home`, "not allowed" → somewhere else: always `{ replace: true }`, so back never lands on a page that immediately redirects forward again (a trap the user can't escape).
- **After submitting a form, replace.** Creating a project replaces `/projects/new` with `/projects/:id` (or returns to the list with the new item visible, per the ux skill). Back must never reopen a form that has already been submitted.
- **Sign-out replaces** with the sign-in screen, so back can't show a signed-in page from memory.
- **Steps of a multi-step flow go in the URL** (`?step=2`), so back goes to the previous step without losing input. Close (✕) leaves the whole flow with `replace`, and warns first if there's unsaved input (error-states: router blocker).
- **Sheets and full-screen dialogs that hold content** (a filter sheet, a record opened in a side panel, an image viewer) open with a URL search param (`?sheet=filters`), so the Android back gesture closes the sheet instead of leaving the screen underneath. Small confirmation dialogs don't touch history; Escape and their buttons close them.

### 7.4 How the back button looks

- Built into the design-system `PageHeader` (`back` prop), not rebuilt per screen: a chevron icon plus the parent's short label ("Projects") when it fits, otherwise the icon alone.
- Accessible name says where it goes: "Back to Projects". Touch target at least 44×44 (Apple's minimum, above WCAG 2.2's 24×24), in the top-left, clear of the notch (`pt-safe` on the header).
- Wide screens may show breadcrumbs in addition (ux skill: navigation and wayfinding), but the back action stays so behaviour is the same everywhere.
- Returning via back uses the "back" direction of the route transition (motion skill), and moves focus to the page heading of the screen returned to (accessibility §5).

### 7.5 Test it

Vitest: the route-tree test from §7.1 (every route has a kind; every pushed or flow route has a parent that exists).

Playwright (in the existing smoke spec):

- **Cold start on a pushed screen:** open `/projects/:id` directly in a fresh page → tap back → lands on `/projects`, and the app is still open (not `about:blank`).
- **Round trip keeps context:** list → apply a filter → scroll → open an item → back → same filter and roughly the same scroll position.
- **Submitted form isn't in history:** create an item → `page.goBack()` → not on the form.
- **Sheet closes on system back:** open a sheet → `page.goBack()` → sheet closed, same screen underneath.
- **Sign-in isn't in history:** sign in → `page.goBack()` → not on the sign-in screen.

On real devices (part of the §10 phone check with the owner): on iPhone, open the installed app, go several screens deep and get back to the start using only in-app buttons. On Android, do the same with the system back gesture, and confirm back from Home closes the app rather than looping.

## 8. Install experience

- **Android / desktop Chromium:** capture `beforeinstallprompt`, `preventDefault()` it, and show an "Install app" button in the account menu or a dismissible banner after the user has done something meaningful (not on first load). Call `prompt()` on click. Hide after `appinstalled`.
- **iOS / iPadOS Safari:** there is no install event. Detect iOS Safari that is *not* already standalone (`matchMedia("(display-mode: standalone)")` false and `navigator.standalone !== true`) and offer a `Sheet` with two illustrated steps: Share → "Add to Home Screen". Check current iOS behaviour first. Recent versions changed Add to Home Screen defaults, so match the copy to what the user will actually see.
- Already installed (`display-mode: standalone`): never show install UI.
- Remember dismissal in `localStorage` for 30 days.
- Put this in `src/features/install/` (`useInstallPrompt` hook + `InstallBanner` + `IosInstallSheet`), built only from design-system primitives.

## 9. Cloudflare Workers hosting

Create `apps/web/public/_headers` (Vite copies it to `dist`; Workers static assets reads it):

```
/sw.js
  Cache-Control: no-cache
/registerSW.js
  Cache-Control: no-cache
/manifest.webmanifest
  Cache-Control: no-cache
  Content-Type: application/manifest+json
/index.html
  Cache-Control: no-cache
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

Check the current Workers static-assets `_headers` docs for syntax and whether defaults already cover some lines. Keep the explicit `no-cache` lines anyway; they're the whole update story.

**SPA fallback trap.** `wrangler.jsonc` uses `not_found_handling: "single-page-application"`, so a *missing* `sw.js` or chunk returns `index.html` with status 200. Verify after every deploy config change:

```bash
curl -sI https://<web-url>/sw.js | grep -i 'content-type\|cache-control'           # javascript, no-cache
curl -sI https://<web-url>/manifest.webmanifest | grep -i 'content-type'            # application/manifest+json
```

## 10. Prove it, then document

Local, production build (the SW doesn't run in dev):

```bash
pnpm --filter web build && pnpm --filter web preview
```

- Chrome DevTools → Application → **Manifest**: no installability errors, icons render, maskable preview looks right. **Service workers**: registered and activated. (Lighthouse no longer has a PWA category; don't rely on it.)
- Install it from Chrome's address bar and open the installed app.
- **Update test (must do):** with the installed app open, change a visible string, rebuild and restart preview, then switch away from the app and back. The "new version" toast appears → Reload → new string shows.
- Offline: DevTools → Network → Offline → reload. The shell loads, and data areas show their normal error state with retry (not a blank screen or a dinosaur page).
- Playwright smoke (added to the existing spec, run against `preview`): `link[rel=manifest]` resolves and parses as JSON with `name` and icons; `navigator.serviceWorker.ready` resolves.

After the first production deploy, on a real iPhone: Add to Home Screen, open it, focus every input on the sign-in screen (no zoom), check the notch/home-indicator areas, go several screens deep and get back using only in-app buttons (§7.5), deploy a trivial change, and reopen the app to see the update toast. Ask the owner to do this with you and tell them exactly what to tap (follow `.claude/skills/guide-owner/SKILL.md` §5: the live URL, which browser, each tap named, and a screenshot of the result).

Documentation (via the documentation skill):

- ADR `docs/adr/NNNN-pwa.md`: prompt-not-auto update, shell-only caching, no API caching, update check interval, versions of `vite-plugin-pwa` and the assets generator, any doc-vs-skill differences found.
- `apps/web/README.md`: "Installable app" section covering how updates reach users, how to test the update flow, the kill switch, and where icons come from.
- `apps/web/README.md` also gets a short "Navigation" note: screen kinds, declaring a route's parent, and why back uses `useBack()`.
- PROGRESS entry, including what the owner should try on their phone.

## Auth gotcha to raise with the owner

On iOS, an installed web app has **separate storage from Safari**. Magic-link and OAuth emails open in Safari, so the user signs in *there*, not in the installed app. If ARCHITECTURE.md chose magic link and the app is installable, recommend switching to **email one-time codes** (user types a 6-digit code into the app; Supabase supports this via the email template's token) or email + password. Record the choice in the ADR.

## Out of scope here

Web push notifications (iOS only allows them for installed apps and they need a server-side sender), background sync and offline data editing. Each is its own feature with a `state-management` decision and an ADR. If the PRD needs reliable push, revisit the mobile gate in `plan`.
