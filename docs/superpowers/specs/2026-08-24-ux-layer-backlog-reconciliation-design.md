# Reconciling the UX layer with the backlog — design

**Date:** 2026-08-24
**Status:** Approved and **frozen** for execution, 2026-08-24, at eight review rounds and
twenty findings. Further review findings are logged against this document rather than folded
into it: the rounds stopped tapering, each was critiquing the previous round's fix, and the
ledger will test this instrument against 227 notes harder than another round can.
**Output:** one findings ledger in `docs/reviews/`. No derived note is edited by this work.

## Why

`main` gained a user-experience layer written after the backlog it describes: a second PRD
(`docs/prds/renovation-project-workspace.md`, 1,451 lines) and four files under
`docs/user-experience/` — a prototype design specification (1,432), wireframes (1,143), a
UX journey and interaction design document (682) and a JTBD research backlog (424) — plus
HTML concept pages and seventeen screenshots.

`main` then gained three more documents (`db2222e`, `c57d444`, `db35815`): a canvas concept
and interaction design specification under `docs/user-experience/`, and — in a **new
`docs/product/` folder** — a user research synthesis and a competitive market landscape.

**Files are not documents here: they nest, and they nest twice.** Established by diff rather
than by reading:

```text
PROTOTYPE-DESIGN-SPEC.md   §§1–16 of its own, then …
└── the whole wireframes file
    ├── UXD §§1–34                    (identical to UXD.md)
    └── Appendix A                    the wireframe and screen reference

renovation-canvas-concept-…-design.md   lines 1–783 of its own, then …
└── product/…-user-research-synthesis.md   lines 784–2418, verbatim
```

So counting file lengths triple-counts the UXD, double-counts the wireframe appendix and
double-counts the research synthesis. Counted **once each**, the in-scope evidence is
**5,719 lines** of Markdown: the workspace PRD (1,451), the prototype's own §§1–16 (285), the
UXD (682), the wireframe appendix (459), the JTBD backlog (424), the canvas concept's own
§§1–783 (783) and the user research synthesis (1,635).

That matters past the arithmetic. An extraction rule that treats nested files as independent
contributors reads the same claims two or three times and reports the repetition as coverage
— the failure this instrument exists to prevent, arriving through the corpus rather than
through the method. It found the pattern once and the corpus produced it again, which is why
the rule below is stated over *bodies* and not over files.

They landed beside 19 Epics and 121 notes in `requirements/` that were derived from the
*other* PRD. Nothing conflicted, because nothing ever does between two documents: a
convention arriving next to documents that predate it clashes semantically or not at all,
and never as a merge conflict. That is the entire reason this pass exists.

The divergence is real, and it is not the one a first reading finds — which matters, because
the wrong version of it shapes the whole pass. **Every structural noun the new evidence
speaks in already has an entity note**: Site, Building, Floor, Space, Outdoor area, Zone,
Plan and Project, eight of eight. None of them is new. The *original* PRD's §6 domain model
already draws the building hierarchy the new documents use:

```text
RenovationProject
│
├── Site
│   ├── Building
│   │   └── Floor
│   │       └── Space
│   └── OutdoorArea
│
├── Plan
│   ├── Layer
│   └── SpatialObject
│
├── Zone
└── …          ← abridged here; §6's non-spatial branches are omitted, not absent
```

What is genuinely absent from the backlog is a different kind of thing — the new evidence's
**screens and navigation**. `Planner Home`, `Spaces View` and `Space Detail` appear in zero
of the 227 derived notes, and `Project Home` in exactly one, `deliverables/MVP Prototype.md`.

What remains on the vocabulary side is a **collapse rather than a gap**: the new PRD uses
"space" as an umbrella over distinctions the backlog holds apart. Feature 2.4's "initial
spaces" offers *garden* and *terrace*, which `entities/Outdoor area.md` places under `Site`,
while `entities/Zone.md` offers "the terrace, the front garden" as example **Zones**.

Both counts are reproducible rather than asserted:

```bash
# every structural noun already has an entity note — prints 8
for n in Site Building Floor Space "Outdoor area" Zone Plan Project; do
  test -f "docs/entities/$n.md" && echo "$n"; done | wc -l

# the screen and navigation concepts are the absent ones — prints 0, 0, 0, 1
for n in "Planner Home" "Spaces View" "Space Detail" "Project Home"; do
  printf '%s: ' "$n"
  grep -rliF "$n" docs/requirements docs/entities docs/business-rules docs/components \
    docs/actors docs/deliverables docs/adrs docs/issues | wc -l; done
```

