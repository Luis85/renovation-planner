# Evidence pin symbols

M14 explicitly requires an icon and number. ADR-0022 preserves contextual pin coordinates,
numbering and selection; it does not waive that visual requirement. Pins now pair their number
with the existing host `image`, `file-text` or `sticky-note` geometry for Photos, Documents and
Notes. Obsidian `setIcon` supplies the SVG paths, rectangles and circles; no separate icon
catalogue, bitmap, or replacement geometry is introduced.

The centered hit surface is now a rounded rectangle sized for the icon and complete number,
including three or more digits. World position, record identity, numbering and selection
callbacks remain unchanged. Caption clearance uses that same variable width and the actual
pin height, and native scene tests compare all three text rectangles against the pin surface.
This is a separate follow-up to the unchanged, previously verified caption checkpoint.

## Verification — 2026-09-07

Base: `f8fcc32b1f47eb7ecedf9eb0830f6bfcd266290d`, plus this commit's symbol changes. The
[manifest](evidence/editor-pin-symbols/manifest.json) records production/helper hashes and Git
blob IDs, as well as the four fresh image hashes. No renderer change occurred after final checks.

- Native result: 31 tests passed across six files, with no unhandled errors, in 36.05 seconds.
  Tests compare each type's actual Konva glyph with the existing host icon fixture, verify
  glyph/number containment, a complete three-digit number, selection, caption clearance,
  pan/zoom and unchanged stored data. The existing scene, marker and layer-order tests pass.
- Scoped five-file coverage is 86/86 statements, 39/39 functions, 56/56 lines and 31/32 branches.
  The command exits 1 because 96.87% branches misses the unchanged 98% floor. The unvisited
  branch is the defensive missing SVG `d` attribute fallback. No coverage pass or exemption
  is claimed, and no artificial malformed host icon was injected merely to hit that guard.
- Build/types passed (1,046 modules, 2.16 seconds), as did whole Oxlint, scoped ESLint and
  Fallow dead-code/duplication checks. Analyzer exclusions and thresholds are unchanged.
- The original `editor-planning-check.mjs --design` passed all four scenarios on the final
  renderer: light/dark 1440px, custom accent 1000px and German 460px, each 900px high.
  Node 24.20.0 and explicit Edge 152.0.4191.62 were used. Browser page-error arrays are empty.

## Real rasterizer compatibility

The initial scene run passed its assertions but raised eight unhandled rendering errors, so
it was not accepted. Konva's SVG Path renderer calls Canvas `arc` with numeric `0/1` direction
flags. The real browser renders those host paths successfully, while the test-only native
Rust canvas binding rejects the numeric flag. The existing canvas proxy now performs the
browser's boolean conversion for that one argument and otherwise retains native rasterization.

The dedicated `canvasArc.test.ts` first failed both numeric flag cases on the old adapter and
passed the omitted-direction case. All three pass with the correction. They compare complete
pixel buffers against explicit native boolean calls and check opposite half-circle pixels;
the test is not an inert drawing stub or an ignored exception. Production arcs and host SVG
geometry are unchanged. The RED and final native/build logs are included with the evidence.

## Visual boundaries

The four fresh Photos images were inspected for the symbol and caption correction. The exposed
light, dark and custom canvases show the symbol and number clear of the Room caption. The German
image shows the constrained Inspector; its open drawer covers the canvas. These are bounded pin
proofs, not a complete M14 comparison with the reference's multiple photos and metadata.

The final light image again caught a blank asynchronous thumbnail despite the existing
complete/natural-width readiness check. The other three show decoded thumbnails. This capture
timing issue is recorded rather than hidden by substituting an earlier image; final screenshots
still need decode/paint readiness. Four Photos axe records are included; the German scan has
an incomplete contrast check and is not a complete accessibility certification.

Date metadata and retained pin/list projection are owned by finalization, and the linked-summary
focus correction is owned by hardening. The shared final nine-journey run and eighteen reference
comparisons remain open until those changes and this checkpoint are integrated.
