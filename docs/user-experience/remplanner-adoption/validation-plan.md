# Validation plan and evidence ledger

## This planning delivery

Official source reads and five current-run RemPlanner captures completed; five user references inspected and copied unchanged. Static code and prior receipt comparison completed on `836399775`. No Renovation Planner current-run harness/native capture was performed: preparation ended when the parent reserved the machine exclusively for wall verification. `npm ci --ignore-scripts --no-audit` had already completed (581 locked packages, approximately eight minutes) when the stop reached it. No server, build, test, Node verification script or coding worker was started.

Executable JSON/schema, local-link, image-hash and path validation is **pending the machine lease release**, per the parent instruction. Do not interpret authored JSON or a manual read-through as a passed validator. Production UI did not change, so Impeccable detector/full production verification is not required for this documentation branch. The next coordinator must run the package checker before admitting work; run relevant existing docs/config checks if discovered at the then-current tip. No universal docs-only test command exists in baseline `package.json`.

## Pre-dispatch package gate

From the planning worktree after lease release, run `python docs/user-experience/remplanner-adoption/parallel-delivery/validate.py`. It checks the manifest's required structure, queued/null dependency safety, dependencies, local Markdown targets, existing ownership/test paths, forbidden absolute ownership paths and image hashes. It also emits a schema-validation result when the optional `jsonschema` module is available; without that module the structural checks remain distinct from complete JSON Schema validation. Do not install dependencies merely to hide that distinction.

Run `git diff --check`. Confirm clean main by read-only status, baseline ancestry and remote planning branch identity. Check final wall/color receipts and the current program-wide lease; update `dispatchAllowed` only after the parent authorizes a launch. No dependency SHA may be guessed. Re-run package path checks after stack placement, because wall delivery can move components.

## Focused implementation verification

Each worker runs `npx vitest run` with only its manifest's existing test files plus its new test file, then targeted ESLint and relevant type-check if the lease allows. Record exact command, source SHA, exit code and counts. Tests should exercise public action boundaries, not merely assert markup or copied implementation details. No worker may run `npm run check`, `npm run check:fast`, full coverage, Fallow or another broad gate while wall owns the lease.

R01's cases: new width/offset, zero/no-op, invalid locale input, near-host-end, overlap, straight and curved host, door/window eligibility, rapid changes, Cancel during delayed read, perspective departure during delayed read, stale/deleted host, initial write admission, exact Undo/Redo, save failure, successful write/read-back failure and retry without duplicate dispatch. The no-Plan action-level refusal must be tested independently of runtime tool admission. Verify old wall thickness and new item color data survive an opening edit round trip.

R02's cases: open/close with pointer and keyboard, Escape focus return, no draft/selection/camera/history change, current shortcut text for supported tools and field-focus exceptions, EN/DE completeness. Keep tests of actual keyboard behavior separate from help-copy checks.

R03's cases: absent/true/false/malformed preference, load/write failure, merged writes from two leaves, reopen, passive selection hidden, active scalar/curve/rotation/structure/drawing preview visible, active focus preserved, authored Measurement objects visible and no geometry/history write. Verify only actual labels reserve collision space.

## Browser matrix after integration

Use the real harness (`npm run harness` with an isolated port and browser auto-open disabled) under a granted preview lease. Capture the committed source in this worktree; never serve another task's checkout. Use approved browser tools and inspect saved screenshots. Typical route is `/?view=plan-editor`; read `tests/harness/page.ts` for current supported fixture parameters instead of guessing them.

| Scenario | EN / DE | Light / dark | Desktop / narrow | Behavioral evidence |
|---|---|---|---|---|
| Selected door/window, panel and refusal | Both | Both | 1280px, 460px, 320px leaf widths | Reach controls, change preview, Cancel, Apply, undo/redo; no obscured active form. |
| Keyboard help during selection and unfinished drawing | Both | Both | 1280px and 460px; 200% zoom | Close/focus restoration and retained task. |
| Measurements on/off and active editing | Both | Both | Dense plan and 460px | Passive clutter removed, active controls visible and reachable. |
| Existing wall/color integration | Both | Both | Desktop and narrow | No removed actions, palette/selection colors remain legible, no Add detail reintroduced. |
| Plan/Renovate/Review and stale/save states | Both | At least one each | Desktop and narrow | Direct action refusal as well as hidden/disabled UI. |

Batch visual inspection once, fix concrete findings, then one confirmation pass. Record viewport, device scale, browser/version, source SHA, state, image path and SHA-256. Screenshots show appearance; supplement them with assertions on focus, model state, history length and saved data. Browser mocks cannot prove vault writes or the native keymap.

## Real Obsidian, keyboard and human evidence

R04 tests a disposable explicitly designated vault with real plugin dependencies: two editor leaves and a pop-out, native theme tokens, EN/DE host language, focus departure/return, shortcut conflicts, close/reopen, geometry sidecar and Markdown preservation, external edit/stale conflict, and recovery after successful write/read-back failure. Confirm persistence through a fresh plugin load, not just a still-mounted store. Do not manipulate the user's live project for test fixtures.

Keyboard-only walkthrough: select opening from list, invoke context menu/Details, edit width/offset, operate all buttons without drag, hear/see validation, cancel and return to the selection. Test help and visibility in the same sequence. Human/AT walkthrough: actual supported screen reader and Obsidian on Windows; record reader/version, browser/host version, task and failure details. Axe/AX trees and screenshots cannot substitute. Check labels, focus order, focus not obscured, contrast, 44px design targets, zoom/reflow and alternatives under WCAG 2.2 AA intent. No full conformance claim is authorized.

Ask participants to trace a known room, correct a door, recover a canceled edit and explain what will be saved. Collect success without coaching, errors, uncertainty and final geometry accuracy; do not invent timing targets or participant results. I18 arbitrary Room/Area corner non-drag editing remains an explicit unsupported task even if every new control passes.

## Full integration gate

Only the designated heavy owner runs `npm run check` (build, lint, coverage, Fallow), plus `npm run audit` if required by current project release workflow. Keep thresholds and scope unchanged. Run after all adopted coding packets are stacked; rerun only for material subsequent code changes or unresolved failures. Record unavailable native/AT/human checks as unperformed and separate them from automated passes. Release decision belongs to the parent/human with these limits visible.
