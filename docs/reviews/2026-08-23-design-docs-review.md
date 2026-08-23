# Review: design-slice docs, ADRs and eslint change (PR #1, merge `85eba4b`)

Reviewed 2026-08-23: the 17 design slices under `docs/design/`, `docs/design/README.md`,
the ADRs, the issues, `docs/README.md`, and the `eslint.config.mjs` change. 16 finder
angles, findings deduplicated and adversarially verified against the actual files.
Line numbers were verified at review time; re-locate by the quoted text if edits move them.

Ground rules for fixing (from CLAUDE.md and the docs' own conventions):

- The SDD stays verbatim as received. Where a fix means "the SDD's position needs
  refining", it lands in an ADR or a slice doc that names the SDD section it refines
  (the ADR-009 pattern), never in the SDD itself.
- Where a slice's Design section and its Interfaces & Contracts block disagree, the
  Design section's reasoned position wins; fix the contracts block.
- Where the README and a slice disagree, fix whichever is wrong on the merits and
  make the other reference it — do not leave two statements.
- Section C items are judgment calls: decide, then write the decision down where the
  next reader will look. "Considered and declined because X" is a valid fix.
- `npm run check` must pass when done. Do not fix Section D items — they were checked
  and refuted.

## A. Confirmed defects — fix all

### Internal contradictions an implementer would build from

1. **`docs/design/09-quantity-and-cost-engine.md:284`** — The Interfaces & Contracts
   block types `Quantity.unit` as `UnitKind` (also `toMeasuredQuantity` at 303,
   `runQuantityEngine` at 319) and omits `MeasurementUnit`/`UNIT_KIND` entirely.
   The Design section (151, rationale 133–147) says `unit: MeasurementUnit` and the
   two vocabularies must stay distinct. Slice 10 depends on the Design version
   (`10:112`, `10:138`, `10:258`, `10:1340`). Fix the contracts block to
   `MeasurementUnit` and add `MeasurementUnit`/`UNIT_KIND` to it.

2. **`docs/design/09-quantity-and-cost-engine.md:202`** — Cost pipeline diagram:
   `percentageOf(subtotal, discount.percent ?? 0)`. `discount` is optional (332),
   `percent` required, so `?? 0` never applies and an absent discount dereferences
   undefined. Fix to `discount?.percent ?? 0` (the tax step at 206 shows the pattern).

3. **`docs/design/09-quantity-and-cost-engine.md:287`** — `DerivedValue<T>`/
   `effectiveValue` filed under the header `// core/result (extended in this slice)`,
   but the Design section (96–99) explicitly refuses `core/result/` and mandates
   `core/derived/`, as does the DoD (413). Fix the header to `// core/derived`.

4. **`docs/design/06-editor-tool-framework-undo-redo-and-inspector.md:189`** — The
   undo expectation-chain updates an adapter's expected `EntityVersion` only from its
   own dispatches and forbids re-reading (206–209), reasoning only about foreign
   writers. The plugin's own interleaved commands on one entity bump the version too:
   move (holds V1) → rename (V2) → undo rename (V3) → undo move dispatches
   expected=V1 against V3, is refused, and per the failed-undo rule (254–257) stays
   on the undo stack where every retry fails identically. The design needs a
   mechanism for the plugin's own in-order writes — e.g. CommandHistory forwarding
   version updates to older entries touching the same entity, or an explicit
   documented decision that undo-past-a-same-entity-edit is unsupported.

5. **`docs/design/06-editor-tool-framework-undo-redo-and-inspector.md:552`** —
   `SelectionStore` (334 vs 552), `SnapService` (382 vs 580) and `UndoableCommand`
   (137 vs 565) are each declared twice in this one document, and the copies have
   already drifted (`readonly` on `selectedIds` exists only in the 552 copy). Keep
   one authoritative declaration in Interfaces & Contracts, make the Design prose
   reference it.

6. **`docs/design/10-assets-requirements-and-the-end-to-end-loop.md:326`** (twin at
   438) — Handler examples iterate the awaited value of
   `requirementRepository.listByZone` directly, but the slice's own port (1383)
   returns `Result<Loaded<Requirement>[], PersistenceError>` and 1396–1399 restates
   the inspect-every-Result rule. Fix the examples to unwrap and handle the err path.

7. **`docs/design/10-assets-requirements-and-the-end-to-end-loop.md:818`** — Restated
   `DeleteZoneInput` ("slice 3's input, widened here") drops slice 3's
   `expected?: EntityVersion` (03:496), and the prose at 810 says "widened by one
   optional field" while the code adds three. Restore `expected` and fix the count —
   or replace the restatement with a reference to slice 3 plus only the new fields.

8. **`docs/design/10-assets-requirements-and-the-end-to-end-loop.md:1097`** — Claims
   "infrastructure/ cannot import from application/ … enforced by lint". False:
   `eslint.config.mjs:315–319` bans only `presentation`/`plugin` for infrastructure;
   infrastructure→application is the deliberately allowed ports pattern (CLAUDE.md's
   own diagram). Narrow the sentence to what is actually checked — the discipline is
   held by convention/review, not lint — per the repo's write-the-guarantee-to-the-
   check rule. Do NOT "fix" it by banning application in the eslint block.

9. **`docs/design/12-testing-and-architecture-enforcement-infrastructure.md:304`** —
   "Three mechanisms, all already wired into `npm run check`". Only ESLint's layer
   bans exist: `vitest.config.ts` is one flat `environment: 'node'` config with no
   profiles, and fallow checks dead code/dependency hygiene, not layer boundaries.
   §8 then uses the phantom mechanisms to justify rejecting dependency-cruiser.
   Rewrite as future-tense obligations of this slice, and re-argue §8 against what
   actually runs today.

10. **`docs/design/12-testing-and-architecture-enforcement-infrastructure.md:118`** —
    The proposed category tree (`tests/unit/`, `tests/contracts/`, …, repeated in the
    DoD at 488) contradicts the bold claim at 129 ("Every test lives under `tests/`,
    mirroring `src/`") and CLAUDE.md's convention, and the profile globs (139–145)
    cover neither the mirrored layout nor the directories that exist on disk today
    (`tests/build/`, `tests/harness/`, `tests/helpers/`, `tests/release/`) — so
    implementing the profiles as written silently stops running the existing suites,
    including the lint-gate meta-tests this slice depends on. Pick ONE layout,
    reconcile tree + claim + globs + DoD, and make the globs account for every
    directory that exists.

11. **`docs/design/01-plugin-bootstrap-and-composition-root.md:280`** — Defers the
    settings-load failure's surfacing to slices 11/17, but slice 17's `ErrorOrigin`
    union (17:248–254, six members) fits no bootstrap failure and slice 17 never
    mentions bootstrap/settings/onload/data.json. Add a bootstrap origin to slice
    17's union and routing table (it demonstrably extends the union for other
    deferred cases, e.g. view-hydration at 17:170–173).

### Scheduling contradictions (README vs slices)

12. **`docs/design/README.md:139`** — "nothing later structurally depends on
    [11 and 12]" is contradicted by the README's own table row 17 (lists 11) and by
    slices 13 (13:72–73) and 16 (16:77) naming slice 11's ToUserMessage/Error
    Boundary. Narrow to what is true (parallel with 5–10; the justification holds
    only for 12).

13. **`docs/design/README.md:144`** — "13–16 can be built in parallel once slice 5
    exists" is contradicted by the table (15 → "5, 6"; 16 → "6") and by slice 13's
    own Dependencies naming slice 6's CommandHistory (13:64–65) — which the table
    row for 13 also omits (a second drift: fix the table row too). Only 14 is
    buildable on slice 5 alone.

14. **`docs/design/README.md:138`** — Slices 11/12 "can be worked in parallel with
    slices 5–10 once slice 2 exists", but the table (126) gives slice 12
    "Depends on: all". The two cannot both be the scheduling contract.

15. **`docs/design/07-calibration.md:83`** — Slice 7 declares slice 15's
    ConfirmDialog a build dependency and its DoD (624–631) requires it, but the
    README table (121) says "Depends on: 6" and README:133 says slices 7 and 8
    "depend only on slice 6". Update the README's row and sentence (7 → "6; 15 for
    the recalibration branch"), or split the DoD item so Increment 5's scope is
    honest without slice 15.

### Vocabulary and inventory drift

16. **`docs/design/README.md:82`** — The shared-vocabulary list says `Point` AND
    `ScreenPoint` "are defined once in slice 5 (`presentation/editor/viewport/`)".
    Slice 2 defines `Point` in `core/geometry` (02:347) and slice 5's DoD item 8
    requires re-export, not redeclaration. Fix the bullet: `Point` lives in
    `core/geometry` (slice 2); `ScreenPoint` and the converters are slice 5's.

17. **`docs/design/README.md:86`** — "SDD §26's three required rules" drops the
    SDD's other two persistence-validation bullets (`valid unit`, `valid transform`),
    which currently belong to NO slice (slice 2 claims only three at 02:175 and its
    DoD 553 declares §26 satisfied; slice 8 owns only the "Future" list). Assign the
    two dropped rules to a slice or record the refinement ADR-style.

18. **`docs/README.md:22`** — The folder inventory table claims completeness and
    omits `docs/design/` (18 files, created in this PR) and has no row describing
    derived-vs-received documents. Add the row(s).

### i18n

19. **`docs/design/15-modals-and-confirmation-dialogs.md:133`** — The canonical
    `openDialog` example hardcodes English (`title: 'Duplicate this zone?'`,
    `message: 'A copy will be created in the same plan.'`); also `label:
    'Requirements'` at 464 and in the test at 599. This violates the README's
    every-string-through-`t()` rule and the slice's own descriptor comment (341–346),
    and `I18N_LITERAL_BAN`'s selectors verifiably cannot catch object-property
    values, so the examples are the only teaching surface. Fix all three examples to
    resolve copy through `t()`/StringKeys, and widen DoD item 10's scope beyond
    `presentation/dialogs/` to the call sites (or state the gap honestly).

### Efficiency defects the docs prescribe

20. **`docs/design/04-persistence-and-repository-layer.md:911`** — Vault-wide index
    scan "on plugin load" (marker recovery ordered before it at 302–304; slice
    01:111–114 slots it into onload). `onLayoutReady` appears nowhere in the new
    docs, but Obsidian's guideline puts vault-wide work after it and MetadataCache
    is incomplete during startup. Add the rule once (slice 01's bootstrap sequence
    is the natural home): registration in onload, index build from
    `app.workspace.onLayoutReady`; adjust slice 04's ordering language.

21. **`docs/design/05-canvas-rendering-and-editor-shell.md:273`** — ZoneShape
    converts every point through `worldToScreen()` with the reactive Viewport as
    input — O(total vertices) per pan/zoom frame. The doc grants the Stage-transform
    mechanism to BackgroundLayer only (234–237). Keep shape points in world
    coordinates and express pan/zoom/dpr once as the Stage's position/scale, or
    document why not.

### Dead-by-design API

22. **`docs/design/04-persistence-and-repository-layer.md:771`** — `PlanGeometryStore`
    keeps a public `write(planId, dto)` whose own adjacent comment (774–777) forbids
    the read-then-write composition it enables; no caller is named anywhere
    (create/mutate/delete cover every use; the migration moves files under
    `withGlobalBarrier`). Drop `write()` from the port; keep `read()`.

## B. Confirmed-grade late findings — fix all

23. **`docs/design/12-testing-and-architecture-enforcement-infrastructure.md:449`** —
    The planted-violation lint meta-test does not work as specced: the fixture must
    sit under `src/domain/` for the layer rule to fire, where the real `eslint .`
    run reds on it; the escape (global `ignores`) makes the meta-test assert on zero
    findings and pass vacuously — the exact failure 452 says it exists to prevent.
    It also ignores the existing lint-meta-test harness (`tests/build/lint-*.test.ts`,
    `tests/helpers/oxlint.ts`). And 473's "a test (or a documented manual check at
    release time)" contradicts the slice's own 325. Respec against the existing
    harness with an explicit story for where the fixture lives.

