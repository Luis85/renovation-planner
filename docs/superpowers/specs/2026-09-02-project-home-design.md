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

**"Per leaf" named a property and no CARRIER, which is a promise nothing could have kept.** The
remount destroys the Vue app, so a `ref` in the tree — the obvious place — is gone before the
next `ProjectNav` mounts, and `sync()` spreads a fresh context object each time. The only object
that outlives the remount is the **view** itself. So `RenovationProjectView` holds a private
boolean and `RenovationProjectContext` carries two partially-applied members over it:
`rememberSwitchFocus(held: boolean)` and `takeSwitchFocus(): boolean`. That is the shape
`PlanEditorContext.closeLeaf()` already has and the reason it has it — the composition root
composes services and does not know which leaf this is, so a leaf-scoped fact reaches the tree
through the view rather than through the deps bundle.

`takeSwitchFocus` **reads and clears**, which is what makes it a hand-off rather than a mode: a
flag left standing would be consumed by whatever mounted next. Every shell unmount writes the
reading — `true` or `false` — so a rebind or a back-arrow navigation actively records "focus was
elsewhere" rather than leaving a stale `true` behind.

**The residue, named rather than implied**: an unmount with focus in the switch followed by a
mount with no `ProjectNav` would leave the flag set for the mount after it. Thin, because the
nav lives in the shell and the shell always mounts — and the clear-on-read is what bounds it to
one mount rather than to the leaf's life.

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
ListPlansByProject(projectId)                         -> plans, unreadablePlans
ZoneRepository.listByProject(projectId)               -> zones, unreadableZones
listByProject(projectId) ∩ getIdsByType(requirement)  -> requirements, refused
  buildRow(requirement)                               -> RequirementInspectorDTO
