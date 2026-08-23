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
| `tasks/` | Engineering work done to keep it maintainable, and the design **slices** — the received SDD broken into implementable, reviewable chunks. The slices are derived, and edited as the design is refined | `Task` |
| `issues/` | Open questions and recorded decisions | `Issue` |
| `bugs/` | Defects, with what was learned from them | `Bug` |
| `deliverables/` | An artifact a Feature owes — the thing itself, not a promise of it. Derived, and edited as the design is refined | `Deliverable` |
| `iterations/` | The time boxes work is scheduled into. A marker: it states a date rather than work, and holds nothing | `Iteration` |
| `tests/cases/` | One live-vault check each, walked before a release | `Test case` |
| `adrs/` | **How** it is built — architecture decision records | *(none — not backlog items)* |
| `prds/` | Requirements documents as received, which the epics here are derived from | *(none — not backlog items)* |
| `sdds/` | Design documents as received, the architecture those epics are built against | *(none — not backlog items)* |
| `actors/` | Who and what the plugin deals with — one note per human or system actor. Derived | *(none — not backlog items)* |
| `entities/` | The business objects the plugin works with — one note per object. Derived | *(none — not backlog items)* |
| `business-rules/` | The rules the product must obey — one note per rule, only where no single entity owns it. Derived | *(none — not backlog items)* |
| `components/` | The UI parts every screen is assembled from — one note per component, each `partOf` a [[Design System]]. Derived | *(none — not backlog items)* |
| `reviews/` | Findings ledgers from code and document reviews, and the record of what was done about each | *(none — not backlog items)* |
| `setup/` | How this repository's own tooling was built and is released | *(none — not backlog items)* |
| `superpowers/` | Claude's design specs and implementation plans, not the product's | *(none — not backlog items)* |

Only the folders with notes in them exist today; the rest are named here so the first note
of that kind has somewhere obvious to go rather than a decision to make.

## What is a work item and what is evidence

The backlog says what the product does and why someone wants it. Ten folders in the table
are deliberately outside it, for three different reasons.

**`prds/` and `sdds/` are what a backlog is derived FROM, not things in it.** Each arrives
from outside, is kept verbatim so a note citing it cites something that has not been edited
to agree with it, and carries no `type`, no `order` and no `status` — giving it a rank and a
state would file the evidence as work, the same mistake as writing a customer interview into
the backlog because it was important.

**The design slices in `tasks/`, plus `deliverables/`, `actors/`, `entities/`, `business-rules/`,
`components/` and `reviews/`, are DERIVED from that evidence, and the distinction is the one that decides
whether a document may be edited.** A received document is corrected only by receiving a new one; a derived document
is expected to change as the design is refined, and a refinement that contradicts its source
names the source section it refines and lands in a slice, a deliverable or an ADR, never in
`prds/` or `sdds/`. `requirements/Architecture and Software Design.md` states that rule for
the slices, and carries the conventions and vocabulary all seventeen share.

**Derived and non-backlog are different axes, and the slices are the case that separates
them.** They are typed `Task` under the *Architecture and Software Design* Feature, so they
do appear in the tree — a slice is work someone is scheduled to do, whatever else it is.
`actors/`, `entities/`, `business-rules/`, `components/` and `reviews/` are the ones outside the
backlog for being derived: an actor is somebody the product deals with rather than work, a rule
is a constraint on work rather than work, a component is a part things are assembled from rather
than work, and a review ledger is a record of findings rather than a rank among siblings. An earlier version of this section put the slices
in that group, which was true while they lived in a folder of their own and stopped being
true when they were typed.

`deliverables/` is the second case, and it makes the same point without the history: a
Deliverable is derived *and* in the backlog, because an artifact a Feature owes is something
somebody is scheduled to produce. Derived says whether it may be edited; typed says whether it
has a rank. Neither answer implies the other.

**`actors/` and `entities/` answer *who* and *what*, which is the one axis the backlog does
not have.** `requirements/` is organised by the work to be done, so a [[Zone]] is described
across a dozen notes and nowhere in particular; these two folders give every actor and every
business object one note that says what it is, where it is persisted, what it relates to and
which rules hold for it, with the PRD and SDD sections it was read from cited at the bottom.
They carry no `order` and no `status` for the same reason a PRD does not: an actor is
somebody the product deals with and an entity is something the product has — neither is work
someone is scheduled to do, and ranking them would file the model as a backlog.

