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
diagnostics and the data-safety rules, and slice 13 has closed the second half — the notice
queue and the save-state indicator, the shared vocabulary any view or command reports
through. What is NOT done is slice 12 (the fixture vaults and the architecture-enforcement
harness) and every surface slices 16 and 17 name.

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
  `cancelGesture()`; a rejected close keeps the vertex buffer.
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
  zone", while a measurement renders solid and open with a marker at each end. `pointerMove`
  had been an empty method under a comment deferring the preview "until a rendering seam
  exists", and that seam had existed since slice 8 — so the gesture drew nothing at all, and
  an empty method has no behaviour for any test to disagree with. Found by a human
  calibrating a plan.

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
`grep -rn "new Notice" src/` prints two lines, both in `notify.ts`, and one of them is a
comment. `NOTICE_TEXT_BAN` also watches the constructor and not only the wrappers, so
bypassing them is not an escape from the TEXT rule either. Four severities
with a translated label beside the colour (`AUTO_DISMISS_MS`: 4000 for `success`, 6000 for
`info`, `null` for `warning` and `error`, so the two that exist to be noticed cannot expire).
`activateNotices()` runs once from `onload` and `disposeNotices` is one more entry on the
`disposers` list Konva's global got to first. On the other half, `SaveStateStore` is one per
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
  vault, and in no test. Reading `containerEl.isConnected` means a dismissal by any mechanism
  frees the slot, and a changed gesture in a future Obsidian degrades to "the slot frees on
  the next push" rather than to a wedged queue. The `click` listener is a PROMPT to sweep, not
  the mechanism.
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
- **Four contract requirements are knowingly unmet, and where they are written down matters
  more than that they exist.** `docs/components/Toast.md` and
  `docs/components/Save-state indicator.md` both name this slice in their frontmatter and
  neither was opened until review round eleven. No mark beside the word on either surface
  (both contracts say "Both, always, never one"; a word plus colour satisfies SDD §85 and not
  them, and a CSS-drawn glyph would close it without introducing `setIcon`); no moving
  indicator for `Saving`; no retry emit on `Save error`, which is UNDESIGNED rather than
  merely unbuilt, since the tracker sees a dispatch outcome and not a re-runnable command, and
  re-running a failed `undo` is not idempotent; and the Toast live region is attributed on a
  container that APPEARS, which is the shape `Toast.md` explicitly refuses and calls "the one
  that decides whether this component works at all for the users it exists for". All four are
  in the manual case and in `docs/tasks/13`, because no jsdom test can observe an announcement
  either way and a gap nobody inherits is a gap rediscovered from scratch.
- **`runtime.ts` is at EXACTLY its 400-line `max-lines` cap**, which is why one object literal
  in it is collapsed onto a single line under a comment saying so. Measured rather than
  asserted: expanding that literal back to its four natural lines makes `npx eslint` report
  "File has too many lines (403)". The rule skips blank lines and comments, so the next change
  adding a line of CODE there — of any size — trips it, and the answer then is an extraction
  or a split rather than a second collapsed literal.

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
  99/99/99/98 (statements/functions/lines/branches), against 99.38/99.40/99.60/98.24
  measured at the end of slice 13. **Read branches again: 98.24 against a floor of 98, which
  is about five and a half covered branches of headroom, one branch costing 0.045 — and
  FUNCTIONS are tighter still, at about four and a half, one function costing 0.086.** So an
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
