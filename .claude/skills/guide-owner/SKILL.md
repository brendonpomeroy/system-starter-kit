---
name: guide-owner
description: How to send the non-developer owner to do something outside the terminal — a Supabase, Cloudflare, GitHub, Expo, Apple or Google dashboard, an account signup, an API token, a DNS change, a test on their phone. Give the reason, a direct link filled in with their real ids, numbered click-by-click steps using the exact on-screen labels, what they should see, what (if anything) to bring back and how to hand over secrets safely, then verify it worked from the terminal. Use every time the owner has to act in a browser, an app store console or on a device.
---

# guide-owner — sending the owner somewhere else

The owner doesn't know what the Supabase dashboard looks like, where Cloudflare keeps API tokens, or what a "project ref" is. "Create a Supabase project and give me the keys" isn't an instruction for them. It's a puzzle. Every time they have to leave the terminal, give them a route they can follow without guessing.

## 1. The format

```
**Next: <what they're doing, in everyday words>** (about <N> minutes)

Why: <one sentence — what this unlocks for their app>

1. Open <direct link> (<what the page is called>).
   - Not signed in? Sign in with <the account they created during setup, e.g. "your GitHub login">.
2. Click **<exact button label>** (<where it is: top right, left sidebar under "Settings">).
3. Fill in:
   - **<field label>**: `<exact value to type, or how to choose>`
   - **<field label>**: <guidance, e.g. "pick the region closest to most of your users — for Australia, Sydney">
4. Click **<exact label>**. You should see <what success looks like>.

Bring back: <nothing | the value called "X" (it looks like `abc…`) — see "Secrets" below>

Tell me "done" when you've finished, or paste what you see if anything looks different.
```

Rules:

- **Direct links, filled in.** Link to the exact page, not the service's home page. Fill in placeholders with their real values first: account id from `wrangler whoami`, project ref from `supabase projects list`, repo from `gh repo view --json nameWithOwner`. A link with `<your-project>` still in it is a puzzle again.
- **Check the route is current.** Dashboards get redesigned. Before sending the owner, check the service's current docs for the page name and button labels (WebFetch the docs page if you can). If you can't confirm a deep link, give the nearest stable link plus the click path, and say "the button may be worded slightly differently".
- **Exact labels in bold.** Name the button as it appears on screen and say where it is.
- **One task per message.** Don't bundle "create project, make a token, set DNS". Send one, wait for "done", check it, then send the next.
- **Tell them what to type and what to choose.** For every field they'll meet: the value, or the rule for choosing plus your recommendation (see `.claude/skills/explain-decisions/SKILL.md` if it's a real choice). Warn them about anything that's hard to change later (project region, account names, a paid plan).
- **Say what success looks like** so they know they're finished and in the right place.
- **Mention costs up front.** If a step asks for a card or offers a paid plan, say what's free, what isn't, and which one to pick.
- **Things they must save.** If the service shows a value only once (a database password, a token), say so *before* they click: "It's only shown once. Save it in your password manager."

## 2. Secrets — never through the chat

API keys, tokens, database passwords and service-role keys must not be pasted into the chat. The conversation is logged. Instead:

- **Hand them a command to run in their own terminal window** (a new Terminal window, not Claude Code). The command asks for the value, so it never appears in the conversation:
  ```bash
  cd <absolute path to the project>
  gh secret set CLOUDFLARE_API_TOKEN        # asks for the value; paste it and press Enter
  pnpm --filter api exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY
  ```
  For local `.env` / `.dev.vars` files, tell them which file to open, the exact line to add (`NAME=` then paste), and remind them it's git-ignored.
- **Values that aren't secret** can come back through the chat: project ref, account id, public URLs, publishable/anon keys, region. Say plainly which is which, so they learn the difference.
- If they paste a secret into the chat anyway: don't repeat it back. Tell them kindly that it's now in the chat log. Recommend rotating it, give the link and steps, and continue with the new value via their terminal.

## 3. Verify from the terminal

Don't just take "done" on trust. Check what you can:

| After they… | Check with |
|---|---|
| logged in to Cloudflare | `pnpm dlx wrangler whoami` |
| created a Supabase project | `supabase projects list` (after `supabase login`) |
| set a GitHub Actions secret | `gh secret list` (names only; values are never shown) |
| set a Worker secret | `pnpm --filter <app> exec wrangler secret list` |
| changed Supabase auth URLs | `supabase` config / a real sign-in against the hosted URL |
| logged in to Expo | `pnpm dlx eas-cli whoami` |
| installed the app on a phone / added to home screen | ask for a screenshot of the specific screen you described |

If it failed, work out which step went wrong from what they see. Don't just resend all the steps.

## 4. Starting points (verify before use)

These are the usual entry points. Fill in the placeholders, and check the page still exists and has this name before sending.

| Task | Link pattern |
|---|---|
| Cloudflare dashboard home | `https://dash.cloudflare.com/` |
| Cloudflare Workers list | `https://dash.cloudflare.com/<account_id>/workers-and-pages` |
| Cloudflare API tokens | `https://dash.cloudflare.com/profile/api-tokens` — say which template or exact permissions to pick (match `templates/github-workflows/deploy.yml`) |
| Supabase projects | `https://supabase.com/dashboard/projects` |
| Supabase new project | `https://supabase.com/dashboard/new` |
| Supabase API keys | `https://supabase.com/dashboard/project/<ref>/settings/api-keys` |
| Supabase auth URL settings (site URL, redirects) | `https://supabase.com/dashboard/project/<ref>/auth/url-configuration` |
| Supabase auth providers | `https://supabase.com/dashboard/project/<ref>/auth/providers` |
| Supabase GitHub integration | `https://supabase.com/dashboard/project/<ref>/settings/integrations` |
| Supabase security advisor | `https://supabase.com/dashboard/project/<ref>/advisors/security` |
| Supabase access tokens (only for the CLI fallback in `deploy.yml`) | `https://supabase.com/dashboard/account/tokens` |
| GitHub repo Actions secrets | `https://github.com/<owner>/<repo>/settings/secrets/actions` |
| GitHub Actions runs | `https://github.com/<owner>/<repo>/actions` |
| Expo account / projects | `https://expo.dev/accounts/<account>/projects/<slug>` |
| Apple Developer enrolment | `https://developer.apple.com/programs/enroll/` |
| App Store Connect | `https://appstoreconnect.apple.com/` |
| Google Play Console | `https://play.google.com/console/` |

When you find a link that has moved, update this table in the kit and note it in PROGRESS.

## 5. Things on their phone or computer

Same format, with device-specific steps. For example: "On your iPhone, open Safari (not Chrome) and go to `<url>`. Tap the Share button (square with an arrow, bottom middle), scroll down, tap **Add to Home Screen**." If the steps differ between iPhone and Android, give both, labelled. Ask for a screenshot when the outcome is visual.

## 6. Record it

In PROGRESS, note what the owner did outside the terminal, what was verified and how, and any value that isn't secret and is needed later (project ref, account id, URLs). Never write secret values anywhere in the repo.