**Their frontmatter is not one shape, and what keeps them out of the tree is not what this
paragraph used to say.** Both carry `name`, `sources` and `type` — `type: entity` or
`type: actor`, for the base's own table views, exactly as `business-rules/` carries
`type: business-rule`. Beyond that they diverge, because the two answer different questions:

| Folder | Frontmatter | The classifying key |
| --- | --- | --- |
| `entities/` | `name`, `layer`, `persistence`, `partOf` (where one applies), `sources`, `type` | `layer` (`core`, `domain`) and `persistence` (`note`, `sidecar`, `note + sidecar`, `none`) |
| `actors/` | `name`, `kind`, `standing`, `partOf` (one note), `sources`, `type` | `kind` (`human`, `system`) and `standing` — `primary persona`, `host application`, `canonical store`, `adversarial`, `out of scope`, … |
| `components/` | `name`, `medium`, `region`, `slice`, `partOf` (always [[Design System]]), `sources`, `type` | `medium` (`dom`, `canvas`, `both`) and `region` (`chrome`, `rail`, `canvas`, `overlay`, `in-flow`) |

**`medium` is the component's own key**, and it classifies by what a component's *problems* are
rather than by where it sits: a `canvas` component gets no CSS focus ring, no accessible name and
no hit target anything in this repository can measure, so axe cannot see it at all, while a `dom`
one inherits all three. `region` orders within that. Its fifth value, `in-flow`, exists because
three components are region-*agnostic* — [[Empty state]], [[Inline field error]] and
[[Status badge]] are drawn by any surface, and filing them under `overlay` beside [[Toast]] and
[[Modal]] would have claimed they overlay content when they displace it.

**`slice` is empty on exactly one of the seventeen**, [[Layer toggle]]: PRD §39 names the control
and none of the design slices claims it. That empty is the same kind of fact as the four business
rules that name no slice — a sentence somebody has to come back and change, rather than an
omission nobody can see. A component note also carries no `layer` and no `persistence`: a
component is presentation, and neither key has a value there.

An actor has no `layer` and no `persistence`: it is not code and it is not stored, so those
two keys would be blank in all eight. **`standing` is the actor's own key** and says what
relationship the plugin has with it, which is the one thing worth grouping eight actors by.
An earlier version of this paragraph gave both folders the entity list and named neither
`standing` nor `type`.

**An entity note carries no `kind`, and that is a removal rather than an omission.** All
thirty-four declared the key and left it empty — no vocabulary, no reader, nothing grouped by
it — while `actors/` and `business-rules/` both give theirs values. `layer` and `persistence`
already classify an entity along the two axes that decide where its code lives and where its
data goes, and a third axis nobody could name a value for is not a field. It is one line to
add back the day somebody has the vocabulary.

**And the base does read these keys** — the *Entities* view groups by `layer` and orders on
`type`, `persistence` and `partOf`; the *Actors* view orders on `type`, `kind` and `standing`.
What keeps these notes out of the **tree** is not that nothing reads them; it is that they
carry no `parent`, which is the only key the hierarchy is built from. That distinction matters
the moment somebody adds `parent:` to an entity note to make a link render and files the model
as a backlog by accident.

Two more things worth knowing before adding one. **They are singular where
`requirements/` is plural** — `Risk` and `Risks`, `Layer` and `Layers`, `Supplier` and
`Suppliers` — and since a basename is an address (see **Conventions**), that convention is
the only thing keeping the two folders from colliding with the backlog. And **they use
`partOf:`, not `parent:`**, which is the same sentence as above from the other side: `partOf`
records what the thing belongs to without enrolling it in anybody's ranking.

**`business-rules/` holds only what no single entity owns.** Every note in `entities/` already
carries a `## Rules` section, and those are the rules *about that object* — they stay there. This
folder is for the other kind: a rule that constrains several entities at once (the forecast spans
[[Cost item]], [[Order]] and [[Invoice]]; the quantity chain spans four entities), or a formula the
engine implements and a test can drive (rounding mode and point, waste, packaging). The test for
which folder a rule belongs in is **whether one entity note could state it without lying by
omission.** If it could, it belongs there and this folder does not repeat it — a rule stated twice
is two rules the day one of them is edited, which is what the review ground rules mean by *do not
leave two statements*.

