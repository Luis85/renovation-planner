import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage, type DesignerPage, type ObsidianPage } from './designer';
import type { PlannerPage } from './helpers';
import { createParityPage, type ParityPage } from './designerParity';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Design an Asset.md`, the parity round's Corner radius (steps 98 to 102b): the
 * row a freshly drawn rounded rectangle earns, its slider committing once on release, a typed
 * radius and its undo, the no-op retype, the open upper bound, and the radius surviving a typed
 * asset resize and a canvas handle drag — each read off the Inspector and the sidecar on disk.
 */
const desktop = mobileEmulation ? test.skip : test;

interface Drawn { designer: DesignerPage; parity: ParityPage; assetId: string }

/** A measured asset (typed 1000 × 800, nothing pending) with one rounded rectangle drawn and selected. */
async function roundedRect(browser: NativeBrowser, page: ObsidianPage, ui: PlannerPage, name: string): Promise<Drawn> {
	const designer = createDesignerPage(browser, page, ui);
	const parity = createParityPage(browser, designer);
	const assetId = await designer.createAsset(name);
	await designer.editDimensions(1000, 800);
	await parity.settle(assetId, 1);
	await parity.drawBox('Draw rounded rectangle', [0.35, 0.35], [0.65, 0.6]);
	await parity.settle(assetId, 2);
	await expect.poll(() => designer.inspectorField('corner-radius').isExisting()).toBe(true);
	return { designer, parity, assetId };
}

const value = async (designer: DesignerPage, name: string) => Number(await designer.inspectorField(name).getValue());
const redoDisabled = async (designer: DesignerPage) =>
	(await designer.designer().$('.rp-designer-history [aria-label="Redo"]').getAttribute('disabled')) !== null;

/** Type into an Inspector number field and commit it with Enter. */
async function typeInto(designer: DesignerPage, browser: NativeBrowser, name: string, typed: number): Promise<void> {
	await designer.inspectorField(name).setValue(String(typed));
	await browser.keys('Enter');
}

describe('Design an Asset, the parity round corner radius, in the real Obsidian host', () => {
	// Steps 98, 98a, 99, 100 and 101.
	desktop('draws a Corner radius row with a slider that commits once, types and undoes a radius, and refuses the half', async ({
		native: { browser, page, ui },
	}) => {
		const { designer, parity, assetId } = await roundedRect(browser, page, ui, 'Rounded tray');

		// Step 98: the row, its short label and unit, and a range slider beside the field.
		const row = designer.designer().$('.rp-designer-radius-field');
		expect(await row.getText()).toMatch(/^Corner radius\s*mm$/u);
		const slider = designer.designer().$('input[name="corner-radius-slider"]');
		expect(await slider.getAttribute('type')).toBe('range');
		const original = await value(designer, 'corner-radius');
		expect(Number(await slider.getValue())).toBe(Math.round(original));

		// Step 98a: a real thumb drag, released once — exactly one write and one undo entry.
		const [min, max] = [Number(await slider.getAttribute('min')), Number(await slider.getAttribute('max'))];
		const at = await slider.getLocation();
		const width = await slider.getSize('width');
		const thumbX = at.x + ((Math.round(original) - min) / (max - min)) * width;
		const y = at.y + (await slider.getSize('height')) / 2;
		await parity.dragBetween({ x: thumbX, y }, { x: at.x + width * 0.15, y });
		await parity.settle(assetId, 3);
		await browser.pause(600);
		expect(designer.readSidecar(assetId).revision).toBe(3);
		const dragged = await value(designer, 'corner-radius');
		expect(dragged).not.toBe(original);
		expect(Number.isInteger(dragged)).toBe(true);
		expect(Number(await slider.getValue())).toBe(dragged);
		await designer.undoButton().click();
		await parity.settle(assetId, 4);
		await expect.poll(() => value(designer, 'corner-radius')).toBe(original);

		// Step 99: a typed radius, and one Undo back.
		await typeInto(designer, browser, 'corner-radius', 20);
		await parity.settle(assetId, 5);
		await expect.poll(() => value(designer, 'corner-radius')).toBe(20);
		await designer.undoButton().click();
		await parity.settle(assetId, 6);
		await expect.poll(() => value(designer, 'corner-radius')).toBe(original);

		// Step 100: the same value retyped writes nothing and leaves the redo stack standing.
		expect(await redoDisabled(designer)).toBe(false);
		await typeInto(designer, browser, 'corner-radius', original);
		await browser.pause(800);
		expect(designer.readSidecar(assetId).revision).toBe(6);
		expect(await redoDisabled(designer)).toBe(false);

		// Step 101: exactly half the shorter side is refused with its own sentence.
		const half = Math.min(await value(designer, 'width'), await value(designer, 'depth')) / 2;
		await typeInto(designer, browser, 'corner-radius', half);
		await expect
			.poll(() => designer.designer().$('.rp-designer-inspector').getText())
			.toContain('A corner radius must be more than 0 and less than half the rectangle’s shorter side.');
		await browser.pause(500);
		expect(designer.readSidecar(assetId).revision).toBe(6);
	});

	// Steps 102, 102a and 102b.
	desktop('keeps the Corner radius row through a typed resize, a handle drag and a Shift handle drag', async ({
		native: { browser, page, ui },
	}) => {
		const { designer, parity, assetId } = await roundedRect(browser, page, ui, 'Stretched tray');
		const dimensions = () => designer.designer().$('.rp-designer-inspector-fields dd').getText();

		const fields = async () => ({ radius: await value(designer, 'corner-radius'), width: await value(designer, 'width'), depth: await value(designer, 'depth') });
		const before = await fields();

		// Step 102 AS WORDED, a finding: the asset's own Edit dimensions scales the whole design, so a
		// non-uniform stretch turns each corner into a non-circular arc and the row is GONE — the
		// rebuild the row describes lives on the part's own Size fields (`resizeToExtent`), below.
		await designer.editDimensions(1500, 800);
		await parity.settle(assetId, 3);
		await expect.poll(dimensions).toBe('1500 × 800 mm');
		await designer.selectPart('detail:detail-1');
		await expect.poll(() => designer.inspectorField('width').isExisting()).toBe(true);
		expect(await designer.inspectorField('corner-radius').isExisting()).toBe(false);
		await designer.undoButton().click();
		await parity.settle(assetId, 4);
		await expect.poll(dimensions).toBe('1000 × 800 mm');
		await expect.poll(fields).toEqual(before);

		// Step 102 through the part's typed Width: narrowed to the old radius, so the radius no longer
		// fits and clamps to the largest whole millimetre under half the new shorter side; the row
		// stays; one Undo restores Width, Depth and radius together.
		const narrow = Math.round(before.radius);
		await typeInto(designer, browser, 'width', narrow);
		await parity.settle(assetId, 5);
		await expect.poll(() => value(designer, 'width')).toBe(narrow);
		expect(await value(designer, 'corner-radius')).toBe(Math.ceil(narrow / 2) - 1);
		expect(await value(designer, 'depth')).toBe(before.depth);
		await designer.undoButton().click();
		await parity.settle(assetId, 6);
		await expect.poll(fields).toEqual(before);

		// Step 102a: the right-middle CANVAS handle dragged outward — the row stays, the radius kept.
		const right = await parity.handle('right');
		await parity.dragBetween(right, { x: right.x + 60, y: right.y });
		await parity.settle(assetId, 7);
		expect(await designer.inspectorField('corner-radius').isExisting()).toBe(true);
		expect(await value(designer, 'corner-radius')).toBe(before.radius);
		expect(await value(designer, 'width')).toBeGreaterThan(before.width);
		expect(await value(designer, 'depth')).toBe(before.depth);

		// Step 102b: Shift on the bottom-right corner, dragged to about half size — the radius scales too.
		const widened = await fields();
		const corner = await parity.handle('bottom-right');
		const box = await parity.handle('right');
		const leftX = 2 * box.x - corner.x;
		await parity.dragBetween(corner, { x: (corner.x + leftX) / 2 + (corner.x - leftX) / 4, y: corner.y - (corner.y - box.y) / 2 }, true);
		await parity.settle(assetId, 8);
		// Measured: 1620 × 1500 → 1219 × 1129 with the radius 255 → 192 — one factor, 0.75, on all three.
		const shrunk = await fields();
		const factor = shrunk.width / widened.width;
		expect(factor).toBeLessThan(0.9);
		expect(shrunk.depth / widened.depth).toBeCloseTo(factor, 2);
		expect(shrunk.radius / widened.radius).toBeCloseTo(factor, 2);
	});
});
