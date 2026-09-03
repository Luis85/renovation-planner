---
type: Issue
parent: "[[Start one creation task from Add]]"
order: 70
status: New
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: high
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

# The Add-menu pointer tests omit pointerup

## The question

The overlay's routing contract stops both ends of a press:
`pointerdown`, `pointerup` and `pointercancel`
(`src/presentation/editor/surface/EditorSurface.vue:1238-1245`). The Add-menu pointer tests
dispatch `pointerdown` and then use a synthetic `click`
(`tests/presentation/editor/add/addMenu.test.ts:252-292`); none dispatches `pointerup`.

That event stream cannot prove the release half of the overlay boundary. Design spec §7.2
requires click operation without the canvas receiving the menu gesture, but the tests exercise
only the press-side document listener and the final click handler.

## What is true today

- A measured search of `tests/presentation/editor/add/addMenu.test.ts` finds six constructed
  `pointerdown` events and zero constructed `pointerup` events.
- `trigger('click')` dispatches a click event; it does not synthesize the real
  pointerdown/pointerup grammar around it. The test comments at lines 233-250 reason about
  press routing while never driving the matching release.
- Removing `@pointerup.stop` from
  `src/presentation/editor/surface/EditorSurface.vue:1241` leaves every Add-menu test with the
  same input and therefore the same result.

## Why it matters

A release reaching the canvas without its matching press is a routing defect this editor's own
gesture code repeatedly guards against. The test suite currently claims the menu is isolated
from the canvas while omitting the event that holds half of that isolation.

## What closes it

Use one pointer helper that sends a real `pointerdown`/`pointerup`/`click` sequence for the menu,
anchor and Select-button cases. Register a pointer-up observer on the canvas boundary and assert
that it receives zero releases from those overlay controls; camera and tool state alone are not
discriminating because their unmatched-release guards can absorb the leak. Mutation-check by
removing only `@pointerup.stop`; the delivery-count assertion must fail while the press
assertions remain green.

## References

- `src/presentation/editor/surface/EditorSurface.vue:1238-1245`
- `tests/presentation/editor/add/addMenu.test.ts:233-292`
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:358-365` — §7.2.
- [[Start one creation task from Add]]
- [[Operate the Add menu by pointer and keyboard]]
- Reviewed at commit `16757d6d`, PASS 3.