```

**THREE walks, each rooted at the project and none of them reached through another.** Every
count this surface prints is a question about the PROJECT, so every walk asks the project
directly — which is what makes each one's failure cost only its own count.

**This diagram showed one walk for four rounds and a half-corrected two for two more.** It was
the document's first and most canonical definition of `GetProjectSummary` while Decision 3 below
it specified something else — a per-zone walk that loses requirements whose zones were deleted,
reintroduces `zones × all-requirements` I/O, and lets an unrelated malformed requirement fault
the summary through a strict `listByZone`. Everything the sections below argue against, in the
code block an implementer reads first.

**The correction was then applied to one entity and not the one beside it**, which is this
repository's own partial-fix shape arriving in the edit that fixed the other half: the
requirement walk became project-scoped and the zone walk was left started at plans, in the same
code block, in the same round. A project whose only plan note is deleted out of band still owns
its zone notes — the plan-started walk reaches none of them, so `zoneCount` reads zero with
nothing refused, and with no requirements either the empty state then invites the user to create
a plan over a project full of rooms. `ZoneRepository.listByProject` already exists and is
already skip-and-count, so closing it costs a call rather than a port.

**A shared failure is still shared, and that bounds what the third walk buys — further than
this section first claimed.** `ObsidianZoneRepository.list` propagates a plan's unreadable
geometry sidecar rather than counting it N times, deliberately, and its own comment carries the
account. So an unreadable sidecar refuses the ZONE walk.

**And a DELETED PLAN NOTE is one of those, which retires half of what the project-scoped zone
walk was claimed to buy.** Verified at the source rather than reasoned about:
`InMemoryProjectIndex.getGeometrySidecarPath` reads the PLAN's own index entry
(`this.byId.get(entityId)?.geometrySidecarPath`), so deleting the plan note takes the mapping
with it; `PlanGeometryStore.readUnlocked` then answers `plan-geometry.path-unresolved`; and
`SKIPPABLE_ZONE_CODES` holds `zone.*` codes only, so `isSkippableZoneRefusal` is false and the
listing propagates. A zone cannot be LOADED without its plan's sidecar, whatever axis it was
found on.

**What the round-14 change did and did not buy, stated separately, because it bought the more
important half.** It DID close the reported defect: the walk no longer answers a confident zero
with nothing refused, so the empty state no longer offers onboarding over a project that holds
rooms — a refusal reaches the surface instead, and the room count is withheld with its reason.
It did NOT make the surviving zones countable, which the test row said and now does not.
Preserving or rediscovering the sidecar mapping after a plan note is deleted is a change to the
index and the vault-change pipeline that every index consumer inherits, which is the same owner
the strict-`listByZone` residue above already names, and not this increment's to make. `GetProjectSummary` catches that at the walk rather than at the
query: the room count is withheld and reported, while the plan and requirement figures still
print. One walk failing may cost its own count and never the surface.

**It shares `GetRequirementsForZone`'s row builder rather than re-deriving a row.** That query
owns the
staleness reading — the persisted marker, a `calculatedFrom` mismatch, a missing target — and,
since the `main` merge, the project's own price for a shared asset, which
`resolveEffectiveUnitCost` resolves as an input and `RequirementInspectorDTO`'s new `unitCost`
group reports. **That growth is the argument for delegating rather than a complication of it**:
a summary re-deriving its own row would have been silently one input behind from the day that
increment merged, and nothing here would have failed. The currency increment recorded exactly
what a second derivation costs: `inputsStillMatch`
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
	/**
	 * Rooms this PROJECT owns, read from `ZoneRepository.listByProject` rather than reached
	 * through its plans — a zone whose plan note was deleted out of band is still the project's.
	 *
	 * `null` when the zone walk refused outright, which is the one state in which no room count
	 * can honestly be printed: an unreadable geometry sidecar is one shared failure and
	 * `ObsidianZoneRepository.list` propagates it rather than blaming every zone in the plan.
	 * Same spelling and the same reason as `total` below, deliberately not a second one.
	 */
	zoneCount: number | null;
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
	/**
	 * ────────────────────────────────────────────────────────────────────────────────────
	 * **NO COUNT BELOW MAKES A CLAIM ABOUT `total`. Each names a STATE; `summed` is the only
	 * count of contributors, and the EXCLUSIONS alone decide membership.**
	 *
	 * Stated once, here, because stating it per count is what reopened it twice. `stale`
	 * carried a flat "They ARE in the total", which `unsummable` contradicts for any row that
	 * is both. That was corrected — and the correcting edit wrote a NEW flat claim, "They are
	 * in the total and in `stale`", onto `unreadableReferents` in the same commit, which a
	 * foreign-currency override on an unreadable-referent row contradicts identically. The
	 * shape is not the sentence: **a rule repeated per member is a rule each new member
	 * re-derives, and re-derives wrong.** The next count added here says what state it names
	 * and stops.
	 *
	 * **And centralising it here did not retire the copies elsewhere, which is the third
	 * instance and the one that says what the discipline actually is.** Decision 3's opening
	 * sentence and one test row still carried the flat claim in their own words, so the
	 * "single" rule was one of four statements of it. This repository's standing rule is that
	 * a docblock claiming to be the only place X gets a `grep` in the SAME edit; a rule
	 * MOVED to one place owes exactly that grep, and the edit that moved it here did not run
	 * one. Both copies now defer to this paragraph rather than restating it.
	 * ────────────────────────────────────────────────────────────────────────────────────
	 */
	/** Rows reading `stale`, whatever put them there. */
	stale: number;
	/**
	 * Stale rows a RECALCULATION COULD ACTUALLY FIX. Supplied, never derived by a caller — the
	 * same reason `summed` is, and it arrived by the same route: a component subtracting one
	 * count was right for one obstacle and wrong the moment a second existed.
	 *
	 * Two things stop a recalculation, and they are counted separately because they say
	 * different things to the user: an unreadable referent note (`unreadableReferents`) and a
	 * DELETED one (`missingTarget` on the row). `RecalculateRequirementCommand` refuses the
	 * second with `requirement.zone-gone` / `requirement.asset-gone` — verified at the raise
	 * sites — so "needs recalculating" is an impossible instruction for those rows too.
	 *
	 * `stale - unreadableReferents` was the arithmetic before this field and it over-counted by
	 * exactly the missing-target rows. Subtracting both would then double-count a row that is
	 * both, which is the union only this query can size — the identical argument `summed`
	 * carries, and the identical mistake made one field over.
	 */
	recalculable: number;
	/**
	 * Rows built from a referent note that could not be READ — a subset of `stale`, since a
	 * figure whose inputs cannot be re-read is never reported `current`.
	 *
	 * Counted apart from `stale` because recalculating them cannot succeed: the strip's
	 * "needs recalculating" clause must subtract them and point them at diagnostics instead.
	 */
	unreadableReferents: number;
	/**
	 * Rows whose asset or zone was DELETED — `missingTarget` on the row, a subset of `stale`,
	 * and the OTHER thing a recalculation cannot fix.
	 *
	 * It exists because introducing `recalculable` removed the only qualifier these rows had.
	 * Taking them out of "needs recalculating" was right — the command refuses them — but the
	 * strip then said nothing about them at all while their persisted cost stayed in the total.
	 * **Removing a false claim is not the same as reporting the truth**, and the silence was the
	 * worse of the two, because a wrong instruction is at least visible.
	 *
	 * Counted apart from `unreadableReferents` because the two say different things to a user: a
	 * note that could not be READ points at diagnostics, a target that is GONE points at
	 * reassigning or deleting the requirement. That distinction is the same one
	 * `RequirementInspectorDTO` already draws between `isErr` and `ok(null)`.
	 */
	missingTargets: number;
	/** `ListPlansByProject`'s own count, passed through. */
	unreadablePlans: number;
	/**
	 * Zone NOTES that refused, one per note — the zone listing's own `refused`, passed through
	 * exactly as `unreadablePlans` is. It used to mean "plans whose zone read refused", which
	 * counted a different thing on a different axis for as long as the walk started at plans.
	 */
	unreadableZones: number;
	/**
	 * Rows whose currency the total cannot take — an EXCLUSION, so these are the rows that
	 * really are out of `total`, whatever else they are also counted in.
	 */
	unsummable: number;
	/** Requirement notes that could not be read at all. One bad note costs one note. */
	unreadableRequirements: number;
}
```

