---
type: PBI
parent: "[[Canvas navigation]]"
order: 10
status: "New"
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Switch the measurement unit in the plan editor

The world unit is the millimetre and always will be — PRD §70 normalizes length to mm,
ADR-009 makes `1 world unit = 1 mm` mandatory rather than recommended, and
[[World coordinates are millimetres, converted once at the engine boundary]] holds the line in
both directions. None of that is in question here. What is in question is that a renovator
planning a whole estate is shown those millimetres, and a six-digit figure is not a number
anybody reads.

Estate-scale work is **comparative** — is this terrace bigger than that one, does the drive
reach the outbuilding — and comparison is done by scanning, not by arithmetic. A column of
`42718`, `128400`, `9630` defeats scanning entirely, so the renovator shifts decimals in their
head to get back to the metres they think in. Room-scale work in the same session wants the
millimetres back, because a worktop that is 18 mm out does not fit. One plan, one session, two
scales, and today exactly one unit.

This is the display half of PRD §71's separation, made into a control. §71 already insists
internal precision and display precision are two different things and gives
`42718432 mm²` / `42.72 m²` as the worked example; it just never said who picks the second one.
This use case says the renovator does, in the editor. Switching writes nothing, moves no stored
byte, and leaves the engine calculating in millimetres. **It is not, however, purely cosmetic,
and this note stopped claiming it was** — the same unit is what calibration reads a typed known
distance in, which is the one direction that reaches something persisted. *The unit is read in
both directions* below is that whole story; it is stated in the opening because a reader who
takes "cosmetic" at face value is the reader who ships the scale error.

## Actor

[[Private renovator]] — PRD §4's primary persona, renovating their own house and garden, and
therefore the person who actually has both an estate and a bathroom in one vault.

## Preconditions

- A plan is open in the plan editor.

**Calibration is not a precondition**, and saying so is the point of this line. An uncalibrated
plan (PRD §82, SDD §25 — two points and a known distance) has no real-world figure to express in
any unit, but the use case still starts: the picker is shown and disabled, which is extension
**2a** and acceptance criterion 9. Listing calibration above would let an implementation satisfy
the preconditions and omit the behaviour the uncalibrated state actually owes.

## Main flow

1. The renovator has a plan open, showing figures in the unit that plan was last read in —
   millimetres if it has never been switched.
2. They open the unit picker in the toolbar's trailing group.
3. They pick metres, centimetres or millimetres.
4. Every figure the editor draws re-reads in that unit at once: the canvas measurement labels,
   the zone areas, the inspector's fields and the status bar's live readout. Areas follow
   lengths — m gives m², cm gives cm², mm gives mm² — and every figure shows two decimals.
5. The choice is remembered for that plan, outside the vault. Reopening the plan later comes
   back in the unit it was left in.

## Extensions

- **2a** — The plan has no calibration **and no calibration is in progress**. The picker is
  present and **disabled**, and says why, so the renovator is pointed at [[Scale calibration]]
  rather than left wondering where the control went. It is the same refusal
  [[An uncalibrated plan never presents a measurement as true]] already requires of
  [[Measurement label]], reached from the control instead of from the number.
- **2b** — The plan has no calibration **and the renovator is calibrating it**. The picker is
  **enabled**, because the unit is now an input rather than an output: the known distance about
  to be typed is interpreted in it. This is the qualification 2a needs and did not have — an
  earlier draft disabled the picker on every uncalibrated plan, which would have disabled it in
  the one state where it first does something, and left the first calibration of every plan to
  be typed in whatever unit the code happened to assume.
- **3a** — The renovator picks the unit already in force. Nothing re-renders and nothing is
  written; a no-op is a no-op.
- **4a** — A second editor leaf is open on the same plan. It follows immediately, because the
  unit belongs to the plan and not to the leaf. Reading one plan in two units at once is not
  something this use case serves — it is the thing the renovator complained about.
- **5a** — Nothing has ever been stored for this plan. It opens in millimetres, which is the
  world unit and therefore the one default that cannot be wrong.
- **5b** — What was stored is unreadable, or names a unit this version does not know. It falls
  back to millimetres and the bad value is dropped, exactly as `settingsFrom` treats a
  `data.json` the user has edited: a store outside the plugin's control is a trust boundary,
  and a unit it cannot vouch for is not one to render figures with.
