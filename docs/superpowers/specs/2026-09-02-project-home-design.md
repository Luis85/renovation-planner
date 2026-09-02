# Project Home — section navigation and an Overview backed by what exists

**Date:** 2026-09-02
**Slice document:** none yet. This document is the specification until a
`docs/tasks/NN-project-home.md` exists; where the two later disagree, the slice document is
the authority and this one is the earlier measurement.
**Baseline:** `main` at `5702f28` (the asset designer's first increment, PR 43).
**Parent requirement:** [[The project surface]], the MVP subset of
[[Project dashboard and navigation]].
**Sources:** Workspace UXD §7 (navigation model), §10 (Project Home journey), §22
(progressive disclosure); Prototype design spec §10 (routing contract), §A.10 (Project Home
wireframe); editor implementation plan §3 (no hard-coded counts in production UI).

## Why this, and why now

Design slice 21 gave the Renovation Project pane a detail state: one project, its status, an
`Open note` action, a way back, and its plans. It is one flat screen. The workspace UXD asks
for that project to be a **place with sections** — Overview, Spaces, Design, Work, Budget,
Schedule, Documentation (§7) — and the prototype spec's routing contract (§10) asks that a
section be restorable.

The second reason is sharper than the navigation. Slice 10 closed the loop
`Zone Geometry → Area → Requirement → Cost`, and **the only surface in the entire plugin that
shows a cost is the Plan Editor's Inspector, one requirement at a time.** A renovator cannot
ask what their project costs. Project Home's Overview is the first surface that answers it,
which makes this increment the payoff of slice 10 rather than only a navigation frame.

## Why it is parallel-safe

The Plan Editor redesign (`docs/user-experience/renovation-planner-editor-specs/`, Phases
0–9) works in `presentation/editor/` and expands the spatial domain — Zone becomes
Room/Wall/Opening. This increment works in `presentation/views/`, adds one query and adds one
optional parameter to another.

The overlap is confined to `en.ts`/`de.ts`, `styles/index.css`, `composition-root.ts`,
`errorSurfacePolicy`'s origin table and `CLAUDE.md`. Every one of those is append-shaped: a
textual merge, not a design collision.

**What would NOT have been parallel-safe, recorded so it is not attempted next:** anything
under *Spaces*. The Property → Building → Floor → Room hierarchy is exactly what editor
Phases 5–6 redefine, and two branches inventing `Room` independently is the one collision
that costs a rewrite rather than a merge.

## Scope

Built:

- Section navigation over Obsidian's own view state, with the pane's back and forward arrows
  walking sections as they already walk projects.
- **Overview** — status, dates, currency, plan count, zone count, requirement count, and the
  project's aggregated estimated cost with an honest qualifier.
- **Design** — slice 21's plan list and `New plan` form, unchanged, now with an address.

Declared and not built: Spaces, Work, Budget, Schedule, Documentation.

## Decision 1 — the section lives in the view state, and a navigation remounts

The view's state key goes from `{ projectId }` to `{ projectId, section }`.

Three designs were weighed:

| | Restorable | Back arrow walks it | Staleness | Cost |
|---|---|---|---|---|
| **View state + remount** (taken) | yes | yes | unrepresentable | re-reads the project per section switch |
| View state, no remount | yes | yes | needs a reactive `section` in the view context | one read per project |
| Local `ref`, not in view state | no | no | local | cheapest |

**Taken: view state plus remount**, which is slice 21's mechanism one key wider rather than a
second mechanism beside it. `ProjectDetailState` is built from the state it draws, so no
component can hold a section that disagrees with the view's — the property slice 21 bought by
remounting, kept rather than traded.

The rejected middle option is the close one and its price is named rather than implied: it
needs a reactive `section` in `RenovationProjectContext`, which slice 21 refused on the
record — *"the first reactive member any view context in this plugin carries, and a second way
a tree here learns its subject changed"*. It buys fewer reads, and sections switch far more
often than projects do, so **this is a real bill and not a theoretical one**. If a measurement
later shows the re-read is felt, that option is where to go, and the reason it was not taken
first is written here so the next author is choosing rather than discovering.

The local-`ref` option fails §10 outright: a section that is not restorable is not a route.

### Parsing

`projectIdFrom` becomes `viewStateFrom` and keeps its three-way discipline:

- `projectId` unchanged — `''` is the LIST (a state, not an absence) and a non-string refuses
  the whole state, per slice 21's own reasoning.
- `section` is read only when a project is open. An unknown or absent value resolves to
  `'overview'` rather than refusing. Two real inputs land there: a layout written before this
  increment carries no `section` key at all, and a layout written by a LATER build may carry
  `'budget'`. Refusing would leave such a leaf drawing nothing.
- The list state carries no section, so `{ projectId: '', section: 'design' }` normalises to
  the list. One state, one meaning.

**The asymmetry with `projectId` is deliberate and is the point.** An unrecognised project id
refuses because the conservative answer is to go on drawing what is drawn; an unrecognised
section falls back because Overview is always a truthful answer for a project that exists.

### History

`setState`'s guard widens from `parsed.projectId !== this.projectId` to *either field
changed*. Overview→Design is one history entry; a restore that changes nothing records none,
which is the rule slice 21 already states — an unconditional assignment claims a navigation
where there is none.

### The remount costs a keyboard user their place, and that has to be paid back

**Found by review, and it is a consequence of this decision rather than an oversight in the
mock.** The prototype's arrow-key handler moves focus by swapping a local `ref`, so the tab it
focuses is still in the document. After promotion a section change is a `setViewState` round
trip: `sync()` unmounts the whole tree and builds a new one, so the element `focusTab` reached
for no longer exists and the newly selected tab comes back unfocused. The user's next Tab leaves
the switch entirely — a keyboard user is thrown out of the control they were operating, every
time they operate it.

`ProjectNav` restores focus on mount, and the condition is what keeps it from being theft:
**focus is restored only if focus was inside this switch when the previous tree unmounted.** A
restored leaf at startup, a `rebind` after a settings save and a back-arrow navigation all
unmount with focus elsewhere, so none of them steals it; a user pressing an arrow key unmounts
with focus on a tab, so that one gets it back.

`document.activeElement` at `onBeforeUnmount` is the reading, and it is a fact about THIS leaf,
so it is held per leaf rather than in a module-level flag — two split leaves navigating in the
same tick would otherwise hand one leaf's focus to the other.

**The alternative is to stop remounting the shell**, keeping header and nav mounted and swapping
only the section pane. That is Decision 1's rejected middle option arriving through a different
door, and it costs the same reactive `section` in the view context. Paying focus back is the
smaller price.

Its test drives the real view-state round trip rather than the local `ref`, because the local
`ref` is exactly what made the defect invisible.

### The section has to travel the whole way, and the compiler will not say so

**Reported, verified, and the reason it is worth a section is that the type system does not
catch it.** Changing `RenovationProjectContext.navigate` is not enough: the plugin binds
`navigate: (next) => …`, a ONE-argument arrow, and forwards to `navigateToProject`, whose write
is hard-coded — `state: { projectId: projectId ?? '' }` at line 242.

TypeScript accepts a function of fewer parameters where more are expected, so widening the
interface to `(projectId, section)` leaves that binding compiling unchanged while silently
discarding the section. `viewStateFrom` then falls back to `'overview'`, and **Design is
unreachable — on a green build, with every gate passing.**

That is the opposite of the property this document leans on elsewhere. A REQUIRED parameter
normally makes every call site a compile error, which is how the `DispatchOutcome` widening
found seventeen adapters and how `AssetDesignerDeps.onThemeChange` found eleven fixtures.
Arity-compatibility is the one shape where that guarantee does not hold, and a callback is
exactly where it bites.

So the Files list names the plugin binding and `navigateToProject.ts` alongside the context, and
the state written is `{ projectId, section }`. **Its test drives the real round trip and asserts
the section arrives** — a test on `navigate` alone passes against the discarding binding, since
the context is the half that is correct.

### Which sections exist

`SECTIONS = ['overview', 'design']` — the built ones, and the only thing the nav renders. The
five unbuilt sections are **hidden rather than disabled**: the repository's own rule from
slice 14 is that a surface renders no control rather than a live one that does nothing, and a
disabled nav item is precisely that control. A section becomes reachable by being added to
this list once its domain exists.

The parse accepts any string and falls back, so hiding a section never strands a leaf.

## Decision 2 — the summary delegates its rows rather than re-deriving them

One new query, `GetProjectSummary`, guarded at the composition root like every other. It
walks:

```text
ListPlansByProject(projectId)                      -> plans, unreadable
  FindZonesByPlan(planId)                          -> zones          (per plan)

listByProject(projectId) ∩ getIdsByType(requirement) -> requirements, refused
  buildRow(requirement)                            -> RequirementInspectorDTO
```

**TWO walks, and this diagram showed only the old one for four rounds.** It was the document's
first and most canonical definition of `GetProjectSummary` while Decision 3 below it specified
something else — a per-zone walk that loses requirements whose zones were deleted, reintroduces
`zones × all-requirements` I/O, and lets an unrelated malformed requirement fault the summary
through a strict `listByZone`. Everything the sections below argue against, in the code block an
implementer reads first. The third artifact on this branch to contradict the prose beside it.

The plan walk answers the ROOM count; the project-scoped requirement listing answers everything
else. They are separate because a requirement that outlived its zone is exactly where they
disagree.

**It shares `GetRequirementsForZone`'s row builder rather than re-deriving a row.** That query
owns the
staleness reading — the persisted marker, a `calculatedFrom` mismatch, a missing target — and
the currency increment recorded exactly what a second derivation costs: `inputsStillMatch`
hand-spelled the three comparisons `assetMatchesCalculatedFrom` already made, so a field added
to one would have left the other comparing the old three. Delegating makes the project total
and the Inspector row unable to disagree about whether a figure is stale, **by construction
rather than by care**.

### The currency is read once, and the memo that used to do it is gone

An earlier draft gave `GetRequirementsForZone.execute` an optional currency memo, so one map
could be threaded across a per-zone walk and keep the project read at one rather than one per
zone. **That contract died when the walk became project-scoped and I did not notice**: nothing
calls `execute` once per zone any more, so no caller could pass a memo "across the whole walk",
and the API change and its N-zone call-count test were both dead — a test that cannot fail
proving a property nothing has.

`GetProjectSummary` resolves the project's currency ONCE and hands it to the shared row builder.
That is simpler than the memo and it is what the memo was reaching for: the summary reads one
project, so a cache keyed by project id was always solving a problem that only the per-zone
shape had.

`GetRequirementsForZone` keeps its own per-`execute` memo, unchanged. It still walks one zone at
a time for the Inspector, where rows can name different projects, and that is the case the memo
was written for.

### The result

```ts
interface ProjectSummary {
	planCount: number;
	/** Zones across every plan of this project, not per plan. */
	zoneCount: number;
	/** Requirement rows reached, whatever their state. */
	requirementCount: number;
	/**
	 * The rows that actually CONTRIBUTED to `total`. Supplied, never derived by a caller.
	 *
	 * `requirementCount - unsummable` was right for one exclusion category and broke when
	 * a second exclusion category arrived; subtracting every category double-counts a row caught
	 * by two of them. The counts below are independent by design, so only this query knows the
	 * size of their union — and it stays supplied even now that `unsummable` is the only
	 * exclusion left, because the next category to arrive must not re-open this.
	 */
	summed: number;
	/**
	 * Always denominated in the PROJECT's own currency, and zero — not `null` — when there is
	 * nothing to sum. `null` means the project's currency could not be resolved at all, which
	 * is the only state in which no figure can honestly be printed.
	 */
	total: Money | null;
	/** Rows reading `stale`. They ARE in the total. */
	stale: number;
	/** `ListPlansByProject`'s own count, passed through. */
	unreadablePlans: number;
	/** Plans whose zone read refused. */
	unreadableZones: number;
	/** Rows whose currency the total cannot take. */
	unsummable: number;
	/** Requirement notes that could not be read at all. One bad note costs one note. */
	unreadableRequirements: number;
}
```

**These counts are independent, not a partition**, and the qualifier says so rather than
implying arithmetic that does not hold: a row may be both `stale` and `unsummable`, and
`stale + unsummable` is therefore not a count of anything. Each answers its own question.

## Decision 3 — sum everything, qualify the total

A stale row is **in** the total and **counted** beside it. The alternatives were weighed:

- *Sum only current figures* — the headline number understates the project, and any geometry
  edit makes figures stale, so it would understate it most of the time.
- *Refuse a total while anything is stale* — blank in the common case, for the same reason.

So the figure stays useful and never silently claims more than it knows. The qualifier is a
**sentence and not a badge alone** — "3 figures need recalculating" — per SDD §85's rule that
status never rests on colour.

### Why `unsummable` exists rather than being assumed away

`add` refuses `money.currency-mismatch`, and the currency invariant does **not** reach every
writer: `SetRequirementCostOverrideCommand` writes `estimatedCost.override` from a
caller-supplied `Money` with no currency comparison, which `CLAUDE.md` already records as an
open residue, reproducible through `RequirementRow.vue`'s cost override. A foreign-currency
override is therefore reachable today. A summing query that assumed one currency would either
throw on a real input or silently produce a total in the wrong denomination. Those rows are
counted out and named.

**This is not a licence to leave that residue open.** It is the read side declining to hide
it.

### The walk is project-scoped, and that one decision replaces three worse ones

**This section replaced an earlier version of itself. The earlier version was wrong, and the
replacement went missing for a round — both are recorded, because the second is a process
failure rather than a design one.**

Review found that one unreadable requirement note anywhere in the vault would fault the whole
summary. `ObsidianRequirementRepository.filterLoaded` is the body of `listByZone`, its ids are
`index.getIdsByType('renovation-requirement')` — every requirement in the vault — and it returns
on the first read error, *before* the zone predicate:

```ts
for (const id of ids) {
	const found = await this.getById(id);
	if (isErr(found)) return found;          // first error, whole list
	if (found.value !== null && predicate(found.value.entity)) loaded.push(found.value);
}
```

The first fix was to widen that shared method to `{ loaded, refused }`. **Three further findings
showed that to be the wrong shape**, and all three dissolve into one better decision.

**`RequirementRepository` gains `listByProject`, and `listByZone` is not touched at all.**

- **Mutation paths keep failing closed.** Widening the SHARED method would have removed the
  error `DeleteZoneCommand` relies on before `runDeleteResolution`: an unreadable requirement
  referencing the zone being deleted would not be seen, and the zone would be deleted leaving it
  orphaned. `AssignAssetCommand` leans on the same strict result against a duplicate assignment.
  A read concern was about to weaken a write guarantee.
- **One bad note is counted once, and only if it is ours.** Unscoped ids meant every per-zone
  call hit the same malformed note, so aggregating counted it once per zone — and counted
  another project's note against this project.
- **The walk is bounded.** Per-zone delegation cost `zones × all-requirements` reads: 5,500 for
  11 rooms in a vault of 500, on mount and every refresh, which coalescing reduces the number of
  but not the size. It is a requirement of this increment rather than an alternative in a
  paragraph.

**The project axis is MIXED, so the listing intersects it with the type.**
`InMemoryProjectIndex.index()` adds every entry carrying a `projectId` to `idsByProject` —
plans, zones and requirements alike — so `getIdsByProject` alone would try to parse a plan as a
requirement. `ObsidianPlanRepository` already shows the house pattern at its own project walk
(`if (!plans.has(String(id))) continue;`), and this listing takes it: intersect with
`getIdsByType('renovation-requirement')` before loading anything. Reported after the first draft
of this section specified the axis alone, which would have faulted the summary or inflated
`unreadableRequirements` on every ordinary project.

**Decision 2's delegation survives, and that is the constraint this had to respect.**
`GetRequirementsForZone`'s per-row builder is extracted and shared, so both callers compute a row
identically; what differs is only which ids they read. Delegating the whole QUERY was never the
point — agreeing on the ROW was.

`ProjectSummary` gains `unreadableRequirements`, counted from this project's own refusals.

**A pre-existing exposure is left standing, deliberately.** One bad requirement note still blanks
the Plan Editor's Requirements panel for every zone, because `listByZone` keeps its strict
contract. That is a real defect and it is not this increment's: fixing it means deciding what a
partial Inspector panel shows, which is the Plan Editor's surface to design.

**How the replacement went missing.** The edit that wrote this section ran in a script whose
later step raised, and the file write was the script's last statement — so nothing was written,
while a follow-up script's edits to the Files list and the test table succeeded. The document
then said `listByProject` in its Files section and `listByZone` here, and I did not notice
because an unrelated `exit=0` printed in the same output read as confirmation. **A write is not
verified by a neighbouring command's exit code**, and a spec that contradicts itself between two
sections is the exact defect this document keeps recording about other things.

### A row's own referent reads must not fault the summary either

**The same class as the listing finding, one layer down, and broader than it was reported.**
`buildRow` propagates every referent read it makes:

```ts
if (isErr(asset)) return err(asset.error);          // line 170
const zone = await this.loadOriginZone(r);
if (isErr(zone)) return err(zone.error);            // line 174
```

So a malformed ZONE note faults the row, which faults the whole summary — the finding as
reported. Checking it found the **asset** read one line above has the identical shape, which
nobody named: a malformed asset note in the shared catalogue would take every project's Overview
down with it. Fixing only the zone would have been the partial fix that reads like a complete
one.

The project-level builder tolerates a failed referent read, counts it, and produces a row rather
than propagating. `unreadableRequirements` covers the row and its referents, because the user's
question is "how many figures could not be read" and the answer does not improve by naming which
note underneath it was at fault — the diagnostics report is where that belongs.

**A read that FAILED and a referent that is ABSENT stay different, and the DTO already draws
that line.** `getById` answering `ok(null)` is a deleted asset: the row renders with
`missingTarget: 'asset'` and its stale reason, which is information the user can act on.
`isErr` is a note that could not be read: excluded and counted. Collapsing them would either
hide a deletion or invent one.

### The foreign-row category dissolved, and that is worth recording rather than deleting

An earlier round found that a requirement whose `origin.zoneId` sits in this project while its
own `projectId` names another would be summed into the wrong total — the walk started at zones,
`RequirementInspectorDTO` exposed no `projectId`, and with both projects on one currency nothing
could tell. The answer then was a `foreign` count: exclude and report.

**The project-scoped walk makes that state unreachable.** `getIdsByProject` selects on the index
entry's project, which `buildProjectIndexEntries` reads from the note's own `project`
frontmatter — the same field the entity carries and the same field
`RecalculateRequirementCommand` resolves from. A row reached here is this project's by
construction, so `foreign` has nothing to count and is gone from `ProjectSummary`.

`RequirementInspectorDTO` still gains `projectId`. It costs nothing, and it is what lets a test
assert the walk really is scoped rather than trusting that it is.

**The mirror case survives and is the honest residue.** A requirement whose `projectId` names
THIS project while its `origin.zoneId` points into another project's plan is reached and counted
here, and its area comes from that foreign zone. That is not a defect to fix: `projectId` is the
authority the command reads, so the summary and `RecalculateRequirementCommand` agree about the
row — which was the whole point of reading the same field. A surface that disagreed with the
command would be the worse failure.

**Prefer making a state unrepresentable to counting it.** The `foreign` count was a correct
answer to the question as posed; changing the walk meant the question stopped being asked. The
category is recorded here rather than quietly removed, so the next reader meets the reasoning
instead of wondering why a reviewed finding left no trace.

### The orphan limitation closed, by the same change

The previous draft recorded that a requirement whose zone was deleted is invisible to the total,
because the walk started at zones — and said closing it "needs `listByProject` on the requirement
port, which is its own increment". This increment builds exactly that, so the limitation is
closed rather than inherited.

`RequirementInspectorDTO`'s own docblock predicted this surface by name: *"the union gains
`'zone'` with the project-level surface that can produce it"*. `missingTarget` gains `'zone'`
here, and an orphaned requirement is counted and rendered from its id plus the reason, the way
an asset-less row already is.

**Two walks, not one, and the counts say which is which.** `zoneCount` still comes from
plans → zones; `requirementCount` comes from the project-scoped requirement read. They are
different questions and a requirement that outlived its zone is precisely the case where the
two disagree — so collapsing them would reintroduce the blindness this section closes.

## Decision 4 — this surface says "Rooms"

The Plan Editor redesign's principle 8 is explicit: the user-facing words are Room, Wall, Area
and Work — never Zone, Polygon, Vertex or Scene. The shipped UI still says Zone
(`editor.layer.zone`, `editor.toolbar.draw-zone`, `editor.inspector.delete-zone`).

This surface is NEW, so it is born in the destination vocabulary rather than shipped in a word
the product has already decided against and renamed later in a screen nobody has reason to
reopen. `Zone` stays the DOMAIN word behind it — the entity, the events, the frontmatter, the
repository and every existing locale key are untouched. Only the copy this screen renders moves.

**The cost is a real inconsistency for the length of one branch** and is accepted rather than
glossed: until the editor branch lands its own rename, a renovator reads `Rooms` on Project
Home and `Zones` in the Plan Editor's layer panel and toolbar. The alternative considered and
rejected was renaming every locale key here, which settles it once and puts a locale-wide diff
on the branch most likely to conflict with the editor's own copy edits.

**Whichever branch lands second owns the reconciliation.** If it is the editor's, this surface
already agrees with it and nothing moves. If it is this one, the editor's rename sweeps the
remaining keys and this surface is already correct. Named here because a temporary
inconsistency that nobody has written down is indistinguishable from an oversight.

## Decision 5 — Overview ships thin

Drawing the mock (`src/prototypes/ProjectHome.vue`) answered the question it was drawn for.
With the wireframe's four unbacked elements refused — planning completeness, next-best-action,
work items, a schedule — Overview is a headline figure, three counts and a strip: roughly a
third of the pane at 460px and less at 1280.

That is accepted. The figure is the first answer this plugin can give to *what does my project
cost*, and a screen that answers one question honestly is worth navigating to; the two
alternatives both cost more than the space is worth. Folding the plan list into Overview fills
it by making Overview and Design stop being distinct, which is a question the prototype spec's
§3 asks out loud. Pulling next-best-action forward fills it properly and roughly doubles the
increment.

**Next-best-action is therefore the next increment on this shell**, and it is buildable from
entities that already exist — uncalibrated plans, plans with no rooms, stale figures. The empty
space is where it goes.

## Decision 6 — the editor concept is the visual authority, and this surface conforms to it

`docs/user-experience/renovation-planner-editor-specs/` and `docs/user-experience/concepts/`
have already decided most of this screen. The mock was rebuilt against them, and what changed
is worth listing because each item was an invention standing where a decision already existed:

- **The shell is REUSED, not redrawn.** `.rp-project-detail__header` already solves the grid
  (back at `grid-column: 1 / -1; justify-self: start`), the ellipsing name (`min-width: 0`, so a
  long name does not shove the status off a 460px leaf) and — the one that matters — the focus
  rings, which both header buttons opt back in because Obsidian's global `:focus { outline:
  none }` reaches buttons and the vendored reduction puts nothing back. The redrawn header
  inherited none of it and shipped **no visible focus indicator at all**, a WCAG 2.2 2.4.7
  failure at AA on a standard `PRODUCT.md` binds by name. The copy was invented too: the string
  is `view.project.back` — "Back to projects" — translated since slice 21.
- **The section switch takes `PerspectiveSwitch`'s contract**: tablist semantics, arrow-key
  navigation, explicit active state. A roving `tabindex` is what makes that real; a row of
  buttons carrying `aria-current` is reachable and is not what the contract asks for.
- **The estimate is a `CalculatedValue`**, which the component library requires to "expose
  provenance and cannot masquerade as a manually editable stored value". So the derivation is
  printed under the figure rather than implied. `canvas.css` states the same rule from the other
  side about the planning meter: a bare number is "exactly the derived-value-that-is-not-derived
  the README caught in the areas". This is the product's central positioning claim rendered as
  a sentence, and it is why the figure is not a hero tile — the craft floor refuses "big number,
  small label, supporting stats, accent" as a scaffold.
- **The counts follow `.rc-counts`** — a hairline grid, `tabular-nums`, and a zero that dims
  rather than colours. One rule is deliberately NOT followed and Decision 6a says why.
- **The qualifiers are `.rp-badge`**, whose `data-health="stale"` variant this screen needs by
  name; a label first and a mark second, hue on the border and the icon, never on the word.

### Decision 6a — the counts are not controls yet

`canvas.css` makes each count a control, on the grounds that a count is "navigation to a
filtered list". Here they are not, for two reasons a capture settled. Only Plans has a
destination built, and mixing a `<button>` cell with two `<div>` ones drew two different
backgrounds in one grid, because Obsidian styles every button. And the destination a Plans cell
would navigate to is the Design tab, sitting three centimetres above it — a count that
duplicates an adjacent route is a second door to one room rather than navigation.

They become controls when Rooms and Requirements have somewhere to go. The concept's rule is
waiting for them, and the column-button `align-items` trap it records is kept in the CSS for
that day rather than deleted and rediscovered.

### What promotion additionally costs

**`concept.css` is a drawing in `docs/`, not a stylesheet the product has.** The first rebuild
reused `.rp-badge` by name and the badges rendered as bare run-on text, because the harness
serves the plugin's own assembled `/styles.css` and no such rule is in it. Nothing in
`npm run check` can see that class of mistake — no gate reads `docs/`.

So promoting these components adds a `styles/` partial carrying `.rp-badge` and its variants,
at `concept.css`'s own values, plus the section switch, the counts and the warning strip. That
partial is a new line in the Files list below rather than an implementation detail: SDD §84's
colour check runs over the assembled sheet and never sees inside an SFC, so the mock's
`<style scoped>` block does not travel.

## Decision 7 — the summary needs a change source of its own

**A gap in the first draft of this document, found by review.** The spec named no invalidation
for the summary, so Overview would have drawn the vault as it stood at mount and gone stale
while the pane sat open — in exactly the arrangement this product is for, a Plan Editor leaf
beside the project surface.

`createProjectPlansChangeSource` cannot serve it, and that is a fact about its lists rather
than an oversight: it subscribes to `PlanCreated` plus `ProjectIndexEntryChanged` filtered to
`entityType === 'renovation-plan'`. Nothing zone- or requirement-shaped reaches it. It stays
exactly as it is — Design asks "did this project's plans change" and that is the right
question for a plan list.

So Overview takes a **fourth** change source, `createProjectSummaryChangeSource`, and the
remount decision is what makes that affordable: only the mounted section subscribes, so the
wider question is asked only while the surface that needs it is on screen.

### The three lists, and why it is three rather than one

**Filterable by project** — every one of these carries `projectId` in its payload, verified in
`Zone.events.ts` and `Requirement.events.ts`:

`PlanCreated`, `ZoneCreated`, `ZoneDeleted`, `ZoneGeometryChanged`, `RequirementCreated`,
`RequirementRecalculated`, **`RequirementDeleted`**.

`RequirementDeleted` is the event this increment mints below, and it was missing from this list
for one round — **specified as published and never subscribed to**, which is the shape of
mistake that makes a whole feature a no-op while every part of it reads correct in isolation.
It carries the same `RequirementEventPayload` its siblings do, so it filters by project.

`ZoneGeometryChanged` is in that list for the reason the whole product exists: an area is an
input to a cost, so a moved vertex changes the total and marks figures stale.

**Not filterable, and this is the finding under the finding.** Five carry no owning project at
all. **This list is the authority; two of its members reached it late and by correction, and the
reason is recorded below it.**

- `RequirementInvalidated`'s factory takes a bare `requirementId` — there is no payload object
  to filter on.
- `CostEstimateChanged`'s `CostChangePayload` is `{ costType, scope: { kind, id }, currency }`.
  It names the requirement and the currency and never the project.
- `ProjectIndexRebuilt` carries no payload by design, so it cannot say which entities changed.
  See *Two events the first draft's lists simply missed*.
- `AssetUpdated` is the FAILURE-PATH notification: when a cascade cannot enumerate an asset's
  referents it returns before publishing anything, and this is the only notice that the summary
  moved. See *A row's own referent reads must not fault the summary either*.
- `GeometrySidecarChanged` for a PLAN sidecar. A zone's geometry lives in the `.rpgeo`, and an
  out-of-band edit publishes this and deliberately not `ProjectIndexEntryChanged`, because the
  index mapping did not move. Its payload names the sidecar rather than an owning project. See
  *Two events the first draft's lists simply missed*.

**How the last two came to be missing is worth more than the fact.** Both were argued in their
own sections, given test rows, and reported as absent from THIS list one round later — because
the edits that were meant to add them targeted a comma-separated sentence that does not exist
here. The list is bullets. `str.replace` on an absent anchor changes nothing and says nothing,
so two additions silently did not happen while their prose and their tests said they had.

An implementer reads the list, not the prose around it. **A specification with a canonical list
must have exactly one, and every claim about its membership belongs in it rather than beside
it.**

They are delivered **unfiltered**, so an event for any project in the vault re-reads this one
project's summary. That is the identical trade `PLAN_ENTRY_EVENTS` already states and it is
affordable for the identical reason: the view is a singleton and the query is project-scoped.
*Trigger to narrow it: either payload gaining the owning project id.*

Leaving `CostEstimateChanged` out was the tempting simplification and it is the one that breaks
the reviewer's own scenario. A cost OVERRIDE changes the total without recalculating anything,
so `RequirementRecalculated` never fires for it — omit this event and an override in another
leaf is invisible to the Overview until a remount.

**Index entries**, for a note that arrives out of band — a hand edit, a copy, a sync.
`ProjectIndexEntryChanged` filtered to the plan, zone, requirement, project **and asset** entity
types.

**The asset type is not a courtesy either.** `GetRequirementsForZone` re-reads the referenced
asset on every row and compares its unit and unit cost through `assetMatchesCalculatedFrom` to
decide whether a persisted figure is still current — so a price edited in the catalogue by hand
or arriving through sync moves this summary's stale count, and a deleted asset note moves it too
by way of a missing target. No `AssetUpdated` cascade runs for an out-of-band edit; the index
entry is the only notice there is.

**The project type is not padding, and leaving it out was a real hole.** A hand edit or a sync
that changes the project note's `currency` publishes `ProjectIndexEntryChanged` with
`entityType === 'renovation-project'` — the same value `projectListChangeSource` already filters
on. The shell's own `onProjectsChanged` hydrate then updates the header while leaving a ready
Overview mounted, so the header would read the new currency above a total still denominated in
the old one, with `unsummable` counted against a currency the project no longer uses. Currency
is this summary's denominator; a change to it invalidates every figure on the surface.

### The undo/redo path publishes nothing at all, and that is a category

**Three review rounds each reported one more silent write path.** After the second I wrote that
"the other half is auditing which write paths raise none" and then audited the two that had been
reported. That is the partial fix this repository already has a name for, so the third round is
answered with the sweep instead — every reversible adapter, counted rather than sampled:

```
$ for f in $(grep -rln "UndoableCommand\|Reversible" --include=*.ts src/application); do
    printf "%s publishes=%s writes=%s\n" "$f" $(grep -c "publish(" $f) \
      $(grep -cE "\.(save|delete|restoreZone|markStale)\(" $f)
  done
