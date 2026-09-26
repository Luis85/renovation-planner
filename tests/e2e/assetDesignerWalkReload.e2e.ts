import { readFileSync } from 'node:fs';
import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage, DESIGNER, type DesignerPage } from './designer';
import { createParityPage, type ParityPage } from './designerParity';
import type { PlannerPage } from './helpers';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Design an Asset.md` step 24, the four facts beside the shape that a plugin
 * toggle must keep — the calibration, the anchor, the facing and the height — on assets that HAVE
 * each of them set, with BOTH designers open when the plugin goes off. `assetDesigner.e2e.ts`
 * already holds the shape and the console across the same toggle, on an asset with none of these.
 *
 * "Reopen both" is a reopen, not a return: Obsidian detaches a disabled plugin's leaves and
 * restores none on enable (W24-A, pinned in `assetDesigner.e2e.ts` and again here), so the case
 * reopens each through the palette's picker, as a person does, and reads what each one draws.
 *
 * Every read here — the first one, every post-command refresh and a reopen — runs the one
 * hydration routine over the vault's files, so what "survives" can mean is narrow and is asserted
 * as exactly that: the files are byte-for-byte what they were before the toggle, and a designer
 * opened fresh after it draws the same four readings the one open before it drew.
 */
const desktop = mobileEmulation ? test.skip : test;

const FIXTURE_PNG = 'editor-background-png-test.png';

interface Dressing { name: string; known: number; front: string; height: number }
/** Two assets whose four facts all differ from each other and from the toilet preset's own. */
const A: Dressing = { name: 'Reloaded A', known: 1000, front: 'left', height: 420 };
const B: Dressing = { name: 'Reloaded B', known: 1500, front: 'up', height: 780 };

/** A new asset with a calibrated sheet, the toilet, a Front direction, the back-centre anchor and a height. */
async function dress(browser: NativeBrowser, designer: DesignerPage, ui: PlannerPage, dressing: Dressing): Promise<string> {
	const assetId = await designer.createAsset(dressing.name);
	await designer.chooseBackground(FIXTURE_PNG);
	await expect.poll(() => designer.readSidecar(assetId).revision).toBe(1);
	await designer.calibrate(dressing.known);
	await expect.poll(() => designer.readSidecar(assetId).revision).toBe(2);
	await designer.applyPreset('toilet');
	// Facing before anchor: the back centre is measured against the facing, so the other order
	// would leave the anchor at a point that no longer names a preset.
	await designer.designer().$('select[name="front-direction"]').selectByAttribute('value', dressing.front);
	await expect.poll(() => designer.readSidecar(assetId).revision).toBe(4);
	await designer.designer().$('button[name="placement-back-centre"]').click();
	await expect.poll(() => designer.readSidecar(assetId).revision).toBe(5);
	await designer.inspectorField('height').setValue(String(dressing.height));
	await browser.keys('Enter');
	await expect.poll(async () => (await ui.notesOfType('renovation-asset'))[`Renovation/Library/Assets/${dressing.name}.md`]?.height).toBe(dressing.height);
	return assetId;
}

/** What the designer open on `assetId` draws, beside the sidecar's text and the note's height. */
async function record(designer: DesignerPage, parity: ParityPage, ui: PlannerPage, assetId: string, name: string) {
	const states = (await designer.leafStates(DESIGNER)) as { assetId: string }[];
	await ui.activate(DESIGNER, states.findIndex((state) => state.assetId === assetId));
	return {
		shown: await parity.placementReadings(),
		sidecar: readFileSync(designer.sidecarPath(assetId), 'utf8'),
		height: (await ui.notesOfType('renovation-asset'))[`Renovation/Library/Assets/${name}.md`]?.height,
	};
}

describe('Design an Asset, the facts beside the shape across a plugin reload', () => {
	// Step 24.
	desktop('keeps the calibration, anchor, facing and height of both open designers across a toggle, and draws them on reopen', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const parity = createParityPage(browser, designer);
		const first = await dress(browser, designer, ui, A);
		const second = await dress(browser, designer, ui, B);
		await expect.poll(async () => ((await designer.leafStates(DESIGNER)) as { assetId: string }[]).map((state) => state.assetId).toSorted()).toEqual(
			[first, second].toSorted(),
		);

		const before = { [first]: await record(designer, parity, ui, first, A.name), [second]: await record(designer, parity, ui, second, B.name) };
		// As left: each fact set, and set to its own asset's value.
		for (const [assetId, dressing] of [[first, A], [second, B]] as const) {
			expect(before[assetId]?.shown).toMatchObject({ anchor: ['placement-back-centre'], front: dressing.front, height: String(dressing.height) });
			expect(before[assetId]?.shown.scale).toBe('Calibrated');
			expect((JSON.parse(before[assetId]?.sidecar ?? '{}') as { calibration: unknown }).calibration).not.toBeNull();
		}

		await page.disablePlugin('renovation-planner');
		await page.enablePlugin('renovation-planner');
		await expect.poll(() => designer.leafStates(DESIGNER)).toEqual([]);

		await designer.openDesignerFor(A.name);
		await designer.openDesignerFor(B.name);
		await expect.poll(async () => ((await designer.leafStates(DESIGNER)) as { assetId: string }[]).map((state) => state.assetId).toSorted()).toEqual(
			[first, second].toSorted(),
		);
		// Each reopened designer draws what its predecessor drew, over files the toggle left alone.
		expect(await record(designer, parity, ui, first, A.name)).toEqual(before[first]);
		expect(await record(designer, parity, ui, second, B.name)).toEqual(before[second]);
	});
});
