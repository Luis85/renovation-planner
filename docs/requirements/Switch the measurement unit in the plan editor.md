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

The world unit is the millimetre and always will be — PRD §70 normalizes length to mm, ADR-009
makes `1 world unit = 1 mm` mandatory rather than recommended, and
[[World coordinates are millimetres, converted once at the engine boundary]] holds that line.
None of it is in question here. What is in question is that a renovator planning a whole estate
is *shown* those millimetres, and a six-digit figure is not a number anybody reads.

Estate-scale work is **comparative** — is this terrace bigger than that one, does the drive reach
the outbuilding — and comparison is done by scanning, not by arithmetic. A column of `42718`,
`128400`, `9630` defeats scanning entirely, so the renovator shifts decimals in their head to get
back to the metres they think in. Room-scale work in the same session wants the millimetres back,
because a worktop 18 mm out does not fit. One plan, one session, two scales, and today one unit.

This is the display half of PRD §71's separation, made into a control. §71 insists internal and
display precision are different things and gives `42718432 mm²` / `42.72 m²` as its example; it
never said who picks the second one. This use case says the renovator does.

**It is not purely cosmetic, and the opening has to say so.** Switching writes nothing and moves
no stored byte — but the same unit is what calibration reads a typed known distance *in*, which
reaches something persisted. A reader who takes "cosmetic" at face value is the reader who ships
a scale error; *The unit is read in both directions* below is the whole story.

## Actor

[[Private renovator]] — PRD §4's primary persona, renovating their own house and garden, and
therefore the person who has both an estate and a bathroom in one vault.

## Preconditions

- A plan is open in the plan editor.

**Calibration is deliberately not a precondition.** An uncalibrated plan (PRD §82, SDD §25) has
no real-world figure to express in any unit, but the use case still starts — extension **2a**.
Listing it above would let an implementation satisfy the preconditions and omit what the
uncalibrated state owes.

## Main flow

1. The renovator has a plan open, showing figures in the unit that plan was last read in — or,
   where it has never been switched, in whatever *Which unit a plan opens in* resolves to.
2. They open the unit picker in the toolbar's trailing group.
3. They pick metres, centimetres or millimetres.
4. Every figure the editor draws re-reads in that unit at once: the canvas measurement labels,
   the zone areas, the inspector's fields and the status bar's live readout. Areas follow lengths
   — m gives m², cm gives cm², mm gives mm² — and every figure shows two decimals.
5. The choice is remembered for that plan, outside the vault. Reopening the plan comes back in
   the unit it was left in.

## Extensions

- **2a** — No calibration, and none in progress. The picker is present and **disabled**, saying
  why, so the renovator is pointed at [[Scale calibration]] rather than left wondering where the
  control went. Same refusal [[An uncalibrated plan never presents a measurement as true]]
  requires of [[Measurement label]], reached from the control instead of from the number.
- **2b** — No calibration, and the renovator is calibrating it. The picker is **enabled**: the
  unit is an input now, not an output, because the distance about to be typed is read in it.
  Without this qualification 2a would disable the picker in the one state where it first does
  something, leaving every plan's first calibration typed in whatever unit the code assumed.
- **3a** — The unit picked is the one already in force. Nothing re-renders, nothing is written.
- **4a** — A second editor leaf is open on the same plan. It follows immediately: the unit
  belongs to the plan, not the leaf. Reading one plan in two units at once is the thing the
  renovator complained about, not a case this serves.
- **5a** — Nothing has ever been stored for this plan. It opens at the first level of the
  precedence chain that answers.
- **5b** — What was stored is unreadable, or names a unit this version does not know. The value
  is dropped and **that level is treated as absent**, so resolution continues down the chain —
  the same way `settingsFrom` treats a `data.json` the user has edited. Dropping straight to
  millimetres is the subtler bug: it would override a project that legitimately stated its units,
  on the strength of one corrupt byte in a cache.
- **5c** — The store cannot be written to. The switch still applies to the open editor; only the
  remembering is lost. Not worth an error dialog, and not worth refusing the switch.

## Guarantee

Whatever the renovator picks, and whichever branch above is taken:

- **The stored geometry is byte-identical.** The sidecar's coordinates and its `"unit": "mm"` are
  untouched, so ADR-009's loader still validates and fails closed exactly as before.
- **No calculation ever reads a displayed figure, and the pricing pipeline never learns the
  display unit.** Quantities and costs convert from world millimetres to the *asset's* unit in
  the quantity engine, which this note does not touch. A plan read in centimetres and one read in
  metres produce the same budget to the last cent — not because the figures are reconciled, but
  because the budget was never shown the question.