- **5c** — The store cannot be written to. The switch still applies to the open editor; only
  the remembering is lost. A cosmetic preference is not worth an error dialog, and it is not
  worth refusing the switch either.

## Guarantee

Whatever the renovator picks, and whichever branch above is taken:

- **The stored geometry is byte-identical.** The sidecar's coordinates and its `"unit": "mm"`
  are untouched, so ADR-009's loader still validates and fails closed exactly as before.
- **No calculation ever reads a displayed figure, and the pricing pipeline never learns the
  display unit at all.** Quantities and costs are converted from world millimetres to the
  *asset's* unit by the quantity engine, which this note does not touch. A plan read in
  centimetres and a plan read in metres therefore produce the same budget to the last cent —
  not because the figures are reconciled, but because the budget was never shown the question.

  **On the output side the display unit reaches the formatter and nothing else. It has exactly
  one input role, and this bullet has to name it or it is a lie:** calibration's typed known
  distance is interpreted in it (*The unit is read in both directions* below). An earlier draft
  of this bullet said the unit "reaches only the formatter" full stop, which survived the
  section that made it false — and an implementation trusting it would pass a typed `5` as
  5 mm where the renovator meant 5 m, persisting a scale off by a thousand. The guarantee is
  therefore about the **output and pricing paths**, and is silent about calibration input by
  design rather than by omission.
- **Nothing about switching a unit reaches the vault.** No note is modified, no sidecar is
  rewritten, no save state is dirtied. This is what makes the switch cosmetic rather than an
  edit, and it is why the use case belongs under [[Canvas navigation]], whose own rule
  (PRD §66) is that the editor's transient state must not reach the vault.

## What this forces elsewhere

Named here because each is an edit to something already written, and a requirement that
rewrites a rule silently is worse than one that says it is doing it.

1. **[[World coordinates are millimetres, converted once at the engine boundary]] is
   clarified, not amended — and an earlier draft of this note had it badly wrong.** That draft
   made the display unit an **argument to `toMeasuredQuantity`**, which review refuted against
   the engine's own contract, and the refutation is worth keeping because the failure was
   expensive: `toMeasuredQuantity(rawValue, unit)` takes the **asset's pricing unit**, and
   `MeasurementUnit` is `"piece" | "m" | "m2" | "m3" | "hour" | "day" | "fixed"` — a *pricing*
   vocabulary with no `cm` or `mm` in it at all. Slice 9's worked pipeline runs
   `12,345,678 mm²` → `12.345678 m²` → waste → packaging against a `lotSize` of `2.5 m²` →
   `$12.50/m²`. Feeding cm² into that multiplies a per-square-metre price by a square-centimetre
   quantity: a cost wrong by four orders of magnitude, or the refusal
   [[A mismatched unit or currency is an error, not a coercion]] exists to raise. **A display
   preference must never reach the pricing pipeline**, and that is now this note's constraint
   rather than its mechanism.

   So there are **two consumers of world millimetres, and they are parallel rather than
   chained**:

   - the quantity engine converts mm → the *asset's pricing unit*, once, at
     `toMeasuredQuantity`. Untouched by this note.
   - the editor's presentation formatter converts mm → the *renovator's chosen display unit*,
     once, from the **unrounded** value.

   Neither reads the other's output, which is what keeps BR-SPATIAL-001's actual warning
   satisfied — "a second conversion is either a no-op nobody can prove or a division applied
   twice" is about *chaining*, and two independent conversions from one source of truth are not
   a chain. It also answers the objection that killed the alternative in the first place: the
   formatter reads the unrounded world value, never the engine's two-decimal output, so §71's
   ban on reading a rounded figure back is honoured.

   What the rule needs is therefore a **sentence, not a rewrite**: as written, "the conversion
   to `m`/`m²`/`m³` happens once, at the quantity engine's first stage, and nothing downstream
   converts again" describes one consumer and reads as though it were the only one. It should
   say that display formatting is a second, parallel conversion from the same millimetres, and
   that the prohibition is on chaining them.
2. **[[Toolbar]]'s Contract gains a second kind of child.** It is written as a container of
   tools — "given the tool registry and the id of the active tool, emits a tool-activation
   request" — with one invariant, exactly one [[Tool button]] active at a time. A unit picker is
   not a tool, never becomes active, and emits something else, so it goes in a trailing group
   that is explicitly outside the tool group and outside that invariant. The Contract has to
   say so; today it does not admit a non-tool child at all.
