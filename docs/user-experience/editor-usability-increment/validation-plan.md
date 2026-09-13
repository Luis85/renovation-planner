# Validation and release plan

**Proposed protocol, 2026-09-13. No participant study or native acceptance was run for this planning package.** Numerical thresholds are decision rules to agree before implementation validation; they are not measured outcomes or promises about a population.

## 1. What counts as evidence

| Evidence | Establishes | Does not establish |
|---|---|---|
| Source/command tests | Capability, invariants, state transitions and guarded writes in specified fixtures | Learnability, actual layout, native behavior |
| Current browser walkthrough | Rendered controls and actions in the named runtime/fixture | Disk persistence, Obsidian integration, full accessibility |
| Measured browser/AT checks | Specific contrast, hit regions, semantics and tested input routes | All themes/devices or every WCAG criterion |
| Native disposable-vault run | Host shortcuts, actual source/PDF/file handling, two-leaf/reopen behavior | General novice ease |
| Participant study | Observed performance/comprehension for those participants | Population success rate or complete conformance |
| Competitor documentation | Documented patterns and product positioning | Comparative usability superiority |

Each receipt names date, commit, build, fixture/URL, actual leaf dimensions, language/theme, input/AT environment, action sequence, expected/actual result and any limitation. Preserve old receipts with their original scope. In particular, the September 10 pinned-Chromium acceptance is a historical pass, not a current failure and not acceptance of subsequent changes.

## 2. Research design

Use two formative rounds of six participants: baseline first, candidate after priority fixes. Across the 12 seek at least eight new to the editor with no CAD practice, six with low confidence using unfamiliar software, six aged 65+, and four unfamiliar with Obsidian; characteristics overlap. Include two confident experienced users to detect efficiency regressions. Report composition **per round**, so a final 5/6 result cannot conceal that the candidate sample excluded the intended users. Aim for at least three older and three low-confidence participants in each round, with overlap recorded.

Add four to six paid accessibility sessions covering low vision/enlargement, keyboard/alternative pointer and screen-reader use; more than one person per input/access method where feasible. State overlap with the novice sample instead of inflating counts. Pilot task wording and fixtures with two people excluded from gate counts. Do not recruit, record or send invitations as part of this planning PR.

Use a synthetic renovation project with realistic rooms, independent/connected walls, doors/windows, overlaps, objects/groups, a reference with a marked known distance and fake renovation links. Validate saved fixtures through domain/persistence code. Match task inputs across baseline/candidate and counterbalance secondary-task order. Use different first-time users where possible; returning users measure learning rather than first-use improvement.

Sessions are approximately 60 minutes, with breaks or split sessions as requested. Let participants use normal devices, glasses, zoom and assistive tools. Give only enough neutral Obsidian orientation to reach the provided project; record host-setup effort separately. Do not teach Add, Details, shortcuts or calibration before the corresponding task.

## 3. Task set and completion criteria

The novice's first complete task is the primary outcome. Secondary tasks each have their own denominator and must not be silently dropped when they fail.

| ID | Neutral goal | Independent completion evidence |
|---|---|---|
| T1 Orient/start | Open the sample ground-floor plan and explain what you can do first | Correct floor; identifies a valid start without requiring a reference |
| T2 First room | Add a Kitchen 3.5 m wide and 4.2 m deep | One committed named room; saved dimensions match, not just preview |
| T3 Correct | Make the depth 4 m while retaining width | Intended dimension changes; other geometry remains as the current model promises |
| T4 Recover | Undo the last change; remove and restore a disposable spare room | Correct original state and identity; discovers supported recovery |
| T5 Navigate | Inspect a corner, then see the whole floor | Camera changes without geometry changes; fit/reveal route found |
| T6 Select overlap | Select the door in the marked wall/room overlap, then the room underneath | Correct target each time; no accidental movement; no moderator-taught modifier |
| T7 Reference | Use the supplied drawing and marked 4 m distance as a reference | Correct file/points/unit, correct committed scale, clear review/cancel/retry understanding |
| T8 Existing manipulation | Place or adjust the supported door, then make a precise rotation or move | Same valid result using pointer and an equivalent precision route; correct impact comprehension |
| T9 Copy scope | Copy the specified Room/group to another supplied floor | Predicts copied dependencies/exclusions; one direct paste and correct undo; optional preview only if separately adopted |
| T10 Interrupt/compact | Open the related note, return, narrow the pane and continue editing | Same meaningful context and draft; Details/canvas return works |
| T11 Distinct modes | Explain where you would change this room's size and where you would plan its renovation work; do each supported task, then return | Identifies Plan versus Renovate without coaching; finds each mode's relevant controls; same target/camera on direct return; no accidental geometry edit in Renovate |
| T12 Save confidence | Finish for today, reopen, then encounter a controlled failed/stale write | Correctly distinguishes saved/failed/stale; persisted data independently verified |

