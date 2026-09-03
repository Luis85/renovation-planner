---
type: Issue
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 100
status: Done
started: 2026-09-04
finished: 2026-09-04
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

## Decision

**2026-09-04.** **R3** Ruling: the constrained Layers overlay and Inspector drawer do NOT trap focus; M16's "trap focus only while open" sentence is amended to "restore focus on close and do not trap it — the canvas stays reachable by Tab", and §5.5 stops attributing a trap to M16 — because the Inspector PBI criterion 7 ("does not trap focus"), both components and the canvas-stays-reachable design already agree, and a modal trap would need inertness and cycling nobody designed — cost if wrong: a keyboard user can Tab out of an open overlay onto the canvas, which is the intended modeless behaviour; a later modal decision is a redesign of both panels.

## What closed it

**2026-09-04.** The DECISION above (R3) is the substance; this increment supplied the test half
the note asks for, and Task 0 supplied the two document corrections. M16 line 58's "trap focus
only while open" is amended to "restore focus on close and do not trap it — the canvas stays
reachable by Tab", and design spec §5.5 no longer attributes a trap to M16, so the requirements
no longer hold both decisions at once. No production code changed: `OverlayPanel.vue` and
`InspectorDrawer.vue` already implemented the ruling, which is why the ruling is theirs.

Holding tests: `tests/presentation/editor/shell/responsiveShell.test.ts` › the responsive shell ›
'%s does not trap focus: focus can leave it for the canvas (R3)', over both containers. Each
opens its constrained panel, moves focus to the canvas — the element R3 names as the one that
must stay reachable, and a real Tab stop (`tabindex="0"`) in the same shell — and then asks the
two questions a trap would answer differently: a `focusout` trap pulls focus back inside, and a
dismiss-on-blur panel closes. Both are asserted, together with the canvas being outside the panel
and a Tab stop at all.

These are POLICY PINS rather than regression tests: they were green before this increment and
exist so that a later modal trap fails here instead of passing review. What they cannot ask is
what a browser's own Tab key does with the ORDER, because jsdom performs no traversal at all —
the cases move focus directly, which is stated in their docblock. Watched red by inverting their
own expectation (`contains(activeElement)` to `true`), so they discriminate rather than
tautologise. The Electron instrument is step 9 of `docs/tests/cases/Open a floor and select a
room.md`, which is the one place this overlay is opened under a real keyboard — and it watches
Escape's focus return rather than a Tab out, so the traversal itself is measured by nothing
today; that case has also never been run in a vault. Commit "fix(shell): focus survives a growth
that closes an overlay, an unmounted canvas abandons its gesture, and the dead panel toggles are
gone".

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
