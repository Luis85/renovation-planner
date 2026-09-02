import { normalizePath, TFile, type Vault } from 'obsidian';
import type { Point } from '../../../../core/geometry/Point';
import { renderPdfPage } from './pdfRaster';

/**
 * What this pipeline needs of a background REFERENCE, and nothing about whose background it
 * is — the same slice-of-the-real-thing argument `BackgroundVault` below already makes about
 * Obsidian's `Vault`, applied to the two entities that own one.
 *
 * Structural rather than an import of either, because `PlanBackgroundRef` and
 * `AssetBackgroundRef` are deliberately separate types (each says so in its own docblock: a
 * plan and an asset happen to share a background vocabulary today and must not be coupled
 * through an import the day they diverge). This type is what they have in common AS SEEN FROM
 * HERE, so a divergence in either shows up as an assignability failure at the mount rather
 * than as a silent widening.
 *
 * `page` admits `undefined` AND `null` because the two spell the same absence in the two
 * refs — `PlanBackgroundRef.page?: number`, `AssetBackgroundRef.page: number | null` — and
 * `loadPdf`'s `?? 1` already reads both.
 */
export interface BackgroundDocumentRef {
	readonly path: string;
	readonly kind: 'image' | 'pdf';
	readonly page?: number | null;
}

/**
 * A background document — a Plan's, or since the asset designer an Asset's — decoded and
 * ready for `<v-image>` (SDD §18, §54–55).
 *
 * Both source formats converge on one Konva primitive: `<v-image>` needs an already
 * decoded raster (`HTMLImageElement | HTMLCanvasElement`), never a URL, so the LOADING
 * step is format-specific and the render step is not.
 *
 * The original PNG/JPEG/PDF stays exactly where the user put it in the Vault and only its
 * Vault-relative path is ever referenced (§55). No base64 appears anywhere in this
 * pipeline — not in a store, not in a render model, not in persisted Plan data: this type
 * holds a live raster HANDLE for the life of the view, which is a different thing from a
 * data URI and is why there is nothing here a `JSON.stringify` could smuggle into a note.
 *
 * The `unavailable` arm is a deviation from design slice 5's sketch, which had `none |
 * raster` only, and it is the better shape for the same reason the query services keep
 * `ok(null)` apart from `isErr`: a subject whose background file was deleted or is corrupt
 * has to draw something honest, and a component consuming ONE union renders all three
 * states without a second error channel beside it.
 */
export type BackgroundRenderModel =
	| { readonly kind: 'none' }
	| {
			readonly kind: 'raster';
			readonly image: HTMLImageElement | HTMLCanvasElement;
			readonly worldOrigin: Point;
			/** World millimetres per source pixel; a placeholder until slice 7 calibrates. */
			readonly worldScale: number;
			/** Source pixels — what `<v-image>`'s own width/height are set from. */
			readonly width: number;
			readonly height: number;
	  }
	| { readonly kind: 'unavailable'; readonly reason: 'missing' | 'unreadable' };

/**
 * Exactly the three Vault members this module calls, spelled as a slice of Obsidian's own
 * `Vault` rather than as a hand-written look-alike — so the contract cannot drift from the
 * API and a real `Vault` is passed straight in.
 */
export type BackgroundVault = Pick<Vault, 'getAbstractFileByPath' | 'getResourcePath' | 'readBinary'>;

/**
 * The placeholder scale a raster is decoded at: one source pixel is one world millimetre.
 *
 * A raster has no physical size of its own, so nothing pretends otherwise until a calibration
 * says so — and the calibration does NOT become a parameter of `worldToScreen`, because §24
 * fixes that transform's components as translation, zoom, rotation and device pixel ratio.
 * What a calibration changes is the size the raster is DRAWN at: `drawnWorldScale` below,
 * which the layer asks with the subject's own `pixelsPerWorldUnit`.
 *
 * **This value was drawn unmodified for eight slices after slice 7 landed.** Slice 7's own
 * design gave `pixelsPerWorldUnit` two jobs and named this one first — "how many world
 * millimetres one source pixel of this Plan's background covers … after, it is this value's
 * reciprocal" — and nothing in `presentation/` ever read it. The plan's zones were multiplied
 * by `scaleCorrection` and the image was not, so a zone drawn after calibrating had its area
 * wrong by the scale squared. The asset designer inherited it, and there it broke the
 * increment's central workflow: a footprint traced on an uncalibrated sheet was rescaled off
 * the sheet, and a clearance traced afterwards was recorded as millimetres while being sheet
 * pixels, because `captureAwaitsScale` correctly reads a calibrated surface as millimetres.
 * Found by an adversarial review reading the model against slice 7's document.
 */
