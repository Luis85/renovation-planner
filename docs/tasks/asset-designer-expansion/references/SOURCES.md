# Sources, review scope and evidence policy

Review date: 16 September 2026. Baseline: `d77e7c5eba5e6518b93a5be4606532ceab3a77eb`.

The review used targeted connected GitHub reads. It did not execute repository tests or a running Obsidian instance. Paths inferred from documentation must be resolved in AD00; an attempted shortened `src/infrastructure/ObsidianAssetGeometrySidecar.ts` path was not found. The actual infrastructure tree contains `obsidian/` and `persistence/`; do not create a duplicate adapter at the shortened path.

## Pinned repository sources

**[R01] Baseline identity.** [Commit d77e7c5eba5e](https://github.com/Luis85/renovation-planner/commit/d77e7c5eba5e6518b93a5be4606532ceab3a77eb). Observed through the main-branch metadata on the review date.

**[R02] Current stack, engines and package gates.** [`package.json`](https://github.com/Luis85/renovation-planner/blob/d77e7c5eba5e6518b93a5be4606532ceab3a77eb/package.json).

**[R03] Existing Asset Designer epic and integration obligations.** [`docs/requirements/Asset designer.md`](https://github.com/Luis85/renovation-planner/blob/d77e7c5eba5e6518b93a5be4606532ceab3a77eb/docs/requirements/Asset%20designer.md).

**[R04] Current singular selection model.** [`src/presentation/designer/selection/designerSelection.ts`](https://github.com/Luis85/renovation-planner/blob/d77e7c5eba5e6518b93a5be4606532ceab3a77eb/src/presentation/designer/selection/designerSelection.ts).

**[R05] Current dimension-edit and preset paths; inspected lines 203–386.** [`src/presentation/designer/AssetDesignerRoot.vue`](https://github.com/Luis85/renovation-planner/blob/d77e7c5eba5e6518b93a5be4606532ceab3a77eb/src/presentation/designer/AssetDesignerRoot.vue).

**[R06] Current pure shape edits, clearance scaling and documented bulge behavior.** [`src/domain/asset/shapeEdits.ts`](https://github.com/Luis85/renovation-planner/blob/d77e7c5eba5e6518b93a5be4606532ceab3a77eb/src/domain/asset/shapeEdits.ts).

**[R07] Closed detail model, semantic names and validation.** [`src/domain/asset/AssetDetail.ts`](https://github.com/Luis85/renovation-planner/blob/d77e7c5eba5e6518b93a5be4606532ceab3a77eb/src/domain/asset/AssetDetail.ts).

**[R08] Current asset persistence schema, v1/v2 compatibility.** [`src/infrastructure/persistence/dto/assetGeometry.ts`](https://github.com/Luis85/renovation-planner/blob/d77e7c5eba5e6518b93a5be4606532ceab3a77eb/src/infrastructure/persistence/dto/assetGeometry.ts).

**[R09] Current write chain and documented bypasses.** [`src/presentation/designer/selection/editShape.ts`](https://github.com/Luis85/renovation-planner/blob/d77e7c5eba5e6518b93a5be4606532ceab3a77eb/src/presentation/designer/selection/editShape.ts).

**[R10] Whole geometry-document persistence port.** [`src/application/ports/AssetGeometrySidecar.ts`](https://github.com/Luis85/renovation-planner/blob/d77e7c5eba5e6518b93a5be4606532ceab3a77eb/src/application/ports/AssetGeometrySidecar.ts).

**[R11] Current design DTO and distinct note/geometry versions; inspected lines 1–85.** [`src/application/queries/GetAssetDesign.ts`](https://github.com/Luis85/renovation-planner/blob/d77e7c5eba5e6518b93a5be4606532ceab3a77eb/src/application/queries/GetAssetDesign.ts).

**[R12] Current SDD authority and architecture; inspected opening sections.** [`docs/development/sdds/obsidian-renovation-planner-SDD.md`](https://github.com/Luis85/renovation-planner/blob/d77e7c5eba5e6518b93a5be4606532ceab3a77eb/docs/development/sdds/obsidian-renovation-planner-SDD.md).

**[R13] Increment history and guard/integration lessons; inspected opening section.** [`docs/development/agent-guide-increment-history.md`](https://github.com/Luis85/renovation-planner/blob/d77e7c5eba5e6518b93a5be4606532ceab3a77eb/docs/development/agent-guide-increment-history.md).

## Official technical references

**[W01] Konva: application-state serialization.** [Save and Load HTML5 Canvas Stage Best Practices](https://konvajs.org/docs/data_and_serialization/Best_Practices.html). Supports keeping canonical application data instead of serializing a complex runtime stage.

**[W02] Konva: Transformer behavior.** [Basic select/resize/rotate demo](https://konvajs.org/docs/select_and_transform/Basic_demo.html). Transformer supports multiple nodes but changes scaleX/scaleY rather than width/height.

**[W03] Konva: Vue Transformer integration.** [Vue Transformer](https://konvajs.org/docs/vue/Transformer.html). Node attachment and application-state updates require explicit handling.

**[W04] Git: worktrees.** [git-worktree documentation](https://git-scm.com/docs/git-worktree). Separate worktrees/branches share repository administration; file isolation is not a substitute for integration discipline.

These sources were consulted on the review date. Re-check APIs against the locked dependency versions during implementation. No new dependency is required by this plan's default scope.

## User-supplied conversation artifacts

`previous-expansion-concept.md` retains the earlier concept at its earlier f826956… reference. Its date and claims are historical context, not evidence that the current checkout matches it.

`01-overall-look-and-feel.png` and `02-interaction-concepts.png` are the generated concept boards from this conversation. They are not captures of the running repository. The correction table in the implementation plan supersedes conflicting controls/text in those boards.

## Evidence language

Use observed source, reproduced runtime behavior, measured result, proposed requirement, inferred risk and unverified as distinct labels. A documented behavior may warrant a deliberate product change without being an accidental code defect. A test case that exists but has not run is not a passed test.
