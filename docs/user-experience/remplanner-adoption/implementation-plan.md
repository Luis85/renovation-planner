# Implementation plan

## Admission and ordering

R00 reconciled final color tip `b5c4ccda08d98e0e966941250de90544948d2e62`, including #212/#213/#214 and current main `9ef6070302cdd92a867668236a434c02d613f2fb`. Coding packets are queued only until the planning PR is green; each later launch uses its green predecessor's immutable SHA. Lower ownership is released by the parent resume. Strict sequence: wall/color → planning branch placement → R00 → R01 → R02 → R03 → R04. R05 is a later contract study, not required for this wave. R01 and R03 share editor/runtime/locale seams; R02 and R03 share View. Serial delivery is intentional even if slots are available.

Use the [manifest](parallel-delivery/dispatch.json) for exact existing/new paths and targeted tests. Those paths were checked against baseline; every launch repeats existence/ownership checks after stacking. A file outside the allowlist needs coordinator reassignment before editing. Each packet owns its own receipt and supporting evidence.

| Packet | Priority / model | Outcome and rationale |
|---|---|---|
| R00 | Gate / GPT-6 Astra, high | Reconcile stack, ownership and contract drift. Requires broader architectural judgment; coordinator role, no speculative implementation. |
| R01 | P1 / gpt-5.6-terra, high | Compact direct opening edits. Crosses geometry preview, guarded command admission, mode lifecycle and persistence. |
| R02 | P1 / gpt-5.6-luna, high | On-demand drawing/keyboard help using settled behavior and native presentation. Bounded strings, component and tests. |
| R03 | P2 / gpt-5.6-terra, high | Passive selection-measurement visibility with safe preference persistence and active-edit exceptions. Cross-layer state work. |
| R04 | Gate / GPT-6 Astra, high | Integration, risk review, native/browser evidence and final polish. One heavy-verification owner. |
| R05 | Later / GPT-6 Astra, high | Handoff/export design contract. High uncertainty and explicit scope decisions; implementation separately assigned after acceptance. |

Assignments are complexity judgments, not measured model-performance claims. Every task must use the exact assigned model/reasoning. The parent can revise assignments explicitly when task scope changes.

## R00 — reconcile and admit

Read final wall/color receipts; verify ancestry, changed-file sets, schema version and command admission changes. Wall owner's 2026-09-14 message explicitly leaves compact opening UI to a follow-up; it adds optional initial-write admission to `StructureCommand`. Delivered wall A/B uses schema 13; delivered item/asset colors use schema 14. See [wall receipt](../editor-usability-increment/parallel-delivery/receipts/ASTRA-WALL-SIDES.md) and [color contract](../../development/item-colors.md). Preserve both on every opening write.

Update package state, resolve shared-file ownership, replace null dependency SHA only with the coordinator-supplied integrated commit, and record changed contracts. Confirm all related open PRs still form one chain. Revalidate R01's gap; remove any work already completed upstream. No production change unless a separately recorded integration conflict requires it. Acceptance: one explicit parent SHA per launch, zero unresolved ownership intersections, known verification lease, and copy-ready prompts containing real SHAs. I18 stays open.

## R01 — direct door/window editing

### Current/reference mapping and decision

**Approved user decision — 2026-09-14:** task-specific buttons over selected items and compact overlay/right-click menus are an approved interaction principle. The door/window reference is R01's primary design input. Deliver selected-opening task buttons together with the compact menu; opening a panel from a generic entry alone does not satisfy this direction. Generic Add detail remains removed. Adoption concerns the interaction pattern, not RemPlanner styling or unverified arrow semantics.

The user reference has endpoint/centre circles, two arrow pairs, a width dimension and a swing arc. Official FAQ documents hosted placement, changing opening size and swing direction; it does not establish the arrow pairs' semantics. Baseline already has Move along wall, numeric offset/width/height/sill, hinge start/end, swing side and angle, with straight/curved host symbols. These existing routes stay authoritative.

Deliver a compact selected-opening action to open a DOM **Opening size and swing** panel with labeled numeric width and start offset plus existing hinge/side/angle controls where applicable. Include labeled increment/decrement buttons for width and along-wall offset, reusing current length parsing and formats. Suggested increment is 10 mm, explicitly visible in accessible names; exact input remains available. Keep width edits anchored at the opening's centre; recompute start offset from centre and new width. Offset edits translate along the current host without changing width. This is a deliberate local interaction contract, not a claim about RemPlanner.

