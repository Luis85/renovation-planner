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
  approved. **No derived note was edited** — the check is in the last section.
- It states its own coverage limits where a reader meets them, and its instrument's limits
  beside the numbers those limits qualify, rather than letting "reconciled" read wider than it is.

`npm run check` passes all four steps.

## What was found

**46 contradictions, 775 gaps, 0 orphans, and 4 convention findings.** The contradictions are
the useful half, and they concentrate rather than scatter — seven themed clusters carry 29 of
the 46, and `deliverables/Disclosure ladder.md` alone accounts for 7.

The single most contradicted document in the backlog is **`deliverables/Disclosure ladder.md`**,
and its disagreements are not only with the new evidence: it contradicts its own sibling notes
about whether costing requires a drawn plan. A note that disagrees with the new layer *and*
with the backlog it belongs to is the most consequential thing this pass could have surfaced.

**No orphans at all.** Across 3,070 rows and eight evidence bodies, not one passage *replaces*
a derived claim rather than merely disagreeing with it. That is a result, not an absence: the
UX layer contradicts the backlog in 46 places and supersedes it nowhere.

**And not one derived note has drifted.** 15 of the 46 contradictions come from evidence whose
standing the register records; each of those 17 was traced back to the sections of the *original*
PRD and SDD that its derived note cites, and all 17 read faithfully — the note asserts what its
source asserts. **No contradiction in this ledger authorises correcting the backlog on its own.**
Every traced one is a received document disagreeing with a received document, which is a choice a
person makes, not an error a reconciler repairs. The other 31 come from the two folders the
register does not classify and cannot be traced until decision 1 is taken. `provenance.tsv` holds
the 17 verdicts with the sections each was read against.

## The counts

Rows and findings are different things and are counted separately.

| | |
| --- | --- |
| matrix rows | **3,070** |
| ├ forward, named | 501 |
| ├ forward, behavioural | 897 |
| ├ reverse, named | 185 |
| └ reverse, behavioural | 1,487 |
| **rows by state** | |
| `retained` | 1,124 |
| `present` | 1,125 |
| `absent` | 775 |
| `contradictory` | 46 |
| `superseded` | **0** |
| **findings** | |
| Contradiction | **46** |
| Gap | **775** |
| Orphan | **0** |
| Convention (separate audit, outside the matrix) | **4** |

**The coalesced-pair count is 0, counted directly.** 46 disagreement rows resolve to 46
findings. It was 1 until review checked the pair that produced it: `r519`'s `pair` field had been
copied from `f494` instead of built from its own citations, which made two different pairs
byte-identical and coalesced two findings into one — the twelfth correction below. The count is
still reached by identifying pairs and checking them, never by subtracting findings from rows:
1,125 `present` and 1,124 `retained` rows raise the row total while producing no finding, so that
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

All eight evidence bodies contributed forward rows: prd 434, canvas 197, prototype 177, uxd 163,
wireframes 147, jtbd 99, research 117, gallery 64.

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
| uxd | 30 | 34 | §1, §4, §31, §33 |
| research | 23 | 33 | §2, §3, §5, §20, §26, §27, §28, §29, §32, §33 |
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
  and `§4` are the document's purpose and its reading guide.
- **Not about this product.** research §20 is a friction matrix whose subject is Excel, Notion,
  Trello and paper.
- **One that is a genuine judgement rather than a category.** research §33, the strategic
  conclusion, does assert — "the product should help the user move from *I have information
  everywhere* to *I know what we are doing*" — but it summarises §§6–19, which are swept, and its
  own last line calls itself "the research hypothesis Renovation Planner should now validate".
  It is left out on those two grounds, not on the rule alone. `uxd§33` is the same shape: the
  document's own definition of done.

**A swept section is not a fully-read section, and this table cannot tell the difference.** It
measures *reach* — did anything come out of this section — not *depth*. Research §21 is the
worked example and the reason the caveat is here rather than implied: it was counted swept on
three rows, and it holds 23 consolidated user wishes. The other 20 were recovered in a late pass
and are in the counts above. Nothing in this instrument would have found that; a reader who wants
depth has to read a section against its rows.

**Two rows of that table have no number, and the ratio is withheld rather than invented.** `jtbd`
numbers its content `JTBD-001`…`JTBD-063` rather than `§N`, so a section counter reads 0 against a
body that *was* swept, producing 99 forward rows — all 63 job statements were counted and match
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
section landed on opposite verdicts for that reason alone. `f1284` is withdrawn below. **The 775
gaps carry this limit in the same shape**, and it points one way only: it can invent a gap, never
hide one.

## Contradictions, by cluster

**All 46 appear below**, and every one cites both sides. Seven themed clusters carry 29, section
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

**5 rows.** The entity notes model `Site` as the container of Building and Outdoor area. The new
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

- `f463` — `prd§3` "the renovation project is the primary UX object" vs
  `deliverables/Disclosure ladder.md`: "Project-first to create, **plan-first thereafter**… the
  home surface is the plan from the moment a calibrated one exists."