An earlier draft of this section claimed the opposite — that `Space` was absent — on the
strength of a real measurement: `Space` does appear in zero of the 121 requirement notes.
The count was right and the inference was wrong, because `Space` has had an entity note the
whole time. Counting requirement notes measures *behavioural* coverage; the presence of a
named thing is a different lookup. That is precisely the two-kinds-of-row distinction below,
which this spec had failed to apply to its own motivating example — the fourth instance of
the defect the instrument exists to prevent, recorded here rather than quietly corrected.

## What is not in question

The new PRD is **additive, not competing**, and says so: *"The Renovation Planner already
has a technically sound foundation for spatial planning, zones, assets, quantities, costs,
work packages, scheduling, and project documentation. The purpose of this PRD is to define
the user-facing product layer."* This is not an adjudication between two specifications.

The **direction is settled by the register's own rules — for the PRD.** Both PRDs sit in
`docs/prds/`, which `docs/README.md` defines as received evidence kept verbatim, "corrected
only by receiving a new one". Where a finding sets the workspace PRD against a derived note,
the backlog moves and the PRD does not. No question needs asking about that one, and none is.

**And even for the PRD, "the backlog moves" needs one check first.** A derived note carries
`sources:` naming the received sections it came from — `entities/Space.md` cites PRD §6, §34,
§58 and §60 of the *original* PRD, and the Space-versus-Zone distinction this spec leans on in
its own opening comes from there. So when the workspace PRD contradicts such a note there are
two possibilities, and they have opposite remedies:

- the note has **drifted** from the source it cites → a stale derivation, and the backlog
  moves, as the rule says;
- the note **faithfully reflects** its source → the disagreement is really between the
  workspace PRD and the original PRD or SDD, which are *both* received. Moving the backlog
  would silently pick one received document over another, and the register's own rule is that
  a received document is corrected only by receiving a new one. That is a decision, listed and
  not taken.

A conflicting derived claim is therefore traced to its cited sources before any direction is
assigned. **The original PRD and the SDD are a reference corpus for that trace, not evidence
bodies**: they are read where a finding cites them and are not swept for rows, so they add no
rows and appear in no count. Stated as a limit rather than left implicit, because it is the
one place this pass reads a document it does not inventory.

**Beyond the PRD it is not settled at all, and an earlier draft of this section said it was.** `docs/README.md`'s folder table classifies `prds/` and `sdds/` as received, and
`components/`, `entities/`, `actors/`, `business-rules/`, `deliverables/` and the design
slices as derived. It names neither `docs/user-experience/` nor the new `docs/product/` —
the first of which this spec already knew, since that absence is its worked `Convention`
example. So **seven of the eight in-scope evidence bodies have no recorded status**, and
"which side is received" is unanswerable for any finding drawn from them. The proportion got
worse rather than better while this spec was being reviewed: a second unregistered folder
arrived carrying two documents.

That is not academic, because the label is exactly what decides which document may change.
The sharpest case is the component gallery against `components/`: the register says a
component note is *derived* and says nothing at all about the gallery. Treating the gallery as
received because it happens to be newer would move the component note on the strength of an
assumption this spec had not noticed it was making.

So until the repository owner classifies **both** `docs/user-experience/` and `docs/product/`,
a finding drawn from any of those **seven** bodies carries its direction as **undetermined**,
says so in the ledger, and proposes no edit. Both folders, not one: classifying only the first
would leave the research synthesis able to move a derived note on the same unrecorded standing
this rule exists to refuse, and an earlier version of this sentence — written before
`docs/product/` existed — waited on one folder and covered five bodies. The classification is itself a `Convention` finding and a decision, and is listed with
the others below rather than taken here.

## Scope

**In**, on the evidence side, **eight distinct bodies rather than eight files** — the nesting
above means a file is not the unit. They are: the workspace PRD; the prototype
specification's own §§1–16; the UXD §§1–34; the wireframe appendix; the JTBD backlog; the
canvas concept's own §§1–783; the user research synthesis; and `component-gallery.html`, read
for component vocabulary **and for the behaviour it states**. Each is read once, at one location, whichever files repeat it. An earlier draft limited it to vocabulary while the `components/` comparison below
promised to catch "same name, different behaviour" — a promise nothing was allowed to feed.
The gallery carries invariants and emit-contracts in as many words, as `<dt>`/`<dd>` pairs:
*Invariant* — "exactly one button is active — no button can enforce this alone"; *Emits* —
"a retry request, in the error case only".

**In**, on the derived side: `requirements/` (121), `entities/` (34), `business-rules/` (27),
`components/` (17), `actors/` (8), `deliverables/` (5), `adrs/` (12), `issues/` (3) —
**227 notes, 11,342 lines** — the count moved when `db35815` added six lines to
`deliverables/MVP Prototype.md` linking the new research, which is the derived side of this
corpus changing under the pass and the reason the ledger re-measures rather than quotes.

