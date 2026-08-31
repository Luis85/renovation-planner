# Renovation Planner — agent guide

An Obsidian plugin for planning a renovation: plans and zones, assets and quantities, costs,
trades, work packages and a schedule. The target architecture is
[`docs/development/sdds/obsidian-renovation-planner-SDD.md`](./docs/development/sdds/obsidian-renovation-planner-SDD.md)
and the product intent is in `docs/product/prds/`. **Read the SDD before proposing structure**: it
has already refused things that look obvious from the code alone, and where this guide and
the SDD disagree, the SDD is the authority and this file is the bug.

Today the build, the gates, the browser harness and the release pipeline work; the
settings pane offers the three settings there are (units, the default projects folder — where a
NEW project's folder is created, since slice 18; an EXISTING project's folder derives from
where its `Project.md` sits instead (ADR-0013) — and slice 11's verbose logging — counted in
`getSettingDefinitions`, and this sentence said "the one setting there is" for several slices
after it stopped being one); and the persistence layer of design slice 4 is in place — Obsidian
repositories, the geometry sidecar store, the project index and its vault-change pipeline
(bounded since slice 18 by what a note DECLARES, not by where it sits, which closes slice 4's
own recorded multi-root prerequisite without registering a single root), and the migration
runner.

**Every entity and mechanism the MVP architecture needs now exists**, which is what slice
10 closing means: `Project`, `Plan`, `Zone`, `Asset` and `Requirement`, the quantity and
cost engine behind them, the reference-integrity engine that guards deleting either end of
a link, and the recalculation cascade that keeps a figure honest when its inputs move.
Everything past this point is feature work on a proven template. Slice 11 closed
the first half of the cross-cutting pair — the Error Boundary, the logging policy,
diagnostics and the data-safety rules — and **slice 12, its second half, has since closed
too**: `docs/requirements/Errors, diagnostics and the test harness.md` opens
"Slices 11 and 12: the two cross-cutting slices", so those two are the pair and nothing else
can be a half of it. An earlier draft of this passage gave that half to slice 13 in the same
breath as it listed slice 12 as outstanding — a sentence contradicting itself two clauses
later. Slice 13 belongs to *Shared UI vocabulary* (slices 13–17), and what it closed there is
the toast and the save-state badge — the notice queue and
the save-state indicator, the surface any view or command reports a transient message or a
save state through. **That group is now complete: 14 and 15 landed first, then 16, and slice
17 — the integration slice the map calls "17 integrates them" — has closed it.** What is NOT
done is slices 19, 20 and 21, which are written and unbuilt, plus the items slices 16 and 17
WITHDREW rather than ticked; each is recorded in its own task document's amendments rather
than here, because a list of exceptions kept in two places is one that disagrees with
itself.

There are **two workspace surfaces**, both mounting their own isolated Vue app (SDD §12) —
nothing outside a view knows it is Vue. The **Renovation project** view is a singleton with
a ribbon button and a command, and it now draws **a project list** — design slice 16's
`ProjectList.vue`, not slice 17's: that document is the error-surfacing decision table and
never once mentions one, so the list was owned by no slice until slice 16 claimed it. This
paragraph said "still no project list" for slices 14 and 15, which was true until slice 16
landed. `ViewRoot.vue` renders `ProjectList` whenever the empty state does not apply, and slice 14's
`renovationProject.noProjects` in its place when it does — the two never draw together, gated
on the same `'ready'` status the rest of this paragraph describes. **"Whenever the empty state
does not apply" is not "once the vault holds at least one project", and this sentence said the
second for a review round:** `selectRenovationProjectEmptyState` answers `null` on
`unreadable > 0` BEFORE it ever looks at the length, so a vault whose only projects are ones
this build cannot read draws an empty LIST — its header, its Create button and no rows —
beside the refusal notice, which is the right picture and not the one the sentence promised.
The list is the `v-else`, so it is what draws in every case the selector declines, present and
future; the mapped failure sentence for the refusing `AppError`'s own code
(`.rp-view-message`, via `trError`, so unrecovered settings and a vault fault say different
things); a loading line in that same region while the read is in flight; and
`.rp-view-notice`, the one ADDITIVE one, when SOME project notes refused
(`view.project.some-unreadable`). Slice 15's `DialogHost` mounts here too and is invisible
until something opens a dialog — slice 16's `NewProjectForm` is its first caller in this
view, opened from the empty state's action button and from `ProjectList`'s own header.
`ListProjects()` resolves to a `ProjectListResult` —
`{ projects, unreadable }`, not a bare array; the PORT below it answers a `ProjectListing`,
`{ loaded, refused }`, and the rename across that seam is deliberate — and the empty state is the `'ready'` status
with BOTH halves clear: an empty list with `unreadable > 0` is a vault that has projects this
build could not read, so it gets the notice and no "no projects yet".

