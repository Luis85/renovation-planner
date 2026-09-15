# Independent face controls — research and decision

## Evidence reused from the foundation

The dated screenshots, hashes and live observations in [astra-wall-tool/research.md](../astra-wall-tool/research.md) remain the source record. The user supplied reference images and explicitly requested task-specific overlays and compact context editing, while retaining the removal of generic Add detail.

The earlier anonymous browser inspection of [RemPlanner](https://remplanner.com/de/) showed context fields and four side-positioned controls. Its [planner support](https://remplanner.com/de/planner/support/) and [FAQ](https://remplanner.com/de/planner/support/faq/) informed discoverability, drawing feedback and dimension-entry comparisons. Those observations do not establish RemPlanner's internal persistence or an exact independent-face model. No reference assets or code were copied.

## User-directed second concern

The independent A/B data contract is the user's explicit decision for this second PR. The foundation PR's total-width adjustment remains independently reviewable; this stacked change extends it with two real face offsets. The design uses the editor's existing surface, border, typography, accent, native icons, Details panel and command/history infrastructure.

The compact context route supports exact entry; the task overlay supports repeated adjustments directly beside the two faces. Labels A/B, focus/hover cues, a direction arrow and tethers make the mapping visible even when the controls must be clamped. Both routes retain preview/apply/cancel. There is no extra generic entry layer.

## Deliberate bounds

- A/B name faces of a directed wall, not global north/south or room-inside/outside. Reversing direction swaps their physical meaning unless values are swapped too.
- New and legacy walls begin with equal extents. Persistence writes schema 13 when any actual or intended wall has unequal extents. Older readers refuse the file. Equal extents remain safely derivable by older schemas.
- Total-width bulk editing adds the same half-delta to each face. It preserves their difference and refuses a negative resulting depth.
- Actual asymmetric wall bodies use polygons, outer corner wedges and straight T-host clipping. Unsupported curved clipping and inside-radius collapse are explicit refusals. Symmetric networks retain their existing paint path.
- Per-face controls preserve the camera and fixed reference line. On panes too small for two separated groups, the compact scrollable arrangement keeps all inputs and controls reachable.

The visual acceptance pass is limited to two batched rounds for this newly authorized concern. Final evidence and verification are recorded separately; this research note does not claim those pending checks have passed.