**These counts are independent, not a partition**, and the qualifier says so rather than
implying arithmetic that does not hold: a row may be both `stale` and `unsummable`, and
`stale + unsummable` is therefore not a count of anything. Each answers its own question.

## Decision 3 — sum everything, qualify the total

**Staleness does not exclude a row.** A stale row is counted beside the total and contributes to
it *unless an exclusion applies* — the exclusions being `unsummable` and nothing else, per the
rule stated once above `ProjectSummary`'s counts. The alternatives were weighed:

- *Sum only current figures* — the headline number understates the project, and any geometry
  edit makes figures stale, so it would understate it most of the time.
- *Refuse a total while anything is stale* — blank in the common case, for the same reason.

So the figure stays useful and never silently claims more than it knows. The qualifier is a
**sentence and not a badge alone** — "3 figures need recalculating" — per SDD §85's rule that
status never rests on colour.

**A row counted in `unreadableReferents` is not offered that sentence**, because recalculating
it fails for the same reason its referent read did. It gets its own clause pointing at the
diagnostics door instead — an instruction that cannot be followed is worse than no instruction,
which is the same rule the empty state is held to two decisions down.

### Why `unsummable` exists rather than being assumed away

`add` refuses `money.currency-mismatch`, and the currency invariant does **not** reach every
writer: `SetRequirementCostOverrideCommand` writes `estimatedCost.override` from a
caller-supplied `Money` with no currency comparison, which `CLAUDE.md` already records as an
open residue, reproducible through `RequirementRow.vue`'s cost override. A foreign-currency
override is therefore reachable **in memory** — and that is where this rationale stopped, which
was not far enough.

**The persistence layer ERASES that mismatch, so the state this paragraph rested on never
reaches the summary.** Verified at the mapper: `requirementToPersistence` takes
`const currency = requirement.calculatedFrom.unitCost.currency` — ONE currency for the whole
note — and `moneyOrNull` writes the override's AMOUNT alone; on the way back, `derivedMoney`
rebuilds `calculated` and `override` from that single `dto.currency`. A foreign-currency override
round-trips as a same-currency one. **An in-memory test of this case would have passed while
production could not produce it**, which is the shape of a test agreeing with its own fixture.

**`unsummable` survives, on a different and better-grounded mechanism**: the row's own currency
against the PROJECT's. A requirement note carries one `currency` key, and nothing keeps it equal
to the project's — three ways it parts, all of which survive a round trip because they are what
is written:

- A project's `currency` is hand-edited, or its note has no `currency:` key at all and the
  plugin's `defaultCurrency` setting changes, which `CLAUDE.md` records as re-denominating every
  legacy project. The requirement notes keep the currency they were written with, and a
  recalculation cannot quietly reconcile them — `computeEstimatedCost` refuses a mismatch with
  `cost.currency-mismatch`, so the divergence PERSISTS rather than being repaired on next read.
- A requirement note's own `currency:` is hand-edited.

So a summing query still meets rows it cannot add, and still must count them out rather than
throw or silently mis-denominate.

**This rationale has now been wrong TWICE, and the second time is the one worth recording.** The
first version named a foreign-currency cost OVERRIDE, which the mapper re-denominates. The
correction named an `AssetPriceOverride` in another currency — and that is refused at
`SetAssetPriceOverride.ts:144`, *"A price override must be in the project's currency"*, with the
out-of-band route closed too because the pipeline refuses a unit price differing from
`expectedCurrency`. **I replaced one unreachable path with another.**

The error both times was the same and is not about currency: **I read one door's ABSENCE of a
guard as the absence of all guards.** `AssetPriceOverride`'s constructor genuinely does not check
the project's currency, and `CLAUDE.md` records that sentence — but a constructor is not the write
path, and the COMMAND that calls it does check. *Reachability is a property of the write path, not
of the type*, and the only way to establish it is to read every guard between the input and the
bytes on disk.

**A paragraph here used to claim the `main` merge had added a SECOND reachable door, and it was
the source of the mistake corrected above.** It read the entity's constructor — *"The project's
currency is deliberately NOT checked here"* — as meaning a project's price for a shared asset
could be denominated in anything, and concluded that `unsummable` was *more* necessary than the
section argued.

It is struck rather than deleted, because it was quoted approvingly for two rounds and the next
reader deserves to meet the refutation rather than a gap. Both ends are guarded:
`SetAssetPriceOverride.ts:144` refuses a price whose currency differs from the project's, and an
out-of-band note cannot get into a persisted figure either — `deriveRequirementFigures` passes
`expectedCurrency` to `computeEstimatedCost` and returns its refusal, so the derivation fails
before anything is saved.

