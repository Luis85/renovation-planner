# AD01 — Freeze behavior, data contracts and the screen-state specification

**Owner:** ARCH · **Scope:** beta · **Relative size:** M

**Prerequisites:** AD00  
**Exclusive lock groups:** contracts. Exact file leases are still required.

## User or delivery outcome

Give all implementation agents one shared contract and remove ambiguities in the generated boards.

## Entry points to inspect

- `docs/user-experience/renovation-planner-editor-specs/`
- `docs/user-experience/asset-library-delivery/`
- `docs/development/adrs/`
- `src/domain/asset/AssetShape.ts`
- `src/domain/asset/AssetDetail.ts`
- `src/presentation/designer/selection/designerSelection.ts`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Adopt or amend contracts/DECISIONS.md. Record decisions in repository ADR/spec conventions, without renumbering existing SDD sections.
2. Freeze selection, grouping, element geometry, authoring metadata, reference space, command completion, clearance review, navigation and rendering contracts. Define exact affected file ownership.
3. Specify screens S00–S11 from the master plan, including empty/loading/error/stale/conflict states, focus movement, primary actions, compact behavior and theme tokens.
4. Correct the mockups: no product logo/account chrome, no second manual save workflow, no north compass, no automatic “fits well” approval, and coherent back-centre/front direction.
5. Record one canonical contract revision and concrete implementation types/paths. Resolve whether any existing issued-plan workflow forces historical preservation work earlier.

## Acceptance criteria

- [ ] No implementation agent must invent a schema, selection model or command outcome independently.
- [ ] Dimensions are derived; physical size, graphics, reference space and display units remain distinct.
- [ ] All concept-board controls are classified as implement now, existing/reuse, correct, or defer.
- [ ] Group layering behavior, duplicate-ID behavior, mixed-scale behavior, and clearance-on-resize behavior are explicit.
- [ ] All accepted defaults have a reason; departures from accepted repository behavior are recorded, not silently treated as bug fixes.

## Required verification

- Review contracts against actual consumers and hostile fixtures discovered in AD00.
- Check all screen states against the current lifecycle and error-routing policy.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.