- **Nothing about *switching* a unit reaches the vault.** No note modified, no sidecar rewritten,
  no save state dirtied — which is why this belongs under [[Canvas navigation]], whose own rule
  (PRD §66) is that the editor's transient state must not reach the vault.

**Scope of the second bullet:** it covers the output and pricing paths. The unit has exactly one
input role — calibration's typed distance — and the guarantee is silent about it by design, not
by omission. Stated as an absolute it would invite an implementation to pass a typed `5` as 5 mm
where the renovator meant 5 m, persisting a scale off by a thousand.

## The unit is read in both directions, and calibration is why

**This note defines a term slice 7 already uses.** [`07-calibration`](../tasks/07-calibration.md)
converts the typed known distance "from the **Plan's display unit** into world units (mm) …
before it ever reaches a command". Nothing said what a plan's display unit was or who set it.
The picker is the answer, so the unit it sets is read both ways: what a figure is shown as, and
what a typed known distance means.

The stakes are why this is stated in the opening rather than a footnote. Calibration establishes
the scale every later length, area, quantity and cost inherits, and unlike everything else here
that scale is **persisted**. An implementation reading this note as output-only, against a
calibration flow reading the same unit as input, gets a scale wrong by 10 or 1000 — a plausible,
wrong budget, which the *Calibration and measurement* epic calls the worst available outcome.

So the unit is cosmetic **except** as the interpretation of calibration's typed distance. The
Guarantee is unaffected: it is *calibrating* that persists, not *switching*.

That earns one rule the picker would not otherwise need:

- **Switching the unit while the calibration prompt is open must never silently reinterpret a
  number already typed.** The value is converted to the new unit in front of the renovator,
  without rounding. Silently rebasing `5` from metres to centimetres is a hundredfold scale error
  made of one click and no feedback. Disabling the picker for the duration is **not** the
  alternative — the prompt is exactly when the renovator needs it, so disabling would defeat
  **2b** while appearing to satisfy this rule.

## Which unit a plan opens in

A stated chain, resolved where the picker is initialised:

1. the **plan's remembered unit**, when one is stored and valid;
2. otherwise the **project's default display unit**;
3. otherwise the **plugin's default display unit**;
4. otherwise **millimetres**.

A value present but invalid is treated as **absent** at that level and resolution continues
(extension 5b). Millimetres is the **floor**, not "the default": it is what answers when nothing
above it has spoken, and the world unit is the one answer that cannot be a lie.

**Levels 2 and 3 do not exist today, and the shipped `units` setting is not either of them.**
`src/plugin/settings/settings.ts` ships `UNITS = ['metric', 'imperial']` defaulting to `'metric'`
— the one setting the pane offers — and a project stores a unit *system* too (PRD §83;
[[Start a renovation project]] step 6 writes "the unit system" onto the project note). But
**a measurement *system* and a display *unit* are different axes**: `metric` names a family
containing m, cm and mm alike, so resolving one from it would invent a preference nobody
expressed.

The two settings therefore do different jobs at both levels:

- `units: metric | imperial` selects the **vocabulary** the picker offers, project overriding
  plugin as every project setting overrides its plugin default. Imperial's vocabulary is a later
  value, so **an `imperial` vault gets the metric units today** — a named limitation the imperial
  work closes rather than a silent one somebody discovers.
- a **default display unit** is a separate setting at each level, owed to [[Project settings]]
  and [[Settings and configuration]]. Both are absent, so the chain reaches millimetres — true
  because of what the settings *are*, not because nobody looked.

**Level 1 above level 2 is a deliberate claim, not an accident of ordering.** A plan remembered
in centimetres shows centimetres even where the project says metres, which reads against
[[Project settings]]'s "every figure the plugin shows for it obeys them". Reconciled by **scope
rather than precedence**: the project's unit governs the **values**, this picker governs only the
editor's **rendering** of them, and the Guarantee makes the values provably identical either way.
Putting the project above the remembered unit is the other coherent answer, and is rejected —
it would delete the per-plan memory this use case exists to provide.

## What this forces elsewhere

Each is an edit to something already written. A requirement that rewrites a rule silently is
worse than one that says it is doing it.

