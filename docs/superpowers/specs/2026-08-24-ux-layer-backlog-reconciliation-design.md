# Reconciling the UX layer with the backlog — design

**Date:** 2026-08-24
**Status:** Approved, not yet executed
**Output:** one findings ledger in `docs/reviews/`. No derived note is edited by this work.

## Why

`main` gained a user-experience layer written after the backlog it describes: a second PRD
(`docs/prds/renovation-project-workspace.md`, 1,451 lines) and four documents under
`docs/user-experience/` — a prototype design specification (1,432), wireframes (1,143), a
UX journey and interaction design document (682) and a JTBD research backlog (424) — plus
HTML concept pages and seventeen screenshots.

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

The **direction is already settled by the register's own rules.** Both PRDs sit in
`docs/prds/`, which `docs/README.md` defines as received evidence kept verbatim — "corrected
only by receiving a new one". Reconciliation can therefore only ever change *derived*
documents. The backlog moves; the PRDs do not. No question needs to be asked about this and
none is.

## Scope

**In**, on the evidence side: the workspace PRD, all four `docs/user-experience/` documents,
and `component-gallery.html` read for component vocabulary only.

**In**, on the derived side: `requirements/` (121), `entities/` (34), `business-rules/` (27),
`components/` (17), `actors/` (8), `deliverables/` (5), `adrs/` (12), `issues/` (3) —
**227 notes, 11,336 lines.**

**Out, deliberately:**

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

- **Named things.** Concepts, screens and views, components. Presence is a lookup.
- **Behavioural claims.** Presence is "does any derived note assert, contradict, or ignore
  this claim."

  **The rule, not a list: every in-scope evidence document contributes behavioural rows,
  and a document contributing none must say why.** A first draft listed four sources and
  omitted the wireframes — 1,143 lines whose §§A.17–A.21 are Screen States, Destructive
  Interaction Pattern, Responsive Rules, Keyboard and Accessibility Rules, and Golden-Path
  Acceptance Criteria, which is to say the densest concentration of behavioural rules in the
  corpus. The table below exists so that omission is visible rather than inferred:

  | Evidence document | Behavioural rows it contributes |
  | --- | --- |
  | `prds/renovation-project-workspace.md` | User stories, functional and acceptance requirements, lifecycle rules |
  | `user-experience/…-UXD.md` | Interaction rules, journey steps, progressive-disclosure and continuity rules, accessibility rules |
  | `user-experience/…-wireframes.md` | §§A.17–A.21: screen states, destructive-action pattern, responsive rules, keyboard/accessibility rules, golden-path acceptance criteria |
  | `user-experience/…-PROTOTYPE-DESIGN-SPEC.md` | Golden path, error contracts, the questions the prototype must answer |
  | `user-experience/…-JTBD-research-backlog.md` | 63 job statements |
  | `concepts/component-gallery.html` | None — named-thing rows only, per the coverage limit above |

### Two directions, because Orphan is otherwise undiscoverable

Every row in the first draft originated from the new evidence, which makes a backlog-only
concept structurally invisible: it has no row, and the reading is bounded to rows. The
`Orphan` category was therefore promised and unreachable — an instrument that cannot find
one of the four things it reports. So the inventory runs both ways:

- **Forward** — each item extracted from the new evidence, checked against the derived notes.
- **Reverse** — **every note in the 227-note scope gets a row**, checked against the new
  evidence: does it speak to this, contradict it, or ignore it? Orphans come from this pass
  and are counted like everything else.

  Stated as a rule over the whole scope rather than as a list of kinds, because the list
  form failed here too: a draft enumerated Epics and Features and thereby dropped the 10
  PBIs, the 17 components and the 3 issues — 30 notes structurally invisible to the very
  pass added to make orphans discoverable. The reverse row count must equal the scope count,
  which is a check anyone can run; a list of kinds is a claim nobody can.

### Every in-scope note type has a comparison rule

The scope claims 227 notes, so all 227 need a rule saying what they are compared against.
Naming only `entities/`, `components/` and `requirements/` would have left 55 notes —
business rules, actors, deliverables, ADRs, issues — unread beneath a coverage claim that
included them.

