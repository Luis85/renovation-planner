---
type: Issue
parent: "[[Inspect a selected room]]"
order: 20
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

# The Inspector's two unavailable lists are separate navigation models

## The question

[[Assemble shared homeowner-question Inspector navigation]] requires that adding a future
linked-content section not create a second homeowner-question navigation model
(`docs/tasks/Assemble shared homeowner-question Inspector navigation.md:30-43`). Its amendment
marks that criterion met because `HomeownerQuestionNav` and `LinkedContentList` both read one
closed `INSPECTOR_SECTIONS` union
(`docs/tasks/Assemble shared homeowner-question Inspector navigation.md:55-66`).

They do not read that runtime list. Each component imports only the `InspectorSection` type,
defines its own private `ROWS` data, and iterates its own near-identical template:
`src/presentation/editor/shell/HomeownerQuestionNav.vue:8-17,20-36` and
`src/presentation/editor/shell/LinkedContentList.vue:11-20,24-40`. The shared type prevents an
unknown section spelling; it does not share row membership, order, label, state rendering or
future navigation behaviour.

## What is true today

- `INSPECTOR_SECTIONS` is one seven-member unavailable vocabulary in
  `src/presentation/read-models/roomOverview.ts:10-21`, and `RoomInspector` passes the same
  `overview.unavailableSections` value to both children at
  `src/presentation/editor/shell/RoomInspector.vue:208-215`.
- The design itself describes two components and two lists: §5.1 assigns three canonical rows to
  `HomeownerQuestionNav` and four linked-content rows to `LinkedContentList`
  (`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:172-190`);
  §6.7 repeats that split (`:325-332`).
- Measured with
  `rg -n "const ROWS|v-for=\"row in ROWS\"|INSPECTOR_SECTIONS" src/presentation/editor/shell/{HomeownerQuestionNav.vue,LinkedContentList.vue}`:
  it finds two private `ROWS` constants and two template loops. The `INSPECTOR_SECTIONS`
  occurrences are comments; neither component imports the value.
- `tests/presentation/editor/shell/roomInspector.test.ts:56-84` asserts the two lists separately,
  and its direct-component cases at lines 171-190 duplicate the supported-row arm once per
  component.

## Why it matters

The task amendment promotes a shared value vocabulary into a shared navigation model. When the
first section becomes available, its author must independently decide which private row list owns
it and independently extend that component's rendering and navigation. The other component can
then diverge in labels, states, focus or route semantics while the shared type and the current
all-unavailable tests stay green. That is the second model criterion 7 says must not exist.

## What closes it

The smallest honest close for this increment is documentary: amend the task to say one closed
unavailable-section vocabulary feeds two presentation models, and leave criterion 7 open until
real routes exist. That matches the approved design's explicit two-list structure without
inventing navigation before any destination is available.

If criterion 7 is intended to be met now, replace the two private `ROWS` constants with one shared
descriptor registry and one row-rendering/navigation mechanism, with grouping as descriptor data
rather than component-owned membership. A discriminating test should add or enable one descriptor
and assert it appears once, in the intended group, with the same state and route semantics in full
and constrained layouts; deleting either consumer's private list must not require changing the
test fixture.

## References

- [[Inspect a selected room]]
- [[Assemble shared homeowner-question Inspector navigation]]
- `docs/tasks/Assemble shared homeowner-question Inspector navigation.md:30-43,55-66` — the
  one-model criterion and the amendment that marks it met.
- `src/presentation/editor/shell/HomeownerQuestionNav.vue:8-17,20-36` — the first private row
  model and template.
- `src/presentation/editor/shell/LinkedContentList.vue:11-20,24-40` — the second private row
  model and template.
- `src/presentation/read-models/roomOverview.ts:10-21` — the shared unavailable vocabulary, not
  shared route descriptors.
- Reviewed at commit `16757d6d`, PASS 4.