Do not implement endpoint drag resizing in this packet. It would need a separate selected fixed-end/centre anchoring contract and current-run validation. Width proposals extending outside the host are refused with an explanation; they are not silently shrunk or shifted. Preserve established clamping for the existing pointer move route. Overlapping openings remain refused by the domain. Hinge and swing labels must use existing domain meaning relative to host direction; no ambiguous left/right screen-arrow imitation. Window-only and door-only fields retain existing eligibility.

### State, command and accessibility acceptance

- Single selected opening only; groups/multi-selection use the existing member selection route. Show opening identity, host identity, width and offset units.
- Preview locally; Apply saves one existing Structure command; Cancel/Escape discards. No-op and invalid proposals add no history. Undo/Redo restores exact geometry and metadata.
- Preserve host ID, opening ID, height/sill, links and unrelated structure. Straight and curved hosts use `alongWall`/`projectOntoWall` and domain length rules; no screen-pixel geometry.
- Admit start and initial write only in Plan. Explicitly close `openingMove.ts`'s baseline action-level Renovate gap, while preserving history replay semantics. A pending read followed by Cancel, unmount, selection/host change or perspective departure cannot create a late write. Reuse final wall cancellation/admission contract; do not duplicate it.
- Refuse stale baseline, external modification, deleted/changed host and invalid overlap. Distinguish write failure from read-back failure; a refresh retry must not dispatch twice.
- Keyboard floor-list/context/Details path reaches the same controls and command. DOM buttons target 44×44 CSS px, display focus and text labels; no drag-only or color-only requirement. Escape closes local UI before clearing selection. Controls remain reachable at 320/460px leaf widths and 200% zoom.
- Direct buttons, compact overlay/right-click menu and Inspector/keyboard routes expose the same eligible reversible actions and share proposal, validation, Apply/Cancel and command behavior. No action exists only on the canvas. Use labeled width/offset and hinge/swing actions from this contract; no duplicate command implementation per entry point.
- Focus follows a logical DOM order and returns to the invoking control, or its surviving Inspector/menu equivalent, after close. Selection alone reveals the applicable actions; hover is not required. Keep overlays inside the leaf and clear of the edited opening, active fields and taskbar. At narrow widths or zoom, reposition or collect buttons into the compact menu without reducing action coverage or 44px targets. Verify parity and focus restoration across responsive changes.
- EN/DE and both themes; validate door, window, straight/curved host, near-end refusal and existing host rotation. I18 remains a separate unresolved criterion.

Preserve `Wall.sideExtents`, legacy resolution through `wallSideExtents`, host-face reach and the clipped opening masks/frame polylines introduced by #213. `openingSymbol` accepts optional fourth `clips`; door leaf/swing remains untrimmed. Do not revert these seams to symmetric geometry. No geometry schema migration is intended. If final upstream APIs cannot express this interaction, stop the dependent implementation and report the concrete conflict; do not invent a sidecar field. Focused tests are in the manifest plus a new `remplanner-opening-direct.test.ts`. R04 owns full gate/native acceptance.

## R02 — keyboard and drawing help

Add a bounded **Drawing and keyboard help** disclosure inside the existing View menu, with a small dedicated content component. Native `<details>`/text/list semantics; no modal framework change, tutorial overlay or new shortcut. Group brief content into Move around, Draw precisely, Edit selected items and Save/recover. Explain existing context-menu key, fit, pan, numeric forms, Enter/Backspace scope, Escape and undo/redo. State Plan/Renovate/Review limits and I18 honestly. Do not restore Add detail or advertise undeployed wall/opening/color actions.

Read actual shortcut handlers at launch and write EN/DE content from those handlers, not copied competitor strings. Provide pointer alternatives beside keyboard instructions. Reference-plan shortcuts must be explicitly scoped to its preview. No fabricated help video, external account or generic “all controls accessible” claim.

Acceptance: keyboard opens/closes disclosure, Escape returns to View summary through existing behavior, help never changes active task, draft, selection, camera or history, and text does not overflow at narrow width. Existing drawing key behavior is unchanged. New content has targeted behavior tests, EN/DE parity and visible browser evidence. No persistence/migration. Reuse existing style tokens and only a scoped help partial if needed. If a disclosure cannot fit without changing menu lifecycle, escalate that specific issue instead of enlarging Luna's packet into a framework redesign.

