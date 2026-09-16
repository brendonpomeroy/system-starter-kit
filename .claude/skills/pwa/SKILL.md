---
name: pwa
description: Make apps/web an installable Progressive Web App — web app manifest, icon set generated from one source logo, a service worker that caches only the app shell, an "update available" prompt with periodic update checks, Cloudflare Workers cache headers, iOS/Android install UX, safe areas and standalone-mode gotchas. Called by scaffold when ARCHITECTURE.md says the web app is installable, or by /build as a feature ("make it installable") added later.
---

# pwa — installable web app that stays up to date

A PWA is the web app with an icon on the home screen that opens full-screen, like an app. For the owner: "people can install it from the browser, no App Store, and every deploy reaches them automatically."

Three things matter more than anything else here, in this order:

1. **Installed copies must update.** A service worker (SW) that caches too hard leaves users stuck on an old build forever. Every choice below is biased towards freshness.
2. **Never cache user data.** Cache the app shell (HTML, JS, CSS, fonts, icons) only. API responses and Supabase auth calls always go to the network.
3. **It must feel native on iPhone.** No zoom on input focus, no content under the notch, a back button inside the app (there is no browser back in standalone mode).

Only `apps/web` becomes a PWA. `apps/site` gets favicons and theme colour (§3) but no service worker.

**Check current docs before writing code.** PWA tooling and iOS behaviour change often. Before starting: `npm view vite-plugin-pwa version`, `npm view @vite-pwa/assets-generator version`, and read the current guide at https://vite-pwa-org.netlify.app/guide/ (React + prompt-for-update + assets generator pages). If an API below differs from the docs, follow the docs and note the difference in the ADR.

Log start/finish of each section in `docs/PROGRESS.md` (as a sub-entry of `scaffold`, or of the feature running this).

## 0. Prerequisites

- `docs/ARCHITECTURE.md` records "Installable (PWA): Yes" and `.claude/state.json → apps.pwa` is `true`. If this runs as a later feature, update both first (+ ADR, see §9).
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
- `devOptions.enabled: false` (default). Test the SW against a production build (§8), not `vite dev`. A dev SW causes confusing stale-code bugs.

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
- **Back navigation.** Standalone mode has no browser back button on iOS. Every non-root screen in the shell has an in-app back affordance (`PageHeader` back action).
- **No pull-to-refresh in iOS standalone.** That's another reason the §5 foreground update check matters. Screens with live data use their query's refetch-on-focus, not a manual refresh.
- **Links.** External links open outside the app (`target="_blank" rel="noopener"`). Internal links stay client-side so they don't bounce the user into Safari.
- `overscroll-behavior-y: none` on the app shell's root scroll container stops the whole app from rubber-banding. Scroll areas inside it keep native bounce.

## 7. Install experience

- **Android / desktop Chromium:** capture `beforeinstallprompt`, `preventDefault()` it, and show an "Install app" button in the account menu or a dismissible banner after the user has done something meaningful (not on first load). Call `prompt()` on click. Hide after `appinstalled`.
- **iOS / iPadOS Safari:** there is no install event. Detect iOS Safari that is *not* already standalone (`matchMedia("(display-mode: standalone)")` false and `navigator.standalone !== true`) and offer a `Sheet` with two illustrated steps: Share → "Add to Home Screen". Check current iOS behaviour first. Recent versions changed Add to Home Screen defaults, so match the copy to what the user will actually see.
- Already installed (`display-mode: standalone`): never show install UI.
- Remember dismissal in `localStorage` for 30 days.
- Put this in `src/features/install/` (`useInstallPrompt` hook + `InstallBanner` + `IosInstallSheet`), built only from design-system primitives.

## 8. Cloudflare Workers hosting

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

## 9. Prove it, then document

Local, production build (the SW doesn't run in dev):

```bash
pnpm --filter web build && pnpm --filter web preview
```

- Chrome DevTools → Application → **Manifest**: no installability errors, icons render, maskable preview looks right. **Service workers**: registered and activated. (Lighthouse no longer has a PWA category; don't rely on it.)
- Install it from Chrome's address bar and open the installed app.
- **Update test (must do):** with the installed app open, change a visible string, rebuild and restart preview, then switch away from the app and back. The "new version" toast appears → Reload → new string shows.
- Offline: DevTools → Network → Offline → reload. The shell loads, and data areas show their normal error state with retry (not a blank screen or a dinosaur page).
- Playwright smoke (added to the existing spec, run against `preview`): `link[rel=manifest]` resolves and parses as JSON with `name` and icons; `navigator.serviceWorker.ready` resolves.

After the first production deploy, on a real iPhone: Add to Home Screen, open it, focus every input on the sign-in screen (no zoom), check the notch/home-indicator areas, deploy a trivial change, and reopen the app to see the update toast. Ask the owner to do this with you and tell them exactly what to tap (follow `.claude/skills/guide-owner/SKILL.md` §5: the live URL, which browser, each tap named, and a screenshot of the result).

Documentation (via the documentation skill):

- ADR `docs/adr/NNNN-pwa.md`: prompt-not-auto update, shell-only caching, no API caching, update check interval, versions of `vite-plugin-pwa` and the assets generator, any doc-vs-skill differences found.
- `apps/web/README.md`: "Installable app" section covering how updates reach users, how to test the update flow, the kill switch, and where icons come from.
- PROGRESS entry, including what the owner should try on their phone.

## Auth gotcha to raise with the owner

On iOS, an installed web app has **separate storage from Safari**. Magic-link and OAuth emails open in Safari, so the user signs in *there*, not in the installed app. If ARCHITECTURE.md chose magic link and the app is installable, recommend switching to **email one-time codes** (user types a 6-digit code into the app; Supabase supports this via the email template's token) or email + password. Record the choice in the ADR.

## Out of scope here

Web push notifications (iOS only allows them for installed apps and they need a server-side sender), background sync and offline data editing. Each is its own feature with a `state-management` decision and an ADR. If the PRD needs reliable push, revisit the mobile gate in `plan`.