3. **A `Unit picker` component note is owed**, under `docs/components/`, `medium: dom`,
   `region: chrome`. Deliberately not written as a wikilink from here: an unresolved link in
   `docs/components/` is a to-do, and anywhere else it is a defect.
4. **[[Measurement label]]'s Given gains a unit.** Its rule — "it displays precision; it never
   decides it" — is untouched and is the reason this works: the label already refuses to invent
   a precision, so handing it one more input changes nothing about who owns the decision. Its
   open question 2, what an uncalibrated measurement renders as, is still open and still not
   this note's to answer.
5. **[[Toolbar]]'s roving tabstop has one more stop.** A `role="toolbar"` group with arrow-key
   movement now spans a tool group and a control group, and where the arrow keys stop at the
   boundary between them is a real question the accessibility test cannot answer — axe reads
   roles and names, not keyboard behaviour.

## Out of scope

Named rather than left looking forgotten.

- **A unit of measure assigned to an object or an asset.** The other half of the original ask,
  and a different kind of thing: an assigned UOM is a *stored fact* that travels with the note,
  appears in exports and has to survive a reload, where this picker stores nothing in the vault
  at all. It belongs under [[Zones and spatial objects]] and [[Asset library]], and
  [[An asset's unit kind must match the dimension its requirement is derived from]] already
  governs part of it. Its own note, not this one.
- **Imperial units.** The picker ships m, cm and mm. But the vocabulary is a **list the
  conversion boundary reads**, not three branches in a `switch`, so feet and inches are a value
  added later rather than a rewrite — which is what ADR-009's own *Revisit when* ("a
  requirement for a different canonical unit emerges, for example inches for a specific
  locale") will need when somebody asks. Note that even then the *canonical* unit stays the
  millimetre; only the display list grows.
- **Default units at project or plugin level.** PRD §83 assigns "units" to both scopes, and
  those belong to [[Project settings]] and [[Settings and configuration]]. This note
  deliberately does not read either: the picker starts at millimetres when a plan has no
  remembered unit, which keeps the two mechanisms from having to be reconciled before either
  exists. Seeding the picker from a project default is a later refinement and a one-line change
  to step 5a.
- **Anything outside the plan editor.** The budget, the reports and the exports keep whatever
  units they already show. This is a lens on one surface, and a lens that silently changed the
  currency-shaped figures on a report would be a different and much larger promise.
- **Typed dimensions other than calibration's known distance.** Entering a value into a field is
  an input problem with its own validation. Calibration is the exception and it is emphatically
  *in* scope — see *The unit is read in both directions*.

  **The scope of this exclusion is asserted rather than proven, and the note says so**, because
  the last version of this bullet claimed "nothing in the editor accepts a typed dimension yet"
  and slice 7 refuted it. What was checked this time: slice 6's [[Inspector]] emits edits as
  commands and its seven PRD §39 actions are not dimension entry. What was **not** checked:
  every future field, and slices 8 and 10, which are unwritten against this question. So the
  rule to implement is the general one — **any field taking a real-world dimension is
  interpreted in the plan's display unit**, calibration being the only instance known today —
  rather than a list of the fields somebody remembered.

## The unit is read in both directions, and calibration is why

**This note defines a term slice 7 already uses.**
[`07-calibration`](../tasks/07-calibration.md) says the known real-world distance a renovator
types is converted "from the **Plan's display unit** into world units (mm) … before it ever
reaches a command". That sentence has had no owner: nothing said what a plan's display unit was
or who set it. The picker is the answer, so the unit it sets is **read in both directions** —
what a figure is shown as, and what a typed known distance means.

An earlier draft of this note called input units out of scope on the grounds that "nothing in
the editor accepts a typed dimension yet", which is false about slice 7 and was the most
dangerous sentence in the note. Calibration establishes the scale that every later length, area,
quantity and cost inherits, and unlike everything else here that scale is **persisted**. An
implementation reading this note as output-only, against a calibration flow that reads the same
unit as input, gets a scale wrong by a factor of 10 or 1000 — and a wrong scale is not a display
defect, it is a plausible, wrong budget, which the *Calibration and measurement* epic calls the
worst available outcome.

Being read in both directions is what makes the unit **cosmetic-plus-one**, and the note says so
rather than repeating "purely cosmetic" where it is no longer true: everything the picker does is
cosmetic **except** its role as the interpretation of calibration's typed distance, which is the
one place it reaches something persisted. The guarantee above is unaffected — switching a unit
still writes nothing and still changes no stored figure — because it is *calibrating*, not
switching, that persists.

That earns one rule the picker would not otherwise need:

- **Switching the unit while the calibration prompt is open must never silently reinterpret a
  number already typed.** Either the picker is disabled for the duration of the prompt, or the
  typed value is converted to the new unit in front of the renovator. Silently rebasing `5` from
  metres to centimetres is a hundredfold scale error made of one click and no feedback.

## Acceptance criteria

1. Picking a unit changes no byte of the plan's geometry sidecar, proven by comparing the file
   before and after rather than by inspecting what the editor drew.
2. Picking a unit performs no vault write at all — checked by a spy on the write calls, not by
   driving the paths somebody thought of, per `CLAUDE.md`'s rule that a category invariant is
   checked at the forbidden thing.
3. The same plan read in m, cm and mm produces byte-identical cost output. Stronger than
   "identical once converted back": the display unit is not an input to the cost pipeline, so
   there is nothing to convert back.
4. **The display unit never reaches `toMeasuredQuantity`, checked at the call rather than by
   driving screens** — a spy on that function asserting its `unit` argument is always the
   asset's, whatever the picker says. Per `CLAUDE.md`, a category invariant is checked at the
   forbidden thing, because the next call site is the one nobody thought of.
5. Each conversion happens once from world millimetres, and neither reads the other's output.
   Both are node tests in `domain/` asked of the functions directly, per the *Calibration and
   measurement* epic's own definition of done — never through a screen.
6. The formatter converts from the **unrounded** world value. A test that rounds first and
   formats second produces a different figure at some input, and that input is the test.
7. `42718432 mm²` displays as `42.72 m²` (PRD §71's worked example), `427184.32 cm²` and
   `42718432.00 mm²`. Two decimals in every unit, and the millimetre case is included precisely
   because it is the one that looks silly and must still obey the rule.

   **The areal factor is the square of the linear one** — `1 cm² = 100 mm²`, not 10 — and this
   criterion carried `4271843.20 cm²` until a review caught it. A tenfold slip, in the note whose
   own argument is that shifting a decimal by hand is where money is lost. It is left recorded
   here rather than quietly corrected, because it is the exact defect this criterion's own three
   figures exist to catch — a test asserting them would have failed on it.
8. Areas follow the length unit without a second control: picking cm gives cm², never m².
9. On an uncalibrated plan with no calibration in progress the picker is disabled and carries a
   reason a renovator can read. Checkable in a vault in under a minute.
10. Reopening a plan restores the unit it was left in; a plan never opened shows millimetres.
11. A stored value that is absent, unparseable, or names an unknown unit yields millimetres and
   is dropped, with the same shape of test `settingsFrom` already has for `data.json`.
12. Two leaves on one plan show the same unit within one switch, with no reload.
13. Every label the picker draws goes through `t`, and reads correctly under both locales
    [[Multilanguage]] declares — including the unit symbols themselves, which are not
    automatically locale-invariant.
14. The toolbar's tool group still enforces exactly one active tool, unchanged, with the picker
    present.
15. On an uncalibrated plan the picker is **enabled** for the duration of calibration, so the
    first calibration of a plan is typed in a unit the renovator chose rather than one the code
    assumed. This and criterion 9 are the two halves of one rule and a test that asserts only
    one of them passes the note while contradicting it.
16. A known distance typed during calibration is interpreted in the unit the picker shows, and
    the resulting scale is identical to typing the equivalent value in any other unit. `5` in
    metres, `500` in centimetres and `5000` in millimetres produce the same calibration — a node
    test on the conversion, not a walkthrough.
17. Switching the unit while the calibration prompt is open never silently changes what a
    typed value means: either the control is disabled for the duration, or the value is
    visibly converted. Checkable in a vault in under a minute, and the case a test should
    fail on is the silent one.

## Assumptions

Each is something this note decided that its sources did not settle.

1. **The store is Obsidian's own local storage**, keyed by plan id, which keeps a per-plan
   preference out of the vault and off the sync channel. **This has not been verified against
   the pinned `obsidian@1.13.0` typings** — `node_modules` was not installed when this note was
   written — and `CLAUDE.md`'s rule that the devDependency is pinned to the floor exactly means
   the compiler is the thing that decides. Check `loadLocalStorage`/`saveLocalStorage` against
   the typings before planning against them; if they are not promised at `minAppVersion`, plain
   `window.localStorage` under a plugin-scoped key prefix is the fallback and changes nothing
   above.
2. **Per-device is acceptable, and is arguably correct.** Local storage does not sync, so the
   same plan opened on a second machine starts at millimetres. For a cosmetic preference that
   is a feature rather than a defect — the unit somebody reads at a desk and the unit they read
   on site are not obviously the same unit — but it is a decision, not a consequence.
3. **Two decimals everywhere, including millimetres**, over a per-unit precision table. §71
   gives two decimals for m² and nothing for the rest, so this generalises its one example
   rather than inventing a second rule. The cost is `42718432.00 mm²`, which is honest about
   being a display convention rather than a significance claim.
4. **Millimetres is the default**, not metres, even though metres is what estate work wants.
   The world unit is the one default that can never be a lie, and a plan whose remembered value
   was dropped as untrustworthy must not land on a unit that was inferred.
5. **The picker is a picker and not a cycle.** Three values in a menu, over a button that
   advances through them, because a control whose next state you have to remember is a control
   you read before you use. A command that cycles is a legitimate second input to the same
   action later, subject to `CLAUDE.md`'s *one action, every input* rule.
6. **This is MVP.** PRD §70 and §71 are MVP, and the epic they belong to says a plan that shows
   a figure owes the renovator a readable one. It is not in the received PRD as a control,
   which is why this is stated as an assumption rather than cited.
7. **The status bar is a follower, not a second control.** It re-reads in the chosen unit
   (main-flow step 4's "every figure") while staying "a readout, not a control" — its Contract still
   emits nothing.

## Sources

PRD §4 (target users), PRD §39 (User Experience Requirements — the editor's regions), PRD §66
(Save Strategy — what may not reach the vault), PRD §70 (Unit System), PRD §71 (Measurement
Precision), PRD §82 (calibration model), PRD §83 (Configuration Model — for what this note
deliberately does not read); SDD §23 (World Coordinate System), SDD §24 (Viewport Transform),
SDD §25 (Calibration), SDD §57 (Initial Editor Tools), SDD §60 (UI Layout), SDD §61 (Responsive
Strategy — the toolbar's width problem).

ADR-009 ([`docs/adrs/0009-world-coordinates-in-millimeters.md`](../adrs/0009-world-coordinates-in-millimeters.md))
— read for what it refuses (a per-plan choice of the *persisted* unit) and for its *Revisit
when*. This note does not trigger it: a display preference held outside the vault never reaches
the sidecar the ADR is about.

Business rules read: [[World coordinates are millimetres, converted once at the engine boundary]]
(BR-SPATIAL-001 — **clarified** by this note, not amended: it owes one sentence distinguishing a
parallel display conversion from a chained engine one, and its invariant is unchanged) and
[[An uncalibrated plan never presents a measurement as true]].

Components read: [[Toolbar]], [[Tool button]], [[Measurement label]], [[Status bar]],
[[Inspector]], [[Plan canvas]].

Design slices read: [`05-canvas-rendering-and-editor-shell`](../tasks/05-canvas-rendering-and-editor-shell.md)
(the shell's five regions and the toolbar), [`06-editor-tool-framework-undo-redo-and-inspector`](../tasks/06-editor-tool-framework-undo-redo-and-inspector.md)
(the tool registry the trailing group sits beside), [`07-calibration`](../tasks/07-calibration.md)
(what makes a figure real in the first place — and the slice whose "Plan's display unit" this
note turned out to define) and
[`09-quantity-and-cost-engine`](../tasks/09-quantity-and-cost-engine.md) — the last being the one
that refuted this note's first answer: `toMeasuredQuantity`'s signature, the `MeasurementUnit`
vocabulary and the worked pipeline are why a display unit may not reach the pricing boundary.

Every section number here names its document, since `docs/requirements/` reads a bare `§` as the
PRD and the two documents number independently — PRD §60 is the Identity Model, SDD §60 is
UI Layout.
