# Stable Room configurations during pan

The complete 43041936 browser run passed its functional journeys but missed the 60-fps pan
target. Root's quiet repeat measured idle frames around 16.6–16.7 ms while three of four pan
medians remained around 33 ms. A separate dark CPU profile attributed substantial work to
vue-konva's configuration diff and reactive configuration copying. Original measurements,
including a 107 ms selection sample, remain Root-owned evidence and are not discarded.

Changing measured world viewport bounds reached every ZoneShape. Even when its caption stayed
in exactly the same place, its layout and inline Konva configuration objects were recreated.
The correction computes the scalar caption displacement separately and caches the six actual
Group/Line/Text configurations. The existing single, permanent identity Group is memoized by
those configurations. Its data, geometry, theme, scale, selection, labels and actual caption
movement remain dependencies; the three captions, two shape nodes and layer ordering remain.
No viewport, room count, font, pin, geometry or provider contract is reduced.

The structural regression changes a real non-null world viewport in the mounted editor and
reads the config identities actually handed to vue-konva. It failed against the unchanged
43041936 production source with equivalent-but-new configs (session 32581, 8.34 seconds).
After stabilization, it and the scene/order/dimension-caption/obstacle/fallback suites passed
24 tests across six files (67035, 28.59 seconds). Resize/outline/inline/lifecycle neighbors
and the regression passed 47 tests across five files (31.77 seconds). The initial test setup
needed explicit jsdom overlay bounds; that setup failure is not the reported RED proof.

Browser performance comparison against Root's identical large-floor stimulus is next. Native
passes establish renderer behavior, not the final frame-rate target. M01/M04 presentation
follow-ups and the explicitly attributed matching visual supplements remain pending.

## Measured follow-up at dba43e5f

The same quiet four-scenario large-floor stimulus completed at
`dba43e5fc1d3301b5884e6c386e4722d38f831e4` (67702, exit 0), retaining 80 Rooms, 240
materials, 24 catalogue entries and 40 photos. Only the driver import/output paths changed. All pan
and material-pan medians were 16.6–16.7 ms, with p95 16.9–17.1 ms, matching the idle cadence
and approximately 60 fps. Usability was 467.4–508.6 ms, selection 52.6–59.8 ms and Inspector
navigation 43.7–53.1 ms. All four latency budgets and retained resource checks passed.

The identical dark profiling stimulus also completed (73590, exit 0). Weighting each sampled
stack's self time by its recorded time delta, vue-konva's M/g configuration functions fell
from 344/476 ms to 27/43 ms across the two captures (16.83/22.68% to 1.67/2.85% of recorded
time). This supports the targeted cause; profiler timings are diagnostic, not acceptance data.
Exact drivers, raw intervals, reports, profiles, screenshots, comparisons and hashes are kept
in `evidence/editor-canvas-pan-stability/measured-dba43e5f`. Original 430 results remain intact.
The complete visual/functional matrix must still reflect subsequent M01/M04 follow-ups.
