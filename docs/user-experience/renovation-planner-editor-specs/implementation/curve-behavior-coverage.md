# Curve and rotation behavior coverage preparation

Prepared on integrated `83475735` after the resource-constrained `b758695c` coverage run.
The seven test files below are source-ready and **unrun**. They are to join the other owners'
coverage additions in one focused single-worker gate before the next complete gate.

- `circularArc.test.ts`: finite behavior for a collapsed preview edge.
- `circularContacts.test.ts`: straight contact/overlap, tangent and secant contacts, adjacent and
  overlapping arcs, separated/concentric circles, and horizontal endpoint containment rules.
- `curveDraft.test.ts`: vanished sources, explicit zero-curve maps, unedited Wall siblings,
  invalid hosted-opening containment, radius entry and collapsed/nonfinite input refusal.
- `curvedPresentation.test.ts`: marquee enclosure, curved interior, closing-edge contact and
  remote-box refusal.
- `curveRecovery.test.ts`: native field/Apply/Cancel routes, focus, read/write failures, pending
  operation retirement, frozen busy input, stale baselines and Review retirement.
- `rotationHoverAdmission.test.ts` and additions to `objectRotationRuntime.test.ts`: actual
  member IDs, stale/replaced targets, hover-only approach, disposed reads, guarded write refusal
  and peer kind/curve changes between a captured drag and its guarded commit.

The existing `rotationAdmission.test.ts` is retained unchanged. No production guard, timeout,
coverage threshold or exclusion has been altered.

The failed-refresh case intentionally requires typed curve values to remain available for a
successful read-back retry. Current `curveTask` watches the combined permission predicate and
may discard that draft when read-back fails. This is an expected reproduction candidate, not a
verified diagnosis or a silently changed assertion; any production repair follows the focused
result. The new tests do not yet establish a coverage improvement or visual acceptance.
