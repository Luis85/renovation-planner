# Core editor analysis cleanup — 2026-09-09

The unchanged Fallow run at `38c821fc` failed with eleven dead-code/signature issues, three duplicate groups and seventeen complexity findings. Its local diagnostic log is `C:/Users/lum/.codex/tmp/editor-integrated-analyze-38c821fc.log`. No suppressions, thresholds or discovery rules are changed here.

This bounded cleanup registers the genuine subject-kind browser CLI, makes intermediate schema constants private, exposes the rotation layout shape contract through the existing RotationShape interface, and separates finite-point validation and length-weighted path pivots. The repository explicitly implements its existing ZoneRepository port. SnapService's degree-step query becomes a method, with its real caller and assertion updated.

A small shared function owns busy/no-op/retirement admission and finally cleanup for StructureCommand and GroupGeometryCommand. Each command retains its own conditional read, write, compensation, event publication and applied-state transitions. Existing command, fault, event and mixed-history tests remain the behavioral proof.

The dimension button becomes a component with the same native button root, attributes, label and click route. Its parent retains positioning, draft ownership and focus restoration. Inline dimension and pointer/keyboard tests must verify the extraction.

Source is committed for combined verification. Only `git diff --check` has passed at this checkpoint; types, lint, Fallow metrics and affected behavior checks remain unrun. The parent combines this with the separately owned Curve, input and detail-template repairs before acceptance.