Its frontmatter is `rule`, `kind`, `name`, `area` and `sources`, plus `type: business-rule` for the
base's table view — none of which the tree reads. **`rule` is an address, not a label**: `BR-COST-002`
is what a test name, a doc comment and a future `npm run docs` citation point at, so an id is never
reused and never renumbered, the same way a view type and a command id are data rather than text
(see [`CLAUDE.md`](../CLAUDE.md)). `kind` says what shape the rule is — `calculation`, `constraint`,
`separation`, `derivation`, `integrity`, `lifecycle` — and `area` says which part of the product it
governs. A basename is the rule stated as a sentence, so these cannot collide with the singular
entity notes or the plural requirement notes.

**`components/` is the third folder answering a question the backlog does not have, and it is
the *Design System*'s own vocabulary rather than the register's.** Where `entities/` names the
business objects and `actors/` the parties, these notes name the **UI parts every screen is
assembled from** — a toolbar, an inspector, a selection handle — one note each, saying what the
part is, what it may be handed, what states it has and what is still open about it. Each is
`partOf: "[[Design System]]"`, which is why that deliverable can state a system without
restating every component inside itself. **No count is given here on purpose**: the folder is
being written, and `docs/components/` is the list that cannot go stale.

Its frontmatter is `name`, `medium`, `region`, `slice`, `partOf`, `sources` and `type: component`,
and the two keys worth knowing are the two no other derived note has. **`medium` says which
rendering technology draws the part**, which is what decides whether `styles/` or Konva owns its
appearance and whether jsdom can test it at all. **`region` says where in the editor shell it
lives** — and unlike `medium` it is an *open* vocabulary, growing as the shell grows, so the
notes are its definition and not a list kept here. `slice` is a list of wikilinks to the design
slices that build it: the one link running from the model back into the backlog, and deliberately
not `dependsOn`, because a component is not scheduled. Like `entities/` and `actors/` these notes
carry no `parent`, so they never appear in the tree, and the `## Sources` footer rule applies to
them the same way.

**A component may link to one not yet written.** These notes are being drafted against each
other, so a `[[wikilink]]` here is as often a *claim that a part exists* as a pointer to a
written page — which is the register's cheapest way to notice a gap, and the reason an
unresolved link in this folder is a to-do rather than a defect. It is a defect anywhere else.

Every note ends with **Checked by**, and today all twenty-seven say *not yet*. Twenty-three name
the slice where the check lands; the remaining four — *A change is a state on an object*, *A
dependency is allowed only between five pairs of things*, *A derived value is recomputed on read*
and *A manual override is stored as an override* — name none, because their subject has no slice
yet: the schedule, state visualization and as-built work all sit beyond the seventeen. Naming the
four is the point. "All twenty-seven name the slice" was the earlier sentence, and it read as
settled while four rules had nowhere to be checked. That is the honest state of a repository whose
`src/` is still a scaffold, and it is deliberately a sentence somebody has to come back and change
rather than an omission nobody can see.

**Two suffix conventions are in use, and this is the note that admits it.** The received
documents landed as `docs/prds/obsidian-renovation-planner.md` and
`docs/sdds/obsidian-renovation-planner-SDD.md`: one bare, one suffixed. The folder already
carries the kind, so the bare form is the convention going forward and a new received
document takes it. The existing SDD keeps its name rather than being renamed to match —
a received document's basename is its address (see **Conventions** below), every citation
in `docs/tasks/` and `docs/adrs/` resolves against it, and churning a filename to win a
cosmetic consistency is a worse trade than one sentence recording the exception.

