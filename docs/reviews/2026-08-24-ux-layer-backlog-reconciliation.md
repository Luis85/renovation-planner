# Review: the UX layer against the backlog it describes

Reviewed 2026-08-24 on branch `claude/obsidian-renovation-planner-prd-r41jx7`. Its subject is
the eight-body **user-experience layer** `main` gained after the backlog was written — a second
PRD, a prototype specification, a UX journey document, a wireframe appendix, a JTBD backlog, a
canvas concept, a user research synthesis and a component gallery — read against all **227**
derived notes in `requirements/`, `entities/`, `business-rules/`, `components/`, `actors/`,
`deliverables/`, `adrs/` and `issues/`.

The method is [`docs/superpowers/specs/2026-08-24-ux-layer-backlog-reconciliation-design.md`](../superpowers/specs/2026-08-24-ux-layer-backlog-reconciliation-design.md),
frozen before execution.

**Two deviations from the shape the other two ledgers in this folder set, stated here rather
than left to be noticed:**

- Both of those open with "All findings below are fixed." **Nothing below is fixed.** This work
  was scoped findings-first on purpose: the pass reads two corpora against each other and
  produces the disagreements; deciding what to do about them is separate work, separately
  approved. **The reconciliation edited no derived note**; four were edited afterwards, under the
  multi-project decision and only under it — the check is in the last section.
- It states its own coverage limits where a reader meets them, and its instrument's limits
  beside the numbers those limits qualify, rather than letting "reconciled" read wider than it is.

`npm run check` passes all four steps.

## What was found

**45 contradictions, 759 gaps, 0 orphans, and 4 convention findings.** The contradictions are
the useful half, and they concentrate rather than scatter — seven themed clusters carry 29 of
the 45, and `deliverables/Disclosure ladder.md` alone accounts for 6.

The single most contradicted document in the backlog is **`deliverables/Disclosure ladder.md`**,
with 6 of the 45. Beside those — and **not** among them, because no row in this instrument runs
between two derived notes — it also disagrees with a sibling about whether costing requires a
drawn plan: its own *What is open* admits rung 1 "forbids" pricing before drawing, while
`requirements/Start a renovation project.md` creates no `Plans/` folder until something is drawn.
Cluster E quotes both and says why the matrix cannot count it.

**No orphans at all.** Across 3,072 rows and eight evidence bodies, not one passage *replaces*
a derived claim rather than merely disagreeing with it. That is a result, not an absence: the
UX layer contradicts the backlog in 45 places and supersedes it nowhere.

**And not one derived note has drifted.** 13 of the 45 contradictions come from evidence whose
standing the register records; each of those 13 was traced back to the sections of the *original*
PRD and SDD that its derived note cites, and all 13 read faithfully — the note asserts what its
source asserts. **No contradiction in this ledger authorises correcting the backlog on its own.**
Every traced one is a received document disagreeing with a received document, which is a choice a
person makes, not an error a reconciler repairs. The other 32 come from the two folders the
register does not classify and cannot be traced until decision 1 is taken. `provenance.tsv` holds
the 13 verdicts with the sections each was read against.

## The counts

Rows and findings are different things and are counted separately.

| | |
| --- | --- |
| matrix rows | **3,072** |
| ├ forward, named | 493 |
| ├ forward, behavioural | 907 |
| ├ reverse, named | 185 |
| └ reverse, behavioural | 1,487 |
| **rows by state** | |
| `retained` | 1,124 |
| `present` | 1,144 |
| `absent` | 759 |
| `contradictory` | 45 |
| `superseded` | **0** |
| **findings** | |
| Contradiction | **45** |
| Gap | **759** |
| Orphan | **0** |
| Convention (separate audit, outside the matrix) | **4** |

**The coalesced-pair count is 0, counted directly.** 45 disagreement rows resolve to 45
findings. It was 1 until review checked the pair that produced it: `r519`'s `pair` field had been
copied from `f494` instead of built from its own citations, which made two different pairs
byte-identical and coalesced two findings into one — the twelfth correction below. The count is
still reached by identifying pairs and checking them, never by subtracting findings from rows:
1,130 `present` and 1,124 `retained` rows raise the row total while producing no finding, so that
subtraction would overstate coalescing by 2,249.

Every row carries exactly one of the five states; none is blank and none is outside the
vocabulary.

## Coverage

**Every one of the 227 notes contributed at least one reverse row, and at least one reverse
*behavioural* row.** Two numbers, because one cannot carry both jobs — reverse *named* rows
exist for only the five note types that hold named things, so a single count would have read
185 and looked like a gap.

| note type | notes | covered |
| --- | --- | --- |
| `requirements/` | 121 | 121 |
| `entities/` | 34 | 34 |
| `business-rules/` | 27 | 27 |
| `components/` | 17 | 17 |
| `adrs/` | 12 | 12 |
| `actors/` | 8 | 8 |
| `deliverables/` | 5 | 5 |
| `issues/` | 3 | 3 |

All eight evidence bodies contributed forward rows: prd 430, canvas 197, prototype 177, uxd 170,
wireframes 147, jtbd 95, research 120, gallery 64.

### Sections swept, beside sections contained — with the instrument's limits

**Measured, at one unit, by a committed instrument.** Both columns count **top-level numbered
sections**: what the body's headings declare, against what appears in a forward row's `source`.
An earlier version of this table mixed two units inside one row — `contains` counted subsection
headings, `swept` counted distinct source strings — and got `prd` and `research` wrong in the
flattering direction. The instrument is
[`sections.py`](2026-08-24-ux-layer-backlog-reconciliation/sections.py); `--selftest` checks its
heading reader against a second implementation in shell and against three counts pinned by hand,
because the bodies do not share a heading level (prd, uxd and research number at `#`, canvas,
prototype and wireframes at `##`) and any route that fixes a level measures a subset and reports
it as the whole.

| body | swept | contains | not swept |
| --- | --- | --- | --- |
| prototype | 16 | 16 | — |
| wireframes | 22 | 23 | §A.22 |
| canvas | 37 | 38 | §35 |
| prd | 38 | 39 | §37 |
| uxd | 31 | 34 | §1, §31, §33 |
| research | 24 | 33 | §2, §3, §5, §20, §26, §27, §28, §29, §32 |
| gallery | — | — | see limit below |
| jtbd | — | — | see limit below |

The boundary the extractors applied, stated as the rule rather than as the list it produced:
**a statement whose subject is the product's behaviour and whose mood is assertive is a claim; a
statement asking whether something works, or naming a hypothesis to validate, is not.** Four
extractors reached it independently.

Every unswept section above, against that rule — the list is accounted for in full, because an
enumeration that quietly drops a member is the defect this ledger is most prone to:

- **Open questions.** `wireframes§A.22` "Design Questions to Validate", `canvas§35` "Prototype
  Questions", `prd§37` "Open Product Questions", `uxd§31`, and research §32, whose eight items
  are all interrogative.
- **Research methodology.** research §2 "Research Method", §3 "Key Research Sources", and
  §§26–29 — interview prompts, behaviours to observe, sampling and the artifact model.
- **Framing that indexes swept content.** research §5 is eleven one-line problem statements with
  "the following sections examine these in detail" under them, and §§6–19 are all swept; `uxd§1`
  is the document's purpose, indexing what it goes on to define. **`uxd§4` was listed here too
  and did not belong** — see the twentieth correction; it is now swept.
- **Not about this product.** research §20 is a friction matrix whose subject is Excel, Notion,
  Trello and paper.
- **`uxd§33` — the document's own definition of done.** Its subject is the document rather than
  the product.

**`research §33` was listed here and did not belong** — see the twenty-fifth correction; it is now
swept, and it is the second entry this accounting has lost to review. The paragraph conceded the
section "does assert" and excluded it anyway on two further grounds, and both fail against this
ledger's own precedent: that it summarises swept sections is not a reason, because the rule counts
by pair and duplicated claims from distinct passages are counted separately elsewhere (`c50`
against `c42` is the worked example); and that its last line calls itself a hypothesis does not
reach the assertive sentences above that line.

**A swept section is not a fully-read section, and this table cannot tell the difference.** It
measures *reach* — did anything come out of this section — not *depth*. Research §21 is the
worked example and the reason the caveat is here rather than implied: it was counted swept on
three rows, and it holds 23 consolidated user wishes. The other 20 were recovered in a late pass
and are in the counts above. Nothing in this instrument would have found that; a reader who wants
depth has to read a section against its rows.

**Two rows of that table have no number, and the ratio is withheld rather than invented.** `jtbd`
numbers its content `JTBD-001`…`JTBD-063` rather than `§N`, so a section counter reads 0 against a
body that *was* swept, producing 95 forward rows — all 63 job statements were counted and match
the document's own claim of 63. `gallery` is HTML, so its "sections" are `<h2>`/`<h3>` headings,
a different unit from a numbered section: it holds 23 of them and produced rows under 21 distinct
labels. Those two numbers are not a coverage ratio and are not offered as one — the labels are
PascalCase component ids (`SnapGuide`, `ViewShell`) and the headings are sentence-case prose, so
they do not join by name; normalising case and spacing still leaves four headings and two labels
unmatched. What is checkable is that all 17 component notes were reached from the reverse
direction, which is the row of the coverage table above.

## The corpus, and what it does not include

The evidence is **eight bodies, not eight files**, because the files nest — three times over,
and the third arrived while this pass was running:

```text
PROTOTYPE-DESIGN-SPEC.md      §§1–16 of its own, then the whole wireframes file
  └── wireframes.md             UXD §§1–34, then Appendix A
canvas-concept.md             §§1–783 of its own, then …
  └── product/…-user-research-synthesis.md   verbatim
prds/…-mobile-usage.md        §§1–33 of its own (622 lines), then …
  └── the same research synthesis            verbatim, at lines 623–2257
```

Counted once each: **5,719 lines** of Markdown (1,451 + 285 + 682 + 459 + 424 + 783 + 1,635)
plus the 842-line gallery. The derived side is 227 notes and 11,342 lines. Every nesting is
verified by `diff`, not by reading.

**Not read, by decision, and each with its reason:**

- **`product/…-competitive-market-landscape.md`** (873 lines) — evidence about competitors, not
  about this product's intended behaviour, so it cannot contradict a derived note.
- **The 17 design slices in `tasks/`** (14,763 lines) — SDD-derived architecture one layer below
  this question, and whether any needs touching depends on how the spatial vocabulary resolves.
- **The HTML concept pages beyond the component gallery, and the seventeen screenshots.**
- **`prds/renovation-planner-mobile-usage.md`** — read only where it bears on the two live
  decisions, by the repository owner's decision taken during the pass. Its 622 own lines are not
  in the matrix and contribute to no count above. What that targeted read found is below.

## The instrument, and what it is honest about

Two kinds of row, in two directions, matched in two stages, resolved by a four-rung ladder into
five states, reported as four finding kinds.

**Two kinds of row, because nouns are not the requirement.** A named-thing row asks *does the
other corpus have this at all*; a behavioural row asks *does any note address this claim*. That
split earned itself: the spatial finding below is invisible to a named-thing inventory, which
scores `Space` present and reports the vocabulary reconciled.

**Two directions, because an orphan is otherwise undiscoverable.** Forward rows come from the
evidence, reverse rows from the 227 notes — one row per *claim*, not per note, so a Feature that
agrees in one place and contradicts in another cannot score simply "present".

**The match is two stages, and only the first is mechanical.** Stage one builds a candidate set
by command; stage two is judged, bounded to that set. The command:

```bash
candidates.sh {forward|reverse} "<comma-separated subject terms>"
```

A forward row's candidates are derived notes; a reverse row's are the eight evidence bodies. A
term is matched as a phrase **unioned** with a word-intersection fallback over its significant
words, expanded through the alias table in both directions.

**Do not read "absence is mechanical" into that.** It is true of a named thing — the name is in
the corpus or it is not — and false of a behavioural claim. The one case where the mechanical
half carries the whole answer is an empty candidate set: **37 rows**, resolved to `absent` or
`retained` with no judgement. That number was **172** before the phrase-only match was widened;
the 135 difference is findings a narrower match would have invented, and one of them is worked
below.

**Named presence resolves in two passes, and the second is not a formality.** A first pass looks
up each name literally; a second re-resolves through the alias table built *from* that lookup.
The two-pass design rescued **66 rows** (63 forward, 3 reverse) from being reported as findings.
Every one is a rename or a collapse that a single pass would have filed as a Gap on one side and
a Retained on the other — two fabricated findings out of one renaming. The worked case is the
personas: the evidence says DIY Renovator, Advanced Renovator, Professional Planner; the backlog
says Private renovator, Advanced DIY planner, Professional planner. One pass would have reported
three gaps and three retentions.

**`Retained` is a state, not a finding**, and 1,124 rows carry it. That is the correct answer,
not a weak one: the UX layer is additive and is simply not about most of the domain model.
Without that state, the twelve ADRs would have been reported as superseded by four documents in
which the word "Vue" appears **zero** times.

### Where the judged half is soft, measured rather than asserted

The spec says plainly that stage two "does not make the match reproducible — two careful readers
may still differ inside a candidate set." This pass produced a number for that.

301 rows had their candidate sets widened after first being judged, so all 301 were judged again.
The forward half — 145 rows with a first-pass verdict, re-judged **independently** — **changed 37
of them, 25%.** Most were `present`↔`absent` movements in both directions: some because the
widened set supplied a note that genuinely addresses the claim, others because a widened set's
extra candidates turned out to be false friends on a shared keyword.