**Out, deliberately:**

- **`docs/product/…-competitive-market-landscape.md`** (873 lines). It is evidence about
  *competitors*, not about this product's intended behaviour, so it cannot contradict a
  derived note — it can only suggest notes that do not exist yet, which is a backlog-growing
  pass and not a reconciliation. Excluded by decision rather than by oversight, and the
  ledger says so where a reader meets the coverage claim. Its sibling, the user research
  synthesis, is **in**: it is about this product's users, and it arrives in the pass whether
  or not it is named, since the canvas concept file contains it verbatim.

- **The 17 design slices in `tasks/`** (14,763 lines). They are SDD-derived architecture
  sitting one layer below this question, and whether any of them needs touching depends on
  how the user-facing spatial vocabulary resolves — the decision this ledger exists to put in
  front of a human. Sweeping them first means reading fourteen thousand lines to produce
  findings whose resolution is "depends". Named as a follow-on blocked on that decision, not
  as an oversight. *Which* slices are affected is an output of that decision; an earlier
  draft named 3, 5 and 8 without having read them.
- **The HTML concept pages beyond the component gallery**, and **the seventeen screenshots**.
  A screenshot is not something a note can be checked against.

## The instrument

The risk in a sweep this size is that "read one corpus against another" is a disposition
rather than a method, and a finding set assembled from what the reader happened to notice
cannot state its own coverage. So the comparison is built on an enumerable inventory —
**of two kinds, in two directions.**

### Two kinds of row, because nouns are not the requirement

A first draft inventoried only named *things*: concepts, screens, components. That instrument
cannot see a behavioural disagreement. It scores `Space` **present** — there is an entity
note — and thereby reports the spatial vocabulary reconciled, never noticing that the two
corpora do not mean the same thing by the word, nor that the workspace PRD's "start a project
without a plan" contradicts a Plan-editor Feature that assumes a plan exists. Every row
present, Definition of Done satisfied, the substantive clash unfound. So rows come in two
kinds:

