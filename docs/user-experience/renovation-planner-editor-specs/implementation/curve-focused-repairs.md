# Focused curve and rotation repairs

Prepared from integrated `38c821fc`. The original single-worker focused run completed with
408 passing and seven failing cases across 37 files, without timeouts or unhandled errors.
Its unchanged log is retained at
`C:/Users/lum/.codex/tmp/editor-focused-combined-tests-20260909.log`.

This concern addresses five failures in four files:

- Both signed semicircle endpoint-tangency cases returned containment for an outside point.
  A mathematically zero quadratic discriminant became a small positive value within the
  solver's existing round-off tolerance. The solver now returns one tangent root for either
  sign of that noise. Outside/inside expectations remain unchanged.
- A failed refresh retired the current curve target and made its typed draft inaccessible.
  Review still cancels the task; failed read-back now leaves it paused, with the existing
  write gate retaining authority until a successful retry. The recovery test is unchanged.
- Straight-edge radius entry produced `0.5000000000000001`, rather than the test's exact
  `0.5`. The derived positive/negative values are checked to 14 decimal places; exact-input
  and unchanged-value assertions remain intact.
- The refused rotation test expected every vault byte to remain identical. The actual
  difference was only Plan revision 2 → 4: RenovationCommand conditionally saves the Plan,
  attempts the geometry CAS, then conditionally restores the original Plan entity. Each
  successful Plan save advances its revision. The revised test verifies the refusal port
  and proposed geometry, both conditional Plan saves, unchanged geometry snapshot and all
  non-Plan bytes, exact restored Plan content, the two-step revision advance, cleared activity
  and preview, and that the next Undo reaches the prior successful insertion.

These repairs do not change timeouts, coverage thresholds or exclusions. The retained original
failures distinguish actual geometry/recovery bugs from incorrect test expectations. The
prepared repairs are **unrun** pending the root's combined focused rerun.

The root's subsequent Fallow diagnostic also identified two over-complex curve helpers and
unnecessary/private type exports. The repair keeps the validation and ray rules in small named
contact predicates, makes the internal boundary validator private, removes the unused result
alias, and explicitly exports/consumes `CurveTaskRuntime` as the factory input contract. No
analysis threshold, suppression or unrelated source file is changed.