**The reverse half agreed 133 of 133 and that figure is withdrawn as evidence.** Its dispatch
said "you are not being asked to review the earlier answer, you are being asked to replace it";
the judge reported having "cross-validated my readings against the original pre-widening verdict
files". A second reader who has seen the first reader's answers and agrees has shown the answers
are *defensible*, not *reproducible*. The verdicts stand — each carries citations a reader can
check — but the agreement rate cannot be read as an inter-rater measurement, so it is not offered
as one.

**So the honest statement of this instrument's reliability is: about a quarter of judged
behavioural verdicts moved when re-judged against a changed candidate set.** The counts above
are reproducible; the individual `present`/`absent` verdicts behind them are a careful reader's
judgement, and a second careful reader would differ on a meaningful minority. Every
contradiction carries both citations precisely so that a reader can check the ones that matter
rather than trust the aggregate.

**And the mechanical half is soft in a way the judged half cannot repair: a gap can be an
artefact of the candidate set.** A row whose set never contained the answering note is judged
`absent` correctly and reported as a Gap falsely, and no amount of care inside the set will find
it. The demonstrated instance is `f1284`, "show the user what they need to do now": its terms
were `task, current, next-best-action`, and `docs/requirements/Reporting and project cockpit.md`
— which asks the claim's own question in as many words, "what is next, what is blocked" — uses
none of the three, so it was never a candidate. Two rows from adjacent wishes in the same
section landed on opposite verdicts for that reason alone. `f1284` is withdrawn below. **The 759
gaps carry this limit in the same shape**, and it points one way only: it can invent a gap, never
hide one.

## Contradictions, by cluster

**All 45 appear below**, and every one cites both sides. Seven themed clusters carry 29, section
H carries 10 that are individually consequential and share no theme, and section I carries the
last 7 — reached from the reverse direction only, which is why they were the last to be written
up rather than the least important. Counted directly against `findings.tsv`, not assumed: an
earlier version of this ledger narrated 40 of them and said nothing about the rest.

Standing is stated because it decides what may change: the workspace PRD is **received**
(`docs/prds/` is received evidence per `docs/README.md`); the other seven bodies are
**undetermined**, because the register classifies neither `docs/user-experience/` nor
`docs/product/` — see the Convention section. A finding whose evidence side is `undetermined`
**proposes no edit**.

### A. The spatial vocabulary — the collapse, at the size the evidence supports

**2 rows. Evidence: received. Derived: derived. Remedy: a decision, not an edit — see below.**

The workspace PRD instructs the system to create and present *spaces* whose worked examples
include outdoor places:

- `prd§Feature 2.4` — "Users may optionally create initial spaces such as: kitchen, bathroom,
  living room, bedroom, hallway, **garden, terrace**." (row `r459`, against
  `docs/entities/Outdoor area.md::Relationships[2]` — "Has no Floor and no Space — **that is the
  branch it is not on**.")
- `prd§Feature 5.2` — "Every relevant space should provide a contextual workspace. Examples:
  kitchen, bathroom, **garden, terrace, garage**." (row `r599`, against
  `docs/entities/Space.md::Relationships[1]` — "Belongs to exactly one Floor.")

Outdoor items are instantiated through the same *space* path as indoor rooms, while the backlog
keeps them in separate branches.

**This cluster was reported as five rows and is two.** Three were withdrawn under review and the
reason is worth stating, because it is the same defect this instrument exists to catch. `f331`
was sourced to `jtbd§JTBD-007`, which reads "I want to structure buildings, floors, rooms and
outdoor areas" — a list of things to structure, asserting nothing about parentage. `f433` and
`f435` were sourced to `prd§21`, "Key Domain Concepts Exposed to Users", a flat list that names
`Space` and `Outdoor Area` as **separate entries** — which agrees with the backlog rather than
contradicting it. All three were judged against the Feature 2.4 and 5.2 passages above, which
belong to different rows. **A citation that does not come from the row's own source is not a
citation**, and three rows rested on one.

**Why the PRD contradicts where the prototype and canvas do not** — measurable rather than a
matter of taste: the prototype carries **2** domain-authority disclaimers and the canvas **1**
("This is not the production domain model… Production domain decisions remain governed by the
SDD"; "The canvas visualizes the project; it does not replace the project model"). The workspace
PRD carries **0**.

### B. Site has quietly lost a level

**4 rows, 4 findings.** The entity notes model `Site` as the container of Building and Outdoor area. The new
evidence does not have that level.

- `r592` `entities/Site.md::Description[2]` "the garden and the kitchen need a common parent that
  is not just the project" vs `prd§19`, whose hierarchy parents Building, Garage and Garden
  **directly under Project** with no Site node.
- `r595` `entities/Site.md::Relationships[2]` "a site contains zero or more buildings and outdoor
  areas" vs `uxd§6`, which draws "Property / Site" as a **sibling** of Building and Outdoor Area.
- `r462` `entities/Outdoor area.md::Relationships[1]` "belongs to exactly one site" vs `prd§19`.
- `r523` `entities/Project.md::Relationships[2]` "a project owns at most one site, which is where
  the physical hierarchy starts" vs `prd§19`, where it starts at Project.

**This cluster is why the two-kinds-of-row split exists.** The spec's own opening states that
every structural noun in the new evidence already has an entity note — "Site, Building, Floor,
Space, Outdoor area, Zone, Plan and Project, eight of eight" — and that is true, and it is a
statement about **names**. The behavioural rows show the two corpora disagree about the **shape**
those names sit in. A named-thing inventory alone scores `Site` present and reports the hierarchy
reconciled.

### C. Multi-project: the backlog names this as a change it has not made

**2 rows, 2 findings**, both reached from the evidence side. This cluster started at four and
lost half of them to review, which is worth stating plainly: it was the most over-claimed cluster
in the ledger.

- `f494` — `prd§8` requires two top-level contexts, "Project Selection" and "Renovation Project",
  against `entities/Project.md`: "It is a root rather than a container… there is no portfolio.
  **Admitting a second root is one of the changes**…"
- `f500` — `prd§10`'s user story "see all renovation projects so I can choose what to work on",
  against `actors/Professional planner.md`: "the project index (SDD §47) is scoped to one.
  **A portfolio view is a second root**" — and that persona is marked out of scope.

**`r519` and `r1640` were withdrawn**, and both for the same reason: a difference of *scope* read
as a disagreement. `prd§34` puts cross-project dashboards in Post-MVP, which **anticipates** the
change `Project.md` names rather than denying it; and `Start a renovation project.md`'s
"the vault holds no project yet" is a precondition for **that flow**, whose own next sentence says
the second-project case is not settled anywhere in the register. The fourteenth correction carries
both. Their withdrawal is also what emptied the reverse half of this cluster — the direction that
made it look mirrored in the first place.

### D. The landing surface — five routes to one question

Does a project open on Project Home, or on the plan once one is calibrated?

- `f1109` — `uxd` "Open Project always opens Project Home" vs `deliverables/Sitemap.md::The
  routes[1]`: opens "in `editor` once a calibrated Plan exists, and in `project` before that".
- `r1419`, `r1442` — the same two deliverable claims, reached from the derived side against
  `prototype§9`'s interaction contract: "Open(project) **always** enters Project Home."
- `f574` — `prd§13`'s primary navigation (Overview, Spaces, Design, Work, Budget, Schedule,
  Documentation) vs `Sitemap.md`'s exhaustive inventory, which has one `renovation-project` view
  plus Bases views and **no Spaces, Design or Documentation destinations at all**.

### E. The Disclosure ladder contradicts the new evidence

**6 rows, 6 findings — the most contradicted note in the backlog**, counted directly against
`findings.tsv` as the notes whose derived side is this file.

Its rungs gate cost on "the first Zone existing" and Work behind cost, so Work is reachable only
after a Zone and a cost. Against that:

- `c42`/`r1410` — `uxd§22`'s Progressive Disclosure Model puts Work and Budget together,
  **ungated, at Level 1**, with Plans and Zones at Level 2.
- `c41`/`r1409` — `prototype§6`'s canonical fixture attaches a €2,500 estimate directly to Kitchen
  work with **no Zone ever created**; `canvas§9` shows "Estimate Optional [€2,500]" on Work itself.
- `c40`/`r1408` — Rung 1's "measured plan" against `prototype§2`'s golden path, which runs Start
  Without a Plan → Initial Spaces → Project Home with no measured-plan step.
- `c5`/`f610` — `prd§17` groups tasks with the *basic* capabilities; the ladder puts Task at rung 3
  with Trade and Work package.
- `c43`/`r1419` — the ladder's "Project-first to create, **plan-first thereafter**" against
  `prototype§9`'s interaction contracts.
- `c50`/`f1009e` — `uxd§4`'s Primary User Journey runs **Plan Work → Estimate Costs**, against
  `What each rung means concretely[2]`: costing "is deliberately rung 2 and not rung 4… burying it
  behind trades and work packages would demonstrate it to nobody". The ladder pre-empts this
  objection in the PRD's voice — it argues `prd§5` is "a list of everything in dependency order,
  not a claim about when a surface should appear" — and that defence does not reach a document
  whose section is titled *Primary User Journey* and whose content is a flowchart of user
  sequence. **This is the same disagreement as `c42` from a second UXD section**, counted as its
  own finding because the ledger's rule counts by pair, and neither the evidence section nor the
  derived paragraph is shared; a reader weighing how much the UXD disagrees with the ladder should
  read the two together rather than as independent confirmations. `uxd§22` softens itself with
  "conceptual complexity levels rather than mandatory user modes"; `uxd§4` carries no such hedge.

**The ladder also disagrees with a sibling note, and that is reported here as a direct reading
rather than as a matrix finding — because the matrix cannot produce one.** Every row in this
instrument runs between the new evidence and a derived note; there is no row shape for
derived-against-derived, so no count below includes this and none could. Both halves are quotable:

- `deliverables/Disclosure ladder.md::What is open[4]` — "Someone pricing a renovation before
  drawing anything would want *Money* without *Place*, **which the ladder currently forbids by
  making rung 1 universal**." The note states the conflict against itself.
- `requirements/Start a renovation project.md`, step 6 — the plugin writes one project note and
  "**No other folder is created**: PRD §36's `Plans/`, `Zones/` and the rest appear when something
  is first written." So a project exists, costable, with nothing drawn.

An earlier version of this section attributed that reading to a split row, `f632a` contradictory
against the ladder and `f632b` present against `Start a renovation project.md`, and called `f632`
"the one row in the corpus that split". **Neither id exists in the committed matrix, and 109 row
groups split, not one.** The observation survives because both citations are real and checkable;
the mechanism claimed for it did not. It is the clearest case in this ledger of a conclusion
outliving the evidence it was first drawn from — which is why it now carries its own citations
instead of a row id.


### F. The delete rule's fourth resolution — three routes, one defect

`business-rules/A delete reports what references it and offers four choices.md::Rule[2]` requires
exactly four: Cancel, Remove References, Reassign, Delete Anyway. **No delete flow in the
evidence offers all four.**

- `r6` — the rule itself, against `gallery§Modal` (three: Cancel / Reassign… / Delete anyway) and
  `wireframes§A.18` / `uxd§25` (two: Cancel / Delete).
- `r161` — `components/Modal.md::Anatomy[3]`, same gallery specimen.
- `r678` — `entities/Zone.md::Rules[4]`, same gallery specimen.

Three derived notes, three distinct pairs, one underlying defect. The gallery's own prose says
"Four kinds of thing point at it" while listing three.

### G. Component notes drifted from the mock they specify

The gallery's 17 specimens correspond one-to-one with the 17 component notes and **all 17 names
match**, so nothing here is a vocabulary gap — it is same name, different behaviour.

- `r110`, `r111` — `components/Inspector.md` claims a Relations section and seven actions; the
  specimen renders Properties and Actions only, with four.
- `r138`, `r141`, `r145` — `components/Left rail.md` claims three sections each with its own
  empty state and requires three `h2`s, saying explicitly "not an h2 and two h4s"; the specimen
  renders two sections with `<h4 class="rp-section-head">` — the anti-pattern the note prohibits.
- `r261` — `components/Tool button.md::States[2]` requires a distinct active/pressed state; the
  specimen enumerates Default, Hover, Focus, Selected, Disabled.
- `c7`/`f647` and `c11`/`f1115` — two evidence bodies specify empty states with **two** actions,
  against `components/Empty state.md::Anatomy[3]`: "One action, not several. A surface with three
  suggestions has not decided what a user should do first."

A third row was listed in that bullet until review — `f154`, which is `present`, and citing it
made the count read three rather than two.

### H. Individually consequential

- `f1100` — the UXD aggregates costs across *Project → Floor → Room → Work Item → Material*;
  `business-rules/A cost rollup is derived along its axis, never stored.md` names **seven** axes —
  project, construction section, zone, trade, work package, asset, supplier. **Floor and Room are
  not among them.**
- `f1130` — the UXD requires spatial context preserved across functional views;
  `issues/The alternative list route is a Bases view.md::Consequences[1]` says "no drawn state and
  no canvas selection can be reflected there. **That is the price, and it is paid on every spatial
  surface.**"
- `f1220`, `f1246` — the wireframes require the Spaces screen to become a tree/list at narrow
  widths; the same issue note records that alternative as considered and **rejected**.
- `r1335`, `r1341` — `actors/Professional planner.md` sets `standing: out of scope` and says the
  plugin owes it "**Nothing** … if this actor is ever admitted"; `prd§6.3` admits it, under
  **§6 Target Users**, at the same tier as §6.2's Advanced Renovator, with a stated primary need
  written in the same form as the primary persona's. **This is about standing, not about MVP
  features**, and the distinction is worth stating because the obvious objection attacks the
  other claim: `prd§33`'s MVP list names no professional-planner capability, and the ledger does
  not say it does. What makes it a contradiction is that the workspace PRD has **no** future,
  deferred or out-of-scope persona category anywhere — the word does not appear in it — so
  naming this persona a Target User is the only classification it gives, and "out of scope" is
  the opposite one.