**Three rounds, three statements of one wrong claim, and each correction landed on the passage I
was reading.** The claim outlived two of its own retractions because it was phrased differently
every time — "a foreign-currency override", "an `AssetPriceOverride` in another currency", "a
SECOND reachable door" — so no grep for the previous wording could reach the next one. The
remedy that would have worked is not a better search: it is that **a reachability claim names
the guards it passed**, which is checkable, where "the constructor does not check" is not.

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

**That residue has a SECOND face this design creates, and it is recorded here rather than
fixed.** `registerOnZoneGeometryChanged` calls `listByZone`, and on a refusal it logs, calls
`notify.cascadeAborted` and RETURNS — verified at the source, not inferred:

```ts
const listed = await deps.requirements.listByZone(zoneId);
if (isErr(listed)) { …; deps.notify?.cascadeAborted(zoneId); return; }
```

So no requirement event is published. For a project watching its own zones that costs nothing
extra — its `ZoneGeometryChanged` subscription already fired. For the CROSS-PROJECT case it is
the whole notice: a requirement in project A whose origin zone lives in project B is normally
rescued by the requirement-level event, and on this path there is none, so A's Overview keeps its
stale count while the geometry underneath it has moved. Reported by review after the delete-path
publications closed the sibling case; the abort path is not covered by them.

**Not silent to the USER** — `cascadeAborted` raises a warning notice — and not fixable inside
this increment either: the remedy is to make geometry invalidation reach dependent projects when
enumeration fails, which is a change to the cascade's own contract and inherits the same question
the strict `listByZone` residue above defers. Written down at the residue it belongs to, so the
next reader meets both faces at once rather than rediscovering the second.

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

The project-level builder tolerates a failed referent read and produces a row rather than
propagating.

**This paragraph said "counts it" and "excluded and counted" in consecutive sentences, and those
are opposite instructions.** An implementer had three ways to read it and all three are wrong:
propagate and fault Overview, map the failure onto `missingTarget` and report a deletion that did
not happen, or drop a requirement whose own note read perfectly well. The contradiction was
mine and is resolved here rather than narrowed.

**The row is IN, and the existing DTO already says what it is.** A failed referent read is not a
failed requirement read: the requirement's own note loaded, so its persisted `estimatedCost` is
readable and honest, and excluding it would understate the project for a reason no surface
shows. What cannot be determined is whether that figure is still *right*, because staleness is a
comparison against the asset's current price and the zone's current area.

`recalculationStatus` is already the field that carries exactly that, and its own docblock states
the rule: *"never 'current' for a figure this query cannot re-derive"*. `isStaleReading` already
reads `stale` for a `null` endpoint on that ground. An unreadable endpoint is the same
inability with a different cause, so it takes the same reading. **No new staleness state**, which
is the finding's suggestion inverted: the shape it asked for exists, one field over from the one
it was looking at.

**`missingTarget` stays `null`, and that is the half the finding got exactly right.** `ok(null)`
is a deletion — a fact the user can act on. `isErr` is a note that could not be read, which is
not a claim that anything was deleted. Collapsing them would invent a deletion.

**What the row DOES need is one bit, because "stale" is about to give a false instruction.** The
strip says *"3 figures need recalculating"*, and recalculating a row whose asset note is
malformed will fail for the same reason the read did — an actionable sentence that cannot be
acted on, which is the live-control-that-does-nothing rule arriving as copy. So
`RequirementInspectorDTO` gains `referentsUnreadable: boolean` and `ProjectSummary` gains
`unreadableReferents`, counted beside `stale` rather than carved out of it. WHICH note failed is
not on the DTO: the diagnostics ledger already records it and the Decision 8 door already leads
there, so a second copy here would be a second answer to one question.

`unreadableRequirements` therefore counts requirement notes alone — the rows that do not exist.
It said "the row and its referents", which is what made one count answer two questions and let
the contradiction above hide inside it.

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

**Three walks, not one, and the counts say which is which.** `planCount`, `zoneCount` and
`requirementCount` each come from their own project-scoped listing. They are different
questions, and an entity that outlived its parent is precisely where any two of them disagree:
a requirement whose zone was deleted, a zone whose plan note was deleted. Reaching either
through its parent answers zero for something the project still owns, which is the blindness
this section closes — twice, one entity at a time, because fixing it for requirements alone
left the identical hole one row up in the same diagram.

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
  **A withheld count is an em dash, never a dimmed zero**: `zoneCount: null` means the room
  read refused, and drawing the same glyph as an empty project would state a fact the query
  explicitly declined to state. The warning strip carries the reason beside it.
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

So Overview takes a change source of its own, `createProjectSummaryChangeSource`, and the
remount decision is what makes that affordable: only the mounted section subscribes, so the
wider question is asked only while the surface that needs it is on screen.

**This said "a fourth" until the branch was rebuilt on a `main` 90 commits ahead of the tree it
was written against.** That merge landed slice 20's second half — the per-project price
override — and with it `projectPricesChangeSource` and `requirementFiguresChangeSource`, so the
count was wrong by two and would have gone wrong again at the next source. It is not numbered
now. The two new siblings are *neighbours* rather than substitutes: one asks "did this project's
prices move", the other "did one requirement's figures move", and neither answers "did anything
this project's total is built from move".

