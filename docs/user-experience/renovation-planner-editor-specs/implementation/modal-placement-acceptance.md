# Supplemental modal and opening-placement acceptance

Prepared from integrated source `996ef1a591fbb5e8abfd40bb0704b0029af7298a`.
Run `node scripts/editor-modal-placement-check.mjs` from the checked-out source to
write a separate `harness-shots/editor-modal-placement` report and capture manifest.
The original nine final journeys and eighteen comparisons remain unchanged.

The existing light, dark, custom-accent and German 460 px matrix drives three bounded
flows using native keyboard/pointer input and read-only DOM/Konva probes:

- Reference setup measures the actual painted image and visible canvas size, compares
  its area with the legacy 400×220 fit, picks A/B on the image, and verifies Zoom, drag
  Pan and Fit change/restore paint while the original source-coordinate fields remain
  unchanged. Navigation and Escape must leave stored bytes unchanged.
- Photo Add starts with image search/import and optional caption, with metadata inside
  a closed Details disclosure. An opt-in fixture supplies 256 Markdown files before
  64 PNG aliases. The real image search must render only 20 initial suggestions and
  narrow to one matching image; a blank caption must save using its filename. The
  linked image must decode, and the actual changed note must contain its path.
- Opening Move first previews/cancels through the Inspector, then commits through the
  object-aware context menu. A known 4 m chord/0.5 m sagitta supplies an independent
  along-arc distance expectation. The renderer must preview the cut, the wall and swing
  must remain unchanged, and Undo/Redo must restore the exact opening state.

Fixture changes require `modal-placement-fixtures`; existing harness entries receive no
new files. The extended curve probe only reads a node's transform and stage origin.
No production code, private Vue state, editor-store mutation or action facade is used
to operate the UI. Saved data uses production commands/repositories over FakeVault;
image aliases are synthetic, and this is not a real-vault performance benchmark.

Preparation validation: Node syntax checks passed for all three new `.mjs` modules.
No browser journey or capture has been run yet. Reported measurements, screenshots,
page-error checks and source/hash provenance will be produced only by a successful run.