- `r1227`, `r1228` — `requirements/User Experience.md` guarantees "first useful result reachable
  in four steps"; `wireframes§A.5` labels the New Project Wizard "**Step 1 of 5**".
- `r1668` — the project status "defaults to IDEA"; `prd§9`'s lifecycle is New → Planning → Ready →
  In Progress → Completing → Completed → Archived, with no IDEA state.
- `f1099` — the UXD says a trade is never required for a first work item;
  `entities/Work package.md::Relationships[2]` states "Has exactly one `[[Trade]]`"
  unconditionally, while the same note makes Construction section explicitly optional.

### I. Reached from the reverse direction only

**7 rows.** These come from a derived note's claim finding a disagreeing passage in the new
evidence, rather than the other way round — which is why they were the last to be written up and
not why they matter least. `c33` and `c34` are the same clash seen from a note's Body and its
Outcome; they are two findings because they are two rows against two passages, and the ledger
counts rows rather than subjects throughout.

- **`c29` — Zone's referrer list versus the delete-modal's reference set.**
  `entities/Zone.md::Relationships[5]` says a zone is "Referenced by [[Task]], [[Cost item]],
  [[Document]] and [[Photo]]." `gallery§Shared vocabulary/Modal`'s delete-confirmation specimen
  says "Four kinds of thing point at it" and lists only "work packages", "tasks" and "cost
  items" — naming a referrer (work package) Zone.md never lists, while Document and Photo, which
  Zone.md does list, are missing from the warning. Real disagreement: the two name different sets
  of things that reference a Zone.

- **`c32` — "only subject and date" versus four inherited fields plus an optional taxonomy.**
  `requirements/Photo documentation.md::Body[1]` says "Photos stay ordinary files in the vault in
  the open formats §44 names. What this feature adds is the subject and the date." `canvas§12.
  Photo` has photos "inherit context automatically: project, space, selected object, date," plus
  an "Optional type" drawn from "Before, During, After, Issue, Hidden Infrastructure, Receipt,
  Reference." Real disagreement: the requirement's "only" claims two added fields; the canvas
  attaches at least four automatically, plus an optional seven-value vocabulary.

- **`c33` — multi-selection as a precondition versus "single primary selection... sufficient
  initially."** `requirements/Selection.md::Body[1]` says "Single and multi-selection (§13). It
  is the precondition for every editing command and for every bulk operation later…" `canvas§17.
  Selection Contract` says "Single primary selection is sufficient initially." Real disagreement:
  the requirement makes multi-select foundational to the feature itself; the canvas's own
  contract defers it, scoping selection to one object at a time for now.

- **`c34` — "pick one or many" versus "single primary selection... sufficient initially."**
  `requirements/Selection.md::Outcome[1]` says "A renovator can pick one object or many and act
  on them together." `canvas§17. Selection Contract` says "Single primary selection is sufficient
  initially." Same clash as c33 seen from the outcome side: the promised outcome requires acting
  on many objects together, which the canvas's own contract explicitly scopes out for now.

- **`c37` — planning follows geometry versus planning attached with no geometry at all.**
  `actors/Private renovator.md::What it does to the plugin[1]` says the renovator "Draws on a
  [[Plan]], which is where geometry originates — §3.4 has planning follow from geometry rather
  than from a form beside it." `canvas§5. Progressive Spatial Fidelity`'s Level 1 — Conceptual
  says "No measurements or drawing required. Work, costs, photos, problems and decisions can
  already be attached." Real disagreement: the actor note makes geometry the origin planning
  follows from; the canvas's own entry level attaches work, cost, photos, problems and decisions
  to a purely conceptual hierarchy with zero drawing.

- **`c44` — a three-entity Watch group versus one first-class "Problem."**
  `deliverables/Information Architecture.md::The grouping[6]` groups "What could go wrong?" under
  "[[Risk]], [[Issue]], [[Constraint]]." `canvas§10. Problem` makes "Problem" the sole first-class
  canvas object for that question, with its own inspector fields and lifecycle ("Observed →
  Investigating → Decision Needed → Work Created → Resolved"); Risk and Constraint never appear
  anywhere in the document (confirmed by §7's object vocabulary too). Real disagreement: the
  architecture's three-way taxonomy has no counterpart on the canvas, which names one concept
  where the architecture names three.

- **`c46` — Budget deferred behind a trigger versus Budget already in the workspace tree.**
  `deliverables/Sitemap.md::The inventory[14]` says a workspace view for Budget, Schedule or
  Procurement "arrives only with a named trigger" and that, unlike Schedule's, "Budget's and
  Procurement's do not" exist yet. `uxd§5. Experience Architecture`'s tree lists "Budget" and
  "Schedule" as children of "Project Context," siblings of Spaces, Design, Work and
  Documentation, with no Bases-view/trigger distinction drawn between them. Real disagreement,
  specific to Budget: the UXD's own information architecture already treats it as a workspace
  destination on par with the others, which the Sitemap says has no trigger yet.

## Gaps

**759**, of which 398 are named things the evidence names with no note behind them and 361 are
behavioural claims no note addresses. The named/behavioural split and the per-body breakdown are in `findings.tsv`.

They are not 759 separate problems. **Whole epics of the new PRD have no derived counterpart**,
and the reason is one measurement rather than a judgement — counted across all 227 notes:

| term | derived notes containing it | times the workspace PRD uses it |
| --- | --- | --- |
| wizard | **0** | 7 |
| guidance | **0** | 19 |
| breadcrumb | **0** | 4 |
| switcher | **0** | 1 |
| next-best-action | **0** | — |
| recent activity | **0** | — |
| archiv* | 1 | 8 |

Reproducible:

```bash
for t in wizard guidance breadcrumb switcher next-best-action "recent activity"; do
  printf '%-18s %s\n' "$t" "$(grep -rli "$t" docs/requirements docs/entities docs/business-rules \
    docs/components docs/actors docs/deliverables docs/adrs docs/issues | wc -l)"; done
```

That accounts for Epic 2 (New Project Wizard), Epic 7 (Deterministic Guidance) and most of Epic
3's feature-level detail. The screens are the same story — `Planner Home`, `Spaces View` and
`Space Detail` appear in **zero** derived notes, and `Project Home` in exactly one
(`deliverables/MVP Prototype.md`, and **not** in any Feature or PBI):

```bash
for n in "Planner Home" "Spaces View" "Space Detail" "Project Home"; do
  printf '%s: ' "$n"; grep -rliF "$n" docs/requirements docs/entities docs/business-rules \
    docs/components docs/actors docs/deliverables docs/adrs docs/issues | wc -l; done
