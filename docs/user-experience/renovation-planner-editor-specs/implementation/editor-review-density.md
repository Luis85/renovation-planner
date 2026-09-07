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

The first corrected gallery passed all Light phase/identity/visibility checks at `36691b1c`.
The following Review check then measured its heading at y=−14.4 against an Inspector starting
at y=55. Two empty findings lists still occupied grid spacing. The next correction omits only
those empty lists and tightens Review spacing/Room-row padding, retaining auto-growing rows
with at least 48-pixel targets. No existing finding, prose, quantity or action is hidden.

At `98434761`, current types/Oxlint/scoped ESLint passed, and the actual Light M14 and M17
captures both passed all full-Inspector visibility checks. The added Review accessibility scan
then correctly failed Open room's contrast (3.42:1, required 4.5:1). The existing semantic CTA
color rule covered only direct Inspector children; it now also covers the nested Review CTA.
No color tokens, contrast criteria or accessibility assertions were changed. The next actual
four-theme capture remains pending.

The contrast correction passed Light and Dark's complete strengthened journeys. At the narrower
1000-pixel custom-theme leaf, Review still placed its heading 31.4 pixels above the Inspector.
The selected transformation's long footer wrapped, and Documents wrapped inside its small link.
A Review-only compact summary now puts the same Work completion ratio in the Work heading;
the change count remains visible in the selected Room row. Other overview callers retain their
original footer. Link padding/gaps are tighter horizontally and buttons can grow with real text.
No counts, labels, controls, rules or limits are discarded. Current runtime verification remains
pending; whole Oxlint and diff checks passed on this correction.
