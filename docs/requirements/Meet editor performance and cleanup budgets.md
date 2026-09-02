---
type: PBI
parent: "[[Release hardening]]"
order: 70
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Use the editor in Obsidian themes and constrained layouts]]"
---

# Meet editor performance and cleanup budgets

## Quality outcome

The released editor responds at homeowner scale and leaves no active canvas resources after its
Obsidian leaf closes.

## Main flow

1. Representative typical and large plan fixtures are defined with rooms, markers, and images.
2. Initial render, pan/zoom, selection, Inspector changes, and recalculation are instrumented.
3. Measurements are compared with the proposed Phase 12 budgets.
4. The leaf is closed and retained stages, listeners, object URLs, stores, and subscriptions are
   checked.
5. Results, environment, fixture size, and exceptions are recorded as release evidence.

## Extensions

- **3a** — A proposed budget is not achievable or does not predict usability. It is not silently
  weakened; evidence and a product decision revise the target before release.
- **3b** — An operation exceeds 300 ms. It remains asynchronous or incremental and exposes
  truthful visible status.
- **4a** — A retained resource is found. The release is blocked until removed or explicitly
  accepted through the release decision.

## Guarantee

Performance claims name their fixture and environment, and a closed editor leaf retains no Konva
stage, registered listener, or object URL owned by that leaf.

## Acceptance criteria

1. Proposed budget to validate: initial usable render under 1.5 seconds for a typical local
   project after Obsidian is ready.
2. Proposed budget to validate: pan/zoom targets 60 fps and never falls below 30 fps at
   representative floor complexity.
3. Proposed budgets to validate: selection feedback under 100 ms and Inspector change under
   200 ms from an available read model.
4. Recalculation is incremental/asynchronous when large and shows status above 300 ms.
5. No Konva stages, listeners, or object URLs remain after leaf close.

## Assumptions

- These numbers are proposed budgets from the implementation plan, not validated product facts.
- Fixture thresholds are measured during this work rather than guessed in advance.
- Real Obsidian measurements complement deterministic automated leak checks.

## Sources

Performance budgets and Phase 12 in the
[editor implementation plan](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md);
WP2 and WP8 in the
[editor vertical-slice plan](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md).
