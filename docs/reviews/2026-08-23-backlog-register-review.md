# Review: the backlog register itself — index, frontmatter, citations and the base

Reviewed 2026-08-23 on branch `docs/review-fixes-2026-08-23`, after the design-slice review
in [`2026-08-23-design-docs-review.md`](2026-08-23-design-docs-review.md) had been worked. Its
subject is different: that one read the seventeen slices and the ADRs for design defects, this
one reads **the register's own rules against the notes that are supposed to follow them** —
`docs/README.md`, `docs/Product Backlog.base`, and the frontmatter and citations of all 227
notes.

**All findings below are fixed.** `npm run check` passes all four steps; the register checks in
the last section pass fifteen of fifteen. Paths are the ones that exist today, because nothing
in this ledger predates the tree it describes.

## What was found, and what it cost to find

The corpus is in good shape and the findings cluster. Every wikilink resolved, every relative
link resolved, no duplicate basenames, all twelve ADRs carried their five sections in order,
the twenty-seven `BR-*` ids had no gaps or reuse, the seventeen slices' `dependsOn` graph
matched the prose in all five PBIs exactly, and every numeric claim in *Architecture and
Software Design* checked out against the received documents. **The defects were almost all in
one place: `docs/README.md` describing a tree it had stopped matching.** That is worth naming,
because an index is the one note nothing else can contradict — a reader who checks a claim
against the notes is doing the work the index exists to save.

### A. The index contradicted the config it claims to report

1. **`status` vocabulary.** `docs/README.md` documented `New`, `Open`, `Active`, `Done`,
   `Dropped` under the heading "this base configures these keys". The base configures
   `New, Ready, Active, Resolved, Done` — `Open` and `Dropped` are declared nowhere in it,
   `Ready` and `Resolved` were undocumented here.

   **Fixed by moving the README. `Product Backlog.base` is the source of truth**, and that is
   now written into the section rather than left to be inferred: the view configures the values,
   the view renders them, and where the two disagree the document is the bug. The first attempt
   at this fix went the other way — it edited the base to match the prose, on the reasoning that
   the prose was deliberate and its counts measured. That reasoning was wrong in a way worth
   keeping: **a measured count tells you what the notes say, never whether the vocabulary is
   yours to define.** The base is the view's own configuration; a register that edits its
   renderer to agree with its index has inverted which of the two is evidence. Reverted, and the
   section now reads the values out of the base, names the two narrower ladders it also
   configures (`deliverableStateValues`, `testStateValues`) and states the precedence rule
   explicitly so the next disagreement resolves without a second attempt.

   Two consequences, both recorded rather than guessed at. The Iteration this review wired up
   was given `status: Open`; an open iteration carries `Ready` (`iterationOpenStates`), and it
   now does. And **three Deliverables carry `Open`, which the base configures nowhere** —
   `Ready` is what they were reaching for, but `deliverableStateValues` is `New, Active, Done`,
   so the mapping is a judgement about those three documents rather than about the vocabulary.
   Left as a named edit in the README's status section, not silently relabelled.

2. **Arithmetic in the status section.** "Three of the five values mean not started" (two do);
   "empty is a fifth value" (a sixth); "made the other four optional" (five); "126 of 138
   notes" (142). All corrected against a measurement. `Test case` notes' own
   `testStateValues` ladder is now named, because "every backlog note" was not true of them.

3. **Entity and actor frontmatter.** The README said these notes "carry no `type`" and gave
   both folders the list `kind`, `name`, `layer`, `persistence`, `partOf`, `sources`. All
   forty-two carry `type`; no actor has `layer` or `persistence`; all eight carry `standing`,
   which the README never named; and the base's *Entities* and *Actors* views read those keys,
   so "none of which the view reads" was false. **What actually keeps these notes out of the
   tree is that they carry no `parent`** — a distinction that matters the moment somebody adds
   one to make a link render. Rewritten as a two-row table plus that sentence.

4. **`kind:` was empty in all thirty-four entity notes** — declared, no vocabulary, no reader,
   nothing grouped by it, while `actors/` and `business-rules/` both give theirs values.
   **Removed from the notes and from the README's list**, with the reason written down and the
   note that it is one line to add back. `layer` and `persistence` already classify an entity
   on the two axes that decide where its code and its data go.

5. **Two overclaims.** "All twenty-seven `Checked by` lines name the slice where the check
   lands" — four name none, because their subject has no slice yet; the four are now named.
   And the ADR frontmatter list omitted `revised`, which ADR-011 carries.

6. **Missing rows — three times, which makes it a pattern rather than an oversight.**
   `deliverables/` and `iterations/` held notes and were absent from the folder table;
   `Deliverable` and `Iteration` had no row in *What each kind of note holds*, so four
   Deliverables and one Iteration had no stated content promise. (The folder table and the
   `Deliverable` row were added in the same session by the author; `Iteration` here.) Then
   `components/` appeared mid-review with nine notes, then twelve, then seventeen, and the index
   did not know about it either. Documented from the notes themselves — including its two keys
   nothing else has, `medium` and `region`.

   **A new folder does not announce itself to the index, and that is the actual defect.** Each of
   the three was written correctly and none reached `docs/README.md`, because nothing makes it:
   the folder table is prose, and prose has no way to notice a sibling directory appearing beside
   it. A `docs` gate comparing the table against the tree is one of the cheapest checks on the
   list this ledger ends with, and this finding is the third piece of evidence for it.

