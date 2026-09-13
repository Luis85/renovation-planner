# Astra editor UI fidelity review

2026-09-14 · Product Design audit followed by Impeccable polish · Synthetic harness data only.

The editor preserves its selected room and camera between Plan and Renovate, gives the exact-size and work actions clear priority, and keeps the labeled taskbar inside narrow canvases. The updated room draft exposes its unsaved state and places width/depth together. This is a bounded browser assessment, not native Obsidian, assistive-technology or participant acceptance.

## Combined integration — 2026-09-14

Code-polish commit `d97241a52c8f11fc7809491643c1ab1cb401c013` was merged normally at `6b2280948d29d2b1f02cf4890cb51504c7bcd643`. Its shared taskbar-clearance correction **closes the 460 px Add detail overlap in the tested English/light and German/dark states**. The capture-script lint correction and repeatable combined probe are committed at `3f3f2a86589df2aef84db21edf33d6a5ce2fbb19`; production code is identical to the captured merge commit. No additional UI correction was required in this combined confirmation cycle.

Fresh screenshots were saved and inspected in both the Codex in-app Browser and Edge harness. The popover bottom is **619.6875 px**, taskbar top **636 px**: **16.3125 px clearance** in both languages, collapsed and expanded. The opener remains within the canvas and unobscured, actual Tab navigation paints its focus ring, Enter expands the menu, and Escape restores the opener. The harness confirms byte-equivalent saved notes and unchanged camera/selection across focus/expand/Escape. The expanded menu scrolls within its established height.

| Combined step | Inspected in-app Browser evidence | Health |
|---|---|---|
| C1. English selected-room Add detail, keyboard focused | ![English collapsed](combined/01-en-iab-collapsed.png) | Clear of the wrapped taskbar |
| C2. English expanded detail routes | ![English expanded](combined/02-en-iab-expanded.png) | Focus retained; routes visible in scrolling menu |
| C3. German selected-room Detail hinzufügen, keyboard focused | ![German collapsed](combined/03-de-iab-collapsed.png) | Clear of the wrapped taskbar |
| C4. German expanded detail routes | ![German expanded](combined/04-de-iab-expanded.png) | Localized wrapping fits; Escape restores opener |

The [combined machine report](combined/report.json) and [combined manifest](combined/manifest.json) record the independent Edge captures, measurements, preservation assertions and image hashes. The earlier `before`, `round1`, `after` and comparison boards below remain historical evidence of the isolated UI pass; they are not regenerated or relabeled as combined screenshots.

Focused verification passed **19 files / 364 tests**, including I05's added assertions, button gates, the code pass's gesture/context/group/focus/popover suites, responsive shell/side panels, direct canvas actions and the two earlier full-run failure areas. The definitive combined **`npm run check` passed with exit 0**: **935 files / 10,222 tests passed / 1 intentional skip**, with 99.23% statements, 98.10% branches, 99.29% functions and 99.67% lines covered. Build and repository lint passed; Fallow reports no dead code and zero findings above threshold, with one informational nine-line clone group in the manual capture helpers. See the [verification record](combined/verification.json) and [ASTRA-UI receipt](../parallel-delivery/receipts/ASTRA-UI.md). Native/AT/human and I18 limits remain unchanged.

## Scope and authority

- Source implementation: `5d694bfff8400465c34bff46af645b1d354cf4a4`, based on updated I17 `d211d75ee444`, including `origin/main` `fa78293a9`. The screenshot manifest records exact source-file hashes; capture reports' `source` field is the parent commit because the UI edits were uncommitted during capture.
- Surface: connected Plan editor, `?view=plan-editor&bare&reference&planning&fidelity`. Room creation writes only to the harness FakeVault through the real command stack. The sample Kitchen is 4 × 3 m, 12 m².
- Authority: [selected directions 1 + 3](../mockups/README.md), [screen contracts](../mockups/hybrid-screens.md), [implementation plan](../implementation-plan.md), [validation plan](../validation-plan.md). Obsidian semantic tokens and the existing command contracts govern implementation.
- Read I15/I16/I17 receipts before capture. Product Design saved-context preflight returned no saved entries. Impeccable context ran once; PRODUCT.md exists, DESIGN.md is absent. No AGENTS.md or `.codex` directory exists in this worktree.
- First-run captures used the Codex in-app Browser at 1280 × 800 and 460 × 800. Exact screenshot bytes were saved locally and opened before acceptance, closing I15's saved-file limitation for these new states only.
- The two bounded implementation verification rounds used the repository Vite harness and screenshot helpers with explicitly reported Edge `153.0.4234.32`. This is an unpinned browser substitution, so text rasterization differs from IAB. The pinned Chromium installer failed twice with a cache lock-update error; no dependency lockfile changed.