1. **[[World coordinates are millimetres, converted once at the engine boundary]] is *clarified*,
   not amended.** There are two consumers of world millimetres and they are **parallel, never
   chained**: the quantity engine converts mm → the asset's pricing unit at `toMeasuredQuantity`,
   and the editor's formatter converts mm → the renovator's display unit from the **unrounded**
   value. Neither reads the other's output, so BR-SPATIAL-001's warning — "a second conversion is
   either a no-op nobody can prove or a division applied twice" — is satisfied, because it is
   about *chaining*. The rule owes one sentence: as written it describes one consumer and reads
   as though it were the only one. Its invariant is unchanged.
2. **[[Project settings]] owes one word: its unit is a *default*.** Per the scope reconciliation
   above — otherwise two MVP notes read as contradicting each other about what a figure shows.
3. **[[Toolbar]]'s Contract must admit a non-tool child.** It is written as a container of tools,
   "given the tool registry and the id of the active tool, emits a tool-activation request", with
   one invariant: exactly one [[Tool button]] active. The picker is not a tool, never becomes
   active, and emits something else, so it sits in a trailing group outside that invariant. The
   Contract does not admit such a child today.
4. **[[Toolbar]]'s roving tabstop spans both groups.** One tab stop in total; arrow keys cross
   from the last tool button into the picker and back. A separate tab stop is refused by the
   component's own argument that "tabbing through six buttons to reach the canvas is worse every
   single time". This is **decided rather than flagged**, because nothing in `npm run check` can
   see keyboard behaviour — axe reads roles and names — so an open question here ships an
   unreachable control while every gate stays green.
5. **A `Unit picker` component note is owed**, under `docs/components/`, `medium: dom`,
   `region: chrome`. Deliberately not a wikilink from here: an unresolved link is a to-do in that
   folder and a defect anywhere else.
6. **[[Measurement label]]'s Given gains a unit.** Its rule — "it displays precision; it never
   decides it" — is untouched, and is why this works: the label already refuses to invent a
   precision, so one more input changes nothing about who owns the decision.

## Out of scope