| Derived notes | Compared against | Looking for |
| --- | --- | --- |
| `entities/` (34) | Named-thing rows | A concept with no entity note; an entity the new model renames, splits or absorbs |
| `components/` (17) | Named-thing rows, from the gallery | A component named in one and not the other; same name, different behaviour |
| `requirements/` (121) | Behavioural rows | A requirement the new evidence contradicts; a claim with no Feature or PBI behind it |
| `business-rules/` (27) | Behavioural rows | A rule the new evidence violates or supersedes |
| `actors/` (8) | Named-thing rows | An actor the UX layer introduces, renames or stops needing |
| `deliverables/` (5) | Both kinds | Design System, Sitemap, Information Architecture, Disclosure ladder and MVP Prototype are *about* this UX layer, so they are the likeliest and most consequential disagreements |
| `adrs/` (12) | Behavioural rows | A recorded decision the new evidence contradicts |
| `issues/` (3) | Behavioural rows | An open question the new evidence answers, or reopens |

### The order

1. **Extract** both row kinds from the new evidence.
2. **Build the reverse inventory** from the derived corpus.
3. **Establish presence mechanically** in both directions, per the table above.
4. **Derive the finding set from the resulting matrix**, so absence is *counted* rather than
   spotted, in both directions.
5. **Read for contradiction only in cells where both sides speak.** This part is judgement,
   and it is bounded to cells the matrix identified rather than applied to the whole corpus.

Absence is mechanical, in both directions. Contradiction is read, but only where reading is
warranted.

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

Every finding says which side is received and which is derived, since that already decides
what may change, and a reader must be able to check it without trusting the ledger. What
"checkable" means depends on whether the finding is a disagreement or an absence — a first draft
required **both** sides by file and section, which is unsatisfiable for exactly the two
kinds that matter most: a `Gap` has no derived note to cite, and an `Orphan` the evidence
ignores has no received section. That rule would have forced the ledger to drop valid
findings or invent locations for them.

- **A disagreement** (`Contradiction`) cites both sides by file and section.
- **An absence** (`Gap`, `Orphan`) cites the side that exists by file and section, plus **the
  corpus that was searched and the command that reproduces the absence** — so a reader can
  re-run it rather than take the word for it.

### Finding kinds

Ordered by consequence, not by effort:

| Kind | Means |
| --- | --- |
| **Contradiction** | Both sides speak and disagree. Worst: one of them is misleading a reader today. |
| **Gap** | The new evidence names something with no note behind it. |
| **Orphan** | The backlog holds something the new evidence supersedes or ignores. |
| **Convention** | The register's own rules — e.g. `user-experience/` and `templates/` are absent from `docs/README.md`'s folder table, which claims to name every folder so the first note of a kind "has somewhere obvious to go". |

### Findings that need a decision

A separate section, and not a severity. Each finding here carries its options and a
recommendation; none is resolved unilaterally, and the ledger says so where they are listed.

**The rule for membership, rather than a list of members: a finding whose resolution changes
the domain model, or changes what a user-facing word means, is a product decision and is
listed rather than settled.** Which findings meet it is an output of the pass — naming a
certain member in advance is how an earlier draft of this section acquired its worst claim.

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
   carrying a state — present, absent, or contradictory — and the ledger reports the counts
   rather than describing them.
1a. Every one of the eight in-scope note types has been compared under its rule, and the
   ledger says how many notes of each type were covered. A type with no rule is a type that
   was not read, and a coverage claim including it would be false.
1b. **The reverse-inventory row count equals the scope count (227), and the ledger prints
   both.** This is the check that catches the failure this spec produced three times: an
   enumeration that silently omits a member. `requirements/` is 19 Epics + 92 Features +
   10 PBIs; a reverse pass over "Epics and Features" scores 111 and reads as complete.
   Comparing two numbers is something a reader can do without trusting any list.
1c. Every in-scope evidence document appears in the behavioural-rows table with either rows
   or a stated reason for none.
2. Every finding is checkable on the terms above: both sides for a disagreement, the extant
   side plus a reproducible absence check for a gap or an orphan.
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
   | `analyze` | 25 dead-code issues, 3 clone groups, 2 files above the health threshold |

   **Every failing file in all four steps traces to `5c85a26`**, a commit titled *"move
   concept files into ux folder, add prototype spec"* that also added 104 files of slice-4
   implementation — checked by intersecting the failing paths with that commit's file list,
   7 of 7. CI never ran on it alone, so the failure first *surfaced* on the next docs-only
   commit (`7b53c6e`) and the run history attributes it to three documentation pushes, which
   is most likely why it has stayed red across four commits without being noticed. Run 108
   (`d79e996`) was the last green one.

   None of it is this pass's to fix. What makes item 5 checkable rather than a promise is the
   baseline: stash this branch's single document, re-run, compare. `lint` and `analyze` output
   is **byte-identical** with the change and without — which is the only form of "introduced
   nothing" a reader can verify. Writing "the gate passes" into a definition of done while the
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