### B. `§N` citations — the finding that grew

**`requirements/Architecture and Software Design.md` stated one rule: a bare `§N` means the
SDD.** True for the seventeen slices. False for the other ~150 notes, which carry roughly four
hundred bare citations meaning the **PRD** — and the PRD and SDD number independently from 1,
so `§33`, `§39`, `§51`, `§54`, `§60`, `§64`, `§67` and `§74` each name an unrelated topic in the
two documents.

The per-folder pattern was consistent enough to become the rule, **except in `adrs/`**, which is
where the sizing changed the answer. ADR-012 cited `§74`, `§33` and `§51` bare: the first two
are the PRD, the third the SDD, and one sentence — *"as §74 and §51 jointly do"* — meant a
different document with each number. An ADR is the note that overrules the SDD where they
disagree, so it is the one folder where a reader cannot use the default to guess.

**Fixed** by writing the rule as what the corpus actually does — the folder carries the default,
`adrs/` gets none — in `docs/README.md`'s **Conventions**, with the slice half kept in the
Architecture note pointing at it rather than restating it. Rewriting four hundred citations was
considered and refused: the churn buys nothing the folder default does not, and the bounded
defect list was twelve edits.

Those twelve, all now explicit:

| Where | Was | Is | Why it was wrong |
| --- | --- | --- | --- |
| `actors/Obsidian.md` (×4) | `SDD §96` | `SDD §9` | The SDD has 93 sections. §9 *Plugin Bootstrap* is the `onunload()` section, and was already in its own sources |
| `actors/Private renovator.md` (×3) | `PRD §3.7` | `PRD §3.5` | *Progressive Complexity* is PRD §3.5 and SDD §3.7 — the same title at two numbers |
| `entities/Cost item.md` | `§51` | `SDD §51` | PRD §51 is *Success Metrics* |
| `entities/Document.md` | `§54` | `SDD §54` | PRD §54 is *Long-Term Product Direction* |
| `business-rules/The cost pipeline…` | `§51` | `SDD §51` | Same, in a table cell beside an explicit `PRD §74` |
| `adrs/0011` | `§40` | `SDD §40` | Two sentences from the one that scoped it |
| `adrs/0012` (×5) | `§74`, `§33`, `§51` | `PRD §74`, `PRD §33`, `SDD §51` | The mixed-in-one-sentence case above |

The `PRD §3.7` case is the one worth remembering: a **sub-section** range check would have
caught it, and the first pass only checked integers.

### C. `sources:` was two different lists

Twenty-eight entity notes cited `§60` (*Identity Model*) for their identity rule and **one**
declared it in `sources:`. Read as an incomplete list, it was 104 missing citations. It is not:
**`sources:` is what a note was derived from; an inline `§N` is what it refers to**, and the
register had never said so. Both halves fixed — the distinction is now a Conventions bullet, and
the three sections that genuinely *are* derivation sources (PRD §36 *Vault Data Model*, §37
*Persistence Strategy*, §60 *Identity Model* — every entity's **Identity and persistence**
heading exists because of them) are declared wherever they are cited: 39 citations across 26
notes, in frontmatter and the `## Sources` footer both, which now agree in all forty-two.

### D. Scheduling that disagreed with itself

7. **`horizon` carried two incompatible scales** — `Now` on sixteen notes (`Next` beside it
   earlier in the branch), `MVP`/`V1`/`V2` on 107, plus one unquoted `MVP`. They cannot be ordered against each other, and `horizon` is
   the base's second sort key, so the mixture sorted `MVP` before `Next` before `Now` before
   `V1` and meant nothing. **Folded onto the release scale** (17 notes): the architecture slices
   *are* the MVP architecture and the UI deliverables *are* the MVP's screens. What "being worked
   now" is recorded by is `status: Active` and the `iteration:` link — two properties that
   already answered it, which is why a third was redundant as well as unsortable. The vocabulary
   is now written into the README's frontmatter table so a third scale cannot grow unremarked.

8. **The one Iteration was empty and its dates were copied into five PBIs.** `iteration:` was
   set on none of 227 notes, while the five PBIs under *Architecture and Software Design* —
   [[Foundation and composition root]], [[Plan editor and canvas]],
   [[Quantity, cost and the end-to-end loop]],
   [[Errors, diagnostics and the test harness]] and [[Shared UI vocabulary]] —
   each carried `start: 2026-08-23` / `due: 2026-09-05` —
   five copies of one fact, four stale the day the box moves, which is exactly what
   *Cross-cutting concerns*' own definition of done forbids. Fixed: the five carry
   `iteration: "[[1 - Iteration]]"`, the dates live only on the Iteration, and the Iteration has
   a body. **Its `## What is open` section is the part worth reading** — five groups and
   seventeen slices in one fortnight is a claim nothing has tested, and moving it onto one link
   did not make it more credible. That is left as a decision somebody takes, not one this fix
   made quietly by editing a link.