- `f1109` — `uxd` "Open Project always opens Project Home" vs `deliverables/Sitemap.md::The
  routes[1]`: opens "in `editor` once a calibrated Plan exists, and in `project` before that".
- `r1419`, `r1442` — the same two deliverable claims, reached from the derived side against
  `prototype§9`'s interaction contract: "Open(project) **always** enters Project Home."
- `f574` — `prd§13`'s primary navigation (Overview, Spaces, Design, Work, Budget, Schedule,
  Documentation) vs `Sitemap.md`'s exhaustive inventory, which has one `renovation-project` view
  plus Bases views and **no Spaces, Design or Documentation destinations at all**.

### E. The Disclosure ladder contradicts the new evidence *and* its own siblings

**7 rows — the most contradicted note in the backlog.**

Its rungs gate cost on "the first Zone existing" and Work behind cost, so Work is reachable only
after a Zone and a cost. Against that:

- `r1410` — `uxd§22`'s Progressive Disclosure Model puts Work and Budget together, **ungated, at
  Level 1**, with Plans and Zones at Level 2.
- `r1409` — `prototype§6`'s canonical fixture attaches a €2,500 estimate directly to Kitchen work
  with **no Zone ever created**; `canvas§9` shows "Estimate Optional [€2,500]" on Work itself.
- `r1408` — Rung 1's "measured plan" against `canvas§5` ("Level 1 — Conceptual: **No measurements
  or drawing required**") and the prototype golden path, which runs Start Without a Plan →
  Initial Spaces → Project Home with no measured-plan step.
- `f610` — `prd§17` groups tasks with the *basic* capabilities; the ladder puts Task at rung 3
  with Trade and Work package.
- `f258`, `f632a`, `f967` — three separate evidence bodies asserting a floor plan is optional,
  against the ladder's own admission in `What is open[4]`: "Someone pricing a renovation before
  drawing anything would want *Money* without *Place*, **which the ladder currently forbids by
  making rung 1 universal**."

**`f632` is the one row in the corpus that split**, and it is the sharpest result here. The claim
is the workspace PRD's §20.5 "No Mandatory Floor Plan" — the disagreement the design spec named
as its own motivating example. Two candidates address it with **opposite** verdicts:

- `f632a` `contradictory` against `deliverables/Disclosure ladder.md::What is open[4]`;
- `f632b` `present` against `requirements/Start a renovation project.md`, which writes only a
  project note and creates no `Plans/` folder until something is drawn, and
  `issues/The plan editor is a mode, not a second view.md`: "A renovator with no plan is not
  looking at a locked second view."

**So the backlog disagrees with itself**, and the PRD agrees with one half of it. A single
`matched` field would have recorded whichever note the reader opened first, and either answer
alone would have misled.

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
- `f154`, `f647`, `f1115` — three evidence bodies specify empty states with **two** actions,
  against `components/Empty state.md::Anatomy[2]`: "One action, not several. A surface with three
  suggestions has not decided what a user should do first."

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

**775**, of which 416 are named things the evidence names with no note behind them and 359 are
behavioural claims no note addresses. The named/behavioural split and the per-body breakdown are in `findings.tsv`.

They are not 775 separate problems. **Whole epics of the new PRD have no derived counterpart**,
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
rows from three. The 775 is a row-derived count, honestly produced and not deduplicated by
subject, and the clusters above are the shape a reader should act on.

**Every one of the 775 is re-runnable, and both commands are committed — two, because the two
row kinds are two mechanisms.** A named row is a *lookup* that settles the row on its own; a
behavioural row is a *candidate set* that bounds a reading. One command cannot answer both, and
publishing one and claiming both is the error this ledger keeps catching in itself.

**359 behavioural gaps** — [`candidates.sh`](2026-08-24-ux-layer-backlog-reconciliation/candidates.sh),
given the row's `direction` and `terms`:

```bash
D=docs/reviews/2026-08-24-ux-layer-backlog-reconciliation
awk -F'\t' '$7=="f184"' $D/findings.tsv                       # g92, a Gap, from row f184
awk -F'\t' '$1=="f184"{print $2, $6, $7}' $D/rows.tsv         # forward · terms · cand_n = 0
bash $D/candidates.sh forward "interaction promise,awareness" # prints nothing: the set is empty
```

`g92` is the worked example because it is the hardest case to take on trust: `cand_n` is **0**,
so no judgement was involved at all — the ladder resolved it to `absent` mechanically. The
command is the whole of that decision, and it either prints nothing today or the finding is wrong.

**416 named gaps** — [`lookup.py`](2026-08-24-ux-layer-backlog-reconciliation/lookup.py), given
the row's `target` and `subject`. It is type-aware, alias-resolved and back-link-guarded, which
`candidates.sh` is none of, so it prints `Project Home`'s two answers rather than their union:

```bash
python3 $D/lookup.py forward requirements  "Project Home"   # absent   -
python3 $D/lookup.py forward deliverables  "Project Home"   # present  docs/deliverables/MVP Prototype.md
python3 $D/lookup.py reverse               "Design System"  # retained -   (the back-link is stripped)
python3 $D/lookup.py --selftest                             # replays all 686 named rows
```

