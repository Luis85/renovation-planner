import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage, LIBRARY } from './designer';
import { contrastOf } from './designerParity';
import { writeEvidence } from './diagnostics';
import { inBothThemes, paints } from './legibility';
import { DESIGNED, openCatalogue, WIDE } from './library';
import { mobileEmulation } from './session';

/**
 * AD18-R39 in a real Obsidian: a Grid tile and the inspector's Shape preview draw the asset's
 * details inside its footprint, and the 20px list row does not. The library is read-only on mobile since owner ruling 66 (L-43), and this was
 * written against the desktop one, so the case is desktop only.
 */
const desktop = mobileEmulation ? test.skip : test;

/** The mark's drawn paths on the active library's tile named `name`, footprint first. */
const tilePaths = (name: string): string =>
	`.workspace-leaf.mod-active .rp-al-tile[data-rp-e2e-tile="${name}"] .rp-al-mark path`;

describe('Browse the asset library, the tile draws the asset\'s details (AD18-R39)', () => {
	/*
	 * A vanity designed through its own preset draws its carcass, basin and tap hole inside its
	 * footprint on the tile — each a real painted line, placed inside the footprint's box, thinner
	 * than the footprint and in its colour — in both of Obsidian's themes; a rectangular table's tile
	 * draws its footprint alone; the vanity's list row still draws one path; and the inspector's
	 * Shape preview draws the same four. WHAT STAYS HUMAN: whether the tile now READS as a vanity.
	 */
	desktop('draws a vanity tile\'s details inside its footprint in both themes, and a table tile\'s footprint alone', async ({
		native: { browser, page, ui, directory },
	}) => {
		const lib = await openCatalogue(browser, page, ui, { designed: true, width: WIDE, layout: 'Grid' });
		const designer = createDesignerPage(browser, page, ui);
		// One designer leaf at a time: `applyPreset` polls the FIRST designer leaf's sidecar.
		for (const [name, preset] of [['Vanity', 'vanity'], ['Tile cutter', 'rect-table']] as const) {
			await designer.closeDesigner();
			await designer.openDesignerFor(name);
			await designer.applyPreset(preset);
		}
		await designer.closeDesigner();
		await ui.activate(LIBRARY);

		// Name each tile by its visible name, so a selector can reach it without an XPath per read.
		const tag = () =>
			browser.execute(() => {
				for (const tile of document.querySelectorAll('.workspace-leaf.mod-active .rp-al-tile')) {
					tile.setAttribute('data-rp-e2e-tile', tile.querySelector('.rp-al-tile__name')?.textContent?.trim() ?? '');
				}
			});
		const counts = async () => {
			await tag();
			return browser.execute((sel) => ['Vanity', 'Tile cutter', 'Toilet'].map((name) => document.querySelectorAll(sel.replace('NAME', name)).length), tilePaths('NAME'));
		};
		// The marks re-read on the design change; vanity 1 + 3 details, table 1, toilet 1 + tank and bowl.
		await expect.poll(counts).toEqual([4, 1, 3]);

		const geometry = await browser.execute((sel) => {
			const [footprint, ...details] = [...document.querySelectorAll<SVGPathElement>(sel)];
			return {
				footprint: footprint ? { box: footprint.getBoundingClientRect().toJSON() as DOMRect, stroke: getComputedStyle(footprint).strokeWidth, colour: getComputedStyle(footprint).stroke } : null,
				details: details.map((detail) => ({
					box: detail.getBoundingClientRect().toJSON() as DOMRect,
					length: detail.getTotalLength(),
					stroke: getComputedStyle(detail).strokeWidth,
					colour: getComputedStyle(detail).stroke,
					dashed: getComputedStyle(detail).strokeDasharray,
				})),
			};
		}, tilePaths('Vanity'));
		const paint = await inBothThemes(browser, async () => {
			const drawn = await paints(browser, tilePaths('Vanity'), 'stroke', 'data-rp-e2e-tile');
			return drawn.map((each) => ({ stroke: each.stroke, ratio: contrastOf(each).ratio }));
		});

		await ui.activate(LIBRARY);
		await tag();
		await browser.$('.workspace-leaf.mod-active .rp-al-tile[data-rp-e2e-tile="Vanity"]').click();
		await expect.poll(() => browser.$$('.workspace-leaf.mod-active .rp-al-shape-preview .rp-al-mark path').length).toBe(4);
		const inspectorDetails = await browser.$$('.workspace-leaf.mod-active .rp-al-shape-preview .rp-al-mark path.rp-al-mark__detail').length;

		await lib.layout('List');
		for (const head of await lib.library().$$('button.rp-al-shelf__head[aria-expanded="false"]')) await head.click();
		const row = lib.row('Vanity');
		await expect.poll(() => row.isDisplayed()).toBe(true);
		await expect.poll(() => row.$('.rp-al-mark').getAttribute('class')).toBe('rp-al-mark rp-al-mark--measured');
		const rowPaths = await row.$$('.rp-al-mark path').length;

		await writeEvidence(directory, 'tile-details', { geometry, paint, inspectorDetails, rowPaths, designed: DESIGNED });

		const { footprint, details } = geometry;
		if (footprint === null) throw new Error('No footprint path on the vanity tile.');
		expect(details, 'the vanity tile\'s details').toHaveLength(3);
		for (const [index, detail] of details.entries()) {
			const at = `detail ${String(index)}`;
			expect(detail.length, `${at}: a drawn line`).toBeGreaterThan(0);
			expect(detail.box.width * detail.box.height, `${at}: an area on screen`).toBeGreaterThan(0);
			// Inside the footprint's own box, give or take the stroke itself.
			expect(detail.box.left, `${at}: left`).toBeGreaterThanOrEqual(footprint.box.left - 1);
			expect(detail.box.right, `${at}: right`).toBeLessThanOrEqual(footprint.box.right + 1);
			expect(detail.box.top, `${at}: top`).toBeGreaterThanOrEqual(footprint.box.top - 1);
			expect(detail.box.bottom, `${at}: bottom`).toBeLessThanOrEqual(footprint.box.bottom + 1);
			expect(Number.parseFloat(detail.stroke), `${at}: thinner than the footprint`).toBeLessThan(Number.parseFloat(footprint.stroke));
			expect(detail.colour, `${at}: the footprint's own colour`).toBe(footprint.colour);
		}
		// The carcass under the top is dashed; basin and tap hole are solid.
		expect(details.map((detail) => detail.dashed !== 'none')).toEqual([true, false, false]);
		for (const [theme, lines] of Object.entries(paint)) {
			const [outline, ...inner] = lines;
			expect(inner, `${theme}: three detail lines`).toHaveLength(3);
			// Thinner, never fainter: every detail line paints at the footprint's own contrast.
			for (const line of inner) expect(line.ratio, `${theme}: a detail's contrast`).toBeCloseTo(outline?.ratio ?? Number.NaN, 5);
		}
		expect(inspectorDetails, 'the inspector preview\'s details').toBe(3);
		expect(rowPaths, 'the 20px row mark, footprint only').toBe(1);
	});
});