# prints 0, 0, 0, 1
```

`Project Home` is worth naming separately because it is the case the instrument was corrected to
reach: it resolves `absent` against `requirements/` and `present` against `deliverables/`. A
lookup searching the union of a screen's two consumer types scores it present and the missing
Feature never becomes a gap.

`wireframes§A.23` requires a **Screen Component & Interaction State Specification**; none of the
five deliverable notes is one.

**A caveat a reader should apply to this number.** A gap is one forward row that no derived note
addresses, and the same absence is reached from several bodies — `Project Home` alone produces
rows from three. The 759 is a row-derived count, honestly produced and not deduplicated by
subject, and the clusters above are the shape a reader should act on.

**Every one of the 759 is re-runnable, and both commands are committed — two, because the two
row kinds are two mechanisms.** A named row is a *lookup* that settles the row on its own; a
behavioural row is a *candidate set* that bounds a reading. One command cannot answer both, and
publishing one and claiming both is the error this ledger keeps catching in itself.

**361 behavioural gaps** — [`candidates.sh`](2026-08-24-ux-layer-backlog-reconciliation/candidates.sh),
given the row's `direction` and `terms`:

```bash
D=docs/reviews/2026-08-24-ux-layer-backlog-reconciliation
awk -F'\t' '$7=="f184"' $D/findings.tsv                       # g96, a Gap, from row f184
awk -F'\t' '$1=="f184"{print $2, $6, $7}' $D/rows.tsv         # forward · terms · cand_n = 0
bash $D/candidates.sh forward "interaction promise,awareness" # prints nothing: the set is empty
```

`g96` is the worked example because it is the hardest case to take on trust: `cand_n` is **0**,
so no judgement was involved at all — the ladder resolved it to `absent` mechanically. The
command is the whole of that decision, and it either prints nothing today or the finding is wrong.

**398 named gaps** — [`lookup.py`](2026-08-24-ux-layer-backlog-reconciliation/lookup.py), given
the row's `target` and `subject`. It is type-aware, alias-resolved and back-link-guarded, which
`candidates.sh` is none of, so it prints `Project Home`'s two answers rather than their union:

```bash
python3 $D/lookup.py forward requirements  "Project Home"   # absent   -
python3 $D/lookup.py forward deliverables  "Project Home"   # present  docs/deliverables/MVP Prototype.md
python3 $D/lookup.py reverse               "Design System"  # retained -   (the back-link is stripped)
python3 $D/lookup.py --selftest                             # replays all 678 named rows
```

`--selftest` replays every named row against its committed state: **678 of 678**, with the two
rows a later reading moved from `present` to `contradictory` reported by name rather than
tolerated silently. Judgement moving a row the lookup placed is the one legitimate divergence;
the reverse of it is a failure, and the selftest treats it as one.

The script needs nothing but the repository: it carries `aliases.tsv` beside it and materialises
the eight evidence bodies from their own line ranges. `wc -l` on its output is the row's
`cand_n`, and a check below re-runs a fixed sample of rows against their committed counts — a
published command that no longer reproduces them is a citation to something that no longer
exists. **What it cannot do is make the second stage mechanical**: the set bounds the reading,
and whether a note inside it *addresses* the claim is judgement, measured above at a quarter of
verdicts moving.

## Findings that need a decision

Listed, not settled. Each carries options and a recommendation; none is resolved in this pass.

### 1. Classify `docs/user-experience/` and `docs/product/` — this one gates the rest

`docs/README.md`'s folder table names neither. **Seven of the eight evidence bodies therefore have
no recorded standing**, and 541 of the 804 matrix findings carry `undetermined` and propose no
edit as a direct consequence.

- **Received, like `prds/`** — the 32 contradictions now carrying `undetermined` gain the
  standing the other 13 already have, and each becomes a question someone is entitled to answer.
  **It is not a licence to edit the backlog.** All 13 already-received contradictions were traced
  to the sections their derived note cites, and all 13 came back faithful: the note says what its
  source says, so the disagreement is between two received documents and no derived note is at
  fault. Classifying these folders received extends that shape rather than escaping it.
- **Derived, like `components/`** — the UX documents move instead, and the component-gallery
  findings in cluster G invert: the gallery is corrected to match the notes.
- **Split** — the PRD-adjacent documents received, the concept HTML and research derived.

**Recommendation: split.** The workspace PRD already sits in `prds/` and is received by the
register's existing rule; the wireframes, UXD and prototype spec are its companions and behave
like received evidence. The component gallery is a *mock generated from* `components/` — its own
lede says "one specimen per note in `docs/components/`" — so treating it as received would let a
mock overrule the notes it was generated from. **Both folders must be classified together**;
classifying one leaves the other able to move a derived note on exactly the unrecorded standing
this rule exists to refuse.

### 2. The user-facing spatial vocabulary

**The domain model is not in question.** `entities/Space.md` and `entities/Zone.md` each carry an
explicit *Space versus Zone* section sourced to the original PRD §6, §34, §58 and §60, and the new
evidence does not contest it — `prd§8` states navigation "shall represent user concerns rather
than technical domain entities" and "the exact naming may evolve through UX validation".

The question is narrower: **should the user-facing word "space" become an umbrella over Space,
Outdoor area and Zone, and if so where are its members separated for the user?**

- **Umbrella in the UI, distinct in the model** — the PRD's §8 already licenses this; the
  disagreement in cluster A becomes a naming rule rather than a defect, and `Outdoor area.md`'s
  "that is the branch it is not on" needs a sentence saying it is a *model* branch, not a
  *navigation* one.
- **Hold the distinction in the UI too** — the PRD's Features 2.4 and 5.2 move, dropping garden
  and terrace from the "initial spaces" list.
- **Rename the domain concept** — most expensive, and nothing in the evidence asks for it.

**Recommendation: the first.** It is the only option that changes no received document and no
domain rule, and the PRD explicitly anticipates it. But this is a product decision about what a
word means to a user, and it is not the reconciler's to take.

**Note for whoever takes it:** the newest received evidence *supports* keeping the distinction.
The mobile PRD — read only for this question — uses "space" for room-level navigation exactly as
`Space.md` predicts, uses "zone" once (line 429) for canvas geometry exactly as `Zone.md`
predicts, and keeps "conceptual spaces" and "viewing zones" apart inside a single sentence.

### 3. Site as a level of the hierarchy

Cluster B is **received against received**: the entity notes cite the original PRD §6/§34/§58/§60
for the Site level, and the workspace PRD's §19 omits it. The provenance trace shows the notes
have **not** drifted — they faithfully reflect what they cite — so the backlog does not simply
move. Moving it would silently pick one received document over another.

- **Keep Site** — the workspace PRD's §19 diagram is abridged for a UX audience and is corrected.
- **Drop Site** — the original PRD is superseded on this point by receiving a new one, and
  `Site.md`, `Outdoor area.md` and `Project.md` all change.

**Recommendation: keep Site and correct the diagram**, because `Site.md::Description[2]` states a
reason the UX documents do not address — "the garden and the kitchen need a common parent that is
not just the project" — and no evidence body argues against it. But this is a domain-model
decision between two received documents.

### 4. Multi-project, and the second root

Cluster C is the same shape and sharper, because the backlog **names the change it has not made**:
"Admitting a second root is one of the changes…" The workspace PRD requires that root in MVP
scope (`prd§35`, Slice 1).

- **Admit the second root** — `Project.md`, `Professional planner.md` and
  `Start a renovation project.md::Preconditions[2]` all move, and SDD §47's single-project index
  is revisited.
- **Defer it** — the PRD's Epic 1 and Epic 4 move out of MVP.

**No recommendation from this pass.** It turns on delivery scope rather than on evidence, and the
pass has nothing to add that the two documents do not already say plainly.

**Decided by the repository owner, 2026-08-24: selection, not portfolio.** The vault holds many
projects and a Home lists them so one can be opened; `Project` stays the sole root of the
relationship model, SDD §47's per-project index is untouched, and cross-project aggregation stays
later. That line is the PRD's own: `prd§8` asks for a `Project Selection` top-level context beside
`Renovation Project`, and `prd§34` already places **cross-project dashboards** in Post-MVP scope.

What it settles, checked against the finding set rather than asserted:

- **`f500`** — "as a user, I want to see all renovation projects so I can choose what to work on"
  (`prd§10`) is **in** scope. It is matched against `actors/Professional planner.md`'s
  *"Cross-project work … A portfolio view is a second root"*, and separating selection from
  portfolio is exactly what this decision does.
- **`c2`** — `entities/Project.md`'s *"Nothing here spans two projects … there is no portfolio"*
  needs the distinction **drawn, not reversed**: many projects in a vault, still no aggregation
  across them.

**Two claims this section made when the decision was first recorded were wrong, and review
caught both.** They are corrected here rather than quietly edited out, because both were errors
of the same kind — reading a *scope* difference as a disagreement.

- **`r1640` was never a contradiction, so the decision does not settle it.** The first version of
  this section said the precondition "cannot stand beside a Home that lists projects". It can.
  `Start a renovation project.md::Preconditions[2]` reads: "The vault holds no project yet.
  Creating a second project alongside a first raises questions this note does not answer … and
  none of them are settled anywhere in this register." That is a precondition scoped to **this
  flow**, plus an explicit refusal to answer the second-project case. A note that declines to
  answer a question cannot be contradicted by a document that answers it. Withdrawn to `present`.
  This ledger's own provenance trace had already said as much about the same passage, and the
  section was written without checking it.
- **`c49` is withdrawn too, and the reason given for keeping it was aimed at the wrong
  question.** The first version noted that `prd§34` defers cross-project dashboards, "which
  *agrees* with `Project.md`", and then kept the finding on the principle that **a ruling decides
  what to do and does not unmake a finding.** That principle is sound and still holds. It was
  simply not what was at issue: if the two passages agree, the row was never `contradictory` at
  rung 2 in the first place. `Project.md` says a portfolio is "one of the changes" admitting
  another root would force; `prd§34` lists that change among "likely later increments". Same
  timeframe, not opposed. Withdrawn to `present`.

Net for this decision: **two contradictions withdrawn.** Stated as a delta rather than as
totals, because a per-decision note that quotes the running totals goes stale the moment any
other round moves them — which is how this sentence came to print 48 and 823 long after both
had changed.
- **The `Professional planner`'s standing is untouched** (`r1335`, `r1341`). Selecting among your
  own projects is not working on several projects on someone else's behalf.
- Per the provenance trace, `entities/Project.md` **faithfully reflects** the original PRD §58 and
  §72 and SDD §47. So this is a product decision superseding received material, not the correction
  of a drift — which is why it had to be taken by the owner and could not be read off the corpus.

**The reconciliation edited no derived note.** Making the notes say it was separate work, and the
repository owner has since approved it: `entities/Project.md`, `actors/Professional planner.md` and
`requirements/Start a renovation project.md` now draw the distinction, and the decision itself is
recorded as
[[The vault holds many projects, and selecting one is not a portfolio]]. `c2` and `c3` carry it as
their remedy. They are **decided, not withdrawn** — a finding records what two corpora said, and a
ruling says which way it resolves.

### 5. Mobile: capture-first against read-only — received versus received

From the targeted read of `prds/renovation-planner-mobile-usage.md`, outside the matrix counts.

`PRODUCT.md` states "**Confirmed device scope: desktop-first, mobile read-only** … mobile *parity*
is explicitly not the target". The mobile PRD's whole premise is the opposite: §23 requires
creating photos, notes, problems, measurements, task state and receipts **offline**, and §22 gives
the canvas itself "simple positioning" and "contextual capture" — the one surface `PRODUCT.md`
names as desktop-only.

Provenance traced: `deliverables/Sitemap.md:190` cites `PRODUCT.md` explicitly, and its `Mobile`
column reads `read` on every row. The derived notes have **not** drifted. So this is
`PRODUCT.md` against the mobile PRD, and the backlog does not move on its own.

**No recommendation** — this is a product-scope decision between two product-defining documents.
Note that `PRODUCT.md`'s own standing is unrecorded; see Convention finding v4.

## Convention audit

**Reported apart from the matrix counts, and derived from a different corpus.** These come from
reading the register's own documents — `docs/README.md` and `docs/templates/` — against the
folders and note types that actually exist. `docs/README.md` is neither in-scope evidence nor one
of the 227 notes, so **no row in either direction can produce a finding of this kind**; listing
it beside the matrix kinds would imply a mechanism it does not have.

| id | finding |
| --- | --- |
| **v1** | `docs/user-experience/` holds 30 files, including six of the eight in-scope evidence bodies, and the folder table names no such folder. |
| **v2** | `docs/product/` holds the user research synthesis and the competitive market landscape, and the table names no such folder. It arrived during the review of the spec that inventories it. |
| **v3** | `docs/templates/` holds `jobs-to-be-done.md`, and the table names no such folder — the register omits a folder that is itself register machinery. `docs/README.md` contains no occurrence of the word "template". |
| **v4** | **`PRODUCT.md` is cited as settled authority by six derived notes and `docs/README.md` mentions it zero times.** |

The register's claim is that its table names every folder "so the first note of that kind has
somewhere obvious to go rather than a decision to make".

**v1 and v2 are the ones that gate this ledger** — they are why 541 findings carry `undetermined`:
484 whose evidence side sits in `docs/user-experience/` and 57 in `docs/product/` — all of
them, which is why neither folder can be classified alone.
**v3 is the cheapest**: a note template is neither received evidence nor a derived note, so
naming it in the table settles it outright, with no classification question behind it.

**v4 is the sharpest, and it is a different kind of thing.** v1–v3 are folders with no row; v4 is
the root document the backlog leans on having no recorded standing at all. It is cited by
`requirements/User Experience.md`, `requirements/User Interface.md`,
`deliverables/Disclosure ladder.md`, `deliverables/Sitemap.md` and both `issues/` notes. A
reconciliation that finds a note contradicting `PRODUCT.md` — as decision 5 does — cannot say
whether the note may be edited, because nothing records what `PRODUCT.md` is.

```bash
comm -13 <(sed -n '/^| Folder/,/^$/p' docs/README.md | grep -oE '`[a-z/-]+/`' | tr -d '`' \
           | sed 's|/$||' | sort -u) \
         <(find docs -maxdepth 1 -mindepth 1 -type d -printf '%f\n' | sort -u)