### The three lists, and why it is three rather than one

**Filterable by project** — every one of these carries `projectId` in its payload, verified in
`Zone.events.ts` and `Requirement.events.ts`:

`PlanCreated`, `ZoneCreated`, `ZoneDeleted`, `ZoneGeometryChanged`, `RequirementCreated`,
`RequirementRecalculated`, **`RequirementDeleted`**, **`AssetPriceOverrideChanged`**.

**`AssetPriceOverrideChanged` arrived with the `main` merge, and its absence was a real gap
rather than a stale sentence.** Slice 20's second half makes a project's own price for a shared
asset an INPUT to the derivation — `resolveEffectiveUnitCost` is
`priceOverride(project, asset)?.unitCost ?? asset.unitCost` — so setting, replacing or clearing
one changes what `estimatedCost.calculated` means for every requirement in that project on that
asset, and therefore changes this total. `AssetPriceOverrideEventPayload` is
`{ projectId, assetId }`, so it filters by project exactly as its siblings do, and its own
docblock says the pair is deliberate: an asset-only payload would make the narrowing
inexpressible. Nothing in the list needed rewriting to admit it, which is the argument for the
list having been made canonical two rounds earlier.

`RequirementDeleted` is the event this increment mints below, and it was missing from this list
for one round — **specified as published and never subscribed to**, which is the shape of
mistake that makes a whole feature a no-op while every part of it reads correct in isolation.
It carries the same `RequirementEventPayload` its siblings do, so it filters by project.

`ZoneGeometryChanged` is in that list for the reason the whole product exists: an area is an
input to a cost, so a moved vertex changes the total and marks figures stale.

**Not filterable, and this is the finding under the finding.** Five carry no owning project at
all. **This list is the authority; two of its members reached it late and by correction, and the
reason is recorded below it.**

- `RequirementInvalidated` carries `{ requirementId }` and no project. **This bullet said
  "its factory takes a bare `requirementId` — there is no payload object to filter on", which
  is two claims of which only the first is true.** The FACTORY takes a bare id; the EVENT has a
  payload object, and `main`'s own `requirementFiguresChangeSource` filters on precisely that
  field. What is actually absent is a *project*, which is what this list is about — so the
  membership was right and the reason given for it was false. Read the correction as the
  general one: a claim about an event's shape is a claim about the type, never about the
  arity of the helper that builds it.
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
`ProjectIndexEntryChanged` filtered to the plan, zone, requirement, project, asset **and
asset-price** entity types.

**`renovation-asset-price` was the half of the price override I left open in the commit that
closed the other half.** Adding `AssetPriceOverrideChanged` to the event list above covers a
price set, replaced or cleared THROUGH THE APP; a price note edited, added or deleted by hand or
arriving through sync publishes no domain event at all, only `ProjectIndexEntryChanged` with
`entityType === 'renovation-asset-price'` (`assetPriceFrontmatter.ts`'s `ASSET_PRICE_TYPE`, and
the value `projectPricesChangeSource` already filters on). The row builder resolves these
overrides when deciding staleness, so without this entry an already-mounted Overview keeps its
previous stale count and its total's qualification indefinitely.

Read it as the shape rather than the omission: **the in-app path and the out-of-band path are
two lists, and an entity added to one is not added to the other.** Every type in this list is
here because the same question was asked of it separately — which is why `asset` and `project`
below each needed their own paragraph, and why this one did too.

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

**And then the sweep's own FILTER turned out to be a sample.** It selects files matching
`UndoableCommand|Reversible`, which answers *"every reversible adapter"* — a narrower question
than *"every write path that publishes nothing"*, which is the defect. Asked the wider way
(`writes > 0 && publishes == 0` across `src/application`) it returns **thirteen** files, not five.
Some are helpers whose caller publishes — `WriteLedger`, `ReferenceLocks`, and `restore-zone.ts`,
whose two callers are adapters already in the table. Three are not, and each was verified rather
than inferred:

- **`reference/deleteResolution.ts`** — four writes, no `publish` anywhere in the file, reached
  from BOTH the zone delete and the asset delete. Reported by review in its cross-project form: a
  requirement in project A whose `origin.zoneId` sits in project B — the mirror case Decision 3
  accepts as an honest residue — is marked stale here, and the only event that follows is
  `ZoneDeleted` carrying B. A's Overview keeps its old total and stale count.
- **`commands/requirement/DeleteRequirement.ts`** — one write, no publish, no publishing caller,
  and no `EventBus` imported at all. So a deletion through the exposed command leaves an open
  Overview stale. `RequirementDeleted` — the event this increment mints — must be published
  HERE as well as from the reversible assign undo path, and the Files list says so; specifying
  the event and wiring it to one of its two producers is how a mint ends up subscribed to and
  never raised on the path a user actually takes.

