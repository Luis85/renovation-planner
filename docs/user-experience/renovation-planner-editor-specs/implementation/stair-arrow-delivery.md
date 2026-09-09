# Stair and Arrow delivery reconstruction

Current status: the PR #114 follow-up is recorded in
[Stair/Arrow completion](stair-arrow-completion.md). Manual acceptance is user-owned and pending.
The reconstruction record below is historical: no checks were executed at that initial
checkpoint, and its source receipts did not certify the reconstructed tree.

Base: Curve delivery `0a049e270de7b0dbdd4ba88e000866fe34f8634d`.
Branch: `codex/editor-deliver-stairs`. PR base: `codex/editor-deliver-groups`.
Cumulative Group UI parent `f39d001ad41284825732aee34a34b91ebd2221e5`, including
Opening movement, was merged as `de561869`. No integration-branch ancestry was imported.
The two conflicts were adjacent changelog entries and Stair/Group type imports; both
were retained. Shared Curve/Group preview composition and both runtime factories
were inspected alongside Stair footprints and metadata after the automatic merges.

| Original | Reconstructed | Included scope |
| --- | --- | --- |
| `d4cc09e8` | `4c627f83` | Stair/Arrow schema 8, canonical geometry and derived footprint, creation/edit forms, painting, endpoint edits, snapping/framing/admission, application icon lifecycle, tests and original receipt. |
| `8cc7ac7c` | `a6cd2ad3` | Touched width/run intent, native form precision, constrained canvas-first creation, styles and regression cases. |
| Stair portion of `8a97bf65` | This follow-up | Stair form guards. The Stair footprint marquee case is included with `4c627f83`; unrelated input cases already belong to the input parent and are retained. |
| Future-schema portion of `f5a28f45` | This follow-up | Derive refusal values from the registered latest schema plus 1 and plus 200, instead of treating now-supported schema 8 as future. |

The single initial conflict was an adjacent marquee test insertion. Resolution retained
all existing input/selection assertions and added the Stair footprint case unchanged.
It proves that intersecting the visible footprint selects the Stair while preserving
its canonical two-point centreline and issuing no geometry command.

Schema order remains Opening 5, Group 6, Curve 7, then Stair/Arrow 8. Group metadata,
root member semantics and curve fields remain intact. Existing grouped metadata tests
use the Group storage service already in the parent; no Group UI test dependency was
introduced or behavior omitted. The application-owned `rp-stairs` icon registers on
plugin load and unregisters on unload; host Lucide icons retain their native route.

Deferred in full: `8b543b7f` browser driver, element probe, fidelity accessor, Fallow
entry and browser receipt. These belong to cumulative final acceptance. No screenshot
or native host acceptance is claimed by this branch.

Static comparison found stairGeometry, StairEditForm, StairFields and stairInput
identical to `8cc7ac7c`, and the added form-guard test identical to `8a97bf65` (including
the subsequent focused source state). Shared runtime/renderer/selection files require
the final cumulative comparison after Group UI and Opening movement integration.
No test timeouts, thresholds, rules, skips or exclusions were changed.