# prints: product, templates, user-experience
grep -c 'PRODUCT\.md' docs/README.md   # prints 0
```

**Checked in both directions.** The reverse check — folders the table names that do not exist —
returns `bugs/` and `tests/cases/`, and those are **not** findings: `docs/README.md:31-32` says
"Only the folders with notes in them exist today; the rest are named here so the first note of
that kind has somewhere obvious to go." A folder named before it exists is the register working
as designed. Recorded so that a reader who runs the check the other way knows it was looked at
and dismissed on the register's own authority.

## Two inconsistencies inside the evidence itself

Neither is a disagreement between the corpora, so neither is a matrix finding. Both were found by
the sweep and are recorded rather than discarded.

- The JTBD backlog's Tier 1 research list names a job "Continue/recover project context" that
  does not exist among JTBD-001–063.
- The component gallery's Modal specimen says "Four kinds of thing point at it" while listing
  three — the same specimen whose three delete actions produce cluster F.

## What this deliberately does not do

It does not fix anything. It does not create Epics, Features or PBIs from the new PRD. It does not
decide the spatial model, the Site level, the multi-project question or the mobile scope. Each is
a follow-on this ledger exists to make answerable, and any of them started here would be a second
piece of work smuggled into the first — with the decision underneath it taken by whoever happened
to be typing.

## The finding set, as data

The narrative above cites the contradictions in full and characterises the gaps by cluster. It
does not print 759 gap citations, and a reader is entitled to check the totals rather than take
them. **The matrix and the finding set are committed beside this ledger**, in
[`2026-08-24-ux-layer-backlog-reconciliation/`](2026-08-24-ux-layer-backlog-reconciliation/):

| file | rows | what it holds |
| --- | --- | --- |
| `rows.tsv` | 3,072 | every matrix row: direction, kind, subject, source, terms, candidate-set size, match, state, pair, target |
| `findings.tsv` | 804 | every finding: kind, standing on both sides, both citations, the rows behind it, remedy |
| `aliases.tsv` | 35 | the alias table the two-pass named lookup resolved through |
| `convention.tsv` | 4 | the convention audit, kept out of the matrix counts |
| `provenance.tsv` | 13 | the provenance trace: for each received contradiction, the original-PRD/SDD sections read and whether the derived note drifted from them |
| `sections.py` | — | the coverage instrument behind the sections-swept table, with `--selftest` |
| `candidates.sh` | — | the candidate command for a BEHAVIOURAL row — the mechanical half of that match |
| `lookup.py` | — | the named-thing lookup, with `--selftest` replaying all 678 named rows |

The implementation plan had decided these would stay in a scratchpad, on the reasoning that the
spec authorises one output file — and flagged that as a question for the repository owner rather
than a settled call. It was the wrong default and the question should have been asked: a ledger
whose central number cannot be inspected is a ledger asking to be trusted, which is the one
thing this instrument was built not to do. Eight files, additive, no derived note touched.

## Findings withdrawn after review

Forty-eight corrections, all from review of the committed matrix — which is the argument for
committing it. None was reachable from the narrative alone.

**1. `r1448` — a techstack contradiction that is not one.** It set
`deliverables/MVP Prototype.md`'s techstack line — "HTML, CSS, JS in one self-contained
deliverable" — against `prototype§7`'s "Pinia plus localStorage" and its Vue-style component
list. Those are compatible: the deliverable names no prohibition on libraries, does not require
vanilla JavaScript, and does not require separate files, and a Pinia/Vue prototype bundles into
exactly HTML, CSS and JS. `prototype§7` is permissive in its own words — "or an equally
lightweight mock repository".

Withdrawn and reclassified `present`.

**2–4. `f331`, `f433` and `f435` — three fifths of the spatial cluster, judged against passages
that were not their own.** Detailed in cluster A above. `jtbd§JTBD-007` lists spatial things to
structure; `prd§21` lists concepts to expose, keeping `Space` and `Outdoor Area` separate. Neither
asserts parentage, and the Feature 2.4 / 5.2 passages that do belong to two other rows. Withdrawn
and reclassified `present`.

**5. `f1284` — a gap the candidate set invented.** "Show the user what they need to do now",
from `research§21`, was judged `absent` on a set of 49 notes, correctly: none of them addresses
it. `docs/requirements/Reporting and project cockpit.md` does — "the question a private renovator
has on a Sunday evening is short — am I over budget, **what is next, what is blocked** … and
answering it by opening eleven notes is the same as not answering it" — and it was never in the
set, because it contains none of the row's three terms. Withdrawn and reclassified `present`
against that note. The mechanism, and why it can only invent a gap and never hide one, is under
*Where the judged half is soft* above.

**6. `c31` — compatible stages read as a disagreement.** It set
`requirements/Onboarding and example project.md::Outcome[1]` — "gets to a measured plan with a
cost on it without reading anything" — against `canvas§36`'s success criteria, which include
"start without a floor plan" and "attach a rough cost". Those are not opposed. §36 is a list of
eleven things a validated concept lets a user do, and one of them is "**progressively add
precision**"; the requirement names an end state reached without reading documentation, not a
first usable state. Neither says measurement comes first and neither forbids reaching it during
onboarding. Withdrawn and reclassified `present`, which is why the contradiction count is 47
rather than 48.

**A seventh correction, mechanical rather than judged.** 18 named rows were scored `present` on a
note **outside the type the row targets** — a `deliverables` row matched by
`docs/requirements/Schedule.md`, an `entities` row by a requirement. The alias pass resolved
presence through the alias table's note path without re-checking the target, so the type-aware
lookup that exists to stop a gap hiding behind a passing mention was bypassed after the fact. All
18 were re-resolved within their target; those with no match there are now `absent`, which is why
the gap count rose from 754 to 772.

**An eighth correction, and the deepest of the mechanical ones: incidental prose standing in for a
note.** The named lookup asked whether the subject appeared *anywhere* in any note under the
target type. `Wall` was scored `present` on `entities/Photo.md` because that note says "the wall
went up"; `Work` on `entities/Constraint.md` for "worked on" and "[[Work package]]". Six such
rows were present on text that names no note, plus `Procurement`, against a backlog that has
`Procurement item`.

The repair is not "match identities" — that is the mirror defect, and measuring it first is what
stopped it. **Presence means two different things in the two kinds of target directory, and the
corpus says which.** `entities/`, `components/` and `actors/` are one note per thing: all **59**
have an H1 identical to their filename, so a thing is present iff a note *is* it. `requirements/`
(121 Features and PBIs) and `deliverables/` (5 inventories) are the opposite — **no screen in this
corpus is the identity of a note in either** — so a screen is present iff a note *names* it.
Identity everywhere would have made `Work Packages` and `Trades` gaps under a plural, and turned
all three `Project Home` rows into gaps inside inventories that exist to list screens.

**It ran in both directions, which one-sided measurement missed.** Checking only the `present`
rows found 7. Replaying all 686 through the corrected lookup found 2 more going the other way:
`Decisions (layer)` and `Photos (layer)` were **false gaps**, because the literal search took the
parenthetical qualifier as part of the name while `entities/Decision.md` and `entities/Photo.md`
sit right there. Net, the gap count rose from 772 to 777.

**A ninth correction, to the committed matrix rather than to a finding.** `rows.tsv`'s `pair`
column still held the citations as first extracted, so all 49 disagreement rows then in it carried an
evidence citation truncated at its first space and 11 carried the row's own id where the derived
citation had failed to parse — both fixed in `findings.tsv` at the time and in neither place
else. A reader recomputing the finding set from the committed matrix would have got the right
count with the wrong citations. The column is now backfilled from the corrected findings, and the
recomputation is a check below: the finding set derived from `rows.tsv` and the one in
`findings.tsv` agree as SETS, not merely in total.

**A tenth correction, to that eighth one: the reverse direction was measured under the repair
and never given it.** An evidence body has no note identities, so a mention *is* the test there,
and re-running all 185 reverse named rows under word-boundary matching moved **none** — which is
true, and is why the finding was recorded as cleared while `reverse` kept the literal `grep -F`
the forward path had just lost. A check run beside the code is not a property of the code. Three
rows did rest on a substring: `Order` on the prototype's `borders`, `Site` on jtbd's
`prerequisite`, `Layer` on research's `layered`. None moved, because each is also named properly
by another body — not, as this section previously claimed, because they were alias-resolved; only
`Site` is in the alias table at all, and it never reached that branch. `reverse` now applies the
same word-boundary, plural-tolerant test as the forward path, so the class is refused rather than
re-measured.

**`matched` names every body, not the first one grep walked into.** That is what made the
substring rest invisible: `Order` recorded `gallery` alone, whose sole boundary-clean hit is
`<!-- Order is load-bearing -->` — a comment about stacking order, not the commitment to buy the
entity note defines. The row is right (`jtbd` §JTBD-041 *Track orders and deliveries* and the
synthesis's "budget does not reflect committed orders" both name it) and its evidence read as
though it were not. 43 rows gained the bodies that were always there. **No state moved, in
either repair**; `lookup.py --selftest` reproduces 686/686.

**An eleventh correction, and it is the eighth one's third visit: `s?` is not plural tolerance.**
Appending it to a name that already ends in `s` asks for `\bIssuess?\b`, which matches neither
`Issue` nor anything a row means by it. `Issues` and `Scenarios` read `retained` against bodies
that name both — `entities/Issue.md` exists and the canvas names `Issue` outright. The name is
now reduced to its singular before the optional `s` is added, so tolerance runs both ways. Two
rows move, `r1026` and `r1148`, both `retained` → `present`.

**A twelfth correction: the extractor's annotation was being searched for.** A forward subject
reads `Project Home (screen)`, and `names_it` passed that string to grep whole, so the search
required the literal parenthetical and an annotated row came back `absent` unless the alias table
happened to rescue it. `Project Home` against `deliverables/` is exactly the row this module's own
header uses as its worked example of the opposite answer, and `MVP Prototype.md` names it.

**The bound on that repair is the finding, not the fix.** Dropping the annotation unconditionally
moves 57 rows, nearly all onto a common word — `Open` on the verb, `Tasks` on a `../tasks/` link
path — which would hide 55 gaps to correct 2. The corpus decides where the line is: 33 annotated
rows have an **unannotated twin** naming the same thing at the same target, 31 already agree, and
the 2 that disagree are `f1023b` and `f1177b`. So the annotation is dropped only when two words or
more remain and the name is then matched **as written** — `MVP Prototype.md` names `Project Home`,
while `add renovation work` in that same sentence is prose and `[[Start a renovation project]]` is
a link to a requirement. That moves exactly those 2 rows and leaves all 31 agreeing twins agreeing.
Its limit, stated because no check reaches it: a one-word screen name, or one an inventory writes
in lower case, still reads `absent`.

**A thirteenth correction, to the coalescing the totals rested on.** `r519`'s `pair` was
`prd§8>>docs/entities/Project.md::Project[2]` — `f494`'s pair, not its own. Its own citations are
`prd§34` and `docs/entities/Project.md::Description[1]`, and the ninth correction's backfill had
taken the pair from the finding the row was coalesced into rather than from the row, which is
circular: the pair decided the coalescing, then the coalesced finding wrote the pair back. It was
the only duplicate pair in the 48, so **the one coalesced pair was an artefact and there are 48
findings, not 47**. The two rows disagree with the same derived paragraph from different PRD
sections, which the ledger's own rule counts as two findings. `c49` carries the second, and
`provenance.tsv` gains its trace: the same verdict as `c2` — the paragraph is grounded in §58,
§59, §72 and SDD §47, all four of which `Project.md` lists as its own sources — against different
evidence. Received contradictions go from 16 to 17, traced 17 of 17.

**A fourteenth correction: two rows where a difference of SCOPE was read as a disagreement.**
Both were reverse rows against `prd`, both withdrawn to `present`, and both are the same mistake
seen twice.

`r1640` set `requirements/Start a renovation project.md::Preconditions[2]` — "The vault holds no
project yet" — against `prd§35`'s multi-project slice. But the precondition is scoped to **that
flow**, and its own next sentence says the second-project case "raises questions this note does
not answer … and none of them are settled anywhere in this register". **A note that declines to
answer cannot be contradicted by a document that answers.** This ledger's provenance trace had
already reached that conclusion about the same passage, and neither the original judgement nor
the decision section written on top of it consulted it.

`r519` set `entities/Project.md::Description[1]` against `prd§34`. The note says a portfolio is
"one of the changes" admitting another root would force; §34 lists cross-project dashboards among
"likely later increments". The roadmap **anticipates** the change the note names rather than
denying it. Notably this row had just been split out of the coalesced pair one correction
earlier — the split was right, and it exposed that the row had never been a contradiction on its
own citations.

48 contradictions become **46**; 823 findings become **821**; `present` rises to 1,125. The
decision-4 section was written while both still stood and asserted things about both; it now
carries its own correction rather than the corrected text alone.

**A fifteenth correction: the citation column went stale while the state stayed right.** Splitting
presence by target type moved 36 forward named rows onto a different note without changing their
state, and nothing rewrote `matched`. So the published matrix said `Space` is present *and cited
`entities/Constraint.md`*, `Trade` cited `Work package.md`, `Zone` cited `Constraint.md` — every
one of them the incidental-prose hit the old substring search had found, and every one checkable
and wrong.

**`lookup.py --selftest` reported 686/686 across all of them**, because it compared only the
state. That is the defect worth recording rather than the 36 rows: a check that certifies the half
it can see and is silent about the half a reader actually follows is worse than no check, because
it is quoted as evidence. It now compares the citation too, and prints a second ratio for it.
Watched failing first by reverting one citation; it names the row and exits non-zero.

**A sixteenth correction: a cluster narrating rows the matrix does not contain.** Cluster E cited
`f258` and `f967` as contradictions — both `present` — and built its sharpest paragraph on a split
row, `f632a`/`f632b`, that **exists in no commit**. It also called `f632` "the one row in the
corpus that split" when 109 row groups split and `f632` is not among them. The cluster is now
generated from `findings.tsv`: 7 rows, 7 findings, each named with its own finding id.

What survives is the observation, and it survives on different footing. The ladder does disagree
with a sibling note, and both halves are quotable — `What is open[4]`'s admission that rung 1
"forbids" pricing before drawing, and `Start a renovation project.md`'s step 6 creating no
`Plans/` folder. But **the matrix cannot produce that finding**: every row runs between the new
evidence and a derived note, and there is no row shape for derived-against-derived. It is
therefore reported as a direct reading beside the counts, never inside them — the same footing as
the convention audit. A conclusion outlived the evidence it was first drawn from, and the ledger's
opening repeated it.

**A seventeenth correction, and the reason the two above are numbered separately.** Neither was
found by reading the narrative; both came from checking **every** id the clusters cite against the
committed matrix — 59 distinct ids, for existence and for state. That check found two more the
reviewer had not named: `f154`, which made the empty-state count read three when it is two, and
confirmed the rest. Fixing the two reported instances and stopping would have left `f154` standing.

**An eighteenth correction, to this section's own closing total.** The paragraph that stood here
read "Net across the three: 777 gaps become 775, 47 contradictions become 48, and 824 findings
become 823" — correct when it was written, for the **eleventh, twelfth and thirteenth**
corrections, and stranded when the fourteenth through seventeenth were added *above* it. Sitting
last, it read as this section's net, and it closed on 48 contradictions and 823 findings while the
matrix at that point held **46** and **821** — the fourteenth correction, three paragraphs up, is
what moved them.

**The verifier could not have caught it, and that is the more useful half.** `lbl` asks whether the
ledger prints each total *somewhere*; the Checks block prints all three correctly, so the gate is
satisfied no matter what any other paragraph says. A check for a number's presence is not a check
against its contradiction. Numbers in prose are still read by a human here, and this one was
missed on every pass that added a correction above it.

**Net as of this correction: 777 gaps become 775, 47 contradictions become 46, and 824 findings
become 821.** `lookup.py --selftest` is back to 686/686.

**Scoped to a moment rather than to a span, and the first draft got that wrong too.** It read "net
across every correction above that moved a count" — which sounds durable and is not: "above" grows
every time a correction is added below, so the sentence silently re-scopes itself onto work it was
never checked against. That is the same defect as "the three", one level up, and it took writing
the replacement to see it. A net figure is only ever true of a moment, so it now names its
moment; the **current** totals live in the Checks block, which is generated, and nowhere else in
this prose.

**A nineteenth correction, and it is this ledger citing itself.** The paragraph beginning
"`matched` names every body" used to carry its repair by quoting the report — "the report already
makes this argument in the forward direction", followed by a sentence in quotation marks — and
that sentence appears nowhere in this report. Its only copy in the repository is the `reverse` docstring in `lookup.py`, which is the
very repair the citation was offered as precedent *for*. A fix presented as the application of an
existing principle, resting on a quotation of itself.

**Measured instead, and the answer is not the one the citation implied.** The forward direction
does not name every note — it records one — and in this corpus it never had a second to choose
between. All **268** forward named rows targeting a names-it directory were replayed against
`lookup.py`'s own search: **262 match no note at all** and **6 match exactly one**, so `names_it`'s
`out[0]` was never a choice. The other 73 matched named rows target `entities/`, `components/` or
`actors/`, where the identity index is one note per thing by construction. **Zero forward named
rows had more than one addressing note**, and the instrument was tested against probes that do
find several before that zero was believed — `Project` matches 29 notes in `requirements/`, `Plan`
4 in `deliverables/`.

**What that leaves standing is the behavioural half, and it is a limit rather than a result.** A
forward behavioural row records one `path::locator` chosen inside a candidate set that often holds
many notes, so a reader who agrees while a second note in the same set disagrees is recorded as
agreement. The mirror is what catches it, and a count from the matrix is the evidence that it
does: **32 of the 45 contradictions rest on reverse rows alone**, against 13 on forward rows
alone — partitioned mechanically by the direction of every row behind each finding, so it is
re-derivable from `rows.tsv` and `findings.tsv` rather than asserted. That is a mitigation with a
number, not a proof of completeness, and it is stated here as the weaker thing.

The first draft of this paragraph said "7 of the 46", borrowed from the opening's *last 7 —
reached from the reverse direction only*. That figure is a claim about the order things were
**discovered** in — seven contradictions that appeared nowhere in the prose until late — and it is
not a partition of the finding set. Quoting it here would have read as mechanical because
everything around it is. Two different questions, and only one of them has an answer a reader can
recompute.

**A twentieth correction, and it is the biggest single omission review has found: `uxd§4` was
never swept.** The unswept list dismissed it in one clause — "`uxd§1` and `§4` are the document's
purpose and its reading guide" — and the classification was true of `§1` and simply carried across
the `and`. `§1` is a purpose statement that indexes what the document defines. **`§4` is titled
*Primary User Journey* and is a thirteen-node flowchart** running Open → existing project? → Create
or Continue → Project Home → Model Property and Spaces → Define Renovation → Plan Work → Estimate
Costs → Schedule → Execute → Track → Complete → Archive. Under this ledger's own extraction rule
— assertive mood, product behaviour as subject — every edge of it is a claim, and **zero rows
cited it**.

Seven rows now do (`f1009a`–`f1009g`), and they are not decoration:

- **One contradiction**, `c50`, narrated in cluster E above, which makes `Disclosure ladder.md` the
  most contradicted note by 8 rather than 7.
- **One gap**, `g778`: the journey terminates in **Complete** and **Archive**, and the backlog has
  no project completion state and no archival at all. The only `archiv` match in the whole
  backlog is `Spatial photo references.md`'s "photo archive" — incidental prose about a different
  noun. A lifecycle the evidence ends with, that the backlog never begins.
- Five `present`, which is the honest majority result and the reason the sweep was cheap.

**The category, not the instance — because the instance was luck.** `sections.py` has always
been able to see this: it reads which sections a body declares against which appear in a row's
`source`, and it printed `uxd … not swept: §1, §4, §31, §33` on every run. The instrument was
right and the prose beside it was wrong, and no check compared them, because the unswept list is
a *justification* and justifications are read, not executed. The list is now correct and
`sections.py` reports `uxd 31/34`; what has no gate is whether each remaining entry deserves its
place. Three do, on the rule as written. That is a reading, and it is offered as one.

**A twenty-first correction: the traced-contradiction count said 17 while its own artifacts said
15.** The opening paragraph read "**15** of the 46 contradictions come from evidence whose
standing the register records; each of those **17** was traced back … and all **17** read
faithfully", and the Checks block printed `received contradictions 17` and `traced 17 / 17`. One
sentence, two different answers to one question. `findings.tsv` holds **15** received
contradictions and `provenance.tsv` holds **15** verdict rows — they always agreed with each
other, and the fourteenth correction is what moved them: both rows it withdrew (`r519`, `r1640`)
matched `prd`, so received went 17 → 15 while only the first number in the sentence was updated.

**The verifier compares `provenance.tsv` against `findings.tsv` and never against the ledger**, so
15 = 15 passed on every run while the page printed 17. That is the eighteenth correction's lesson
arriving a second time in one round, in a different file: a gate that checks two artifacts against
each other proves nothing about the prose that quotes them.

**A twenty-second correction: four actor rows the evidence never named.** Review reported one —
`f325`, `Professional (actor)`, extracted from `JTBD-032`'s *"I want to identify **professional
needs** early"*, where the word is an adjective modifying a noun and names nobody. It was
`absent` against `actors/` because no note has that identity, so it became gap `g135` while
`f280` already carried the same job statement as a behavioural row: one source claim, counted
twice, the second time as a defect.

**The instance was right and the category was larger.** All four named rows this ledger derived
from JTBD job statements are the same mistake, and checking only the reported one would have left
three standing — which is the seventeenth correction's lesson, arriving again:

| row | from | the word, in context | why it is not an actor |
| --- | --- | --- | --- |
| `f324` | `JTBD-019` | "group work by **trade**" | a work category — and `Trade` is an **entity** here, already `present` on `f19`, `f441` and `r640` |
| `f325` | `JTBD-032` | "identify **professional** needs" | an adjective |
| `f326` | `JTBD-033` | "Prepare **contractor** scope" | an adjective, in the same construction |
| `f327` | `JTBD-031` | "Decide what to **DIY**" | a mode of work — the row's own subject hedged it as "(work mode/actor)" |

**One test, applied to all four rather than four judgements.** Does the passage name the term as an
identity the document declares, or use it as a common noun? The evidence *does* declare actors
elsewhere and those were extracted correctly — `prd§6.1`–`6.3`'s three personas, `research§4.1`–`4.5`'s
five segments, all `present` or `absent` on their own merits. The JTBD job statements are the only
place where a common noun was promoted to an identity, and the theme heading above them reads
*DIY & professionals* — plural, generic, and not a cast list.

**This is the `Wall` defect running backwards.** There, incidental prose (*"the wall went up"*)
produced a false **presence**; here, generic nouns produce false **gaps**. Same root — a string
match standing in for a thing — and the mirror image is worth naming because the earlier fix
looked complete and only addressed one direction of it.

**Removed rather than re-stated, and that is a departure worth defending.** The precedent in this
section is `f1284`: withdrawn by moving its state, never deleted. That was right there, because
`f1284` is a real claim that was judged wrongly. These four are not claims — the evidence does not
assert that a `Professional` exists — so no state in the five-state vocabulary is true of them.
`present` would be a lie, `retained` is for backlog things the evidence ignores, and a sixth state
meaning "should not have been extracted" is a vocabulary change to launder four bad rows. The
reasoning is what this section preserves; the rows go. Every source claim behind them survives as
the behavioural row it always had: `f267` (present), `f279`, `f280`, `f281`.

**Net: 776 gaps become 772, 823 findings become 819, and the matrix holds 3,073 rows.** Named gaps
go 416 → 412; behavioural gaps are untouched at 360.

**A twenty-third correction, which the twentieth caused and the twenty-second exposed.** The row
table splits the matrix two ways — by direction and kind, and by state. Adding `uxd§4`'s seven
rows updated the total and the states they landed in, and left `forward, behavioural` at **897**.
The four sub-rows then summed to 3,066 against a printed total of 3,073, and every check passed:
`lbl` asks whether each headline number appears *somewhere*, which says nothing about the rows
underneath it that are supposed to add up to it.

**A twenty-fourth correction, and the one that should have come first: the prose was never
compared to the artifacts.** Three more figures were found stale in a single round — the
undetermined contradictions reading 31 against a measured 32, the named-gap heading reading 416
against 412, and the Checks block reading 46 disagreement rows and findings against 47.

That is the sixth round in which review has found a number in this ledger disagreeing with
`rows.tsv` or `findings.tsv`: 546 against 548, 416 against 412, 46 against 47, 31 against 32, 17
against 15, and 2,247 against 2,249. Every one was fixed on its own, and every one was found by a
reader.

**The counts were never wrong.** They are computed from the committed data, and the recomputation
gate has agreed on every run. What drifted was the PROSE quoting them, and nothing in this
harness compared the two — the verifier checked the artifacts against each other and the ledger
against nothing. Six rounds of the same defect is a statement about the check, not about the
numbers.

All twenty headline figures are now swept against the artifacts on every run: the four
direction/kind sub-rows and their total, all five states, both finding kinds, the finding-set
size, received contradictions and their traced ratio, undetermined contradictions, the named-gap
heading, the gap split, both Checks disagreement lines, and the undetermined-findings sentence.
Keyed off what the data measures rather than pinned values, so a legitimate change updates what
is checked instead of failing — a pinned table would need editing on exactly the change it exists
to catch, which is the moment somebody edits it to whatever makes it pass. Watched failing by
moving one state count by one.

**Immediately, and this is the part worth keeping.** The sweep as first written covered twenty
figures and missed the decision-1 summary, which restates BOTH halves of the partition in prose —
"the 31 contradictions now carrying `undetermined` gain the standing the other 16 already have …
and all 16 came back faithful". Three stale numbers in one sentence, directly beneath a table that
was correct. Extending the sweep to four more figures caught all three **as a failing gate rather
than as a reading**, on the same run in which the edit meant to fix them had silently not applied.
That is the first time in this ledger a numeric drift was caught by a check instead of a reviewer,
and it happened within minutes of the check existing.

**Both breakdowns are now gated**, each required to sum to the total it sits under, and both
watched failing — reverting the one cell reports `expected 3073, measured 3066`, and breaking a
state cell instead reports `3076`. The first version of that gate failed for the wrong reason:
the pattern was anchored on the table's `├` box-drawing character, which is multi-byte UTF-8
inside a bracket expression and matches nothing under this locale, so it measured 0 and would have
been "fixed" by loosening the check it was supposed to be tightening. **A check watched failing is
not the same as a check watched failing for the right reason**, and only running the drill
separates them.

**A twenty-fifth correction: the unswept accounting lost a second entry.** `research §33`, the
strategic conclusion, is now swept — three forward behavioural rows, one of them a gap.

The paragraph excluding it conceded in its own words that the section "does assert", then excluded
it on two further grounds. Both fail against this ledger's own precedent. That it summarises
§§6–19 is not a reason: the rule counts by PAIR, and duplicated claims from distinct passages are
counted separately elsewhere — `c50` against `c42` is the worked example, added in this same round
of review. And that its last line calls itself "the research hypothesis" does not reach the
assertive sentences above that line, which are ordinary product statements.

What the sweep found. Two are `present`: "remembers relationships and history so the homeowner does
not have to" is what `business-rules/A change is a state on an object, not a second object.md`
argues at length, and the six things the user should know map onto `Task`, `Decision`, `Space`,
`Cost item`, `Change history` and `Schedule`. **One is a gap** — `g779`, "the winning experience
should make this feel simpler than the improvised tool stack, **not more sophisticated**". Five
backlog notes contrast the product with a spreadsheet and every one argues greater *capability*: a
spreadsheet "is a place to record a number somebody worked out; this is a place" that derives it.
Nothing in the backlog adopts feeling simpler as a constraint, and `research §33` is the only
evidence asking for it.

**This is the second entry that accounting has lost** — `uxd§4` was the first, in the twentieth
correction. Both were dismissed in prose beside an instrument that could see them, and the shape is
now twice-confirmed: a justification is read, not executed. `sections.py` reports `research 24/33`.

**A twenty-sixth correction, and the one that undercut the whole harness: the verifier was never
committed.** Every gate this ledger advertises — the finding-set recomputation, the candidate
replay, the provenance join, the citation check, the 28-figure sweep — lived only inside a code
block in the plan, written out to a scratchpad to run. **A clean checkout could run none of them.**
For the whole pass, the ledger's claims about its own checkability were exactly the defect the pass
exists to find: a claim wider than its mechanism. It is now committed at `verify-dod.sh` beside the
data it checks, and the plan points at that one copy rather than carrying a second that would drift
the way every duplicated count here has.

**A twenty-seventh correction: the sweep was built by enumeration, which is the defect it exists
to stop.** The 28-figure gate written one round earlier covered the places its author remembered.
Review found **nine more** across five sections it had never looked at — the orphans sentence, the
per-body forward list, the gap section's own headline and four restatements of its total, the
behavioural-gaps heading and the `rows.tsv` row of the artifact table. A gate assembled from a list
of known places has the weakness of any enumeration: the next member is the one nobody adds.

It is two mechanisms now. The targeted sweep stays, at **32** figures, for the places a bare number
sits under a heading with no word beside it to key on. Beside it runs a **net that finds the
numbers rather than remembering them**: every integer adjacent to a metric word — rows, gaps,
findings, contradictions — above a floor separating a total from a cluster size, checked against
the artifacts. It caught **three more the review had not named**, including a decision-summary
split reading `492 + 56` against a stated 546 when the measured answer was `490 + 57` of 547.

One consequence worth keeping: the per-decision note reading "48 contradictions become 46, and 823
findings become 821" is now a **delta** — *two contradictions withdrawn*. A running total quoted
inside a note about one decision goes stale the moment any other round moves it, and that sentence
had been wrong for four rounds.

**A twenty-eighth correction: the one worked example was not true.** The ledger prints a runnable
block offering `g92` as "the hardest case to take on trust", `cand_n` **0**, the command printing
nothing. Every mechanic in it is right — row `f184` does have an empty candidate set and the command
does print nothing — but `f184` belongs to **`g96`**. A reader running the block would have watched
`g96` come back and the label contradict it, in the one place the ledger asks to be taken literally.
Relabelled, and now gated: the finding id, the row it selects and the `cand_n` it states are checked
against `findings.tsv` and `rows.tsv` on every run.

**A twenty-ninth correction: `candidates.sh` carried `lookup.py`'s plural defect.** It built
`\b<term>s?\b` without stripping a trailing plural first, so a term arriving already plural got
`\bexampless?\b` — matching `examples` and never `example`. The candidate set silently narrowed,
and a candidate set is what bounds a reading, so an `absent` verdict could be certified against
fewer notes than the rule promises. `lookup.py` was repaired for this earlier in the same review;
the sibling instrument was never checked.

Measured rather than assumed: **38 rows carry a corrected `cand_n`** — 20 gaps, 10 present, 4
contradictory, 4 retained. The 18 non-gaps cannot move, because a wider set cannot unmake a match
already found. **All 20 gaps were re-judged against their corrected sets and none moved.** The
additions are overwhelmingly notes matching a generic word — fourteen ADRs joining on `examples` →
`example`, `components/Selection handle.md` on `spaces` → `space`. The five where an inventory note
genuinely joined were read: `Information Architecture.md` groups `Space` and `Zone` as nouns under
*Place* and names no Spaces View; the `Sitemap` has no next-actions entry; nothing addresses
per-trade meeting records. So the instrument was wrong, the published `cand_n` was wrong on 38 rows,
and no finding changes.

**A thirtieth correction: the two-word bound was too strong, and the shape of the hit is what
separates the cases.** Review found `Settings (IA top-level area)` reading `absent` against
`deliverables/` while `Sitemap.md` inventories it — `| Settings | Settings tab | PRD §83,
declarative | MVP | read | **yes** — one setting |`. A false gap, and its remedy said "backlog
gains a note" about a note the backlog has.

The bound was introduced two rounds earlier with its limit stated in this file: *"a genuinely
one-word screen name … still reads `absent`"*. Stating a limit is not the same as it being
acceptable, and review has now produced the instance. Ten of them.

Dropping the bound outright is the mirror defect, measured rather than argued: **41 rows move**,
most onto a word merely used in prose — `Work` on the Disclosure ladder's rung group, `Costs`
inside a Feature's body, `Tasks` on the title of `Task management.md`. The twin invariant that
settled the two-word case is **silent** here: all 14 one-word annotated rows carrying an
unannotated twin target `entities/` or `components/`, where the annotation never mattered, and the
corpus holds only two unannotated one-word rows into a names-it directory.

So the discriminator is not the length of the name but **the shape of the hit**. An inventory
lists a surface in its identity column; prose uses the word. A one-word name must now appear as
the **leading cell of a table row**. That moves **10 rows, every one into `deliverables/`, every
one matched by `Sitemap.md` or `Information Architecture.md`** — the two notes that exist to
inventory surfaces. Each was read: `| Budget | Bases view | PRD §41, SDD §13 | V1 |`,
`| Schedule | Bases view |`, and IA's grouping table `| **Work** | What has to be done, in what
order? |`.

**763 gaps, 810 findings, 402 named gaps**, `present` 1,142. Ten `Gap` findings withdrawn:
`g155`, `g157`, `g158`, `g213`, `g425`, `g426`, `g562`, `g670`, `g672`, `g673`.

**A thirty-first correction, and it is the gate working.** Restating the ten counts by hand missed
one — a `773` wrapped across a line break from the word `gaps` it labels. The labelled-total net
caught it on the same run, naming the line. That is twice now that this net has caught a **failed
repair** rather than the original drift, which is the case a human reader is least likely to
catch: the number looks attended-to because everything around it was.

**A thirty-second correction, found by testing the gate written in this same change.** Lifting the
freeze for the multi-project decision meant rescoping the derived-note gate to an allowlist. Its
informational line reported **0 edits outside the allowlist while a fifth note was edited** — the
allowlist and its helper were defined further down the file than the line that used them, so the
helper was undefined at that point and the count silently read zero.

The `chk` further down caught it, so the verifier still exited non-zero; but the line a reader
looks at said the constraint held. That is the third gate in this ledger found unable to fail —
after the derived-note gate that could not resolve a base, and the forward side with no coverage
gate at all — and the only one caught by deliberately breaking a rule to watch the gate refuse it,
rather than by review. Definition moved above first use; watched failing and passing.

**A thirty-third correction: the branch-base fallback ran the gate against the wrong base.** The
derived-note gate resolves a base from `origin/main`, then `main`, and — until now — fell back to
`HEAD~1`. That fallback was added to stop the gate passing when it could resolve nothing, and it
replaced *a gate that did not run* with *a gate that ran against the wrong thing*, which is worse
because it prints a number. In a workspace with neither ref, the diff examines only the tip commit
and misses a derived-note edit made in any earlier commit of the branch. This branch contains a
merge commit, so `HEAD~1` is demonstrably not its base here.

It now requires a real base — `origin/main`, `main`, or an explicit `REVIEW_BASE` — and fails
closed otherwise. Watched both ways in a clone with no remote and no `main`: without a base it
prints `FAIL cannot resolve the branch base` and exits 1; with `REVIEW_BASE` set to the root
commit it reports 224 notes edited, which is correct against that base and proves the diff is
branch-wide rather than tip-only.

**That is the fourth gate in this ledger found unable to fail**, and the second of the four to
have been *introduced by the repair of another one*.

**A thirty-fourth correction: `c1` was not a contradiction.** It set `prd§3` — "the renovation
project is the primary UX object" — against `Disclosure ladder.md`'s "Project-first to create,
**plan-first thereafter**". Those are **two different surfaces sharing the word *home***. `prd§3`
lists what a user should understand *on opening the plugin*: which projects exist, which was
recent, its state, what needs attention. The ladder answers
[[Information Architecture]]'s open question 1, which is about the landing surface *inside* a
project once a plan is calibrated. A plan-first mode within a project does not stop the project
being the primary object, and the multi-project decision has since made the two surfaces
explicitly distinct.

46 contradictions, 809 findings, `present` 1,143, received contradictions 14 traced 14/14. Cluster
D loses a row and cluster E goes to **7**, which also corrects the most-contradicted-note figure
from 8 back to 7 — a number the sweep did not cover and which was stale in three places. It does
now, along with the A–G cluster total, at 35 swept figures.

**A thirty-fifth correction, and the third time the refutation was already written in this
ledger's own materials.** `c6` set `prd§20.5` "No Mandatory Floor Plan" against
`Disclosure ladder.md::What is open[4]` — the disagreement the design spec named as its **own
motivating example**. That passage does not assert a floor plan is mandatory. It *asks*: "Does
rung 2 need a plan at all?", observes what the ladder currently does, and closes "Whether that
renovator exists is a product question". A note that declines to answer cannot be contradicted by
a document that answers — the same rule that withdrew `r1640`.

**`provenance.tsv`'s own verdict for `c6` said exactly this** and had said it all along: *"it
concedes the tension rather than asserting an answer, so workspace PRD §20.5 settles a question
the note already flagged as open rather than contradicting a claim."* Written, committed, and
never read back against the finding it describes.

That is now three: `c47`/`r1640`, `c49`/`r519`, and this one. The trace was run to answer whether
a derived note had **drifted from its sources**, and its prose kept answering a second question —
*is this a contradiction at all?* — that nothing consumed. A gate now reads it back: a provenance
verdict saying the passages do not conflict, on a finding still filed as a Contradiction, fails.

**Its limit is stated because the check cannot reach past it: that gate matches a phrasing, not a
meaning.** It is deliberately narrow, and the reason is `c2` and `c7`, which were caught by the
same scan and **kept**. Both say "new evidence, not a drift" — which is the *normal* case for this
ledger: the derived note is faithful and the disagreement stands between two received documents.
Withdrawing those would have deleted the finding class the pass exists to report.

45 contradictions, 763 gaps, 808 findings, `present` 1,144, received contradictions 13 traced
13/13. Cluster E drops to **6**, and with it the most-contradicted-note figure. The sweep caught
four Checks-block lines I missed restating by hand, and the cluster gate caught two bullets still
citing the withdrawn `c6`.

**A thirty-sixth correction, and it is in the decision record written one commit earlier.** The
new `issues/` note opened by saying **three** derived notes opposed multiple projects and that the
reconciliation "traced all three … and found them faithful". Only **two** did. `r1640` — the
`Start a renovation project` precondition — was withdrawn to `present` by the thirty-fourth
correction's own rule: a note that declines to answer cannot be contradicted by a document that
answers.

So a decision record written to settle a disagreement **reintroduced a premise this ledger had
already retired**, three commits after retiring it. That is the same shape as the Disclosure
ladder's split row — a conclusion outliving the evidence it was drawn from — committed this time
inside the artifact meant to be the authority on it.

The record now names `c2` and `c3` as the two contradictions, and describes the third note
separately and accurately: it is edited because this decision **settles the question it flagged as
open**, not because it opposed anything.

**A thirty-seventh correction: a per-body row count restated outside its table.** The coverage
paragraph said `jtbd` produced **99** forward rows; the matrix and the summary table three sections
above both say **95**. The labelled-total net could not see it — at 95 it sits below the `rows`
floor that exists to skip cluster sizes, so the floor that keeps the net quiet is exactly what hid
this one. Now in the targeted sweep, which is what that sweep is for, at 36 figures. Watched
failing.

**A thirty-eighth correction, and it is the first one where looking for the class found more than
the review reported.** Six restatements of a total, in five sections, all stale after `c1` and `c6`
were withdrawn: the most-contradicted note as "8 of the 47", the orphans sentence as "47 places",
the received-standing sentence twice as "15", the provenance line as "the 15 verdicts", the
coalesced-pair paragraph as "47 disagreement rows resolve to 47 findings", and the direction
partition as "32 of the 47 … against 15". Review named four; the last two were found by asking what
the four had in common.

**What they have in common is that the labelled-total net finds a number by the word beside it.**
Three of these name a total with a word that is not a metric word — *places*, *verdicts*, and a
bare *8 of the 47* with no noun at all — and two sit below the `findings` floor. None was reachable
by the mechanism that exists to find drifting totals, and all six were **second copies of a figure
stated correctly elsewhere in the same document**. That is now true of every stale number this
ledger has produced: the computed counts have never been wrong, and the duplicates have never all
been updated together.

**So there is a check that runs the other way round.** Instead of asking whether a number is right,
it asks whether a number is one this ledger has *already moved past* — and the set of those is
harvested from the corrections section by the same METRICS the net uses, so it is keyed off this
document's own history rather than a list of places, and it holds for figures not yet written.
Three exclusions were measured rather than assumed, costing four false positives and no true ones:
a table cell counts something else, a locator is not a total, and one live sentence deliberately
quotes stale figures to explain why it stopped printing them. Watched failing on the two
restatements review had not named.

**Its limit, stated because the measurement showed it rather than because it sounds careful:** the
small superseded values collide with legitimate counts of other things — 17 component notes, 16
prototype sections — so the harvest keeps the METRICS floors and this check sees **totals only**.
The received-contradiction restatements corrected here are below that scale and stay in the
targeted sweep, now at 43 figures. Two mechanisms, neither covering the other, and that is why
both are described.

**One of the six lives below the corrections heading**, inside correction 19, and states a
present-tense fact re-derivable from the artifacts. The live half is bounded by *position*, and
position turned out to be a proxy for liveness that fails on a correction which explains a figure
by restating it. Running the net over the whole document was measured instead of assumed: **21
hits, 20 of them legitimate history** — deltas, quotations and per-correction snapshots that must
stay stale. So the boundary is right and that paragraph was misfiled; it is checked by name.

**A thirty-ninth correction, and the first one that is a category error rather than a count.**
`prd§24` heads four worked examples of an empty state — *No Projects*, *No Spaces*, *No Work*,
*No Costs* — each followed by nothing but a message and its buttons. The named-thing extractor
read each heading as the name of a separate component and filed four `absent` rows into
`components/`, producing four gaps whose remedy read *"backlog gains a note"*.

**The backlog already has the note.** `components/Empty state.md` models exactly one component and
says so twice: *"It is a state, so it has none of its own. What varies is the cause"*, and a
Contract reading *"Given a message and at most one action."* What each of §24's four blocks
contains is a message and its actions — **the inputs that Contract says are passed IN**, not a
component definition. That is what makes them four configurations of one component, and §24's own
opening sentence — *"Every major view must define an actionable empty state"* — is singular.

**Deliberately not "each block satisfies the one-action contract", because one does not.** *No
Spaces* offers `[Add Space]` and `[Import Floor Plan]`, which is the disagreement `f647` records
and which survives this correction. Being a configuration of a component and being a *conforming*
one are different claims, and the first draft of this paragraph asserted the second — eight lines
above the sentence that contradicts it.

**The rows were removed rather than moved to `present`, and the reason is that they were already
counted.** `f646`–`f649` read the same four passages behaviourally and are still in the matrix, so
`prd§24` loses no coverage: what goes is a second, wrong reading of passages the matrix already
holds. Marking them `present` would have kept four duplicate rows and inflated the row total by
the same four. **`f647` survives and still disagrees** — *No Spaces* offers two actions where
`Empty state.md` says *"One action, not several"* — so removing the named rows withdraws four
false gaps without touching the one real finding in that section.

**Checked at the shape, not by listing the four.** An `absent` named row into an identity
directory asserts the backlog is missing a *thing*; if its subject ends in the full title of a
note already in that directory, it is that note qualified. Run across all 48 absent named
component rows, the test returned exactly the four review named and nothing else, which is what
made it a gate rather than a cleanup.

**Its scope is a measurement and the measurement changed it.** `components/` and `actors/` report
zero. `entities/` was tried and reports **eleven**, and reading them is what settled it: an entity
subject is frequently a verb phrase that merely ends in an entity name — "Start with a Blank Plan
(starting method)", "Import Plan (project entry mode)", "Starting Method options: Import a Floor
Plan, Draw a Plan, Start Without a Plan". None of those is `Plan` configured; each is a choice a
wizard offers. The tail test cannot separate an adjectival qualifier from a verb phrase's object,
so `entities/` stays out — and the reason recorded is the reading, not the count, because
excluding a directory until a gate goes quiet is the move this ledger warns about.

**One of those eleven may be the real thing, and is deliberately left alone.** `f389` asks
`entities/` for a *Last Project* note while `Project.md` exists; that is an adjectival qualifier
and it fits the shape. Re-judging a row the review did not raise, on a pinned matrix, belongs to
its own pass with its own reading rather than to the commit repairing a different row. Recorded
here so it is not lost.

**And removing four rows moved a figure the sweeps still could not see**, which is the same blind
spot one round later: the Checks block's `lookup.py --selftest` ratio is the *named row count*,
and at 678 it sits below the `rows` floor exactly as `jtbd`'s 95 did. Found by running the
selftest rather than by any gate. Now computed from the matrix, taking the targeted sweep to
**44 figures**. The general net's floor is not the defect and lowering it is still refused; what
this says is that every figure below totals scale has to be named, and the way they keep being
found is by running the instrument rather than by reading the page.

**A fortieth correction: both instruments now take `RP_CORPUS_ROOT`.** `candidates.sh` took it and
`lookup.py` did not, so a replay of the named half silently read the working tree while the
behavioural half read the corpus the matrix compared. **That is the same defect review found in
`candidates.sh`, in the other direction** — one instrument repaired, the other not checked beside
it, which is now the second time this pair has done exactly that to itself. `sections.py` has it
too.

**The reason given for that change was WRONG, and the correction is the more important half.**
It said `main`'s plan-editor work had moved the corpus — that two new evidence files,
`concepts/renovation-canvas.html` and `concepts/canvas.css`, name *Design System* where the old
ones did not, so `r1366` legitimately flipped `retained` → `present`. **Neither file is in
`BODIES`.** `lookup.py` reads exactly one file from that folder, `component-gallery.html`, so
neither could have moved anything. The claim was checked against the wrong thing: the corpus
directory was compared, and the instrument's own body list was not.

**A forty-first correction, and it is the one that matters: the fix in the previous commit made
the gate green while leaving the tool wrong.** The real cause of `r1366` is that `lookup.py`'s
back-link guard assumed a fixed depth. An evidence document linking BACK to a derived note is not
the evidence naming the thing, so the anchor is stripped before the body is searched — and
`BACKLINK` matched exactly one `../`. The gallery moved a directory deeper, its footer became
`../../deliverables/Design%20System.md`, the guard stopped matching, the anchor *text* survived
into the searched body, and `reverse "Design System"` answered **`present gallery` from a link
that means the opposite**.

**Pinning the replay is right and was not the fix.** It made `verify-dod.sh` green while the
published command a reader actually runs stayed wrong on the corpus a reader actually has. That is
the one repair this harness must never accept, and it was committed here — one commit after the
ledger recorded that two of four gates unable to fail had been *introduced by repairing another
one*.

The guard now accepts any run of `./` or `../`, with or without a `docs/` prefix: **the folder is
what identifies a backlink, not the route.** `reverse "Design System"` answers `retained` on the
working tree again, and the unpinned selftest is back to **678/678** — so the corpus had never
moved in a way the matrix depended on, and the 677/678 quoted in the fortieth correction was the
parser being broken, not the corpus having changed.

**The new gate asks the forbidden thing directly rather than watching for a symptom.** Every
`<a href>` pointing into a derived folder, in any body `lookup.py` reads, must be matched by
`BACKLINK` — corpus-independent, so a new path spelling fails it whether or not any row's state
happens to move. Watched failing by restoring the fixed-depth regex, and it named **three**
backlinks where the row-state selftest had noticed one: the two `../../components/` links moved no
state at all and were invisible to every check this ledger had. It reads `BODIES` and `BACKLINK`
by importing `lookup.py`, which needed a `__main__` guard, because a gate holding its own copy of
the thing it checks is a gate that drifts.

**The two checks are now split by what each can guarantee, and neither is described as covering
the other.** The pinned selftest guarantees the published matrix reproduces against the corpus it
compared. The back-link contract guarantees the parser is correct on the corpus that exists now.
Pinning without the second is how a green gate hides a broken tool.

**And the check on the second instrument was worthless the first time it was run.** `sections.py`
agreed with itself pinned and unpinned, which looked like evidence it was safe — until reading the
file showed it never consulted `RP_CORPUS_ROOT` at all, so both runs had read the working tree and
the agreement measured nothing. It now honours the variable, and the comparison means what it
appeared to mean. *Measure a set with an instrument that can see all of it, and test the
instrument first* — recorded here because this ledger states that rule and then broke it while
checking the repair for a different instance of it.

**A forty-second correction, and it is the third ordering defect in this harness.** The
`sections.py` selftest expanded `${PINNED:-.}` **above** the `git archive` that creates the pinned
tree, so it resolved to `.` on every run: a check this script and this ledger both described as
pinned read the working tree instead. Review found it; nothing here could, because every gate that
looks at pinning asks what the *tools* accept rather than what the *script* passes.

**Its consequence today is nil, and saying so is the point.** `sections.py` agrees pinned and
unpinned on the current corpus — the numbered headings it counts have not moved. So this corrects
a false *claim*, not a wrong *number*, and it would have become a wrong number the first time an
evidence body gained or lost a heading, failing for a change that had nothing to do with it.

**Fixed by moving the definition above every use rather than the one call below it.** Review's
remedy — move the invocation after the archive — repairs the instance and leaves the next
`${PINNED}` added above that point silently unpinned. The same distinction settled the allowlist
helper that was defined below its own first use, which is the ordering defect this one repeats.

**And the general check was measured, then refused.** A "no variable used before it is assigned"
scan over this script reports **seven** hits and all seven are false: a function's own loop
variable, an assignment following a `;`, and a mention inside a comment. Getting those right needs
a bash parser, and a gate that needs a parser it does not have is exactly the defect this harness
keeps catching in itself. So the check covers the one variable whose ordering is load-bearing and
says that, rather than claiming the class. Watched failing by putting the `sections.py` call back
above the archive, which reproduced the original defect at the original line.

**A forty-third correction, and it is about the sweep itself rather than a number.** Withdrawing
`f412`–`f415` moved the named-row count to 678. The Checks block was updated and **three other
copies were not** — the runnable example (`replays all 682 named rows`), the sentence beneath it
(`682 of 682`), and the artifact table (`replaying all 682 named rows`). The targeted sweep passed
clean on all three.

**It passed because `re.search` is satisfied by ONE occurrence.** An entry asserts that the right
value appears *somewhere*; it says nothing about the other copies. So the mechanism built to catch
stale figures was structurally blind to the one thing every stale figure in this ledger has been —
**a second copy of one that was right.** Ten rounds of that pattern, and the check could not see it
by construction.

**Inverted for the figures that get restated:** a *shape* with a numeric group, where every match
in the live half must equal the measured value. One shape covers all copies of a figure, the ones
written and the ones not yet written. Watched failing by restoring exactly one of the three — the
new scan names it at its line, and the old `re.search` entry stays green, which is the whole
demonstration.

**The general version was measured and refused.** Scanning the live half for any *number + unit*
and flagging a unit stated with two different values reports **nine** units, essentially all
legitimate: `rows` alone correctly carries 2, 4, 6, 7, 37 and 66 across cluster sizes and totals.
Internal disagreement is not by itself a defect in a document that counts many things, so this
stays per-figure and says so rather than claiming the class.

**Its bound came from the check reporting a hit it should not have.** Run over the whole document
it flagged correction 7's own *"18 named rows"* — a count of the rows that correction moved, not
the total. The historical half quotes superseded figures **on purpose**, so the scan is scoped to
the live half, exactly as the labelled net and the superseded check already are.

**A forty-fourth correction: the disproven explanation was still sitting in the tool.** The comment
introducing `RP_CORPUS_ROOT` in `lookup.py` recorded the corpus-move diagnosis as fact — that two
new evidence files had *"correctly"* flipped `Design System`, and that pinning was the fix. The
forty-first correction disproved both, in the commit immediately after, and never went back to the
file where the claim had been written down.

**That is the unsolved class this ledger has named three times, now caught inside an instrument
rather than in prose:** something written on top of a finding is not revisited when the finding
moves. The comment now records the wrong reason *as* the wrong reason — because it was written
into the file as fact, and a maintainer reading only that file would have been misdirected by it —
and states the rule the episode actually established: **pinning is not a fix for a parser.**

**A forty-fifth correction, and it is the cost of the variable that fixed the last one.**
`lookup.py`'s docstring promises *"Run from anywhere in the repository"*, and adding
`RP_CORPUS_ROOT` made that false: a **relative** override was resolved against the caller's
directory, so `RP_CORPUS_ROOT=. lookup.py` run from `docs/` looked for `docs/docs/prds/…` and
traced back. `sections.py` had the identical code, having been given the variable in the same
commit.

**`candidates.sh` never had it**, because it `cd`s to the repository top level before it reads the
variable — so the three instruments disagreed about what a relative root means, and two of them
disagreed silently. Both now resolve a relative override against the top level, which is what
`candidates.sh` already did; an absolute override is taken as given.

**The gate runs them the way the claim says they can be run** — from a subdirectory, in both the
unset and relative forms. A promise in a docstring is worth exactly what exercises it, and this one
had been false since the commit that made it, two commits ago.

**Its first version reported the tool broken when the tool was fine.** The check passed the
subject's arguments through an unquoted variable, so `Design System` split into two words, the CLI
printed its usage and exited non-zero, and the gate announced a failure that did not exist. Caught
by watching it — the run that was supposed to be green was red, against a manual run that was
green. *Measure with an instrument that can see the thing, and test the instrument first*: the
second time in three corrections that the check, not the subject, was the defect.

**A forty-sixth correction, and it draws a line the last three corrections kept blurring: the
CORPUS is pinnable, the MATRIX is not.** `RP_CORPUS_ROOT` exists so a replay can read the evidence
bodies as they stood. `sections.py` resolved `rows.tsv` through the same root, so a pinned run
measured pinned evidence against **the archive's matrix** — four rows out of date, still holding
the empty-state rows withdrawn since. `lookup.py` never had it, because its artifacts hang off the
script's own directory; `sections.py` now does the same.

**It happened not to change the answer, and that is the whole danger.** Those four rows removed no
section's last row, so the coverage table was identical either way. The first correction that
removed one would have made the published pinned command report the old matrix and say nothing
about it.

**Checked behaviourally rather than by reading the source:** run the instrument against two roots
differing *only* in `rows.tsv` — the pinned tree, and the same tree with `rows.tsv` emptied — and
require identical output. Pre-fix the swept column collapses to **0** for every body; post-fix the
two runs are byte-identical.

**The first probe proved nothing, and finding that out is the lesson worth keeping.** It used
`--selftest`, which exits before `swept()` is ever called — so it passed against the broken
instrument and the fixed one alike. A probe that cannot tell the two apart is not evidence. It was
only caught by watching it fail and seeing it *not* fail. **Third time in four corrections that the
check, rather than the subject, was the defect** — and the first two were caught the same way,
which is the argument for never trusting a green gate that has not been watched red.

**A forty-seventh correction, and it was inside the correction that repaired something else.**
The thirty-ninth said *"a message and at most one action is precisely what each of §24's four
blocks contains"* — and one does not. *No Spaces* offers `[Add Space]` and `[Import Floor Plan]`,
which is the disagreement `f647` records, **stated eight lines further down the same correction.**

**The argument never needed that claim.** What makes the four blocks configurations rather than
components is that each is a message and its actions — the inputs the Contract says are passed IN.
Whether a given block *conforms* to the one-action rule is a separate question, and for one of them
the answer is no. Being a configuration and being a conforming one are different claims; the draft
asserted the second while the correction's own conclusion depended only on the first.

**A forty-eighth correction: the ordering gate was anchored three lines early.** It took the first
`PINNED=` match as the point the variable becomes usable — but that is `PINNED=""`, an initialiser
sitting above the `git archive` that fills it. An expansion inserted in that gap, **the exact
regression this gate exists to prevent**, would have been judged late enough and passed.

It now anchors on the `fi` that closes the materialisation block, and allows only the block's own
construction lines to expand `$PINNED` before it. Watched failing by inserting an expansion between
`PINNED=""` and `git archive`: the new anchor names it at line 55, and the old anchor reports zero.
**Fourth time in five corrections that the check, rather than the subject, was the defect** — and
this one was a gate written to catch an ordering defect, holding an ordering defect.

These are recorded rather than quietly removed. A finding set that reports its own false
positives is worth more than one reporting only successes, and five of the 52 originally claimed
contradictions did not survive checking, while a fifty-third was found hiding inside another — a
rate consistent with the 25% verdict movement this ledger already reports for the judged half,
and a reason to read the citations rather than the totals.

## Checks

```
rows                                              3072
  every row holds exactly one of five states      yes (0 blank, 0 outside the vocabulary)