**Design slice 21 gave that view a SECOND state, and everything above describes the first
one.** A project row NAVIGATES now rather than opening `Project.md`, into a detail state that
draws one project — its name, its lifecycle status, an **Open note** action (the only surface
left that opens the raw note), a **‹ back**, and that project's plans with a `New plan` form
dispatching the real `CreatePlanCommand`. Which project is open lives in **Obsidian's own view
state** (`getState`/`setState`), never in Pinia: `rebind` remounts the whole Vue tree on a
settings save, and a Pinia-held selection would throw the user out of the project they are in.
`ViewRoot` reads `context.projectId` ONCE — `null` is the list, a string hands the whole state
to `ProjectDetailState.vue`, which owns its store, its two subscriptions and its own dialog —
and the view REMOUNTS per navigation (`sync`), which is what makes that value unable to go
stale rather than a `Ref` somebody has to keep fresh. Navigation goes through
`leaf.setViewState` and sets `ViewStateResult.history`, so **the pane's own back and forward
arrows walk it** — the in-app ‹ back is a different mechanism from that arrow (it SETS a state
where the arrow asks Obsidian to RESTORE one) and both carry the same `''`-means-the-list
sentinel `getState` writes. Whether Obsidian honours the arrow is checkable nowhere here —
`FakeLeaf` records asks rather than behaving — so it is walked in
`docs/tests/cases/Navigate into a project and back.md`. The **Plan editor** is per-plan (several
leaves coexist, keyed by a plan id in Obsidian's own view state): §60's five shell regions
around a Konva stage of §17's seven layers, the Zones of one Plan, an image or PDF
background, and a pan/zoom camera — slice 5. **That canvas is editable now**, which is the
next section: slice 6 built the tool framework underneath it (`EditorTool` and its switching
lifecycle, `CommandHistory` undo/redo, the reversible move-zone command, transformer
normalization, the snap service, the selection store and the Inspector's
selection-to-DTO-to-command pipeline), slice 7 added the first concrete tool, slice 8 wired
the framework into the editor for real, and slice 15 made slice 7's tool reachable. This
paragraph said "nothing on that canvas is editable" for four slices after it stopped being
true, contradicting the sentence immediately below it. The one thing slice 5 writes is which
document a Plan's background IS.

**Design slice 11 has landed: no COMMAND or QUERY leaving the composition root can throw
past the Application layer — two carve-outs excepted, both named below — and that is checked
as a CATEGORY.** `guardCommand`/`guardQuery`
wrap each of them — most in `src/plugin/guardedServices.ts`, which is where the seam moved to
keep the root under its line budget, and five still applied inside `composition-root.ts`
itself (four `guardCommand` calls, plus `guardCalibratePlan` per call on the factory) —
so a fault below that seam is caught, mapped by the vault's `ExceptionMapper` to a coded
`PersistenceError`, logged with its original cause at that one step, and returned as a
resolved failed `Result` — and a RESOLVED failed `Result` is logged there too, so a refusal
and a fault each produce one log line at the boundary rather than one of them producing
none.
`toUserMessage(language, error)` is the only place an `AppError` becomes copy (`error.code`
→ suffix → category, from the locale tables), `GetDiagnosticsSnapshot` reports versions,
schema versions, migration state and this session's read refusals and nothing else, and the
schema-version gate refuses a note from a build this one predates rather than parsing it.
That diagnostics stay on the device is a LINT RULE over `infrastructure/logging/` and
`application/queries/` now — the node network modules, `obsidian`'s `request`/`requestUrl`
and the network globals — rather than a fact about today's imports.
The rules that came out of it, and out of the review rounds on that branch — every one of
which found at least one sentence promising more than its check delivers, this paragraph's
own first draft included:

- **A guard on the door nobody dispatches through is a guard nobody has.** `guardCommand`
  wraps `execute`; the Inspector's reversible adapters dispatch an override through
  `executeWithVersion`. The wrapper was present, the test was green, and the second door was
  raw — `guardBothDoors` wraps both now, each under its own event name so a log line says
  which entry point faulted.
- **A category check that compares a SELF-DECLARED list is the shape it was written to
  replace.** The first one rested on a runtime mark the guards stamped, and asked whether
  the doors a service exposes match the ones it says it guarded — two things the same object
  declares about itself. Mutating only the ROUTING left it green, which is the defect above,
  uncaught, one round later. `tests/plugin/guardCategory.test.ts` is
  behavioural now: compose a real root, DETONATE seven named collaborators beneath it (the
  five repositories, the geometry port and the file probe — a hand-written list, and the only
  one in that file that nothing PINS: the two carve-out tables and the skipped-owners list are
  each asserted by exact key set, so a drift in one of those three is named at the
  assertion, while a drift in this one is caught only indirectly, by the fail-closed
  property in the next bullet), walk everything the root and the editor bundle hand out, drive a
  hostile input through every door it FINDS, and require the mapped `vault.unexpected-failure`
  back. A raw command REJECTS, and no amount of declaring makes it resolve a refusal. What
  the walk does not find is written down in the file's own header — a service hiding inside a
  class instance, an object whose only door is called something other than `execute…`, and
  the ports — and the detonation list being seven names rather than a rule costs nothing only
  because the instrument fails closed (next bullet). Two carve-outs, by name, with reasons,
  asserted by exact key set AND proven to name paths the walk really finds — a carve-out for
  a path that no longer exists is a comment that goes on reading as a live exception.
- **An instrument that reaches nothing looks exactly like a clean tree**, so the walk is
  driven against fixtures first (a raw command in a nested bundle, a facade with one raw
  door, a factory, a cycle, a port), it fails CLOSED (a door answering success is a
  finding), and where it gives up is RECORDED rather than skipped. Its stand-in throwers
  preserve the real method's ARITY: the walk treats a zero-argument function as a factory
  and calls it, so a bare `() => { throw }` replacing a one-argument port method would have
  been mistaken for a factory that could not be constructed — a fake thinner than the real
  thing, mangling the instrument pointed at it.
- **The boundary stops at the repository PORTS, and both the spec and the code say so.**
  `PlanEditorCommandServices.zones` and the requirement/asset ports leave the root raw
  because the reversible adapters restore snapshots through them; guarding a port is a
  different mechanism (every method, not one `execute`). So `notifyFault` in
  `presentation/notices/notify.ts` stays — it maps a thrown cause into the same coded
  refusal a guarded service would have produced. `docs/tasks/11`'s Definition of Done item 1
  WITHDREW its wider first clause rather than being ticked over that hole. **A door outside
  the boundary still owes BOTH representations**, which is the last thing the branch's
  whole-tree pass found: `notifyFault` printed a mapped sentence and called no logger at
  all, so a fault from a raw port reached the user as a sentence and a developer as silence
  — and there, uniquely, the unmapped cause is the only detail that exists, because no guard
  ran below to have recorded it. It takes the leaf's `Logger` and an event
  name now and maps ONCE for both halves, which is what SDD §66's "must not drift into
  being produced from two independent code paths" actually asks for. When those ports are
  guarded, `notifyFault` and both `runtime.ts` doors are what should DISAPPEAR rather than
  sit beside a boundary that covers them.
- **"Contains no project content" is a claim about a SHAPE, so no fixture can demonstrate
  it** — a content-free ledger asserted to produce a content-free snapshot proves only that
  the query adds nothing. The check moved to the end that can hold it:
  `DiagnosticsLedger.record` takes a closed kind union, a branded `EntityId` and the whole
  `AppError`, off which it reads `error.code` alone. There is no free-text parameter left to
  spell a zone name into, and the proof is a COMPILE-TIME one
  (`tests/application/ports/diagnostics.test-d.ts`, in `tsconfig.json`'s `include` for that
  reason): five `@ts-expect-error` directives — a name, a path, a free-text third argument, a
  kind outside the union, and the old three-string call shape — where an unsatisfied
  directive is itself a build error. What a type still cannot stop is written down beside it: a code
  that IS content, and a branded id that was never VALIDATED — `buildProjectIndexEntries`
  asserts a note's raw frontmatter `id` into `EntityId` after checking only that it is
  non-empty.
- **A user-facing sentence in `AppError.message` is the rule inverted, and the good copy
  reached nobody.** The delete flow put an already-translated string into the field slice 11
  defines as developer English for a log line; `notifyError` never reads `message`, so the
  user got the Validation category sentence instead. And slice 10's ~20 codes had no locale
  entries at all, which does not degrade to silence — it degrades to the WRONG sentence: two
  refusals told the user "That entry no longer exists" about an entry whose continued
  existence was the entire reason for the refusal. Nine reachable codes have copy in both
  locales now, bound to their raise sites by a table in `toUserMessage.test.ts` that is
  copied from the RAISE SITES rather than from `en.ts`, because a table derived from the
  locale file would agree with a typo. `NOTICE_TEXT_BAN` puts the rule at the notice
  doors as this repository SPELLS them — bare `notify(...)`/`notifySuccess(...)`/
  `notifyWarning(...)` calls and `new Notice(...)`, matched on `callee.name`, so the same
  functions reached through an object (`o.notify(...)`) are invisible to it. It was TWO doors
  when slice 11 wrote this and is four since slice 13 added two severities — a door added
  without widening this rule is a door no gate can see; the long-form paragraph further down
  carries the rest of that list.
  Neither reaches the second locale's VOCABULARY: the German copy called
  an Asset "Material" where the German UI says "Objekt", found by reading, because nothing
  rendered `de.ts` in any gate. **Slice 14 then reintroduced the exact word, forty lines
  below the German comment recording the correction**, which is what finally bought that
  file a check — see the slice 14 section below for what the check does and does not reach.
- **A docblock naming "the one list this derives from" is worth checking against the second
  one.** `MIGRATION_SET` claimed to be the single source of `schemaVersions` while
  `MigrationRunner` spread a module-level `LATEST_VERSIONS` constant beside it, so a seventh
  entity registered in the table alone would have appeared nowhere in diagnostics with every
  test still green. `latestVersions` derives from the registered steps now, and
  `MIGRATION_SET` moved out of the composition root so the test stack imports the SAME table
  — `tests/helpers/vault.ts` had built its runner from its own four-kind copy while the
  plugin registered six, which is a fake migrating a whole suite against a different schema
  world than production, harmless only because every table is empty at version 1 and
  invisible either way. One table with two importers cannot drift; two tables had nothing to
  notice them drifting.
- **The fail-closed schema gate is a READ gate**, and the claim is narrowed to that where
  the code lives. No save path calls `migrateNote`, so a future-version note is protected
  from being overwritten only because every command loads before it saves and the load
  refuses — a property of the callers, plus `schema-version` being an owned key. Nothing
  bypasses that today; `errorPaths.test.ts`'s "is a READ gate" case pins the exposure as
  what is TRUE rather than leaving it as a claim in a comment.
- **`recoverInterruptedSequences` had no `try`/`catch` on any of its five awaited calls**,
  under a call-site comment asserting that it did. It runs fire-and-forget at load, so a
  vault read that faulted rather than refusing was an unhandled rejection reaching nobody —
  the exact defect `reportFault` exists to prevent, in the one entry point no guard wraps.
  The handling belongs to the FUNCTION, not to its call site: a second caller would have to
  remember a `.catch` that nothing checks.
**Design slice 14 has landed: both central views have an actionable empty state.**
`EmptyState.vue` is one reusable component — headline, body, an optional action button,
an icon slot nothing populates yet — driven by a typed registry (`EMPTY_STATE_CONTENT`)
holding `StringKey`s, never literal copy, and two pure selectors
(`selectRenovationProjectEmptyState`, `selectPlanEditorEmptyState`) that turn an
already-succeeded query result into which of three keys applies, if any.
`RenovationProjectView` gained its first real data dependency — a `ListProjects` query and
a `RenovationProjectStore` to hold the result — and renders `renovationProject.noProjects`
when it comes back empty and nothing refused; `ProjectStore` gained one getter, `emptyStateKey`, over state it
already hydrates. Rules that came out of it:

- **An empty state that replaces a region hides the thing the region exists to show.**
  `create-sample-project` seeds a plan with no background and five zones, and the browser
  harness refuses a background outright on SDD §55 grounds — both run on backgroundless
  plans, so a canvas replaced by an empty state would have made a seeded scene unreachable
  and left `?view=plan-editor` drawing nothing but guidance text. Both Plan Editor empty
  states are OVERLAYS inside `PlanCanvas`, which always mounts; an overlay yields to an
  active tool, because its own button is what activates one, and a user mid-gesture does
  not need to be told the canvas is empty.
- **A selector stays a function of query results; "is the user mid-task" is a rendering
  rule.** Folding `activeToolId` into `selectPlanEditorEmptyState` would have made "which
  state is this Plan in" unanswerable without a live `ToolManager` — a node test could no
  longer ask it — for a gate the component applies in one line
  (`overlay !== null && activeToolId === null`).
- **An absent `actionLabel` is a decision with a reason, not a gap — TWO of them when this
  slice shipped, ONE now.** `renovationProject.noProjects` had no button because its
  hand-off — a project-creation form — was slice 16's, and slice 16 `dependsOn` slice 11,
  neither of which existed yet. Design slice 16 has since built that form and given this
  entry its action; see that slice's own section below. `planEditor.noBackground` is the
  buttonless entry that remains, for a different reason:
  slice 5's background picker is the `set-plan-background` plugin COMMAND, which is not a
  member of `PlanEditorCommandServices`, and the editor's Vue tree cannot reach it without
  either widening `PlanEditorContext` (not this slice's surface to widen) or reaching for
  the global `app`, which the marketplace rules refuse. It renders no button rather than a
  live control that does nothing — the exact failure mode the amendment exists to avoid —
  and `content.test.ts` still asserts that one absence, so adding a button here is a
  deliberate, tested change rather than an oversight closing quietly. (The same file
  asserted `renovationProject.noProjects`'s absence too, until design slice 16 flipped that
  assertion the other way — see that slice's section below.) `planEditor.noZones` is the
  other entry that keeps a button, because its hand-off (`activeToolId = 'draw-polygon'`) already
  exists and is reachable from the editor's own state.
- **Promoting a mock is not always a byte-for-byte move, and the honest account says which
  file pair that criterion is actually held for.** `EmptyState.vue`'s template crossed from
  `src/prototypes/` unchanged except for one added line, `@click="$emit('action')"` — the
  mock was visual-only and wired no click at all, so the promoted contract's `action` event
  was unreachable until that line existed. `tests/build/prototype-promotion.test.ts`, the
  test that holds templates byte-identical across promotion, is scoped to exactly one file
  pair (`ZoneSummary.vue`) and does not cover this one, so nothing here caught the gap
  automatically — a mock whose button cannot be pressed is a worse mock regardless.
- **PRD §94 is one sentence and quotes nothing.** An earlier draft of this slice's own task
  document attributed a German worked example to it; the copy is ours to write, and `de.ts`
  translates it like every other key. A citation nobody checks is the same defect as an
  unchecked comment.
- **This slice's German body called an Asset "Materialien", forty lines below the German
  comment recording that slice 11 had replaced that very word with "Objekt".** Nothing
  rendered `de.ts` in any gate, so its only reader was a human who happened to look — and
  the first one who did found two more defects beside it: a garbled `Tresnornder` for
  `Tresorordner`, and `Das Tresor` at one key against `Der Tresor` at another — two keys
  naming the same noun, each giving it a different gender. The polishing pass over slices 11 and 14 fixed all
  three and gave the file its first check. **Read what that check reaches before trusting
  the word "checked" any wider**: `tests/presentation/i18n/strings.test.ts` pins TWO terms
  and nothing else — it refuses the value `Material` (the German UI says `Objekt`), and it
  requires `Vault` wherever `en.ts` says "vault", *Vault* being Obsidian's own name for the
  thing and therefore not translated at all. Spelling, grammar and every other term remain
  unread by any gate. The two rows are also not the same instrument, which is the part
  worth remembering: a forbidden-SYNONYM row can only refuse a wrong word somebody thought
  of, and it sails straight past `Tresnornder`, since that string does not contain
  `Tresor` — measured, not assumed. The row that closes the class asks from the ENGLISH
  side instead, and it is what reports all five sites.
- **The accessibility case for the project surface was an adoption placeholder until this
  slice, and closing that gap took more than adding markup.** It scanned an empty pane
  since slice 1; it grades a real headline and body now — but `mountHarness` is
  synchronous and `void`s `onOpen`, so the case's first version called `axe.run`
  immediately after mounting, one tick before `RenovationProjectStore.hydrate`'s query
  resolved and the empty state actually rendered. Measured directly: without a
  `flushPromises()` first, the scan found zero elements under any rule bucket at
  all — a pass that was true of an empty subtree, indistinguishable from a pass on a
  compliant one. `tests/harness/accessibility.test.ts` now awaits `flushPromises()`
  before scanning and asserts `.rp-empty-state` is actually present in the scanned DOM,
  so a regression that reopens the timing gap fails there rather than passing quietly.
  **No empty state carrying a button was graded by that case or any other, through design
  slice 15** — `renovationProject.noProjects` had none, and the Plan Editor case's default
  fixture resolves to `planEditor.noBackground`, the other buttonless entry — `noZones`'s
  action button was exercised by `emptyStateOverlay.test.ts` alone, and by no accessibility
  scan. Design slice 16 gave `renovationProject.noProjects` its action button and this
  file's own case now scans it, asserting `.rp-empty-state__action` is present the same
  way it already asserted `.rp-empty-state` — that slice's own section below has the rest.
  **THREE entries carry an action now and this file scans two of them**: design slice 21's
  `renovationProject.noPlans` arrived with its button already wired
  (`ProjectDetailState.onCreatePlan`), and it is graded here rather than joining the gap —
  the detail state's no-plans case asserts `.rp-empty-state`, `.rp-empty-state__action` and
  `.rp-project-detail__back` are all in the scanned DOM, and the last of those is what makes
  it a scan of the surface rather than of a component, since that empty state sits INSIDE the
  detail shell rather than replacing it. `planEditor.noZones` is the one that remains
  unscanned, and its reason is unchanged: the Plan Editor case's default fixture resolves to
  `planEditor.noBackground`, which carries no button, so reaching `noZones` means a second
  fixture rather than an assertion. It is exercised by `emptyStateOverlay.test.ts` alone.

**Design slice 8 has landed: the canvas is editable.** `SelectTool` and `DrawPolygonTool`
are registered in a `ToolManager`, and `CommandHistory` — wrapped by the
`withEditorStateRefresh` decorator — is wired per leaf by `runtime.ts`, which is built
inside the Vue tree (it hands out Pinia stores) and provided once per leaf. The toolbar
offers Pan/Select/Draw-zone plus undo/redo; the Inspector panel shows the selection DTO
and a Delete button that dispatches through `InspectorStore.commit`'s `toCommand` — the
§59 choke point, not a second seam. The composition root now hands the view a
`PlanEditorCommandServices` bundle (the plain zone commands rather than the reversible
adapters — guarded ones since slice 11 — the `ZoneRepository` port, the
Inspector query) beside slice 5's queries; with settings unrecovered it is the refusal
bundle, mirroring `unavailablePlanEditorQueries`. These rules came out of it and of the
review pass that followed:

- **The application-layer reversible adapters satisfy `UndoableCommand` structurally**
  and cannot name it — the interface lives in `presentation/` and the layer ban holds.
  Both adapters take the shared `WriteLedger`: **every WRITE records into it, restores
  included, and every DELETE forgets the id** — a deleted note has no revision to remember,
  and a stale entry outliving the note it described is presented as an expectation by
  whatever touches that id next. The earlier spelling here was "every successful half
  records", which two of its four subjects broke because they are deletes;
  `application/editor/WriteLedger.ts` now states the rule once for all of them.
- **Every dispatch funnels through ONE object per leaf** — the wrapped dispatcher that
  `runtime.ts` hands to tools as `context.commandDispatcher` and to the toolbar and the
  delete button alike. A dispatch that bypasses it silently breaks the post-command
  refresh and the reactive undo/redo flags; nothing errors anywhere.
- **Camera mode is "no active tool"**, exactly what slice 5 shipped (`ToolManager` grew
  `clearActiveTool()` for it). A gesture abandoned with Escape clears through
  `cancelGesture()`; a rejected close keeps the vertex buffer. **It is no longer the only way
  to reach the camera** — see the navigation section below, which is the same sentence about
  where panning lives, arrived at from the opposite direction.
- **A simulated pointer stream has to obey the real device's grammar, and so does the
  ROUTING.** A click is down+up on the SAME button; a drag is down/move…/up; a pointer can
  also be taken away with no up at all (`pointercancel`, which the browser fires when it
  claims a touch gesture for scrolling). The canvas therefore filters `pointerdown` and
  `pointerup` with the same button test — forwarding an unfiltered up while filtering the
  down handed tools a release with no matching press, and `SelectTool` committed a
  half-finished move for it — and every tool guards `event.button` itself, which is where
  the invariant belongs. `styles/editor.css` sets `touch-action: none` so the gesture is not
  stolen in the first place. `tests/presentation/editor/canvasPointerRouting.test.ts` drives
  both streams.
- **A screen-sized tolerance is converted through `worldPerScreenPixel()`**, the one
  statement of the camera's inverse (`viewport/Viewport.ts`), reached by tools through
  `EditorContext.viewport`. Three tools each derived it by projecting `(0,0)` and `(1,0)`
  back through `screenToWorld` and subtracting — three copies of the transform, and a
  subtraction of two numbers dominated by `pan`, so a far-panned plan lost low-order bits of
  exactly the quantity being measured. The click-versus-drag epsilon applies to EVERY
  gesture: applying it to body drags alone let a plain click on a vertex handle teleport
  that vertex up to 80 mm and push a real move onto the undo stack.
- **What the user sees and what the user can grab are two numbers in one module**
  (`editor/handleMetrics.ts`), with the grab radius deliberately the larger. They were
  declared independently, under the same name, with the values 8 and 4, and the comment on
  the 8 described it as a diameter.
- **A tool continuation that crosses an `await` re-checks whether its gesture is still its
  own.** `DrawPolygonTool` and `CalibrateTool` both carry a `generation` counter bumped by
  `activate`/`deactivate`/`cancel`; without it, Escape during an in-flight close let the
  late success wipe the vertices of the polygon the user had started since and select the
  zone they had cancelled out of.
- **A THROWN fault is not "nothing happened".** SDD §65 reserves throws for technical
  faults, and a write may well have landed before one — `withEditorStateRefresh` therefore
  re-reads the stores on a rejection as well as on success, and re-throws unchanged.
  `runtime.ts`'s `reportFault` is the last stop: every dispatch is ultimately bound to a
  click handler that discards its promise, so without it a fault was an unhandled rejection
  and that button silently stopped working.
- **A store that two things hydrate needs a ticket.** `ProjectStore.hydrate` gained a second
  concurrent caller in this slice (the refresh funnel, beside the plan-change listener that
  `ProjectIndexRebuilt` fires on every leaf), and without a request ticket the slower
  earlier read wins: a just-drawn zone vanishes with no error. `InspectorStore` already had
  one; the two now match.
- **A zone change reaches every leaf showing that plan** — `ZoneCreated`,
  `ZoneGeometryChanged` and `ZoneDeleted` are in `planChangeSource`'s list. The refresh
  decorator covers only the leaf that dispatched, which is every leaf right up until
  something else writes a zone: a split leaf on the same plan, the sample seed, a synced
  note.
- **There is ONE `EditorContext`.** Slices 5 and 6 shipped two types under that name in
  sibling directories, each with a "read carefully" paragraph and an aliased import at their
  shared consumer; `npm run analyze` reported the pair as a duplicate export, correctly. The
  Vue injection context is `PlanEditorContext` now (`PLAN_EDITOR_CONTEXT`,
  `usePlanEditorContext`); the tool facade keeps the bare name, which is the SDD's.

**Holding Shift constrains both drawing tools to a whole angle** — 15 degrees, through
`SnapService.snapDirection`, which is the first caller `angleStepRadians` has ever had (the
service was composed with that step from slice 6 and nothing above `snapRotation` read it).
The polygon tool constrains the next vertex against the LAST placed one and never the first,
which has nothing to be straight relative to; the calibration tool constrains its second
point against its first, where it matters most — a calibration taken a degree off is a scale
error every area on the plan inherits. Researched rather than invented: Figma and Illustrator
constrain to 45 degrees with Shift, CAD polar tracking to a configurable step with 15 among
its presets, and the picked point lands ON the alignment path at the projected distance,
which is why `snapDirection` projects rather than rotating. Four rules came out of it:

- **The pointer and the point a click would PLACE became two fields the moment Shift could
  separate them.** `PolygonSketch` had one `cursor`; the rubber band must draw to where the
  vertex lands, and the close target must be judged on where the hand actually is — closing
  is about pointing AT the first vertex, whatever the constraint is doing to the point it
  would otherwise place. One value cannot be both, and the case that proves it is asserted on
  the COMMAND path: a constrained point landing four units from the first vertex while the
  pointer is twenty away must not close.
- **A modifier has to bite on the KEY, not on the next pointer move**, which is what every
  tool in the field does and what makes the difference between a live constraint and a dead
  key. It costs nothing here because the camera fix above already built the hook: Shift's
  press and release re-issue the same synthetic pointer move. It reads `event.shiftKey` — the
  STATE — rather than the transition, which is also what makes it work under Sticky Keys,
  where the modifier latches and no key is physically held.
- **A modifier can be released where the canvas cannot hear it.** Shift held, Alt+Tab away,
  key released in the other application, back with a click and no mouse movement in between:
  no `keyup` ever reaches the element, so the preview stayed constrained while the click —
  carrying the REAL `shiftKey: false` — placed the vertex somewhere the rubber band was not.
  Preview and commit are the same call by design, and this was the one way they could
  disagree. `onBlur` re-issues the move with NO modifiers, which is the honest answer rather
  than a complete one: the web gives no way to READ modifier state without an event, so the
  opposite gap (holding Shift across the blur) is still there, self-correcting on the first
  real event. Reported by a review bot.
- **A modifier is invisible, and the status bar is where this one is admitted to.** No control
  shows it and no menu lists it — the standing cost of the convention — so `editor.hint.
  constrain-angle` sits in the Status region while a constraining tool is active, and only
  those two: advertising the key under Select would be advertising a key that does nothing.
  What is NOT built is CAD's numeric angle-and-distance readout beside the line, because
  `t()` takes no parameters and that would make it the plugin's first interpolated string.
  The copy leads with the key name (`Shift constrains the angle`) because
  `obsidianmd/ui/sentence-case-locale-module` fails the build on a capitalised `Shift`
  mid-sentence — measured — and lowercasing the name of a key is worse copy than leading with
  it.
- **A coordinate that has been through trigonometry is never bitwise what it should be, and
  it took TWO rounds to fix because the first one only covered the case being looked at.**
  `Math.sin(Math.PI)` is 1.22e-16, so a constrained westward click answered `(0, 1.2e-14)`
  where `(0, 0)` was exact — through `DrawPolygonTool`'s exact-equality duplicate guard, so
  retracing onto a vertex with Shift held appended a twin, and `createPolygon` accepts the
  resulting sliver because it validates the COUNT and the FINITENESS of the coordinates and a
  zero-length edge satisfies both. Two separate repairs, and the distinction is the lesson:
  - `exactOnAxis` restores the value the arithmetic was trying to produce, which is correcting
    a representation error rather than fudging one — a snapped angle is an exact multiple of
    the step, so ON AN AXIS the direction IS exactly `(±1, 0)`. It buys exact straightness for
    constrained horizontals and verticals, and it fixes the duplicate case for four directions
    out of twenty-four.
  - It could never have fixed the rest, and the review bot's next round said so with a
    diagonal: at 45 degrees `Math.cos` and `Math.sin` differ in their last bit and there is no
    exact value to restore, so a retrace lands at `(0, -1.42e-14)`. The guard had to stop being
    bitwise. `coincident` in `core/geometry/operations.ts` is the general answer — a nanometre
    of tolerance, eight orders of magnitude above the dust and five below anything a pointer
    can express at this editor's tightest zoom.

  **The meta-lesson is the one this file already carried, applied to its author:** a partial
  fix reads exactly like a complete one, and "I fixed the case in the report" is not the same
  as "I fixed the class". The first repair was the narrower of the two the bot offered, chosen
  deliberately, and it was the wrong choice for the general case.

  The related hole neither round named is still open and is written down rather than quietly
  fixed: three COLLINEAR vertices are a zero-area polygon that nothing refuses, which Shift
  makes considerably easier to draw, and closing that is a change to `createPolygon` (SDD §26
  files degeneracy under "Future") rather than to a tool.
- **Two harness fakes were thinner than the service they stood for, and the second would have
  thrown.** `tool-context.ts` had a hand-written `{ snapPoint }` behind an `as never`, and
  `calibrateHarness.ts` had `{} as never`. Both subclass the REAL `SnapService` now, composed
  with the editor's own 15 degree step, so the next method added to it is present in both the
  day it is written. A `StatusBar` that injected `useEditorRuntime()` was the same shape from
  the other end and the harness caught it: the index mounts every real component STANDALONE
  against the shared fixture, so a shell region that can only exist inside the whole editor is
  one nobody looks at. It takes `activeToolId` as a prop.

**Canvas navigation is an OVERRIDE above the tool framework, not a mode inside it.** Space
held or the middle button pans while any tool is active; shift+wheel pans horizontally (bare
wheel still zooms, which is the CAD convention and what slice 5 shipped); `Shift+1` frames the
plan and `Shift+2` the selection, both of them Obsidian Canvas's own bindings. The gestures
were chosen by reading what other canvases actually do rather than by taste, and
`docs/tests/cases/Canvas Navigation.md` records both the survey and what no gate here can
check. Rules that came out of it:

- **A pan built as a tool would destroy the thing the user is panning to see.** Reaching it
  through `ToolManager.setActiveTool` runs the outgoing tool's `deactivate()`, so holding
  space halfway through a polygon discards the vertices already placed — and the user reaches
  for the pan precisely BECAUSE the shape runs off the pane. `viewport/pan-override.ts`
  therefore sits ABOVE the manager and tells it nothing, which is why the interrupted tool has
  nothing to lose. That is the one case in `canvasNavigation.test.ts` that would fail against
  any design that routed this through the framework.
- **The gesture outlives the modifier.** Releasing space with the button still down leaves the
  pan running until the pointer is released — Photoshop, Figma and Obsidian Canvas all behave
  this way, and disarming on keyup strands the user's pointer mid-pan. Two independent fields
  (`spaceHeld`, `panningWith`) rather than one phase enum, because that overlap is exactly
  what a single enum would have to encode as a transition.
- **State keyed on a pointer is not keyed on a gesture, and a mouse is where that bites.**
  `swallowedPointers` was keyed by id alone — so a primary press swallowed during a
  middle-button pan recorded the PAN OWNER's own id, one mouse sharing one `pointerId` across
  every button, and the owner's release was then consumed as if it were the swallowed one.
  The canvas stayed panning with nothing held. The fix is an ORDERING rather than a richer key:
  the owner's release and the owner's cancellation are tested first, and the swallowed set only
  after — which needs no pointer/button pair and cannot drift out of step with `PanOverride`'s
  own record. **Worth remembering as the sharpest instance of this file's own recurring
  lesson**: "one mouse, one `pointerId`, two buttons" had already been the load-bearing fact in
  five separate findings, and the fix written one commit earlier still keyed its new state on
  the pointer alone. Knowing a fact is not the same as reaching for it.
- **A gesture's ownership has to outlive the gesture, because the POINTER does.** While a pan
  runs the canvas swallows every other pointer's press — but that decision was re-derived from
  the live phase at each later event, and the phase is gone by the time a swallowed pointer
  reports back. Finger A space-pans, finger B is swallowed, A releases and ends the pan, and
  B's eventual `pointercancel` then found no pan running and was attributed to the active TOOL,
  emptying a half-drawn polygon the tool never received a press for. `swallowedPointers` holds
  those ids until each pointer ends. **The same "what is true now versus what was true when
  this began" as the held-key races**, arrived at from the pointer side — a phase test cannot
  answer a question about the past. Consulted at both ends per this file's own rule, though
  only the CANCEL path is destructive: measured, a bare release is absorbed by each tool's
  no-gesture guard, and guarding one end alone would leave the next reader to work out which
  half was deliberate.
- **An element's `blur` and the WINDOW's are not the same event, and only one of them is
  guaranteed for an Alt+Tab.** Chromium can deactivate a window while leaving the focused
  element focused, and Obsidian is Electron — so the container's own `@blur` may never fire
  for exactly the gesture it was added to handle, leaving a held space bar recorded forever.
  The cleanup is registered at both, and removed from the window on unmount, because a
  window listener outlives its element and a closed leaf reaching into a disposed Pinia store
  is a leak with behaviour attached. **Which one Electron delivers is not measurable here** —
  jsdom models no window activation and a headless browser has no OS window to deactivate —
  so registering both is what makes `docs/tests/cases/Canvas Navigation.md` step 11 pass
  either way, and the suite can only check that the window listener exists and is removed. A
  window listener is safe where a window KEY listener would not be: it reacts to the
  application losing focus rather than competing for a keystroke, so two leaves both cleaning
  up is correct.
- **A canvas that hears keys only while focused has no keyup after an Alt+Tab.** The listener
  is on the element rather than on `document` — so a plan editor in one split leaf cannot
  swallow the space bar of a note being edited in another — which means focus leaving IS the
  only notice a held key has ended. Without `onBlur`, the canvas comes back armed forever and
  every later click pans instead of selecting.
- **The middle button is not "paste-on-Linux", and a test had pinned that reading for three
  slices.** X11's primary-selection paste is a TEXT INPUT gesture and a canvas is not one;
  Obsidian's own Canvas documents middle-drag as its pan. `shell.test.ts`'s case is narrowed
  to the SECONDARY button now, which is the one the claim was ever true of. The right button
  stays unclaimed on purpose: it pans in Obsidian Canvas on Windows and not on macOS, because
  macOS fires `contextmenu` on mousedown where Windows fires it on mouseup.
- **Precedence between the camera and the active tool is decided in TypeScript, not in the
  cascade.** The first draft expressed it as source order in `styles/editor.css` under a
  comment claiming the pan rules won — they did not: the tool selector it was competing with
  carried an attribute and outranked them, so the comment was false in both of its claims. One
  computed class (`cursorClass`) makes the precedence an ordinary assertion instead, and
  nothing in any gate reads CSS ordering.
- **A dead branch that reads as belt and braces.** `boundsOfZones` validated each zone through
  `createPolygon` before asking Core for its bounding box — but `validatePolygonPoints` refuses
  exactly the empty and non-finite cases `boundingBoxOf` refuses, and refuses them first, so
  the box's own failure arm was unreachable and no test could ever have covered it. Framing is
  also the weaker question: a stored zone that no longer closes still has coordinates, and a
  user asking to frame the plan wants to SEE it. One gate, both arms reachable.
- **Ending one half of a gesture and not the other cost a ROUTING defect, not the camera
  defect it looks like.** `pointerleave` cleared the store's drag and left the override still
  believing it owned the pointer. The obvious prediction — the view runs away with the bare
  cursor — is wrong and was measured wrong: `continuePan` no-ops without a drag state, so the
  camera stays put and looks fine. What actually broke is that the next `pointerup` was
  consumed as the end of a pan no longer happening, so the active tool got a press with no
  release and the drag the user had just made did not commit. **Exactly one** release is
  swallowed, and swallowing it repairs the state — so the regression case has to make that
  drag the very next interaction, and the first draft of it passed against the defect because
  a `click()` in between absorbed the damage. A self-healing defect needs a test that reaches
  it before it heals.
- **A release has to match the button that started the gesture.** A mouse shares one
  `pointerId` across its buttons, so pressing and releasing the middle button during a
  space+primary pan is an ordinary input — and an unconditional `pointerUp()` ended the pan
  while its own button was still down, freezing the view under a hand still moving.
  `pointerUp(button)` is narrowed to the owner now, with `abandonGesture()` as the separate
  door for `pointerleave`, which names no button: an OPTIONAL parameter would have re-opened
  the same hole under a different spelling. The second-order damage — that release reaching
  `SelectTool` with no matching press — turns out to be absorbed by the tool's own no-gesture
  guard, so a test asserting the zone did not move passes with the defect present and was
  dropped rather than kept. Which is the invariant-at-the-forbidden-thing rule paying out:
  the guard belongs to the tool, and the routing needs its own case.
- **A gesture interrupted by FOCUS LOSS is the same question as one interrupted by
  `pointercancel`, asked at the door with no pointer to name — and `onBlur` answered for the
  camera only.** An Alt+Tab mid-drag delivers no `pointerup` at all: the user releases the
  button in another application. So `ToolManager.gestureInFlight` stayed true, and through
  `cameraIsLocked()` that refused every wheel and both fit shortcuts **for the rest of the
  session**, with nothing on screen to say why; `SelectTool` meanwhile kept a translated
  preview whose delta the user's next click anywhere committed — the identical damage
  `onPointerCancel`'s header already records, through the other door. The guard is
  `gestureInFlight` and it is NOT the same as `Escape`'s: a multi-click tool sits BETWEEN
  clicks with the flag false, so an unconditional cancel here empties a polygon buffer the
  user alt-tabbed away from, which is the over-correction the third case pins.
  `cancelInterruptedGesture` states that once, and it has TWO callers — `onBlur` and
  `onPointerCancel`, for the reason the `pointercancel` bullet above gives.

  **The first version of that fix was wrong in the narrow half, and the correction is the more
  useful lesson.** `gestureInFlight` is not a sufficient gate on its own: a multi-click tool
  commits its work on `pointerdown`, so it is between down and up — flag TRUE — for the whole
  of EVERY click, and an interruption there (a long press, a notification stealing focus, an
  Alt+Tab without letting go) called `cancel()` and destroyed every vertex placed before it.
  So `EditorTool` gained `abandonGesture()` beside `cancel()`, REQUIRED rather than optional
  so a tool that grows a drag has to say so, and the two are a real pair rather than a
  synonym: `cancel()` is DELIBERATE (Escape, a tool switch) and a user pressing it wants the
  accumulation gone, while `abandonGesture()` is an INTERRUPTION and must abandon only what
  the missing release would have completed. `SelectTool`'s is its whole `cancel()`,
  `DrawPolygonTool`'s is a documented no-op, and `CalibrateTool`'s drops the buffered second
  point while RESTORING the placed first one — the asymmetry there being deliberate, since a
  kept buffer completed by some unrelated later click is a scale error every area on the plan
  inherits, silently.

  **"Restoring" is the word that had to be measured, and the first version said "keeping" and
  was wrong.** `CalibrateTool.pointerDown` does not leave the anchor where it found it: placing
  the second point MOVES `pointA` into `pendingCompletion` and nulls it. So clearing the
  pending completion alone lost BOTH points — measured, the next click placed a fresh first
  point and no calibration was taken at all, with the abandoned segment still drawn over it —
  under a docblock asserting the opposite, written one commit earlier. **A claim about which
  state survives an operation is worth nothing until it is asked of the state machine that
  actually moves that state**; this one read as obviously true and was false at the only call
  site that matters.

  **And the same edit had to be UNDONE at the tool-switch paths**, which is the second half of
  the lesson. Their guard reads identically, so the first attempt routed them through the new
  method as "one question written out longhand in three places" — and they are not the same
  question: switching tools is deliberate, like Escape. Two ToolManager cases caught it
  immediately. **Similar guards are not automatically duplication, and consolidating two
  questions that merely look alike is how a narrow correct behaviour gets replaced by a
  uniform wrong one.**
- **A mapping with an `else` claims everything it never thought about.** `panButtonOf` read
  `button === 1 ? auxiliary : button === 2 ? secondary : primary`, so `PointerEvent.button`'s
  less familiar values all answered `primary`: **3 is a mouse's Back, 4 its Forward, 5 a pen's
  ERASER.** With space armed, a Back press therefore CLAIMED the camera, took the pointer
  capture and had its default suppressed — which on that button is the browser's own
  navigation. It answers `null` now and the two call sites differ, which is the point: the
  override DECLINES an unrecognised button, while `editorPointerEvent` says `?? 'primary'` at
  its own call site, because `-1` ("no button changed state", which every plain move carries)
  must go on reading as the primary gesture it is. **Declining is not the same as mapping to
  something**, and an `else` cannot express the difference.

  Two things about finding it are worth more than the fix. The camera symptom was
  SELF-HEALING — a pan claimed by button 3 ends on its own very next move, because
  `pointerMove` sees the primary bit absent from `buttons` and reads a chorded release — so
  the first version of the regression case watched `viewport.pan`, passed, and pinned
  nothing; it asserts `defaultPrevented` and the phase class instead. And the edit that added
  `PRIMARY_BUTTON_BIT` had been inserted BETWEEN `panButtonOf`'s docblock and `panButtonOf`,
  leaving a paragraph about button mapping sitting above a numeric constant and the function
  itself undocumented. Nothing in any gate reads whether a docblock is attached to what it
  describes. `pointerButtons.ts` now holds all three together, extracted when `PlanCanvas.vue`
  crossed its 400-line cap.
- **`event.buttons` describes the pointer that SENT the move, and reading it without asking
  whose pointer that was is the button/pointer confusion in its newest disguise.** The
  chorded-release fix asked `gestureInFlight && (buttons & 1) === 0` and nothing about
  identity — so a pen hovering over the canvas, or a finger resting and lifted, reports
  `buttons: 0` while the mouse holding a drag is still down, and `SelectTool` committed that
  drag at the PEN's coordinates: measured, the zone landed at (7500, 3500), nowhere the user
  dragged it. The canvas keeps `toolGesturePointer` beside the manager's flag now — deliberately
  never cleared, because it is only ever read WITH `gestureInFlight` and both are written by
  the same call, so a leftover value is unreachable rather than stale. **This is the seventh
  finding in this handler resting on "one mouse, one `pointerId`, two buttons" and its
  converse, and the fifth written by an author who had just recorded the rule** — knowing a
  fact is not the same as reaching for it, and a NEW mechanism reading a pointer field is
  exactly where the old rule has to be asked again.
- **A chorded mouse button fires NO `pointerdown` and NO `pointerup`, and eight rounds of
  review on this handler hardened it against inputs no mouse can produce.** W3C Pointer
  Events, "chorded button interactions": `pointerdown` fires only on the transition from no
  buttons to some, `pointerup` only when the LAST button comes up, and every button change in
  between is a `pointermove` whose `button` names what changed and whose `buttons` carries
  what is still held. So a pan waiting for a release that MATCHES its own button never gets
  one when a second button outlives it — middle-drag, press primary, release middle, release
  primary sends exactly one release and it names the primary. Measured: the canvas sat in
  `panning` for the rest of the session, swallowing every later click. The fix is the
  BITMASK, at every door a gesture can survive: `PanOverride.pointerMove` ends a pan whose
  owning bit has left `event.buttons`, and camera mode and the tool path each take the same
  test — camera mode because it is the DEFAULT and therefore the more reachable half, the
  tool path because a tool refuses a release that is not primary and so lost the drag
  outright rather than merely freezing (the zone snapped back with no error anywhere). Three
  paths, one grammar; fixing only the one in the report would have been the partial fix this
  file has already paid for twice.
- **Seventh instance of the fake-too-thin rule, and the most expensive by REACH rather than
  by count.** `tests/helpers/planEditorRig.ts` never set `buttons` at all, so every
  synthesized move reported none held — and the cases that meant to describe a chord invented
  a second `pointerdown` and an early `pointerup` instead. Every one passed, in both worlds:
  the routing they certified could not be exercised by a real device, while the real chord
  went unhandled underneath them. Five cases had to be rewritten to the grammar a mouse
  actually sends, two deleted outright (they guarded a `swallowedPointers` collision that has
  no producer — a chorded press reaches `onPointerDown` at no point, so nothing is ever
  swallowed under an id that already owns a pan). One of the five, 'is refused while a tool
  gesture is already running', turned out to be reaching its guard through the middle button,
  which cannot get there: rewritten to a second FINGER, the one input that does, and mutation-checked
  by nulling the guard and watching it go red. **The shape to remember is not the count. A
  test that drives an impossible input is not weak evidence, it is evidence about a different
  program**, and it stays green through every fix and every regression alike. Where a fake
  invents the input rather than merely accepting one, ask what the SPEC says the device sends
  before asking what the code does with it.
- **A gesture belongs to a POINTER, not just to a button — and camera mode had the same hole
  the override did.** On a mouse this is invisible: one `pointerId` is shared across every
  button. On touch it is not, and the manifest promises mobile — so a second finger's moves
  read as continuations of the first one's drag (the camera jumping by the distance BETWEEN
  two fingers) and its release ended a pan whose own finger was still down. Both halves, and
  both places: `PanOverride` gained `owns(pointerId)` and a pointer test on `pointerUp`, and
  `DragState` gained a `pointerId` that `continuePan` and `endPan` both check. **Fixing only
  the override would have been half a fix, and the canvas-level case is what proved it** —
  with no tool active the move falls through to camera mode, which is the DEFAULT state and
  therefore exactly where a second finger on a tablet lands. Each object splits the pair the
  same way: `endPan(pointerId)`/`abandonPan()` beside `pointerUp(button, pointerId)`/
  `abandonGesture()`, because `pointercancel`, `pointerleave` and focus loss name no owner and
  an optional parameter would have re-opened the hole under a different spelling.

  **And the THIRD place with that hole was the one nobody looked at, because it is not the
  camera at all.** The override refuses a press while another gesture runs and `beginPan`
  keeps the drag it already has — but the TOOL branch of `onPointerDown` simply reassigned
  `toolGesturePointer` and forwarded the press, so a second finger landing mid-drag handed
  `SelectTool` a gesture at ITS coordinates and the owner stopped being the owner. Measured:
  a zone dragged 1000 world units committed 6000. The gate is `gestureInFlight &&
  toolGesturePointer !== event.pointerId`, and both halves are load-bearing — the identity
  test ALONE would be wrong, since `toolGesturePointer` is deliberately never cleared, which
  is safe only because it is read exclusively WITH that flag. Widening the flag to "a tool is
  active" reddens ten cases, which is the over-correction measured rather than argued: a
  multi-click tool sits between clicks with nothing in flight, and two fingers placing
  vertices in turn is a legitimate way to draw a polygon. Reported by a review bot, four
  rounds after the two camera halves were fixed — the same question asked at a door that was
  never about the camera.

  **And the MOVE door needed it too, which the press guard cannot reach: a hovering pen is
  never pressed, so it is in no swallowed set — it simply arrives.** The ownership test
  existed there already and guarded the synthetic chord-release ALONE, so the same foreign
  event fell one line through to `pointerMove` and the ghost the user is steering by jumped to
  wherever the pen was. The commit is computed from the release, so the geometry survives and
  the PREVIEW is the whole of the damage — which is why its case asserts on what the
  interaction layer DRAWS rather than on what is saved, comparing every line it holds rather
  than picking one out by template order. Asked once at the top of the branch now, above both
  things that branch does. **The narrowing needed its own case and would not have got one:**
  every other case passes with the guard keyed on identity alone, and that version stops a
  drawing tool's rubber band following any pointer but the last one to have pressed — for the
  rest of the session, silently, because `toolGesturePointer` is never cleared. Measured by
  writing the mutation and finding the suite green.
- **A SYNTHETIC input is still an input, and `reissuePointerMove` was the one door that handed
  a tool something while the camera owned the canvas.** Three pointer handlers keep the active
  tool out of a running pan; the re-issue is built from `lastStagePoint`, which during a pan is
  the PAN's own pointer — so Shift pressed mid-pan sent a drawing tool a hover at the panning
  cursor and its rubber band jumped there. The guard is inside that function rather than at its
  two Shift call sites, because it is a property of re-issuing at all and a third caller cannot
  see a rule kept at the other two. Nothing is DEFERRED to the pan's end: a re-issue answers
  "the camera moved under a stationary pointer", a pan moves the pointer too, and the first
  real move after it says so truthfully — while the camera doors that do need one (`onWheel`,
  `onKeyDown`) are refused during a pan anyway by `gestureInFlight()`, which a pan's own
  `dragState` satisfies.
  **Its narrowing needed a case of its own, and that is now twice in two rounds**: widen the
  guard from "a pan is running" to `gestureInFlight()` and the whole suite still passes, while
  the angle constraint dies at exactly the moment it is wanted — a drawing tool places its
  vertex on `pointerdown`, so a user holding the button and moving is mid-gesture by
  definition. The comment above that branch had asserted precisely this and nothing checked it.
  **The pattern worth carrying: when a fix is a REFUSAL, the suite tends to cover the thing
  refused and not the thing still allowed** — so write the widened mutation and run it, because
  a refusal that is too broad is silent in a way a missing refusal is not.
- **A guard cannot be walked around by a caller that reads it, only by one that DESTROYS what
  it reads first — and `onBlur` was doing both halves of that in one function.** It re-issued
  the move LAST, after its three cleanups, so the synthetic input was a statement about a
  gesture that no longer existed:
  - `cancelInterruptedGesture()` had just restored `CalibrateTool`'s first point and redrawn
    its zero-length anchor, and the re-issue replayed the remembered position of the
    interrupted SECOND point straight back through `pointerMove`, drawing the abandoned
    segment over it. Not cosmetic, which is what makes it worth the bullet: that render is
    byte-identical to the one `pointerDown` leaves for a second point really placed, so the
    user came back to the picture meaning "measured, awaiting the distance" over a tool that
    had thrown the measurement away, with no dialog coming.
  - And `panOverride.cancel()` ran before it, so the `phase === 'panning'` guard the bullet
    above put INSIDE `reissuePointerMove` — for exactly this — was already false when the
    re-issue asked. A blur mid-pan handed a drawing tool a hover at the pan's pointer. The
    guard was in the right place and the caller had cleared its input; the previous round's
    own reply had cited this call site as safe BECAUSE it sat below the cancel, which is true
    as a fact and wrong as a defence.

  The re-issue goes first now, so it describes the gesture as it still was and the
  interruption is the last word. **The method note is the ordering twin of the refusal one
  above, and this file has now paid for both in consecutive rounds: when a fix is an
  ORDERING, write the PARTIAL reordering and run it.** Moving the call up by three lines
  instead of above the whole teardown passes the reported calibration case and leaves the
  camera one live — a partial fix that reads exactly like a complete one, which is this
  file's oldest recurring lesson arriving in its newest disguise. The opposite
  over-correction, deleting the re-issue outright, is caught by the existing
  constraint-drops-on-blur case in `interactionLayer.test.ts`, so both directions are held.
- **A guard on the direct path says nothing about the VALUE that path leaves behind.** The
  ownership guard above refuses a foreign pointer's move as a tool move — and
  `onPointerMove` wrote `lastStagePoint` at its very top, above every check below it, so the
  refused pen's coordinates were recorded anyway and the next Shift press rebuilt a synthetic
  move out of exactly them. The ghost jumped to the pointer the guard had just declined.
  `isGestureOwner(pointerId)` is the companion to `gestureInFlight()` and exists for its
  reason: the two gestures a pointer can own record their owner in different places
  (`toolGesturePointer` beside the manager's flag, `dragState.pointerId` in the store, which
  the override's pan and camera mode's drag both go through), so a caller would otherwise
  spell a two-armed question out longhand. Its "or none is running" arm is load-bearing
  rather than a convenience — a hover with nothing in flight is how a drawing tool's rubber
  band follows the pointer at all. `editor.setPointer` is gated with it: `pointerWorld` is
  the status bar's readout of where the pointer is, and a readout following a hovering pen
  away from the drag the user is making is the same claim being false in the other surface.

  **The method note gained its third variant here, and the three are one rule:** when a fix
  is a REFUSAL, write the WIDENED mutation and run it; when it is an ORDERING, write the
  PARTIAL reordering; when it guards ONE of several gestures, DROP THE OTHER ARMS. Every one
  of those has passed the whole suite at least once while leaving a defect live — this
  round's was gating the tool's gesture and not the camera's, green across 46 files and 633
  tests with the camera half still broken (a pan swallows a foreign move but still records
  it, and a pan ends on its release with no move after it to correct the record, so the first
  Shift press afterwards replays the hover). **A fix's own shape tells you which mutation to
  write**, and the suite covering the reported path is not evidence about the one beside it.
- **Two more doors that did not ask, and one of them was named in the comment that exists to
  prevent exactly this.** `swallowedPointers` holds a pointer's id "until that pointer ends",
  and its docblock narrates the scene — finger A space-pans, finger B is swallowed, A
  releases and ends the pan, B reports back to a canvas with no pan running — then closes
  with "Consulted at BOTH ends", meaning the release and the cancellation. The MOVE is a
  third door and it asked nothing, so B steered the rubber band the moment A let go, one
  event before the cancellation the comment describes. The move is also the door whose damage
  LASTS: B's release is swallowed, so unlike most defects in this handler nothing self-heals
  it. The guard is above the RECORD as well as the routing, because the routing-only form
  passes the whole suite while leaving a Shift press able to replay B's position.
- **`onBlur` was not idempotent, under a comment that called it idempotent** — and the
  comment had been true until the ordering fix two commits earlier moved the re-issue above
  the teardown. Chromium can deactivate a window while leaving the focused element focused,
  so both blur listeners are registered and one Alt+Tab may deliver BOTH: the second call
  found the override idle, because the first had just cancelled it, and replayed the pan's own
  pointer into a tool that was told nothing while that pan ran. Whether the tool heard
  anything came down to how many blur events the host chose to deliver. The remedy is not a
  once-per-blur flag — that goes stale-true when focus leaves the container WITHIN the
  document, where no window blur and no focus event follow, and the next real Alt+Tab would
  then skip the space-bar cleanup. `onBlur` forgets `lastStagePoint` instead, which makes the
  second call a no-op at the re-issue's own guard and is the sentence `onPointerLeave` and
  `onPointerCancel` already carry: **a position remembered from before an interruption is not
  a claim about where the user's pointer is.** `editor.setPointer` is deliberately NOT cleared
  with it — those two doors fire because the pointer demonstrably left or was taken, while
  focus can leave with the pointer still resting over the plan — and that asymmetry has its
  own case, because clearing it too passes everything else.

  **Both of these are the same shape as the fixes that preceded them, which is the thing to
  carry rather than either defect: a rule this file states in a docblock is a rule some door
  is not following, and the docblock is where to look first.** Three rounds running, the
  comment naming the invariant was the best available description of the bug.
- **It ended as FOUR doors asking one question, and the last two rounds are what says why that
  had to be a function rather than a habit.** `isGestureOwner(pointerId)` — the owner of the
  running gesture, or nobody's if none runs — is asked at the move, the release, the
  cancellation and the leave. Each door was fixed in its own round, by its own report, and
  each of the first three looked like the last one: the cancel door abandoned the
  drawing pointer's gesture when a hovering pen was taken away (a 1000-unit drag committing
  0), the release door committed `SelectTool` at a foreign pointer's coordinates while the
  owner's finger was still down (1000 committing 6000, the press-door defect's own signature
  through the other end), and the leave door forgot where the drawing hand was. **The lesson
  is not "guard the doors" — it is that a question worth asking at one door is a FUNCTION, and
  the moment it is spelled out longhand anywhere, the count of places it is missing is
  unknowable.**

  **This bullet said FIVE for a slice, and counted the press door among them — which spells
  the question longhand and asks a NARROWER one.** `gestureInFlight && toolGesturePointer !==
  pointerId` omits `isGestureOwner`'s `editor.dragState` arm, so a second finger pressing
  during a CAMERA-mode drag is forwarded rather than swallowed. Measured to change no
  behaviour: with no tool active that press reaches `EditorStore.beginPan`, which keeps the
  drag it already has. So the correction is to this SENTENCE and not to that door — the file's
  own "consolidating two questions that merely look alike" rule cuts against widening a gate
  no test asks to be widened, and the press door's comment states its narrower gate on
  purpose. Which leaves the paragraph as its own best illustration: the longhand spelling is
  what made the count wrong, and nothing but a `grep` could have said so.
