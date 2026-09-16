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

Feature entries are grouped under a `# F00N — <title>` heading with one sub-entry per stage (breakdown, state, build, quality, compliance, docs).

---

## Setup versions
_(filled in by the setup step)_

---

<!-- /build appends entries below this line -->

---

## Owner notes
_(anything you want the next run to know)_
