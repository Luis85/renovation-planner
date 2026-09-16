import type { CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { createCurvedPolygon } from '../../core/geometry/CurvedPolygon';
import type { CurvedPath } from '../../core/geometry/CurvedPath';
import { createCurvedPath, pathPolyline } from '../../core/geometry/CurvedPath';
import { polygonPolyline } from '../../core/geometry/curvePolyline';
import type { Point } from '../../core/geometry/Point';
import { enclosesArea } from '../../core/geometry/operations';
import type { ValidationError } from '../../core/errors/AppError';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import { assetError } from './Asset.errors';

export type DetailLine = 'solid' | 'dashed';

/**
 * What every graphic carries whatever its geometry is.
 *
 * `name` is a STABLE SEMANTIC KEY such as `seat` or `bowl` — what a preset, a test and a later
 * renderer address a part by — and `label` is the renovator's own words for it (AD04 §3, C02).
 * They are two fields on purpose: repurposing `name` as display text would rename the key every
 * consumer resolves by, which is why the label is optional and additive and never written over it.
 *
 * `line` keeps its meaning for both kinds, with one rule an open graphic adds: a `solid` OPEN
 * path is a stroke and is never filled (C10). Solid and dashed are its dash pattern alone.
 *
 * `pending` is this graphic's own awaiting-a-scale flag (symbols spec, Decision 5): set when it
 * was captured over an uncalibrated background, cleared by the calibration that converts it.
 */
export interface DetailBase {
	readonly id: string;
	readonly name: string;
	readonly label?: string;
	readonly line: DetailLine;
	readonly pending: boolean;
}

/**
 * Interior linework that encloses an area — the only kind that existed before AD04, which is why
 * its discriminant is OPTIONAL where the open arm's is required.
 *
 * That asymmetry buys the whole migration: every literal written before AD04 stays a valid closed
 * graphic, in about twenty-five test files and three constructors, while the union still refuses
 * an unnarrowed `detail.outline` read — the check that actually matters, since a wrong READ draws
 * a wrong picture and a missing `kind` cannot. `validateDetails` writes `kind: 'closed'` onto
 * every graphic it returns, so a shape that has been through the validator always carries it and
 * persistence never has to guess.
 *
 * What it costs: a construction site could omit `kind` and mean open. Nothing can construct an
 * open graphic until AD11, and the day something can, the omission is a missing REQUIRED field on
 * the other arm rather than a silent default.
 */
export interface ClosedDetail extends DetailBase {
	readonly kind?: 'closed';
	readonly outline: CurvedPolygon;
}

/**
 * An open polyline: a line, a hinge swing, a fold. It has no interior and is never filled.
 *
 * Its geometry is `outline` too, and the safety is in the TYPE rather than in the name: a
 * `CurvedPath` is branded, so `detail.outline.points` reads on either arm with no narrowing while
 * handing that same value to anything expecting a `CurvedPolygon` fails to compile. Naming the
 * two properties differently was the alternative; it bought the identical guarantee and would
 * have rewritten about seventy reads across twenty test files to say what the compiler already
 * refuses.
 */
export interface OpenDetail extends DetailBase {
	readonly kind: 'open';
	readonly outline: CurvedPath;
}

/**
 * Interior linework of an asset's plan symbol (symbols spec, Decision 1; AD04 §3), drawn in ARRAY
 * ORDER — a `solid` closed one is filled with the canvas colour and covers what is beneath it, a
 * `dashed` one is not (Decision 4 — dashed means overhead or hidden).
 *
 * **A discriminated union, and the geometry property is named differently on each arm on
 * purpose.** A consumer that reads `detail.outline` without narrowing stops compiling, which is
 * AD04's criterion 7 — *new unsupported kinds fail explicitly rather than silently disappearing*.
 * One shared property name would have let a renderer hand an open path to a polygon routine and
 * draw a wrong picture, which is the failure this repository refuses everywhere else.
 */
export type AssetDetail = ClosedDetail | OpenDetail;

/**
 * The same graphic with its geometry put through a point-wise transform, KEEPING ITS KIND.
 *
 * The two arms are written out because TypeScript cannot correlate a spread with a union: given
 * `detail.outline` typed `CurvedPolygon | CurvedPath`, `{ ...detail, outline: moved }` is assignable
 * to neither arm, since nothing tells the compiler that an open detail got the branded value back.
 * Narrowing once here is what lets every caller — scale, move, calibrate, duplicate — go on being
 * one expression instead of four copies of this branch.
 *
 * The callback is generic so each arm hands its own type through: `translate`, `rotate` and `scale`
 * are all `<T extends Shape>(shape: T, …) => T`, so a path comes back a path, brand intact.
 */
export function mapDetailOutline(detail: AssetDetail, map: <T extends CurvedPolygon | CurvedPath>(outline: T) => T): AssetDetail {
	return detail.kind === 'open' ? { ...detail, outline: map(detail.outline) } : { ...detail, outline: map(detail.outline) };
}

/**
 * The drawable approximation of a graphic, arcs flattened: a closed RING for a closed one, an open
 * RUN for a path. The difference is not cosmetic — `polygonPolyline` drops each segment's last
 * point because the next segment starts there and the ring closes, so using it on a path loses the
 * path's final vertex.
 *
 * Every surface that draws a symbol goes through this rather than reaching for one of the two
 * polyline functions directly, which is what makes "the canvas, the preview and the plan agree
 * about what this graphic is" a property of one function instead of three habits.
 */
export function detailPolyline(detail: AssetDetail, tolerance = 1): readonly Point[] {
	return detail.kind === 'open' ? pathPolyline(detail.outline, tolerance) : polygonPolyline(detail.outline, tolerance);
}

/**
 * Whether this graphic's geometry closes — asked before filling anything, before testing a point
 * for being INSIDE it, and before emitting an SVG `Z`. An open graphic is a stroke whatever its
 * `line` says (C10), so `solid` on one is a dash pattern and never a fill.
 */
export const detailIsClosed = (detail: AssetDetail): detail is ClosedDetail => detail.kind !== 'open';

/**
 * Every graphic valid for its own kind, every id present and unique. Answers COPIES, for the
 * reason `validateAssetShape` gives: a mutation after validation must not reach what was
 * validated.
 *
 * The two kinds are asked DIFFERENT questions and that is C02's rule rather than a convenience:
 * a closed graphic must enclose an area, and an open one is judged on point count, finite
 * coordinates and length. Asking a path to enclose an area would refuse every line ever drawn;
 * asking a ring for mere length would admit a degenerate one.
 */
function validateDetail(detail: AssetDetail): Result<AssetDetail, ValidationError> {
	const base = { id: detail.id, name: detail.name, ...(detail.label === undefined ? {} : { label: detail.label }), line: detail.line, pending: detail.pending };
	if (detail.kind === 'open') {
		const path = createCurvedPath(detail.outline);
		return isErr(path) ? err(assetError('invalid-detail', path.error.message)) : ok({ ...base, kind: 'open', outline: path.value });
	}
	const outline = createCurvedPolygon(detail.outline);
	if (isErr(outline)) return err(assetError('invalid-detail', outline.error.message));
	return enclosesArea(outline.value)
		? ok({ ...base, kind: 'closed', outline: outline.value })
		: err(assetError('degenerate-detail', 'A detail must enclose an area.'));
}

export function validateDetails(details: readonly AssetDetail[]): Result<AssetDetail[], ValidationError> {
	const seen = new Set<string>();
	const validated: AssetDetail[] = [];
	for (const detail of details) {
		if (detail.id === '' || seen.has(detail.id)) {
			return err(assetError('invalid-detail-id', `Every detail needs its own non-empty id; got "${detail.id}".`));
		}
		seen.add(detail.id);
		const checked = validateDetail(detail);
		if (isErr(checked)) return checked;
		validated.push(checked.value);
	}
	return ok(validated);
}