- **A pan can END without a release, and the door where that happens cleared half of what the
  other three clear.** `onPointerCancel`'s PAN branch blanked the status bar and left
  `lastStagePoint` holding the pan's own pointer. `reissuePointerMove`'s guard is
  `phase === 'panning'` — the very thing the branch had just cleared — so the suppression
  stopped applying at exactly the moment the stale point outlived it, and the next Shift press
  replayed the panning cursor into the active tool: measured, a drawing tool's rubber band
  snapped from `[1100,300,1200,400]` to the pan's own `[1100,300,900,500]`. **`onBlur`'s
  docblock names this handler as already carrying the sentence, and it did not** — the
  blur-ordering commit fixed three interruption doors and this branch was the fourth, never
  re-read against the rule its own siblings had just taken. Found by review rather than by any
  gate, four rounds after the doors it sits between were closed. The oldest recurring shape in
  this file, arriving once more: a rule stated in a docblock is a rule some door is not
  following, and the docblock is where to look first.
- **A residue written down is only as honest as the bound it names, and this file asserted one
  that was false when written.** Forgetting a swallowed pointer on leave (above) left a real
  hole, and the commit doing it said so — "an ordinary pointer from then on, which its own
  ownership guard bounds to a hover with no gesture running". True of the move door, which had
  such a guard, and false of the release door, which had none; the next round's report was
  exactly that hole. The bound was checked against the door its author had been thinking
  about. **Writing a known limitation down is not the same as measuring it**, and a documented
  residue reads as surveyed ground — worse than an unmentioned one, which at least reads as
  unexplored. The note names its three doors now, so that a door which stops asking makes the
  sentence wrong rather than quietly stale.
- **Uniformity is a reason, and it is not the same reason as necessity — say which one you
  have.** The release door takes `isGestureOwner` rather than a bare identity test, and the
  first draft of its comment claimed the "or nothing is running" arm kept multi-click tools
  working there. Measured false: the press door sets `toolGesturePointer` for every press it
  forwards, so a releasing pointer is the owner whenever the tool ever heard its press, and
  the two spellings are indistinguishable at that door for any stream a device can produce.
  The arm IS load-bearing at the move door and has a case there. The predicate stayed, for the
  bullet above; the sentence changed, because a rule kept for tidiness and a rule kept for
  behaviour are different claims and only one of them is testable.
- **Two expressions of one question, three lines apart, drift immediately.** The camera lock
  and the override-start guard both asked "is a gesture already running", and the lock was
  written without `editor.dragState` — so a camera-mode drag, which is the DEFAULT state and is
  represented by nothing else, did not lock the camera at all. Its symptom differs from the
  tool-drag one and is worth knowing: `continuePan` recomputes absolutely from the viewport
  captured at the drag's start, so a wheel that moved the camera is thrown away by the very
  next mouse move and the user sees a JUMP rather than silent corruption. They are one
  `gestureInFlight()` now. This is the THIRD instance in one review of a rule stated in one
  place and not followed by the next (`isPrimary` across four handlers, `gestureInFlight`
  across the tool and the camera, this) — at which point the answer stops being "state it
  again more carefully" and becomes "make it one function nothing can restate".
- **A `preventDefault` for a HELD key has to run before any early return that outranks it.**
  Placing the camera lock above the space branch meant every autorepeat during a pan returned
  before reaching `preventDefault()` — and space is page-down, so the editor leaf scrolled out
  from under the plan for the length of the gesture. Suppressing the first keydown is not
  enough when the gesture is DEFINED by holding the key. The suppression is unconditional now
  and only the ARMING is what the lock refuses.
- **A camera that moves mid-drag corrupts what the drag commits, and every camera door had to
  take the same rule.** `SelectTool` records where a drag started in WORLD coordinates and
  computes the commit from the release's world coordinate, both through the camera as it
  stands at that moment — so a zoom or pan in between silently adds its own delta to the
  geometry, and the zone lands somewhere the user never dragged it with no error anywhere. The
  wheel ZOOM has been able to do this since slice 5, and the middle-button path already
  refused to start a pan in that state, so the file was applying half of a rule it had already
  discovered. `cameraIsLocked()` is that rule at every door — wheel, keyboard zoom, both fit
  shortcuts — with Escape deliberately above it, since abandoning a gesture is exactly what a
  user wants while one is running. The capability given up is "zoom while dragging", which
  does not work today in any sense worth keeping; making a live drag COMPENSATE for a camera
  change belongs to the tool framework and is the follow-up.
- **"Is another gesture running" is a question about EVERY gesture, and camera mode is not a
  tool.** The override's refusal asked only `toolManager.gestureInFlight`, so a middle press
  during a bare left-drag pan claimed the camera — and its release then ended a drag the
  primary button was still holding. One mouse, one `pointerId`, two buttons: nothing about
  pointer identity could catch it, because the question was simply too narrow. The parameter
  is `gestureInFlight` now and takes both. The same round found the camera-mode branch of
  `onPointerUp` missing this file's OWN down/up symmetry rule — a camera drag can only begin
  on a primary press, so an unfiltered release let the middle button end one it never started.
  A rule stated in a comment three handlers above is not a rule the fourth handler follows.
- **A key handler on a container swallows the keys of everything focusable inside it.** The
  Plan Editor's empty states are OVERLAYS inside `.rp-plan-canvas`, and `planEditor.noZones`
  carries an action button — so its `keydown` bubbled to the canvas, whose `preventDefault()`
  (there to stop the pane paging down under a space-held pan) suppressed the button's native
  Space activation. The canvas's only keyboard-reachable control stopped working under the
  standard gesture for pressing it, while the camera armed behind it. `event.target ===
  container` is the whole fix, tested against the container rather than by sniffing for
  interactive tag names, so the rule stays true for whatever that slot holds next. Worth
  pairing with the accessibility note in the slice 14 section: no empty state carrying a
  button is graded by any axe scan, so nothing else here was watching this control.
- **`pointercancel` was the one door that broke this design's own central claim.** It
  cancelled the ACTIVE TOOL unconditionally — so a user mid-polygon who held space to pan and
  then alt-tabbed lost their vertices, which is precisely what routing the pan around
  `ToolManager` exists to prevent. The tool never received the pan's press, so its buffer has
  nothing to do with the gesture the OS took away. Which gesture was cancelled now decides
  what is abandoned. Worth remembering as a shape: the headline argument for a design is
  exactly the claim its rarest code path is most likely to falsify, because that path is the
  one nobody re-reads the argument against.

  **Its TOOL branch then had to make the same correction `onBlur` had already made, and the
  finding is that ONE interruption fires BOTH doors.** A cancellation is the OS taking the
  pointer, never a user asking for their work back — so it belongs on the `abandonGesture()`
  side of that pair, and calling `cancel()` there emptied a drawing tool's whole buffer for
  an interruption during a single click. An Alt+Tab mid-press fires `blur`, which carefully
  abandons the gesture and keeps the vertices, and the `pointercancel` that may follow then
  destroyed exactly what the blur had preserved: a narrow fix for one door, undone by the
  next one along. Being gated on `gestureInFlight` is what makes the pair idempotent —
  whichever door arrives second finds nothing in flight and does nothing — which is why the
  remedy is one shared door rather than a record of which pointer was already handled.
  Reported by a review bot, and the case is watched failing BOTH ways: `cancelGesture()`
  loses the buffer, and telling the tool nothing at all leaves `SelectTool`'s preview live
  for the next unrelated click to commit.
- **While a pan runs, the canvas belongs to the CAMERA — every input, not just the moves.**
  Three handlers, one rule, and it took three tries to get all of them: a press the override
  declined fell through to the active tool (`DrawPolygonTool` placing a vertex on a world that
  was moving under the user), that press's RELEASE then fell through too — a release with no
  matching press, the grammar defect this repository keeps re-finding — and a `pointerleave`
  from any pointer at all abandoned the owner's gesture. **Not a touch-only concern, which is
  the part a first reading gets wrong:** a mouse shares ONE `pointerId` across every button, so
  a plain left click during a middle-drag pan takes exactly that path. `EditorStore.beginPan`
  keeps an existing drag rather than replacing it, for the same reason one layer down.
- **A modifier is the wrong test for a gesture the hardware performs itself.** Shift+wheel was
  gated on `shiftKey`, so a trackpad's two-finger sideways swipe — nonzero `deltaX`, no
  modifier — fell through to the zoom branch, which reads only `deltaY`, and with `deltaY: 0`
  did nothing at all. Two things had already promised otherwise, which is what makes it worse
  than a gap: the comment inside that branch described trackpad swipes "on every platform"
  from a branch that could not see them, and `docs/tests/cases/Canvas Navigation.md` step 8
  told a tester to expect it. The LARGER axis decides now, not the presence of any horizontal
  delta at all — a trackpad emits a little `deltaX` during a mostly-vertical swipe, and
  routing on its mere presence would turn hand tremor into a mode switch.
- **A keyboard shortcut matched on `event.key` is matched on the LAYOUT.** `Shift+2` produces
  `@` on a US keyboard and `"` on the German and UK ones, so both fit shortcuts were silently
  dead for exactly the users this plugin ships a `de.ts` for — the worst failure a shortcut
  can have, since nothing happens and nothing says why. `event.code` (`Digit1`/`Digit2`) is
  the physical key; the `shiftKey` test stays BESIDE it, because `code` alone would fire on a
  bare `1`. The two original cases had passed while the shortcut was dead, because they sent
  only `key` and no browser does — a fake thinner than the real thing, again.
- **A guard put at the keyboard door is owed at the pointer door, and the second one cannot
  be written the same way.** `isCanvasKey` (`event.target === container`) fixed the empty
  state's action button being unable to take a Space press — and left the PRESS bubbling for
  another round, so clicking that button began a camera pan under the user (measured: `pan`
  from -480 to -1280). The same test could not be reused: a key goes to whatever has focus,
  while a press targets the Konva canvas the stage draws into and never the container, so
  `event.target === container` is false for every real gesture. The rule is STRUCTURAL
  instead — the overlay slot is wrapped in a `div` carrying `@pointerdown.stop`,
  `@pointerup.stop` and `@pointercancel.stop` (`display: contents`, so it generates no box
  and the overlay lays out exactly as before) — which holds for whatever the slot holds next
  and cannot be forgotten at a sixth pointer door the way a predicate can. Both ends, never
  one: a swallowed press owes a swallowed release. The `.stop` fires at the BUBBLE phase, so
  the overlay's own controls have already had the event and only the canvas behind them is
  kept out of it.
- **"Every input" meant every POINTER input, and the one keyboard input it left out was the
  destructive one.** Three handlers check `phase === 'panning'` and swallow; `Escape` was
  routed straight past to `cancelGesture()`, which EMPTIES `DrawPolygonTool`'s buffer — so a
  user mid-polygon who held space to pan and pressed Escape lost the whole polygon while the
  pan carried on underneath (measured: no zone closeable at all afterwards). The same defect
  as `pointercancel`'s, in the next door along. Escape differs in being DELIBERATE, which is
  the honest argument for letting it through, and it loses to the fact that a pan has no
  uncommitted state for Escape to undo — the camera does not rewind — so the tool's buffer
  was the only thing it could destroy. **Swallowed rather than routed to the pan**, which is
  what the finding proposed: ending the pan there leaves the user's button down with the
  override no longer owning it, so the release reaches the tool with no matching press. The
  gate is `panning` and never `armed`, because space merely held is not a gesture and the
  camera lock carved this branch out precisely so Escape keeps working during a tool drag.
- **A gesture the canvas CLAIMS owes its browser default suppressed on every press of it,
  including the ones it refuses — and the door that hears "every press" was not a pointer
  door at all.** `event.preventDefault()` for the middle button sat inside the branch where
  the override took the press, so a middle press refused because another gesture was in
  flight fell through the primary filter and reached Chrome, which opened its autoscroll
  widget over the drag still running. The file already knew the rule — the comment saying so
  was three lines above, inside the branch that applied it — and applied it at one door out
  of three. Hoisting it to the top of `onPointerDown` fixed the refusal and left the case
  that matters open for two more rounds: **with the primary button already held, a middle
  press fires no `pointerdown` at all**, so the hoisted suppression sat on a handler the
  press never reached. Measured in a real Chromium rather than argued — the chord arrives as
  `pointermove` (`button=1`, `buttons=5`) while the compatibility `mousedown` fires exactly
  as always, and cancelling that `pointermove` does not suppress it, because the
  compatibility mapping ties mouse-event suppression to a cancelled `pointerdown`. The rule
  lives at `onMouseDown` now, the one door a bare press (`buttons=4`) and a chorded one
  (`buttons=5`) both arrive at, and the claim branch's own `preventDefault` is narrowed to
  the PRIMARY button so that a claimed middle press cannot suppress the very compatibility
  event the rule is stated on. **Suppressing a default is not claiming a gesture**, and the
  two must not be hoisted together: a build that lifted the CLAIM instead passes the
  autoscroll cases and turns the camera-lock cases red, which is how that mistake is caught.
  **The shape worth keeping: "every press" is a claim about a DOOR, and three rounds of
  moving the suppression between pointer handlers could not fix it, because no pointer
  handler hears every press.**
- **A phase test decides afresh on every event; a held key is ONE press.** Swallowing Escape
  while `phase === 'panning'` fixed the case above and left the next one open: a user holding
  Escape as the pan ended had the keydown swallowed, and the OS's next repeat of that same
  press — tens of milliseconds later, phase no longer `panning` — reached `cancelGesture()`
  and cleared the polygon anyway. Whether the work survived came down to whether the button
  was released before the next repeat, which is a race rather than a rule. The fix is
  `!event.repeat`, not tracking the press through its keyup: a repeat is never new intent,
  and `cancel()` is idempotent, so the two differ only for repeats of a press that already
  cancelled. **The general shape, and it is the third time in this review that a guard keyed
  on live state let a HELD key through:** a gate written against a phase answers "what is
  true now", when the question is "what was true when this press began".
- **A test asserting an ABSENCE passes in both worlds when neither world can produce the
  thing.** The carve-out case above first ended on `expect(drawn).toBeUndefined()` after two
  clicks — and two vertices cannot close a polygon whether the buffer was cleared or not, so
  it read the same `undefined` either way and pinned nothing. Caught by running it against
  the inverted gate rather than by reading it. It closes a fresh triangle and counts three
  points now: had the earlier vertices survived, the close click would be nowhere near the
  buffer's first point and would add a sixth vertex instead. **Watching a test fail proves
  it can fail; watching it fail against the OPPOSITE mistake is what proves it discriminates**
  — this one was watched red both ways.
- **A record of what the HARDWARE is doing may not be gated on a policy about what the
  software will allow.** `spaceHeld` is "the key is physically down"; the camera lock was
  allowed to skip writing it, so a space pressed DURING a tool drag or a middle-button pan
  was dropped — and no second non-repeat keydown is ever coming for a key already held. The
  user released the other gesture still holding space over a machine that thought it was up,
  and their next primary drag went to the tool instead of the camera. The refusal belongs at
  `PanOverride.pointerDown`, the one place a gesture is actually CLAIMED, where it already
  was. Same lesson as `gestureInFlight` one round earlier, reached from the opposite side:
  not "state the rule again at this door" but "notice this door was never the rule's place".
- **A docblock naming its own callers is a fact about the ROUTING, and routing is what a
  review round changes.** Three went stale in one commit's wake and none of them failed
  anything: `abandonGesture` said `pointerleave` was "the caller" after `pointercancel`
  became a second one, `cancel` still claimed `pointercancel` after that call moved away
  from it, and `EditorStore.abandonPan` listed `pointerleave` while `onPointerLeave`
  deliberately calls `endPan` and says so three lines from it — two comments contradicting
  each other about one path. The "only place X" rule in the Claims section is the same
  instrument; a caller LIST needs the same grep, in the edit that moves a call.
- **A comment promising behaviour the signature cannot deliver.** `fitViewport`'s said a
  doubly-degenerate extent "keeps its current zoom"; it answered `DEFAULT_ZOOM` — `0.1`, the
  camera a freshly opened editor starts at — and the function never received the current
  viewport at all, so it could not have done otherwise. `Shift+2` on a point-sized selection
  at 5x therefore dropped the user to a tenth. Fixed by making the code true rather than the
  sentence narrower, since the promised behaviour was the right one and the store already
  held the number: the caller passes `currentZoom`, and it takes the same `clampZoom`
  everything else there does rather than being trusted.
- **A private TypeScript field is not private at runtime, so a test can pass against nothing.**
  The first five `ToolManager.gestureInFlight` cases went green immediately — `tests/` is transpiled
  without type checking, so they were reading the private field directly and could not tell a
  getter from its absence. The field is `#private` now, which turned all five red as they
  should have been. Anywhere a test asserts that something is REACHABLE, `private` is not the
  mechanism that makes the test mean anything.

