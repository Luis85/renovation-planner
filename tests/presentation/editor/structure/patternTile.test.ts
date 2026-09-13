// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { backingCanvas, installCanvas } from '../../../helpers/canvas';
import { installObsidianDom } from '../../../helpers/dom';
import { PLAN_PATTERNS } from '../../../../src/domain/asset/PlanPattern';
import { patternTile, TILE_PX } from '../../../../src/presentation/editor/structure/patternTile';

beforeAll(() => { installCanvas(); installObsidianDom(); });
const pixels = (canvas: HTMLCanvasElement) => [...(backingCanvas(canvas)?.getContext('2d').getImageData(0, 0, TILE_PX, TILE_PX).data ?? [])];

it('draws every pattern in the ink over the ground it is given, each one different', () => {
	const tiles = PLAN_PATTERNS.map(pattern => pixels(patternTile(pattern, 'rgb(10, 20, 30)', 'rgb(200, 200, 200)') as HTMLCanvasElement));
	for (const data of tiles) {
		expect(data.some((value, index) => index % 4 === 0 && value < 100)).toBe(true);
		expect(data.some((value, index) => index % 4 === 0 && value > 150)).toBe(true);
	}
	expect(new Set(tiles.map(data => data.join(','))).size).toBe(PLAN_PATTERNS.length);
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('draws no tile where the host has no createEl or no 2D context', () => {
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
	expect(patternTile('brick', 'rgb(10, 20, 30)', 'rgb(200, 200, 200)')).toBeNull();
	vi.stubGlobal('createEl', undefined);
	expect(patternTile('brick', 'rgb(10, 20, 30)', 'rgb(200, 200, 200)')).toBeNull();
});