**A THIRD file was named here and the claim was wrong.** `SetRequirementCostOverride.ts` was
listed as silent, on the strength of `grep -c "publish("` returning zero for it — and it calls
`publishIfEffectiveCostChanged` at line 100, imported from `SetRequirementQuantityOverride.ts`,
which publishes `costEstimateChanged`. The cost override does announce; the sweep attributed the
announcement to the file the HELPER lives in.

**That is the third layer of one defect, and it is the instructive one.** The sweep began as a
sample of adapters; the census fixed the sample and left its FILTER a sample; correcting the
filter left the METRIC counting literal `publish(` syntax rather than behaviour. Each correction
was real and each was measured with an instrument that could not see the next layer. A count of
a SPELLING is not a count of an EFFECT, and an indirect call through a shared helper is exactly
what a per-file grep cannot see. The two files above were re-checked against that objection —
neither imports an `EventBus` or any publishing helper — before this paragraph was rewritten.

**The remedy for the cross-project case is the requirement-level event, not unfiltered zone
events.** A requirement event carries the requirement's own `projectId` — A, the project that
must refresh — while unfiltering `ZoneCreated` / `ZoneDeleted` / `ZoneGeometryChanged` would make
every project's summary re-read on any zone edit in the vault. That is the cost the filter exists
to avoid, paid to serve a state only a hand edit produces. It is also what this decision already
does for `DeleteAsset`'s resolution paths, so it is consistency rather than new design.

**The shape, which is this document's own recurring one:** a count is only as complete as the
question it counts over. Replacing a sample with a census fixed the sampling of ADAPTERS and left
the sampling of the FILTER, and the second was invisible precisely because the first had been
announced as a sweep.

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

**`ReversibleSetPlanBackground` is out of this increment's scope and is recorded anyway** — and
it is therefore the sweep test's one NAMED carve-out, asserted by exact key set the way this
repository's other carve-out tables are. An unqualified *every writer publishes* would fail
against a module the increment deliberately leaves alone, so the test contract and the declared
scope could not both hold; naming it keeps the sweep honest in both directions, since a carve-out
for a path that has since been fixed reads as a live exception until something compares the list
to the tree. A
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

Forwarded straight to `hydrate`, that is 3R+1 full project-summary walks.

**This paragraph multiplied that by a per-walk cost the design no longer has, and the stale
figure was mine.** It read *"each walk already costs `zones × all-requirements` reads … 25 walks
of 5,500 reads"* — the cost of the PER-ZONE delegation this document rejected two decisions
earlier, and the project-scoped walk replaced it with three listings each linear in the project:
its plans, its zones, its own requirements. A walk over 2 plans, 11 rooms and 24 requirements is
tens of reads, not thousands, and it does not grow with the vault at all.

So the argument for coalescing rests on the **walk count** and not on a product. Moving one
vertex in a room with 8 requirements issues up to 25 walks where one would do — 25× the reads,
25 sets of overlapping hydrations racing each other, and a store written 25 times for one edit.
That is worth removing on its own; inflating it with a retired figure only made it easier to
disbelieve.

So `createProjectSummaryChangeSource` **coalesces**: every event in a burst schedules one
trailing refresh rather than its own. The listener is called once when the burst settles, which
is the only shape that stays correct as the cascade's event count changes, since a fix counting
today's three would go stale the next time a command learns to announce something.

**The disposer cancels the pending timer, and that is a REQUIREMENT rather than an
implementation detail.** Disposing the subscriptions stops new events arriving and does nothing
about a refresh already scheduled — so leaving Overview inside the debounce window fired a full
project-summary walk after the section had unmounted, and wrote its result into an abandoned
store. Every cost this section argues about is a cost the unmounted section was still paying,
which contradicts the premise the remount decision rests on: *only the mounted section
subscribes.* A trailing coalescer without a cancelling disposer makes that sentence false for
one debounce interval on every navigation away.

The store write is the harmless half — nothing renders it. The WALK is not: it is the
three project-scoped listings this section exists to bound, run for a surface nobody is
looking at, and a user navigating quickly between sections queues one per departure.

A case covers unmount-before-settle, and it asserts on **reads** rather than on the listener:
a disposer that unsubscribed the listener while leaving the timer to run would satisfy a
callback-count assertion and still do the walk.

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
state when the project has no plans, **no rooms and no requirements**, whose action navigates to Design
rather than opening the form in place — the header and nav stay mounted around every section,
which is slice 14's rule arriving on a fourth surface: an empty state that replaces a region
hides the thing the region exists to show, and here that thing is the way back.

**The second half of that condition is a correction, and it is Decision 3's own consequence
catching up with this rule.** Gating on plans alone was right while the walk reached
requirements through a plan's zones — no plans meant no figures, so an empty state hid nothing.
The project-scoped walks recover a project's persisted rooms and requirements whether or not a
plan note survives, so a project whose only plan note was deleted out of band still has counts
and possibly a total worth showing, and gating on plans would replace them with an invitation to
create a plan. That is the same failure the rule is quoted against, one layer up: an empty state
hiding the thing the region exists to show.

