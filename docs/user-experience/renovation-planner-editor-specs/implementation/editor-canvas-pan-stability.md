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
