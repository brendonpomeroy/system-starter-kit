# Starting a new project

Do [Getting set up](GETTING-SET-UP.md) first. Then this takes five minutes before Claude takes over.

## 1. Make your own copy of the kit

On the kit's GitHub page, click the green **Use this template** button → **Create a new repository**.

- Name it after your app, lowercase with dashes: `my-booking-app`.
- Choose **Private** unless you want the world to see it.
- Click **Create repository**.

## 2. Get it onto your computer

In Terminal / PowerShell (replace the name and your GitHub username):

```
cd ~/Documents
gh repo clone YOUR-USERNAME/my-booking-app
cd my-booking-app
```

## 3. Start Claude Code and type the word

```
claude
```

Then type:

```
build
```

That's the whole process. From here, Claude drives and you answer questions.

## What happens next (so nothing surprises you)

**First session, roughly 1–2 hours of your attention spread across a few sittings:**

1. **Setup check** (1 min). Claude confirms your tools work. If something's missing it points you at the exact section of the setup guide.
2. **Planning interview** (20–40 min). Questions like "who uses this?" and "walk me through the first thing someone does". Answer in your own words; there are no wrong answers. It writes `docs/PRD.md` and asks you to read it. Say yes when it's right — or say what's wrong and it fixes it.
3. **Architecture** (5 min). Claude decides which pieces to build (web app? website? phone app?) and explains why. You can push back. Note: it will try to talk you *out of* a phone app unless you truly need phone features — that's on purpose, phone apps are much slower to build and release.
4. **Data model** (10 min). What the app remembers and who can see what. Written in plain English first.
5. **Design** (20–40 min, fun part). Claude asks about colours, feel and examples you like, then builds a style guide you open in your browser. Iterate until it looks like *yours*.
6. **Generating the code** (20–60 min, mostly waiting). Claude runs the official tools to create everything, sets up your database, connects GitHub and Cloudflare, and gives you live URLs. It will ask you to create the Supabase and Cloudflare projects in your browser at the right moments, and to paste a few keys.
7. **Features, one at a time.** The first is always sign-in. After each one Claude tells you what to click to try it, and asks whether to put it live.

**Every later session:** open the folder, run `claude`, type `build`. Claude reads `docs/PROGRESS.md`, tells you where things are, and continues. Want something specific? Type `build` and then say what you want ("add a way to export to Excel"). It slots it into the feature loop.

## Things you'll be asked to do in a browser

Claude can't click in your browser for you. Expect these, each with step-by-step instructions at the time:

- Create a Supabase project (choose a region close to your users; save the database password somewhere safe).
- Create a Cloudflare API token (Claude tells you exactly which permissions).
- Paste a few secret keys into the terminal when asked. They are stored safely and never written into your code.

## Stopping and starting

Close the terminal whenever you like, even mid-question. Nothing is lost — progress is saved in `docs/PROGRESS.md` and in git. Next time, `build` picks up where you left off.

## Handing it to a developer later

Everything a developer needs is in the repo: the plan (`docs/`), the decisions (`docs/adr/`), the log (`docs/PROGRESS.md`), and standard tooling they'll recognise. Point them at [Architecture explained](ARCHITECTURE-EXPLAINED.md) and the root `CLAUDE.md`.

## If something goes wrong

Type `build` and describe what you see. Claude logs every error it hits, so it usually already knows. If it's truly stuck, the log in `docs/PROGRESS.md` shows the last thing that happened — share that with whoever gave you the kit.