## Findings and fixes

| Finding | Current-run evidence | Fix and result |
|---|---|---|
| F1: Narrow Renovate actions clipped at both canvas edges | Before step 7, 460 px: Select and More actions cut off | Taskbar sizes to available canvas and wraps labels; existing 400–439 px named-icon treatment remains. Measured four buttons inside the canvas, at least 44 × 44 CSS px, with unobscured centers. |
| F2: Exact room editing lacks primary emphasis | Before step 3: Change room size is a plain action row while Renovate has a bordered route | Promote the existing resize command with host-derived fill, 44 px minimum height, preserved disabled behavior, and an outer keyboard focus ring. |
| F3: Renovate's main Details action disagrees with its green mode/taskbar cue | Before steps 4–6: purple Add work in Details | Scope the semantic success-derived primary treatment to Renovate Details; preserve Review's existing treatment. First-round 4.33:1 / 4.10:1 contrast failures were fixed in the final batch. |
| F4: Empty-floor Details implies a competing reference/rooms/scale checklist | Before steps 1 and 9 | Replace the checklist and oversized whitespace with concise guidance explaining that a reference is optional. Existing reference action and all three actual start routes remain. |
| F5: Draft identity and form density obscure completion | Before steps 2 and 8: no explicit unsaved label; German actions below initial viewport | Add localized Draft not saved / Saving status, pair width and depth without changing input/validation ownership, retain side-by-side Create/Cancel. Valid German draft actions fit at 460 × 800. |
| F6: German mode labels compete with purpose text | First-round German Renovate capture | Place the compact purpose cue above the complete mode row below 600 px. Final bounds checks include the mode controls. |

Strengths retained: stable breadcrumb/selection identity, labeled perspective radio group, everyday actions before advanced controls, no geometry handles in Renovate, three real starting routes, field-level errors with a last-valid-preview label, and explicit geometry-edit return. Default expanded/resizable panels remain; no layout preference was rewritten to imitate the compact mockup rail.

## Accepted flow evidence

All paths below are current-run files, individually opened and inspected. Before/after images use matching functional states and viewport sizes where a pair exists. The reference boards are illustrative multi-frame artwork with different scene data and dimensions, so the comparison assesses hierarchy and task affordances, not traced geometry or pixel equivalence. English references are not German localization evidence.

| Step and health | Baseline | Final |
|---|---|---|
| 1. Plan start — improved, three choices preserved | ![Before Plan start](before/01-plan-start.png) | ![Plan start](after/01-plan-start.png) |
| 2. Valid room draft — improved, explicit draft state and compact dimensions | ![Before room draft](before/02-room-draft.png) | ![Room draft](after/02-room-draft.png) |
| 3. Plan selection — improved, primary resize and keyboard focus | ![Before Plan selection](before/03-plan-selection.png) | ![Plan selection](after/03-plan-selection.png) |
| 4. Renovate selection — improved, preserved selection/camera and coherent main action | ![Before Renovate selection](before/04-renovate-selection.png) | ![Renovate selection](after/04-renovate-selection.png) |
| 5. Work details — improved action priority; fixture schedule route unavailable | ![Before Work](before/05-renovate-work.png) | ![Work](after/05-renovate-work.png) |
| 6. 460 px Work drawer — healthy for this empty Work state | ![Before narrow Work](before/06-narrow-work.png) | ![Narrow Work](after/06-narrow-work.png) |
| 7. 460 px Renovate canvas — clipping fixed; historical popover overlap closed by C1/C2 | ![Before narrow canvas](before/07-narrow-canvas.png) | ![Narrow canvas](after/07-narrow-canvas.png) |
| 8. German dark draft — improved, Create/Cancel initially visible | ![Before German draft](before/08-de-dark-draft.png) | ![German draft](after/08-de-dark-draft.png) |
| 9. Renovate without selection — healthy, contextual start guidance | ![Before default Renovate](before/09-renovate-default.png) | ![Default Renovate](after/09-renovate-default.png) |
| 10. German invalid draft — error and last valid preview clear; longer form scrolls | No saved matching baseline | ![Invalid German draft](after/10-de-invalid-draft.png) |
| 11. German Renovate canvas — full mode labels; historical popover overlap closed by C3/C4 | No saved matching baseline | ![German Renovate](after/11-de-renovate-canvas.png) |
| 12. Dark Plan — healthy hierarchy | No saved matching baseline | ![Dark Plan](after/12-dark-plan.png) |
| 13. Dark Renovate — healthy hierarchy and measured primary text contrast | No saved matching baseline | ![Dark Renovate](after/13-dark-renovate.png) |
| 14. Custom-token Plan — host accent retained | No saved matching baseline | ![Custom Plan](after/14-custom-plan.png) |
| 15. Custom-token Renovate — distinct purpose, host-derived action colors | No saved matching baseline | ![Custom Renovate](after/15-custom-renovate.png) |