```

| adapter | publishes | writes |
|---|---|---|
| `zone/reversible-create-zone-command.ts` | **0** | 1 |
| `zone/reversible-delete-zone-command.ts` | **0** | 2 |
| `requirement/reversible-assign-asset-command.ts` | **0** | 2 |
| `requirement/reversible-override-commands.ts` | **0** | 1 |
| `plan/ReversibleSetPlanBackground.ts` | **0** | 1 |
| `plan/ReversibleCalibratePlan.ts` | 2 | 0 |
| `zone/MoveSpatialObject.ts` | 1 | 1 |
| `editor/asset/ReversibleAssetDesignCommands.ts` | 4 | 2 |
| `asset/SetAssetBackground.ts`, `asset/CalibrateAsset.ts`, `asset/updateAssetShape.ts` | 1–2 | 0–1 |

**Five adapters write and announce nothing**, and the fifth — `ReversibleSetPlanBackground` — was
reported by nobody. The sweep found it, which is the whole argument for doing the sweep: three
rounds of one-at-a-time would have taken three more rounds to reach it, and it would have shipped.

**It is one defect, not five.** The forward commands publish; the reversible adapters restore
snapshots through the repository PORTS directly, and `CLAUDE.md` records exactly why those ports
are raw — "the boundary stops at the repository PORTS … because the reversible adapters restore
snapshots through them". Publishing was never part of that path. So every undo and every redo in
the plugin is invisible to every subscriber, and this surface is simply the first one that reads
enough of the vault to notice.

**Nothing downstream can compensate**, which is what makes it this increment's problem rather
than a nice-to-have: a plugin-owned write updates the index synchronously and `EchoWindow`
suppresses the vault event it raised, so `ProjectIndexEntryChanged` never fires either.

The increment therefore makes the reversible adapters announce. Concretely:

- `reversible-create-zone-command` and `reversible-delete-zone-command` publish `ZoneCreated` /
  `ZoneDeleted` on the replayed side, and the delete adapter's `undoDeleteResolution` publishes
  for the requirements it restores.
- `reversible-assign-asset-command`'s `redoCreate` publishes `RequirementCreated`.
- `reversible-override-commands`' `undo` publishes `CostEstimateChanged`, since a cost-override
  undo changes the effective total and a quantity-override undo reprices the calculated cost.
- `DeleteAsset`'s resolution paths publish requirement-level events rather than leaving
  `assetDeleted({ assetId })` — which carries no project id — to stand for them.

**One event has to be minted.** The vocabulary is `RequirementCreated`, `RequirementRecalculated`
and `RequirementInvalidated`, and none means "this row is gone", so the assign adapter's `undo`
has nothing to publish. `RequirementInvalidated` is the tempting substitute and it says something
different — a figure stopped being trustworthy, not a row stopped existing. This increment mints
`RequirementDeleted`.

**`ReversibleSetPlanBackground` is out of this increment's scope and is recorded anyway.** A
background is not a cost input, so it moves nothing this summary shows; what it moves is the Plan
Editor's own picture in a second leaf on the same plan. Named here because the sweep found it and
a finding recorded nowhere is one the next sweep re-discovers.

### Two events the first draft's lists simply missed

Both reported, both verified, both pure additions rather than design changes:

- **`GeometrySidecarChanged`.** A zone's geometry lives in the plan's `.rpgeo`, and a sync or
  hand edit to it publishes this event and deliberately NOT `ProjectIndexEntryChanged`, because
  the index mapping did not move. `GetRequirementsForZone` reads that geometry to decide whether
  a persisted figure is still current, so the stale count moves and nothing said so. It is
  already consumed by `planChangeSource` and `assetDesignChangeSource`; this source was the one
  that forgot it.
- **`ProjectIndexRebuilt`.** Published at `RenovationPlannerPlugin.ts:680` with no per-entry
  events at all, so a manual index rebuild left the summary on the pre-repair index. It joins the
  unfiltered list, since a rebuild carries no payload and cannot say which entities changed.

### The source coalesces, because one edit is a burst rather than an event

**Reported, verified, and it multiplies with the read cost recorded above rather than sitting
beside it.** A single geometry or asset-price change is not one notification.
`cascadeOne` publishes `requirementInvalidated` for each affected requirement and then calls
`recalculate`, which publishes its own event and often `CostEstimateChanged` with it — on top of
the `ZoneGeometryChanged` or `AssetUpdated` that started the cascade. An edit touching **R**
requirements therefore emits up to **3R + 1** events that this source is subscribed to.

Forwarded straight to `hydrate`, that is 3R+1 full project-summary walks. Each walk already
costs `zones × all-requirements` reads for the reason recorded above, so the two compound:
moving one vertex in a room with 8 requirements, in a vault of 500, is 25 walks of 5,500 reads.
Not a slow surface — an unusable one, and overlapping hydrations racing each other besides.

So `createProjectSummaryChangeSource` **coalesces**: every event in a burst schedules one
trailing refresh rather than its own. The listener is called once when the burst settles, which
is the only shape that stays correct as the cascade's event count changes, since a fix counting
today's three would go stale the next time a command learns to announce something.

**Coalescing is not deduplication and the distinction matters here**: the events differ, and
collapsing them is legitimate only because the ANSWER is the same — one re-read of one summary,
whatever moved. That is true of this source and would not be true of a source whose listener
took the event.

**What coalescing does NOT bound, stated rather than implied.** A trailing refresh is scheduled
from the event that starts a cascade, and the cascade's own handler writes before publishing the
rest. If those writes outlast the debounce, the first refresh runs mid-cascade and the later
events schedule another — fewer walks than one per event, and not the single walk this section's
opening sentence could be read to promise. Bounding it properly needs a cascade-completion
signal whose lifetime covers the asynchronous handler, which is a mechanism this document does
not design and an increment does not get to invent in a review round. The claim is narrowed to
what the trailing refresh actually delivers, and the boundary is named as open.

It pairs with a request ticket on the store, which is this repository's existing answer to two
things hydrating one store: without it the slower earlier read wins and a just-recalculated
figure reverts. `ProjectStore` and `InspectorStore` both carry one already.

Its test drives a multi-row cascade and counts the READS, not the notifications — a
notification count passes against a build that coalesces nothing, because the events really were
delivered.

### Why not fold this into `projectPlansChangeSource`

Two sections ask two questions. Widening the plans source would make the Design tab re-read its
plan list on every requirement recalculation in the vault, which is the "once per synced zone
note" cost the project list's own filter exists to avoid. The list is the extension point
within one question, never across two.

## Components

```text
ProjectDetailState.vue   shell: reads context.projectId + context.section,
                         owns the project store, dialogs, subscriptions
  |- ProjectHeader.vue   name, status, back, Open note, library-overlap marker
  |- ProjectNav.vue      the section switch, rendering only SECTIONS
  \- <section>           ProjectOverview.vue | ProjectDesign.vue