**`adrs/` are outside for a chosen reason**: an ADR says what this codebase decided, what it
cost, and what would make us choose again. Its frontmatter is `adr`, `title`, `status`,
`date` and `area`, plus `revised` on the one that has been (ADR-011) — none of which the view
reads, so it never appears in the tree. An SDD is
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
| `PBI` | What someone does, step by step, and every way it can go otherwise — **or**, where it holds `Task` items, why that group is scheduled as one | The use-case shape below, or prose · **Outcome** |
| `Task` | A piece of engineering work, and the evidence that justified it | Evidence · Why it matters · Approach · Acceptance criteria · Risks · Outcome |
| `Deliverable` | An artifact its parent owes, and the note **is** that artifact | The artifact · what it may not restate · what is open · **References** |
| `Issue` | A question, a decision taken, or a limitation accepted | Varies by which |
| `Test case` | What to check in a live vault, and whether it passed | Why this exists · Preconditions · How to check · Acceptance criteria · Outcome |
| `Bug` | What happened, what fixed it, and what it taught | What happened · Fix · Lesson |
| `Iteration` | Which time box work is scheduled into, and what that box is for | Prose · **Goal**, plus `goal`, `start` and `due` in frontmatter |
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
  the value is; a main flow with none is a wish. [[Start a renovation project]] is the worked
  example and today the only one.

  **The other five PBIs are not use cases, and pretending otherwise would misfile them.** Only
  a `PBI` may hold a `Task` (see `README_PRODUCT_BACKLOG.md`'s table), so the seventeen design
  slices need a `PBI` rung between them and the *Architecture and Software Design* Feature —
  and what those five notes owe is not "what someone does, step by step" but **why these
  slices are one group**: which depend on which, what may be built in parallel, and what a
  `dependsOn` link cannot carry. So they take the Feature shape, prose and an **Outcome**, and
  each is worth its own note precisely because that argument is not a list of links.

  Two shapes under one type is a compromise the ladder forces, not a preference, and the test
  that keeps it from becoming an excuse is this: **a PBI holding `Task` items argues about
  scheduling; a PBI holding none is a use case with extensions.** A PBI that holds Tasks *and*
  reads like a use case has a use case hiding inside it that wants its own note.
- **`Task`** — opens with a **measurement**, not an opinion. "This module is 480 lines and
  three callers duplicate its guard" is evidence; "this feels messy" is not.
- **`Deliverable`** — the note **is** the artifact, not a promise of one and not a container
  for the Tasks that produce it. So it carries the same contract as the design slices: it is
  **derived**, it cites the sections it was read from, it is expected to change as the design
  is refined, and a refinement that contradicts its source names the section it refines and
  lands here rather than in `prds/` or `sdds/`. Two things make it worth the type. It says
  **what it may not restate** — the same test `business-rules/` uses above, whether the note
  that already owns the subject could state it without lying by omission — and it states
  **what is open** rather than inventing an answer, because an artifact that decided a
  question nobody asked is worse than one that names it. There are four:
  [[Information Architecture]], [[Sitemap]] and [[Design System]] under *User Interface*, and
  [[Disclosure ladder]] under *User Experience* — the last being the only one that states an
  **order**, which is why it could not have been a section inside any of the other three.
- **`Issue`** — records the alternatives that were rejected and why. An Issue that says only
  what was done leaves the next reader to re-derive them, which makes the decision
  historical rather than arguable.
- **`Test case`** — the checks CI cannot run: appearance under a community theme, whether
  the ribbon opens the pane, anything needing a real Obsidian. `RELEASING.md`'s pre-tag
  sweep is these notes; each carries a `cadence:` of `release` (walk it every time) or
  `conditional` (its own trigger, stated in its own prose).
- **`Bug`** — the lesson is the point. The fix is in git; what the defect taught is not.
- **`Iteration`** — a marker: it states a date range rather than work, hangs from nothing and
  holds nothing. What puts an item *in* it is the item's own `iteration:` link, never a list
  kept here — so the note says what the box is **for** and leaves membership to the members.
  Its own dates are the box's; **an item inside it does not repeat them.** Five PBIs each
  carried `start: 2026-08-23` / `due: 2026-09-05` before [[1 - Iteration]] existed, which is
  five copies of one fact and four of them stale the day the box moves.

## Conventions

- **Frontmatter is the view's own vocabulary**, and this base configures these keys:

| Field | On | Holds |
| --- | --- | --- |
| `type` | every backlog note | One of the ladder's names (see `README_PRODUCT_BACKLOG.md`). ADRs carry none |
| `parent` | everything but a root | A quoted wikilink, `"[[Note name]]"` — unquoted, YAML reads the brackets as a list |
| `order` | every backlog note | The rank among siblings. **Unique within a group**, and spaced by tens, so an insertion needs no renumbering |
| `status` | every backlog note | `New`, `Ready`, `Active`, `Resolved` or `Done`, read out of the base's `stateValues`. `Deliverable` and `Test case` notes run **narrower ladders of their own**, also configured there. Empty is a sixth reading with a direction, and the paragraph below says which |
| `started` / `finished` | anything in flight | Dates, `YYYY-MM-DD` |
| `horizon`, `start`, `due` | anything planned | The roadmap axes: a release bucket — `MVP`, `V1`, `V2` and nothing else — or a date pair. Empty means unscoped |
| `risk`, `priority`, `assignee` | optional | Labels. Absent means nobody has judged it |
| `dependsOn` | optional | What must land first: a quoted wikilink, or a YAML list of them where there is more than one. The seventeen design slices under `tasks/` are the worked example |
| `iteration`, `goal` | optional | The time box an item is scheduled into, and its goal |

**The status vocabulary is the base's, and this section reads it out rather than restating it.**
[`Product Backlog.base`](Product%20Backlog.base) is the source of truth: it configures the
values, the view renders them, and where this document and that file disagree **the base is
right and this document is the bug.** It has been, once — an earlier version of this section
documented `Open` and `Dropped`, which the base does not configure, and omitted `Ready` and
`Resolved`, which it does. Three of the five values mean "not started" or "not doing", so the
row above is not enough on its own:

| Value | Means | On | Count today |
| --- | --- | --- | --- |
| `New` | Just added. Written, not yet triaged | anything | 7 |
| `Ready` | Triaged. Somebody has judged it and it is ready to pick up. Also what an **open iteration** carries (`iterationOpenStates`) | anything | 1 |
| `Active` | In flight. The base's `startedStates`, so it is the value that expects a `started` date | anything | 3 |
| `Resolved` | Settled without being produced — answered, superseded, no longer needed. What a **closed iteration** carries (`iterationResolvedStates`) | anything | 0 |
| `Done` | Finished. The three `Issue` notes recording decisions taken | anything | 3 |
| *(empty)* | **Legacy.** Written before the vocabulary was used, and to be migrated | — | 125 |

**Two types run narrower ladders, and the base names both.** A `Deliverable` takes
`New`, `Active`, `Done` only (`deliverableStateValues`) — an artifact is drafted, worked or
finished, and the two middle readings above do not apply to a document. A `Test case` takes
`Draft`, `Ready`, `Approved` (`testStateValues`), which is a ladder about whether a **check** is
written and agreed rather than about whether work is done; there are none yet. Neither list is
a subset of the other, which is why reading them off the base beats remembering them.

Those counts are measured rather than remembered, and they are a snapshot — the row above is
the vocabulary and this table is today's reading of it. The twelve notes carrying `Accepted`
are **ADRs** and are not in it: an ADR's frontmatter is its own (`adr`, `title`, `status`,
`date`, `area`, plus `revised` where one has been), the view reads none of it, and `Accepted`
is that vocabulary rather than a sixth value here.

