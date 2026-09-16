# Getting set up

You do this once per computer. Budget about 30–45 minutes, mostly waiting for downloads. You'll need a Mac or a Windows/Linux machine, an internet connection, and a credit card for two of the accounts (both have free tiers; you won't be charged for a small app).

When you type `build` later, Claude Code checks every item below and tells you exactly which one is missing, so don't worry about getting it perfect.

## 1. Accounts (free)

Create these in a browser. Use the same email for all of them.

| Account | Why | Where |
|---|---|---|
| **GitHub** | Where your code lives, and what deploys it | github.com → Sign up |
| **Supabase** | Sign-in and database for your app | supabase.com → Start your project |
| **Cloudflare** | Hosts your app on the internet | dash.cloudflare.com → Sign up |
| **Anthropic / Claude** | Claude Code | claude.ai — you need a plan that includes Claude Code |

You don't need to create any projects inside these yet. `build` walks you through that when it's time.

## 2. Install the tools

### Mac

Open **Terminal** (press ⌘-Space, type "Terminal", Enter). Paste each line, press Enter, wait for it to finish.

1. **Homebrew** (installs everything else):
   ```
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   It will ask for your Mac password (nothing shows while you type — that's normal). At the end it prints two or three lines starting with `echo` and `eval` — copy and run those too.

2. **Node.js, pnpm, git, GitHub CLI, Supabase CLI**:
   ```
   brew install node pnpm git gh supabase/tap/supabase
   ```

3. **Docker Desktop** (runs your database on your laptop):
   ```
   brew install --cask docker
   ```
   Then open Docker from Applications once, accept the terms, and leave it running in the background. You need it running whenever you work on the app.

4. **Claude Code**:
   ```
   npm install -g @anthropic-ai/claude-code
   ```

### Windows

1. Install **Git for Windows** from git-scm.com (defaults are fine).
2. Install **Node.js LTS** from nodejs.org (tick "Automatically install the necessary tools" if offered).
3. Install **Docker Desktop** from docker.com; it will ask to enable WSL 2 — say yes and restart when asked. Leave Docker running when you work.
4. Open **PowerShell** and run:
   ```
   npm install -g pnpm @anthropic-ai/claude-code
   winget install GitHub.cli
   ```
5. Supabase CLI: `scoop install supabase` if you have Scoop, otherwise follow supabase.com/docs/guides/cli → Windows.

### Linux

You know what you're doing: Node LTS, pnpm, git, gh, docker, supabase CLI, `npm i -g @anthropic-ai/claude-code`.

## 3. Sign in to each tool (once)

In Terminal / PowerShell:

```
gh auth login
```
Choose GitHub.com → HTTPS → Login with a web browser. Follow the prompts.

```
pnpm dlx wrangler login
```
Your browser opens; click Allow. This connects Cloudflare.

```
supabase login
```
Your browser opens; approve it.

```
claude
```
The first run signs you in to Claude. Type `/exit` afterwards.

## 4. Check

Paste this whole block; every line should print a version or "Logged in":

```
node --version
pnpm --version
git --version
gh auth status
docker info | head -3
supabase --version
pnpm dlx wrangler whoami
claude --version
```

If something says "command not found", close the terminal, open a new one, and try again (installers often need a fresh window). Still stuck? Open Claude Code anywhere (`claude`) and paste the error — it will help.

## 5. Mobile (only if your project needs a phone app)

`build` will tell you if your plan needs this. Skip it otherwise.

- **iOS** needs a Mac with **Xcode** from the App Store (large download), then run it once and accept the licence.
- **Android** needs **Android Studio** from developer.android.com, with an emulator set up in Device Manager.
- **Expo account** at expo.dev, then `pnpm dlx eas-cli login`.
- To actually publish: an Apple Developer account (US$99/year) and a Google Play developer account (US$25 once). Not needed until release.

## What these tools are, in one line each

- **Node.js** runs JavaScript on your computer; everything else is built on it.
- **pnpm** downloads the code libraries your app depends on.
- **git / GitHub** keep every version of your code, safely, online.
- **Docker** runs a copy of your database on your laptop so you can test without touching the real one.
- **Supabase CLI** creates and updates your database in a controlled way.
- **wrangler** is Cloudflare's tool for putting your app on the internet.
- **Claude Code** is the assistant that does the building. `build` is the only word you need.

Next: [Starting a new project](STARTING-A-NEW-PROJECT.md).