Run T1–T4/T5/T12 for all first-time participants. Allocate T6–T11 to enough participants to obtain at least five independent attempts per secondary core workflow across the candidate/accessibility sessions, with denominators shown. If 60 minutes cannot accommodate tasks, schedule follow-up or additional sessions; do not infer unobserved success. The domain-specific advanced task may be adapted only to already supported behavior.

Before each trial, freeze supported geometry and data expectations. Do not ask participants to resize arbitrary rotated room bounds when the current editor only supports numeric axis-aligned dimensions. Include that distinction as a comprehension probe or regression task instead.

Moderator assistance ladder: repeat goal → neutral encouragement → directional hint → exact instruction → completion by moderator. Directional hints and later stages make a task assisted. Allow written prompts to remain visible. Stop for distress or request; there is no age-based speed deadline. Record reading/planning pauses before interpreting them as confusion.

## 4. Proposed release decision rules

| Measure | Proposed gate |
|---|---|
| Core loop | At least 5 of 6 final-round first-time participants independently complete T1–T4 and T12; show each task and complete-loop counts |
| Secondary core workflows | At least 4 of 5 candidate attempts per T6/T7/T9/T10/T11 succeed unaided; any shared failure blocks claiming that workflow consolidated until fixed and retested |
| Serious mistakes | Zero unnoticed unit/magnitude errors, wrong-target destructive writes, data loss or false belief that a failed save succeeded |
| Recovery | At least 5 of 6 recover a supported change independently; zero unrecoverable losses in controlled regression scenarios |
| State comprehension | At least 5 of 6 correctly explain selection, preview versus saved, and next action at predefined probes |
| Mode comprehension | All six final-round novices receive the short T11 mode-identification probe; at least 5 of 6 correctly choose Plan for layout changes and Renovate for work/material/cost context without coaching. Report the full T11 task denominator separately. Visual distinction is required even if continuity already passes. |
| Task ease | Median at least 5 on a custom 1–7 ease question for core tasks; investigate recurring scores ≤2 rather than averaging them away |
| Confidence | Supporting target: at least 5 of 6 rate confidence in doing the task alone later ≥4/5; performance remains the primary gate |
| Efficiency | Exploratory target: 25% lower median first-room time from baseline, with no accuracy/access regression; report raw times and sample differences, not significance |
| Access | No unresolved blocking access failure in scoped tasks; complete applicable accessibility assessment with an explicit limitation/exception register |
| Retention | Optional consented 7–14 day follow-up: reopening and one correction without directional help; report actual returns rather than assuming six |

These small samples are formative acceptance signals. A 5/6 result is not evidence of an 83% or 90% population success rate. One blocking failure in a particular access method cannot be cancelled out by other participants succeeding. Keep older/low-confidence/access-method results visible and investigate disparities; do not silently relax thresholds after seeing the result.

If recruitment cannot meet the denominators, report the work as implemented with incomplete usability validation. The product owner may defer release or narrow the release claim; unavailable participants are not a passed gate.

## 5. Accessibility and visual matrix

Use the [inclusive research memo](research/inclusive-usability.md) for source-level standards mapping. The requirement is the applicable WCAG 2.2 A/AA scope, not merely a green automated scan. WCAG2ICT and APG provide informative guidance for host/software behavior; they do not automatically confer compliance.

- Measure normal/large-text contrast (4.5:1/3:1 as applicable) and relevant non-text contrast (3:1), accounting for criterion exceptions. Include dimensions, selection/focus, error, disabled/explanatory text and custom accents; do not infer a failure from a screenshot alone.
- Evaluate actual pointer hit areas and spacing. AA minimum targets are 24 × 24 CSS px or applicable exceptions; 44 × 44 is an enhanced criterion and a proposed design target for core actions, not the AA minimum.
- Check keyboard operation and non-drag single-pointer alternatives separately. Review canvas application-mode entry/exit and nonvisual equivalents for essential entities/actions.
- Verify tab order, focus restoration and focus not obscured across Add, context menus, task forms, dialogs and responsive drawers. Native field editing keys must not alter canvas geometry.
- Keep repeated error/save messages perceivable without reading every pointer coordinate aloud. Verify actual speech with NVDA in native Obsidian; record version/configuration.
- Test 1280/1024/900/899/640/460/400/399 px leaf widths and representative 800/600 px heights, plus 320 CSS px reflow of nonspatial controls. Use high-risk pairings rather than every combination: German narrow forms, dark dense geometry, large-text dialogs, and active drafts crossing both layout boundaries.
- Test native interface zoom at 100/200/400%, separately from OS display scaling and canvas zoom. The two-dimensional canvas may meet the reflow exception; toolbars, forms and errors still require individual evaluation. Below-width messaging alone does not prove zoom accessibility.
- Include light/dark, a representative community theme/custom accent, English/German, mouse/trackpad, keyboard and reduced-motion. Preserve input/caret and current target across full/constrained/unsupported transitions or explicitly resolve unsupported state retention before release.
- Compare paired Plan/Renovate captures at identical selection/camera/data; verify different tools and Details hierarchy as well as visible mode cues. Check mode identification without color, distinct status semantics and labeled switching at 460 px. Test that selecting renovation information cannot accidentally manipulate geometry and that Edit layout restores a deliberate Plan editing context.