```

`ProjectDetail.vue` splits. Its header becomes `ProjectHeader`; its plan list and `New plan`
form move wholesale into `ProjectDesign.vue`. Nothing about plan creation changes — same
command, same dialog, same `'gone'` handling and the same `dialogs.resolve` on a status
watcher. It acquires an address and nothing else.

`ProjectOverview.vue` is new. It draws slice 21's existing `renovationProject.noPlans` empty
state when the project has no plans **AND no requirements**, whose action navigates to Design
rather than opening the form in place — the header and nav stay mounted around every section,
which is slice 14's rule arriving on a fourth surface: an empty state that replaces a region
hides the thing the region exists to show, and here that thing is the way back.

**The second half of that condition is a correction, and it is Decision 3's own consequence
catching up with this rule.** Gating on plans alone was right while the walk reached
requirements through a plan's zones — no plans meant no figures, so an empty state hid nothing.
The project-scoped walk recovers a project's persisted requirements whether or not a plan note
survives, so a project whose only plan note was deleted out of band still has counts and a total
worth showing, and gating on plans would replace them with an invitation to create a plan. That
is the same failure the rule is quoted against, one layer up: an empty state hiding the thing
the region exists to show.

**Empty means nothing to show, never nothing of one kind.** Written that way rather than as
"plans and requirements" so the next entity the summary learns to count joins the condition
instead of reopening this.

**And nothing REFUSED, which is the other half and the one with a precedent in shipped code.**
A project whose only plan note is unreadable has zero visible counts, so a condition reading
only those counts selects the onboarding state — hiding the partial-read notice and inviting the
user to create a plan when one already exists and simply could not be read. That is the worst
answer available: it is wrong, it is actionable, and following it produces a second plan.

`selectRenovationProjectEmptyState` already draws this line for the project LIST, and
`CLAUDE.md` records the shape: it answers `null` on `unreadable > 0` **before** it ever looks at
the length, so a vault whose only projects are unreadable draws the list and the refusal notice
rather than "no projects yet". This surface owed the same rule one level down and did not have
it. So: empty is nothing shown, nothing refused, and nothing counted.

`toProjectSummaryDto` lives in the read-model bundle beside every other `to*Dto`, because
`application/` may not name `presentation/`.

## Decision 8 — two promises the artifacts did not keep

Both found by review, and both are the same class: the document asserting something no artifact
delivers. Neither is a design disagreement, which is what makes them worth a decision of their
own rather than a quiet edit — a spec that over-promises is the defect this repository names
first among its Claims rules.

**The dates were promised and drawn nowhere.** *Scope* says Overview shows "status, dates,
currency…". The first mock drew a timeline line; the rebuild against the editor concept dropped
it, and `ProjectSummaryDto` never carried the fields at all. `Project` has had
`start` and `targetCompletion` since design slice 16 persisted them, so the data exists and only
the read model and the markup were missing.

The DTO gains both, and `ProjectHeader`'s region renders them beneath the section switch. **A
project with neither renders no line**, rather than "No dates set": both are optional on
`Project`, a renovation planned without a deadline is an ordinary project, and a line whose
whole content is an absence is noise on the surface that exists to answer what a project costs.

**The diagnostics action had no door.** The mock's warning strip offers *Open diagnostics*; the
production route is `RenovationPlannerPlugin.openDiagnosticsReport()`, and
`RenovationProjectDeps` exposes no diagnostics member — so promoted as specified it would have
been a live control that does nothing, which is precisely the failure slice 14's amendment
refuses and which this document cites approvingly two sections above. Writing that rule down did
not stop me drawing the button.

`RenovationProjectDeps` gains `openDiagnostics`, the same shape as its existing `openPlan` and
`openAsset` — a callback the composition root binds, so `presentation/` still learns nothing
about the plugin. That is one member and one binding, which is what makes keeping the action
cheaper than dropping it; a user whose plan note could not be read is exactly the user the
diagnostics report exists for.

**The general shape, and it is this branch's most repeated one:** a rule stated in this document
is a rule some artifact of this document is not following, and the artifact is where to look
first.

## Error handling

Three failure shapes, three surfaces, and they must not collapse into one:

1. **The project is gone** — slice 21's `'gone'` screen, unchanged. The shell decides this
   before any section mounts, so it cannot be reached differently from Overview than from
   Design.
2. **A partial read** — some plans unreadable, some zone reads refused. The section still
   draws, with `.rp-view-notice`'s additive strip naming the count. The plan list already does
   this for `unreadablePlans`; Overview joins it rather than inventing a second treatment.
3. **The summary read faulted** — `ViewFailure` inside the Overview region only, with the
   header and nav still mounted. Retryable, and `viewHydrationOrigin` already withholds the
   retry from a `settings.unrecovered` bootstrap failure, so this surface re-decides nothing.

Every `AppError` reaching Overview goes through `surfaceFor(error, origin)` under one new
origin. Slice 17's `unique symbol` lock means the component cannot reach `notifyError` without
asking, so this is a table entry rather than a discipline.

## Testing

Each case with the mutation that must redden it — a test watched failing against the opposite
mistake, per this repository's rule.

| Area | Case | Mutation |
|---|---|---|
| View state | `{ projectId: '', section: 'design' }` normalises to the list | dropping the normalisation puts the pane in a section of no project |
| View state | an unknown section resolves to Overview | refusing it leaves a restored `'budget'` leaf drawing nothing |
| History | Overview to Design sets `result.history`; a no-change restore does not | an unconditional guard claims a navigation on every restore |
| Navigation | selecting Design writes `{ projectId, section }` through the plugin binding and arrives as `'design'` | a one-argument binding compiles unchanged and discards the section, and a test on `navigate` alone passes against it |
| Remount | the mount sequence is `[null, 'p1:overview', 'p1:design']` | comparing only `projectId` leaves Design drawing Overview |
| Summary | the total sums `cost.effective` across two plans and four zones | — |
| Summary | one stale row is counted AND still in the total | summing only current rows understates it; dropping the count hides it |
| Summary | a foreign-currency override lands in `unsummable` and the total survives | assuming one currency throws on a reachable input |
| Summary | one summary read resolves the project currency ONCE | the figure renders identically however many times it is read, so this is pinned on the CALL COUNT |
| Delegation | the project total's staleness agrees with `GetRequirementsForZone` | a second derivation passes every other case in the file |
| Invalidation | a `RequirementRecalculated` for THIS project refreshes the summary; one for another project does not | an unfiltered list re-reads on every requirement in the vault |
| Invalidation | a `CostEstimateChanged` refreshes the summary even though its payload names no project | omitting it makes a cost override in another leaf invisible until remount — the case `RequirementRecalculated` cannot cover |
| Invalidation | `ZoneGeometryChanged` refreshes the summary | a moved vertex changes an area, and an area is an input to the total |
| Invalidation | undo and redo of Assign Asset each refresh the summary | both write paths publish nothing today, so a subscription-only fix passes no case at all |
| Invalidation | undo of a zone create and undo of a zone delete each refresh the summary | the replayed side restores through `restoreZone` and announces nothing |
| Invalidation | undo of a cost override and of a quantity override each refresh the total | `ReversibleOverrideBase.undo` saves directly and publishes nothing |
| Invalidation | a `.rpgeo` edit arriving out of band refreshes the stale count | it publishes `GeometrySidecarChanged` and deliberately not `ProjectIndexEntryChanged` |
| Invalidation | a project note whose currency changed out of band refreshes the summary | the header updates without it and the total keeps the old denominator |
| Summary | a malformed ZONE note leaves every other figure drawn | `buildRow` propagates the zone read, so one bad zone faults the whole summary |
| Summary | a malformed ASSET note leaves every other project's figures drawn | the same propagation one line above, in the SHARED catalogue — unreported, found by checking the reported one |
| Summary | a DELETED asset still renders its row with `missingTarget: 'asset'` | collapsing absent into unreadable hides a deletion the user can act on |
| Invalidation | an asset price change whose cascade cannot enumerate referents still refreshes the summary | the cascade returns before publishing, so `AssetUpdated` is the only notice there is |
| Summary | one malformed requirement note leaves every other figure drawn, counted once in `unreadableRequirements` | an unscoped walk counts it once per zone, and a per-zone widening counts another project's note too |
| Summary | a malformed requirement in ANOTHER project is invisible here | an unscoped walk both faults on it and miscounts it |
| Commands | `DeleteZoneCommand` still refuses when a referent cannot be read | widening the shared `listByZone` lets it delete a zone whose referent it never saw |
| Summary | one summary read issues one project-scoped requirement listing | per-zone delegation is `zones × all-requirements`, which coalescing shrinks in count and not in size |
| Invalidation | an asset price edited out of band refreshes the stale count | no `AssetUpdated` cascade runs for a hand edit; the index entry is the only notice |
| Invalidation | `RequirementDeleted` refreshes the summary | it was specified as published and not subscribed to for a round — published-and-unheard passes every publishing test |
| Summary | `summed` is the query's own count rather than the component's arithmetic | deriving it double-subtracts a row caught by two exclusion categories, and the counts are independent by design |
| Accessibility | only the SELECTED tab carries `aria-controls`, and the id it names exists | one panel exists at a time, so an inactive tab's `aria-controls` is a dangling IDREF |
| Keyboard | after a section change through view state, focus is on the newly selected tab | the mock's local `ref` hides this; only the real round trip unmounts the element |
| Overview | a project whose only plan note is unreadable draws the notice, never the empty state | zero visible counts otherwise select onboarding, and following it creates a second plan |
| Overview | a project with no plans but surviving requirements shows the summary, not the empty state | gating on plans alone hides figures the project-scoped walk recovered |
| Overview | a project with a start or target date renders it; a project with neither renders no line at all | the DTO carried neither field, so the promise was undeliverable rather than merely unbuilt |
| Wiring | the warning strip's action reaches `openDiagnosticsReport` | without the deps member it is a live control that does nothing — the shape slice 14 refuses |
| Keyboard | a restored leaf and a `rebind` do NOT move focus | an unconditional focus-on-mount steals it during layout restoration |
| Invalidation | a manual index rebuild refreshes an already-mounted Overview | `ProjectIndexRebuilt` carries no payload, so nothing per-entry fires |
| Coalescing | a cascade whose writes settle within the debounce causes ONE summary read | forwarding each event directly issues up to 3R+1 walks; asserted on reads, since a notification count passes either way |
| Coalescing | a cascade whose writes OUTLAST the debounce causes at most one read per settled burst, never one per event | asserting ONE here fails a correct trailing coalescer on a slow repository — the prose declines a completion boundary, so the test may not demand one |
| Coalescing | a slower earlier read cannot overwrite a later one | without the request ticket a just-recalculated figure reverts |
| Sweep | every adapter matching `UndoableCommand\|Reversible` that writes also publishes | five of eleven publish nothing today; a per-adapter test lets the sixth ship |
| Invalidation | deleting an asset with `remove-references` refreshes the total; with `delete-anyway` it refreshes the stale count | `AssetDeleted` alone reports the wrong subject and cannot be filtered by project |
| Summary | a requirement whose `projectId` names another project is never reached | a zone-started walk reaches it and, on one shared currency, sums it into the wrong project silently |
| Summary | a requirement whose zone was deleted IS reached and reports `missingTarget: 'zone'` | a zone-started walk cannot produce that row at all |
| Invalidation | the Design section does NOT re-read its plan list on a requirement event | folding this into `projectPlansChangeSource` passes every Overview case and costs Design a read per requirement in the vault |
| Errors | a partial read draws the section plus the strip; a faulted read draws `ViewFailure` inside Overview with header and nav still mounted | replacing the whole shell takes the back control with it |
| Accessibility | the Overview scan asserts `.rp-empty-state`, `.rp-project-detail__back` and the nav's current-section marker are in the scanned DOM | grading a component instead of a surface |
| Accessibility | the switch is a `tablist` whose tabs carry `aria-selected` and a roving `tabindex`, and ArrowLeft/ArrowRight move the selection | a row of buttons with `aria-current` passes every rendering case and fails the `PerspectiveSwitch` contract |
| Accessibility | every control this surface adds has a `:focus-visible` rule | Obsidian's global `:focus { outline: none }` reaches buttons and the vendored reduction restores nothing |

**A harness shot**, `?project=project-1&section=overview` at both widths, joining the existing
`project-detail` pair: the nav is a row of controls under a header, and row spacing, wrapping
at 460px and the current-section marker's contrast are measurements no gate here performs.

**A manual case**, `docs/tests/cases/Navigate a project's sections.md`, for the one thing
`FakeLeaf` cannot answer — whether Obsidian's own back arrow really walks section states.
`FakeLeaf` records asks rather than behaving, exactly as slice 21 recorded for its own
navigation case.