**Three notes carry `Open`, which the base configures nowhere, and that is recorded rather than
quietly relabelled.** They are the three Deliverables under *User Interface* —
[[Information Architecture]], [[Sitemap]] and [[Design System]] — and `Open` was reaching for
what `Ready` means. `Ready` is not in `deliverableStateValues`, so the mapping is not mechanical:
either they are `New` (drafted, not yet being worked) or `Active` (being worked, and then they
owe a `started` date). **That is a judgement about those three documents, not about this
vocabulary**, so it is left as one edit somebody makes on purpose instead of a guess made here.

An earlier version of this section said empty "means nobody has set one, which is where every
note here starts", which blessed the default and made all five named values optional. It is
struck, because 125 of 142 notes carrying no status is not a convention being followed — it is a
convention nobody has applied yet, and describing it as correct is what kept it that way.

**The 125 are debt, and this sentence is the whole of what has been done about them.** They are
not migrated, there is no gate that would notice (`npm run check` reads nothing here), and
migrating them is a pass somebody has to schedule rather than a side effect of the next edit. A
note being edited for another reason is the cheapest moment to set its status, and that is the
only mechanism in place.

- **Every note states the evidence it rests on.** A note that cannot say what it observed is
  a guess, and guesses are what this folder exists to keep out of the code.