**Design slice 15 has landed: there is ONE dialog framework.** `DialogStore` holds one
descriptor and the awaiting caller's resolver; `openDialog` returns a Promise typed by the
descriptor's own `kind` through `DialogResultByKind`, and THROWS if a dialog is already open
— sequential, never stacked. `DialogHost` mounts once per ItemView-scoped Vue app (both of
them, not the editor's alone) and owns every keyboard concern, so no kind reimplements one.
Its first real caller is the calibration gesture. Rules that came out of it:

- **`presentation/dialogs/` may not import `application/`, `infrastructure/`, `plugin/` or
  the event bus** — a `forbidden('presentation/dialogs', …)` block in `eslint.config.mjs`,
  driven through real fixture paths by `tests/build/vue-rules.test.ts`. It REPEATS the bans
  the wider `presentation` block already carries, because two blocks matching one file
  override rather than merge, and a block naming only its additions would open the bigger
  hole while looking like it closed a smaller one.
- **`DialogHost` is the single caller of `store.resolve`.** The kinds emit a typed `resolve`
  event and settle nothing. Single-settle, focus restoration and the release of the
  background's `inert` all hang off that one function; a kind that settled directly would
  bypass all three and nothing would error. Nothing ENFORCES the exclusivity — `resolve` is
  a public store member — and the store's own comment says so rather than implying a
  mechanism.
- **"Modal" here means the VIEW, never the application.** The background goes `inert`
  (deliberately not `aria-hidden`: the siblings hold focusable controls, so an aria-hidden
  subtree around them is itself the `aria-hidden-focus` violation the axe check reports;
  `aria-modal="true"` tells a screen reader the same thing). But this is not an Obsidian
  `Modal`: nothing pushes a `Scope`, and `onKeydown` calls `preventDefault()` without
  `stopPropagation()`, so Obsidian's own keymap stays live behind it — a hotkey bound to
  `Escape` fires alongside the dialog's cancel, and `Ctrl+P` opens the command palette on
  top of an open dialog. jsdom models no host keymap, so no test here can see any of that;
  `docs/tests/cases/Calibrate a Plan.md` steps 17 and 18 are where it gets looked at.
- **The `Escape` listener is on the DIALOG element, not on `document`**, because two Plan
  Editor leaves may each have a dialog open and one `Escape` must close the focused one
  only. `onBeforeUnmount` releases the `inert`, because Obsidian REUSES a view and a leaf
  closed with a dialog open would otherwise reopen into a pane nothing can be clicked in.
- **A dialog opened during `pointerdown` loses its focus to the browser.** Chromium moves
  focus to `<body>` as `pointerdown`'s own default action, which runs AFTER the handler
  returns — so the dialog's focus lands first and is then thrown away, and `Escape` does
  nothing. `CalibrateTool` therefore buffers the completing click and starts its dialog from
  `pointerUp`. Found by driving a real browser; jsdom implements no focus-on-mousedown at
  all, so the suite can only assert `defaultPrevented`.
- **Obsidian's own `button:not(.clickable-icon)` outranks a single class.** It sets
  `background-color` at (0,1,1) — `:not()` contributes its argument's specificity — so
  `.rp-dialog-button-danger` at (0,1,0) lost and the destructive button rendered plain
  white. It is `.rp-dialog .rp-dialog-button-danger` now. jsdom never resolves `var()` to a
  colour, so the only instrument for this is a browser.
- **A descriptor says what it is about IN WORDS, and may not lean on what is behind it.**
  The panel is centred in its own pane and the pane is full of canvas, so the object being
  asked about is usually underneath the question — measured in the harness, a calibration
  confirmation covered the segment the user had just drawn. A content rule rather than a
  positioning one on purpose: no alignment escapes it (top covers the zone captions, bottom
  the status bar, right still crosses a third of the canvas), so moving the panel only
  relocates what it hides. `KnownDistanceForm` printing the measured distance is what
  compliance looks like; slice 10's delete flow is where it will matter most.
- **A user-facing string in a dialog is resolved by the CALLER**, never by the dialog:
  `title`, `message`, `entityLabel` and every `ReferenceRow.label` arrive already through
  `t()`. Only the two label DEFAULTS are resolved inside the framework, from `StringKey`s —
  `confirmLabel ?? 'Confirm'` would have been the one untranslated string every confirmation
  in the plugin flowed through. Neither half is caught by lint: `I18N_LITERAL_BAN` fires at
  four call sites and a descriptor's `title:` is none of them, so both rest on review.
  What IS checked is that `de.ts` translates every key `en.ts` declares
  (`tests/presentation/i18n/strings.test.ts`) — the type permits the gap on purpose, so an
  incomplete locale is safe, and the fallback then hides a forgotten key from everyone but
  the user reading it. That same file now also pins two German TERMS, which is a different
  mechanism from completeness and covers two words rather than the language; the slice 14
  section above says exactly what it reaches.
- **A new dialog kind is FIVE edits, four of them build failures — measured, not asserted.**
  Adding one and reading `vue-tsc` reports twice at `DialogResultByKind` and once at
  `DialogHost`'s last branch, with `cancelResultFor`'s `TS2366` appearing as soon as the
  result-type entry exists. Only the component file is something the compiler cannot make
  you write. The one hole: `DialogHost`'s check is `FormDialog`'s declared prop type, so it
  is STRUCTURAL — a fifth descriptor carrying a `title` and a `component` would satisfy
  `FormDescriptor` and render as a form rather than fail.
- **`DeleteReferenceDialog` and `EntityPickerDialog` have a caller now** — slice 10's
  `presentation/editor/deleteZoneFlow.ts`, reached from the Inspector's Delete button. They
  shipped with none for two slices, which was the plan rather than dead code: the queries
  feeding their rows and the command fields carrying their answer were slice 10's to define,
  and declaring them in slice 15 would have been a second derivation of contracts it owns.
  **Two of slice 15's items are still open, and the caller did not close them**, because the
  shared-catalogue amendment rewrote them after that flow was built:
  `ListRequirementsReferencing` returns a flat `RequirementId[]`, not the per-project GROUPS
  carrying `projectName` and `projectPath` that item 6 now asks for; and item 6a's
  `t(language, key, params?)` does not exist — `src/presentation/i18n/strings.ts` still
  declares two parameters, and every string `en.ts` holds is fixed text. The two land
  together, because the first interpolated string in the plugin is the row label item 6
  names.
- **A tool's transient visual goes in `RenderState`, and it needs its own field when it
  means its own thing.** The calibration segment is `measurement`, not a two-point
  `previewPolygon`: a polygon preview renders dashed and closed and says "you are drawing a
  zone", while a measurement renders as a tape measure — solid and open, a perpendicular bar
  capping each end, ticks along its length (`layers/rulerGeometry.ts`, screen-spaced and
  deliberately unlabelled, since the plan whose scale is being established has none yet).
  `pointerMove` had been an empty method under a comment deferring the preview "until a
  rendering seam exists", and that seam had existed since slice 8 — so the gesture drew
  nothing at all, and an empty method has no behaviour for any test to disagree with. Found
  by a human calibrating a plan.

  **The same field rule then took a third field, `polygonSketch`, for the same reason.** The
  drawing tool had been packing its placed vertices and its live pointer into one
  `previewPolygon` array, so the layer could not tell a click that had LANDED from where the
  mouse happened to be — and drew a circle for neither. It carries `vertices`, `cursor` and
  `closeArmed` separately now: every placed vertex is a circle, the first one is drawn larger
  because clicking it is what CLOSES the shape, and it grows again while a click there really
  would. Reusing `previewPolygon` would also have redrawn a THIRD tool's picture: `SelectTool`
  writes the same field with the translated ghost of a dragged zone. Also found by a human,
  drawing one.

  **"Is the target armed" is asked per render and never stored, and the first version got
  that wrong.** It was a third field on the sketch, written by the tool at each
  `pointermove` — which is one input short: the answer depends on the CAMERA too, and wheel
  and keyboard zoom stay live while a drawing tool is active. So a zoom under a stationary
  pointer slid the vertex out of reach while the mark went on promising a close, and the
  click then placed a vertex. `closeTarget.ts`'s `closesPolygon` is a predicate both callers
  ask instead — the tool for the click, the layer inside a `computed` that reads the viewport
  — stated in SCREEN pixels, which is what lets them share one rule at all: the tool projects
  its world click through the camera it holds, and the layer asks it of projections it has
  already made. `handleMetrics.ts` holds the three drawn radii beside the distance that arms
  them. Caught by a review bot on the pull request, not by any gate here — and the fix is
  that the stale state became UNREPRESENTABLE rather than merely refreshed on one more event.

  **That fix was half of one, and the same bot said so on the next round.** Deriving the mark
  from the current camera is right, but the CURSOR it derives from is a world point captured
  at the last `pointermove` — and a camera change moves which world point the pointer is over.
  A wheel zoom anchors at the pointer, so that point is invariant and the derivation held; the
  keyboard's `+`/`-` anchor at the stage CENTRE, and there it drifts. Measured, not argued: a
  target five pixels from the pointer went on promising a close with the vertex forty-three
  pixels away. So `PlanCanvas.reissuePointerMove` tells the active tool where the pointer is
  after ANY camera change — a synthetic event whose every field is a true statement, and the
  one the next real move would carry anyway. It is issued on the wheel path too, where it is a
  no-op, because "any camera change re-issues the move" holds for camera paths not yet
  written while "the ones that need it" is a list that goes stale. It fixes the calibration
  rubber band's identical drift in the same stroke, which is what makes the canvas the right
  home for it rather than either tool. **The general shape, and this repository has now paid
  for it twice in one change: a value derived from two inputs goes stale when EITHER moves,
  and fixing the input you were thinking about leaves a defect that looks fixed.**

  **A third instance was still standing in the same file when the review pass came back, and it
  is the one that says why "re-issue on every camera change" is the weaker half of the remedy.**
  `EditorStore.pointerWorld` was the status bar's coordinate readout, ASSIGNED in `setPointer`
  from the viewport of the moment — the identical two-input value, one file away, and
  `reissuePointerMove` could not have saved it either way: that function returns early when no
  tool is active, which is camera mode, where the keyboard zoom is still live. Both camera paths
  were wrong and the worse one was not the zoom. A pan is DEFINED by holding one world point
  under the cursor, and `onPointerMove` calls `setPointer` BEFORE `continuePan`, so the readout
  was recomputed from the pre-pan camera on every move: measured, the one number that should not
  have moved at all drifted from -80 to 920 over a single drag. `pointerWorld` is a `computed`
  over the stored SCREEN point now — the half a camera change leaves alone — so no camera path,
  written or unwritten, has to remember to refresh it. **Prefer making the staleness
  unrepresentable to refreshing it on one more event; a re-issue is a list of the paths somebody
  thought of, and this file has now been wrong about that list three times.** No gate here can
  see any of it, which is why `docs/tests/cases/Editor Walkthrough.md` step 6a exists: jsdom is
  perfectly capable of holding the arithmetic, and it was two node tests that finally caught it —
  the point is that nobody had written them, because the value LOOKED derived.

**Design slice 10 has landed: the loop closes.** `Zone Geometry -> Area -> Requirement ->
Cost` runs end to end. `Asset` and `Requirement` follow slice 3's module pattern; the
Inspector grew a Requirements panel (`RequirementRow.vue` per row) whose assign control and
two override fields all dispatch through `InspectorStore.commit` like every other edit; and
the Delete button finally has the reference decision slice 15 built two dialogs for.
Rules that came out of it:

- **The read informs and the command enforces, and they are allowed to disagree.**
  `deleteZoneFlow.ts` reads the referents BEFORE the dialog, so its answer is stale by
  construction. A zero count therefore dispatches the ABSENT-resolution form rather than a
  `delete-anyway` the user was never offered: a refusal is recoverable by asking, while
  consent is exactly what the command's re-check cannot argue with. A resolution travels
  with `resolvedReferents` — the exact ids the dialog's row was built from — so the command
  compares SETS, and `reference.set-changed` is re-asked exactly ONCE. Every one of those is
  asserted on the COMMAND INPUT, because "a dialog opened" is equally true of a caller that
  sent `delete-anyway` straight through.
- **An undo is the same compensated sequence run backwards**, so it is written down once
  (`application/reference/undoDeleteResolution.ts`) rather than derived a second time.
  Entity first, then the Requirements in the exact reverse of the order the resolution wrote
  them; every write hands back its OWN inverse, taken from what `getById` actually found
  before it; both lock levels held through the rollback. Slice 8's `ReversibleDeleteZone`
  header predicted this widening and now carries it.
- **A lock only excludes participants that take it.** The delete resolution took level-2
  locks over every Requirement it writes, and the override commands took none — so a legal
  override landing between the forward write and the compensation was silently lost.
  Both override commands acquire the level-2 lock now. `RecalculateRequirementCommand`
  deliberately still does not, and the reason is in its sibling's header: the resolution
  calls it inline while holding that very lock.
- **A recording event bus is a fake with no cascade in it.** `tests/helpers/planEditorRig.ts`
  used `RecordingEventBus`, whose `subscribe` discards its handler — so every
  geometry-driven figure in the editor's own e2e rig was as stale as the day it was written
  and no assertion could see it. It dispatches now and registers the same two handlers the
  composition root does.
- **A background failure that nobody is awaiting reaches nobody unless it is announced.**
  `CascadeDeps.notify` was built, tested and passed by nothing, so a failed stale marker was
  logged into the void — and that marker is precisely what lets a later reader see a wrong
  figure as wrong. The composition root passes it now;
  `tests/plugin/slice10CascadeWiring.test.ts` is what can tell a composition that wires it
  from one that does not.
- **`assetName` is nullable so the row can be BUILT.** A Requirement whose Asset was deleted
  renders from its id plus the reason; typed `string`, the query would have had to fail or
  drop the row, and the stale warning would be unreachable for exactly the rows that need
  it. The Zone-side half has no surface at all in this slice, and the task document says so
  rather than implying one.
- **Three decimals, not two, is what catches a YAML float.** `594.005` is not representable
  in binary floating point; `594.00` and `99.99` survive a coercion that would destroy it.
  The check lives in the shared repository contract, so both implementations take it.

**Design slice 7 has landed: `CalibrateTool` is the first concrete `EditorTool`, and since
slice 15 a user can actually reach it.** `registerEditorTools` registers `calibrate` beside
`select` and `draw-polygon`, the toolbar names it, and the composition root hands the editor
a `calibratePlan` factory; the two prompts the tool declares are a `ConfirmDialog` and a
`FormDialog` (`KnownDistanceForm`). For two whole slices this paragraph instead recorded that
it was unreachable — proven by tests, wired to nothing, no user able to calibrate a plan,
every area the Inspector printed being background pixels relabelled as millimetres at the
placeholder scale of 1. That is the shape to remember rather than the fact: a tool absent
from a registration list is invisible to all four gates, because nothing is wrong with the
code. It took a human opening the toolbar. Two rules came out of its review pass and both
are load-bearing:

- **A `Calibration`'s two points are in the plan's CURRENT world units**, not the
  background's pixel space. The two coincide only while the plan is uncalibrated and its
  placeholder scale is `1`, which is why every comment that said "pixel space" read as
  correct until the first recalibration. A calibration AT REST also measures its own
  `knownDistance`: the command multiplies every world-unit coordinate for the plan by
  `scaleCorrection`, its own pair included.
- **The geometry sidecar owns `calibration`, and `PlanGeometrySidecar` is its only
  writer.** `ObsidianPlanRepository` owns the sidecar's LIFECYCLE and none of its content;
  `Plan.calibration` is read-only through it, merged in by `getById`. It used to sync the
  field on every note save, and that was a lost update no gate could see — calibration is
  not in the note, so a calibration landing in the sidecar never moved the note's revision
  and an entity read before one still passed `checkExpectedVersion` afterwards. Slice 3's
  plain `CalibratePlanCommand`, `Plan.calibrate` and `createCalibration` were deleted in
  the same pass: they were a second derivation answering differently, and `docs/tasks/07`
  claimed a supersession the first pass never performed.

**Design slice 18 has landed: a project owns its folder.** ADR-0013 derives a project's folder
from where its `Project.md` sits rather than storing one: nothing goes stale, and a user who
drags the folder in Obsidian's file explorer has moved the project, which is ADR-011's
sidecar-folder argument turned to a second use. `entityRefOf` is now the one answer to "is this
note ours" (`type` plus a non-empty `id`), with exactly two callers — the Project Index's full
scan and `VaultChangeAdapter`'s incremental one — so the two cannot disagree about a note the
way two hand-spelled copies of the same test could; `entityRef.test.ts` measures that caller
list by reading `src/` rather than asserting it. `NoteVaultDeps.projectFolder` is gone; the
five repositories that cached it in a constructor now resolve each INSERT's folder from the
entity being saved, through `projectFolderOf(index, projectId)`, and refuse with a
`PersistenceError` rather than default when that resolves to nothing — an UPDATE writes where
the note already sits and resolves no folder at all, which is why the refusal guards inserts
alone and why `markStale` resolves nothing. `freshProjectFolder` gives
a newly-created project its own folder under the plugin's configurable default root, deduped by
id on a name collision. Four rules came out of it, the last two from the review that followed:

- **A prefix bound cannot see a second root, and a bound that reads the note can.** The index
  used to filter by path before ever looking at a note's frontmatter; the frontmatter was
  already the thing making the result correct; the prefix was only a fast path over a question
  the next call answered properly anyway. Removing it is what closes slice 4's own recorded
  prerequisite — a library outside the scanned folder invisible to both the scan and the
  vault-change pipeline — and it closes it without registering anything: there is no root list,
  because every note this plugin owns already declares enough to be found anywhere in the vault.
  Slice 4 handed that consequence to whoever next touched the pipeline; this is that slice.
- **`npm run analyze` catches an unimported FILE, not a dead export a test still calls.** An
  earlier draft of this slice's own plan asserted the opposite — "a pure export with no `src/`
  caller fails `npm run analyze`" — and a reviewer measured it false before it shipped, and then
  measured the FIRST correction's own number false too: `npm run analyze` reports "235 entry
  points detected (203 plugin, 14 dynamically loaded, 13 manual entry, 5 package.json)", and 235
  is the TOTAL, not a count of test files. `fallow list --entry-points --format json` is what
  breaks the 203 "plugin" figure open: 200 of them come from fallow's own vitest plugin, which
  seeds this repository's 198 `*.test.ts` files plus `vitest.config.ts` and the aliased
  `obsidian` mock module as always-used. Whichever figure is read, the mechanism is the same: an
  export with only a test caller (`projectFolderOf`, briefly, at the end of one task) stayed
  invisible to the gate the whole time. What actually fails is a new file nothing imports at
  all, reported as an unused FILE — a different rule from the dead-export one. `foldersOverlap`
  still ships in slice 19 rather than here, and that call is still right: the predicate has no
  job in this slice — there is no command that changes a project's folder under the derived
  shape, and no library to overlap with until slice 19 exists — but the reason is that it has
  nothing to do, not that a gate would have refused it for having no caller.
- **Widening DISCOVERY and leaving EXISTENCE alone is half a slice.** A note is found by what
  it declares now, but every save still established existence by scanning
  `<projectFolder>/<Kind>/` — so a note the user had filed anywhere else was read, indexed and
  deletable and could never be saved again: the scan missed it, `currentVersion` came back
  `undefined`, and `checkExpectedVersion` answered a permanent `<kind>.revision-conflict`, with
  `markStale` answering `requirement.mark-stale-failed` on a note it had just read successfully.
  Every save resolves through the index now — the same lookup `getById` and `delete` already
  took — and `findNoteIdInFolder` is deleted for want of callers. The general shape: when a
  slice changes how a thing is FOUND, every question of the form "does this already exist" is
  the same change, and the compile errors do not point at the ones that were already using a
  different mechanism.
- **One rule with two doors is two rules unless one function holds it.** The sidecar join lost
  its folder prefix at BOTH ends, and only the full scan got a diagnostic; the incremental door
  went on repointing a plan's mapping onto any arriving `.rpgeo` with a matching basename, which
  is where a copied project folder sent the live plan's geometry writes. `sidecarMappingFor` is
  the one answer both take now: the DERIVED path wins — or the path the mapping already held,
  when nothing derives one (a plan declaring no project, or one whose project note is not
  indexed) — a genuine pair is reported in either
  order under a per-door event name, and a sidecar re-affirming its own mapping is not reported
  at all. "Both doors" is a category claim, so it is MEASURED rather than asserted: the second
  `it` in `tests/infrastructure/persistence/index/entityRef.test.ts` pins its two callers the
  same way that file pins `entityRefOf`'s, and a `processSidecar` that goes back to
  adjudicating for itself drops the list to one and fails there.
  Reporting and adjudication are separate steps in it for a reason worth keeping: the
  first draft returned early when the arriving file was the derived one, which silenced the copy
  in exactly one of the two scan orders.

Three more things this slice measured rather than assumed, because each is this repository's
own recurring shape:

- **A fake too THIN, the sixth instance of the rule** (the Testing section below numbers five
  already, ending at "Fifth instance, and the THIRD face of the rule"). `FakeVault.getAbstractFileByPath`
  answered `null` for every folder, where Obsidian answers a `TFolder`; `freshProjectFolder`'s
  collision arm could not be driven at all until the fake was widened to tell the two apart.
  Its blast radius was 0 tests — nothing had shipped yet to be wrong — which is worth recording
  beside the 86-test and 65-test instances below (roughly 540 lines down, in that same Testing
  section) for the same reason those two are recorded: the number is not the point, the shape
  is.
- **A test can pass on the wrong refusal.** Converting the repositories moved the folder check
  ahead of other guards, and several tests named for a different path — a compensation, a
  conflict — started passing on a folder refusal instead, green for the wrong reason. Task 6
  found two by hand; task 7's sweep found fifty across four files, two of which no task had
  named before it. Green is not evidence of the behaviour the test's name claims.
- **A test name that outruns its assertions hides a real defect.** The no-migration test's name
  said "reads and writes"; its body asserted only the write half. Adding the read assertion it
  had always claimed to make immediately caught a fixture whose frontmatter was missing the
  schema-required `status` field — a test that had been passing on a project the schema would
  have refused to load. The review that followed found four more of the same shape — seven
  `it` blocks, because one of the four is a group of four — and they are NAMED here rather
  than counted, since a bare number over a set that groups two ways is the defect this file
  exists to refuse. TWO of the four were measured rather than argued, by wiring the regression
  and running it:

  - a pipeline case named for the folder bound this slice DELETED compared an empty index
    against an empty index, and stayed GREEN under a `processPath` that wiped every entry the
    index held;
  - the four `perProjectFolders` save cases — one per kind — asserted an in-memory
    `revision === 2` and an index path they had just upserted, and all four stayed green
    against a `writeOwnedFrontmatter` made a silent no-op: the revision is computed before the
    write and the repository upserts either way, so nothing in them read the vault's bytes
    back. The stronger of the two measurements, four green tests over a write that did nothing;
  - a scan case whose name claimed a location bound while its green came from the missing-`id`
    rule, its `.rpgeo` fixture asserted by nothing at all;
  - and a case whose name promised a diagnostic — 'a note of ours without a readable id is
    excluded with a diagnostic' — and asserted none.

  A no-op assertion and a correct one look identical until something is broken underneath them.

**Design slice 13 has landed: there is ONE notice door and ONE save-state indicator.**
`createNoticeQueue` is a plain module-level queue over an injected `NoticeHost` port — dedup
on the `(severity, message)` pair into a `(×N)` suffix, a three-slot visible cap with
promotion into a freed slot, per-severity auto-dismiss, and hover/focus pause — and
`notify.ts` is the only module that binds that port to Obsidian's own `Notice`, which is what
keeps "one notice door" a fact about the import graph rather than a sentence —
`grep -rn "new Notice" src/` prints THREE lines: the constructor call in `notify.ts`, a
comment in `notify.ts` quoting it, and a comment in `queue.ts` naming the binding. One
construction site, three mentions. An earlier draft of this sentence said "two lines, both in
`notify.ts`", which was written from memory ten commits after `queue.ts` gained its line —
this file's own "a docblock that says 'the only place X' gets a `grep` in the SAME edit",
broken in the file that states it. `NOTICE_TEXT_BAN` also watches the constructor and not only the wrappers, so
bypassing them is not an escape from the TEXT rule either. Four severities
with a translated label beside the colour (`AUTO_DISMISS_MS`: 4000 for `success`, 6000 for
`info`, `null` for `warning` and `error`, so the two that exist to be noticed cannot expire).
`activateNotices()` runs once from `onload` and `disposeNotices` is one more entry on the
`disposers` list Konva's global got to first. **`onload` therefore touches the DOM now** — it
appends the two live regions with Obsidian's `createDiv` — which the app installs globally and
this suite installs per jsdom file, so five existing test files that load the plugin or mount
the real editor gained an `installObsidianDom()` call they had never needed. Worth knowing
before the next thing `onload` reaches for: the opt-in DOM helper is a per-file decision, and a
production module acquiring a DOM dependency at load turns that decision into a sweep. On the other half, `SaveStateStore` is one per
Plan Editor — `CommandHistory` is per-Plan, so the save state it produces is a fact about
that Plan — and `withSaveStateTracking` wraps `run`, `undo` and `redo` inside
`wrapDispatcher` and outside the refresh decorator, so `Saved` never appears while the canvas
still shows the pre-command state. **The plugin-global Vue app SDD §12 would have needed an
exception for was never built**: `Notice` is a container that hands back a `containerEl` and a
`messageEl`, so severity, dedup and a dismiss control are markup and policy inside it, and the
only thing it owns that this slice needed differently is the timer. The rules that came out of
it:

- **`duration: 0` is load-bearing, not incidental.** Obsidian's own timer is internal and
  cannot be paused, so a design that let Obsidian time the notice could not implement the
  accessibility rule that a timed message must not vanish while somebody is reading it or
  tabbing to its dismiss control. Owning the timer is what buys hover-pause and the promotion
  of a held notice into a freed slot. Hover and focus are two conditions and one `held` flag
  that is their OR: passing `pause`/`resume` straight to the four listeners let `pointerleave`
  resume a timer while the dismiss button still had focus.
- **A severity door added without widening `NOTICE_DOOR` is a door no gate can see**, and
  that is why the four doors are bare functions rather than `notify.success(...)`. The rule
  matches on `callee.name`, which a member-expression callee does not have, so every call
  site in that spelling would have been invisible to the one rule keeping a raw
  `Error.message` and bare English literals out of a notice. `notifySuccess` and
  `notifyWarning` are named in `NOTICE_DOOR` now, driven through real fixture paths in
  `tests/build/notice-text-boundary.test.ts` — blind spots included, and through BOTH blocks
  that carry the rule.
- **`handle.live` rather than a dismissal callback is the authority on a free slot.**
  Obsidian dismisses a notice when the user clicks it and does not tell us; the typings expose
  no callback either way. A queue counting only its own dismissals leaks one slot per user
  dismissal until it can never show anything again — a failure that arrives slowly, in a real
  vault, and in no test. Reading `isConnected` means a dismissal by any mechanism frees the
  slot, and a changed gesture in a future Obsidian degrades to "the slot frees on the next
  push" rather than to a wedged queue. That fallback is what the AUTHORITY is; the two
  gestures this host can actually see latch instead — see the two-gestures bullet below.
- **A module-scope timer alias escapes `vi.useFakeTimers()`.** `const scheduleTimeout =
  setTimeout` captures the function at module-evaluation time, before any `beforeEach`
  installs fakes — measured, not reasoned: `vi.getTimerCount()` answered 0 and a handle stayed
  live after 60s of advanced fake time, while a bare `setTimeout` control in the same file
  registered and fired. A default parameter is evaluated at CALL time, which fixes it. **And
  the six tests over that queue were green throughout**, because every push in them used a
  severity whose `AUTO_DISMISS_MS` is `null`, so no timer was ever armed — a
  `beforeEach(vi.useFakeTimers())` that controlled nothing and read as timer coverage.
- **A test named "exhaustive" that constructs its subject outside the walk is a sample.** The
  transition test hoisted `const store` above the recursion, so 340 invocations arrived as one
  continuous stream rather than as 340 sequences from the initial state: only 10 of 12
  (state, action) pairs were ever visited and `pendingCount` ran to -170. The proof that it
  was a sample, rather than an argument that it might be: a store whose `resolveOk` literally
  assigned the forbidden `'unsaved-changes'` through a public action passed all 13 of its
  tests. Repaired, it visits 12/12 with `pendingCount` bounded -4..4.
- **100% branch coverage and a surviving mutation in the same file.** Making `beginSaving`'s
  batch-open guard unconditional left all 13 tests green at 100% branches and shipped a
  permanently stuck indicator: two concurrent Inspector commits both refused for validation
  would capture `beforeBatch = 'saving'`, and the indicator rests there until some later
  dispatch happens to resolve it. Coverage says a line ran, never that anything would notice
  it running differently.
- **Only a write that actually succeeded may clear a save error**, which is why
  `SaveStateStore` settles three ways and not two. A validation refusal reaches no repository,
  so settling it as `saved` would let a refused field edit clear a `save-error` left by a real
  persistence failure and tell the user unsaved data is safe. `resolveNeutral` reverts to
  whatever the indicator read before the batch opened. And `'Validation'` is not a synonym for
  "wrote nothing": `versioning.ts` raises `revisionConflict` and `externalModification` as
  `ValidationError`s and both mean the command reached the repository and the edit was
  refused, so `affectsSaveState` carves them back out from `WRITE_BOUNDARY_CODES` — the one
  place those two codes are spelled — rather than from a second copy.
- **"Pre-write" is a MEASUREMENT, and the first version of `affectsSaveState` measured
  nothing.** It read `error.category !== 'Validation'` under a docblock asserting that a field
  commit failing a domain rule resolves a `ValidationError`. `grep -rn "'Domain'" src/` prints
  nine lines outside that file, seven of them raise sites, and every one is PRE-write:
  `SetRequirementQuantityOverride` refuses a negative quantity as `Domain` and re-wraps the
  entity's own `Validation` errors as `Domain` too, all of it before `requirements.save`. The
  Inspector's override fields are `type="text"`, so `-5` was one keystroke from a persistent
  "Save error" badge about data nothing had touched — the exact failure the predicate exists to
  prevent, shipped by the predicate. **It then measured wrong twice more, and the pattern is
  the useful part:** each pass grepped for the category it had already decided to add. The
  second looked for `'Domain'`, so `Reference` — nineteen raise sites over fourteen codes, the
  category the delete flow and both reversible adapters refuse through, every one a referent
  lookup that came back empty — was never looked at; confirming a delete dialog whose referent
  set had moved raised `reference.set-changed`, whose developer message reads "nothing was
  written", and left the sticky badge behind it. The third enumerated `Reference` exhaustively
  and left `Calculation` out on the strength of one sentence in `calculationError`'s own
  docblock — "raised on the path where the stale marker has already been persisted" — which
  describes its CALLER's state, not a write by the command raising it; all twenty-two of its
  raise sites are a derivation refusing its own inputs, and calibrating with two clicks at the
  same point left the same badge. **A grep written to confirm a widening already decided on
  measures that widening and nothing else**, which is a sharper version of this file's own
  "measure a set with an instrument that can see all of it" — and that rule was broken again
  while measuring the last one, since `grep -rhoE "calculationError\(\s*'[^']*'"` misses the
  two calls written with the code on the following line. The pre-write set is `Validation`,
  `Domain`, `Reference` and `Calculation` now — half the vocabulary, enumerated one category
  at a time in the docblock with their raise sites, with the write-boundary carve-out applied
  to all four. **And then a fourth measurement, which is the one that matters, because it
  found the exposure the previous three had each declared absent.** The widening
  UNDER-reports any of the four raised after a successful write — the unsafe direction — and
  three drafts running said "the sweeps found no such site", the last of them naming
  `deleteResolution.ts` as where one was likeliest to appear and then arguing it away with
  "today every `Reference` refusal in it is inside `prepare`". The sweep had stopped one
  function short of `requirementResolutionSteps`, which is in that same file and is the half
  that WRITES: `markStalePersisted` calls `requirements.markStale` and then re-reads through
  `loadRequirement`, which raises `requirement.not-found` — a `Reference` code, strictly
  post-write, no loop needed — and `repointAndMarkStale` can refuse for any referent after
  `applyAll`'s earlier iterations have already saved. So a delete resolution over three
  referents that writes two and refuses the third settled the indicator at `Saved` over a
  half-written vault, and a FAILING compensation is only logged. **The general shape, and it
  is the fourth instance in one predicate: a sweep that stops at a FILE stops wherever the
  reader's attention did — "every refusal in `deleteResolution.ts` is in `prepare`" was
  measured over the function somebody was looking at, not over the file the sentence names.**
  It was written down rather than patched for one round, on the grounds that both candidate
  fixes traded this false silence for a false badge or for copy belonging to slice 17 —
  carving `requirement.not-found` out by CODE would badge an override of a Requirement
  somebody else deleted, and re-labelling the CATEGORY moves the sentence `toUserMessage`
  resolves. **A review bot then proposed the third fix, which is the one the docblock had
  already predicted and never evaluated: have the code that WROTE report it.** `compensate`
  stamps its returned refusal with `markUncompensated` when a restore refuses, and
  `markStalePersisted` stamps its own re-read refusal — the write that no `progress` entry
  holds, because `applyAll` appends only after the step returns, so the loop-level stamp alone
  would have closed the multi-referent case and left the single-call one open. `leftWritesBehind`
  is the FIRST question `affectsSaveState` asks. It costs neither rejected price: no code is
  carved out, and `category`, `code` and `message` are untouched, so slice 17's territory is
  untouched with them. **A compensation that SUCCEEDS is deliberately not stamped** — the vault
  is back at its pre-state and neutral is the true answer, which is the assertion that stops
  this from being an unconditional badge. What it does NOT do is close the class: a post-write
  refusal in a pre-write category anywhere else is still under-reported, and neither linter nor
  the suite can see one, because **the category axis cannot see a write** — which is why the
  general fix is still the sibling bullet's, a command reporting on BOTH channels.
  `DispatchOutcome` does it for successes and this stamp for the failures that were measured;
  the rest is unbuilt and the docblock says so.
- **`isErr(x) || x.value === null` is two answers in one branch, and the branch can only give
  one.** `redoCreate` re-checks both endpoints before writing, and each check collapsed a
  failed READ into the same `Reference` refusal an ABSENT referent gets — message included,
  so a vault that could not be read told the user "the zone is gone", which is slice 11's own
  recorded defect appearing in a second place. The save-state consequence is what a review bot
  actually caught: `affectsSaveState` classes `Reference` as pre-write, so a vault I/O fault
  during a redo settled the indicator back to `Saved` — **`Persistence`'s safe default bypassed
  by a relabel rather than by anyone deciding**, which is the failure mode that predicate's own
  docblock names when it says the deeper fix is at the raise sites. `AdapterErrors` already
  admitted `RepositoryError`, so surfacing the read's own error widened nothing. **The report
  named one site and a sweep for the SHAPE found three**, which is the part worth keeping: the
  two in `redoCreate` escape to a caller, and `onAssetUpdated` holds a third that escapes to
  nobody — its fallback is conservative and correct for both causes, so its whole cost was the
  diagnosis, one event name asserting the asset was deleted and no cause logged for the arm
  that had one. Split too, because "I fixed the case in the report" is not "I fixed the class",
  and a partial fix reads exactly like a complete one. The fourth match,
  `inspector-store.ts`'s collapse into `{ kind: 'empty' }`, is the already-recorded
  `InspectorDto` limitation and is left alone.
- **The indicator's subject is the GESTURE's write, and a background cascade failing is not
  that — now pinned rather than implicit.** Moving a zone publishes `ZoneGeometryChanged`, and
  `MoveSpatialObjectCommand` AWAITS the publication, so slice 10's recalculation cascade runs
  inside the dispatch the indicator is timing. A review bot read that as a hole: the stale
  marker fails to persist, the command still succeeds, the indicator says `Saved`. The
  behaviour is right and the remedy proposed for it was not — the zone's geometry IS in the
  vault at a new revision, `save-error` is STICKY, and flipping it would leave a permanent
  badge over correct data, which is the false badge four measurements of `affectsSaveState`
  went to avoid. The cascade failure already has its own channel: `notify.staleMarkerFailed`,
  which `composition-root.ts` binds to a `notifyWarning` that never auto-dismisses. **What was
  genuinely missing is that NOTHING said any of this** — no test, no comment, three modules
  each holding a third of the decision. `cascadeSaveStateBoundary.test.ts` asserts both halves
  TOGETHER, and the pairing is the point: "the indicator stays `saved`" is equally true of a
  build where the failure reaches nobody, which is the reading under which the bot would have
  been right. Its own contrast case then caught the first draft of itself — a move against a
  missing zone refuses with `zone.zone-not-found`, a `Reference` code that is genuinely
  pre-write, so the indicator correctly stayed `saved` and the case failed. A contrast case
  for a write has to refuse at the WRITE.
- **A word is not a colour, and satisfying the rule that says so is not satisfying the
  contract.** `SaveStateIndicator` shipped the translated word with a colour on two of four
  states, under a docblock citing SDD §85's "status not colour-only" — which it met, since a
  word is not a colour. `docs/components/Save-state indicator.md` is stricter and says why:
  "A mark and a word. Both, always, never one", because "the temptation to ship a coloured dot
  is strongest [here], as the dot works perfectly for the author who built it". The word alone
  is that same trade made in the other direction. Found by a review bot against the component
  spec, and this slice's own task document had ALREADY recorded it as a gap and predicted the
  fix — "a CSS-drawn glyph would discharge both contracts without introducing `setIcon`" — so
  the check that was missing was not an insight, it was anything at all that reads a component
  contract. Two things the prediction did not name and the work needed. **A specimen**: the
  component reads its store, so a standalone harness mount rests at `saved` and photographs
  ONE of the four marks — `src/prototypes/SaveStateMarks.vue` exists to draw all four, and is
  the only place `unsaved-changes` is rendered anywhere, being unreachable through the store.
  And **a selector test**: jsdom resolves no CSS, so a state whose rule is one word off renders
  the base mark with every test green — which already cost this file one defect
  (`rp-save-state-error` against a template emitting `rp-save-state-save-error`) under a comment
  saying nothing here could catch it. The test now BUILDS `.rp-save-state-${state}` from the
  same expression the template interpolates and asserts the stylesheet declares it. The
  distinctness of the four marks is still a claim only an eye settles, which is what the
  capture is for — and reading it produced the residual now written beside the CSS: held still
  under reduced motion, the saving arc and the unsaved-changes ring differ by one gap.
- **A slot released by INFERENCE is a slot released on an assumption about Obsidian, and there
  are TWO gestures that know, not one.** The dismiss button called `notice.hide()` and then
  swept, and the sweep asks `isConnected` — still true for as long as an animated `Notice`
  takes to detach, if it detaches after its transition rather than inside `hide()`. This
  repository's fake detaches synchronously, so no test here could ever see it. Slice 13 latched
  the `×` and left Obsidian's own click-to-dismiss inferring, on the reasoning that the
  fallback covers it. It does, for the SLOT. It does not for the DEDUP: `push` sweeps and then
  looks for an identical entry, so a repeat of the message the user had just clicked away found
  the dying entry, bumped a count nobody would ever see, and opened nothing — the message lost
  outright rather than deferred, which is worse than the held slot the sweep was written to
  survive. Both listeners latch now, on the fact this module had always asserted in prose: a
  clicked notice is a dismissed notice. `isConnected` stays the authority for a dismissal
  NEITHER listener sees, which is the mechanism's point and the only residue still bound to
  hide timing. The general shape worth keeping: a fallback that covers one consequence of an
  unobserved event is not evidence that it covers the others. The fake's "what is NOT modelled"
  list carries hide timing, as an assumption rather than as a testability requirement.
- **Every per-notice concern is keyed on `messageEl`, and that started life as a remedy
  recorded and deliberately NOT taken.** Slice 13 shipped the severity class, the four hover
  listeners and the `isConnected` read on `containerEl`, whose identity `obsidian.d.ts` states
  neither way, with the `messageEl` move written into step 3 of the manual case as the fix if
  that step ever answered unfavourably. A review pass took it instead, and the argument for
  moving early is the ASYMMETRY rather than the probability: `messageEl` is per-notice under
  BOTH readings — this module already proves it, clearing that element and appending this
  notice's own children into it — so taking the move costs a hover target (Obsidian's own
  padding no longer pauses the timer or prompts a sweep) while leaving it un-taken risks a
  queue permanently wedged at three notices for the session, in a vault, on a question no gate
  here can settle. A cheap remedy against an unsettleable question is not worth deferring to
  the answer. Step 3 still asks it; what it decides now is whether that padding can be won
  back, not whether the host works.
- **The surface with the most new ARIA in this slice is the one surface no axe scan reaches.**
  `tests/harness/accessibility.test.ts` scans `contentEl`; a `Notice` renders on
  `document.body` under `.notice-container`, and the two live regions this plugin appends go
  on `document.body` directly — outside a view twice over. So the `role`/`aria-live` pair on
  each of those regions and the dismiss control's accessible name are asserted one attribute
  at a time by jsdom and graded by no accessibility instrument at all. `docs/components/Toast.md` predicted exactly
  this in its own Open question 1 before the decision was taken, and now records it as the
  settled price of using `Notice` — that file's Open question 1 is answered in writing there
  rather than left standing against code that had already decided it. Widening the scan is not
  the fix: whole-document scope pulls in the landmark rules that test's header records as out
  of reach.