No claim of full AA conformance follows from this checklist alone. The release receipt must state assessed scope, criteria, methods, exceptions and unresolved issues. A core-task success gate is necessary but not sufficient for an overall conformance claim.

## 6. Engineering regression strategy

For implementation, use the relevant existing suites listed in [implementation-audit.md](research/implementation-audit.md#targeted-verification-for-implementation). Current scripts support targeted tests through `npm run check:fast -- <paths>`. At final integration run `npm run check` and required CI across supported Node/OS environments. Do not weaken lint, coverage or complexity gates to fit presentation changes.

Meaningful boundaries:

1. Task state and completion: valid/invalid/no-op, busy, repeated activation, explicit Cancel versus staged Escape, tool change and focus outside canvas.
2. Geometry integrity: semantic dimensions, independent Room/wall behavior, hosted openings, locked/group operations, current/intended separation, locale precision.
3. Selection: hit rank, overlapping/hidden/locked targets, group/member, captions, keyboard list equivalence and stale targets.
4. Reference: PNG/JPEG/PDF, crop/rotate, scale preview/consent/commit, cancel/reopen, source missing, transformed point coordinates and read-back recovery.
5. Clipboard/history: dependency closure and exclusions, cross-leaf/cross-floor, stable identity remapping, one history entry, conflict and text-field clipboard isolation.
6. Shell/perspectives: persistent identity, resizer/collapse, boundary reflow with fields/drafts, two leaves, room-less context, Review return and host note navigation.

Use existing visual drivers and add only the missing states needed for changed contracts. Update selectors alongside intentional UI changes; do not remove a journey because its selector became stale. Use `scripts/editor-visual-final-check.mjs` for the existing baseline matrix when preparing implementation release evidence. Static screenshots do not prove manipulation feedback; include before/during/after sequences or bounded interaction assertions.

For **this documentation-only planning PR**, appropriate verification is Markdown parsing, local link/image checks, evidence provenance and dimensions, whitespace/diff review, and the bounded browser walkthrough. The application test suite has not been rerun as evidence of this unchanged application's correctness. Record actual planning checks in the PR; recommended future commands are not completed tests.

## 7. Native Obsidian acceptance

Use a disposable synthetic vault, not personal renovation data. Record OS, Obsidian/plugin version, commit, theme/language, actual leaf width, zoom/scaling, device/keymap and AT version. Walk:

- Open/create/select a Room; exact edit; undo; close/reopen; restart with two plan leaves.
- PNG/JPEG and real host PDF loading; successful scale; replace/cancel; deliberate rescale consent and stored geometry verification.
- Panel resize/collapse and preferences across restart; note/tab return; active field/draft across narrowing.
- Real Add/context menus, focus and host shortcuts; Space/middle-button pan; Escape order; keyboard/non-drag alternatives.
- Clipboard across floors/leaves, dependency-sensitive delete and guarded undo.
- One controlled stale/peer-conflict/write-failure route with truthful save state and safe recovery.
- Room, Area, structural element with/without room, group, Renovate and Review context.

Update relevant existing cases (for example Configure a reference plan, Resize a room, Resize and collapse side panels, Copy and paste across floors, Notices and save state) with dated current trigger amendments and actual Runs entries. An updated expectation is not a pass.

## 8. Privacy and measurement

Start with moderator worksheets and synthetic projects. No production telemetry or analytics service is needed. If later authorized, research-build instrumentation stores local enumerated task/action/outcome timestamps only; never vault paths, room names, note contents, photos, raw keys, geometry coordinates or inferred disability. Undo can be deliberate task success, not an automatic error signal.

Consent to observation, recordings, quotes and follow-up separately. Store contacts separately from task results, outside shared/synced personal vaults. Proposed retention: remove raw recordings within 30 days of synthesis and recruitment identifiers after compensation/follow-up; keep anonymized issue summaries and aggregate counts. Confirm this with participants before any collection. This task has collected no participant information.

## 9. Release checklist

- [ ] Baseline and final implementation commits identified; accepted historical decisions preserved.
- [ ] All accepted U0–U9 criteria have receipts or explicitly scoped remaining decisions.
- [ ] Plan/Renovate distinction passes paired-screen, mode-comprehension and default-interaction checks; selection, draft safeguards and camera continuity are preserved.
- [ ] No P0 data/safety/access issue remains; P1 failures have a fix or explicit release disposition.
- [ ] Automated targeted checks, complete repository gate and required CI passed on final code.
- [ ] Current visual and interaction evidence covers changed tasks with valid fixtures.
- [ ] Native disposable-vault runs recorded, including persistence, reference/PDF, focus and two leaves.
- [ ] Novice task counts, assistance, comprehension and access results meet agreed gates.
- [ ] Applicable accessibility assessment and limitations documented without overclaiming.
- [ ] User guide, affected journey/issue/test notes and implementation receipts match the UI.
- [ ] PR describes outcome, tested scope and remaining risks; product owner decides release based on evidence.
