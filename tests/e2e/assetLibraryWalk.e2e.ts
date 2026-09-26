import { describe, expect } from 'vitest';
import { test } from './fixture';
import { NARROW, openCatalogue, type LibraryPage } from './library';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Browse the asset library.md`, two clauses about where boxes LAND, which only a
 * layout engine answers and `@container rp-al` is evaluated by nothing in jsdom: step 11's rail
 * rungs at 35rem and 45rem, and whether step 26's funnel lays the sidebar OVER the grid or beside it.
 */
const desktop = mobileEmulation ? test.skip : test;

interface Box { left: number; right: number; top: number; bottom: number; width: number }

/** The library's rail, shelves body and container as laid out now; `null` for a box that is not drawn. */
const layout = (browser: NativeBrowser) =>
	browser.execute(() => {
		const root = document.querySelector('.workspace-leaf.mod-active .renovation-asset-library');
		const box = (sel: string) => {
			const el = root?.querySelector(sel);
			if (!el || el.getClientRects().length === 0) return null;
			const { left, right, top, bottom, width } = el.getBoundingClientRect();
			return { left, right, top, bottom, width };
		};
		return { container: root?.clientWidth ?? 0, rem: Number.parseFloat(getComputedStyle(document.documentElement).fontSize), rail: box('.rp-al-inspector'), body: box('.rp-al-body'), sidebar: box('.rp-al-categories'), tiles: box('.rp-al-tiles') };
	});

const overlap = (a: Box, b: Box): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** The container walked to `target`, and what is laid out there. */
async function at(browser: NativeBrowser, lib: LibraryPage, target: number) {
	await lib.resizeTo(target);
	const now = await layout(browser);
	console.log(`layout at ${String(target)}: ${JSON.stringify(now)}`);
	return now;
}

describe('Browse the asset library, where the rail and the sidebar land, in the real Obsidian host', () => {
	// Step 11, the measurable half.
	desktop('gives the selection the whole pane under 35rem, a 240px rail from 35rem and a 280px one from 45rem', async ({
		native: { browser, page, ui },
	}) => {
		const lib = await openCatalogue(browser, page, ui, { layout: 'Grid' });
		await lib.tile('Sofa').click();
		await expect.poll(() => lib.library().$('.rp-al-inspector__name').getText()).toBe('Sofa');
		const { rem } = await layout(browser);

		// Each width is read back rather than trusted — the window's frame and a scrollbar move the
		// container by a few pixels — and the rung is decided by the width the container REACHED.
		const rungs = new Set<string>();
		for (const target of [35 * rem - 24, 35 * rem + 24, 45 * rem - 24, 45 * rem + 24]) {
			const { container, rail, body } = await at(browser, lib, target);
			if (container < 35 * rem) {
				// No rail: the inspector IS the pane, and the shelves are gone.
				rungs.add('pane');
				expect(body).toBeNull();
				expect(Math.abs((rail?.width ?? 0) - container)).toBeLessThanOrEqual(1);
			} else {
				rungs.add(container < 45 * rem ? '240' : '280');
				expect(body).not.toBeNull();
				expect(Math.abs((rail?.width ?? 0) - (container < 45 * rem ? 240 : 280))).toBeLessThanOrEqual(1);
			}
		}
		// Every rung was reached, not only the one a walk happened to land in.
		expect([...rungs].toSorted()).toEqual(['240', '280', 'pane']);
	});

	// Step 26, "as an overlay over the grid". CONTRARY: the case row claimed an overlay; this pins the build's push-aside, and the row was rewritten under AD18-R27.
	desktop('lays the funnel\'s sidebar beside the grid at a sidebar\'s width, narrowing the grid rather than covering it', async ({
		native: { browser, page, ui },
	}) => {
		const lib = await openCatalogue(browser, page, ui, { width: NARROW, layout: 'Grid' });
		await expect.poll(async () => (await layout(browser)).sidebar).toBeNull();
		const closed = await layout(browser);
		await lib.pressFunnel(true);
		const open = await layout(browser);
		console.log(`step 26 closed ${JSON.stringify(closed)} open ${JSON.stringify(open)}`);
		const { sidebar, tiles } = open;
		if (!sidebar || !tiles || !closed.tiles) throw new Error('The sidebar or the grid is not drawn.');
		expect(overlap(sidebar, tiles)).toBe(false);
		expect(tiles.left).toBeGreaterThanOrEqual(sidebar.right);
		expect(tiles.width).toBeLessThan(closed.tiles.width - sidebar.width / 2);
	});
});
