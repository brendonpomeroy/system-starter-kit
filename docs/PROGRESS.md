# Progress log

The human-readable record of everything `/build` has done on this project. Newest at the bottom. Never rewrite history — append.

`/build` reads this file and `.claude/state.json` at the start of every run to work out where things are. If you (the owner) want to leave a note for the next run, add it under "Owner notes" at the very bottom.

## Entry format

```
## YYYY-MM-DD HH:MM — <step id | F00N stage> — <started | completed | failed | approved>
**Did:** bullet list of real actions and files touched
**Decided:** decisions, with links to docs/adr/ where one was written
**Look at:** what the owner should open or click to see the result
**Next:** one line
**Error:** (only on failure) the exact error text and what was tried
```

Feature entries are grouped under a `# F00N — <title>` heading with one sub-entry per stage (breakdown, state, ux, build, quality, compliance, verify, docs). Change entries are grouped under `# C00N — <title>` (plan, build, quality, verify, docs); an escalated change ends with a line pointing to its `F00N`. Releases are `## <date> — release — <ids>` (what went out, migration yes/no, post-deploy check result); rollbacks get their own release entry. Maintenance runs are `## <date> — maintenance` and link to `docs/maintenance/`. Backlog reviews are `## <date> — backlog review`. Any entry that edited PRD, ARCHITECTURE, DATA-MODEL or the style guide ends with `**Rehashed:** <file>`. Verification entries link to their full report in `docs/verification/`. Bug entries are grouped under a `# B00N — <title>` heading with one sub-entry per stage (intake, reproduce, diagnose, fix, verify) and link to their notebook in `docs/bugs/`; **Decided:** on the diagnose entry states the root cause and whether the owner's first explanation held.

---

## Setup versions
_(filled in by the setup step)_

---

<!-- /build appends entries below this line -->

---

## Owner notes
_(anything you want the next run to know. Ideas for the app itself go in [BACKLOG.md](BACKLOG.md).)_
