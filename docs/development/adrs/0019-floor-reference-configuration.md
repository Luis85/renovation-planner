---
adr: 19
title: Floor reference configuration and calibration
status: Accepted
date: 2026-09-06
area: application
---

# ADR-0019: Floor reference configuration and calibration

## Context

M05/M06 need a reversible prepare/scale/review journey. Plan metadata already owns the vault
source path, kind and PDF page; the plan geometry sidecar owns the one calibration and all
world geometry. `ReversibleCalibratePlanCommand` rescales the complete document around world
origin. Reference setup must preserve that contract and the existing exact-version history
barrier. ADR-0018 continues to own spatial selection and Inspector routing.

## Decision

- Keep the source file in the vault and unchanged. Offer supported vault files as native input
  suggestions, with an editable vault-relative path, retry and replacement. Support PNG, JPG,
  JPEG and PDF through the existing decoder and Obsidian PDF renderer. No external upload,
  temporary vault file, bundled production PDF worker or duplicate import repository is added.
- Add optional `PlanBackgroundRef.appearance`: source-pixel crop `{x,y,width,height}`, clockwise
  rotation in degrees about the cropped top-left corner, opacity, visible and locked. Page is
  still one-based. Image pixels are native decoded pixels; PDF pixels are the existing 2× PDF
  point raster, with `worldScale = 25.4 / 72 / 2` mm per raster pixel.
- Transform in this order: select PDF page, crop, translate crop origin to zero, rotate, multiply
  by the decoded `worldScale`, then divide by the existing calibration's `pixelsPerWorldUnit`.
  Canvas pan/zoom and the dialog's fit-to-preview transform are presentation only. There is no
  free reference translation or second calibration model.
- A prepared reference reports its transformed world corners to the existing viewport fit.
  Empty floors in Select fit after decoding and stage measurement; active creation keeps its
  camera. The existing Fit all shortcut includes visible prepared references alongside geometry.
  A configured reference replaces the generic no-rooms overlay with the usable drawing canvas.
- Endpoint entry uses source pixels, including the crop offset. Pointer picking applies the
  inverse preview fit and rotation; the numeric fields provide the same route by keyboard.
  Convert known metres using the shared `parseMetres`, then use `deriveCalibration` and the
  extracted `calibrateDocument` helper. Finite, nondegenerate persisted calibration is required.
- Changing scale continues to rescale every geometry object and the stored measurement around
  world origin. Existing geometry requires an explicit review acknowledgement when the factor
  differs from one. Crop/rotation affect the reference; they do not rotate or crop rooms.
- ADR-0020 extends rescaling and consent to all Wall/Opening measurements. The geometry
  snapshot's calibration is the single baseline for preview conversion and command math,
  even when an earlier plan-note read observed a different sidecar revision. Canonicalize
  editable vault paths before loading, comparing source events and dispatching. Plan-owned
  observation tokens include the v2 `reference-appearance` field, protecting external edits
  even when they did not increment the note revision.
- `ReferenceSetupForm` owns one disposable draft in the existing root DialogHost. Preparation,
  Apply scale and opacity/lock changes do not write. Finish dispatches one guarded
  `ConfigurePlanReference` history item, conditional on both captured note and sidecar versions.
  It saves reference metadata, writes the complete calibrated geometry document, then publishes
  existing background/calibration/zone events. A sidecar refusal compensates metadata using
  the version produced by the first write. A refused or thrown compensation is stamped as an
  unrecovered write and reaches the existing save-state warning; it never overwrites a peer.
- Undo and Redo restore both snapshots, with exact whole-document expectations in both
  directions. They deliberately retain calibration's peer/sibling-write barrier rather than
  adopting the per-object gesture ledger. No-op repeat calls do not create writes.
- Store `reference-appearance` in plan frontmatter schema v2. The pure v1→v2 migration adds only
  the schema discriminator in memory. Legacy absent appearance retains the previous complete,
  unrotated, fully opaque rendering. Read-only access does not rewrite a note. Legacy-compatible
  saves without appearance remain v1; Undo removes the owned appearance key. Old readers reject
  v2 instead of silently dropping transforms. Legacy polygon `.rpgeo` remains v1; ADR-0020 later
  adds v2 structure while preserving calibration and polygon entries.
- Seed per-leaf reference visibility from committed configuration on hydration/configuration
  changes. Existing layer toggles remain session state. Default a new prepared reference to
  opacity 0.65, visible and locked. An unlocked preference is persisted, but no direct dragging
  is introduced: review explains that position changes still use setup.

## Boundaries and consequences

The transaction is a compensated application operation, not a filesystem atomic write. There
is no generic durable plan-edit journal in the current repository stack. Abrupt process loss
between metadata and sidecar writes remains an explicit recovery limitation; the sequence-marker
mechanism for irreversible delete/rebuild operations is not silently repurposed. This change
tests ordinary failures, compensation failure and fresh repository reload, and does not claim
crash recovery or live Obsidian/MetadataCache timing acceptance.

The existing contextual layer Set scale gesture remains available. Both it and setup share the
same calibration math and complete-document semantics. Floor/Layer reference actions open setup
without adding background IDs to the spatial selection store. Floor metadata editing remains
with its existing editor. No new renovation domains are introduced.

See [Configure a reference plan](../../tests/cases/Configure%20a%20reference%20plan.md) for evidence
and open acceptance. Phase 6, Increment B and the complete editor roadmap remain open pending
their unperformed host, assistive-technology and release acceptance.
