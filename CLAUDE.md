# Renovation Planner — agent guide

An Obsidian plugin for planning a renovation: plans and zones, assets and quantities, costs,
trades, work packages and a schedule. The target architecture is
[`docs/sdds/obsidian-renovation-planner-SDD.md`](docs/sdds/obsidian-renovation-planner-SDD.md)
and the product intent is in `docs/prds/`. **Read the SDD before proposing structure**: it
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
Everything past this point is feature work on a proven template. Slice 11 has since closed
the first half of the cross-cutting pair — the Error Boundary, the logging policy,
diagnostics and the data-safety rules. What is NOT done is slice 12 (the fixture vaults and
the architecture-enforcement harness) and every surface slices 13–17 name.

There are **two workspace surfaces**, both mounting their own isolated Vue app (SDD §12) —
nothing outside a view knows it is Vue. The **Renovation project** view is a singleton with
a ribbon button and a command, and it draws **four things and still no project list** —
slice 17 owns the list, and until it lands every one of these is what the pane holds instead
of one, never beside one. `ViewRoot.vue` renders slice 14's `renovationProject.noProjects`
empty state; the mapped failure sentence for the refusing `AppError`'s own code
(`.rp-view-message`, via `trError`, so unrecovered settings and a vault fault say different
things); a loading line in that same region while the read is in flight; and
`.rp-view-notice`, the one ADDITIVE one, when SOME project notes refused
(`view.project.some-unreadable`). Slice 15's `DialogHost` mounts here too and is invisible
until something opens a dialog. `ListProjects()` resolves to a `ProjectListResult` —
`{ projects, unreadable }`, not a bare array; the PORT below it answers a `ProjectListing`,
`{ loaded, refused }`, and the rename across that seam is deliberate — and the empty state is the `'ready'` status
with BOTH halves clear: an empty list with `unreadable > 0` is a vault that has projects this
build could not read, so it gets the notice and no "no projects yet". The **Plan editor** is per-plan (several
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
  locale file would agree with a typo. `NOTICE_TEXT_BAN` puts the rule at the two notice
  doors as this repository SPELLS them — a bare `notify(...)` or `new Notice(...)`, matched
  on `callee.name`, so the same two functions reached through an object (`o.notify(...)`)
  are invisible to it; the long-form paragraph further down carries the rest of that list.
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
- **An absent `actionLabel` is a decision with a reason, not a gap, and there are two of
  them, not one.** `renovationProject.noProjects` has no button because its hand-off — a
  project-creation form — is slice 16's, and slice 16 `dependsOn` slice 11, neither of
  which exists yet. `planEditor.noBackground` has no button for a different reason:
  slice 5's background picker is the `set-plan-background` plugin COMMAND, which is not a
  member of `PlanEditorCommandServices`, and the editor's Vue tree cannot reach it without
  either widening `PlanEditorContext` (not this slice's surface to widen) or reaching for
  the global `app`, which the marketplace rules refuse. Both render no button rather than a
  live control that does nothing — the exact failure mode the amendment exists to avoid —
  and `content.test.ts` asserts both absences, so adding either is a deliberate, tested
  change rather than an oversight closing quietly. `planEditor.noZones` is the one entry
  that keeps a button, because its hand-off (`activeToolId = 'draw-polygon'`) already
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
  **No empty state carrying a button is graded by that case or any other**:
  `renovationProject.noProjects` has none, and the Plan Editor case's default fixture
  resolves to `planEditor.noBackground`, the other buttonless entry — `noZones`'s
  action button is exercised by `emptyStateOverlay.test.ts` alone, and by no
  accessibility scan.

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
  `cancelInterruptedGesture` states that once — the two tool-SWITCH paths had written it out
  longhand and the blur door asked it at neither, which is this file's recurring shape from
  its third side: not "state the rule again more carefully" but "notice one question is being
  answered in three places and two of them are copies".
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

**Which plan the editor opens is a PICKER**, not the active file. `open-plan-editor` used a
`checkCallback` requiring the active note to be a Plan, which kept it out of the palette in
every vault that had no plan notes — and nothing in the app could create one, so that was
every vault. It is a plain callback over a `FuzzySuggestModal` of the Project Index's plan
entries now. The command ID did not change, because a user's hotkey is bound to it.

**`create-sample-project` is SCAFFOLDING and says so in its name.** One command seeds a
project, a plan and five zones through the real `CreateProjectCommand` /
`CreatePlanCommand` / `CreateZoneCommand`, then opens the editor on what it made — the
vault-side equivalent of `npm run harness`, and the only way zones exist at all before
slices 6 and 8 can draw one. `src/plugin/sampleProject.ts` names what deletes it — slice
16's creation forms, NOT slice 15, which built the dialog framework those forms mount in and
no form that names a project, and NOT slice 14 either: `renovationProject.noProjects` ships
with no action at all (Amendment 1), so slice 14 wired nothing that could have replaced this
module — and why the partial notes a failed seed leaves behind are deliberate.

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
  that one**: it refuses a `.message`/`.stack` read anywhere inside a `notify(...)` or
  `new Notice(...)` call, and a bare string literal as a direct argument to either — slice
  11's Definition of Done item 3 ("never a raw exception message, stack trace or internal
  file path; produced by `t()` rather than by a literal or by `AppError.message`") put at
  the forbidden call, because that door was the one user-facing surface no gate could see.
  It cannot see a value one hop away (`const text = e.message; notify(text)`), a template
  literal carrying raw English with no member access in it, a notice raised under a third
  name, or either door reached through a MEMBER EXPRESSION (`o.notify(e.message)`,
  `new n.Notice(e.message)`) — both selectors key on `callee.name`, which a member-expression
  callee has none of; `tests/build/notice-text-boundary.test.ts` drives all of that through real fixture
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
  99/99/99/98 (statements/functions/lines/branches), against 99.34/99.25/99.58/98.11 as of
  slice 11. **Read branches again: 98.11 against a floor of 98, which is about two covered
  branches of headroom, one branch costing 0.047.** So an untested new arm does not "reduce
  coverage", it fails the gate — plan the test with the code rather than after it. Do not
  read a figure from this line as current; run `npm run test:coverage`. The exact numbers,
  which increment moved them, and what every remaining uncovered arm IS live in
  `vitest.config.ts`, which also carries the ratchet policy: floors only rise, and they
  rise to what a FINISHED increment measures — so an increment whose rounded-down figures
  equal the floors already in force ratchets NOTHING, which is what slices 5, 15 and 11 did.
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
  the whole document. A live vault (`npm run test-build`) remains the only place
  appearance is verified.
- **analyze** — fallow: dead files and exports, duplication, complexity against coverage,
  and dependency hygiene.

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
  "faithful" read wider than it is.

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

Three properties it is built to have, each with a test in `tests/build/lint-edited.test.ts`:

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
nothing type-checks `tests/**` (vitest transpiles without checking) **except three entries in
`tsconfig.json`'s `include`**, each there for its own reason. Three, counted in the file
rather than remembered: slice 11 added the third and this sentence said "two" for a slice.

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

- **An invariant asserted in a comment gets a test that fails without it, and the test is
  watched failing.** Revert the fix, run it, see red, restore. On one pull request in the
  source project, six of ten review findings were comments precisely stating the rule the
  code beside them broke. A confident paragraph is evidence of intent and of nothing else.
- **A fake must not be kinder than the real thing, not thinner than it, and not HARSHER than
  it.** A DOM helper
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
  wrote here" — when there is NO cache entry, and it keys on the cache ENTRY rather than on
  `entry?.frontmatter`, because `getFileCache` answers `null` for "never parsed" but an
  object with no `frontmatter` for "parsed, and the user deleted it". Collapse those two and
  a note whose frontmatter was deleted is served this plugin's own stale bytes forever. The
  fake states what it models and what it still does not: the create window, not the parse lag
  after a modify, where Obsidian holds a STALE entry rather than none.
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
- **A global a dependency installs is a global this plugin has to remove.** Konva assigns
  `window.Konva` at module scope, so every plugin load re-runs it; nothing took it off, so
  deactivating and reactivating logged `Several Konva instances detected` at `console.error`
  and kept the previous load's whole bundle reachable from `window`. That is what finally
  earned `onunload` an existence — it releases the global, and only while it is still the one
  that load claimed, since another Konva-bundling plugin may have replaced it since.
  `pdfjs-dist` had the same shape (`globalThis.pdfjsWorker`) and lost it by ceasing to be
  bundled. Check what a new dependency writes to `window`, and check it in the BUILT bundle
  rather than in the dependency's docs.
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
  60 KB to **488 KB**; that is what ADR-003 and §54 cost, and it is worth knowing before
  the next dependency.

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
