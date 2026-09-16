---
name: explain-decisions
description: How to bring a technical choice to a non-developer owner — decide quietly, decide and tell, or ask; translate trade-offs into what the owner actually cares about (will it break, cost, safety of their users' data, speed, how hard to undo, upkeep); always lead with a recommendation and the reason a professional would pick it. Use whenever you are about to ask the owner a question with technical content, or report a technical choice you made on their behalf. Called from every skill that interviews or asks the owner anything.
---

# explain-decisions — technical choices, in plain language

The owner is not a developer. They can't tell whether "TypeScript 7" or "optimistic updates" is good or bad. They can't know why one path is more **stable**, **scalable**, **secure** or **easy to change later**. Treat them as a smart person without the background. If they can't make a good decision from what you wrote, the explanation failed. They didn't.

Your job is to do what a trusted senior developer does for a client: **make the judgement call, explain it simply, and ask only when their priorities really change the answer.**

## 1. Should the owner be asked at all?

Pick one of three levels before writing anything.

| Level | When | What you do |
|---|---|---|
| **Just decide** | One answer is clearly right for a project like this, and it's easy to change later. Examples: formatter settings, folder names, a patch update. | Do it. No mention unless asked. |
| **Decide and tell** | A professional would clearly pick one option, but the owner should know it happened. Examples: held a tool back to its stable version, chose a library, added a safety check that costs a little speed. | Do it. Add one plain sentence to the step summary: what you chose and why. Log it in PROGRESS or an ADR. |
| **Ask** | The answer depends on *their* priorities or money. Or it's hard to undo. Or it changes what their users see, what it costs, or how their users' data is protected. Or you're really unsure. | Use the format in §2. |

If you catch yourself about to ask "A or B?" where A is obviously what a developer would pick, you're at **decide and tell**, not **ask**. Every question costs the owner attention, so don't spend it on non-decisions.

## 2. The format for asking

Use this shape every time. Keep it short enough to read in under a minute.

```
**Decision: <the choice, in everyday words — no version numbers or jargon in the title>**

What's going on: <1–3 sentences. What happened and why it needs a choice. Define any unavoidable term inline.>

My recommendation: <option> — <the one-sentence reason, in terms of their project>.

Your options:
1. <Recommended option> (recommended)
   - Good: <in owner terms>
   - Cost: <in owner terms>
2. <Alternative>
   - Good: …
   - Cost / risk: …

How easy to change later: <easy / some work / hard — and roughly what "changing" would involve>

If you're not sure, go with my recommendation — it's the safe choice.
```

Rules for filling it in:

- **Lead with a recommendation.** Always. "Here are two options, up to you" with no view is not neutral. It's leaving the owner alone with the problem. If you really have no preference, say so and say why.
- **Two options, three at most.** Drop options no sensible developer would pick.
- **Translate every trade-off** into the owner-facing terms in §3. "Not supported by ESLint" means nothing to them. "The tool that catches mistakes in the code would stop working" does.
- **Say how reversible it is.** Whether a choice can be undone matters more to a non-developer than almost anything else.
- **Name the real risk honestly and in proportion.** Don't scare them, and don't downplay it. "Probably fine, but if it breaks we'd lose a day working out why" is honest.
- **No unexplained jargon.** If a term must appear, explain it in the same sentence the first time: "a migration (a saved, repeatable change to the database's structure)".
- **Use `AskUserQuestion`** when it's available. Put the recommended option first with "(Recommended)" in its label. Use the `description` field for the good/cost lines.

## 3. Owner-facing terms — what trade-offs actually mean to them

Map technical properties onto these. They are what the owner cares about.

| Technical property | Say it as |
|---|---|
| **Stability / maturity** | "Will it keep working, or will we hit strange errors nobody has solved yet?" New releases are like a phone update on release day: usually fine, sometimes broken, and the fixes come a few weeks later. |
| **Compatibility / ecosystem support** | "Do the other tools we rely on work with it yet?" A new engine that your mechanic's tools don't fit yet. |
| **Scalability** | "Will it keep working as more people use it, without a rebuild?" Say *at what size* it matters. If the PRD expects 50 users, say that scaling isn't a real concern yet. |
| **Resilience / reliability** | "What happens when something goes wrong: does one hiccup take the whole app down, or does it recover by itself?" |
| **Security** | "Could someone see or change data they shouldn't?" Name the actual data (customers' addresses, payments) rather than saying "security". |
| **Performance** | "How fast it feels for the person using it." Only raise it if the difference is noticeable. |
| **Maintainability / tech debt** | "How much extra work this creates later: every future change is slower or riskier." Like skipping a service on a car. |
| **Lock-in** | "How hard it would be to move to something else later, and what that would cost." |
| **Cost** | Actual money per month, with the usage level it applies at. Free tiers and when they run out. |
| **Developer tooling (lint, types, tests)** | "The safety nets that catch mistakes before your users see them." Turning one off means mistakes reach users more often. |

Tie each point to **their** PRD: their users, their scale, their data. "For a booking app with ~200 customers" beats talking in general terms.

## 4. Worked example — a new version that the tools don't support yet

What happened: TypeScript 7 is the newest release. The ESLint TypeScript plugin only supports up to 6.

**Bad** (technically accurate, useless to the owner):

> TS7 is the latest but isn't supported by typescript-eslint. Options: (1) use TS7 anyway, (2) use TS6 everywhere. Which do you prefer?

The owner doesn't know what TS or ESLint is. They can't weigh "anyway" against "everywhere". And "latest" sounds better, so they may well pick the risky one.

**Good:**

> **Decision: use the newest version of the coding language, or the well-tested one?**
>
> What's going on: the language the app is written in (TypeScript) just released version 7. The tool that checks the code for mistakes before anything goes live doesn't work with version 7 yet. It works with version 6.
>
> My recommendation: **version 6**. It's what most professional teams are using right now, and all our safety tools work with it. Version 7 doesn't give your app anything your users would notice.
>
> 1. **Version 6 (recommended)**
>    - Good: everything works together; mistakes get caught automatically; problems we hit are ones others have already solved.
>    - Cost: we'll move to 7 later, once the tools support it. That's a small, planned job.
> 2. **Version 7 now**
>    - Good: newest.
>    - Risk: the mistake-checker would have to be switched off or would show confusing errors. More bugs could reach your users, and fixing odd problems could take a lot longer.
>
> How easy to change later: easy. Moving from 6 to 7 is a routine upgrade once the tools catch up, and I'll suggest it when they do.
>
> If you're not sure, go with version 6.

Better still: per `.claude/skills/choosing-versions/SKILL.md`, this was a **decide-and-tell** case. There's no PRD need for version 7, so it should never have become a question. One line in the summary is enough: "Using TypeScript 6. Version 7 is out but our code checker doesn't support it yet; I'll suggest upgrading once it does."

## 5. Anti-patterns

- **Neutral menus.** Listing options with no recommendation or reasoning.
- **Version numbers as arguments.** "7 is newer than 6" is not a reason. Neither is "X is more popular" without saying why that matters here.
- **"Latest" as a synonym for "best".** Newer is not safer. See `choosing-versions`.
- **Hidden defaults.** Picking something consequential (paid tier, public repo, data retention, auth method) without telling them.
- **Scaling fear for a small app.** Don't push complexity "for scale" the PRD doesn't need. Say plainly when the simple option is right for their size.
- **Walls of text.** If the explanation needs more than the format above, the decision is probably several decisions. Split it.
- **Asking twice.** Once they've chosen, record it and don't reopen it unless something material changes. If it does, say what changed.

## 6. Record the decision

After the owner answers (or after a decide-and-tell):

- Put a plain-language line in `docs/PROGRESS.md` under the current step: what was chosen, the one-sentence reason, and who decided (owner or recommended default).
- If it's non-obvious or hard to reverse, write an ADR in `docs/adr/` (see the documentation skill). Include the options, the recommendation, the owner's choice, and the condition for revisiting it.
