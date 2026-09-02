---
type: Task
parent: "[[Upload an image to be used as background]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Import and prepare an image or PDF reference

## Evidence

M06 starts with image/PDF source loading, supported PDF page selection, crop and rotation before
calibration.

## Why it matters

Users arrive with scans, photographs and multi-page PDFs that cannot be traced accurately as-is.

## Approach

Create one source picker and preparation pipeline using vault links and existing rasterization.
Expose supported PDF pages, crop and rotation as draft transforms; manage decoding errors and
resource cleanup. Add image/PDF fixtures, keyboard controls and theme-safe previews.

## Acceptance criteria

- Supported image and PDF sources open the same preparation flow.
- Page selection appears only when the PDF capability supports it.
- Crop/rotation remain drafts until confirmation.
- Unreadable files and cancel release resources and write nothing.

## Risks

Production and test PDF engines may differ; retain a live-vault fixture check.

## Outcome

Homeowners can turn the source they already have into a reviewable prepared reference.