24. **`eslint.config.mjs:402`** — The comment "It matches no file yet" contradicts
    `docs/design/01:468` ("matches a directory that has exactly one file in it") and
    becomes false the moment slice 1 lands. Reword to be true before and after
    (e.g. "matches nothing until slice 1's sink lands there").

25. **`eslint.config.mjs:405` + `docs/design/01:213`** — Two defects in one comment
    block. (a) The justification "the ruleset forbids disabling its own rules
    inline" is wrong twice: `noInlineConfig` (277) already refuses inline disables
    repo-wide, and a config-level `'obsidianmd/rule-custom-message': 'off'` in this
    very block WAS available — the real reason for keeping the info→`console.debug`
    mapping (the marketplace review bot lints with its own config, so a local
    override would not travel) is nowhere in writing. Write the real reason in both
    places or drop the mapping. (b) The "not a blanket permission" guarantee rests
    on the obsidianmd wrapper's verbatim message-string matching
    (`ruleCustomMessage.js` silently swallows non-matching reports) with nothing in
    `tests/` pinning it; add a pinning test (drive ESLint on a fixture with
    `console.log` under a fake logging path and assert it reds) or narrow the
    comment to "true as of eslint-plugin-obsidianmd <version>, unpinned".

## C. Judgment calls — decide and write the decision down