### E. The `PBI` type is two shapes, and now says so

Five of six PBIs are not use cases: they hold the design slices and argue about scheduling, with
prose and an **Outcome** — the Feature shape — while the README promised "what someone does,
step by step". This is not sloppiness but the ladder: **only a `PBI` may hold a `Task`**, so the
slices need that rung. Fixed by admitting both shapes with a test that stops it becoming an
excuse — *a PBI holding `Task` items argues about scheduling; a PBI holding none is a use case
with extensions* — and by naming [[Start a renovation project]] as the one real use case.

### F. Smaller items

9. **`setup/vue-conventions.md`** called itself "the contract for that day" and its checklist
   "ALL of the following", while naming two Vite configs where this repository has three and
   omitting the coverage include. Slice 1 corrects it by name; the file had no pointer forward.
   Fixed at the top of §1 and inside items 2 and 3.
10. **`Cross-cutting concerns.md` restated PRD §44's accessibility list minus "sufficient
    contrast"** while [[Accessibility]] states all five — two statements of one list, the shorter
    one wrong, under a definition of done that forbids exactly that. It now cites the Feature.
11. **Three orphans.** [[Every persistent object carries a schema version]] and
    [[Only a completed domain action persists]] were reachable only by browsing the folder, and nothing
    linked to the [[Obsidian]] actor — the note with the widest reach, which hands its store half
    to [[The vault]] and its table half to [[Bases]] with neither linking back. All three now
    have inbound links from the notes whose subject they are.

## The checks these findings became

Sixteen, run over the whole of `docs/`. **Fourteen pass; two report, and both reports are
correct.** They are **not** wired into `npm run check` — nothing there reads `docs/`, which stays
true — so this list is a description of what was run by hand, and the trigger for adopting
`npm run docs` (CLAUDE.md, *Deliberately absent*) is that this ledger had to write them twice.

1. Every `[[wikilink]]` resolves to a basename — **including across a line break**, which is how
   this review introduced and then caught its own defect twice: a wikilink wrapped over two lines
   resolves in neither Obsidian nor the checker, and the second instance was in this ledger.
2. Every relative markdown link resolves, from `docs/**` plus the three root documents.
3. Every `parent:` resolves. 4. Every `partOf:` resolves.
5. Every `dependsOn:` and every `slice:` entry resolves.
6. `order` unique among siblings. 7. `order` a multiple of ten.
8. Every `PRD §N` / `SDD §N` in range — **sub-sections included**.
9. Every `status` in the base's ladder **for that note's type** — `stateValues`, or
   `deliverableStateValues` / `testStateValues` where the type has its own. Read out of
   `Product Backlog.base` rather than from this document, which is the whole point of item A1.
10. `horizon` in `{MVP, V1, V2, empty}`.
11. No note in `entities/`, `actors/`, `business-rules/` or `components/` without an inbound link.
12. No duplicate basenames. 13. No note with an empty body.
14. No non-Iteration note carrying an iteration's dates.
15. No duplicate entry in a `sources:` list — this one exists because the `SDD §96` fix
    introduced a duplicate `SDD §9` that the other checks did not see.
16. `sources:` frontmatter and the `## Sources` footer agree, wherever a note carries both.

**The two that report, and why neither is closed here.** Check 9 names the three Deliverables
carrying `Open`, which the base configures nowhere — a judgement about those three documents,
left as a named edit in the README rather than guessed at. Check 1 names `[[Status badge]]`,
referenced three times from `components/Inspector.md` and `components/Toast.md` with no note
behind it: `components/` is being written, and a link to a part not yet drafted is how that
folder notices its own gaps. Both are live work, and a check that reports live work truthfully
is doing its job.

Three things a reader should not take from the list. **Check 8 verifies that a cited section
exists, never that it is the right one** — `SDD §96` was caught by range, but `SDD §54` versus
`PRD §54` was caught by reading, and no mechanical check available here distinguishes them.
**Check 11 finds an orphan, not a wrong link**: a rule linked from the wrong entity passes it.
And **no check here reads prose**, which is where most of section A lived: a README sentence
describing a tree it no longer matches is invisible to all sixteen. That is the honest ceiling on
this list, and the reason section A was found by reading rather than by running anything.

One thing the review did to itself, worth keeping. **Twice it wrote a count into the index and
twice the count went stale within the hour** — first the `horizon` tally, then "these twelve
notes" about `components/`, a folder that grew from nine to seventeen while this ledger was being
written. CLAUDE.md already states the rule (*a table that enumerates code goes stale; a table
that states a rule does not*) and the index is exactly where it bites hardest. The `components/`
paragraph now gives no count and defers its open vocabulary to the folder.

Also noticed and deliberately not fixed: `docs/reviews/2026-08-23-design-docs-review.md` and
`docs/tasks/17-presentation-layer-error-surfacing.md` have CRLF line endings where every other
note has LF. Pre-existing, invisible to `tests/build/encoding.test.ts` (which guards the BOM and
the release files), and outside this review's subject — recorded here so the next person to see
it knows it was seen.
