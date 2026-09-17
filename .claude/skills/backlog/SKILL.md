---
name: backlog
description: The single list of everything the project might do next — features, small changes, upgrades, security and design follow-ups, maintenance chores and loose ideas — kept in docs/BACKLOG.md. Covers capturing items from any source (owner requests, forwarded user feedback, verification and compliance follow-ups, held-back upgrades, post-deploy problems, things noticed mid-work), sizing and prioritising them, recommending what to do next, and reviewing the list with the owner. Called by /build whenever something is noted for later, whenever it needs to pick the next piece of work, and when the owner asks "what's next?" or wants to reorder.
---

# backlog — one list, always current

After scaffold, the project is a cycle: pick something → build it → check it → put it live → learn → pick the next thing. This skill owns the "pick" half. `docs/BACKLOG.md` is the **only** place work waits. If a skill says "log a follow-up", it means "add a backlog item". There is no copy in `state.json`, so nothing can get out of sync. The owner may edit the file by hand, and every run respects their edits.

## 1. The file

`docs/BACKLOG.md` ships with the kit, empty (see §7 if it's missing). Sections, in this order:

```markdown
# Backlog

## Now        ← being worked on or next in line. Keep to 3 or fewer.
## Next       ← agreed, in order
## Later      ← wanted, not soon
## Ideas      ← unsorted; nothing here is promised
## Done       ← newest first; trimmed to the last 20 (older ones stay in git and PROGRESS)
```

One item is one bullet, with optional indented detail lines:

```markdown
- **I014** · feature · M · Export projects to Excel
  - Why: the owner's accountant asks for this every month
  - From: owner, 2026-09-17
  - Notes: CSV is probably enough; confirm at breakdown
```

| Field | Values |
|---|---|
| id | `I001`, `I002`, …: next number after the highest id anywhere in the file, `Done` included. Never reuse one. |
| type | `feature` · `change` · `upgrade` · `security` · `design` · `maintenance` · `idea` |
| size | `S` (under an hour) · `M` (a session) · `L` (several sessions: split it before starting) · `?` (unknown) |
| title | what the owner gets, in their words. "Export projects to Excel", not "add /exports route". |
| Why | the reason or the person asking. **Never** paste a customer's name, email or message verbatim. Summarise ("two customers asked for dark mode"). The repo is not the place for personal data. |
| From | `owner`, `user feedback`, `verification F00N`, `compliance F00N`, `choosing-versions`, `release`, `maintenance`, `noticed during F00N`, with a date |
| Blocked by / Due | only if real: `Blocked by: I009`, `Due: 2026-11-01 (Expo SDK 53 dropped from store builds)` |

When work starts, the bullet gets the work id added: `- **I014** · feature · M · Export projects to Excel → F009`. When it's finished, move it to the top of `Done` with the date: `→ F009 done 2026-09-20`.

## 2. Capture: where items come from

Capture is quick: write the item, tell the owner in one line ("Noted as I014 in the backlog"), and carry on with what you were doing. **Never** start unplanned work in the middle of another item.

| Source | Type · default section |
|---|---|
| PRD "Core flows" (seeded once at the end of scaffold, see §7) | `feature` · Now/Next, in PRD order, auth shell first |
| Owner asks for a new capability "later" or while other work is open | `feature` · Next (ask where it goes if Next already has 5 or more) |
| Owner asks for a small tweak while other work is open | `change` · Next |
| Owner forwards user feedback, a support email, a review | one item per distinct request, `idea` unless the owner says it matters · summarised, no PII |
| `verification`: medium not fixed now, every low | `security` · medium → Next, low → Later |
| `design-compliance` follow-ups; a primitive the feature needed but didn't add | `design` · Next |
| `accessibility`: an exception the owner accepted, with its revisit condition (`docs/ACCESSIBILITY.md`); ux review follow-ups | `design` · Later (Next if the revisit condition is "before launch") |
| `choosing-versions`: a held-back major whose companions have caught up | `upgrade` · Next, with the revisit condition |
| Redo of `design-system` or `data-model` affecting existing features | `feature` "reconcile <thing>" · Now |
| `release`: post-deploy problem that isn't urgent; slow screens, noisy errors | `change` or `security` · Next (urgent ones become bugs straight away) |
| `maintenance`: patch/minor updates, deprecations, platform deadlines | `upgrade`/`maintenance` · with `Due` if there is one |
| Something you **noticed** while working (duplicated code, a confusing screen, a slow query, a missing test) | `change` · Later, `From: noticed during F00N`. One line; don't lecture. |

Bugs are **not** backlog items. Something broken goes straight to the `debugging` skill with a `B00N` id. If the owner says "it's broken but not urgent, do it later", start the bug record at `intake` anyway so the evidence is captured while it's fresh, then leave it there.

## 3. Choosing what's next

When `/build` has nothing in progress, recommend **one** item. Use this order and stop at the first match:

1. An item with a `Due` date within 30 days.
2. `security` items at medium.
3. `Now`, top to bottom (skip anything `Blocked by` an open item).
4. `Next`, top to bottom.
5. Nothing left in Now/Next → run a review (§5).

Say it like this. Keep it short and give a reason:

```
Next up: I014 — Export projects to Excel (feature, about a session).
Why this one: it's top of your "Next" list and nothing is blocking it.
Also waiting: I015 dark mode (Next) · I011 tidy the settings page (Later) · 2 ideas.
Shall I start I014, or would you rather pick another?
```

The owner can pick anything: any section, any order. Respect it. If they pick something that another item blocks, or skip a due item, say what that means in one sentence (`explain-decisions`) and then do what they chose.

## 4. Sizing and splitting

- `L` items get split before starting. Split into slices the owner can see and use ("export this month's projects" before "scheduled exports"), not into layers ("backend", then "frontend"). Replace the `L` with the new items and give them the next free ids. Note the split in PROGRESS.
- A `change` that turns out to need a migration, a new route or a new screen is escalated by `/build`. The item's type becomes `feature`, and the arrow points at the new `F00N`.
- `?` sizes are fine for ideas. Size an item when it moves into Next.

## 5. Review with the owner

Offer a review when Now and Next are both empty, after every 5 completed items, when Ideas has more than 10 entries, or when the owner asks ("what's on the list?", "let's plan").

1. Show Now, Next and the count of Later and Ideas, as short lines.
2. Recommend moves in one pass: promote 1–3 ideas worth doing (and why), drop ideas that the PRD's "Out of scope" rules out or that have sat for over 90 days with no second request, and flag anything whose `Due` is close.
3. The owner says yes, no or edits. Apply it. Items that are dropped go to `Done` as `dropped YYYY-MM-DD — <reason>`. They are never silently deleted.
4. PROGRESS entry: `## <date> — backlog review`, listing the moves.

## 6. PRD and backlog

The PRD describes what the product does. The backlog describes what might come next. When a `feature` item **starts** (its breakdown is approved), add it to the PRD's "Added later" section in one line, and follow `/build`'s rehash rule for approved docs. Don't add ideas or changes to the PRD.

## 7. Seeding and repair

- **During planning:** anything the owner wants that the PRD puts out of scope for the first version goes into `Ideas` (`From: owner, PRD interview`), so it isn't lost.
- **End of scaffold:** add one `feature` item per PRD core flow, in order, above anything already there. The first is always "Sign in and an empty home screen" (auth + authenticated shell) in `Now`. Add every open follow-up from PROGRESS and the scaffold verification report.
- **Missing file** (deleted, or kit upgraded mid-project): recreate it with the five empty sections and the short intro the kit ships with, seed it as above, then scan PROGRESS for "follow-up", "later", "Follow-ups:" and `F0NN:` notes that were never started, and add them. Tell the owner what was recovered.
- **Hand edits:** if the owner added lines without ids or fields, give them ids and fill in the fields you can infer. Keep their wording. Mention it in one line.

## 8. Record

Backlog edits are committed with whatever work caused them. A standalone capture or review commits as `docs(backlog): <what>`. No `state.json` change is needed.