`--selftest` replays every named row against its committed state: **686 of 686**, with the two
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
no recorded standing**, and 548 of the 821 matrix findings carry `undetermined` and propose no
edit as a direct consequence.

- **Received, like `prds/`** — the 31 contradictions now carrying `undetermined` gain the
  standing the other 16 already have, and each becomes a question someone is entitled to answer.
  **It is not a licence to edit the backlog.** All 15 already-received contradictions were traced
  to the sections their derived note cites, and all 16 came back faithful: the note says what its
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

Net for this decision: **48 contradictions become 46**, and 823 findings become 821.
- **The `Professional planner`'s standing is untouched** (`r1335`, `r1341`). Selecting among your
  own projects is not working on several projects on someone else's behalf.
- Per the provenance trace, `entities/Project.md` **faithfully reflects** the original PRD §58 and
  §72 and SDD §47. So this is a product decision superseding received material, not the correction
  of a drift — which is why it had to be taken by the owner and could not be read off the corpus.

**No derived note is edited here.** Making these three notes say it is the separate, separately
approved work this ledger was scoped to precede.

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

**v1 and v2 are the ones that gate this ledger** — they are why 548 findings carry `undetermined`:
492 whose evidence side sits in `docs/user-experience/` and 56 in `docs/product/` — all of
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
does not print 775 gap citations, and a reader is entitled to check the totals rather than take
them. **The matrix and the finding set are committed beside this ledger**, in
[`2026-08-24-ux-layer-backlog-reconciliation/`](2026-08-24-ux-layer-backlog-reconciliation/):

| file | rows | what it holds |
| --- | --- | --- |
| `rows.tsv` | 3,070 | every matrix row: direction, kind, subject, source, terms, candidate-set size, match, state, pair, target |
| `findings.tsv` | 821 | every finding: kind, standing on both sides, both citations, the rows behind it, remedy |
| `aliases.tsv` | 35 | the alias table the two-pass named lookup resolved through |
| `convention.tsv` | 4 | the convention audit, kept out of the matrix counts |
| `provenance.tsv` | 16 | the provenance trace: for each received contradiction, the original-PRD/SDD sections read and whether the derived note drifted from them |
| `sections.py` | — | the coverage instrument behind the sections-swept table, with `--selftest` |
| `candidates.sh` | — | the candidate command for a BEHAVIOURAL row — the mechanical half of that match |
| `lookup.py` | — | the named-thing lookup, with `--selftest` replaying all 686 named rows |

The implementation plan had decided these would stay in a scratchpad, on the reasoning that the
spec authorises one output file — and flagged that as a question for the repository owner rather
than a settled call. It was the wrong default and the question should have been asked: a ledger
whose central number cannot be inspected is a ledger asking to be trusted, which is the one
thing this instrument was built not to do. Eight files, additive, no derived note touched.

## Findings withdrawn after review

Fourteen corrections, all from review of the committed matrix — which is the argument for
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
though it were not. The report already makes this argument in the forward direction — "a single
`matched` field would have recorded whichever note the reader opened first" — and the reverse
column now follows it: 43 rows gained the bodies that were always there. **No state moved, in
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

**Net across the three: 777 gaps become 775, 47 contradictions become 48, and 824 findings become
823.** `lookup.py --selftest` is back to 686/686.

These are recorded rather than quietly removed. A finding set that reports its own false
positives is worth more than one reporting only successes, and five of the 52 originally claimed
contradictions did not survive checking, while a fifty-third was found hiding inside another — a
rate consistent with the 25% verdict movement this ledger already reports for the judged half,
and a reason to read the citations rather than the totals.

## Checks

```
rows                                              3070
  every row holds exactly one of five states      yes (0 blank, 0 outside the vocabulary)
notes reached by any reverse row                  227 / 227
notes reached by a reverse behavioural            227 / 227
disagreement rows                                   46
disagreement findings                               46
coalesced pairs, counted directly                    0
finding set recomputed from rows.tsv          identical as a SET to findings.tsv
candidates.sh reproduces the committed cand_n     15 / 15 sampled rows (fixed
                                              seed, both directions, empty sets
                                              included)
lookup.py reproduces the committed named state   686 / 686 named rows (2 named,
                                              and moved onward by a reading)
gap findings, by the row kind behind them        416 named + 359 behavioural
findings with no evidence citation                   0
undetermined findings proposing an edit              0
received contradictions                             17
  traced to the sections their note cites           17 / 17
  derived notes found to have drifted                0
sections.py --selftest                        instrument agrees with a second
                                              implementation and three pinned counts
derived notes edited, uncommitted                    0
derived notes edited, vs merge base                  0
npm run check                                 passes all four steps
```

**No derived note was edited.** Checked against the merge base, not the working tree — the ledger
is committed before the check runs, so a derived-note edit committed alongside it would leave
`git status` clean:

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