- **A unit of measure assigned to an object or an asset** — the other half of the original ask,
  and a different kind of thing: a *stored fact* that travels with the note and appears in
  exports, where this picker stores nothing in the vault. Belongs under
  [[Zones and spatial objects]] and [[Asset library]];
  [[An asset's unit kind must match the dimension its requirement is derived from]] already
  governs part of it.
- **Imperial units.** The picker ships m, cm and mm, but the vocabulary is a **list the formatter
  reads**, not branches in a `switch`, so feet and inches are a value added later rather than a
  rewrite. Even then the *canonical* unit stays the millimetre; only the display list grows —
  which is what ADR-009's *Revisit when* will need when somebody asks.
- **Setting** a default unit at project or plugin level. Those surfaces are [[Project settings]]
  and [[Settings and configuration]] (PRD §83). **Reading them is in scope** — see *Which unit a
  plan opens in*.
- **Anything outside the plan editor.** The budget, reports and exports keep the units they show.
  This is a lens on one surface; a lens that silently changed a report's figures would be a much
  larger promise.
- **Typed dimensions other than calibration's known distance** — each has its own validation.
  Calibration is emphatically *in* scope.

  **This exclusion's scope is asserted, not proven, and the note says so.** What was checked:
  slice 6's [[Inspector]] emits edits as commands, and its seven PRD §39 actions are not
  dimension entry. What was not: every future field, and slices 8 and 10. So the rule to
  implement is the general one — **any field taking a real-world dimension is interpreted in the
  plan's display unit**, calibration being the only instance known today — rather than a list of
  the fields somebody remembered.

## Acceptance criteria

1. Picking a unit changes no byte of the plan's geometry sidecar, proven by comparing the file
   before and after rather than by inspecting what the editor drew.
2. Picking a unit performs no vault write at all — checked by a spy on the write calls, per
   `CLAUDE.md`'s rule that a category invariant is checked at the forbidden thing.
3. The same plan read in m, cm and mm produces byte-identical cost output. Stronger than
   "identical once converted back": the display unit is not an input to the cost pipeline, so
   there is nothing to convert back.
4. **The display unit never reaches `toMeasuredQuantity`** — a spy on that function asserting its
   `unit` argument is always the asset's, whatever the picker says. Checked at the call, because
   the next call site is the one nobody thought of.

   The reason, since it is the note's central constraint: `toMeasuredQuantity(rawValue, unit)`
   takes the **asset's pricing unit**, and `MeasurementUnit` is
   `"piece" | "m" | "m2" | "m3" | "hour" | "day" | "fixed"` — a pricing vocabulary with no `cm`
   or `mm` in it. Slice 9's worked pipeline runs `12,345,678 mm²` → `12.345678 m²` → waste →
   packaging against a `lotSize` of `2.5 m²` → `$12.50/m²`. Feeding cm² in multiplies a
   per-square-metre price by a square-centimetre quantity: a cost wrong by four orders of
   magnitude, or the refusal [[A mismatched unit or currency is an error, not a coercion]]
   exists to raise.
5. Each conversion happens once from world millimetres, and neither reads the other's output.
   `tests/` mirrors `src/`, so naming a test directory is a claim about where code goes: the
   **display** conversion — mm to m/cm/mm, plus rounding and the unit symbol — is presentation
   behaviour, whole, living and tested in `presentation/`; the **pricing** conversion stays where
   slice 9 has it. There is no core primitive to split off: converting mm to centimetres for a
   label is not a domain fact, and
   [`Architecture and Software Design`](Architecture%20and%20Software%20Design.md) assigns units
   to slice 9, with slice 2's `core/units/` holding only the world-unit convention.
6. The formatter converts from the **unrounded** world value. A test that rounds first and formats
   second produces a different figure at some input, and that input is the test.
7. `42718432 mm²` displays as `42.72 m²` (PRD §71's worked example), `427184.32 cm²` and
   `42718432.00 mm²`. Two decimals in every unit — the millimetre case included precisely because
   it looks silly and must still obey the rule. **The areal factor is the square of the linear
   one**: `1 cm² = 100 mm²`, not 10.
8. Areas follow the length unit without a second control: picking cm gives cm², never m².
9. On an uncalibrated plan with **no calibration in progress** the picker is disabled and carries
   a reason a renovator can read. Checkable in a vault in under a minute.
10. Reopening a plan restores the unit it was left in. A plan never opened resolves through the
    chain — so the test asserts the *chain*, with each level stubbed, not the millimetre answer it
    currently produces. A separate case asserts an `imperial` plugin setting still yields a usable
    picker rather than an empty vocabulary.
11. A stored value that is absent, unparseable, or names an unknown unit is dropped and its level
    treated as absent, so resolution continues — the same shape of test `settingsFrom` has for
    `data.json`. The case that must fail is a corrupt plan cache overriding a project that stated
    its units.
12. Two leaves on one plan show the same unit within one switch, with no reload.
13. Every label the picker draws goes through `t` and reads correctly under both locales
    [[Multilanguage]] declares — including the unit symbols, which are not automatically
    locale-invariant.
14. The toolbar's tool group still enforces exactly one active tool, unchanged, with the picker
    present.
15. The picker is reachable and operable from the keyboard alone: one tab stop for the whole
    toolbar, arrow keys crossing into the picker and back, the unit changeable without a pointer.
    Walked in `npm run test-build`, because no gate here can see it — the case that must fail is a
    picker only a mouse can reach.
16. On an uncalibrated plan the picker is **enabled** for the duration of calibration, so a plan's
    first calibration is typed in a unit the renovator chose rather than one the code assumed.
    This and criterion 9 are two halves of one rule; a test asserting only one passes the note
    while contradicting it.
17. A known distance typed during calibration is interpreted in the unit the picker shows, and the
    resulting scale is identical to the equivalent value in any other unit. `5` in metres, `500`
    in centimetres and `5000` in millimetres produce the same calibration — a node test on the
    conversion, not a walkthrough.
18. Switching the unit while the calibration prompt is open **visibly converts** the typed value
    **without rounding it**: `1` in millimetres becomes `0.001` in metres, not `0.00`. Round-
    tripping through every unit returns the value it started with. Disabling the control is not an
    alternative (extension 2b). The case a test must fail on is a conversion that quietly zeroes a
    small distance.

## Assumptions

Each is something this note decided that its sources did not settle.

1. **The store is Obsidian's own local storage**, keyed by plan id, keeping a per-plan preference
   out of the vault and off the sync channel. **Unverified against the pinned `obsidian@1.13.0`
   typings** — `node_modules` was not installed when this was written, and `CLAUDE.md`'s rule that
   the devDependency is pinned to the floor exactly means the compiler decides. Check
   `loadLocalStorage`/`saveLocalStorage` before planning against them.

   **If they are not promised at `minAppVersion`, the fallback is no persistence — not
   `window.localStorage`.** [[Obsidian]] states what the plugin owes the host, and "not reaching
   for a global `app`, and not writing outside the vault APIs" is one line of it; Obsidian's own
   calls exist precisely so a plugin does not touch that global. Losing the memory is already a
   designed-for state (**5c**), costing one re-pick per session and costing the architecture
   nothing. A host-backed adapter approved on its own merits is the other legitimate answer, and
   is a decision somebody makes rather than a fallback this note assumes.
2. **Per-device is acceptable, and arguably correct.** Local storage does not sync, so the same
   plan on a second machine starts from the chain rather than the remembered unit. The unit
   somebody reads at a desk and the one they read on site are not obviously the same unit — but
   it is a decision, not a consequence.
3. **Two decimals everywhere, including millimetres — for a figure being *read*.** §71 gives two
   decimals for m² and nothing for the rest, so this generalises its one example rather than
   inventing a second rule. The cost is `42718432.00 mm²`, honest about being a display
   convention rather than a significance claim.

   **An editable value is exempt.** Two decimals applied to calibration's typed distance turns
   `1 mm` into `0.00 m` on a switch to metres — failing positive-distance validation or persisting
   a zero scale, from a rounding rule meant only to make numbers readable. Display precision
   governs what is **rendered for reading**; a field being **edited** carries whatever digits its
   exact value needs. Collapsing the two destroys data — §71's internal-versus-display lesson,
   arriving from the input side.
4. **Millimetres is the floor of the chain, not "the default".** A dropped per-plan value
   continues to the project's unit, which *is* an inferred unit — and the right inference: a
   project that declared its units is better evidence of what the renovator wants than one corrupt
   byte in a per-device cache. Metres is not the floor even though estate work wants it, because
   the floor is the case where the product knows nothing.
5. **The picker is a picker, not a cycle.** Three values in a menu, over a button that advances
   through them, because a control whose next state you must remember is one you read before you
   use. A command that cycles is a legitimate second input later, subject to `CLAUDE.md`'s *one
   action, every input* rule.
6. **This is MVP.** PRD §70 and §71 are MVP, and their epic says a plan that shows a figure owes
   the renovator a readable one. It is not in the received PRD as a control, which is why this is
   an assumption rather than a citation.
7. **The status bar is a follower, not a second control.** It re-reads in the chosen unit
   (step 4's "every figure") while staying "a readout, not a control" — its Contract still emits
   nothing.

## Sources

PRD §4 (target users), PRD §39 (User Experience Requirements — the editor's regions), PRD §66
(Save Strategy — what may not reach the vault), PRD §70 (Unit System), PRD §71 (Measurement
Precision), PRD §82 (calibration model), PRD §83 (Configuration Model); SDD §23 (World Coordinate
System), SDD §24 (Viewport Transform), SDD §25 (Calibration), SDD §57 (Initial Editor Tools),
SDD §60 (UI Layout), SDD §61 (Responsive Strategy — the toolbar's width problem).

ADR-009 ([`docs/adrs/0009-world-coordinates-in-millimeters.md`](../adrs/0009-world-coordinates-in-millimeters.md))
— read for what it refuses (a per-plan choice of the *persisted* unit) and for its *Revisit when*.
This note does not trigger it: a display preference held outside the vault never reaches the
sidecar the ADR is about.

Business rules read: [[World coordinates are millimetres, converted once at the engine boundary]]
(BR-SPATIAL-001 — **clarified** by this note, not amended; its invariant is unchanged) and
[[An uncalibrated plan never presents a measurement as true]].

Components read: [[Toolbar]], [[Tool button]], [[Measurement label]], [[Status bar]],
[[Inspector]], [[Plan canvas]].

Design slices read: [`05-canvas-rendering-and-editor-shell`](../tasks/05-canvas-rendering-and-editor-shell.md)
(the shell's regions and the toolbar), [`06-editor-tool-framework-undo-redo-and-inspector`](../tasks/06-editor-tool-framework-undo-redo-and-inspector.md)
(the tool registry the trailing group sits beside), [`07-calibration`](../tasks/07-calibration.md)
(whose "Plan's display unit" this note turned out to define) and
[`09-quantity-and-cost-engine`](../tasks/09-quantity-and-cost-engine.md) (`toMeasuredQuantity`'s
signature, the `MeasurementUnit` vocabulary and the worked pipeline — why a display unit may not
reach the pricing boundary). Also
[`Architecture and Software Design`](Architecture%20and%20Software%20Design.md) for layer
ownership, and `src/plugin/settings/settings.ts` for the shipped `units` vocabulary.

Every section number names its document, since `docs/requirements/` reads a bare `§` as the PRD
and the two documents number independently — PRD §60 is the Identity Model, SDD §60 is UI Layout.
