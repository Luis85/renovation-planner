---
type: PBI
parent: "[[Spatial creation]]"
order: 100
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Scale calibration]]"
---

# Upload an image to be used as background

## Actor

[[Private renovator]] who has an image or PDF source drawing to trace.

## Preconditions

- A Floor (`Plan`) is open and can accept a Reference plan.
- The source is a supported image or PDF available to the vault.

## Main flow

1. The renovator chooses Upload a floor plan from Floor setup or reference controls.
2. The renovator selects an image or PDF; for supported PDFs, the renovator chooses a page.
3. The plugin previews the source and offers supported crop and rotation preparation.
4. The renovator marks two points whose real distance is known and enters that distance.
5. The plugin shows the derived scale and prepared reference for review.
6. The renovator confirms, and the plugin commits the source and configuration as one reference setup.
7. The completed reference becomes visible and locked for tracing.

## Extensions

- **2a** — The file type, selected page or bytes are unsupported/unreadable. Nothing changes and another file can be chosen.
- **3a** — The renovator cancels preparation. Object URLs and drafts are released; the prior reference remains.
- **4a** — No known distance is available. The source may be retained only without an accuracy claim.
- **4b** — Calibration is invalid. Setup remains a draft and explains the problem.
- **6a** — Commit fails. Partial configuration is recovered and the previous reference remains.
- **7a** — The renovator later replaces the source by repeating this flow without losing the old reference until confirmation.

## Guarantee

Confirmation produces one reloadable prepared reference, or the Floor keeps its previous reference
state exactly; source preparation never creates Room or Wall geometry.

## Out of scope

- Reference-layer visibility, opacity, lock and removal after setup, owned by
  [[Plans and background import]].
- Calibration rules and arithmetic, owned by [[Scale calibration]].
- Automatic vectorization, OCR, multi-page simultaneous display and CAD import.

## Acceptance criteria

1. Supported images and PDFs enter one setup flow; PDF page selection appears where supported.
2. Crop/rotation/page choices are previewed before persistence and survive reload after confirmation.
3. Calibration delegates to [[Scale calibration]] and does not duplicate its rules.
4. Cancel, invalid input and unreadable source leave the prior reference unchanged.
5. Replace keeps the prior source until the new setup commits successfully.
6. Setup is keyboard operable after source selection, including page, preparation, distance and confirmation.
7. Completed setup creates no editable Room or Wall automatically.

## Assumptions

- The historical basename remains even though the use case includes PDF sources.
- This PBI is a sibling of [[Plans and background import]]; their shared Feature supplies the grouping.

## Sources

- PRD §13 and §42 (image/PDF background sources).
- [[Renovation Planner — Editor UX Research & Pattern Study]], blueprint workflow.
- [[Renovation Planner — Editor Interaction & Mental Model Specification]], section 26.
- [[M06-reference-plan-setup]], prepare, scale and review workflow.