- **`ok` is not evidence that anything was WRITTEN, and the whole save indicator rested on
  reading it that way.** `UndoableCommand` resolved `Result<void, AppError>` under a docblock
  arguing that `CommandHistory` "only ever needs to know whether a write succeeded, not what
  it returned" — true of the two stacks, which is all that existed when it was written, and
  false of an indicator whose subject is whether this Plan's data is safely written.
  `SaveStateStore` states the rule categorically ("only a write that actually succeeded may
  clear a save error") and `withSaveStateTracking` broke it by inferring one from the other.
  FOUR dispatch paths succeed having written nothing: `ReversibleAssignAssetCommand.execute`
  when the asset is already linked (`AssignAssetCommand` answers `ok({ created: false })` from
  a read), that adapter's `undo` when its outcome was `'found'`, and `CommandHistory`'s own
  undo and redo on an empty stack. Each cleared a `save-error` raised by a real persistence
  failure; the first is one click in the Inspector. **There is no safe default for that
  inference in either direction** — every `ok` a write is the defect, every `ok` a no-write
  leaves the badge stuck for the session — so the commands report it: `DispatchOutcome` is
  `'wrote' | 'no-write'`, REQUIRED, so every `ok(...)` in every adapter was a build error
  until somebody decided. Seventeen of them, plus a fifth erasing seam nobody had counted —
  `runtime.ts`'s `asVoidCommand`, which reduced every success to `ok(undefined)` under the
  same falsified sentence, and is `asDispatchCommand` taking an explicit reader now. An
  optional `void | 'no-write'` widening would have changed two call sites and left the rest
  compiling, which is the SELF-DECLARED shape this file already has a bullet against.
- **Terminality that lives in the CALLER is terminality the object does not have.**
  `disposeNotices` drops its reference to the queue, and `createNoticeQueue`'s own `dispose`
  spliced `entries` and hid the handles — which reads as terminal and is not, because the
  entries stay reachable: `show` closes over its `entry` and hands `pause`/`resume` to the
  host, and the host registers those on DOM listeners it never removes. A `resume` after
  `onunload` — a pointer leaving a notice mid-fade — then found a non-null `handle` and `arm`
  armed a fresh 4000 ms timer into a disposed plugin. `dispose` clears `timer` and `handle`
  now, so `arm`'s existing withholding rule answers for the disposed case rather than needing
  a fourth condition, and a `disposed` flag drops a later `push` at the queue rather than
  relying on `notify.ts` having let go. Two module-level constructions of the same shape,
  found together.
- **Toast appearance is verifiable in a real vault and NOWHERE else.**
  `tests/harness/obsidian.css` carries no `.notice` and no `.notice-container` rule at all, so
  neither `npm run harness` nor `npm run harness-shot` can show what one looks like: a notice
  drawn there would have no position, no stacking and no chrome. Everything the harness has
  already caught by eye is live here and unwatched: the severity label and the message are
  adjacent inline elements separated only by a flex `gap` (`ZonePanelprototype` again), and
  the dismiss control's reset removes both of Obsidian's focus channels, so its
  `:focus-visible` ring is the harness index's own shipped defect a second time.
  `docs/tests/cases/Notices and save state.md` is the whole instrument.
- **The `Notice` fake widening turned ZERO existing tests red**, against a plan that predicted
  many on the 65-test and 86-test precedents. Verified by grep rather than by the run alone:
  no existing suite read `containerEl`, `messageEl`, `duration`, `setMessage` or `hide`. The
  old fake concealed nothing because nothing had ever reached the surface it lacked. Recorded
  precisely BECAUSE it contradicts the expectation — the rule ("a fake must not be thinner
  than the real thing") still holds and the widening was still right; the blast radius simply
  is not a function of how thin the fake was.
- **Three contract requirements are knowingly unmet, and where they are written down matters
  more than that they exist.** `docs/components/Toast.md` and
  `docs/components/Save-state indicator.md` both name this slice in their frontmatter and
  neither was opened until review round eleven. No mark beside the word on either surface
  (both contracts say "Both, always, never one"; a word plus colour satisfies SDD §85 and not
  them, and a CSS-drawn glyph would close it without introducing `setIcon`); no moving
  indicator for `Saving`; and no retry emit on `Save error`, which is UNDESIGNED rather than
  merely unbuilt, since the tracker sees a dispatch outcome and not a re-runnable command, and
  re-running a failed `undo` is not idempotent. All three are in the manual case and in
  `docs/tasks/13`, because a gap nobody inherits is a gap rediscovered from scratch.
- **There were FOUR, and the fourth closed by a route the record had not predicted.** The
  Toast live region was attributed on a container that APPEARS — the shape `Toast.md`
  explicitly refuses and calls "the one that decides whether this component works at all for
  the users it exists for" — and both the slice document and the manual case predicted the fix
  as a REORDERING: construct, clear `messageEl`, set the attributes while empty, populate on a
  microtask. That would have bought a timing change for a shape still centred on a container
  that appears. What the review pass took instead moves the region OFF the notice:
  `activateNotices()` appends two empty live regions to `document.body` (`status`/`polite` and
  `alert`/`assertive`), `disposeNotices()` removes them, and a notice announces by writing into
  the one its severity names while carrying neither attribute itself. Literally "already in the
  DOM" rather than approximately, and it needs no microtask, so nothing the suite asserts
  synchronously had to move — which is what the prediction had priced the fix at. The lesson is
  about the prediction rather than the gap: a recorded remedy is one route, and re-reading what
  the contract actually asks for can be cheaper than the route already written down.
- **`runtime.ts` sat at EXACTLY its 400-line `max-lines` cap, and the note predicting what
  would happen next was right.** One object literal in it was collapsed onto a single line to
  buy three lines, under a comment saying the rule skips blanks and comments, that the next
  change adding a line of CODE — of any size — would trip it, and that the answer would then
  be an extraction rather than a second collapsed literal. The review pass giving every
  dispatch a `DispatchOutcome` to report took it to 411. `presentation/editor/inspector-wiring.ts`
  is the extraction — SDD §59's Edit-to-Command arrow plus the binder that fits a
  per-transaction adapter to `CommandHistory`'s door, which is a coherent seam rather than a
  convenient one — and the literal is back in its natural shape, which is the point of taking
  the extraction rather than shaving another line. The general shape worth keeping: a budget
  bought back by reformatting is a budget that has already been spent, and writing down what
  the next author must do is what makes the second author's job a decision rather than a
  discovery.
- **A durable RECOVERY record that outlives its sequence un-writes the thing the indicator
  just called saved, and no amount of reporting fixes that.** `runDeleteResolution` logged a
  failed final `clearMarker` and answered `ok`, which is honest — every write it owed the
  vault had landed — so the adapter reported `'wrote'` and the indicator settled on
  `Saved`. The marker stayed on disk, and `recoverInterruptedSequences` at the next load
  restored every referent from the pre-state AND restored the deleted entity: a completed
  deletion silently reversed, hours later, with every surface having agreed it was safe.
  Reported by a review bot, which proposed propagating the failure into the save state. That
  remedy was declined and the reason is the more useful half: **it converts a silent reversal
  into a badged one.** The zone still comes back, and a sticky `save-error` about a marker
  file the user has never heard of names nothing they can act on. The harm is in the
  recovery, so that is where it was fixed.
- **`entityDeleted` was being read as "how far did this get", and it means "it finished".**
  `runDeleteResolution` writes that flag only after `deleteEntity` returns ok, and
  `deleteEntity` is the sequence's LAST mutation — everything past it is marker bookkeeping.
  So the flag proves every write landed, and recovery's rollback was destroying correct work
  in exactly the case it was written for. Recovery clears such a marker and reverses nothing
  now; a marker saying `false` is the only interrupted one, and its entity is by definition
  still present — which is why `recoverInterruptedSequences`'s OWN `restoreEntity` is DELETED
  rather than left unreachable (`undoDeleteResolution`'s member of that name is the UNDO
  path and is untouched: a user asking for their deletion back is not a crash), and
  why `RecoveryDeps` lost `zones` and `assets`. **Three green tests encoded the old policy
  and one of them asserted a log line that no longer has a producer**, which is what a
  deliberate, tested, wrong decision looks like from the inside: the reversal was not an
  oversight, it was the design, and the fix reads as a regression until the ordering argument
  above is made.
- **The residual is named rather than implied, because a bound checked against the door its
  author was thinking about is this file's own recurring defect.** If BOTH marker writes
  fail — the `entityDeleted: true` update and the `clear` — the survivor says `false` while
  the entity really is gone, and recovery rolls the referents back around a deletion that
  stands. Two failures where the reported defect took one, and no flag on the marker can see
  it: only the vault knows, and asking costs a second read per marker on every load. Written
  down in `recoverOne`'s docblock, not closed.
- **A log line is not a surface, and the composition that would make it one is not checked by
  anything the compiler runs.** `ResolutionOps.notify` mirrors `CascadeDeps.notify` exactly —
  optional for the suite's benefit, which is precisely what makes a composition that forgets
  it compile, pass and say nothing. `tests/plugin/sequenceNoticeWiring.test.ts` is what tells
  the two apart, and it was watched red with `notify: sequenceNotices` deleted from the root.
  Both of its cases assert the PAIR — the delete still answers `ok` AND the user hears about
  it — because "a notice appeared" is equally true of a build that started failing the whole
  deletion, and "the delete succeeded" is equally true of the build being fixed.

**Design slice 16 has landed: forms and inline validation feedback.** One vocabulary answers
"a command's typed error, rendered against the field it is about" everywhere in the plugin:
`routeError` (`presentation/errors/route-error.ts`) keys a command's `AppError.code` against
a per-form `FieldErrorMap` and answers either the field(s) it names or a form-level banner
when nothing does — `calibration.coincident-points` is the banner's own worked example,
since neither `pointA` nor `pointB` alone is wrong. `<FieldError>` mints its own input id and
hands `{ inputId, aria }` down a scoped slot rather than looking one up, with
`app.config.idPrefix` set at BOTH `createApp` sites (`app-id-prefix.ts`) so two Vue apps'
`useId()` calls cannot collide; `<FormBanner>` renders the fallback. Two composables share
that vocabulary at two different commit boundaries: `useFieldCommit` (blur/enter — Task 9
moved the Inspector's two Requirement override fields onto it) and `useFormCommit` (one
explicit submit — `NewProjectForm`, this slice's only creation dialog). A rejected commit
KEEPS the user's typed value and shows a persistent inline error; it never reverts. The
Renovation Project view gained its first write: `NewProjectForm` dispatches the real
`CreateProjectCommand`, reachable from `renovationProject.noProjects`'s action button
(design slice 14's empty state, which shipped with none) and from `ProjectList.vue`'s own
header — the project list is THIS slice's, not slice 17's, whose document is the
error-surfacing decision table and never once names one. `description`, `start` and
`targetCompletion` survive the vault round trip now too (Task 5a), date-only and in UTC.
Eight review rounds landed on this branch before this task closed it. Four of them —
rounds two, three, five and seven — found that MOST of that round's own findings were
defects in the repair the round immediately before it made; two more, rounds six and eight,
found a MIX of fresh findings and inherited ones, not only inherited. Named by round rather
than claimed of the whole branch, because it is not universal — CLAUDE.md's own recurring
lesson, reproduced here at the precision it actually holds rather than rounded up to "most
of them." The rules that lasted:

- **Reverting a rejected field destroys the user's own input for no architectural reason.**
  Slice 6 already guarantees a rejected commit writes nothing; silently replacing what the
  user typed with the old value is a second, worse decision layered on top of that
  guarantee. Both commit boundaries keep the draft and show a persistent error instead.
- **`Readonly<Ref<T>>` reads as read-only and is not.** It is a SHALLOW mapped type: it
  freezes `.value` and stops there, so `values.value.name = 'x'` still type-checks and
  `v-model="values.name"` still unwraps and writes, in a template, past the very `setField`
  the interface names as the sole write path — `tests/presentation/editor/
  type-safety.test-d.ts` proves both spellings fail `vue-tsc -noEmit` for the real reason,
  not merely by naming. `DeepReadonly<Ref<T>>` — Vue's own type, and what `readonly()`
  actually returns — is what `useFormCommit.values` and `useFieldCommit.draft` are typed as,
  refusing the write at compile time AND at runtime.
- **Editing a rejected field retires ONLY its own message, and a rejected PAIR retires as a
  pair.** `setField`/`onInput` clear the field's error the instant it changes — a message
  the user has already corrected is a lie if it survives — and `project.target-before-start`
  routes to `['start', 'targetCompletion']` as one claim about the pair, so correcting either
  half clears both, never just the one that was touched.
- **A required `notify` parameter is the one option that must not default to a no-op.**
  `useFieldCommit` converts every banner-routed failure to `error = null`, because the
  Inspector has no banner region — so without a second door, a resolved vault failure during
  an override reached the user through NEITHER channel. Optional-with-a-default would have
  let the one call site that forgets it fail silently; required means every caller states
  its door.
- **A second commit while the first is still in flight COALESCES, and a second submit while
  the first is still in flight is DROPPED — the same race, two different right answers.** A
  repeated field commit carries a value the user has since changed, so `useFieldCommit`
  queues exactly one follow-up with the latest draft; a repeated submit is one intent
  pressed twice, so `useFormCommit.submit` returns `false` on the second press instead. The
  asymmetry itself was right from early on; the coalescing MECHANISM took several rounds to
  actually get right — a later round found it re-dispatching a value that had not changed,
  and a later one still found it re-dispatching a value the user had already abandoned with
  `Escape` moments before. Getting a rule right and getting its implementation right are not
  the same review.
- **A guard inside a composable cannot see a caller that walks past its precondition, and a
  ninth review round found the Reset buttons doing exactly that.** `commitOnce` returns early
  on a CLEAN field, which is what stops a blur of an untouched input buying an undo entry per
  tab-through; `RequirementRow`'s Reset called `onInput('')` first, so by the time a round ran
  the field was dirty by construction and that guard could never fire for the path. Reset on a
  row holding no override therefore dispatched a real override-clearing command — a vault
  write, a revision bump and an undo entry standing for a change nobody made — and pressing it
  again bought another. Measured, not argued: two presses of each of the two fields take the
  requirement from revision 1 to 5. The row asks the question itself now, and the answer has
  TWO halves, which is the part worth keeping: `override !== null` is not enough on its own,
  because the DTO has not refreshed while a commit is in flight, so a value on its way to being
  persisted still reads as no override — testing it alone would silently discard a Reset that
  cancels a write the user has just started. `|| pending` routes that case through the
  coalescing the composable already has. With neither, the gesture is a draft discard, which is
  `onCancel`. **The existing unit case asserted the defect**: it mounted the row with
  `override: null` and required a dispatch, so it certified clearing an override that was never
  set — and the fixture it mounted had no `calculated` field at all, invisible for as long as
  no case set an override and rendered the branch that reads one.
- **Escape means two different things at two different scopes, and Definition of Done item
  2 originally asked for only one of them everywhere.** Inside the Inspector, `Escape`
  resyncs ONE field (`useFieldCommit.onCancel`, wired `@keydown.esc.stop`) because there is
  no dialog to close. Inside `NewProjectForm`, `Escape` reaches slice 15's `DialogHost`
  first and cancels the WHOLE dialog — the same handler every other dialog kind already
  has — discarding every field at once rather than resyncing the one under the caret. The
  task document's item 2 asked for a creation-dialog Escape that resyncs to the form's
  initial value while staying open; nothing in this slice builds that second, narrower
  Escape inside an open form, and the clause is WITHDRAWN rather than left ticked over the
  gap. `docs/tests/cases/Create a Project.md` steps 10 and 14 are where the difference is
  actually looked at.
- **A design that checks the domain and stops is checking half the claim.** The spec refused
  a `Money` field on this form and, in the same document, admitted `description`, `start`
  and `targetCompletion` without checking whether the VAULT round-trips them — it does not:
  `projectToPersistence`/`projectFromPersistence` wrote and read only `name` and `status`.
  Task 5a persists all three, following `AssetFrontmatterSchemaV1`'s
  `.string().nullable().catch(null)` pattern so no schema version bump is owed.
- **A regex that only rejects the one malformed spelling a test happens to try is a shape
  check wearing a validity check's clothes.** `^\d{4}-\d{2}-\d{2}$` passes `2026-02-30` and
  `2026-13-01` alike; both parse as `Invalid Date` or land on a different real day with no
  error anywhere. `isRealCalendarDate` closes both classes with one round-trip predicate,
  ordered so the finite check runs before `toISOString()`, which throws on exactly the input
  the predicate exists to reject.
- **`create-sample-project` is not retired by this slice** — see its own paragraph below and
  `src/plugin/sampleProject.ts`'s docblock: this slice built the PROJECT half only, and a
  Plan still has no creation form or a surface to reach one from.
- **A shared operation shares its FAILURE, or it is only half shared.** The coalescing that
  made a double click one tab (`openingByPath`) handed both clicks the same promise — so
  when it rejected, each caller's own `.catch` in the composed closure reported it: two
  notices and two identical log lines for one open. The map holds the HANDLED promise now
  and the fault door moved INSIDE the coalescing as `deps.reportFault`, injected because
  `infrastructure/` may not reach `presentation/notices/notify`; the mapping is still
  composed at the root in one place, and only the CALL moved to where the coalescing is.
  `ProjectNoteOpenOutcome` gains `'failed'` to say so, and it means something narrower than
  "did not open" — the attempt faulted and has already been reported, once. Two things about
  it are worth more than the fix. The comment in `openNote.ts` asserted the opposite while
  the defect stood ("a rejection is shared rather than swallowed … which the composed closure
  turns into one notice"), which is this file's oldest recurring shape arriving once more. And
  the notice COUNT cannot discriminate the fix from the defect: slice 13's queue folds an
  identical message into a `(×N)` suffix on the notice already up, so `Notice.shown` reads 1
  either way and the LOG line count is the only instrument that sees it.
- **A comment that says an unmount deliberately settles nothing is a comment about the
  unmounts that existed when it was written.** `DialogHost`'s hook released the background
  and resolved nothing, arguing that "a leaf's own `openDialog(...)` caller is gone with the
  leaf". A leaf close stopped being the only unmount the moment `RenovationProjectView.rebind`
  landed: a settings save tears the whole Vue tree down with the LEAF STILL OPEN, so the New
  Project form vanished mid-typing and `ViewRoot.onCreateProject()` stayed suspended forever,
  holding the retired root's context behind it. It settles with the kind's own cancel result
  now. **Cancel is the right answer and not merely the cheap one**, which is the part to
  carry: the descriptor's `dispatch` prop closes over the root being REPLACED, so preserving
  the form across the swap would preserve a form that writes through the very root `rebind`
  exists to retire — under the previous default project folder, one of the four defects that
  made `deps` non-readonly. There was nothing to preserve that still pointed anywhere valid.
- **A defect its own header predicted, with the trigger named, and the trigger passed
  unread.** `ObsidianProjectRepository`'s class comment described the orphan folder a failed
  insert leaves behind for two slices and named THIS slice as when to close it — "slice 16's
  project-creation form … the first time a user reaches this path by typing a name, and the
  first time retrying after a failed create is an ordinary thing to do." The slice landed,
  the form shipped, nobody re-read the header, and the review bot's finding is the code's own
  note handed back to it. `ensureFolder` records what it created into an OUT parameter — a
  returned list is lost on exactly the path that needs it, since the walk can throw having
  already made some segments — and `undoEnsureFolder` removes them deepest first, each one
  only while it is still EMPTY. The obstacle the old note gave as its reason not to
  compensate became the BOUND rather than the excuse: `ensureFolder` walks the CONFIGURED
  ROOT too, this repository's queue is keyed per PROJECT, and Obsidian's `trashFile` on a
  folder takes everything inside it, so a sibling insert that filled that root is precisely
  what the emptiness rule stands between. **A deferral written into a comment is a deferral
  nothing schedules**: no gate can read a trigger, and the slice that trips one has no reason
  to open the file that states it.
- **The fake-too-thin rule again, and this time it hid a GUARD rather than a defect.**
  `FakeVault` left `MockTFolder.children` permanently `[]`, so every folder in the suite read
  as empty — the emptiness rule above could neither be driven nor caught being deleted. Its
  `delete` also refused anything that was not a note, where Obsidian's `trashFile` takes any
  `TAbstractFile`. The folder arm is modelled DESTRUCTIVELY on purpose: a fake that politely
  refused a non-empty folder would make dropping the guard invisible, which is "not KINDER
  than the real thing" read against a guard rather than against a crash. Blast radius: 0
  existing tests — the second time this file records that number, and the second time the
  number is not the point. One more dead branch came out of the same work and is recorded
  rather than kept: the `catch` after a refused trash ended with `break`, and a folder whose
  trash refused is still its parent's child, so the emptiness rule ends the walk on the next
  iteration regardless. Measured by deleting the `break` and finding every case green.
- **The unmount settles a BUSY dialog, and that is RECORDED rather than closed.** The same
  round reported it: `onKeydown` refuses `Escape` while a write is in flight and `FormDialog`
  disables Cancel, but `onBeforeUnmount` settles unconditionally — so a settings save landing
  inside the window of one `vault.create` tells `ViewRoot.onCreateProject()` the dialog was
  cancelled while its write runs on against the root `rebind` is retiring. The remedy the
  report named — defer the rebind — needs a seam from `presentation/` back out to the
  `ItemView` that does not exist, and buys correctness by running on the retired root for the
  length of the write, which is the hazard `rebind` was built to close. The alternative,
  leaving the caller suspended, is the defect the settlement was added for one round earlier.
  So the residual is written in the three places that inherit it — the hook, `docs/tasks/16`,
  and `formBusy.test.ts`'s last case, which pins the settlement as BEHAVIOUR so a build that
  starts holding this door fails there rather than quietly making those paragraphs wrong.
  What it costs was traced rather than taken from the report: the project IS created, under
  the PREVIOUS default project folder; `ProjectCreated` reaches the retired root's bus, so the
  rebound tree never hears it; and `VaultChangeAdapter` indexes the note while publishing
  nothing, `projectIndexRebuilt()` having exactly one publisher that `saveSettings` runs
  BEFORE the rebind. The rebound list is stale until the leaf is reopened.
- **The half of a staleness that no COMMAND can raise, and the docblock that called it
  unfixable was pointing at the fix.** `projectListChangeSource` gained `ProjectCreated` in
  one round and still missed every project note added by hand, copied in, or arriving through
  sync: `VaultChangeAdapter` is the SOLE index writer for those, and it held no `EventBus` at
  all, while `ProjectIndexRebuilt` has exactly one publisher (layout-ready and a settings
  swap). A mounted pane drew the vault it had read at mount, indefinitely. The module's own
  paragraph had recorded the delete case in prose — "there is no `ProjectDeleted` to add here
  until something raises one" — which reads as a survey of the ground and was actually a
  description of the missing publisher one layer down. `ProjectIndexEntryChanged` is that
  publisher, and **it carries the entity's TYPE, which is what makes the fix usable rather
  than merely correct**: a rebuild deliberately carries nothing, because it cannot say which
  entities changed, while this one names one entry and each source filters. Unfiltered, the
  subscription would be correct and the surface unusable — a burst of synced zone notes would
  re-read every project note in the vault, once per note. Two rules came with it. Every index
  mutation goes through ONE pair of private methods rather than six remembered call sites,
  because "the index changed under you" is a category a view trusts and a call-site list
  cannot promise. And the ECHO check comes first: this plugin's own writes upsert the index
  and publish their own command events, so announcing above that check would fire a second
  refresh per save and make the index, not the domain, the thing views listen to — measured by
  hoisting the announce above the guard and watching the case go red.
- **A passing coverage gate is not evidence that a new arm was tested, and this file's own
  rule needed the sharper spelling.** The paragraph above says an untested new arm "does not
  reduce coverage, it fails the gate". That is true when the headroom is one arm and false
  otherwise: this round left `changedEntityTypeOf`'s payload-less arm uncovered and branches
  read 98.12 against a floor of 98 — three covered units of headroom, so the gate passed and
  said nothing. It was found by reading `coverage-final.json` for the three CHANGED FILES,
  which is the instrument that can see one arm, and the threshold is not. Read the floor as a
  floor.
- **`events` REQUIRED is half the check, and the compiler owns only that half.** A composition
  passing no bus fails to build; one passing a FRESH `createEventBus()` compiles, passes every
  other test here, and announces into an object nothing has subscribed to — the exact shape
  `slice10CascadeWiring` and `sequenceNoticeWiring` were written for, with the compiler
  covering the missing argument and nothing covering the wrong one. The wiring case drives a
  foreign note through the REGISTERED vault handler and asserts on what a subscriber on
  `root.eventBus` hears. Its first draft passed a `{ path }` object to that handler and the
  plugin's own `file instanceof TFile` guard dropped it silently one layer above the thing
  under test — a test that reached nothing, which is indistinguishable from a clean tree.

**Design slice 17 has landed: every `AppError` reaching Presentation has exactly one surface,
and a call site cannot reach one without asking.** `surfaceFor(error, origin)`
(`presentation/errors/errorSurfacePolicy.ts`) is SDD §66's last step — the one slice 11 named
and deliberately did not finish designing. A surface is a function of the PAIR: the same
`CalculationError` is an inline field error under the known-distance input, a toast for two
canvas point-picks, and nothing at all inside a background cascade; and origin alone does not
decide it either, because the toast's `level` comes from the category. `surfaceError` dispatches
to the doors a site actually has, and `ViewFailure.vue` is the ONE container this slice adds.
The rules that came out of it:

- **A policy a call site CONSULTS is the guard-nobody-dispatches-through shape, and this file
  had already paid for it twice.** The slice document specified `surfaceFor` as advisory. What
  shipped is advisory PLUS a lock: `ErrorSurface` carries a `unique symbol` its own module
  declares and never exports, so a hand-built `{ kind: 'toast', level: 'error' }` cannot satisfy
  `ToastSurface` and `notifyError` is unreachable without having asked. **State the guarantee
  narrowly** — it holds that a call site ASKED, never that it asked with the RIGHT origin, which
  no type can close. The ten origins are tabulated in the slice's spec because review is the
  only instrument for that half. Measured, not asserted: deleting `& Routed` from the seven
  union members reports exactly three `TS2578` unused-directive errors, one per literal.
- **Two individually-correct mechanisms double-reported one failure for four slices, because
  nothing owned which one should speak.** Every dispatch in a Plan Editor leaf runs through
  `withSaveStateTracking`, which asks `affectsSaveState` and flips the save indicator for
  anything that wrote or might have — and `notifyIfRefused` plus two `reportRejected` bindings
  then ALSO raised a toast for the same `Result`. Neither mechanism was wrong alone. The
  Definition of Done forbade it by name and slice 11's own illustrative code had left it open.
  Two existing tests encoded the defect, and their NAMES were still right ("is reported, and
  leaves the command on the undo stack") — only the surface changed, so they assert the pair now
  rather than counting notices.
- **A `grep` for the docblock claim found an eleventh call site the slice's own spec table
  missed.** That table was measured with a filter that excluded `notify.ts`, so `notifyFault` —
  which calls `notifyError` from inside that file — was invisible to it. The repository's rule
  is that an "only place X" docblock gets a grep in the SAME edit; the rule works, and it works
  by catching the person who wrote the table.
- **A guard whose `else` is unreachable still costs a branch, and branch headroom is not a
  budget.** The plan spelled the simple call sites as `if (surface.kind === 'toast')`, which is
  correct and leaves a dead `else` at each — three uncovered branches against two of headroom.
  They use `surfaceError` with sinks instead. Read the floors as floors: this slice landed with
  **branches at 98.02% against 98** and **functions at 99.05% against 99**, which is about two
  branches and under one function.
- **Functions coverage failed with every test passing, which is what the tight metric looks like
  from the inside.** 3726 green, 98.98% functions, gate red. The one genuinely new uncovered
  function was `noticeOnlySinks.unrenderable` — unreached because every production site is
  routed to a surface it CAN draw, which is the design working rather than a gap. Pinned as
  behaviour (a notice-only site handed a `view-failure` still says something) rather than
  covered incidentally.
- **`satisfies never` on a property is the exhaustiveness spelling that does NOT work.** Once
  the switch is exhaustive the whole of `error` narrows to `never`, so reading `.category` off
  it is itself an error. The check has to be on the narrowed VALUE (`const unrouted: never =
  error`). Tried the other way first; the compiler said so immediately.
- **A failure state must not be a mode of the empty state**, and that is structural rather than
  a copy convention. `EmptyState` is generic enough to have been reused, which is exactly the
  reason not to: slice 14's objection is that "create your first project" shown because a vault
  read failed is actively misleading, and two components make that a fact about the markup. It
  also keeps `.rp-empty-state` meaning what every existing assertion and the axe case take it to
  mean.
- **The retry is withheld from a bootstrap failure, and that needed a THIRD state nobody had
  named.** `settings.unrecovered` means the composition root wired no query services at all, so
  re-running one does nothing while looking like it might — the live-control-that-does-nothing
  slice 14's own amendment refuses. `viewHydrationOrigin` draws that line once for both views.
  A single test case would not have discriminated: a build offering a retry to both passes
  anything that only checks the retryable one.
- **A spy on a module export may bind to nothing, so it was verified before being trusted.**
  `renovationProjectEmptyState.test.ts` records that instrument failing on another surface — a
  compiled `<script setup>` closes over the imported identifier directly — and a spy binding to
  nothing reports `not.toHaveBeenCalled()` for every build ever written. The absence test for
  "a missing plan never reaches `surfaceFor`" was measured against a FAILED read, where it IS
  reached, before the absence was read as evidence.
- **An example offered as proof of REACHABILITY has to be traced to the door it claims to
  arrive at.** `affectsSaveState`'s docblock cited "calibrating with two clicks at the same
  point raises `calibration.coincident-points`" as evidence that `Calculation` reaches that
  predicate. It does not: `CalibrateTool` refuses before it dispatches, so no command runs and
  nothing reaches the indicator. The claim had been traced to the raise site and no further.
- **A Definition of Done item can ask for the WEAKER design, and the answer is to withdraw it
  rather than build it.** The slice asked for `calibration.invalid-distance` to render inline,
  which would have meant restructuring the calibration gesture — its own spec's largest task and
  named schedule risk. Reading the guards first showed `KnownDistanceForm` **disables its submit
  button** unless the value parses positive and finite, so no user can produce that refusal at
  all. Validating at the input is better than dispatching and rendering a refusal. What the same
  item's other third bought was real, though: coincident clicks used to be refused SILENTLY,
  wiping a point the user had placed with no reason given.
- **A generic component's one event can mean two opposite things, and the CALLER is what
  decides.** `ViewFailure`'s action retries a read that failed and closes a tab whose plan is
  gone — `PlanEditorRoot` branches on the status rather than the component learning which of
  its callers means what, which is what keeps it reusable by a view this slice has never heard
  of. Both directions are mutation-checked: a handler that always retried, or always closed,
  passes a suite that tests only one of them.
- **`PlanEditorContext.closeLeaf()` is the view's leaf, partially applied** — the same shape
  `onPlanChanged` already had, and the reason `onThemeChange` gives for not handing the
  `Workspace` down. NOT a `PlanEditorDeps` member: the composition root composes services and
  knows nothing about which leaf this is. The dangling-plan state shipped without it for one
  commit, with the missing seam written down rather than worked around by reaching for the
  global `app`, which the marketplace rules refuse.
- **A FAULT and a REFUSAL are the same shape by the time they reach a surface, and SDD §65 is
  the line between them.** `makeCommitField` maps a throw into a resolved `Result` carrying a
  coded `PersistenceError`, indistinguishable from one a command returned — so routing both to
  the save indicator would show a badge and no cause for the one case where the mapped sentence
  is the user's ONLY account. `faultError` stamps every mapped fault, which is sound because it
  is the one place a thrown cause becomes an `AppError`: its definition plus four callers, all
  catch blocks.
- **"Dispatched" is not "the indicator has it", and assuming so made a whole gesture silent.**
  `withSaveStateTracking` asks `affectsSaveState`, and a PRE-WRITE category resolves NEUTRAL —
  no badge, nothing written. A door that assumed otherwise routed those to a save-state sink
  that is deliberately a no-op: a calibration whose scale collapsed after dispatch and before
  `geometry.write` reached nobody. The door asks the same predicate the indicator asked now, so
  the two cannot disagree about who reported what. **Three separate review rounds found three
  shapes of this one mistake**, and the shape is the lesson: the origin of a refusal is not a
  property of the call site, and every attempt to read it off one was wrong somewhere.
- **A view showing valid-but-STALE data is not a view that failed.** `keepPreviousOnFailure`
  keeps the previous scene and `status === 'ready'` when a post-write read-back fails, so the
  in-place failure state is the wrong surface — replacing the canvas would hide a plan the user
  can still work on in order to report a read that failed. An additive strip, shown while the
  condition holds, is the shape that fits; a toast would not, because the staleness outlives it.
- **`analyze` reads `.test-d.ts` as an unreachable FILE**, so `.fallowrc.json` names each of the
  four one at a time — deliberately not globbed, because "a glob absorbs the next file and tells
  nobody" and here it would absorb one whose `tsconfig.json` entry had been forgotten, leaving a
  file that is neither compiled nor reported.

**Design slice 21 has landed: the project surface has a second state, and a project is
somewhere you can BE.** A row navigates into one project — its plans, a `New plan` form over
the real `CreatePlanCommand`, an `Open note` action, and a way back — and which project is open
is a fact Obsidian's own view state holds. The two-surfaces paragraph at the top of this file
describes the mechanism; these are the rules that came out of building it, and four review
rounds' worth of findings on this branch were false SENTENCES rather than broken behaviour,
which is the shape to expect from the next one too:

- **A spec can name an identifier that is already taken, and the collision is invisible until
  somebody greps.** The design named its palette command `open-project`; that id was already
  registered, already locale-keyed and already asserted in two test files, for the command that
  reveals the view. It shipped as `open-project-detail`. Nothing would have failed loudly — an
  id is data Obsidian binds a user's hotkey to, and a second `addCommand` under one id is a
  question about Obsidian's registry rather than about this tree.
- **`''` as a DESTINATION is the one place this view must not copy `PlanEditorView`, and the
  failure is total rather than cosmetic.** `getState` records `{ projectId: '' }` for the list —
  `''` rather than an absent key, because a key that is sometimes there is a different shape to
  reason about, which is `PlanEditorView.getState`'s own argument, and here the empty string
  additionally MEANS something. A validator shaped like `planIdFrom` — refuse anything that is
  not a non-empty string —
  discards exactly the value the back arrow restores, so the pane would never leave the detail
  state at all. `projectIdFrom` is a THREE-way parse for that reason: a non-object refuses, a
  non-string refuses, and `''` is ACCEPTED and means the list.
- **A `mounted` flag beside `mountedProjectId`, because `null` is a STATE here and not an
  absence.** `sync()`'s guard cannot be `projectId === mountedProjectId` alone: both are `null`
  on a first open, so the guard answers "already showing that" and the pane draws nothing at
  all. Measured as a mutation — nine cases red, most of them pre-existing lifecycle ones,
  because nothing is drawn.
- **The question is whether the index scan RAN, never whether it FOUND anything.** Obsidian
  restores its leaves before `onLayoutReady` and the scan runs from it, so a restored detail
  state asks an empty index and is answered a legitimate `ok(null)` — acting on that would
  navigate to the list and destroy the very `projectId` the restore was about. An earlier
  draft asked "has the index been populated", which hangs a restored pane forever in a vault
  whose last project note was deleted while Obsidian was closed. `indexScanCompleted()` is a
  predicate rather than a subscription, because `onProjectsChanged` collapses three events into
  one payload-less signal and cannot tell a completed rebuild from somebody else's create.
- **A REMOUNT makes staleness unrepresentable.** Every navigation tears the Vue tree down and
  builds it from the new `projectId`, so no component can hold a value that disagrees with the
  view's. The alternative — a reactive ref in the context — would have been the first reactive
  member any view context in this plugin carries, and a second way a tree here learns its
  subject changed. What it costs is stated where it is paid: the list's scroll position, and a
  dialog open across the navigation settling through `DialogHost.onBeforeUnmount`.
- **One ordering of `onOpen` and `setState` still mounts twice, and it is ASSERTED rather than
  fixed.** Obsidian promises no order. `setState` before `onOpen` was a tree mounted into a leaf
  Obsidian had not opened, and an `opened` flag closes it; the other ordering cannot be closed
  the same way, because by the time `setState` arrives `onOpen` has already mounted the LIST
  (`projectId` is still `null` then) and there is nothing left to defer. The real remedy is a
  deferred, coalescing mount, which turns a synchronous mount asynchronous for every caller and
  every case in that file — an increment with its own argument, not a review-round line. So the
  surviving double mount is pinned as `[null, 'project-01JAAA']`, and a build that starts
  coalescing fails there and has to come and say so. **The lesson is the reply, not the
  defect:** the fix was announced on the pull request from the SHAPE of the flag, and measuring
  it produced exactly that failing pair — this branch's own recurring defect, committed in a
  review reply about it.
- **A prediction about which test a mutation reddens is itself a measurement.** A brief here
  said an empty-id mutation would redden "the accepts-an-empty-projectId and round-trip cases";
  only the first can. The round-trip drives `A → '' → B` and asserts the FINAL state, so with
  `''` refused the field simply stays `A` until `B` overwrites it and the assertion reads the
  same in both worlds. The fourth such instruction on this branch, reported rather than routed
  around.

**And the detail state was LOOKED AT, which is where the rest of these come from.** Nothing in
this slice had a picture until its last task: the harness index discovers `ProjectDetail.vue`
and `PlanList.vue` and mounting either one there is useless — `IndexPage.vue` renders
`<component :is>` BARE, and that component requires three props and reads `project.name`
immediately, so the capture would photograph the harness's own failure card. `?project=<id>`
(`tests/harness/page.ts` → `mountHarness`) opens the real view on a seeded project instead, and
`project-detail` / `project-detail-narrow` are two more fixed shots. What that bought, all of it
invisible to `npm run check`:

- **Two declarations written to prevent a thing, neither of which could.** The back control had
  `flex-basis: 100%` to claim its own line plus `flex-grow: 0; width: fit-content` under a
  comment saying that pair was what stopped it stretching. In a row flex container `flex-basis`
  IS the main size, so it beats `width`; and clamping it with `max-width: fit-content` would
  shrink the item and take the line break with it, since the break is decided on the
  hypothetical main size. `Back to projects` rendered as a full-pane bar with a centred label —
  a section banner where the design says "not a peer of the actions beside it". The header is a
  GRID now (`grid-column: 1 / -1; justify-self: start`), which is two properties doing two jobs
  rather than one property doing neither.
- **`text-align: left` is inert on a flex item, and Obsidian's own `button` rule centres it.**
  Every plan name was centred in the pane, under a left-aligned `Plans` heading, beside a
  declaration saying `text-align: left`. `.rp-project-list__row` never had the defect and never
  stated the fix either — it carries `justify-content: space-between` because it has TWO
  children, and being left-aligned is a side effect. One child needs the rule said out loud.
- **A fixture that FITS its pane cannot demonstrate a scroll rule.** The first harness fixture
  held twelve plans; at an 800px leaf the list's scroll height equalled its client height
  exactly, 360 against 360, so deleting `.rp-plan-list`'s whole `flex: 1; min-height: 0;
  overflow-y: auto` block changed nothing any capture could show. Twenty-six is past what fits.
- **Both of the rules reasoned from the cascade were RIGHT, and the sentence explaining one of
  them was wrong.** `.rp-project-detail`'s `flex: 1` measures 800px of an 800px leaf against
  123px — its header alone — over a SHORT list, which is the case that matters and the one the
  no-plans empty state lands on. `.rp-plan-list`'s block measures a 677px box over a 780px
  scroll height, scrolling under a header whose top does not move. But its comment said that
  without the block "the shell would grow instead": measured, the shell does not grow and
  neither does the page — the `ul` becomes 780px tall inside an 800px shell that starts it at
  y=123, so the last rows are simply below the pane, clipped, with no scrollbar and no gesture
  that reaches them. The plausible sentence and the true one differ in what the user LOSES.
- **`RenovationProjectDeps.projectId` cannot open the detail state from outside**, which is a
  fact about `mount` rather than about the bundle: it provides `{ ...this.deps, projectId }`
  with the VIEW's own field, so a bundle naming a project is silently overwritten. The harness
  drives `setState` instead — the same door a navigation and a restored leaf both arrive
  through — and a jsdom case in `harness.test.ts` pins that it really reaches the detail state,
  because both captures wait on `.renovation-planner-view`, which the LIST satisfies just as
  well.

**Which plan the editor opens is a PICKER**, not the active file. `open-plan-editor` used a
`checkCallback` requiring the active note to be a Plan, which kept it out of the palette in
every vault that had no plan notes — and nothing in the app could create one, so that was
every vault. It is a plain callback over a `FuzzySuggestModal` of the Project Index's plan
entries now. The command ID did not change, because a user's hotkey is bound to it.

**`create-sample-project` is SCAFFOLDING and says so in its name, and it is now a
CONVENIENCE rather than the only source of anything.** One command seeds a project, a plan and
five zones through the real `CreateProjectCommand` / `CreatePlanCommand` /
`CreateZoneCommand`, then opens the editor on what it made — the vault-side equivalent of
`npm run harness`. Exactly three commands and nothing else: no asset and no requirement, which
is worth saying because a reader reasoning from slice 10's closed loop would expect them.
Zones stopped needing it once slices 6 and 8 gave `DrawPolygonTool` a way
to draw one by hand; the PROJECT half stopped needing it once slice 16 gave
`renovationProject.noProjects` a real action (`NewProjectForm` / `CreateProjectCommand` —
Amendment 1's "ships with no action at all" held through slices 14 and 15 and stopped being
true here) and gave `ProjectList` its own header button beside it; and the PLAN half stopped
needing it in slice 21, whose detail state carries a `New plan` button over the real
`CreatePlanCommand`. This paragraph said "the PLAN half is what this module is still the only
source of … there is no project-detail surface a 'new plan' action could live on" until that
slice landed, which is a trigger stated in prose firing without anything to notice it. What is
left is the reason it was written for: one gesture produces a scene worth LOOKING AT, where
assembling the same one by hand is two forms, two navigations and five polygons drawn vertex
by vertex. **Its trigger is now that it stops being USED** — a fact about a habit, which no
gate can report. `src/plugin/sampleProject.ts` carries that and why the partial notes a failed
seed leaves behind are deliberate.

Both of those were **found by a human running the plugin in Obsidian**, not by a gate, and
each is written up where the code is: the seed's first run failed on Obsidian's
asynchronously-populated `MetadataCache`, then on a missing `Geometry/` folder, and toggling
the plugin off and on logged `Several Konva instances detected`. `npm run check` was green
for all three, and each one was a FAKE that accepted what Obsidian refuses.

Requires Obsidian 1.13.0+.

**The settings pane is DECLARATIVE** (`getSettingDefinitions`, plus `getControlValue` /
`setControlValue`), which is what 1.13 renders from and what it indexes for the settings
search; `display()` is deprecated, is called only when the definitions are empty, and
`eslint-plugin-obsidianmd` fails the build for a tab with neither — a suppression is not
available, since the ruleset also forbids disabling its own rules inline. A setting is
added by returning one more definition; the read and write overrides are keyed generically
and need no branch per field.

**Both ends of a setting go through `settingsFrom`.** `data.json` is a file the user can
edit, so it is a trust boundary: a value outside the vocabulary falls back to the default
and a key this version does not declare is dropped, on the way in AND on the way out. A
cast at either end would be a second answer to what a setting is.

## Definition of done

```bash
npm run check   # build + lint + coverage-thresholded tests + fallow
```

All four must pass before committing; CI runs the same `npm run check`, verbatim, across
four legs — the same one command every one of them has to survive. Three are **Ubuntu**,
one per `engines.node` range this package declares (`^22.22.2 || ^24.15.0 || >=26.0.0`):
a declared range nobody actually executes on is the same defect `engines.node` itself
exists to catch, moved to a different file, so 22/24/26 all ride CI. The fourth is
**Windows**, at the floor only — a full OS × Node cross product would be six jobs for what
this earns, so the newer ranges ride the faster Ubuntu leg rather than tripling the slow
Windows one, while Windows still runs the version every platform must support. Paths and
line endings are the only things that differ between the two PLATFORMS, and both have
already produced a defect the project this harness came from could not see on one alone.

What each step refuses, because a step whose purpose is vague gets skipped:

- **build** — `tsc` first, then Vite. Also the stylesheet: the build fails on a partial no
  entry file imports, a line in `styles/index.css` the assembler cannot resolve, a partial
  over the 400-line cap, or a hard-coded colour — SDD §84 asks for an Obsidian CSS variable
  instead, so a themed vault stays themed. That check runs on `lightningcss`'s own parsed
  tree (already a devDependency, already used to minify this sheet), not on source text, so
  it sees every literal colour a declaration's VALUE resolves to, at any nesting depth,
  regardless of what a selector, an at-rule prelude, a comment or a quoted string contains —
  hex, `rgb`/`hsl`/`hwb`/`lab`/`lch`/`oklab`/`oklch`/`color()`, and (because the parser
  resolves a CSS NAMED colour to the identical node a hex literal produces) a bare word like
  `red`, on any property lightningcss's grammar fully parses. `device-cmyk()` is the one
  colour function the parser does not fold into that shape, so it is refused by name
  instead — the one function-specific case, not the general rule. What the check still
  cannot see: a bare colour WORD inside a raw token stream the parser leaves unresolved —
  a custom property's own value (`--accent: red;`) or an unresolved function's fallback —
  where a hex or `rgb()`-shaped literal is still caught generically but a bare word is just
  an identifier. `scripts/styles-assemble.mjs` carries the full account.
- **lint** — TWO linters in one step, because they refuse different things and neither
  subsumes the other. **ESLint** is where the architecture lives: the layer rule below is
  `no-restricted-imports`, and `no-restricted-syntax` carries the write boundary,
  `I18N_LITERAL_BAN` (`eslint.config.mjs` — `docs/requirements/Multilanguage.md`'s rule)
  and `NOTICE_TEXT_BAN` — not prose. `I18N_LITERAL_BAN` is narrower than "every
  user-visible string": it refuses a
  literal at exactly FOUR call sites — `.setText(...)`, and the `text:` option of
  `.createEl(...)`/`.createDiv(...)`/`.createSpan(...)` — and passes a call to `t`/`tr`
  untouched, since that is a `CallExpression`, not a `Literal`, at the position it checks.
  **`NOTICE_TEXT_BAN` is the notice door, and it is a SECOND rule rather than a widening of
  that one**: it refuses a `.message`/`.stack` read anywhere inside a `notify(...)`,
  `notifySuccess(...)`, `notifyWarning(...)` or `new Notice(...)` call, and a bare string
  literal as a direct argument to any of them — slice
  11's Definition of Done item 3 ("never a raw exception message, stack trace or internal
  file path; produced by `t()` rather than by a literal or by `AppError.message`") put at
  the forbidden call, because that door was the one user-facing surface no gate could see.
  It cannot see a value one hop away (`const text = e.message; notify(text)`), a template
  literal carrying raw English with no member access in it, a notice raised under a third
  name, or any door reached through a MEMBER EXPRESSION (`o.notify(e.message)`,
  `new n.Notice(e.message)`) — every selector keys on `callee.name`, which a member-expression
  callee has none of, and that is exactly why the four doors are bare functions rather than
  `notify.success(...)`; `tests/build/notice-text-boundary.test.ts` drives all of that through real fixture
  paths, blind spots included, and drives BOTH blocks that carry the rule — dropping the
  repeat in the `infrastructure/obsidian/` block turns exactly two of its cases red,
  measured.
  `I18N_LITERAL_BAN` still does not reach `addCommand({ name: '…' })`,
  `addRibbonIcon(icon, 'title', …)`, a `title` or `attr:` value, `el.textContent = '…'`, or
  a literal held in a variable first — today's actual UI text (settings `name`/`desc`, the
  command name, the ribbon title, `getDisplayText`) reaches none of those four call sites,
  so it is compliant by convention rather than by this gate — the same way the write
  boundary below names the spellings its selectors see and the ones they cannot, rather
  than claiming to see more. It also runs the Obsidian plugin guidelines
  and the size and complexity budgets. Warnings fail too (`--max-warnings 0`) — the
  mobile-safety rule reports as a warning, and `isDesktopOnly: false` is a promise.
  `manifest.json` itself is linted
  (`obsidianmd/validate-manifest`), so the marketplace naming rules are a gate, not a
  submission surprise. The ruleset is also kept ON inside the `no-console` carve-out for
  `src/infrastructure/logging/**`, which is what still fails `console.log`/`console.info`
  in the one directory `no-console` is off for. Switching it off there was available and is
  refused for a reason worth stating, because the obvious one is wrong: not that the
  ruleset forbids disabling its own rules, but that **the marketplace review bot lints
  with its own configuration**, so a local override would not travel and the rejection
  would arrive at submission rather than at `npm run check`. That guarantee rests on a
  wrapper (`rule-custom-message`) matching ESLint's own message text verbatim and
  reporting NOTHING on a miss, so `tests/build/logging-carve-out.test.ts` pins the two
  against each other — a reworded upstream message would otherwise turn the marketplace
  check off silently. **oxlint** runs first, in milliseconds, and adds the broad
  wrong-code ruleset ESLint never turned on, over a WIDER tree: the Obsidian ruleset is
  type-aware, so `eslint.config.mjs` stops it at `src/` and ignores `scripts/` and the
  root configs outright — which left `tests/` on 24 rules and the build scripts on none.
  Warnings fail here too (`--deny-warnings`), for the same reason. It is an ADDITION and
  not a migration: oxlint has no `no-restricted-syntax` at all (a config naming that rule
  is rejected outright, measured), no port of `eslint-plugin-obsidianmd`, and nothing
  type-aware. It does have `no-restricted-imports` and the budgets, so the layer bans are
  the one part that could move, and they stay where the rest of the architecture is.
  `.oxlintrc.json` carries which categories are on and what the other four cost, plus 29
  rules named one at a time out of the categories left off — a category is a bundle whose
  worst member decides whether the bundle is usable, and those four each hide a few rules
  about being WRONG behind a majority about being written differently. It also gives
  `scripts/` and the root configs the size and complexity budgets they had none of — the
  numbers `src/` already lives under, reaching the rest of the repository. **A rule is
  adopted while it reports nothing**: 27 of the 29 did, which is what made them one line
  each instead of a cleanup nobody schedules.
  It also mirrors ESLint's **`no-console`** and its `infrastructure/logging/**` carve-out,
  which is the one policy rule ESLint owned alone with nothing to notice its removal —
  and the mirror is what puts it in the EDIT LOOP, since `scripts/lint-edited.mjs` runs
  oxlint for every file it lints and ESLint for `.vue` alone. Scoped to `src/**` by measurement rather than taste: at the root
  it reports nine findings across `scripts/`, where a build script printing to the console
  is correct. The mirror is not total, and the sentence has to say so — inside the carve-out
  ESLint still fails `console.log`/`console.info` through the obsidianmd wrapper, oxlint has
  no port of that ruleset, so exactly that case is invisible to the edit loop and is caught
  by `npm run check` and `tests/build/logging-carve-out.test.ts`.
  Two things about it are claims rather than rules, so both have checks. Its SCOPE: an
  `ignorePatterns` edit that drops a directory makes the gate quieter rather than redder,
  so `tests/build/lint-scope.test.ts` asks oxlint itself which files it lints and compares
  that against the tree. And its REACH: **no comment in a linted file turns a rule off.**
  Two halves, because the two linters read comments differently. ESLint takes
  `linterOptions.noInlineConfig`, which refuses the whole class — the disable directives
  AND the rule-CONFIGURATION form, a block comment reading `eslint some-rule: off`, which
  carries no directive keyword. That form was the real exposure: `no-restricted-syntax`
  and `no-restricted-imports` are ESLint-only, so one comment turned the write boundary
  off and oxlint could not have backstopped it. oxlint's half is a scan of the files it
  lints (`tests/build/suppressions.test.ts`) plus `reportUnusedDisableDirectives`, since
  nothing in ESLint's configuration reaches oxlint's directive handling. A rule that does
  not fit is turned off in `.oxlintrc.json`, where the reason is written down and review
  sees it.
- **test:coverage** — the suite plus the coverage floors. `src/` measured 100% of all four
  metrics through slice 2 and no longer does: slice 4 brought the first arms no test can
  reach — defensive double-fault logging, an Obsidian-runtime view callback. Floors of
  99/99/99/98 (statements/functions/lines/branches), against 99.36/99.49/99.64/98.12
  measured on the tree that merged slice 13 into main. **Read branches again: 98.12 against
  a floor of 98, which is about two and a half covered branches of headroom, one branch
  costing 0.044 — the tightest this metric has been since slice 11.** Slice 13 measured 98.25
  alone and the figure FELL on merging, which is the second time this repository has recorded
  that happening; `vitest.config.ts` has the arithmetic. **Two branches is tight enough that
  an UNREACHABLE guard is not free**: the first draft of slice 13's live-region fix carried a
  `regions?.[…]` null arm no test could drive, and removing it by handing the regions to the
  host as an argument is what put that figure back. So an
  untested new arm does not "reduce
  coverage", it fails the gate — plan the test with the code rather than after it. Do not
  read a figure from this line as current; run `npm run test:coverage`. The exact numbers,
  which increment moved them, and what every remaining uncovered arm IS live in
  `vitest.config.ts`, which also carries the ratchet policy: floors only rise, and they
  rise to what a FINISHED increment measures — so an increment whose rounded-down figures
  equal the floors already in force ratchets NOTHING, which is what slices 5, 15, 11 and 13
  did.
  The suite
  includes `tests/harness/accessibility.test.ts` — axe-core driven in jsdom against the
  real mounted surfaces (`mountHarness`, the real Plan Editor, and the harness index in
  three states — never a fixture), checking
  roles, accessible names, form labels, heading order and ARIA attribute validity. It
  earns its place rather than merely running: pointed at the Plan Editor — the first
  surface here that draws anything — it immediately found three `aria-label`s on role-less
  `<div>`s, which is a real violation and one no other gate can see. The index is the only
  page here built out of interactive controls rather than a canvas, which is why it is
  scanned open, empty and failed rather than once: those three draw different markup, and
  the failure card is the tree's one live region. Read its header before trusting
  the word "accessibility" any wider than that: it does NOT verify colour contrast, a
  visible focus indicator or hit-target size (jsdom has no rendering engine to measure any
  of the three), nor page-wide structural rules like duplicate ids or landmark uniqueness —
  and those two are not the same mechanism: `duplicate-id` is deprecated and disabled by
  default in this axe-core version, so it is invisible here independent of scope — it
  fires correctly at BOTH `contentEl` and whole-document scope once force-enabled, so
  scoping is not why it is missed today. The landmark rules (`region`, `document-title`,
  `html-has-lang`, …) are the ones actually scope-dependent, needing whole-page context
  this file cannot give them because it scans `contentEl`, the plugin's own subtree, not
  the whole document. **That same scope is why no notice is graded here**: an Obsidian
  `Notice` renders on `document.body` under `.notice-container` and slice 13's two live
  regions are appended to `document.body` itself, so that pair of `role`/`aria-live` values
  and the dismiss control's accessible name — the most new ARIA any one slice has added — sit
  outside every scan this file performs. A live vault
  (`npm run test-build`) remains the only place appearance is verified.
- **analyze** — fallow: dead files and exports, duplication, complexity against coverage,
  and dependency hygiene.

**`npm run typecheck:tests` is a FIFTH gate and is deliberately not in `check` yet** — it
runs `vue-tsc` a second time, over `tests/**`, which is about 8 seconds on each of the four
CI legs, and while its baseline still holds a hundred files it is buying a regression check
rather than a clean tree. It joins `check` when that list is short enough that the second
compile earns its place. The Testing section below has the mechanism.

`npm audit` is deliberately NOT in `check`: an advisory with no patched version is a red
nobody can clear, and a gate people learn to ignore protects nothing. It is its own CI job.

Obsidian itself cannot run here. Three commands stand in, and none replaces another:

- `npm run harness` — a Vite dev server drawing the real view against the real stylesheet
  and **Obsidian's own app.css**, in a browser, with no Obsidian. `?view=plan-editor` draws
  the Plan Editor instead of the project surface, `?theme=light`, `?phone`, `?index` and
  `?entry=<id>` are the other knobs, and all of them exist so a headless capture needs a URL
  and nothing to click. Faithful about markup,
  spacing, hierarchy and Obsidian's DEFAULT colours — including the leaf chrome Obsidian
  nests around every view (`.workspace-leaf-content[data-type]` → `.view-header` +
  `.view-content`), which the fake `ItemView` in `tests/helpers/obsidian-mock.ts` nests the
  same way, checked against the real selector `styles/chrome.css` declares by
  `tests/harness/harness.test.ts` rather than assumed. Not faithful about a themed vault's
  colours, its accent, or any element default the vendored sheet's reduction dropped — it
  was reduced against another plugin's driven states. Say so honestly rather than letting
  "faithful" read wider than it is. **The sharpest instance of that reduction: it declares no
  `.notice` and no `.notice-container` rule at all** — that plugin never raised one, and all
  that survives is a `--layer-notice` variable used on an unrelated selector, measured rather
  than assumed. So a notice here would have no position, no stacking and no chrome: this tool
  cannot show what one LOOKS like, which puts slice 13's whole toast surface outside it and
  outside every gate. `docs/tests/cases/Notices and save state.md` is the only instrument
  for it.

  **`?index`** draws an index of every prototype and every real component, discovered from the
  tree with `import.meta.glob` so a saved file needs no registration. `?entry=<id>` opens one
  directly, and `npm run harness-shot <id>` captures it in both schemes. The index is OPT-IN
  and the bare root still draws the project view: the three project-view captures address that
  surface with no `view` parameter at all — two of the three carry a query string
  (`?theme=light`, `?phone`), just never a `view` one — so making a bare root mean "index" would
  break them while the test asserting they exist kept passing. The index has two fixed captures
  of its OWN (`?index` in both schemes), which is a different thing from the bare root meaning
  index and is what lets this tool photograph its own chrome. Mocks live in `src/prototypes/` as
  SFCs — a `<template>`, optionally a `<script setup>`, optionally a `<style scoped>` — written to the
  same Vue lint rules as the rest of `src/` so that promotion is moving the file rather than
  redrawing the markup. A template-only mock composes real components and sibling mocks through
  the index's global registry, having no script block to put an import in; a scripted one may
  import them directly, which is what a shipped component does. A `<style scoped>` block does not ship
  and does not travel — promotion lifts it into a `styles/` partial, since SDD §84's colour
  check runs over the assembled sheet and never sees inside an SFC. `scoped` is required rather
  than preferred: Vite never removes an injected block, so an unscoped one would still be
  styling the index after the designer opened something else.
  `src/prototypes/README.md` carries the one rule that IS relaxed there and why. **No prototype or fixture MODULE ever composes a built chunk**, refused
  twice: a per-layer `no-restricted-imports` ban makes it a one-way door, and
  `tests/build/prototypes-not-bundled.test.ts` runs a real `vite build` in memory (`write:
  false`, so nothing is ever written to `dist/`) and asks Rolldown which modules composed
  each chunk. Neither is sufficient — lint reads static imports, the bundle scan reports
  after the fact — and the bundle scan is narrower than the wider claim it serves: a
  prototype or fixture shipped as a separate emitted ASSET, with no module id in the chunk
  list, is outside what `chunk.modules` can see, and not cheaply checkable.
- `npm run harness-shot` drives that same page headlessly (`playwright-core`, a Chromium
  binary resolved from disk rather than a hard-coded revision) and writes a PNG per colour
  scheme plus `?phone`, both Plan Editor schemes and both harness-index schemes to a gitignored
  `harness-shots/`
  folder — a look at rendered layout, which jsdom cannot produce at all. Given an entry id
  (`npm run harness-shot prototype:ZonePanel` — the qualified id from `entries.ts`, not the
  basename the index displays) it captures that one prototype or component from the index
  instead of the ten fixed shots, in both colour schemes, with the index's own sidebar
  dropped so the picture measures the screen. `-- --width=460` captures a narrow pane as
  well, which is the width an Obsidian sidebar leaf actually has and the one that has already
  hidden a layout defect the default 1280 could not show. The `--` is load-bearing: npm claims
  a bare `--width` as its own config, and the command refuses that spelling rather than
  capturing at the wrong width and exiting 0.
  It draws and asserts nothing itself and there is no baseline to diff against, so like
  `npm run harness` it is deliberately outside `npm run check` and outside CI.

  **The browser is the pinned one or one you NAME, never one found lying around.**
  `scripts/chromium.mjs` asks `playwright-core` where the revision this repository pins
  would be and refuses to hunt a different build on disk when it is absent — a capture taken
  with an unannounced substitute is a picture somebody then reasons about as if it were the
  pinned browser's, which is a quieter problem than not capturing. The remedy it names,
  `npx playwright install chromium`, is a developer's laptop's remedy and is exactly what a
  container with its browsers baked in cannot do — so an error naming only that remedy is
  how a capture check goes un-run and gets disclosed as outstanding, which is what happened
  on the canvas-navigation branch. `RP_CHROMIUM_EXECUTABLE=/path/to/chrome` is the one door
  out, and it differs from hunting in both halves: a person names the build, and the capture
  prints that it is not the pinned one, so the caveat travels with the picture. What no gate
  can check is whether the substitute renders like the pinned build; read those captures as
  approximate. Both doors ask `isFile` and not `existsSync`, which answers `true` for a
  DIRECTORY — Playwright accepts one as an `executablePath` and fails at a launch several
  steps later, blaming the browser rather than the thing that named it, which is the late
  failure this module exists to convert into an early one. The EXECUTABLE bit is deliberately
  not asked with it: Windows has no such bit and `accessSync(path, X_OK)` succeeds there for
  any file, so the check would hold on one CI platform and be theatre on the other.
  `tests/build/chromium.test.ts` drives all of it, half in ONE CHILD PROCESS
  because `chromium.executablePath()` reads `PLAYWRIGHT_BROWSERS_PATH` at IMPORT and not at
  call — its own first draft set that variable in `beforeEach`, was answered from the real
  cache throughout, and planted an empty file called `chrome` in this machine's provisioned
  Playwright directory, which every later case then read as an installed pinned build.
  **ONE child, not one per case, and that is a CI lesson rather than tidiness**: a spawn that
  imports playwright-core costs about 650ms, and six of them cost 3.76s of a two-core runner
  in synchronous bursts — beside test files whose waits are bounded in TICKS rather than
  seconds. `settleUntil`'s own docblock already records a fixed-tick wait failing next to a
  PDF rasterizing two million pixels; this file reproduced that shape, timing out
  `accessibility.test.ts`'s cold Vite transform on one CI leg while the other three passed.
  Nothing needed a process each: the import happens once and the FILESYSTEM and ENVIRONMENT
  are read at CALL time, so one child walks every state and the `it`s read the results back.
  **A test file's CPU cost is part of its correctness when anything in the suite waits in
  ticks**, and a green local run on a four-core machine cannot see it.

  **`settleUntil`'s own bound was that same mistake one level up, and it took a red CI leg to
  see it.** The helper exists because a fixed `settle()` is a fixed tick count; its remedy was
  a loop bounded at 50 ROUNDS, and a round is four microtasks and one `setTimeout(0)` that Node
  clamps to about a millisecond — so the budget was about fifty milliseconds of wall clock on
  every machine, while the work it waits on is a cold Vite transform whose duration is entirely
  the machine's business. Measured rather than reasoned: `openIndex('entry=prototype:ZonePanel')`
  settles in four to six rounds locally, which READS as a tenfold margin and is five
  milliseconds against fifty. `verify (ubuntu-latest, 26)` spent all fifty and failed, while
  the three prototypes scanned before it passed — a per-MODULE cost, so no ordering makes one
  of them "the cold one". It is a DEADLINE now (4s, under vitest's 5000ms default so a real
  regression still fails as this helper's named error rather than as an anonymous test
  timeout).
  **Pre-warming the entry module was tried first and is the more useful half of the finding**:
  `HarnessEntry.component` is a real loader, so awaiting it does move that transform out of the
  polled window — and with the budget starved to one round `ZonePanel` still failed, because it
  is a template-only mock composing a real `<StatusBar />` that the index registers through
  `defineAsyncComponent`, which resolves lazily INSIDE the window. **A list of things to warm
  goes stale as mocks compose more of them; a deadline needs no list.** `settleUntil.test.ts`
  pins boundedness with a STUBBED `Date.now` rather than by waiting the budget out — four
  seconds on every CI leg to prove one `throw` is a bad trade — and says so, since what it
  cannot measure is whether the VALUE is right for a contended runner.

  **It has now caught ten defects the whole of `npm run check` could not**, which is the
  argument for running it on anything that draws: the view collapsing to a sliver of its
  pane (slice 1); and in slice 5, a layers panel sized with `--size-4-18` — 72 pixels,
  clipping every label to "Backg" — a zone caption offset multiplied by the scale twice
  over, putting three of four names off the top of the pane, and every zone type drawn in
  the same grey because the harness page applied its theme class AFTER mounting, so the
  editor resolved its palette when no `--color-*` existed. Every one passed the suite:
  jsdom lays nothing out, and the tests set the theme variables themselves.

  The fifth is the harness index's own entry list, where every row read `ZonePanelprototype`:
  Vue's default `whitespace: 'condense'` removes whitespace between two elements when it
  contains a newline, so an `<a>` and a `<span>` on adjacent template lines render with nothing
  between them. It was found by CAPTURING a PNG and looking at it, on the first thing a designer
  sees, after forty-four review rounds over that file.

  **What that fifth one says about the instrument, and it is the reason to keep running it:** the
  suite is not blind to the missing separator — jsdom's `textContent` reads `ZonePanelprototype`
  perfectly well. It is blind to SPACING, so it cannot see the defect once the remedy is CSS, and
  it could not have told anyone the rendered page looked wrong in the first place. Anything whose
  symptom is a measurement no layout engine performs — spacing, wrapping, overflow, contrast, hit
  size — is outside every gate this repository has, and a capture read by eye is the only
  instrument here that reaches it.

  **Six to ten came from the first design review of the harness index itself**, and they are the
  paragraph above proved rather than restated — every one is a measurement no layout engine in
  this repository performs, and `npm run check` was green on all five at once. The entry links
  had NO visible focus indicator: the vendored app.css carries `:focus { outline: none }` and
  `a { outline: none }`, and its reduction kept no `a:focus-visible` to put one back, so the
  page's only navigation was invisible to a keyboard — WCAG 2.2 2.4.7 at AA, which `PRODUCT.md`
  binds by name. The rows were 19.5px tall against 2.5.8's 24px minimum. The kind label was
  dimmed with `opacity: 0.6`, which composites to **4.29:1** on the light scheme's background
  and passes in dark — a contrast value no source file contains, which is the general lesson
  about dimming text with opacity. `.rp-harness-failure` — the tree's one live region — was
  applied in the template and declared in NO stylesheet, so a failed entry and an unpicked one
  drew the same picture. And the fix for the first four introduced the fifth: `.rp-harness-index
  h2` is a descendant selector, the stage lives inside that element, and the picker's uppercase
  type was drawn over every entry's own headings until a capture showed `WorkPackages.vue`'s
  title reading "WORK PACKAGES". `tests/harness/indexChrome.test.ts` refuses a selector that
  reaches the mounted entry now, from any of the three roots that lead there — the picker, the
  stage and the leaf — rather than only the one that shipped.

  **Which capture watches which of the other four**, because the resting pair cannot watch all
  of them and saying it could is how a state stops being looked at: `index-dark`/`index-light`
  hold the row height and the kind label's contrast, both of which are on screen at rest.
  A focus ring is not — nothing is focused in a headless page until something presses Tab — so
  that one is `index-focus`, which is why that shot takes a `focus` selector and why
  `focusForShot` presses Tab rather than calling `page.focus()`, which does not satisfy
  `:focus-visible`. The failure card is not on screen either, since no entry has failed: it is
  `index-failure`, which asks for an entry id that does not exist.
- `npm run test-build` — builds into `.obsidian/plugins/<id>/` in this repository, which IS
  a vault. Naming this is a shorter ask than "please set up a vault", and it is the only
  way appearance and any assumed API get verified.

  **What to run in it is written down**: `docs/tests/suites/Smoke Test the Editor.md` and
  the cases under it. That suite is not a nicety — the first walkthrough of design slice 5
  found FOUR defects in a row that all four gates passed, three of them a test fake
  accepting what Obsidian refuses. Its header tabulates them, which is the fastest way to
  know what to suspect when a manual case fails and the suite disagrees. The fixtures the
  cases need live in `docs/tests/fixtures/`; the PNG is generated by
  `npm run background-fixture` so that what it asserts is reviewable as code rather than
  buried in a binary.

  **The suite reads those fixtures from `tests/fixtures/`, never from `docs/`.** `docs/` is
  the vault — user land — and a test that depended on a path someone reorganises while
  writing notes would make a documentation tidy-up a build failure. The generator writes the
  PNG to both, so the copies cannot drift; the PDF has no generator and is tracked twice.

## Architecture

The SDD's layers (§8), and each may reach anything below it and nothing above:

```
presentation → application → domain → core
infrastructure → application (its ports) → domain → core
plugin/ composes all of them, and is the only layer that may
```

`eslint.config.mjs` enforces that with per-directory `no-restricted-imports`, so a violation
fails `npm run lint` rather than waiting for review. It also bans **`vue`, `pinia`, `konva`
and `obsidian` by name** in `core/`, `domain/` and `application/` — the SDD's §3.4, and the
architecture test its §76 asks for. `infrastructure/` may name `obsidian`; that is its job.

Two rules that follow from it and are worth stating because breaking them is cheap:

- **A type belongs with the code that PRODUCES it, not the code that consumes it.** A type
  placed with its consumer makes the pure layer depend on the effectful one.
- **Nothing writes to the vault outside `infrastructure/`.** The layer bans already keep
  `obsidian` out of the inner layers, so `no-restricted-syntax` rules on the write calls
  (`WRITE_BOUNDARY` in `eslint.config.mjs`) catch the case they cannot see: a write from a
  view, a Bases adapter or the composition root, bypassing the repository that owns the
  file format. The config names the spellings those selectors see and the ones they cannot.
- **One action, every input.** A ribbon click, a command and whatever a toolbar adds later
  call ONE function — `revealView` is the first of them. Adding an input means calling that
  function, never re-deciding beside it; a second entry point with its own activation looks
  correct alone and opens a duplicate tab the moment a user uses both. `infrastructure/`
  takes the view type as a STRING for the same reason it takes anything: it may not reach
  `presentation/`, and the composition root is what knows which view it is wiring.

  **One function is not enough on its own, because a leaf takes TIME to exist.** Both
  leaf-creating doors — there are exactly two in `src/`, counted by grepping `getLeaf(` and
  `getLeavesOfType(` — look a leaf up and create one when the lookup finds nothing, and a
  leaf they create does not answer that lookup until its own `await` resolves. So two
  activations in one tick both find nothing and both create: a double click on the ribbon gave
  two tabs of the SINGLETON view, two opens of one plan gave two Plan Editors, and a double
  click on a project row gave two note tabs. Each door now holds a map of what is in flight,
  asked BEFORE the lookup and released in a `finally`, keyed by what makes two calls the same
  request — the file path at `openProjectNote`, the view type plus the state that would be set
  at `revealCandidate`, since `setViewState({ type, active, state })` is the whole of what
  makes the leaf. Keying on the type ALONE collapses the multiplicity `revealPlanEditor`
  exists to permit, which is measured as a mutation rather than argued.

  **Every one of those doors is also DETACHED** — Obsidian's ribbon, command and modal
  handlers all return nothing — so a fault in one has no awaiter. Four spelled that as a bare
  `void`, two under a comment calling the missing rejection handler deliberate; a ribbon click
  that faulted opened nothing, said nothing and recorded nothing. `src/plugin/runDetached.ts`
  is the one step that maps, logs and notifies (SDD §66), and it is a FUNCTION rather than a
  habit because a fifth door would have to remember a `.catch` nothing checks.
- **Registering with Obsidian belongs to `src/plugin/`, and that is a check rather than a
  sentence.** `RenovationPlannerPlugin`'s header claimed to be "the ONLY place anything is
  registered with Obsidian" and a comment fifty lines below repeated it; both were false when
  written and stayed false for fifteen slices, since `planEditorCommands.ts` and
  `sampleProject.ts` each register commands through the `PluginCommandHost` seam. The layer
  bans cannot express the true claim — `obsidian` is importable in `infrastructure/` and a
  `Plugin` travels as `host` — so `tests/build/registration-locality.test.ts` reads `src/` for
  nine registration members and requires every hit under `src/plugin/`. It reads source TEXT,
  so a differently-named wrapper is invisible to it, and it carries a finds-something-at-all
  case: a typo'd member list would otherwise pass by reaching nothing.
- **A view type and a command id are DATA, not text.** Obsidian persists the first in the
  workspace layout and binds a user's hotkey to the second, so renaming either orphans
  something a user has. The display names beside them are text.
- **`src/prototypes/` is inside `src/` and outside the layering.** A mock may carry a script and
  a style block, composes real components and sibling mocks through the harness index's registry
  or — once it has a script — by importing them, and may be imported by NOTHING — a per-layer `no-restricted-imports` ban
  makes that a one-way door and `tests/build/prototypes-not-bundled.test.ts` asks the real
  build which modules composed each chunk. Its CSS has TWO homes and they differ in one thing,
  whether the rules ship: a `<style scoped>` block in the mock does not — nothing imports this
  tree — and does not travel at promotion either, while a `styles/` partial does both. `scoped`
  is required rather than preferred, because Vite never removes an injected block and an
  unscoped one would go on styling the index after the designer opened something else.
  `tests/build/prototype-styles.test.ts` refuses a class NEITHER home declares, and refuses an
  unscoped block. A real component is still drawn by the assembled sheet and by nothing else,
  which is what criterion 5 actually guarantees. `src/prototypes/README.md` carries the whole
  trade and the one lint rule that is relaxed there.

There is deliberately no list of modules here. `src/` is the list and it cannot go stale.

Build artifacts go to `dist/` and nothing is written to the repository root — `vite.config.ts`
says why, and it is a real constraint rather than taste. Everything `npm run` invokes lives in
`scripts/`, except the configuration files a tool finds by NAME at the root — the eslint,
vitest, Vite (build and harness), TypeScript, fallow, npm and editor configs — and every
script resolves its paths from the WORKING DIRECTORY rather than from its own location.

**Worktrees live in `.worktrees/`, inside the repository and gitignored.** They used to sit in a
sibling directory, which needed no ignore rule and was exactly the problem: a path outside the
repository is invisible to `git status`, so an abandoned worktree holding uncommitted work was
findable only by `git worktree list`, and four accumulated before anyone looked. A worktree is a
FULL COPY of `src/`, `tests/` and `styles/`, so moving them inside had to be measured rather
than assumed — `npm run check` was run with one in place. **`build` and `oxlint` ignored it and
`eslint .` did not**: flat config reads no `.gitignore` and no longer skips dot-directories, so
it walked in, found a second `tsconfig.json` beside the root's, and failed EVERY file with
"multiple candidate TSConfigRootDirs are present". `.worktrees/**` is in `eslint.config.mjs`'s
global `ignores` for that reason, which is the load-bearing claim that block's own comment
already made about itself. `fallow` counted the same 1193 files either way.

## The linter in the edit loop

`.claude/settings.json` runs `scripts/lint-edited.mjs` after every Edit and Write, which
lints THAT ONE FILE and hands the agent what the linters say. About 90ms for most files
(seconds for an SFC — see below), against `npm run check` several turns later — and by then the reasoning that produced the defect
is gone, which is the whole reason to move the cheap half earlier.

**oxlint for every file, and ESLint too when the file is a `.vue`.** oxlint has no port of
`eslint-plugin-vue` — no Vue rules at all — so for that one extension the fast linter is blind
to the entire ruleset governing the file, and an SFC came back clean from a hook that could not
read it. That is not hypothetical: the first author to write a mock here tripped
`vue/html-indent` and `vue/singleline-html-element-content-newline`, got a green hook, and met
`npm run check` several turns later — the exact gap this hook exists to close, in the one tree
whose authors are most likely to fall into it. The cost is measured and is why it is not
extended to `.ts`: oxlint answers for one SFC in about 110ms and ESLint in seconds, and on
`.ts` the two overlap enough that seconds per edit would buy little. **That second figure
tracks the size of `src/`, not the size of the file** — the Vue ruleset is type-aware, so
the project service loads the whole tree before it answers for one SFC. It was about 2.5s
when this hook was built and is 5.4s now; the two SFC cases in
`tests/build/lint-edited.test.ts` carry an explicit budget because growth alone pushed them
past vitest's 5000ms default, and that budget is the instrument for whether this hook is
still cheap enough to sit in the edit loop at all.

**The same cost has a second face, in the SUITE, and it looks like a regression when it is
not one.** Every `tests/build/` file that drives ESLint boots its own instance — vitest gives
each test file its own module registry — and each boot loads the whole type-aware project
service. Under vitest's DEFAULT file-parallelism on Windows those boots contend, and
`beforeAll(warmUpEslint)` can exceed even its deliberately large `ESLINT_BOOT_MS` (60s):
measured, six such files timed out in one run and every one of them passed on a
`--no-file-parallelism` re-run of the same tree. (An earlier draft of this sentence put a
file count on that re-run. No subtree of `tests/` has that many files, so the figure was
unverifiable and is gone rather than replaced by a second guess.) A parallelism artifact, not a broken gate
— so re-run serially before believing a `beforeAll` timeout in that directory, and count the
cost of the next ESLint-booting test file against it.

**It does not prevent the edit and it does not roll one back**, and every description of it
has to say so. `PostToolUse` runs AFTER the tool has written the file — Claude Code's own
table reads "Shows stderr to Claude; the tool already ran". Only `PreToolUse` blocks, and
only for a payload it can lint before the write: a `Write` carries its whole content, an
`Edit` carries a fragment whose result would have to be reconstructed first. That is the
trigger for revisiting the mechanism; it is not a reason to describe this one as more than
it is. (This paragraph exists because the first version of it claimed otherwise, and a
review bot caught it against the reference in `.claude/skills/impeccable/`.)

Four properties it is built to have, each with a test in `tests/build/lint-edited.test.ts`:

- **Each linter runs in the edited FILE's own project root**, which is not always the root the
  hook itself runs in. A worktree is a full checkout carrying its own `.oxlintrc.json`, its own
  `eslint.config.mjs`, its own `node_modules` and its own branch's rules, and until this was
  fixed every edit inside one was answered with a tool error about the config and no file was
  ever linted: oxlint anchors "the root config" on its working directory, so the worktree's
  byte-identical copy was read as a NESTED one and `options.reportUnusedDisableDirectives` —
  root-only — failed the whole run onto STDOUT, which this hook returns as findings. The root
  is derived from the file by walking up to the nearest `.oxlintrc.json`/`package.json`, never
  by matching the name `.worktrees`, and by a walk rather than `git rev-parse --show-toplevel`
  because the two name the same directory and cost **0.22ms** against **61ms** — two thirds of
  oxlint's whole answer. oxlint's `-c` and `--disable-nested-config` were both available and
  are refused where the code is: either would lint a worktree file against the MAIN branch's
  rules, which is this same bug with no error message on it. The binaries come from that root
  when it has them and are borrowed from this one when it does not — the working directory is
  what carries the rules, so a borrowed binary still reports about the right branch.
  **Read the `.vue` half narrowly**: an SFC in a worktree is linted correctly today only
  because ESLint 10 resolves the config file from the linted file's location — ESLint 9
  resolved it from the working directory, found this repository's config, and `.worktrees/**`
  in its global `ignores` meant an SFC came back silently clean from a hook that never read it.
  The fix makes that correct by construction; the test is a LOCK on a lookup rule that has
  changed once already, and what it catches TODAY is the oxlint noise that used to be joined
  into the same findings string.
- **It exits 2, not merely non-zero.** Neither code stops anything here, but 1 shows stderr
  to the USER and lets the agent carry on unaware, while 2 hands the findings over as a
  tool error the agent has to answer for. That is who gets told, not whether it happened.
- **It fails OPEN on its own bugs** — unreadable input, no file, a missing linter. A hook
  that failed closed would answer every edit in the session with an error about the hook
  rather than about the code, and the gate still catches what the hook missed.
- **The wiring is checked, not assumed.** The hook only runs because the settings name it;
  a renamed script leaves that pointing at nothing and edits silently stop being checked.

It sees ONE file, so it cannot see a layer violation's other end, a type error, a dead
export or anything ESLint owns. `npm run check` is still the definition of done, and
nothing here is allowed to read as if it were.

## Testing

`tests/` mirrors `src/`. Pure logic gets node tests — a rule about a quantity, a cost or a
zone is asked of a function, never of a screen, which is the whole return on the layering.
DOM code gets jsdom, per file. The `obsidian` module is aliased to one small mock that the
suite, the harness and nothing else share.

**Known limits of the fakes**, so nothing trusts them wider than they are: the module mock
models only the members something drives, and its `getLanguage()` always answers `'en'` —
a call site resolving the language wrongly is invisible to the suite, which is why `t` is
pure and driven per locale directly. `FakeLeaf`/`FakeWorkspace` RECORD asks rather than
behave. The DOM helpers install only `createEl`, `createDiv`, `empty`, `setText`. And
`npm run build` type-checks `tests/**` only through **seven entries in `tsconfig.json`'s
`include`** (vitest itself transpiles without checking), each there for its own reason. Seven,
counted in the file rather than remembered: slice 11 added the third and this sentence said
"two" for a slice, slice 16's review pass added the fourth, slice 12 added the fifth, and
slice 17 added the sixth and — in a review round on its own pull request — the seventh; this
sentence
narrated exactly that failure mode ("counted … rather than remembered") one slice before
falling into it itself, sitting at "four" through slice 12's own thirteen tasks until its
final review round re-counted the file.

**The REST of `tests/**` is type-checked too now, by a second program behind a RATCHET, and
that is a different mechanism rather than a sixth entry.** `npm run typecheck:tests` runs
`vue-tsc` over `tsconfig.tests.json` and holds the result to
`scripts/typecheck-tests-baseline.json` — the files permitted to fail, a list that ONLY
SHRINKS. It refuses three things: an error in a file not on the list, an entry that has
become clean (which must be removed in the commit that earned it, or a carve-out for a file
that no longer needs one goes on reading as a live exception), and an entry naming a path
that does not exist. It started at 562 errors across 114 of 307 files, which is what kept it
out of `tsconfig.json`; **193 files were already clean**, which is what makes the ratchet
worth more than a one-shot cleanup — a NEW test file is checked from the day it is written.
The end state is an empty list, `tests/**` folded into `tsconfig.json`, and both that script
and its baseline deleted.

Three things about it are worth carrying:

- **It does NOT map `obsidian` to the mock, and that is the load-bearing decision.** A
  compiler has one resolution per program, so mapping the specifier would give `src/` the
  mock too — measured, 77 errors, since `tests/helpers/obsidian-mock.ts` exports 13 members
  against a real surface holding `Vault`, `Workspace`, `MetadataCache`, `FileManager`, `App`
  and `TAbstractFile` among others. So a test importing from `'obsidian'` is checked against
  the REAL types, which is this file's own fake-must-not-be-thinner rule finally pointed at a
  compiler; 118 of the 562 errors are exactly that, and the honest spelling for a mock-only
  member (`Notice.shown`, `FuzzySuggestModal.opened`) is an import naming the mock.
  `tests/build/typecheckRatchet.test.ts` pins the absent mapping, because the obvious way to
  clear those 118 is to add it.
- **The rules are a PURE module** (`scripts/typecheck-baseline.mjs`) so the test drives them
  in milliseconds; `vue-tsc` over that program costs about 15 seconds, and
  `tests/build/chromium.test.ts`'s header already records what synchronous multi-second bursts
  do to a two-core runner beside files that wait in TICKS.
- **Its own continuation-line case did not discriminate on the first attempt**, which is this
  file's watch-it-fail rule paying out again: the fixture's indented lines carried no
  parenthesis, so a pattern keyed on the path shape alone passed all twelve cases. Real
  output with `() =>`, `getById(...)` and `element(s)` in it is what makes that case mean
  something — measured, the looser pattern counts 130 files where there are 114. And the gate
  caught its own author on its first real run: `replaceAll` is not in this project's `lib`, in
  a line copied from a file outside the type-checked set.

**What the first two passes over that debt found is the argument for the whole thing**, since
every one had been green in all four gates: `planEditorRig`'s command bundle missing
`calibratePlan` ENTIRELY, so slice 15's calibrate button would have TypeErrored in the e2e
rig; two cascade registrations passing the command OBJECT where `CascadeDeps` declares a
METHOD, unreached only because both cases abort at a failing list step; a dead
`withChanges?.({})` on a `Zone` that has no such member, immediately `void`ed, under a comment
describing the two lines below it; a local `type ResultLike<T> = { ok: true; value: T }`
asserting that a validating call cannot refuse; and `withConflictingReads` typed to a port
while calling `poke`, which no port declares. That last one is also the round's own lesson:
narrowing it to `InMemoryRequirementRepository` was the obvious next answer and was wrong in
the OTHER direction, since a second call site wraps the ASSET repository with it — a fix
written against the case in front of the author rather than the class, caught only because
the compiler was still running.

`tests/harness/**/*.vue` is the first, and it is about SCOPE rather than about a proof:
`IndexPage.vue` is the largest Vue file in the repository and the surface every prototype is
viewed through, and it was reached by neither `vue-tsc` nor `eslint-plugin-vue` (whose
`VUE_FILES` was `src/` only). The first run over it found `HARNESS_PLAN` missing a required
`PlanDto` field while annotated as one. Both globs are asked of the tools rather than read,
in `tests/build/lint-scope.test.ts` — TypeScript's own config parser, with `.vue` declared as
an extra extension, and ESLint's `calculateConfigForFile`.

`tests/presentation/editor/type-safety.test-d.ts` is the second, and it is a proof: slice 6's
screen/world brand
separation and the narrowing of `SelectionStore` to the four members `EditorContext` may
hand a tool are both claims only a compiler can settle, and `vue-tsc --noEmit` in
`npm run build` is the whole mechanism by which a compile-time proof exists here — a
`// @ts-expect-error` that goes unenforced is just a comment. It carries both directions:
what must NOT compile (the two brand mixes) and what must (the live Pinia store still
satisfying that four-member contract). Outside that one file, an `implements` still binds
the editor, not the gate.

`tests/application/ports/diagnostics.test-d.ts` is the third, and it is the other proof only
a compiler can carry: slice 11's "diagnostics contain no project content" is a claim about
`DiagnosticsLedger.record`'s PARAMETERS, so it has no runtime form at all. Five
`@ts-expect-error` directives — a zone's NAME, a note PATH, a free-text third argument, a
kind outside the union, and the old three-string call shape — plus one line asserting what
must still compile, which is an `AppError` whose `message` and `cause` DO hold content and
are dropped by the ledger rather than refused at the door. An unsatisfied directive is itself
an error, so widening `record` back to strings fails the build at the directive that no
longer has anything to suppress.

`tests/helpers/makeRenovationProjectView.ts` is the fourth, and it is neither scope nor a
proof but a FAKE held to the contract it stands for. That file's own docblock promises that a
grown constructor requirement "meets every consumer at the same time" — a compile-time claim
with no compiler behind it, and it had already been broken: slice 16 gave
`RenovationProjectDeps` a `commands` bundle whose `logger` is required, the factory built
`commands` out of `createProject` alone, and `ViewRoot` then handed `logger: undefined` to
`useFormCommit` — where a REJECTING dispatch TypeErrors inside the very catch that exists so a
fault reaches somebody. Invisible to all four gates, and doubly so because every dispatch wired
today is a guarded command that cannot throw. **The wider instrument was measured before the
narrow one was chosen**: every `.ts` under `tests/helpers` in that same `include` reports 29
errors, at least four of them this repository's own fake-too-thin shape rather than scaffolding
noise — `calibrateHarness`'s viewport missing `worldPerScreenPixel`, `planEditorRig`'s bundle
missing `calibratePlan`, two `PlanDto` fixtures missing `calibration`. Worth closing, and not
inside a review pass on another slice, so the number is written down where the next reader
finds it rather than left to be re-measured.

`tests/helpers/fixtureVault.test-d.ts` is the fifth, and it is a KIND of its own rather than
a fourth instance of scope, of a `@ts-expect-error` proof, or of a fake held to a contract.
It asserts BIDIRECTIONAL assignability — that slice 12's disk-backed `FixtureStack` satisfies
the same structural `VaultSurface` that `FakeVault`'s in-memory `RepositoryStack` already
does, and that `RepositoryStack` still satisfies it too, so the widening that let the surface
admit a second implementation is proven not to have narrowed what the first one already
promised.
Neither half is a `@ts-expect-error`: both assignments must compile, which is the opposite
shape from the two `.test-d.ts` files above it. Naming `RepositoryStack` is what gives it its
second effect, incidental to the proof it was written for: that type lives in
`tests/helpers/vault.ts`, which no earlier `*.test-d.ts` had ever pulled into a real program,
and `tests/**` is normally transpiled without checking — so this was the first time anything
type-checked that file's ANNOTATIONS against its CODE, and it found two pre-existing defects
on its first run. `tests/helpers/logger.ts` carried `Logger` only as a LOCAL, unexported
type-only import (`TS2459: declares 'Logger' locally, but it is not exported`), which
`vault.ts` had been importing from there regardless, unchecked, for its own
`RepositoryStack.logger: Logger` field; and `RepositoryStack` itself never declared the
`ledger` field `createRepositoryStack` had always returned, invisible for as long as the gap
between a factory's return value and its declared interface had no compiler pointed at it.
Both were fixed at their source rather than augmented around here. The technique
generalises past this one file: pulling a single `*.test-d.ts` into `tsconfig.json`'s
`include` does not check only the assertions written in it — it type-checks every module that
file imports, transitively, for the first time, which is a cheap way to point a compiler at a
helper subtree nothing else reaches.

`tests/presentation/errors/errorSurfacePolicy.test-d.ts` is the sixth, and it is a second
instance of the `@ts-expect-error` kind rather than a new one — with the difference that what
it proves is an ACCESS rule rather than a parameter's shape. Slice 17's `ErrorSurface` carries
a `unique symbol` its own module declares and never exports, so the three literals in this file
are structurally perfect and still unassignable: the only way to hold a surface is to have
called `surfaceFor`, which is what makes "a call site cannot reach a toast without asking the
policy" a `tsc` guarantee rather than a lint one. Measured, not asserted — deleting `& Routed`
from the seven union members reports exactly three `TS2578: Unused '@ts-expect-error'`
directives, one per literal. **What it deliberately does not prove is written into the file**:
that a call site asked with the RIGHT origin, which no type can hold, and for which the spec's
origin table plus review are the whole instrument.

`tests/application/errors/exceptionMapper.test-d.ts` is the seventh, and it is the same kind
put to a claim about code NOBODY HAS WRITTEN YET. `ExceptionMapper`'s declared return is
`AppError & TechnicalFault`, so a mapper that forgets to stamp the fault it mints fails at its
own `return` — which is the only form in which "every `AppError` minted from a thrown cause
carries the stamp" can be checked at all, since the mappers it quantifies over are the future
geometry and import ones the type's own docblock promises. Its two directives are held for
DIFFERENT reasons and both mutations were run rather than reasoned: widening `ExceptionMapper`
to a bare `AppError` unsatisfies the first and leaves the second biting, because
`VaultExceptionMapper` restates the obligation in its own call signature; widening only that
signature reports nothing at all, because the interface EXTENDS `ExceptionMapper` and inherits
the stamped one. The first draft of the file's own comment asserted the two were independent
and that widening one would leave the other open — false in both directions, and the sentence
is now what the mutations printed.

**It exists because the rule's earlier, REMEMBERED form was kept at one of its two sites.**
Slice 17 stamped by hand in `faultError`, under a docblock calling that "the single site where
a thrown cause becomes an `AppError`"; `guardAgainstThrowing.ts`'s catch is the second, and it
is the one every guarded command and query goes through. So a repository exception under a
dispatched editor command arrived in Presentation unstamped, was read as an ordinary
save-affecting refusal, and was routed to the save indicator — badge raised, toast suppressed
as a double-report, and the mapped sentence, which is the only account of a fault that will
ever exist, reaching nobody. Reported by a review bot on the pull request; `CLAUDE.md`'s own
rule is that a docblock saying "the only place X" gets a `grep` in the SAME edit, and that one
never did. **The two report doors then collapsed into one**, which is the part worth carrying:
`reportCommitFailure` existed as a separate function ONLY because its callers were the only
ones whose faults were stamped, so the fault arm would have been dead in its sibling. Making
the stamp a type obligation removed the asymmetry, and with it the reason for the second
function — a split kept alive by a defect rather than by a distinction.

- **An invariant asserted in a comment gets a test that fails without it, and the test is
  watched failing.** Revert the fix, run it, see red, restore. On one pull request in the
  source project, six of ten review findings were comments precisely stating the rule the
  code beside them broke. A confident paragraph is evidence of intent and of nothing else.
- **A fake must not be kinder than the real thing, not thinner than it, not HARSHER than it,
  and not FASTER than it.** A DOM helper
  that accepted what Obsidian rejects shipped a dead drag target while every test and the
  browser harness drew it happily; too kind. A fake `ItemView` that never nested a
  `.view-header` inside `.workspace-leaf-content` the way Obsidian does left
  `styles/chrome.css`'s own selector nothing to match and the harness's growth chain
  nothing to key its `:last-child` rule off, collapsing the browser harness to a sliver of
  its pane — too thin, and invisible to the suite either way, since neither defect touches
  a property jsdom draws or an assertion checked. Where a fake cannot be made strict, ban
  the tolerated spelling at the call site — `SVG_CLASS_TOKENS` in `eslint.config.mjs` is
  that shape. Where a fake is too thin, the fix is a fake that actually nests what the real
  thing nests — `ItemView` in `tests/helpers/obsidian-mock.ts`, since the harness-collapse
  fix.

  **The most expensive instance so far, because it hid a shipped defect behind 860 green
  tests:** `FakeMetadataCache` parsed the vault's own text SYNCHRONOUSLY, while Obsidian
  populates `MetadataCache` asynchronously — so a note read back in the tick it was created
  has no cache entry at all. Every read-after-write passed here and failed in a vault, where
  `create-sample-project` reported "Migrating the project note failed" on a note it had just
  written correctly (an absent `schema-version` reads as version 0, and there is no migration
  step from 0). Making the fake honest turned **65 tests across 12 files** red at once, which
  is the measure of what a kind fake was concealing. Two things came out of it and both are
  load-bearing: `frontmatterOf` falls back to `EchoWindow` — already "what this plugin last
  wrote here" — when there is no cache entry (and, since the modify window below, when the
  entry it has predates our own write), and it keys on the cache ENTRY rather than on
  `entry?.frontmatter`, because `getFileCache` answers `null` for "never parsed" but an
  object with no `frontmatter` for "parsed, and the user deleted it". Collapse those two and
  a note whose frontmatter was deleted is served this plugin's own stale bytes forever. The
  fake states what it models and what it still does not: the create window, not the parse lag
  after a modify, where Obsidian holds a STALE entry rather than none.

  **That last sentence stood for eleven slices and named the defect it was hiding.** The
  MODIFY window is real and it shipped: `SetPlanBackground` wrote the reference, published
  `PlanBackgroundChanged`, the Plan Editor re-hydrated off that event INSIDE the window, and
  `GetPlan` answered a plan with no background — so the canvas drew none, and the background
  appeared only much later, when some unrelated action (a calibration, in the report) re-read
  a note the parse queue had caught up with in the meantime. Every gate was green: the fake
  cleared its own lag record on `modify`, so every read-after-modify in the suite read the
  bytes on disk. **A fake that says what it does not model is still a fake that does not model
  it**, and writing the gap down bought exactly nothing — the sentence was read as a survey of
  the ground rather than as a live exposure, which is this file's own "a documented residue
  reads as surveyed ground" rule, arriving in the one place that had already written it out.

  What closed it: `FakeVault.pendingParse` models BOTH windows (a create leaves the cache with
  no entry, a modify leaves it the PREVIOUS text, and a second write inside one window keeps
  the earliest, because the cache is behind both), and `frontmatterOf` now detects the modify
  window rather than declaring it undetectable. The detection is a READING and not a guess:
  every writer takes `cacheReading` — the cache's own answer, immediately before it writes —
  and hands it to `markFrontmatter` as `supersedes`; a cache still answering exactly that has
  not been re-parsed, so the echo record is the truthful answer, and a cache answering
  anything else has moved on and wins. **A revision comparison was tried first and is the
  instructive failure**: it cannot tell a lagging cache from a hand edit that DROPPED the
  `revision` key, and it made `VaultChangeAdapter` blind to exactly such an edit — measured,
  on the two `announcements.test.ts` cases that drive one, which is the whole reason the
  discriminator is a token of the pre-write reading. `cacheReading` is also deliberately not
  `observeFrontmatter(frontmatterOf(...))`: inside the window that digests what this plugin
  WROTE rather than what the cache SHOWED, which breaks the chain on the second consecutive
  write and read the stale marker back in the slice-10 cascade. Blast radius of the honest
  fake: **9 tests**, every one of them a genuine read-after-modify, against 65 and 86 for the
  two instances above — the number is not the shape, which is why all three are recorded.

  **Two review rounds then found that the fix's own fallback was the new hazard, and the
  second round's lesson is the one worth keeping.** A cache TOKEN cannot tell "the cache is
  behind US" from "the cache is behind SOMEBODY ELSE", and it cannot see an external edit at
  all — an unparsed edit is by definition invisible to the cache. So the echo is served only
  when BOTH questions answer yes: is the FILE still the one we wrote (`EchoWindow` records
  `TFile.stat` after each write), and is the cache showing a state of ours we have since
  superseded (a CHAIN, because Obsidian may parse an intermediate write while a later one is
  still unparsed). The first of those was a REGRESSION this fix introduced and it was data
  loss: a hand edit landing inside the window was hidden by the echo, and the next
  conditional save — which the stale cached revision used to REFUSE — then overwrote it.

  - **A reading about "the file WE wrote" is only true while that is still what is on disk,
    and that is a rule about the CALL SITE no signature can carry.** Four writers take the
    stat with nothing but synchronous index bookkeeping since their write;
    `ObsidianZoneRepository` awaits a whole sidecar mutation in between and took it after,
    so an external edit landing in that window was recorded as OURS and `frontmatterOf`
    vouched for somebody else's bytes. Found by a review bot reading the ONE writer whose
    shape differs — which is the search worth copying: when a rule is kept correctly at four
    sites, look for the fifth that is not shaped like them.
  - **"Both directions of that error are SAFE" was false, and it was false because it
    measured the wrong baseline.** `observedFileStat`'s docblock argued that the guard "can
    only refuse the echo more often than a version without it" — true, and the version
    without the guard is the one that shipped the overwrite, so being no worse than it is not
    a safety property. Against the behaviour BEFORE the fallback existed the two directions
    differ: a stat MISMATCH withdraws (safe, and only lets the parse-lag defect resurface),
    while a stat COLLISION serves the echo over bytes that are not ours (an overwrite that
    used to be a refusal). A safety claim names its baseline or it is not a claim.
  - **`mtime:size` cannot be strengthened here and the sentence says so rather than
    promising more.** It is the whole of what a file states about itself synchronously, and
    `frontmatterOf` is synchronous by construction — `VaultChangeAdapter` calls it and has no
    `await` to spend — so a content hash is unavailable at the only moment the question is
    asked. The residue is PINNED as behaviour (`noteIo.echo.test.ts`) rather than described,
    so a build that closes it fails a case instead of leaving a paragraph quietly stale.
  - **A residue has as many faces as it has readers, and this one had a second nobody
    named.** `VaultChangeAdapter.processNote` reads through `frontmatterOf` and then asks
    `echo.matches` of the RESULT — so inside the window the fallback hands back exactly the
    value that comparison is against, and a colliding external edit is suppressed as our own
    echo. The read half self-corrects the moment the parse queue catches up; the INDEX half
    does not, because that path's one event has already been spent
    (`echoCollision.test.ts`). Both instruments had to be hand-built, because the fake
    vault's mtime is a monotonic COUNTER and every write there moves the stat — a fake
    kinder than a real clock, in the one property the guard rests on, and its own docblock
    says so.
  - **The CREATE window deliberately takes no stat guard, and that asymmetry needed writing
    down before it read as an oversight.** With no cache entry the only thing to withdraw to
    is `{}`, which every caller reads as a version-0 document — the original create-window
    defect. In the MODIFY window withdrawing yields the stale cache: wrong, harmless, and it
    refuses the next save. Withdrawing is only the safe direction where there is something
    safe to withdraw TO.
  - **Two claims that survived the fix and were still wrong, both found by re-reading rather
    than by any gate.** `markFrontmatter` said starting a fresh chain "stops this set growing
    for the life of the session" — it resets only when a write OBSERVES the cache caught up, so
    the real bound is the writes inside one un-drained parse window, and a queue that never
    drained would grow it. And the five writers disagree on how an INSERT spells "nothing to
    supersede" — four pass `{ reading: undefined, stat }` because `cacheReading` is branch-free
    by design, `ObsidianPlanRepository` splits its arms and passes none — which is equivalent
    (a fresh path leaves the chain empty either way, so the stat an insert records is DEAD),
    and nothing said so. Both are now written to what the code does, and the equivalence is
    pinned by a pair of cases rather than asserted, because "these two spellings mean the same
    thing" is exactly the sentence that stops being true without anything failing.
  **Third instance, same shape, found the same way — by running the plugin.** `FakeVault`'s
  `create` accepted a path whose PARENT FOLDER did not exist; Obsidian refuses one. So
  `PlanGeometryStore` had no `ensureFolder` in front of the geometry sidecar — the project,
  plans and zones folders each get one from the repository that writes into them, and
  ADR-011's `Geometry/` is a folder no note ever lands in — and on a fresh vault the first
  write of the first plan ever saved failed with "the geometry sidecar could not be
  created". Making the fake refuse turned **86 tests** red. The lesson that generalises: when
  a fake stands in for something that ENFORCES a precondition, the fake has to enforce it
  too, or the precondition is only ever checked in production.
  **Fourth instance, found by review rather than by a gate.** The slice 8 e2e rig drove
  gestures with bare `pointerdown` events that no `pointerup` ever followed — a sequence
  no mouse can produce, since a real click always delivers both. `ToolManager` clears its
  in-flight flag on `pointerUp`, so between two vertices of a polygon the flag is false,
  and Escape-cancels-the-drawing was certified by a test whose event stream never left
  the state the flag models. The fix (cancelGesture reaches any active tool) is fine; the
  lesson is about the RIG: a simulated event stream must respect the grammar of the real
  input device — clicks are down+up pairs, drags are down/move…/up — and the rig now
  spells them that way (`click()` in `zoneEditing.test.ts`), so the next gesture test
  cannot accidentally model an impossible input.

  **Fifth instance, and the THIRD face of the rule** — the one the heading gained the word
  "harsher" for. `tests/harness/planEditor.ts` handed the browser harness
  `unavailablePlanEditorCommands()`, the bundle a session with unrecovered settings gets, under
  a comment reading "every write refuses". But that bundle also carries `zoneInspector`, a READ
  (SDD §59 groups the Inspector query with the commands it shares a selection with), and the
  refusal refused it too — on a page whose fixture holds the zone in full. `InspectorDto` has no
  error variant, so a failed read and an empty selection are the same `{ kind: 'empty' }`: the
  canvas showed the seeded Kitchen selected and the Inspector showed nothing, with no error
  anywhere and two of the five shell regions contradicting each other. The lesson generalises
  past this bundle: a stand-in that REFUSES what production answers turns a tool built for
  looking into one that shows a false picture, and it does it silently wherever the consumer has
  no shape for an error. A refusal bundle is the honest stand-in only where the real thing would
  also have nothing to give.

  **The FOURTH face of the rule, and the one that hides a defect completely: FASTER than the
  real thing.** `FakeLeaf.openFile` and `FakeLeaf.setViewState` each established their leaf's
  view state SYNCHRONOUSLY, where Obsidian reads a file or runs a view factory and `onOpen`
  first. That models a guarantee `Promise<void>` does not make — nothing in that signature
  says the side effect has landed before the promise resolves — and the consequence is worse
  than a thin fake's: the racing second call always won the lookup, so a regression case
  written for the duplicate-tab race PASSED against the live defect. Measured both ways, in
  both files. `FakeVault.createFolder` was the same rule's older face, kind rather than fast:
  idempotent where Obsidian throws on an existing folder, one method away from a `create` that
  already refused a duplicate file. **All three corrections cost 0 tests**, which is the figure
  worth remembering beside the 86 and the 65 for the same reason those are: the blast radius
  is not the shape. When a fake stands in for something ASYNC, ask what its signature promises
  rather than what one implementation happens to do first — and where the fake must stay
  fast, say so, because "faster" reads exactly like "correct" from every green test.

  **And a fake's speed changes what a test's EVENT STREAM means.** `registration.test.ts` drove
  a ribbon click and a command invocation one `await Promise.resolve()` apart — an input no
  human can produce — which was harmless until `revealCandidate` learned to coalesce in-flight
  activations, at which point the case was asserting on a gesture that had not happened. The
  gap between two human gestures is a MACROTASK turn (`tests/helpers/async.ts`'s `settle()`),
  never a counted number of microtask hops: a count is a fact about today's implementation and
  goes stale silently, in the direction of a green test.
- **A global a dependency installs is a global this plugin has to remove.** Konva assigns
  `window.Konva` at module scope, so every plugin load re-runs it; nothing took it off, so
  deactivating and reactivating logged `Several Konva instances detected` at `console.error`
  and kept the previous load's whole bundle reachable from `window`. That is what finally
  earned `onunload` an existence — it releases the global, and only while it is still the one
  that load claimed, since another Konva-bundling plugin may have replaced it since.
  `pdfjs-dist` had the same shape (`globalThis.pdfjsWorker`) and lost it by ceasing to be
  bundled. Check what a new dependency writes to `window`, and check it in the BUILT bundle
  rather than in the dependency's docs.
- **A test that writes into a directory another test WALKS is a race, and the exclusion has to
  live with the walk rather than with whoever remembered it.** `tests/build/lint-edited.test.ts`
  plants real `.vue` probes under `tests/harness/` — it must, because only a path matching
  ESLint's `VUE_FILES` exercises the Vue rules those cases exist for — and TWO other files walk
  that directory in parallel workers. `lint-scope.test.ts` excluded them and carried a careful
  argument for why; `harness.test.ts` never did, so it listed a probe and then READ it, losing
  the race: `ENOENT … lint-edited-probe-1.vue`, on a tree with no source change at all,
  reproduced on a stash of the branch and therefore nothing to do with the change under review.
  `tests/helpers/plantedProbe.ts` now owns both the NAME and the predicate, with the planter and
  both walkers importing it, because a naming convention two files agree about by hand is one
  rename away from silently reaching nothing. Three things came out of it:
  - **Hoisting the working version verbatim would have been a silent no-op on one CI leg.** The
    regex was `/^tests\/harness\/…/` and its original caller builds `${dir}/${entry.name}`;
    `harness.test.ts` uses `path.join`, which is a BACKSLASH on Windows. Measured as a mutation:
    restoring the POSIX-only shape reddens two cases of `planted-probe.test.ts`. **A predicate
    moving to a second caller is a predicate meeting a second spelling of its input**, and the
    old caller's correctness says nothing about the new one's.
  - **A comment naming a helper that does not exist reads exactly like one naming a helper that
    does.** `lint-scope.test.ts` said "see `isPlantedProbe`" while the thing was called
    `PLANTED_PROBE`, and a grep for the name it gave returned that comment and nothing else.
    Now it is the real name, in a real module.
  - **Removing a `const` orphans the docblock above it**, which is this file's own
    attached-docblock rule read backwards: the paragraph about the probe regex was left sitting
    over `walk`, describing something two definitions away. Nothing in any gate reads whether a
    docblock still belongs to what follows it.
- `tests/**` has a larger line budget than `src/**`, not none. The one suite without a cap
  is the one that grows into the place tests hide.

## Claims, and the checks under them

Every rule here was broken in the project this harness came from, several inside the change
that was fixing the previous instance.

- **Write the guarantee to the check, never ahead of it.** When a check cannot reach the
  whole claim, narrow the sentence rather than leaving the wider one standing. A guide that
  promises more than lint and the suite deliver is the same defect as an unchecked comment,
  and harder to catch because it reads as settled. If narrowing makes the sentence ugly, the
  sentence has become honest and the ugliness is the information.
- **A category invariant is checked at the forbidden thing, not by listing the places.**
  "Nothing does X" cannot be verified by driving the paths someone thought of; the next path
  is the one that breaks it. Put the check on the call — a lint rule, or a spy on the call
  itself — so it holds for code not yet written, and name the spelling it does see.
- **Measure a set with an instrument that can see all of it, and test the instrument
  first.** A grep for `foo(` misses `foo<T>(`. Both happened there, and both times the wrong
  count was already being used as the evidence for a decision.
- **A docblock that says "the only place X" gets a `grep` in the SAME edit**, and the
  sentence is then written from what the grep printed. Slice 11's review rounds counted
  eleven sentences promising a category where the code held a list — three of them
  introduced by the very changes fixing the earlier ones — and the two that cost BEHAVIOUR
  rather than only accuracy were both "only"
  claims. `guardCommand` wrapped `execute` and the docblock called that the boundary, while
  the Inspector dispatches an override through `executeWithVersion`: wrapper present, test
  green, door open. And `notifyError`'s header called itself "the only [door] an `AppError`
  may take" while two call sites in `src/plugin/` hand-spelled
  `notify(toUserMessage(getLanguage(), …))` — a spelling the notice-door lint rule's own
  docblock named as CORRECT, so one slice declared the same shape forbidden in one file and
  blessed in another, with neither aware of the other. Counting is necessary and not
  sufficient: the sentence has to be checked against the measurement as carefully as the
  measurement was checked against the code, because slice 11 twice wrote a false sentence
  FROM a correct count.
- **Address code by name, not by position.** Selectors, symbols and paths survive an edit;
  line numbers are correct until the next insertion above them.
- **A table that enumerates code goes stale; a table that states a rule does not.** Name a
  module only where the sentence is *about* that module.

## Gotchas

- The `obsidian` devDependency is pinned to the FLOOR **exactly** (`1.13.0`), not to npm's
  newest and not to a range over it, so the compiler refuses an API `minAppVersion` does not
  promise. `tests/release/manifest.test.ts` holds that pairing. Raise both or neither.
- **`engines.node` is a RANGE, and a measurement rather than a decision.** Every dependency
  renegotiates it silently. `>=22` was already false before oxlint arrived, and the obvious
  repair — raise the floor — was still wrong at the other end: eighteen installed packages
  support `^22.x` and `>=24` while excluding Node 23, so any unbounded floor claims a
  runtime the toolchain refuses. **A bound is not a range**, and a check that reads one
  bound only finds the defects living at that end.
  `tests/build/engines.test.ts` compares the whole declared range against every installed
  package with npm's own `semver.subset` — the instrument that decides this in reality is
  the one that should decide it here. What it cannot see: a constraint stated anywhere but
  `engines.node`, and a package this platform did not install.
- `@types/node` tracks the `engines` floor, never npm's newest — as closely as npm allows,
  which is not exactly: the floor is `22.22.2` and `@types/node` stops at `22.20.1` on the
  22 line, so `^22.20.1` is the nearest thing that exists. TypeScript upgrades are
  bounded by what `typescript-eslint` declares as a peer — losing lint is the cost.
- **Vite's minifier strips every comment**, legal ones included — measured, both as
  `output.banner` and in the source. There is no source-pointer banner on the bundle for
  that reason; `vite.config.ts` says where the pointer lives instead.
- `output.exports: 'named'` in `vite.config.ts` is about Obsidian's loader, not bundling: it
  produces the `exports.default` shape esbuild gave every plugin built from the sample repo.
  Which shape Obsidian accepts cannot be checked here, so it takes the one with a record.
- Two flat-config blocks matching one file **override** a rule rather than merging it, and
  it is the RULE KEY that decides, not the rule's purpose. A per-directory block that
  forgets to repeat the shared `no-restricted-syntax` selectors silently drops every one of
  them — and the same trap is live on `no-restricted-globals`, which
  `eslint-plugin-obsidianmd` sets across `src/` to ban `app`, `fetch` and `localStorage`:
  the `core`/`domain` DOM block had been overriding that list since it was written, so `app`
  — the global the marketplace review bot rejects for — was rule-level unbanned in the two
  layers least likely to notice. Both `no-restricted-globals` blocks spread the plugin's own
  list now, derived from its config object rather than transcribed. Read the exposure
  narrowly: `no-undef` still reported a bare `app` at severity 1 and `--max-warnings 0` fails
  warnings, so the gate would have reddened — under the wrong rule, with the wrong message.
  A different rule KEY merges, which is why the DOM block can add to the Obsidian ruleset's
  globals only by restating them.
- **PowerShell 5.1 writes a BOM** (`Set-Content`/`Out-File -Encoding utf8`), and
  `JSON.parse` refuses one — a BOM'd `manifest.json` broke every lint run here once, with
  an error pointing nowhere near the cause. Write files with node or an editor;
  `tests/build/encoding.test.ts` refuses the BOM either way.
- Fallow resolves an interface's members through an **explicit type annotation**, not a
  property access: annotate the local (`const x: PortType = …`) rather than reaching for
  `usedClassMembers`, which is for members a framework invokes and would hide a dead one.
- Marketplace rules (enforced by `npm run lint` plus review): sentence-case UI text, no
  special characters in the manifest description, no inline styles, `normalizePath` on user
  paths, no global `app`. The recurring rejections are listed in `docs/setup/publishing.md`.
- Release tags equal the `manifest.json` version with NO `v` prefix (`.npmrc` sets
  `tag-version-prefix=""`), and `CHANGELOG.md` gains its dated section in the same pull
  request as the bump, as a second commit — `npm version` refuses a dirty tree. Both are
  checked (`tests/release/`), and the whole procedure is [`RELEASING.md`](RELEASING.md).
  The release workflow refuses to publish a commit `main` does not contain or whose CI
  run is not green — the "Require a green CI run" step in
  `.github/workflows/release.yml`. That guard matches CI's job by the name `verify`;
  renaming the CI job means updating the guard in the same edit, or every release times
  out waiting for a check that never reports.

## Deliberately absent

Not oversights; each has a trigger.

- **dayjs**, and nothing else on the SDD's stack. Installing a dependency nothing imports
  fails `npm run analyze`, so each arrives with its first real use — scheduling, which does
  not exist yet.

- **vue-router**, considered explicitly at design slice 21 because that slice introduced
  navigation and a router is the canonical Vue answer to it. Four reasons, and the first is
  the one that decides: **its product is URL binding, and an `ItemView` has no URL** — it
  would be instantiated with `createMemoryHistory()`, which reduces it to a state machine
  keyed by path-shaped strings, a `v-if` in a `/projects/:id` costume. It would also be a
  SECOND history stack competing with the one the pane's back arrow already drives (nothing
  errors; the two quietly disagree, which is worse), a second authority for a fact
  `RenovationProjectView`'s view state now owns outright, and a dependency bought for one
  binary state.

  **The trigger is a third level of nesting AND a genuine need for a history independent of
  Obsidian's** — both, not either. *"Epic 4 arrives"* is explicitly NOT the trigger, and that
  is a measurement rather than a hedge — and the measurement had to be corrected once, which is
  the useful half: this sentence said "Epic 4's whole navigation set" over SIX destinations, and
  PRD Feature 4.1 lists SEVEN (Overview, Spaces, Design, Work, Budget, Schedule, **Documentation**
  — the one dropped). It was also wrong about its own scope: 4.1 is one feature of Epic 4, which
  also carries the project switcher (4.2), breadcrumbs (4.3) and context preservation (4.4).
  The argument survives both corrections, which is why it is corrected rather than withdrawn:
  seven destinations fit in `{ projectId, section }` exactly as six do — one more key rather than
  a router — and 4.3 and 4.4 are DERIVED from that state rather than additional history, while
  4.2 is the picker this slice already built. Found by a reviewer reading the PRD rather than the
  sentence.

  **decimal.js is NOT on this list any more.** It arrived with slice 9's money arithmetic
  (ADR-010) and this line said otherwise for two slices. `core/money/Money.ts` is the ONLY
  module that touches a `Decimal` for a monetary amount — `amount` is a decimal STRING
  across every boundary, because a float is exactly what ADR-010 refuses — and quantities
  carry a `Decimal` directly. Three decimals is the figure that catches a coercion:
  `594.005` is not representable in binary floating point while `99.99` survives one.

  **Vue, Pinia, zod, konva and vue-konva are NOT on this list any more**, and
  this paragraph is the record of what their arrival cost, because the next arrival pays
  the same. `@vitejs/plugin-vue` is
  one line in EVERY config that transforms source — `vite.config.ts`,
  `vite.harness.config.ts` and the standalone `vitest.config.ts`, which is three here, not
  the two a generic project has — and `tsc` became `vue-tsc` in the same edit.
  [`docs/setup/vue-conventions.md`](docs/setup/vue-conventions.md) carries the conventions
  and the lint rules that enforce them, but it was written against a project with two Vite
  surfaces and names neither `test-build` nor the coverage include. The full contract for
  that arrival, as a superset of it and scoped to the gates this repository actually has,
  is design slice 1's Vue arrival checklist
  ([`docs/tasks/01-plugin-bootstrap-and-composition-root.md`](docs/tasks/01-plugin-bootstrap-and-composition-root.md)),
  recorded there as complete. Read it as the reference for what a NEW dependency has to
  wire, not as work still to do.

  **What the canvas stack cost, since it is the newest bill and none of it was obvious.**
  `konva` is `vue-konva`'s PEER dependency: `src/` never names it (the components use
  `<VStage>` and friends), so `npm run analyze` reads it as test-only and would have it
  moved to devDependencies — which would build here and fail in a vault. It is in
  `.fallowrc.json`'s `ignoreDependencies` with that reason. The bundle went from about
  60 KB to **488 KB** at design slice 5's close; that is what ADR-003 and §54 cost, and it
  is worth knowing before the next dependency. **488 KB is that slice's own figure, not
  today's** — eleven slices of feature work later, `dist/main.js` measures **670.06 kB**
  (gzip 211.08 kB) as of design slice 16's close, verified by running `npm run build` rather
  than carried forward from an earlier entry here. Read every bundle figure in this file the
  same way: as the size AT THE SLICE NAMED, not as a standing total nothing re-measures.

  **`pdfjs-dist` is a devDependency, and that is the whole point of the entry.** It was a
  production one for exactly one increment, and the bill was 1728 KB of a 2216 KB bundle —
  78%, parsed on every Obsidian start by every user whether they ever opened a PDF. What
  replaced it is Obsidian's own copy, through the `@public` `loadPdfJs()` the pinned
  `obsidian` devDependency already proves is promised at `minAppVersion`. Three facts went
  with it, all of them now TEST-only: the **legacy** build, because the standard one
  constructs a `DOMMatrix` at module scope and cannot be imported under jsdom at all; the
  `globalThis.pdfjsWorker` escape hatch, which a one-file plugin needed because it had no
  `pdf.worker.js` to point `GlobalWorkerOptions` at, and which the suite turns out not to
  need either (pdf.js's own node path resolves the worker beside itself); and main-thread
  parsing, since Obsidian's copy runs a real worker. `useWasm: false` survives with a new
  reason — Obsidian ships the WebAssembly but `wasmUrl` is a `getDocument` parameter its
  viewer sets only for itself. The residual gap is that the suite runs OUR pdf.js and
  production runs Obsidian's — the same version today, verified, and nothing keeping them
  so. All of it is written down in
  `src/presentation/editor/layers/background/pdfRaster.ts` and in the mock's `loadPdfJs`.

  The suite paid too: jsdom implements no canvas, no `DOMMatrix`, no `Path2D` and loads no
  images, so `tests/helpers/canvas.ts` puts a REAL rasterizer (`@napi-rs/canvas`, prebuilt
  per platform — no build toolchain, which is what makes it viable on all four CI legs)
  behind jsdom's `<canvas>` and `<img>`. An inert stub was built first and is refused in
  that file's header for the reason this project already knows: a fake kinder than the real
  thing turns a shipped crash into a green suite.
- **The empty layer directories the SDD draws.** Git cannot hold them and lint already
  guards them; create one when a module goes into it.
- **`eslint-plugin-oxlint`.** It switches off the ESLint rules oxlint already covers,
  which on `src/` is most of core `recommended`. Two linters agreeing is not a defect —
  one fix satisfies both, and neither list can quietly become a rule's only owner.
  Thinning one to speed up the other trades a gate for seconds. Add it when ESLint's
  runtime is a cost somebody can name.
- **`oxlint --type-aware`.** It needs `oxlint-tsgolint`, and the type-aware rules this
  project actually leans on — `no-floating-promises`, the Obsidian ruleset — already run
  under ESLint's project service. Add it for a type-aware rule ESLint does not have.
- **A `docs/` register gate** (`npm run docs` in the source project: every wikilink
  resolving, every module specified by a note, opt-in claim citations). Add it when `docs/`
  has a convention worth enforcing — see section 5 of `docs/setup/quality-harness.md`.
- **`npm run perf`** and the icon renderer in the harness. The first needs a render cost to
  argue about; the second needs the first `setIcon` call, and until then every icon would be
  an invisible gap in the tool built for looking.