## Files

**New:** `src/application/queries/GetProjectSummary.ts`;
`src/application/events/projectSummaryChangeSource.ts` (Decision 7);
a `RequirementDeleted` domain event (Decision 7); `RequirementRepository.listByProject`
with a `{ loaded, refused }` result over the `getIdsByProject` axis the index already has, plus
the extraction of `GetRequirementsForZone`'s per-row builder so both callers agree on a row;
`src/presentation/views/sections.ts`
(the `SECTIONS` list and the parse); `ProjectHeader.vue`, `ProjectNav.vue`,
`ProjectOverview.vue`, `ProjectEstimate.vue`, `ProjectDesign.vue`; a `styles/` partial carrying
`.rp-badge` and its variants, the section switch, the counts and the warning strip, per
Decision 6; the manual test case.

**Changed:** `ProjectSummaryDto` gains `start` and `targetCompletion` (Decision 8);
`RenovationProjectDeps` gains `openDiagnostics` and the composition root binds it (Decision 8);
the five reversible adapters that write and publish nothing —
`reversible-create-zone-command.ts`, `reversible-delete-zone-command.ts`,
`reversible-assign-asset-command.ts`, `reversible-override-commands.ts` — plus `DeleteAsset.ts`
(Decision 7); `GetRequirementsForZone.ts` (`projectId` on the DTO, and
its per-row builder extracted for sharing); `RenovationProjectView.ts` (parse, `sync`, `setState`);
`RenovationProjectContext.ts` (`navigate` gains a section), and with it
`RenovationPlannerPlugin`'s `navigate` binding and `navigateToProject.ts`, whose written state
is hard-coded to `{ projectId }` — all three, because the binding's arity keeps it compiling
while dropping the section; `ProjectDetailState.vue` (becomes
the shell); `ProjectDetail.vue` (splits); the read-model bundle; `composition-root.ts` / `guardedServices.ts`; `errorSurfacePolicy.ts` (one
origin); `en.ts` / `de.ts`; `scripts/harness-shot.mjs`; `tests/harness/page.ts`; `CLAUDE.md`.

