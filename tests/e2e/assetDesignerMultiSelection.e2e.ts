import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createComposer } from './compose';
import { createCanvasPage, type Box } from './designerCanvas';
import { mobileEmulation } from './session';

/**
 * AD18 UI critique, Task 2, in the real Obsidian host: two parts selected through the Parts panel's
 * `Select multiple parts` toggle, and Konva's stage read for what the canvas DRAWS. Before this task the
 * panel said two parts were selected while the canvas restroked only the last one pressed.
 *
 * Every figure is measured against the graphics' OWN drawn boxes on the same stage, never a pixel
 * constant, so the case reads the same at Linux CI's DPR 1 and a Windows desktop's DPR 2. The slack is
 * the strokes: a selected restroke is 2 px wide over a 1 px graphic, and Konva's client rect includes it.
 *
 * The designer draws nothing on mobile (`AssetDesignerView.sync`), so the whole file is desktop.
 */
const desktop = mobileEmulation ? test.skip : test;

const STROKE_SLACK_PX = 3;
const near = (one: Box, other: Box): boolean =>
	[one.left - other.left, one.top - other.top, one.left + one.width - (other.left + other.width), one.top + one.height - (other.top + other.height)].every((gap) => Math.abs(gap) <= STROKE_SLACK_PX);
const union = (one: Box, other: Box): Box => {
	const left = Math.min(one.left, other.left), top = Math.min(one.top, other.top);
	return { left, top, width: Math.max(one.left + one.width, other.left + other.width) - left, height: Math.max(one.top + one.height, other.top + other.height) - top };
};
const inside = (point: { x: number; y: number }, box: Box): boolean =>
	point.x >= box.left - STROKE_SLACK_PX && point.x <= box.left + box.width + STROKE_SLACK_PX && point.y >= box.top - STROKE_SLACK_PX && point.y <= box.top + box.height + STROKE_SLACK_PX;

describe('A multi-selection draws every member, in the real Obsidian host', () => {
	desktop('restrokes both parts, keeps the handles on the last one, and frames the pair', async ({ native: { browser, page, ui } }) => {
		const c = createComposer(browser, page, ui);
		const canvas = createCanvasPage(browser, c);
		const { ids } = await c.createAssetA('Two selected');
		const [first, second] = ids as [string, string];
		await c.row(first).click();
		await c.designer().$('input[data-rp-action="multiple-selection"]').click();
		await c.row(second).click();
		await expect.poll(c.pressedRows).toEqual([`detail:${second}`, `detail:${first}`]);

		// The graphics in draw order, which is `ids`' order: asset A draws them one by one.
		const [one, two] = (await canvas.shapeBoxes('asset-detail')) as [Box, Box];

		await expect.poll(async () => (await canvas.shapeBoxes('asset-selection-outline')).length).toBe(2);
		const outlines = await canvas.shapeBoxes('asset-selection-outline');
		expect(outlines.some((rect) => near(rect, one)), 'the first part is restroked').toBe(true);
		expect(outlines.some((rect) => near(rect, two)), 'the second part is restroked').toBe(true);

		const bounds = await canvas.shapeBoxes('asset-selection-bounds');
		expect(bounds).toHaveLength(1);
		expect(near(bounds[0] as Box, union(one, two)), 'the frame spans both parts').toBe(true);

		// The handles are the primary's alone: every one on the second rectangle's box, none on the first's.
		const handles = (await canvas.shapeBoxes('asset-selection-handle')).map((box) => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 }));
		expect(handles.length).toBeGreaterThan(3);
		expect(handles.every((centre) => inside(centre, two))).toBe(true);
		expect(handles.some((centre) => inside(centre, one))).toBe(false);

		// Taken back to one member: its restroke alone, and no frame.
		await c.row(first).click();
		await expect.poll(c.pressedRows).toEqual([`detail:${second}`]);
		await expect.poll(async () => (await canvas.shapeBoxes('asset-selection-outline')).length).toBe(1);
		expect(await canvas.shapeBoxes('asset-selection-bounds')).toEqual([]);
	});
});
