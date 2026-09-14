import type { AssetShape } from './AssetShape';

/**
 * Do coordinates captured on this surface RIGHT NOW await a scale, or are they already true
 * millimetres? The one answer, asked once per write by `updateAssetShape` and by a draw tool
 * building a detail in presentation before any command runs.
 *
 * **It used to be `!calibrated`, and that was wrong in a way the shipped UI could reach.**
 * Create an asset with a Width and a Depth typed: the designer opens on a drawn 1200 x 800
 * rectangle, in true millimetres, with no background and no calibration. Click *Set anchor*
 * and click a point on it — the coordinates are millimetres, and `!calibrated` recorded them
 * as pending. Pick a background, calibrate, and `rescaled()` faithfully multiplied that
 * anchor by `scaleCorrection` while correctly leaving the typed footprint alone. The anchor
 * lands outside the object, permanently, with `anchorPending` now false so nothing marks it.
 * The same shape for a clearance traced around a typed footprint. Found by a whole-branch
 * review, and reachable entirely through the shipped surface.
 *
 * The three arms, in the order they are asked and for the reason each is asked:
 *
 * - **Calibrated: no.** A scale exists and every coordinate on this surface is in it. This
 *   arm is the whole of what the old rule got right.
 * - **An UNCALIBRATED BACKGROUND: yes.** A spec sheet with no scale is drawn at the
 *   placeholder one source pixel per millimetre, and it is the reason the user is pointing
 *   where they are pointing. This is the arm that keeps `calibrateAsset.test.ts`'s "converts
 *   a pending clearance and leaves a typed footprint alone" a state the UI can still produce:
 *   a clearance traced on a sheet beside a typed footprint really is in the sheet's space.
 * - **No background: yes only while the OBJECT is not already in millimetres.** With no sheet
 *   there is nothing else on the canvas to point at, so a capture is in whatever frame the
 *   object's own footprint establishes. A typed footprint (never pending) establishes
 *   millimetres; a traced-and-still-pending one establishes the placeholder frame it was
 *   drawn in; no footprint at all establishes nothing, and a first outline drawn freehand
 *   still has to be convertible by the calibration that follows it.
 *
 * **What it deliberately does NOT resolve, because nothing can:** an uncalibrated background
 * BESIDE a typed footprint overlays two frames, and a single click cannot say which one the
 * user meant. The second arm resolves that towards the sheet, which is the dominant intent —
 * a user who has just picked a spec sheet is tracing it — and it is an approximation rather
 * than a fact.
 *
 * **In the domain since the symbols spec's Amendment 1.** It was module-private in
 * `updateAssetShape.ts`, its only caller then; a detail drawn over an uncalibrated background is
 * pending "by the rule tracing already follows", and a draw tool builds that detail before any
 * command runs, so the rule moved here and both callers ask it. It takes three plain facts rather
 * than the sidecar document, because presentation holds a design DTO and not a document. Every
 * case about what a user PLACES still drives a real command (`setAssetAttributes.test.ts`);
 * `captureAwaitsScale.test.ts` holds the arms themselves.
 */
export function captureAwaitsScale(calibrated: boolean, hasBackground: boolean, shape: AssetShape | null): boolean {
	if (calibrated) return false;
	if (hasBackground) return true;
	return shape === null || shape.footprintPending;
}
