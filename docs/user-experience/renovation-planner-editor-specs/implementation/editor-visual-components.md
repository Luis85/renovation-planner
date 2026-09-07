# Native editor visual components

This follow-up to `fb48fb64` addresses gaps visible in the locked M00/M07 comparison.
This is a verified visual-component checkpoint, not final all-screen acceptance.

- `HostIcon.vue` delegates decorative icons to Obsidian `setIcon`. Native buttons keep
  visible text, focus, disabled state and their existing handlers. One mode-to-icon map is
  shared by navigation, linked content and contextual creation; SVG paths do not ship in
  the plugin. The browser adapter uses [pinned, licensed Lucide fixtures](../../../../tests/fixtures/editor-icons/README.md).
- Overview question rows now include a host icon, the Existing/Planned/Work subtitle and
  a disclosure chevron. Linked-content rows align icon, label, real count and chevron.
  Perspective/history and floating actions use the same component and host tokens.
- Canvas captions now place the name and shared calculated area inside the geometry,
  retaining the separate status text and line pattern. Core calculates the centroid; a
  concave polygon with an exterior centroid falls back to its first boundary vertex. No
  stored geometry changes, and vertex-array identity across pan remains part of the tests.
- The synthetic reference drawing has no embedded labels or project records. Its generator
  is `scripts/editor-floor-reference.mjs`, also invoked by the existing background-fixture
  command. `--design` on the connected overview explicitly seeds three neighboring Rooms
  through `CreateZoneCommand`, renames the created Kitchen through a conditional repository
  save/event, and uses native Fit all. Every Room remains independently selectable through
  the existing list. The scalar and recovery workflows still run on the production commands.

The design fixture is a representative test floor, not a measured building or a claim that
the reference illustration's numbers are the user's data. The existing smoke reference and
failure probes remain available. The final runner selects this fixture for the connected
overview; the final eight journeys and 18 image comparisons remain pending on the complete
joined implementation. Actual Obsidian, physical input and screen-reader observations are
separate acceptance requirements.

## Verification

- Production build/typecheck, scoped ESLint, whole Oxlint and script syntax/whitespace
  checks pass. No dependency was added. The production bundle contains the host API calls,
  not the harness SVG node catalogue.
- **109 tests in 13 files pass** (69.23 s, one worker), including Room lifecycle and
  history, navigation context/focus, overview loading/counts, native host-icon updates,
  geometry centroid fallback and Konva paint order. Scoped coverage passes unchanged
  floors: **100% statements (180/180), 98.50% branches (197/200), 100% functions (60/60),
  100% lines (127/127)**. See [coverage](evidence/editor-visual-components/coverage.json).
- Connected `--design` overview passes light/dark/custom-accent/German constrained
  scenarios in installed Edge **152.0.4191.62**, explicitly overriding pinned Chromium.
  Native scalar input/reflow, pending-write refusal, Undo, contextual detail creation and
  shared Work Preview/Apply remain in the journey. No page errors were reported.
- **12 axe scans have zero violations**; incomplete contrast checks on scrolled or
  obscured controls remain recorded in the scan files. See [browser report](evidence/editor-visual-components/report.json).
- The joined CI run on `14093b4d` exposed three direct-action stylesheet defects:
  missing matching focus-ring selectors, a dimension-button rule losing to the host,
  and an undeclared dynamic sizing variable. This checkpoint fixes all three without
  changing their assertions. `buttonFocusRing`, `buttonSpecificity`, `cssVars`, and both
  Room-dimension suites pass **286 tests in five files** (49.97 s). The short-viewport
  inline form also reserves more vertical space and paints above the inactive dimension;
  browser checks explicitly require Apply/Cancel inside the visible form at 720 × 450.
- Inspected the light M00/M07 captures against the locked references. The host icons,
  inline dimensions, popover shape and centered room captions now correspond to the
  selected design. Final pass must still reduce secondary overview-action density and
  distinguish selected-room fill from surrounding rooms, then recapture after downstream
  workflows join. No full M00/M07 or overall visual acceptance is asserted yet.