export const PLACEHOLDER_WORLD_SCALE = 1;

/**
 * World millimetres per source pixel as DRAWN: the raster's own decoded scale, corrected by
 * the subject's calibration. `pixelsPerWorldUnit` is `1` for an uncalibrated subject, which
 * is why the uncalibrated case is the identity and why callers pass `?? 1` rather than a
 * nullable.
 *
 * Division rather than a second stored field, because `deriveCalibration` already defines
 * `pixelsPerWorldUnit` as the placeholder divided by every `scaleCorrection` so far, and a
 * calibration multiplies every world coordinate by that same correction — so this is the one
 * expression that keeps a traced outline over the pixels it was traced on.
 */
export function drawnWorldScale(rasterWorldScale: number, pixelsPerWorldUnit: number): number {
	return rasterWorldScale / pixelsPerWorldUnit;
}

/** Where a background's top-left corner sits until calibration says otherwise. */
const WORLD_ORIGIN: Point = { x: 0, y: 0 };

const UNAVAILABLE_MISSING = { kind: 'unavailable', reason: 'missing' } as const;
const UNAVAILABLE_UNREADABLE = { kind: 'unavailable', reason: 'unreadable' } as const;

export const NO_BACKGROUND = { kind: 'none' } as const;

/**
 * The model flattened to one word, for the shell to show a message by.
 *
 * A flattened STATUS rather than the model itself, because what leaves this layer is a
 * fact about the background and not a handle to it: a raster is a live DOM node, and a
 * component that passed one upward would let the shell hold a decoded plan scan alive
 * after the canvas was done with it.
 */
export type BackgroundStatus = 'none' | 'raster' | 'missing' | 'unreadable';

export function backgroundStatus(model: BackgroundRenderModel): BackgroundStatus {
	return model.kind === 'unavailable' ? model.reason : model.kind;
}

/**
 * `getResourcePath`, not `readBinary`: Obsidian hands out an `app://` URL the browser can
 * decode natively, which keeps the bytes out of JavaScript entirely — the difference
 * between a large plan scan costing a URL and costing a copy of itself in the heap.
 */
async function loadImage(file: TFile, vault: BackgroundVault): Promise<BackgroundRenderModel> {
	const image = new Image();
	image.src = vault.getResourcePath(file);
	await image.decode();
	return {
		kind: 'raster',
		image,
		worldOrigin: WORLD_ORIGIN,
		worldScale: PLACEHOLDER_WORLD_SCALE,
		width: image.naturalWidth,
		height: image.naturalHeight,
	};
}

async function loadPdf(
	ref: BackgroundDocumentRef,
	file: TFile,
	vault: BackgroundVault,
): Promise<BackgroundRenderModel> {
	const bytes = await vault.readBinary(file);
	// Page 1 when the reference does not say: a single-page plan is the common case and a
	// reference written before pages mattered still has to open.
	const rendered = await renderPdfPage(bytes, ref.page ?? 1);
	return {
		kind: 'raster',
		image: rendered.canvas,
		worldOrigin: WORLD_ORIGIN,
		worldScale: rendered.worldScale,
		width: rendered.width,
		height: rendered.height,
	};
}

export async function loadBackground(
	ref: BackgroundDocumentRef | null,
	vault: BackgroundVault,
): Promise<BackgroundRenderModel> {
	if (ref === null) {
		return NO_BACKGROUND;
	}
	// `instanceof TFile` rather than a null check, for the reason `createVaultFileProbe`
	// states: `getAbstractFileByPath` answers folders too.
	const file = vault.getAbstractFileByPath(normalizePath(ref.path));
	if (!(file instanceof TFile)) {
		return UNAVAILABLE_MISSING;
	}

	try {
		return ref.kind === 'pdf' ? await loadPdf(ref, file, vault) : await loadImage(file, vault);
	} catch {
		// A corrupt PNG, a PDF whose page does not exist, a read that failed — all of them
		// are "this file cannot be a background right now", and none of them is a reason for
		// a view to throw during a render. The cause is deliberately not carried into the
		// model: it is a pdf.js or DOM error object, and slice 17 owns turning a failure
		// into something a user reads.
		return UNAVAILABLE_UNREADABLE;
	}
}
