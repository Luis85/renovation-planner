---
type: Issue
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 100
status: New
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: medium
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: M
complexity: ""
business-value: ""
business-value-model: ""
---

# The constrained-overlay contract both requires and refuses a focus trap

## The question

Should the constrained Layers overlay and Inspector drawer trap keyboard focus while open?

## What is true today

M16 explicitly says overlay panels trap focus while open
(`docs/user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md:56-61`).
The Inspector PBI explicitly requires the opposite: the Inspector is keyboard reachable and
does not trap focus (`docs/requirements/Inspect a selected room.md:79-87`).

Design spec §5.5 chooses no trap and says that is what M16 asks for, although M16's text says
the reverse
(`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:241-247`).
The production components intentionally implement no trap
(`src/presentation/editor/shell/OverlayPanel.vue:9-21`,
`src/presentation/editor/shell/InspectorDrawer.vue:7-13`). They focus the container on mount,
close on Escape, and rely on the shell to return focus.

Measured with `rg -n "trap focus|does not trap|Neither traps" docs src`: the requirements
contain both decisions, while the responsive tests cover Escape and focus restoration but do
not press Tab through either panel
(`tests/presentation/editor/shell/responsiveShell.test.ts:69-122`).

## Why it matters

A focus trap is interaction policy, not an implementation detail. Adding one to satisfy M16
would violate the Inspector acceptance criterion; retaining no trap while citing M16 leaves the
design rationale factually wrong. SDD §85 requires keyboard-accessible controls and visible
focus but does not decide whether these modeless panels are modal.

## What closes it

Decide the contract before changing code. The smallest coherent decision is to keep these
modeless panels non-trapping, amend M16 line 58, and correct §5.5's false reading, because the
Inspector PBI and both components already agree and the canvas is intended to remain reachable.
If product design instead chooses a modal trap, update the conflicting PBI and define inertness
and focus cycling before implementation.

After the decision, add a keyboard test that opens each constrained panel, presses Tab through
its controls, and proves the selected policy, plus the existing Escape-close and focus-return
assertions. A no-trap test must demonstrate focus can leave for the canvas; a trap test must
demonstrate wrapping. Testing only initial focus cannot distinguish them.

## References

- [[Open a floor plan in the Obsidian editor shell]]
- [[Keep layer controls usable in constrained leaves]]
- `docs/user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md:56-61`
- `docs/requirements/Inspect a selected room.md:79-87`
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:241-247`
- `src/presentation/editor/shell/OverlayPanel.vue:9-21`
- `src/presentation/editor/shell/InspectorDrawer.vue:7-13`
- `tests/presentation/editor/shell/responsiveShell.test.ts:69-122`
- SDD §85, Accessibility
- Reviewed at commit 16757d6d
- PASS 5