## Reference comparison

The comparison boards place the supplied proposal and final states together. The source assets remain unchanged. Matching implemented Plan/Renovate pairs use the same saved scene, viewport, language and theme; the light pair additionally asserts unchanged camera, selection and FakeVault notes across switching. The narrow board compares the common canvas shell in Renovate against the Plan proposal, the German dark draft against the English light proposal, and Work details against the Renovate overview proposal. These deliberate state/locale differences are stress evidence, not exact mockup matches.

![Selected hybrid and implementation](comparisons/modes.png)

![Dark proposal and implementation](comparisons/dark.png)

![Narrow proposal and implementation](comparisons/narrow.png)

The implementation now matches the proposals' primary-action hierarchy, paired dimensions, explicit draft identity and separate narrow mode row. It intentionally retains the incumbent facts card, expanded panels, existing Work subview/navigation, semantic host accent instead of fixed blue, and real synthetic geometry instead of generated furniture or unsupported facts. Work records, costs and linked-content totals were not fabricated to match the artwork.

## Initial pass verification and limits

- Initial targeted Vitest: **8 files, 252 tests passed**, 48.94 s. Exact command is in the receipt. This preceded the final CSS batch and additional I05 status assertions; the coordinator must run the combined final gate, including that test, after stacking the code pass.
- Final changed-file ESLint: passed. Initial warnings about one template line and sentence case were corrected; an ignored `.mjs` invocation was removed from the ESLint target list, not bypassed with an ignore rule.
- Final capture/check command: passed. [Machine report](after/report.json) records zero page errors and zero findings. It checks camera/selection/FakeVault continuity, invalid create gating, actual keyboard `:focus-visible`, mode-control bounds, and four taskbar targets at 1280, 1024, 900, 899, 640, 460 and 400 px plus German 460 px. Known Konva layer-count warnings occurred and were not classified as page errors.
- Measured opaque foreground/background text contrast for resize / Renovate primary action: light **5.33:1 / 5.78:1**, dark **5.64:1 / 9.71:1**, custom token fixture **10.59:1 / 5.47:1**. These measurements cover only these controls at rest, not all text, non-text, hover/disabled states or arbitrary themes.
- Impeccable detector: ran once at the end over the seven changed UI targets; [result](detector.json) is `[]`.
- Capture integrity: initial IAB start image was rejected and replaced. Round 1 stopped on contrast, then continued without UI edits to finish its batch. Final-round driver failures included a viewport transition race and navigation timeout. Two final files labeled canvas showed an open drawer; they were rejected and replaced after fixing the driver to use Close panel and assert hit-test visibility. Completed accepted frames were preserved; no third UI polishing round occurred.
- Not obtained: native Obsidian/real-vault persistence, host zoom 200/400%, community theme, screen-reader speech, touch gestures, participant learnability, dense multi-room/structural selection, populated work tasks or late save/recovery states in this pass. The custom palette is a synthetic token fixture, not a community-theme certification.
- Remaining: invalid German draft requires vertical scrolling for completion controls; the preserved bottom Saved state describes committed plan data while the draft form separately says Draft not saved. Steps 7/11 retain historical screenshots of the isolated UI branch's popover overlap; the combined C1–C4 evidence above closes that issue for the tested states. No claim of universal target-size/contrast/AA conformance follows.
- I18 arbitrary-corner non-drag/keyboard work remains unsupported as documented. No proxy gesture or screenshot closes it. I16 native and I17 human evidence gaps remain open.

## Integration

No changes overlap the code pass's select-tool/ToolManager, structure action guards, `useCanvasMenuActions`, `DirectActionPopover`, `StructureInspector`, `RenovationEntry` focus handlers, or I11/I14 tests. This branch changes two shell components, creation locale modules, five CSS partials, I05 focused assertions, the capture driver, and this evidence package. No domain commands, geometry, storage model, mode switching or layer preferences changed.

The resumed integration merged the code-polish branch normally and owns the combined final gate. It opens exactly one UI PR with base `codex/usability-astra-code-polish`, directly above #200. Neither PR is merged by this task.
