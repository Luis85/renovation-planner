---
type: Issue
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 50
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
effort: S
complexity: ""
business-value: ""
business-value-model: ""
---

# The warning live-region contract and implementation describe different semantics

## The question

Is each warning an independent live region, or are all warnings updates inside one pre-existing
live region?

## What is true today

Design spec §5.1 says `PersistentWarningStrip` renders every warning as its own
`role="status"` element
(`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:174-193`).
The implementation deliberately does the opposite: one unconditional container has
`role="status"`, while warning items have no live-region role
(`src/presentation/editor/shell/PersistentWarningStrip.vue:9-20`,
`src/presentation/editor/shell/PersistentWarningStrip.vue:27-40`).

The current test explicitly pins that container-first model, including the empty live region
before any warning arrives (`tests/presentation/editor/shell.test.ts:303-317`). Measured with
`rg -n "role=\"status\"|rp-warning-strip__item"
src/presentation/editor/shell/PersistentWarningStrip.vue
tests/presentation/editor/shell.test.ts`: there is one production status role and the test
requires it on the container.

## Why it matters

The two models have different announcement behaviour. Adding item roles blindly could create
nested or repeated announcements; retaining the container while claiming per-item live regions
leaves the accessibility contract false. SDD §85 requires accessible status communication but
does not decide which of these two announcement models is correct.

## What closes it

Make an explicit accessibility decision, then align the design contract, implementation, and
tests. The smallest close is to retain the already intentional, pre-existing container live
region and narrow §5.1 to describe it, unless assistive-technology evidence demonstrates that
separate item regions are required. Do not add item roles merely to match the stale sentence.

The discriminating DOM test must assert the selected model and reject the other: for the current
model, exactly one unconditional `.rp-warning-strip[role="status"]` and zero item status roles,
before and after two warnings arrive independently. If the decision changes, replace that test
with the opposite contract rather than keeping both.

## References

- [[Open a floor plan in the Obsidian editor shell]]
- [[Render independent simultaneous persistent warnings]]
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:174-193`
- `src/presentation/editor/shell/PersistentWarningStrip.vue:9-20`
- `src/presentation/editor/shell/PersistentWarningStrip.vue:27-40`
- `tests/presentation/editor/shell.test.ts:303-317`
- SDD §85, Accessibility
- Reviewed at commit 16757d6d
- PASS 2