notes reached by any reverse row                  227 / 227
notes reached by a reverse behavioural            227 / 227
disagreement rows                                   45
disagreement findings                               45
coalesced pairs, counted directly                    0
finding set recomputed from rows.tsv          identical as a SET to findings.tsv
candidates.sh reproduces the committed cand_n     15 / 15 sampled rows (fixed
                                              seed, both directions, empty sets
                                              included)
lookup.py reproduces the committed named state   678 / 678 named rows (2 named,
                                              and moved onward by a reading)
gap findings, by the row kind behind them        398 named + 361 behavioural
findings with no evidence citation                   0
undetermined findings proposing an edit              0
received contradictions                             13
  traced to the sections their note cites           13 / 13
  derived notes found to have drifted                0
sections.py --selftest                        instrument agrees with a second
                                              implementation and three pinned counts
derived notes edited outside the allowlist            0
  (the allowlist is the 4 notes the multi-project
   decision authorises; the other 223 stay frozen)
npm run check                                 passes all four steps
```

**The reconciliation edited no derived note, and four have been edited since — under the
multi-project decision and only under it.** Checked against the merge base, not the working tree,
and as an **allowlist rather than a removal**: `entities/Project.md`,
`actors/Professional planner.md`, `requirements/Start a renovation project.md` and the decision
record `issues/The vault holds many projects, and selecting one is not a portfolio.md` may differ;
the other 223 may not. Deleting the gate to permit four edits would have retired this pass's
central guarantee, and nothing would then notice the fifth.

**The matrix is pinned to the corpus it compared against**, commit `2253cea`. That is not
bookkeeping: those four edits move the candidate set of **1,205 behavioural rows**, a fifth of the
matrix, because a new note and three edited ones enter sets that `cand_n` counted without them.
Replaying `candidates.sh` against the working tree would measure a different corpus and report the
committed numbers as wrong. `verify-dod.sh` materialises the pinned tree and replays against it;
`candidates.sh` takes `RP_CORPUS_ROOT` for the same reason, and reads the working tree when it is
unset, which is what a reader wants while the backlog has not moved.

**No finding was moved by the edits.** A gap says the backlog had no note for something *when the
comparison ran*; the backlog gaining one afterwards is that finding being resolved, and resolution
is recorded in `remedy`. Moving the rows instead would erase the disagreement the decision was
taken to settle.

```bash
git diff --name-only "$(git merge-base origin/main HEAD)"...HEAD -- \
  docs/requirements docs/entities docs/business-rules docs/components \
  docs/actors docs/deliverables docs/adrs docs/issues | wc -l   # 0
```

The instrument closes: **5** note types consume named-thing rows against **5** producer targets
(`entities/`, `requirements/`, `components/`, `actors/`, `deliverables/`); **8** note types consume
behavioural rows, fed from all **8** in-scope evidence bodies; and all **4** finding kinds name the
corpus they come from — Contradiction, Gap and Orphan from the matrix, Convention from the
register's own documents. `Retained` is deliberately not among those four: it is a state the
reverse pass records, and 1,124 rows carry it.