**Rooms joined that condition a round after requirements did**, and the delay is the argument
for how the sentence below is written: the correction was made for one entity while the entity
beside it, in the same walk diagram, kept the parent-started read that produced the same wrong
onboarding screen from a project holding rooms and no requirements.

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
2. **A partial read** — some plans unreadable, some zone reads refused, **some requirement
   notes unreadable**. The section still draws, with `.rp-view-notice`'s additive strip naming
   the count. The plan list already does this for `unreadablePlans`; Overview joins it rather
   than inventing a second treatment.

   **`unreadableRequirements` belongs in that strip and was missing from it**, which is the
   worst of the three to omit. An unreadable PLAN or ZONE costs a visible count — the room
   figure is withheld or the plan count drops, and a reader can see something is wrong. An
   unreadable REQUIREMENT is excluded from `requirementCount`, from `summed` and from the
   total, and every remaining figure is internally consistent: **the estimate is simply
   smaller, and nothing on the surface says so.** A silently understated total is precisely
   the failure Decision 3 exists to refuse — *"the figure stays useful and never silently
   claims more than it knows"* — and it had no less right to say what it knows about a figure
   that is too LOW.

   This is the same shape as the missing-target badge two rounds ago: **counting a thing is not
   the same as showing it**, and a count that reaches no surface is indistinguishable from one
   nobody computed.
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
| Summary | one stale row with NO exclusion is counted AND contributes to the total | summing only current rows understates it; dropping the count hides it |
| Summary | a row whose own `currency` differs from the project's lands in `unsummable` and the total survives | assuming one currency throws on a reachable input — and the fixture must be a hand-edited project or requirement currency, since an OVERRIDE in another currency is re-denominated on save and an `AssetPriceOverride` is refused by its own command |
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
| Summary | a row whose ASSET note cannot be read contributes to the total WHEN NO EXCLUSION APPLIES, reads `stale`, and carries `missingTarget: null` | excluding it understates the project invisibly; `missingTarget: 'asset'` reports a deletion that did not happen; and an unqualified "IS in the total" contradicts the intersection row below it, which is the same flat claim this document has now had to retire in six places |
| Summary | the same row is counted in `unreadableReferents` and the strip does not offer it as recalculable | "needs recalculating" is an instruction that cannot be followed for this row |
| Summary | a row that is both stale and currency-mismatched is counted in BOTH and summed into NEITHER | the flat reading of `stale` attempts the mismatched addition |
| Summary | the mismatch fixture is a hand-edited project or requirement `currency`, written through the vault | a foreign-currency cost OVERRIDE is re-denominated by `requirementToPersistence`, and a foreign `AssetPriceOverride` is refused by its own command — both fixtures test states production cannot reach |
| Summary | a row that is both unreadable-referent and currency-mismatched is counted in BOTH and summed into NEITHER | the same flat reading, re-derived one count over — the exclusions decide membership, never the state counts |
| Summary | a malformed requirement in ANOTHER project is invisible here | an unscoped walk both faults on it and miscounts it |
| Commands | `DeleteZoneCommand` still refuses when a referent cannot be read | widening the shared `listByZone` lets it delete a zone whose referent it never saw |
| Summary | one summary read issues one project-scoped requirement listing | per-zone delegation is `zones × all-requirements`, which coalescing shrinks in count and not in size |
| Invalidation | an asset price edited out of band refreshes the stale count | no `AssetUpdated` cascade runs for a hand edit; the index entry is the only notice |
| Invalidation | `RequirementDeleted` refreshes the summary | it was specified as published and not subscribed to for a round — published-and-unheard passes every publishing test |
| Summary | `summed` is the query's own count rather than the component's arithmetic | deriving it double-subtracts a row caught by two exclusion categories, and the counts are independent by design |
| Accessibility | only the SELECTED tab carries `aria-controls`, and the id it names exists | one panel exists at a time, so an inactive tab's `aria-controls` is a dangling IDREF |
| Keyboard | after a section change through view state, focus is on the newly selected tab | the mock's local `ref` hides this; only the real round trip unmounts the element |
| Overview | a project whose only plan note is unreadable draws the notice, never the empty state | zero visible counts otherwise select onboarding, and following it creates a second plan |
| Overview | one unreadable REQUIREMENT note draws the strip, and the total is smaller than the same vault without it | every other figure stays internally consistent, so an omitted row is invisible without the strip — a silently understated estimate, which is the one thing Decision 3 refuses |
| Overview | a project with no plans but surviving requirements shows the summary, not the empty state | gating on plans alone hides figures the project-scoped walk recovered |
| Overview | a project with no plans and no requirements but surviving zones shows the summary, not the empty state | the same rule for the entity whose walk was corrected a round later |
| Overview | a withheld room count draws an em dash and the strip, never a dimmed zero | `?? 0` at the render site reads identically and states what the query refused to |
| Overview | a project with a start or target date renders it; a project with neither renders no line at all | the DTO carried neither field, so the promise was undeliverable rather than merely unbuilt |
| Wiring | the warning strip's action reaches `openDiagnosticsReport` | without the deps member it is a live control that does nothing — the shape slice 14 refuses |
| Keyboard | a restored leaf and a `rebind` do NOT move focus | an unconditional focus-on-mount steals it during layout restoration |
| Invalidation | a manual index rebuild refreshes an already-mounted Overview | `ProjectIndexRebuilt` carries no payload, so nothing per-entry fires |
| Coalescing | a cascade whose writes settle within the debounce causes ONE summary read | forwarding each event directly issues up to 3R+1 walks; asserted on reads, since a notification count passes either way |
| Coalescing | a cascade whose writes OUTLAST the debounce causes at most one read per settled burst, never one per event | asserting ONE here fails a correct trailing coalescer on a slow repository — the prose declines a completion boundary, so the test may not demand one |
| Coalescing | a slower earlier read cannot overwrite a later one | without the request ticket a just-recalculated figure reverts |
| Coalescing | disposing inside the debounce window performs NO summary read | unsubscribing does not cancel a scheduled callback, so an unmounted section keeps paying the walk this section exists to bound; asserted on reads, since a listener-count assertion passes against a live timer |
| Sweep | every module under `src/application` that WRITES also publishes, is a helper whose caller does, or is a NAMED carve-out | five of eleven publish nothing today; the adapter-only filter is itself a sample — asked the wider way it returns thirteen, three of them genuine |
| Sweep | the carve-out list is asserted by EXACT key set, and today holds exactly `ReversibleSetPlanBackground` with its reason | an unqualified "every writer publishes" fails against a module this increment deliberately does not change, so the test contract and the declared scope could not both be satisfied; and a carve-out for a path that no longer exists goes on reading as a live exception |
| Summary | a requirement in project A whose origin zone lives in project B refreshes A when that zone is deleted | zone events carry B, so a project-filtered subscription drops them while A's row derives its area from that zone |
| Summary | the same requirement does NOT refresh A when the geometry cascade aborts on a malformed sibling, and the warning notice fires instead | pinned as the behaviour this increment leaves standing, so a build that closes it fails here and its author reads the residue |
| Summary | a requirement deleted through `DeleteRequirementCommand` refreshes an open Overview | that command imports no `EventBus`, so `RequirementDeleted` would be minted, subscribed to, and never raised on the path a user takes |
| Invalidation | deleting an asset with `remove-references` refreshes the total; with `delete-anyway` it refreshes the stale count | `AssetDeleted` alone reports the wrong subject and cannot be filtered by project |
| Summary | a requirement whose `projectId` names another project is never reached | a zone-started walk reaches it and, on one shared currency, sums it into the wrong project silently |
| Summary | a requirement whose zone was deleted IS reached and reports `missingTarget: 'zone'` | a zone-started walk cannot produce that row at all |
| Summary | a project whose only plan note is deleted WITHHOLDS its room count and reports a refusal — it does not read zero | a plan-started zone walk reads zero with nothing refused, and the empty state then offers onboarding over a project holding rooms; the refusal is what stops that, and counting the zones is what the sidecar dependency below prevents |
| Summary | one unreadable zone NOTE costs one count, not the walk | a strict listing would blank the room count for a single bad note |
| Summary | an unreadable geometry sidecar withholds `zoneCount` and leaves the plan and requirement figures printed | `ObsidianZoneRepository.list` propagates a shared failure, so an uncaught one faults the whole summary |
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