- **Named things.** Presence is a lookup. **The rule, not a list: every derived note type
  the comparison table checks against named-thing rows has a producing extraction rule
  here.** Today that is concepts (→ `entities/`), screens and views (→ `requirements/`,
  `deliverables/`), components (→ `components/`), **actors and personas** (→ `actors/`), and
  **named artifacts** (→ `deliverables/`).

  Named artifacts are the second omission of this kind, and **the closure check did not catch
  it**, which is worth stating as a limit rather than leaving to be found again: `deliverables/`
  already had a producer — screens and views — so the pair counted as covered. An artifact is
  not a screen. Wireframes §A.23 requires a **Screen Component & Interaction State
  Specification**, and none of the five deliverable notes is one, so the gap is real and no
  forward row could have reached it. The check verifies that every consumer has *a* producer;
  it cannot verify that every kind of thing the evidence names has one.

  Personas are the omission that rule is written against. The comparison table has always
  checked `actors/` against named-thing rows while the extraction produced none, so all
  eight actor notes sat behind a coverage claim with nothing to compare them to. The new
  PRD's §6 names three personas — DIY Renovator, Advanced Renovator, Professional Planner —
  against the backlog's `Private renovator`, `Advanced DIY planner` and `Professional
  planner`. Two of the three share no name with their apparent counterpart and the third
  matches only if case is ignored, which is exactly the mix of rename, split and
  near-collision this row exists to catch and had no rows to catch it with.
- **Behavioural claims.** Presence is *does any derived note **address** this claim* — assert
  it, qualify it, or contradict it. **Silence is not presence.** A note saying nothing about the
  claim leaves the row for the ladder below: `absent` on a forward row, reported as a **Gap**;
  `retained` on a reverse one, reported as nothing. An earlier wording counted "ignore" as
  presence, which made a behavioural gap structurally unreportable — an evidence-only claim is
  precisely one the derived corpus ignores, so the single state it needed to reach was the one
  that definition denied it.

  **The rule, not a list: every behavioural claim in every in-scope evidence body becomes a
  row, wherever in that body it sits.** The table below says where the claims *concentrate*.
  It bounds nothing and is not an extraction list, and the column is titled so.

  That distinction is the fifth instance of this spec's recurring defect and the subtlest,
  because the previous fix looked complete. A draft listed four sources and omitted the
  wireframes; the fix replaced the list of *documents* with a rule about documents — and then
  re-enumerated *sections* inside the table cells, bounding the wireframes to §§A.17–A.21 and
  the prototype to its golden path and error contracts. The wireframes hold fourteen
  A-numbered screen sections before A.17, and the prototype's §§7–12 are its state, visual,
  interaction, routing, UI-state and accessibility contracts. **The enumeration moved down one
  level and survived**, under a rule written to abolish it.

  | Evidence body | Where its behavioural claims concentrate (not a boundary) |
  | --- | --- |
  | `prds/renovation-project-workspace.md` | User stories, functional and acceptance requirements, lifecycle rules |
  | `…-PROTOTYPE-DESIGN-SPEC.md`, §§1–16 only | Golden path, questions to answer, and the §§7–12 contracts: prototype state, visual, interaction, routing, required UI states, responsive and accessibility |
  | UXD §§1–34 (read once, at `…-UXD.md`) | Journeys, navigation model, next-best-action model, progressive disclosure, empty states, loading/validation/errors, destructive actions, cross-cutting interaction rules |
  | Wireframe appendix (read once, at `…-wireframes.md` §A.1 onward) | Every A-numbered screen section, each carrying its own states and rules — not only §§A.17–A.21's screen states, destructive-action pattern, responsive rules, keyboard/accessibility rules and golden-path acceptance criteria |
  | Canvas concept, §§1–783 (`…-canvas-concept-interaction-design.md`) | Canvas interaction model, tool and layer behaviour, calibration and measurement rules, and §20 Renovation Zones — the first new-evidence section to speak directly to `Zone`, so a cell where both sides speak |
  | User research synthesis (read once, at `product/…-user-research-synthesis.md`) | Segment definitions, problem clusters and the behaviours they assert users need |
  | `…-JTBD-research-backlog.md` | 63 job statements |
  | `concepts/component-gallery.html` | Component invariants and emit-contracts, as `<dt>`/`<dd>` pairs — e.g. *Invariant* "exactly one button is active — no button can enforce this alone", *Emits* "a retry request, in the error case only" |

### Two directions, because Orphan is otherwise undiscoverable

Every row in the first draft originated from the new evidence, which makes a backlog-only
concept structurally invisible: it has no row, and the reading is bounded to rows. The
`Orphan` category was therefore promised and unreachable — an instrument that cannot find
one of the four things it reports. So the inventory runs both ways:

- **Forward** — each item extracted from the new evidence, checked against the derived notes.
- **Reverse** — **every named thing and every behavioural claim in the 227-note scope gets a
  row**, checked against the new evidence: does it speak to this, supersede it, contradict
  it, or is it simply not about this layer? Orphans come from this pass and are counted like
  everything else.

  Stated as a rule over the whole scope rather than as a list of kinds, because the list form
  failed here: a draft enumerated Epics and Features and thereby dropped the 10 PBIs, the 17
  components and the 3 issues — 30 notes structurally invisible to the very pass added to make
  orphans discoverable.

  **The row is a claim, not a note**, which is the second correction this direction has needed
  and the deeper one. A note is a container: a Feature carries several acceptance criteria, a
  component note several states. One row per note yields one state per container, so evidence
  that addresses one claim and contradicts another scores the container *present* and the
  contradiction is never recorded — while a completeness check of 227 rows against 227 notes
  passes clean. The granularity of the two directions has to match, and forward rows were
  always per item.

  **The note count survives as a separate corpus-coverage check**, not as the completeness
  claim it cannot support: every one of the 227 notes must contribute at least one row, which
  is what "the whole corpus was read" actually means. One number cannot carry both jobs.

### Every in-scope note type has a comparison rule

**Every note type consumes behavioural rows, because every note type carries rules.**
`entities/Space.md` states "carries no geometry" and "existing without any planned work … must
stay expressible"; component notes carry states and contracts; an ADR is a decision, which is
a behavioural claim about the product. An earlier version compared `entities/` against
named-thing rows only and `components/` against the gallery's behaviour only, so a per-claim
reverse row for one of those rules had no cell it could ever become a contradiction in — the
reverse pass produced the row and the matrix had nowhere to put it.

Named-thing rows are consumed by the five types that hold named things, which is not
symmetry-for-its-own-sake: a business rule, an ADR and an issue are not things the evidence
*names*, so pairing them with named-thing rows would invent a consumer no producer could feed
— the defect the closure check exists to catch, introduced by over-correcting for this one.

The scope claims 227 notes, so all 227 need a rule saying what they are compared against.
Naming only `entities/`, `components/` and `requirements/` would have left 55 notes —
business rules, actors, deliverables, ADRs, issues — unread beneath a coverage claim that
included them.

| Derived notes | Compared against | Looking for |
| --- | --- | --- |
| `entities/` (34) | Both kinds | A concept with no entity note; an entity the new model renames, splits or absorbs |
| `components/` (17) | Both kinds |  A component named in one and not the other; same name, different behaviour — the second half needs the behavioural rows, and admitting the gallery to the scope without adding it here would have left this row exactly as unfeedable as before |
| `requirements/` (121) | Both kinds | A requirement the new evidence contradicts; a claim with no Feature or PBI behind it; **a screen the new evidence names with no Feature or PBI behind it**. `Project Home` is the worked example, and against behavioural rows alone it had no cell that could ever become a `Gap` |
| `business-rules/` (27) | Behavioural rows | A rule the new evidence violates or supersedes |
| `actors/` (8) | Both kinds | An actor the UX layer introduces, renames or stops needing; a standing or capability the new evidence changes |
| `deliverables/` (5) | Both kinds | Design System, Sitemap, Information Architecture, Disclosure ladder and MVP Prototype are *about* this UX layer, so they are the likeliest and most consequential disagreements |
| `adrs/` (12) | Behavioural rows | A recorded decision the new evidence contradicts. Silence here is `Retained`, never `Orphan` — see the states below |
| `issues/` (3) | Behavioural rows | An open question the new evidence answers, or reopens |

### The order

1. **Extract named things** from the new evidence, under the producing rules above, and settle
   their presence — a lookup, and the only wholly mechanical part of this pass.
2. **Record the aliases that lookup exposes.** `Space` against `Outdoor area`, DIY Renovator
   against `Private renovator`: the vocabulary collapses this pass exists to find are also the
   normalisation the behavioural matcher needs, so they are produced before it runs rather than
   improvised inside it.
3. **Extract behavioural claims**, and **build the reverse inventory** from the derived corpus,
   **per claim rather than per note**.
4. **Match behavioural claims in two stages**, per the rule below — only the first is
   mechanical.
5. **Resolve every row through the five-state ladder**, in both directions.
6. **Derive the finding set from the matrix**, so absence is *counted* rather than spotted, and
   **coalesce mirrored rows** per the identity rule below.
7. **Read for contradiction only in cells where both sides speak.** Judgement, bounded to the
   cells the matrix identified rather than applied to the whole corpus.
8. **Run the convention audit separately**, against the register's own documents, and report it
   apart from the matrix counts — it is not derived from them and must not borrow their
   completeness.

#### Matching a behavioural claim is two stages, and only the first is mechanical

Presence for a **named thing** is a lookup: the name is in the corpus or it is not, and a
command settles it. Presence for a **behavioural claim** is not, because the two corpora can
state the same obligation in different words and no lookup decides whether they are the same
obligation. An earlier version of this section said *absence is mechanical, in both directions*
across both row kinds — true of one kind and asserted of two, which is the defect this document
keeps producing, this time in the sentence describing its own mechanism.

So the match runs in two stages and the ledger reports them separately:

- **Candidate set — mechanical, reproducible by command.** A claim's *subject terms* are the
  entity, screen, component and actor names it mentions, normalised by case-folding,
  singular/plural, and the alias table from step 2. The candidate set is every derived note
  mentioning any of them. Its size is recorded on the row and the command that produced it goes
  in the ledger.
- **Match — judged, bounded to that set.** Within the candidate set only, decide whether any
  note addresses the claim. The row records which note, or none.

What this buys and what it does not: a reader can re-run the first stage exactly and re-check
the second within a bounded set rather than re-reading 227 notes. It does **not** make the match
reproducible — two careful readers may still differ inside a candidate set. The one case where
the mechanical half carries the whole answer is a claim whose subject terms are absent from the
derived corpus entirely: the candidate set is empty, and the row lands at `absent` with no
judgement involved.

#### One disagreement is one finding, however many rows found it

A disagreement between an evidence claim and a derived claim produces **two** rows — forward for
the evidence item, reverse for the derived claim — and running the ladder on both emits the same
finding twice. Left undefined, the finding total depends on whether whoever wrote the ledger
happened to merge them.

**Pair identity is the ordered pair of citations**: evidence body and section on one side, note
and claim on the other. Two rows resolving to `contradictory` or `superseded` over the same pair
are **one finding**. So the ledger reports **rows and findings as separate counts**, which are
not expected to match: the difference between them is exactly the number of mirrored
disagreements, and that number is worth printing rather than hiding.

`Gap` cannot mirror — it has no derived claim to pair with, which is what makes it a gap.
`Contradiction` and `Orphan` both have two speaking sides, so both coalesce; `retained` is not a
finding and never reaches this step.

## The ledger

`docs/reviews/2026-08-24-ux-layer-backlog-reconciliation.md`, following the shape the two
existing ledgers set: narrative, naming its instrument and its counts, findings grouped by
cluster rather than listed flat.

**Two deviations from that shape, stated in the ledger's own opening rather than left to be
inferred:**

- Both existing ledgers open with "All findings below are fixed." **This one is written
  before any fix**, because the work was scoped findings-first deliberately.
- It states its own coverage limits — the slices, the HTML, the screenshots — where a reader
  meets them, rather than letting "reconciled" read wider than it is.

Every finding states the standing of each side — **received, derived, or undetermined** —
since that decides what may change, and a reader must be able to check it against
`docs/README.md` without trusting the ledger. `undetermined` is not a hedge: it is the honest
answer for the seven evidence bodies the register does not classify, and a finding carrying it
proposes no edit. An earlier draft offered only received-or-derived, which would have made the
ledger assert a standing the register never granted.

What "checkable" means depends on the kind — a first draft required **both** sides by file and
section, which is unsatisfiable for a `Gap`, since a gap has no derived note to cite. That
rule would have forced the ledger to drop valid findings or invent locations for them.

- **A disagreement** (`Contradiction`) cites both sides by file and section.
- **A supersession** (`Orphan`) cites both sides too: the derived note, and the passage that
  supersedes it. Requiring the second citation is what keeps `Orphan` distinct from
  `Retained` — an orphan that cannot name what replaced it is a retained note.
- **An absence** (`Gap`) cites the side that exists by file and section, plus **the corpus
  that was searched and the command that reproduces the absence** — so a reader can re-run it
  rather than take the word for it.

### Finding kinds

Ordered by consequence, not by effort:

| Kind | Means |
| --- | --- |
| **Contradiction** | Both sides speak and disagree. Worst: one of them is misleading a reader today. |
| **Gap** | The new evidence names something with no note behind it. |
| **Orphan** | The backlog holds something the new evidence **supersedes**. Requires a citable passage that supersedes it — silence alone is `Retained`. |
| **Retained** | The backlog holds something the new evidence is simply not about. |

**Supersession is a state of its own, checked before contradiction.** A supersession
satisfies both definitions above at once — both sides speak and disagree, *and* the backlog
claim is superseded — so with no exclusive state the same row could be counted a
`Contradiction` by one reading and an `Orphan` by another, which a ledger promising
reproducible counts cannot afford. The matrix therefore carries **five** states —
`present`, `absent`, `contradictory`, `superseded`, `retained` — resolved in a fixed order so
every row lands in exactly one. The ladder is the same in both directions; only its last rung
differs, because a row with one silent side means opposite things depending on which side
spoke:

1. Does the evidence explicitly supersede the derived claim, in a passage that can be cited?
   → `superseded`, reported as an **Orphan**.
2. Otherwise, do both sides speak and disagree? → `contradictory`, reported as a
   **Contradiction**.
3. Otherwise, do both sides speak and agree? → `present`, reported as nothing.
4. Otherwise exactly one side spoke, and the direction decides what that means:
   - a **forward** row — the evidence names it and no derived note answers → `absent`,
     reported as a **Gap**;
   - a **reverse** row — a derived claim the evidence is simply not about → `retained`,
     reported as nothing.

An earlier version of this ladder had three rungs for five states, listing only supersession,
contradiction and retention. A matching pair that agreed never reached `present` and an
unmatched forward claim never reached `absent`, while definition-of-done item 1 demanded that
every row hold exactly one of the five. Adding a state without extending the ladder that
assigns it is a consumer with no producer, one layer down from where the closure check
looks.

`Retained` is not a finding and not a defect; it is the state the reverse pass needs so that
silence stops manufacturing orphans. The UX layer is additive and never mentions Vue — the
word appears in **zero** of the in-scope evidence documents — so under "supersedes *or
ignores*", ADR-004 (*Vue 3 for Plugin UI*) would have been reported as superseded by four
documents that do not discuss the plugin's UI framework at all. It also reconciles the
`adrs/` rule above, which looks only for contradiction and would have disagreed with the
`Orphan` definition on the same twelve notes.

**`Convention` is a separate audit, and the ledger says so.** The register's own rules are
real findings — `user-experience/`, `product/` and `templates/` are absent from `docs/README.md`'s folder
table, which claims to name every folder so the first note of a kind "has somewhere obvious to
go" — and they **cannot come from the matrix**: `docs/README.md` is neither in-scope evidence
nor one of the 227 derived notes, so no row in either direction can produce one. Listing it
beside three matrix-derived kinds implied a mechanism it never had, and left the worked
example above underivable by the very method stated to derive it. It is therefore a named
third input with its own rule — **the register's own documents (`docs/README.md`,
`templates/`) checked against the folders and note types that actually exist** — reported in
its own section and excluded from the matrix counts, so neither claim borrows the other's
completeness.

### Findings that need a decision

A separate section, and not a severity. Each finding here carries its options and a
recommendation; none is resolved unilaterally, and the ledger says so where they are listed.

**The rule for membership, rather than a list of members: a finding whose resolution changes
the domain model, changes what a user-facing word means, or changes which documents may be
edited, is a decision and is listed rather than settled.** The third clause was missing, and
its absence is what let the register-classification question below go unasked for four
revisions. Which findings meet the rule is otherwise an output of the pass — naming a certain
member in advance is how an earlier draft of this section acquired its worst claim.

One member is already established rather than predicted, because checking the register
produced it: **neither `docs/user-experience/` nor `docs/product/` has a recorded status.**
The options are that they are received evidence like `prds/`, that they are derived and
therefore editable like `components/`, or that they split — the PRD-adjacent documents
received, the concept HTML and the research derived. Each answer moves a different document
when a finding sets the gallery against a component note, which is why it is listed and not
chosen here. Two folders now, not one: `docs/product/` arrived during this review carrying a
user research synthesis and a market landscape, and the register does not name it either.

The *shape* of the likeliest one can be stated in advance, because the backlog's position is
already on record and the decision is narrower than it looks. `entities/Space.md` and
`entities/Zone.md` each carry an explicit *Space versus Zone* section sourced to PRD §6, §34,
§58 and §60: a space is a place in the building, a zone is a place with geometry that planning
attaches to, and §34 keeps them in separate branches so that *this room is untouched* stays
expressible. The new PRD does not contest it — §8 states that navigation "shall represent user
concerns rather than technical domain entities" and that "the exact naming may evolve through
UX validation."

So the open question is not *what is Space*; received evidence answered that. It is whether
the new evidence's umbrella use of the word should change the **user-facing** vocabulary over
an unchanged domain model, and if so where the umbrella's members are separated for the user.
That is a naming decision with a settled domain model underneath it — still a product
decision, and still not mine.

## Definition of done

1. Every inventory item, **in both directions and of both row kinds**, has a matrix row
   carrying **exactly one** of the five states — present, absent, contradictory, superseded or
   retained — resolved by the precedence above, and the ledger reports the counts rather than
   describing them. **Rows and findings are counted separately and both printed**, because a
   mirrored disagreement is two rows and one finding; the gap between the totals is the number
   of coalesced pairs, which is information rather than an error to hide.
1a. Every one of the eight in-scope note types has been compared under its rule, and the
   ledger says how many notes of each type were covered. A type with no rule is a type that
   was not read, and a coverage claim including it would be false.
1b. **Every one of the 227 in-scope notes contributed at least one reverse row, and the
   ledger prints the number of notes reached beside 227.** This is the check that catches the
   failure this spec produced three times: an enumeration that silently omits a member.
   `requirements/` is 19 Epics + 92 Features + 10 PBIs; a reverse pass over "Epics and
   Features" scores 111 and reads as complete. Comparing two numbers is something a reader can
   do without trusting any list.

   It is a **corpus-coverage** check and is labelled as one. It proves every note was read and
   deliberately proves nothing about whether every claim inside them got a row — that is what
   row-per-claim is for. An earlier draft made one number carry both jobs, and the
   container-level version would have passed while a contradicted claim inside a Feature went
   unrecorded.
1c. Every in-scope evidence body appears in the behavioural-rows table, and **the ledger
   reports, per body, the sections it swept beside the sections that body contains** — two
   lists a reader can set side by side. "Contributes some rows" was the weaker version, and it
   is what let the table bound the wireframe appendix to five of its twenty-three sections and
   the prototype to two of its sixteen while still passing.
1d. **The instrument is closed, and the ledger prints the two numbers that show it: every
   (note type × row kind) pair the comparison table names has a producing extraction rule,
   and every finding kind names the corpus it is derived from.** Review found four holes
   behind the earlier version of this instrument and all four were one shape — a consumer
   expecting rows no producer emitted. `actors/` was compared against named-thing rows that
   nothing produced; `requirements/` could not receive a screen row, so the spec's own
   `Project Home` example had no cell; `components/` promised a behavioural comparison the
   gallery was barred from feeding; `Convention` was derived from a corpus in neither
   inventory. Patching the four instances is what this spec did three times already, each fix
   producing the next one. Two numbers is what makes the fifth hole fail loudly instead of
   reading as coverage.

   **As this spec now stands it closes**, which is checkable from the tables above: the
   comparison table has **5** note types consuming named-thing rows and the extraction rule
   names **5** targets (`entities/`, `requirements/`, `deliverables/`, `components/`,
   `actors/`); it has **8** consuming behavioural rows — every note type, since every note type
   carries rules — fed by the pool the behavioural-rows
   table builds from all **8** in-scope evidence bodies; and all **4** finding kinds —
   `Contradiction`, `Gap`, `Orphan` and `Convention` — name the corpus they come from, the
   last by pointing outside the matrix entirely.

   `Retained` is deliberately not in that count: it is a state the reverse pass records, not a
   finding, and this page says so where it is defined. An earlier version of this sentence
   said **5**, having counted the kinds table's four rows plus `Convention` — so the one
   number offered as the *proof* of closure was itself unreproducible against the page
   printing it. A count a reader is told to check has to survive their checking it.

   The fifth hole was real and this check is how it was found. Admitting the gallery's
   behaviour to the scope, adding it to the evidence table and leaving `components/` consuming
   named-thing rows only would have fixed the two visible halves and left the row as unfeedable
   as the review found it — a fix that satisfies the demonstrated instance and not the
   property, which is the failure mode this document has now hit four times.
2. Every finding is checkable on the terms above: both sides for a disagreement or a
   supersession, the extant side plus a reproducible absence check for a gap.
3. Decision-needing findings are listed apart, with options and a recommendation, and none is
   settled in this pass.
4. The coverage limits above appear in the ledger.
5. `npm run check` shows **no failure this pass introduced**. It cannot be required to pass
   outright, because `main` is red today, before any of this work — and redder than an
   earlier draft of this item recorded. `npm run check` stops at its first failing step, so
   it can only ever show one; run individually, **all four of its steps fail**:

   | Step | Fails with |
   | --- | --- |
   | `build` | `vue-tsc` rejects `src/infrastructure/obsidian/repositories/ObsidianPlanRepository.ts:113` — `Result<never, ValidationError>` where `Promise<Result<Loaded<Plan>, …>>` is declared: the method is not `async`, so the early `return err(conflict)` is a bare `Result` while the two tail returns are genuine Promises |
   | `lint` | 27 errors across 7 files, all under `tests/` — mostly `no-use-before-define`, plus `import(no-duplicates)` |
   | `test:coverage` | a **parse error**: `tests/infrastructure/obsidian/repositories/digest.test.ts:23` reads `Object.entries(base)undefined)` — a stray token where `)` belongs. 477 tests pass; that one file never transforms |
   | `analyze` | 25 dead-code issues, 3 clone groups, 2 files above the health threshold — measured with coverage artefacts present. `fallow` reads `coverage/coverage-final.json`, so it is downstream of `test:coverage`: after that step fails there is no coverage file and `analyze` cannot run at all |

   **Every failing file in all four steps traces to `5c85a26`**, a commit titled *"move
   concept files into ux folder, add prototype spec"* that also added 104 files of slice-4
   implementation — checked by intersecting the failing paths with that commit's file list,
   7 of 7. CI never ran on it alone, so the failure first *surfaced* on the next docs-only
   commit (`7b53c6e`) and the run history attributes it to three documentation pushes, which
   is most likely why it has stayed red across four commits without being noticed. Run 108
   (`d79e996`) was the last green one.

   None of it is this pass's to fix. What makes item 5 checkable rather than a promise is the
   baseline: stash this branch's single document, re-run, compare. `analyze` output is
   byte-identical with the change and without, and `lint` reports **the same 27 errors across
   the same 7 files** — which is the only form of "introduced nothing" a reader can verify.

   Compare `lint` **sorted**. Its output order is not deterministic — oxlint walks files in
   parallel, so the same 27 errors arrive in different sequence between runs, and a plain
   `diff` of two identical results can show a moved line. An earlier version of this item said
   `lint` was byte-identical; that was true of the runs it had seen and not a property of the
   tool, which is the same defect as any other claim wider than its mechanism, in the sentence
   describing how the mechanism works. Writing "the gate passes" into a definition of done while the
   gate is red would be the defect this repository's own guide names first: write the
   guarantee to the check, never ahead of it.
6. **No derived note is edited.** The ledger is the whole deliverable; fixing is a separate
   piece of work, separately approved.

## What this deliberately does not do

It does not fix anything. It does not create Epics, Features or PBIs from the new PRD. It
does not decide the spatial model. Each of those is a follow-on that this ledger is meant to
make answerable, and any of them started here would be a second piece of work smuggled into
the first — with the added defect that the decision underneath them would have been made by
whoever happened to be typing.
