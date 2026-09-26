# AD05 — Support every graphic kind across rendering and export

**Owner:** RENDER · **Scope:** beta · **Relative size:** L

**Prerequisites:** AD04  
**Exclusive lock groups:** render, exports. Exact file leases are still required.

## User or delivery outcome

The same asset has the same geometry in designer, library, plan and existing export consumers.

## Entry points to inspect

- `src/presentation/designer/DesignerCanvas.vue`
- `Designer layer/render-model modules found in AD00`
- `Library thumbnail, plan asset renderer and export modules found in AD00`
- `src/presentation/designer/presets/presetPreview.ts`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Extend a shared renderer-independent projection or existing geometry helpers, rather than adding unrelated drawing implementations per surface.
2. Handle all discriminated geometry kinds exhaustively, including open-stroke bounds, line joins/caps, hit-testing and theme-aware closed-shape occlusion.
3. Keep authoring guides, selection boxes, reference sheets and editing isolation out of normal symbol/export output.
4. Use native object units at plan placement; viewport zoom and thumbnail scaling must never alter persisted geometry.
5. Update all existing export formats that contain assets. Mark nonexistent formats as future work rather than claiming compatibility.
6. Add cross-surface fixtures and cache invalidation keyed by the relevant asset changes. Do not create a Konva layer per part.

## Acceptance criteria

- [ ] Open lines and grouped parts render in every current asset consumer without disappearing.
- [ ] Light and dark backgrounds preserve intended outlines/occlusion and readable contrast.
- [ ] Visual bounds do not replace the physical footprint for measurements or placement logic.
- [ ] Rotated/mirrored previews and actual placement use consistent anchor/facing transforms.
- [ ] Unknown/corrupt geometry is refused or clearly reported, never silently omitted in an export.
- [ ] No new writing tool is released before its consumers pass this gate.

## Required verification

- Cross-surface golden render tests plus semantic geometry/bounds assertions.
- Test a thin open path, overlapping solid details, dashed details, off-centre anchor and reflected curved shape.
- Verify export inclusion/exclusion without using screenshots alone as proof of geometry correctness.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.
