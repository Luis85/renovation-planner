# Creation fidelity preparation — M03–M05

Source starts at combined checkpoint `a79baa83`. All eight M00–M07 reference images and
their screen/component contracts were inspected before this contribution. This note records
implementation, not final visual acceptance; integrated screenshots and native host testing
remain the parent release task's responsibility.

- M03 previously drew an unfilled dashed rectangle with inert measurement text. The preview
  now has a light accent fill, four corner controls and accessible measurement buttons.
  Dragging a draft corner fixes the opposite corner through the existing rectangular drawing
  tool. Abandoning the gesture restores its prior draft. Measurement buttons focus the same
  Inspector fields, opening the constrained drawer when needed; no second write path exists.
- M04 previously placed its complete numeric form over the drawing canvas and had no segment
  captions, corner identifiers or angle guide. The existing form now occupies the Inspector
  during structure creation. Its per-leaf draft survives responsive panel visibility changes.
  The compact canvas taskbar keeps Undo point, Finish and Cancel on the same runtime actions.
  Current draft geometry supplies segment lengths, corner identifiers and the turning angle.
- M05 keeps the three canonical starting choices with introductory guidance and a recommended
  Room route. An actually empty floor has a setup checklist instead of populated-floor figures.
  Add-menu stacking/gating is coordinated with the shared-shell contribution.
- The permanent Inspector landmark heading remains accessible but is visually hidden, leaving
  the selected entity or active task as the first visible heading.

Boundaries retained: Room/Area are Zone projections, Project → Floor remains the hierarchy,
Room naming suggestions do not persist a room kind, and independently owned Room outlines
and walls are not synchronized. Walls are straight; closed-loop Room creation remains explicit
and reversible. Reference setup remains the accepted root-owned dialog. Rotation tools and
controls are outside this contribution.

Verification on this worktree:

- Scoped ESLint with zero warnings, and `vue-tsc --noEmit`, passed.
- Seven focused files cover 50 creation, snapping, structure and Floor cases. The initial
  run passed 48; two corrections were verified by a five-case rerun of the exact affected
  files. The corrections removed a template comment that made the Konva component root a
  Fragment, and reacquired the Floor DOM after the intentional Inspector route change.
- `styles`, `buttonSpecificity`, `buttonFocusRing` and `encoding` passed 294 checks.

These checks cover draft-corner resize/cancellation, measurement focus in full/constrained
panels, scene ordering, and real wall creation, history and numeric form routing. Full
repository verification, screenshots of this source and native acceptance remain pending
the integrated release pass. Passing these targeted checks is not visual acceptance.
