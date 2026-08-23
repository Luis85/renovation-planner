# docs — this plugin's own backlog

This folder is a working backlog for the plugin, in **Product Backlog's** schema: the
hierarchy lives in frontmatter rather than in folders, so every note stays plain Markdown
that reads and reviews fine in any editor.

To see it as a tree, open this repository as an Obsidian vault (`npm run test-build`
installs *this* plugin into it) and open `Product Backlog.base`. That view belongs to the
[Product Backlog](https://github.com/Luis85/backlog-view) plugin, which has to be installed in the vault too.

| Folder | Holds | Type |
| --- | --- | --- |
| `requirements/` | What the plugin is meant to do | `Epic` → `Feature` → `PBI` |
| `tasks/` | Engineering work done to keep it maintainable | `Task` |
| `issues/` | Open questions and recorded decisions | `Issue` |
| `bugs/` | Defects, with what was learned from them | `Bug` |
| `tests/cases/` | One live-vault check each, walked before a release | `Test case` |
| `adrs/` | **How** it is built — architecture decision records | *(none — not backlog items)* |
| `prds/` | Requirements documents as received, which the epics here are derived from | *(none — not backlog items)* |
| `sdds/` | Design documents as received, the architecture those epics are built against | *(none — not backlog items)* |
| `design/` | Design **slices** — the received SDD broken into implementable, reviewable chunks. Derived, and edited as the design is refined | *(none — not backlog items)* |
| `actors/` | Who and what the plugin deals with — one note per human or system actor. Derived | *(none — not backlog items)* |
| `entities/` | The business objects the plugin works with — one note per object. Derived | *(none — not backlog items)* |
| `reviews/` | Findings ledgers from code and document reviews, and the record of what was done about each | *(none — not backlog items)* |
| `setup/` | How this repository's own tooling was built and is released | *(none — not backlog items)* |
| `superpowers/` | Claude's design specs and implementation plans, not the product's | *(none — not backlog items)* |

Only the folders with notes in them exist today; the rest are named here so the first note
of that kind has somewhere obvious to go rather than a decision to make.

## What is a work item and what is evidence

The backlog says what the product does and why someone wants it. Eight folders in the table
are deliberately outside it, for three different reasons.

**`prds/` and `sdds/` are what a backlog is derived FROM, not things in it.** Each arrives
from outside, is kept verbatim so a note citing it cites something that has not been edited
to agree with it, and carries no `type`, no `order` and no `status` — giving it a rank and a
state would file the evidence as work, the same mistake as writing a customer interview into
the backlog because it was important.

**`design/`, `actors/`, `entities/` and `reviews/` are DERIVED from that evidence, and the
distinction is the one that decides whether a document may be edited.** A received document
is corrected only by receiving a new one; a derived document is expected to change as the
design is refined, and a refinement that contradicts its source names the source section it
refines and lands here or in an ADR, never in `prds/` or `sdds/`. `design/README.md` states
that rule for the slices and is the place to read it in full. None of the four is backlog: a
slice is not work someone is scheduled to do — the Epic that schedules it lives in
`requirements/` — and a review ledger is a record of findings, not a rank among siblings.

**`actors/` and `entities/` answer *who* and *what*, which is the one axis the backlog does
not have.** `requirements/` is organised by the work to be done, so a [[Zone]] is described
across a dozen notes and nowhere in particular; these two folders give every actor and every
business object one note that says what it is, where it is persisted, what it relates to and
which rules hold for it, with the PRD and SDD sections it was read from cited at the bottom.
They carry no `type`, `order` or `status` for the same reason a PRD does not: an actor is
somebody the product deals with and an entity is something the product has — neither is work
someone is scheduled to do, and ranking them would file the model as a backlog. Their
frontmatter is `kind`, `name`, `layer`, `persistence`, `partOf` and `sources`, none of which
the view reads, so like an ADR they never appear in the tree.

Two things about them are worth knowing before adding one. **They are singular where
`requirements/` is plural** — `Risk` and `Risks`, `Layer` and `Layers`, `Supplier` and
`Suppliers` — and since a basename is an address (see **Conventions**), that convention is
the only thing keeping the two folders from colliding with the backlog. And **they use
`partOf:`, not `parent:`**, because `parent` is a key the base reads and these notes are
deliberately invisible to it.

**Two suffix conventions are in use, and this is the note that admits it.** The received
documents landed as `docs/prds/obsidian-renovation-planner.md` and
`docs/sdds/obsidian-renovation-planner-SDD.md`: one bare, one suffixed. The folder already
carries the kind, so the bare form is the convention going forward and a new received
document takes it. The existing SDD keeps its name rather than being renamed to match —
a received document's basename is its address (see **Conventions** below), every citation
in `docs/design/` and `docs/adrs/` resolves against it, and churning a filename to win a
cosmetic consistency is a worse trade than one sentence recording the exception.

**`adrs/` are outside for a chosen reason**: an ADR says what this codebase decided, what it
cost, and what would make us choose again. Its frontmatter is `adr`, `title`, `status`,
`date`, `area` — none of which the view reads — so it never appears in the tree. An SDD is
not an ADR and does not replace one: the SDD is what somebody *proposed*, an ADR is what was
*decided*, and where the two disagree the ADR and the lint rule are what hold, with the
disagreement recorded as an Issue until somebody settles it.

`setup/` and `superpowers/` are prose about how the repository works and scratch space for
generated specs and plans. Neither pretends to be a work item.

## What each kind of note holds

The **type is a promise about the content**, so choosing it is the first editorial decision:
a defect written as a Task loses the lesson, and a limitation written as a Bug reads as
something someone is about to fix.

| Kind | Answers | Sections |
| --- | --- | --- |
| `Epic` | Why this body of work exists, and what "done" means beneath it | Prose · why it exists · definition of done |
| `Feature` | What outcome one coherent slice delivers | Prose · **Outcome** |
| `PBI` | What someone does, step by step, and every way it can go otherwise | The use-case shape below |
| `Task` | A piece of engineering work, and the evidence that justified it | Evidence · Why it matters · Approach · Acceptance criteria · Risks · Outcome |
| `Issue` | A question, a decision taken, or a limitation accepted | Varies by which |
| `Test case` | What to check in a live vault, and whether it passed | Why this exists · Preconditions · How to check · Acceptance criteria · Outcome |
| `Bug` | What happened, what fixed it, and what it taught | What happened · Fix · Lesson |
| ADR | What was chosen, what it cost, what would change it | Context · Decision · Consequences · Alternatives · Revisit when — **in that order** |

What "says something" means, per kind:

- **`Epic`** — not a folder with a title. It names the gap it fills and states the
  conditions every item beneath it must satisfy, so a use case three levels down can be
  argued against something. If deleting it would make no child harder to judge, it was a
  heading.
- **`Feature`** — one outcome, one sentence, in the user's terms: what is true once it
  exists. Detail written at feature level is detail no use case owns.
- **`PBI`** — a use case: the actor, the main flow as numbered steps, and the extensions
  (`3a`, `3b`, …) that say what happens when a step goes otherwise. The extensions are where
  the value is; a main flow with none is a wish.
- **`Task`** — opens with a **measurement**, not an opinion. "This module is 480 lines and
  three callers duplicate its guard" is evidence; "this feels messy" is not.
- **`Issue`** — records the alternatives that were rejected and why. An Issue that says only
  what was done leaves the next reader to re-derive them, which makes the decision
  historical rather than arguable.
- **`Test case`** — the checks CI cannot run: appearance under a community theme, whether
  the ribbon opens the pane, anything needing a real Obsidian. `RELEASING.md`'s pre-tag
  sweep is these notes; each carries a `cadence:` of `release` (walk it every time) or
  `conditional` (its own trigger, stated in its own prose).
- **`Bug`** — the lesson is the point. The fix is in git; what the defect taught is not.

## Conventions

- **Frontmatter is the view's own vocabulary**, and this base configures these keys:

| Field | On | Holds |
| --- | --- | --- |
| `type` | every backlog note | One of the ladder's names (see `README_PRODUCT_BACKLOG.md`). ADRs carry none |
| `parent` | everything but a root | A quoted wikilink, `"[[Note name]]"` — unquoted, YAML reads the brackets as a list |
| `order` | every backlog note | The rank among siblings. **Unique within a group**, and spaced by tens, so an insertion needs no renumbering |
| `status` | every backlog note | `Open`, `Active`, `Done`, or `Dropped` — refused, kept for the record. Empty means nobody has set one, which is where every note here starts |
| `started` / `finished` | anything in flight | Dates, `YYYY-MM-DD` |
| `horizon`, `start`, `due` | anything planned | The roadmap axes: a bucket, or a date pair |
| `risk`, `priority`, `assignee` | optional | Labels. Absent means nobody has judged it |
| `dependsOn` | optional | A quoted wikilink to what must land first |
| `iteration`, `goal` | optional | The time box an item is scheduled into, and its goal |

- **Every note states the evidence it rests on.** A note that cannot say what it observed is
  a guess, and guesses are what this folder exists to keep out of the code.
- **A note's basename is its address.** A `[[wikilink]]` and a `parent:` both resolve by
  basename, so two notes sharing one is an ambiguity the whole tree is built on. Titles are
  prose — `Moving a task between trades.md`, not `moving-task-trade.md` — and a PRD or SDD
  claims its name against every note here too, so a document and the epic derived from it can
  never share one.
- **Write it when it is decided, not when it is convenient.** Half of what is worth keeping
  — an asymmetry nobody chose, a rule that holds only by luck — gets noticed in passing while
  doing something else, and is unrecoverable an hour later.
- **A closed note is not deleted.** Its outcome is the record of why the code looks as it
  does, and several `Test case` notes are checklists to *re-run* rather than history:
  appearance and anything needing Obsidian cannot be tested in this repository, so those are
  reopened, not rewritten.
- **A check that has found nothing across two releases gets reviewed, not retired.** What
  retires a check is evidence about its subject — the thing is gone, or an automated test now
  watches it — never its hit rate.
- Anything still open is open for a reason. This is not a list of undone chores.

## What is not enforced

**Nothing in `npm run check` reads this folder.** Every rule above rests on whoever writes
the note, and that is the honest statement rather than an omission.

The project this harness came from gates its register with a fifth step, `npm run docs`:
every wikilink resolving, every source path a current note names still existing, the index's
hierarchy matching the notes' own frontmatter, every module in `src/` being *specified* by at
least one note, and opt-in `**Checked by**` citations — a backticked test path and a quoted
test name — verified to resolve. Section 5 of
[`setup/quality-harness.md`](setup/quality-harness.md) describes it, including the two rules
that make such a gate worth having (parse Markdown, never pattern-match it; a rule that
quietly does nothing on input it cannot parse is worse than no rule) and the tests that run
the checker over planted trees in both directions.

Adopt it when this folder is large enough that a stale wikilink stops being obvious — and
until then, write the citation anyway: the value of `**Checked by** \`tests/x.test.ts\` —
"the test name"` is mostly the moment the author goes and fetches the name, which no gate
supplies.
