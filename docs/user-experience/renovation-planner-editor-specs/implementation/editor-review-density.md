# M17 — matching Review viewport

The actual [initial Review screenshot](evidence/editor-review-density/initial-light-review.png)
from planning `--design` at `a59a0ec3` is 1440 × 900. After the native Create review note action,
its heading and first Room rows are above the visible Inspector. The locked M17 composition
shows the Room list, selected transformation, linked summaries and actions together.

Initial image SHA-256: `d6bc01de68aca24db17cf54b3ff53cd2e70ee3d95f8fbfd6b9d6fda77c9841fb`.

The bounded source-only correction uses two columns for the five existing linked-section
buttons and aligns cost labels and amounts on one row in Review. All five labels, counts,
icons and actions remain. No readiness calculation, navigation handler or selection changes.

The driver keeps the original 900-pixel capture and actual review-note action, then adds a
matching 1000-pixel capture. The shared Inspector visibility measurement checks the heading,
Room list, transformation, Open room and review-note actions in full layouts. No scroll reset
or focus override is used to make a screenshot fit. Narrow layouts retain ordinary scrolling.

Syntax/source checks passed; corrected runtime, accessibility and pixel verification remain
pending. This is WIP, not final M17 acceptance. The original scope disclaimer and read-oriented
behavior remain visible; no complete readiness or construction approval is claimed.
