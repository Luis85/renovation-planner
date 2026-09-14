# Astra current-main refresh

Date: 2026-09-14. Assigned reviewer/implementer: GPT-6 Astra/high. Scope: normal-merge integration of the complete usability stack with current main, independent code/UX review, bounded corrections, and the later explicit removal of selected-item Add detail. The Obsidian-native system and selected directions 1+3 remain the visual authority.

## Identity and delivery

- Branch/worktree: `codex/usability-astra-main-refresh-polish`, `D:/codex-worktrees/9479/renovation-planner`. The explicit assigned-worktree instruction takes precedence over the generic `.worktrees/<slug>` convention.
- Starting stack: `d0a7f165bc06f912ced5b73cb3b036522cbe3635`, [PR #203](https://github.com/Luis85/renovation-planner/pull/203), `codex/usability-astra-native-polish`.
- Integrated main: `acfb7c7d11268eed7c6a39dbd52cdeab7bc961e7`, 63 commits beyond the prior integrated main.
- Merge: `25b1b0a434eaf4ed58849cf59b1d00e58428325d`. Its parents are the two SHAs above, in that order. No rebase, force-push, main merge, or lower-stack mutation.
- Main correction: `d7786d02b8530dc2ad43f5068d636b7af1a503a8`. Delete availability: `a5963002d`. Add detail removal: `0b43fa553`.
- PR, final SHA, definitive gate and CI: pending completion below. This sentence is not a passing-gate claim.

No repository AGENTS.md or .codex instruction directory was present. The user's supplied contributor instructions apply. Impeccable context ran once; polish/craft guidance, PRODUCT.md and the incumbent implementation were read. [I18](I18.md) remains explicitly deferred: upstream asset-designer part editing is not an approved arbitrary Room/Area-corner interaction for the plan editor.

## Conflict decisions and semantic reconciliation

| Conflict | Decision |
| --- | --- |
| `ElementInspector.vue` | Adopt upstream ElementSummaryLine, including no misleading length for text/grid. Keep the stack's ElementGeometryActions, Plan-only edit controls and focus handoff. Move upstream section Flip into that component. Exclude drafting marks from StructureRenovationEntry. |
| `TemporaryToolBanner.vue` | Preserve the room busy/invalid states, cancellation guard, and message/action components. Adopt isShapedTool/rectangleInstruction for item and hatch. Move upstream reserved snap space into TaskBannerMessages. |
| `registerEditorTools.ts` | Retain synchronous Select gesture retirement and the Plan geometry predicate, alongside upstream EditorStore/zoom-aware draftingHitContext. |
| `contextMenuActions.test.ts` | Keep current-target/overlap guidance and include the new Drafting submenu in action order. |

Automatic merges were inspected as well: context-menu line tolerance, InteractionLayer hit candidates, StructureLayer drawing order and editability, EditorSurface's shared designer seam, SelectTool drafting metadata, taskbar CSS, and locale modules. Upstream PlanCanvas rise-only initial framing and remount camera preservation remain intact. Schema 12 and offset/flipped geometry equality, multipoint section persistence, hatch rectangle/free drawing and asset-designer part editing are retained. One imported trailing blank line was removed for a clean stacked whitespace diff.

## Reproduced corrections

1. Drafting entries were enabled in Renovate, and startAt reached a runtime switch that excluded only Review. Tool admission now requires Plan for geometry, retaining Select and the existing Renovate camera routes. Drafting entries and retained menu callbacks use the shared live mode guard and reason. Clipboard behavior is unchanged.
2. A selected section line showed Existing/Work/Planned and Add work item even though upstream domain validation excludes drafting marks from renovation records. [Before](../../astra-main-refresh/before-drafting-renovate.png) and [confirmed correction](../../astra-main-refresh/pre-removal/17-drafting-renovate.png). The Inspector retains identity and geometry handoff without the record block; single/batch runtime admission and bulk compatibility also exclude drafting marks, including remembered Room context.
3. Pointer entry opened Drafting, then the following click closed it. Hover ownership now keeps that first click open; a second click still closes it. Keyboard, Escape and disabled-parent behavior remain covered. The browser confirmation used actual pointer clicks to reach and save a hatch.
4. Element Delete looked enabled in Renovate while its runtime refused it. The menu now uses the Plan-only guard/reason, preserving the separate Room/wall removal rules. A focused test verifies disabled semantics. The integration menu screenshot predates this last availability-only correction; it is not visual confirmation of that correction.

`tests/presentation/editor/usability/astra-main-refresh.test.ts` adds five focused tests: all seven drafting starts/captured callbacks across Renovate and Review; geometry/selection/camera/history retention; section/hatch gesture cancellation through real confirmation; hover then click; and single/bulk drafting-record refusal. Existing tests revalidate section Flip/undo, multipoint saves, schema readback, context Delete tolerance, paint/selection, hatch task forms, asset-placement/remount, focus handoff, clipboard, save recovery, bulk dimensions and compact Review.

## Integration evidence, before the later removal request

[Browser report](../../astra-main-refresh/pre-removal-browser-report.json), [image hashes](../../astra-main-refresh/images.json), [archived capture source](../../astra-main-refresh/pre-removal-capture-source.mjs.txt). The scratch source adapts scripts/editor-usability-fidelity-check.mjs; it is archived as text to avoid adding an unregistered executable to lint/Fallow. Raw logs are outside Git.

There were two bounded integration/polish rounds. Driver recovery opened the collapsed Elements disclosure and stopped using the Room-only select knob for an element; these were capture-driver corrections, not production fixes. The final driver waits for aria-checked=true on perspective controls. Screenshots from this stage are now explicitly historical under pre-removal because the user subsequently removed Add detail.

Capture source: `d7786d02b8530dc2ad43f5068d636b7af1a503a8`, 2026-09-14 10:36:36 UTC. Browser: installed Microsoft Edge 153.0.4234.32, headless Windows, DPR 1. Pinned Chromium was unavailable and its install encountered the shared D:/dev-cache/playwright/__dirlock stale-lock failure. RP_CHROMIUM_EXECUTABLE explicitly selected Edge and printed the substitution. This is production Vue/Konva over the synthetic FakeVault harness, not native Obsidian or a pinned-browser pixel golden.

- 24 screenshots cover Plan start/draft/selection, Renovate overview/work/default, EN-light and DE-dark narrow states, custom tokens, drafting/Review, hatch creation and compact EN/DE Review.
- Primary controls were measured at widths 1280, 1024, 900, 899, 640, 460 and 400, height 800: within canvas, unobscured and at least 44 by 44 CSS px. This does not describe every task/form control.
- Room resize keyboard-visible focus and selection/camera/FakeVault-note equality across Plan to Renovate passed. Existing focused tests cover opening/element handoff and wall/taskbar clearance.
- Targeted primary-action contrast: light resize 5.33:1, light Add work 5.78:1, dark resize 5.64:1, dark Add work 9.71:1, custom resize 10.59:1, custom Add work 5.47:1. These are measured token examples, not whole-surface certification.
- The real hatch drag snapped to existing geometry. Finish bounds before/after leaving the canvas matched exactly: x=246.875, y=627, width=97.609375, height=32 CSS px; activating it saved a second hatch. [Draft](../../astra-main-refresh/pre-removal/22-de-hatch-draft.png).
- [German compact Review](../../astra-main-refresh/pre-removal/23-de-compact-review.png) and [English compact Review](../../astra-main-refresh/pre-removal/24-en-compact-review.png) retain work progress below its heading.
- Report: zero page errors and zero asserted layout/contrast findings. Existing Konva six/seven-layer advisories appeared; no frame-rate claim is made.
- Impeccable detector: one run over 94 changed presentation/style targets, result `[]`, after the main correction batch. It preceded the final Delete availability-only correction and the later user removal request. No repeated detector is claimed.

The [native receipt](ASTRA-NATIVE.md) is historical lower-stack evidence only. No current-run native Obsidian, AT, participant, native German, arbitrary community-theme, mobile-device or actual browser-zoom evidence is claimed. The merged behavior was reproducible in the production harness and command adapters, so a native redeploy was not needed.

## Later user decision: remove selected-item Add detail

After the two integration rounds the user explicitly requested removal of selected-item Add detail and refreshed responsive/context/focus verification. Commit `0b43fa553` implements that new scope. Earlier Add detail screenshots and clearance observations are historical, not the current product contract.

The audit found one mounting route, PlanCanvas to DirectActionPopover, and its DirectDetailOptions child. Wall length and Mark change are separate actions and remain in the smaller WallCanvasActions. The Add detail disclosure/options component, EN/DE key, options/zone-specific styles and popup-only tests are removed. The shared selection context remains used by the Existing photo strip; taskbar clearance still serves the task banner and wall controls, including content-height reflow. Rotation obstacles now reference the wall-only controls. No geometry, clipboard, planning or persistence command was removed.

The directCanvasActions suite now verifies absence at 460/1200 widths, selection/camera/note equality through modes, the actual Details rail, Room record creation/undo and preserved wall actions. The former popup-clearance suite now checks surviving wall controls. Capture journeys were moved to Details navigation; user help and the historical implementation report were updated.

Removal checks: initial broad run 26 files, 108 passed and one new test failure because its focus assertion named the inner Inspector instead of the preserved drawer owner. Correcting that assertion produced four files / 16 passing tests in 18.07 s (directCanvasActions, i14-wall-clearance, rotationInspectorRoutes, i11-opening-details). Vue type-check, oxlint and targeted ESLint passed.

The new removal request receives one bounded confirmation batch using the updated scripts/editor-usability-combined-check.mjs, [report](../../astra-main-refresh/selection-details/report.json). This verifies the subsequent deletion, not another iteration on the earlier polish. Its first driver measurement correctly found that the Details drawer covers the taskbar when opened during responsive resize; the driver now closes the drawer before measuring the exposed canvas. No product change was needed for that expected behavior. Final result: passed on production source `0b43fa553120c8164fe101b90acbc3c00aa58153`, Edge 153.0.4234.32, 2026-09-14 10:51:16 UTC. Eight screenshots confirm EN/DE selection without Add detail, the exposed responsive taskbar and keyboard-focused Details. Both languages open the Existing record form from Details and cancel without changing saved notes, selection or camera. Primary controls remain unobscured and at least 44 by 44 CSS px. Zero page errors. The committed driver includes the two-line measurement correction used in this run. See [desktop selection](../../astra-main-refresh/selection-details/en-plan-selection.png), [narrow Renovate](../../astra-main-refresh/selection-details/en-narrow-renovate.png), [German Plan](../../astra-main-refresh/selection-details/de-narrow-plan.png), and [German Details focus](../../astra-main-refresh/selection-details/de-details-focused.png).

## Verification

- npm ci --ignore-scripts --no-audit: 581 locked packages; no dependency changes.
- Initial focused integration: 29 files / 122 tests, 91.85 s. All then-existing editor usability tests, contextMenuActions, shell/temporaryToolBanner, assetPlacement.e2e.
- Drafting reconciliation: 8 files / 41 tests, 29.58 s. astra-main-refresh, draftingCreation, draftingMenu, draftingInspector, draftingCanvas, draftingHitTesting, draftingTaskForm, assetPlacement.e2e.
- Main correction: 4 files / 28 tests, 33.73 s. astra-main-refresh, contextMenuSubmenu, draftingMenu, draftingInspector. Oxlint and targeted ESLint passed.
- Final menu correction: 4 files / 29 tests, 33.68 s. astra-main-refresh, i14-context-menu-guard, contextMenuActions, draftingMenu.
- Earlier full-gate attempts are not passes: one stopped on conditional-expect lint in the new test; one on a scratch capture script within ESLint's scan. It was moved outside the checkout. Subsequent coverage attempts were canceled for reproduced visual findings, the later user removal request, or capture-driver correction. No gate/threshold was weakened.
- Read-only npm audit --json: two high development findings, fast-uri and js-yaml. npm run audit (production, high threshold) passed with zero vulnerabilities. No audit fix applied.

Completed intermediate full gate: build/lint passed; 969 files passed and one file failed, with 10,608 tests passed, three failed and one intentional skip (970 files / 10,612 tests), coverage duration 1,267.38 s. Coverage cleared thresholds: statements 99.22% (26,854/27,063), branches 98.05% (19,697/20,088), functions 99.32% (7,813/7,866), lines 99.67% (19,871/19,936). The three failures were downstreamActions fixtures starting Area drawing in Renovate. They now mount the reusable departure control against the real editor runtime in Plan; all six downstream tests pass (36.55 s) and targeted ESLint passes. No production guard was weakened. Fallow then passed separately: no dead code and zero above-threshold complexity findings. An earlier concurrent Fallow attempt lacked the still-pending coverage output; that is not a code defect or passing analysis claim.

Evidence integrity: 33 image hashes verified; all 211 changed text files decoded as UTF-8; four changed documents / 47 local links resolved. Main was re-fetched at acfb7c7d and is an ancestor; the main checkout was clean. Final publication checks repeat the relevant identities.

**Definitive rerun on the corrected tip, publication and CI: pending.**

## Remaining limits

I18 arbitrary Room/Area-corner keyboard/non-drag access remains unsupported. Upstream asset-designer part editing does not resolve that design gate. Native host/AT/participant/theme/recovery acceptance retains the limits above; automated gates do not imply conformance or release readiness. No main or lower-stack branch/PR is modified or merged by this task.
