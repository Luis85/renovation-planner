# Shared editor shell fidelity

Scope: M01, M02, M15, M16 and shared chrome across M00–M17. The baseline for this
increment is combined integration `a79baa83`; the locked screen images and component
library define the visual and keyboard contract.

- Property now presents the actual Project and current Floor, followed by a distinct
  Layers section. Visibility remains native checkbox state behind labelled eye icons.
  Reference lock and opacity describe the saved configuration; changing them still
  opens the guarded reference setup. No Building, extra Floor, Site or hierarchy is invented.
- The semantic change legend pairs strokes with text and plus/minus icons. The existing
  Structure and Room/Area lists, multiple-selection control and selection help remain
  available through the native Elements disclosure. Hiding this section deletes nothing.
- Add uses compact, unboxed catalog rows, a narrower popover and an Escape hint. Its
  stacking level is above canvas start content. Catalog availability, unavailable reasons,
  roving menu focus and canonical creation paths are unchanged.
- Persistent warnings precede the canvas in document order. The stale warning has a
  specific heading, while each independent warning retains its own actions and busy state
  within the existing live region. Retry still rereads without replaying a mutation.
- Status reads zoom, grid, snapping, scale and save state before gesture help. The current
  floor and pointer telemetry remain available to assistive technology; constrained layout
  prioritizes the core status and withdraws the standing pan hint.
- The constrained rail carries text and icons plus the selected entity or Floor's name
  in the Details action. Focus this tab remains reachable at constrained widths. The
  existing modeless overlay, focus return and unsupported-width behavior are retained.
- Perspectives use radiogroup semantics and one Tab stop, with arrows and Home/End through
  the existing perspective transition. Focus follows the perspective actually accepted by
  that transition. Selection, camera and persistence remain owned by the existing runtime.
- The generic Inspector heading remains available to assistive technology, allowing each
  contextual content heading to lead visually. Its region and close controls are retained.

All DOM colors consume Obsidian variables. New harness icons retain exact SVG bytes from
the same pinned Lucide revision as the existing fixtures; production continues to call
Obsidian `setIcon` with its explicit Lucide namespace.

## Verification

Checks completed on the shell branch:

- `vue-tsc --noEmit` passed.
- Scoped ESLint passed all 16 changed TS/Vue modules; the final warning-component change
  was checked again separately.
- Eight focused shell/Add/stale files covered 114 tests. The initial run passed 113; the
  retained severity-word regression was fixed in the component and its exact case passed.
- Four stylesheet/button/icon files covered 315 tests. The initial run passed 314; the
  focus-ring category check identified two flattened controls. Explicit rings were added
  and the exact category check passed. No test expectation was weakened.
- `git diff --check` passed.

The focused
`shellFidelity.test.ts` exercises keyboard perspective changes with selection/camera/write
preservation and layer visibility without persistence changes. The existing shell, layer,
responsive, stale-path and Add suites were included in the behavioral checks.

Integrated screenshot and native-host acceptance are still pending. Screenshot acceptance must inspect light, dark, custom accent and German constrained
states, including Add over an empty Floor and persistent stale content. Browser helpers
must expand Elements before interacting with its entity rows; perspective state is now
`aria-checked` on radios. Live Obsidian acceptance is separate from component verification.

## Follow-up: stable Review navigation

The user reproduced the perspective bar shifting when Review hid Undo/Redo. The
history controls now retain their layout footprint while hidden and disabled in
Review. The Review browser journey now measures the tab group's position before/after
the switch. Its browser assertion remains unrun until the integrated release capture.

Follow-up verification on 2026-09-09: scoped Oxlint and ESLint passed for
EditorContextBar and shellFidelity; the Review journey script passed Node syntax;
vue-tsc passed; all 295 tests across shellFidelity, styles, button specificity and
button focus-ring suites passed. The regression checks the retained DOM controls,
disabled/hidden Review semantics, and absence of saved-data changes. It does not claim
to measure layout in jsdom. Earlier verification above applies to the prior shell commit.
