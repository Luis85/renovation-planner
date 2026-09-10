# Verification runtime alignment

On 2026-09-09 the shared root dependency installation was found to contain older
Konva, Zod, compiler-sfc, Fallow and Oxlint versions than the current manifest.
The integration and rotation worktrees have the same package-lock SHA-256:
`68a3536b843dadd44f64f2de95ed666ba7d33244d59fa254573b5028b265efb5`.

The shared ignored packages and their required native/nested dependencies were
copied from the existing matching rotation-worktree installation. No manifest,
lockfile, production source, threshold or check command changed. The previous
packages and exact alignment receipt are retained locally at
`C:/Users/lum/.codex/tmp/editor-dependencies-before-20260909`.

The resulting shared versions are Konva 10.3.2, Zod 4.5.4, compiler-sfc 3.5.42,
Oxlint 1.81.0 and Fallow 3.22.0. Fallow reports its signed binary verified. Vue's
nested compiler stays on its required 3.5.41. Vitest reports 4.1.11.

A subsequent dependency-resolution check from the integration, group, curve,
stairs, opening-move, grouped-deletion and wall-rotation worktrees found no resolved
top-level package outside its manifest range. Existing focused receipts retain
their original version/source context; the final unchanged integrated check must
establish current-source acceptance separately.