**Unchanged and worth naming:** `ZoneRepository.listByProject` and its two implementations.
The room count needs a project-scoped zone listing and the port already has one, already
skip-and-count — so this is a call site rather than an addition, which is why it appears in no
list above.

**Changed:** `ProjectSummaryDto` gains `start` and `targetCompletion` (Decision 8);
`RenovationProjectDeps` gains `openDiagnostics` and the composition root binds it (Decision 8);
the five reversible adapters that write and publish nothing —
`reversible-create-zone-command.ts`, `reversible-delete-zone-command.ts`,
`reversible-assign-asset-command.ts`, `reversible-override-commands.ts` — plus `DeleteAsset.ts`,
`reference/deleteResolution.ts` and **`commands/requirement/DeleteRequirement.ts`**, the last of
which needs an `EventBus` it does not currently take (Decision 7); `GetRequirementsForZone.ts` (`projectId` and `referentsUnreadable` on the DTO, and
its per-row builder extracted for sharing); `RenovationProjectView.ts` (parse, `sync`, `setState`);
`RenovationProjectContext.ts` (`navigate` gains a section, plus the two focus-handoff members
over a private field on `RenovationProjectView`), and with it
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

`viewStateFrom`'s fallback arm, every `unsummable` / `unreadableZones` arm and both arms of
`zoneCount`'s withheld reading are new branches, and `GetProjectSummary` is several new
functions. Each needs a case in the commit that writes
it, the functions especially.
