import type { CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { createCurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { enclosesArea } from '../../core/geometry/operations';
import type { ValidationError } from '../../core/errors/AppError';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import { assetError } from './Asset.errors';

export type DetailLine = 'solid' | 'dashed';

/**
 * Interior linework of an asset's plan symbol (asset designer symbols spec, Decision 1): a closed
 * curved outline. Details draw in ARRAY ORDER; a `solid` one is filled with the canvas colour and
 * covers what is beneath it, a `dashed` one is not filled (Decision 4 — dashed means overhead or
 * hidden). `name` is a stable key such as `seat` or `bowl`, not display text.
 *
 * `pending` is this detail's own awaiting-a-scale flag (Decision 5): set when it was captured over
 * an uncalibrated background, cleared by the calibration that converts it.
 */
export interface AssetDetail {
	readonly id: string;
	readonly name: string;
	readonly outline: CurvedPolygon;
	readonly line: DetailLine;
	readonly pending: boolean;
}

/**
 * Every detail a valid curved polygon enclosing an area, every id present and unique. Answers
 * COPIES, for the reason `validateAssetShape` gives: a mutation after validation must not reach
 * what was validated.
 */
export function validateDetails(details: readonly AssetDetail[]): Result<AssetDetail[], ValidationError> {
	const seen = new Set<string>();
	const validated: AssetDetail[] = [];
	for (const detail of details) {
		if (detail.id === '' || seen.has(detail.id)) {
			return err(assetError('invalid-detail-id', `Every detail needs its own non-empty id; got "${detail.id}".`));
		}
		seen.add(detail.id);
		const outline = createCurvedPolygon(detail.outline);
		if (isErr(outline)) return err(assetError('invalid-detail', outline.error.message));
		if (!enclosesArea(outline.value)) {
			return err(assetError('degenerate-detail', 'A detail must enclose an area.'));
		}
		validated.push({ id: detail.id, name: detail.name, outline: outline.value, line: detail.line, pending: detail.pending });
	}
	return ok(validated);
}
