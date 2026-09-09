# Singleton Group selection preview

Reproduced on integrated source `c920921c` on 2026-09-09 with the real mounted
Vue/Pinia/Konva editor and repository-backed geometry. The fixture persists a valid
saved group whose only remaining member is a Room, refreshes the projection, opens
the Group numeric rotation form through its native button and enters 37 degrees.

Before the fix, the real Group preview contained rotated Room geometry, but the
selection outline remained `[48, 48, 448, 48, 448, 348, 48, 348]` and the four vertex
handles stayed at those original screen corners. Both position assertions failed.
The test continued to verify Escape and no writes, isolating the defect to display
projection rather than persisted geometry or cancellation.

InteractionLayer now derives one selected Room geometry from the same combined
candidate projection used by other selection outlines. Curve preview still takes
precedence over Group preview; persisted geometry remains the fallback. The single
outline and vertex handles share this selection geometry. Ordinary single-Room drag
continues to use its separate RenderState ghost. No native root, key, node ordering,
command, transform math or pointer admission changed.

The unchanged position/cancellation assertions in `groupSingletonPreview.test.ts`
then passed: **1 file / 1 test**, Vitest 4.1.11, with `VITEST_MAX_WORKERS=1`.
The test also checks the original selection-outline node identity, exact preview
coordinates, retained saved group, original positions after cancellation and zero
geometry writes during the operation. The first reproducer run failed only its two
expected outline/handle position assertions; the second run passed in 20.12 seconds.

Only this narrow behavioral regression and `git diff --check` were run locally.
Types, linters, broad strict scene/curve/input regression checks, final cumulative
coverage and browser/native-host captures remain pending with the parent. This
mounted native Konva test is not an installed Obsidian capture or visual acceptance.