- **`sources:` is what a note was DERIVED from; an inline `§N` is what it REFERS to.** The two
  are not the same list and the register never said so, which read as `sources:` being
  incomplete: twenty-eight entity notes cited `§60` for their identity rule and one declared it.
  A section belongs in `sources:` when a heading in the note exists *because* of it — every
  entity's **Identity and persistence** section is derived from PRD §36, §37 and §60, so those
  are now declared wherever they are cited. A section a note merely points at on the way past —
  another epic, a neighbouring rule — stays an inline citation and does not inflate the
  derivation list. **Where `sources:` appears twice, the two copies must agree**: entity and
  actor notes carry it in frontmatter and again in a `## Sources` footer, and today all
  forty-two match.
- **`horizon` is one scale, and it took a second one growing to notice.** The values are
  `MVP`, `V1` and `V2` — release scope, from the PRD's own — always **quoted**, because one
  note wrote `MVP` bare against forty-one that quoted it. Sixteen more were carrying `Now` — with `Next`
  beside it earlier in the branch's history — a *proximity* scale, which cannot be ordered
  against a *scope* one, and `horizon` is the base's second
  sort key (`file.name`, `horizon`, `iteration`, `status`), so the mixture sorted `MVP` before
  `Now` before `V1` and meant nothing. They are on `MVP` now, which is what they always were:
  the architecture slices are the MVP architecture, and the UI deliverables are the MVP's
  screens. **What "being worked right now" is recorded by is `status: Active` and the
  `iteration:` link** — two properties that already answer it, which is why a third was
  redundant as well as unsortable.
- **A bare `§N` takes the document its folder derives from, and `adrs/` gets no default.**
  The PRD and the SDD number their sections independently from 1, so `§33`, `§39`, `§51`,
  `§54`, `§60`, `§64`, `§67` and `§74` each name an unrelated topic in the two documents.
  Rather than prefix four hundred citations, the register lets the folder carry the default,
  because a folder derives from one document and not the other:

| Folder | A bare `§N` means | Because it derives from |
| --- | --- | --- |
| `tasks/` | the **SDD** | the design, section by section |
| `requirements/`, `entities/`, `actors/`, `business-rules/`, `deliverables/`, `issues/` | the **PRD** | the product intent |
| `adrs/`, `components/` | **nothing — always prefix** | both, in roughly equal measure |

  **`components/` shares the `adrs/` row for a different reason.** An ADR is prefixed because it
  *overrules* the SDD, so a reader cannot use the folder to guess. A component note is prefixed
  because it genuinely draws on both documents at once — PRD §39 gives it the panel names and
  SDD §60 gives it the layout, PRD §67 gives it the four save states and SDD §64 gives it the
  error categories — and the numbers collide: PRD §64 is deletion semantics while SDD §64 is the
  error model, and both are cited in this folder. All seventeen notes carry the prefix, checked
  rather than assumed.

  **The `adrs/` row is the one that was learned rather than chosen.** ADR-012 cited `§74`,
  `§33` and `§51` bare, and the first two are the PRD while the third is the SDD — one
  sentence there ("as §74 and §51 jointly do") meant a different document with each number.
  An ADR is the note that *overrules* the SDD where they disagree, so it is the one place a
  reader cannot use the folder to guess; every citation in `adrs/` carries its prefix, and the
  three in ADR-012 now do. Everywhere else the prefix is still required whenever a note cites
  the document its folder does *not* default to — `entities/Document.md`'s `SDD §54` and
  `business-rules/`'s `SDD §51` are that case — and it is never wrong to write the prefix
  anyway. Check the actual heading before citing a number from memory: `actors/Obsidian.md`
  cited the SDD's section ninety-six three times against a document with ninety-three
  sections, and `actors/Private renovator.md` attributed sub-section 3.7 to the PRD, which
  stops at 3.6. *Progressive Complexity* is PRD §3.5 and SDD §3.7 — the same title at two
  numbers, which is the sub-section version of the same trap.
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