## R03 — selection measurement visibility

Add **Selection measurements** in View, default on. This controls passive selected Room edge/width/depth and wall measurement labels only. Authored Measurement objects, annotation text, opening symbols, active drawing dimensions and active edit/preview forms remain visible. It is not an all-dimensions layer. Active numeric editing remains reachable through existing Details/context routes; re-enable the choice from View to restore label entry.

**Approved overlay contract — 2026-09-14:** hiding passive labels must preserve selected-item task buttons and compact overlay/right-click menus for the same reversible edits, with Inspector and keyboard parity. Treat a dimension label that is also an edit entry as an action: retain an equivalent labeled task button/menu route when its passive readout is hidden. R03 does not add new geometry commands or restore generic Add detail. Existing actions continue to share validation, preview, Apply/Cancel and history behavior across entry points; the visibility preference itself remains a view choice outside geometry history.

Keep task targets at 44×44 CSS px with visible focus and logical order. Do not remove a focused entry when toggling visibility or changing responsive layout; preserve it or deliberately return focus to a surviving equivalent control. Reposition overlays or collect actions into the compact menu at 320/460px and 200% zoom, without obscuring active fields/taskbar or creating a canvas-only capability. Add parity checks for buttons/menu/Inspector/keyboard with measurements both on and off, including focus restoration and unchanged geometry/history from the toggle.

Persist optional boolean `selectionMeasurementsVisible` through existing device-local view preference read/merge/write boundary. Missing/invalid data defaults true; failed preference write is logged, never a geometry save failure. Merge only changed keys against current stored values, preserving grid/snap choices from another leaf. Existing open leaves retain their current snapshot semantics; do not introduce synchronization or plan-level fields. Update interface, initial hydration, watch and WorkspaceStore reset together. No Markdown or `.rpgeo` migration.

Render policy must distinguish passive selection from an active dimension/curve/rotation/structure preview. Do not use broad CSS hiding that strands a focused input. Ignore/refuse a toggle while a pointer gesture is in flight; keep checkbox truthful. A view choice changes no geometry, revision, plan selection, active tool, history or renovation state. Ensure dimension collision-obstacle calculations match actually rendered labels. Tests cover default, false, malformed data, two-leaf merged writes, fresh remount, passive hidden/active retained, restored numeric entry and no geometry/history changes. R04 checks visual density and persistence in Obsidian.

## R04 — integrate, validate and polish

Read every receipt and diff, run focused regressions after stacking, then acquire the full lease and run `npm run check` once on the combined source. Keep thresholds unchanged. Fix concrete findings in the responsible existing packet branch where safe; push before marking addressed. Coordinate strict-chain PR creation with the parent. Run the [validation matrix](validation-plan.md), Impeccable detector because UI has now changed, one batched visual inspection and at most one confirmation pass after fixes. Record native/AT/human checks as unperformed if unavailable. No release-ready or AA claim while I18/native/human criteria remain unresolved.

### Required final Astra review phases

R04 performs and records four explicit phases on the combined tip: (1) UI fidelity to the approved task-button/compact-menu reference in EN/DE/themes/narrow leaves; (2) code review and focused improvements to commands, cancellation, persistence and tests; (3) fetch current main and, only if absent, merge it normally at the top, fix conflicts and rerun affected/full verification; (4) computer-use review/polish in a designated disposable real Obsidian vault, followed by relevant regression confirmation. Use GPT-6 Astra/high. One exclusive local heavy-verification lease spans these phases. Create a stacked R04 PR and await green CI; report unavailable native/AT access as an external limitation, never as passed. Do not merge any PR to main.

## R05 — later print/handoff contract

Design-only deliverable after immediate wave: compare existing Review-note output with a homeowner discussion sheet. Specify snapshot/version timestamp, Existing/Planned distinction, selected floor and layer inclusion, uncalibrated reference handling, physical scale versus fit-to-page, page bounds/units, font embedding, curved geometry, color-independent legend and textual companion. Define missing/stale/unknown evidence and explicit exclusions before any Export action. Select local output format and infrastructure port with SDD review; no arbitrary browser print of the live canvas. Test exported dimensions on paper and inspect PDF text/order if PDF is selected. Professional approval, electrical compliance and construction readiness remain out of scope. This is a proposed future contract, not authorization to ship a CAD-grade exporter.