Facts verified; each is a real hazard whose remedy is a design decision. For each:
either adopt the change or add a sentence where the next reader will look saying it
was considered and why it was declined.

26. `docs/design/10:327` — Recalculation cascade: 2N sequential awaited vault writes
    inside the gesture dispatch; per-Requirement level-2 locks make the pairs
    independent, so concurrency is available. Also the direct cause of the
    undo-out-of-order hazard 04:533–541 warns about.
27. `docs/design/10:443` — `AssetUpdated` on cosmetic edits rewrites every linked
    Requirement twice (an 80-Requirement rename ≈ 160 writes ≈ visible freeze). The
    doc prices this as acceptable; the counter-design (compare against
    `calculatedFrom`) relocates the field-knowledge coupling the doc refuses.
28. `docs/design/05:206` + `08:449` — Post-commit refresh re-reads the whole plan
    (~N+1 files) though `save` already returns the written `Loaded<T>`.
29. `docs/design/04:846` — Index rebuild reads and Zod-parses every sidecar's full
    contents to recover a `planId` that is the filename by the doc's own convention
    (228–231). ADR-011 forbids deriving from the plan NOTE's path, not this. A
    filename fast-path with contents as verification preserves the ADR.
30. `docs/design/04:508` — Every single-zone mutation is a whole-sidecar
    read-parse-mutate-serialize-write, serialized per plan, no caching or coalescing.
