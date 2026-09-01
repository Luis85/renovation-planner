---
type: Task
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Reveal one floor in one editor leaf

## Evidence

The [vertical-slice plan WP2](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md) and M01 require an Obsidian-native editor reached from project navigation and commands without duplicate leaves.

## Why it matters

Users need one predictable spatial destination per floor while retaining Obsidian's multi-leaf workspace.

## Approach

Route every floor-open input through one identity-keyed reveal operation, establish view state, mount the approved five-region shell and enter Select after hydration.

## Acceptance criteria

- Two concurrent opens of one floor reveal one leaf.
- Distinct floor IDs can open in separate leaves.
- Project navigation and palette input use the same operation.
- Opening performs no vault write.

## Risks

Host lifecycle ordering can expose duplicate mounts or stale view state.

## Outcome

One gesture reveals one correctly identified floor editor in Obsidian.