## Deliberately out of scope

Named so none of it later reads as an oversight.

- **Planning completeness %** (wireframe §A.10). It needs a definition of "complete" that no
  entity supports. A percentage invented for a progress bar is a hard-coded count in
  production UI, which the editor implementation plan forbids by name.
- **Next-best-action** (UXD §11), per Decision 5 — the next increment on this shell, and what
  the space Overview leaves empty is for.
- **Recent activity** (§A.10). There is no activity log and nothing raises one.
- **The five hidden sections** and every entity beneath them.
- **Breadcrumbs** beyond slice 21's back control. The interactive
  `Project / Space / Activity` trail needs the spatial hierarchy — the one thing that collides
  with the editor branch.
- ~~**Orphaned requirements** in the total.~~ **Struck rather than deleted**: the
  project-scoped walk reaches them, so this exclusion stopped being true and an implementer
  following a scope checklist would otherwise have omitted the behaviour the summary relies on.
  See *The orphan limitation closed, by the same change*.

## Coverage

Floors in force: statements 99, functions 99, lines 99, branches 98 (`vitest.config.ts`).

**Measured on the baseline `5702f28`** with `npx vitest run --coverage` — 342 files, 4941
passed, 65 skipped:

| metric | measured | floor | additional uncovered units the floor still permits |
|---|---|---|---|
| statements | 99.39% (7392/7437) | 99 | ~29 |
| **functions** | **99.07% (1937/1955)** | **99** | **~1** |
| lines | 99.54% (6533/6563) | 99 | ~35 |
| branches | 98.31% (3802/3867) | 98 | ~12 |

The arithmetic, so none of it has to be taken on trust: a floor of `f` permits `U` further
uncovered units where `covered / (total + U) >= f`, i.e. `U <= covered / f - total`.

**Functions is the binding metric here, not branches**, which corrects this document's own
first draft — it carried slice 19's reading forward and said both were at one unit. Branches
has since gained about twelve units of room and functions has not. That matters for how the
two fail: an untested new FUNCTION fails the gate outright, while an untested new BRANCH
disappears into twelve units of slack and says nothing, which is the shape that already cost
slice 16 an uncovered arm found only by reading `coverage-final.json` for the changed files.

So: plan the test with the code, read the floor as a floor, and re-measure rather than trusting
this table once the editor branch has merged — it will land on a third tree nobody has measured.

`viewStateFrom`'s fallback arm and every `unsummable` / `unreadableZones` arm are new branches,
and `GetProjectSummary` is several new functions. Each needs a case in the commit that writes
it, the functions especially.