31. `docs/design/04:254` — The sidecar-folder migration protocol (~90 lines + 6
    tests) vs extension-based vault-wide discovery (which 04:588–589 already half
    uses). Vault-wide discovery has its own costs (sync-conflict copies become hard
    errors, stranded files); decide and record.
32. `docs/design/05:136–145` — `revealPlanEditor` as a second find-or-create
    activation function beside `revealView` vs generalizing `revealView` with a
    matcher. Note: revealView cannot match on state and multiple Plan Editor leaves
    are intentional (05:92–94), so a shared internal helper may be the right shape.
33. `docs/design/06:303` — Undo stack explicitly unbounded (deliberate, session-
    bounded); entries hold whole-geometry snapshots. A depth cap is one constant now.
34. `docs/design/13:218` — `notify` as an importable module-global bound by
    `initNotifications()` vs constructor injection. The doc's Pinia argument answers
    ambient resolution, not importability.
35. `docs/design/10:499` — Open family of per-cost-type `*Changed` events with no
    generic envelope; the SDD is internally split (§32 vs §34), so this is a
    reconciliation — but reserve a shared base/payload or record why not, for the
    future budget-rollup subscriber.
36. `docs/design/10:1136` — Two-level lock hierarchy vs one wider mutex. Verified:
    a mutex scoped only to reference-graph mutations does NOT cover the compensation
    case (10:1113–1119); the honest alternative is a general write mutex, which the
    doc rejected on contention grounds — re-examine that rejection at human editing
    rates, or keep and say why.
37. `docs/design/10:1111` — The lock/marker/recovery machinery is absent from the
    slice's In-scope list and Persistence Impact section; the durable
    `SequenceMarker` has no file location, no schema-version, no migration story.
    At minimum, scope it honestly and give the marker a persistence story.
38. `docs/design/10:1199` — `SequenceMarker.progress` vs `affectedAfter`: one record,
    two writers, plus a test to police agreement. Different lifetimes are the reason
    given; single-writer (return the marker's own array on success) removes the test.
39. `docs/design/10:389` — `calculatedFrom` input snapshot vs recompute-and-compare
    on outputs (which also catches hand-edited figures). Snapshot doubles as
    human-readable provenance; decide and record.
40. `docs/design/07:238` — Calibration command restated with a local
    `CalibrationError` alias (documented narrowing — fine) but `CalibratePlanInput`
    restated twice in-doc with the `// world units (mm)` note on only one copy, and
    execute()'s undo union at 07:364 vs 07:456 genuinely disagree. Deduplicate the
    in-doc restatements; that part is a real fix, not a judgment call.
41. `docs/design/07:378` + `08:283/686` + `05:361` — Snapshot-inverse undo
    obligations hand-rolled in parallel comments across three slices with no shared
    mechanism (and the two examples genuinely differ on cascade re-emission:
    08:483–489 deliberately publishes nothing). Extract a shared contract statement
    or one helper, or name the asymmetry in both places.
42. `docs/design/08:602/620` + `06:126/560` — Slice-3 inputs and `Command<>` restated
    as full code blocks in consuming slices. Currently attributed and drift-free
    (RU3/#7 shows where this pattern already bit); prefer the slice-11 reference
    style (`// application/ports/Logger.ts — not redefined`).
43. `docs/design/15:19` + `15:180` — "Which actions need a confirmation dialog" is
    deferred to slice 17, which is an AppError router and structurally cannot answer
    a non-error question; slice 17 never mentions it. Give the decision a real owner.
44. `docs/design/15:166` — Dialog kinds are a closed three-member union, but slice 16
    specs a creation dialog and slice 14 (254) routes `openCreateProjectModal()` to
    "slice 15's modal". Add the kind or name the extension point.
45. `docs/design/13:291` — Save-state decorator flips to `save-error` on ANY failing
    result; slice 17 routes `ValidationError` to inline-only and forbids
    double-reporting. Add an error-category filter to the decorator and name which
    slice owns it.
46. `docs/design/17:232` — "'No interruptive surface' (procedure step 4)" points at
    the wrong step (step 4 renders UI; step 5 is no-surface), and 174 says "a fifth
    origin" of a six-member union (248). Fix both cross-references — or better,
    de-number them (the repo's address-by-name rule).
47. `docs/design/01:199/588` — info→`console.debug` lands in the devtools Verbose
    channel (hidden at default filter), and the level-in-line-text contract freezes
    the format by test while the `debug(event, context)` port could carry the level
    structurally. Tied to #25(a): decide once the real constraint is written down.
48. **ADR cluster** —
    `docs/adrs/0011-…:19` reverses SDD §39's colocated layout but names only ADR-002
    as superseded; add the SDD §39 supersession line (ADR-009 is the model).
    `0011:19` default `docs/geometry` vs PRD §36's `Renovation/` tree — reconsider
    the default (e.g. `Renovation/Geometry`).
    `0011:21` example filename `01JABC123.rpgeo` drops the `plan-` prefix that
    SDD §82 and slice 04:223–225 use; fix the example.
    `0002:17` + `0009:17` still say "JSON sidecar"/`.geometry.json` while ADR-011
    renamed it `.rpgeo`; add a superseded-detail note in each.
    `0010` restates SDD §49 without deciding anything, while the real decisions
    (ROUND_HALF_UP, round-once) live only in slice 09:122–128 — move them into the
    ADR or reframe it as recording a received decision.
49. `docs/issues/Forecast formula disagrees on committed cost.md:12` — cites PRD
    "F17.3", which does not exist (Epic 17's features are unnumbered); fix the
    citation, and add a reference to this issue from slice 09 or 10 so the
    resolution is findable when the rollup gets built.
50. **eslint/oxlint ownership cluster** (facts verified, remedies optional):
    the no-console policy is ESLint-owned with no oxlint backstop and no test
    detecting its removal; `.oxlintrc.json`'s "deliberately NOT here" list (72) does
    not name `no-console` and `overrides` (153) has no logging carve-out to pair
    with ESLint's; the carve-out glob has no resolution test
    (`tests/build/suppressions.test.ts` owns the `--print-config` instrument);
    `scripts/lint-edited.mjs` runs only oxlint so `console.log` in the future sink
    is invisible to the edit loop; ESLint's scope has no equivalent of
    `tests/build/lint-scope.test.ts`; and slice 01:671's Vue-widening checklist
    omits the carve-out its own line 292–293 says gets widened (fix that checklist
    line regardless).
51. `docs/prds/obsidian-renovation-planner.md` vs `docs/sdds/…-SDD.md` — the rename
    left the two received documents on opposite suffix conventions. Cosmetic; pick
    one convention and note it in `docs/README.md`.

## D. Checked and refuted — do not "fix"

- The flat-config override trap does NOT apply to the new eslint block: per-rule
  merge verified with `--print-config`; all 8 `no-restricted-syntax` selectors, the
  budgets and the layer bans survive in the carve-out directory.
- `console.log`/`console.info` DO still fail inside the carve-out (obsidianmd
  wrapper) — the comment's factual claims are accurate today (see #25b for pinning).
- The PRD rename left zero dangling references (verified repo-wide, both names).
- No BOMs in any added file; no Title Case at UI-text positions; no banned package
  named in any inner-layer code example.
- `ReferenceError` in 06:158's example would fail to compile as written (the union
  flows into `Result<void, AppError>`); slice 02 blesses type-level shadowing.
  At most a doc-hygiene nit.
- The unbounded undo stack is a named, deliberate, session-bounded deferral
  (06:303–305) — covered as judgment call #33, not a defect.
- `docs/design/README.md` does not claim authority over the SDD; its "this list is
  the bug report" line scopes itself to slices.
- The per-cost-type event family is a documented reconciliation of an SDD-internal
  split (§32 vs §34), not a unilateral override — covered as #35.
