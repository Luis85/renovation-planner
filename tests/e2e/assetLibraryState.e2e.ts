import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect } from 'vitest';
import { test } from './fixture';
import { LIBRARY } from './designer';
import type { PlannerPage } from './helpers';
import { CATALOGUE, openCatalogue, type LibraryPage } from './library';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Browse the asset library.md`'s §6.3 rows: what the library keeps in
 * Obsidian's OWN view state, across a real restart and a real close — the half `FakeLeaf` records
 * rather than behaves, so nothing but a driven host can answer it.
 */
const desktop = mobileEmulation ? test.skip : test;

const pressed = async (lib: LibraryPage) => ({
	layout: await lib.library().$('.rp-al-layout__option[aria-pressed="true"]').getAttribute('aria-label'),
	category: await lib.library().$('.rp-al-category[aria-pressed="true"]').getText(),
});

/** The library leaf's own back/forward history, and whether the pane's back arrow is live. */
const history = async (browser: NativeBrowser, lib: LibraryPage) => ({
	lengths: await browser.executeObsidian(({ app }, type) => {
		const leaf = app.workspace.getLeavesOfType(type)[0] as unknown as { history: { backHistory: unknown[]; forwardHistory: unknown[] } };
		return [leaf.history.backHistory.length, leaf.history.forwardHistory.length];
	}, LIBRARY),
	back: await lib.library().$('.view-header-nav-buttons button').getAttribute('aria-disabled'),
});

interface LayoutNode {
	state?: { type?: string; state?: unknown };
	children?: LayoutNode[];
}

/** Every library leaf's state as Obsidian last SAVED it to `.obsidian/workspace.json` — what a restart reads. */
const onDisk = (vault: string): unknown[] => {
	const found: unknown[] = [];
	const walk = (node: LayoutNode | undefined): void => {
		if (node?.state?.type === LIBRARY) found.push(node.state.state);
		for (const child of node?.children ?? []) walk(child);
	};
	walk((JSON.parse(readFileSync(path.join(vault, '.obsidian/workspace.json'), 'utf8')) as { main?: LayoutNode }).main);
	return found;
};

/**
 * A restart that tests the RESTORE: first a gesture that makes Obsidian save its layout (the
 * project view's tab brought forward) and the disk polled until it carries `saved`, then the
 * restart and the library brought forward. Without that gesture a publish never reaches the disk
 * (step 16's finding), and a restart would be testing Obsidian's save timing instead.
 */
const restart = async (browser: NativeBrowser, vault: string, ui: PlannerPage, lib: LibraryPage, saved: unknown[]): Promise<void> => {
	await ui.openProjectView();
	await expect.poll(() => onDisk(vault), { timeout: 15_000 }).toEqual(saved);
	await browser.reloadObsidian();
	await expect.poll(lib.viewState, { timeout: 20_000 }).toEqual(saved);
	await ui.activate(LIBRARY);
};

describe('The asset library\'s view state, in the real Obsidian host', () => {
	// Step 16.
	desktop('brings the selection and the expanded shelves back after Obsidian restarts', async ({ native: { browser, page, ui } }) => {
		const lib = await openCatalogue(browser, page, ui);
		await lib.shelfHead('Material').click();
		await lib.shelfHead('Furniture').click();
		await lib.shelfHead('Material').click();
		await lib.row('Sofa').click();
		await expect.poll(() => lib.library().$('.rp-al-inspector__name').getText()).toBe('Sofa');
		const saved = [{ assetId: 'asset-e2e-0', expanded: ['furniture'] }];
		await expect.poll(lib.viewState).toEqual(saved);

		// FINDING: a publish does not make Obsidian SAVE the layout. Three seconds on, the disk still
		// holds an older state, and a restart now (a session ended, as a quit ends one) restores that.
		await browser.pause(3000);
		expect(onDisk(page.getVaultPath())).not.toEqual(saved);
		await restart(browser, page.getVaultPath(), ui, lib, saved);
		await expect.poll(() => lib.library().$('.rp-al-inspector__name').getText()).toBe('Sofa');
		expect(await lib.shelfHead('Furniture').getAttribute('aria-expanded')).toBe('true');
		expect(await lib.shelfHead('Material').getAttribute('aria-expanded')).toBe('false');
		expect(await lib.row('Sofa').getAttribute('aria-current')).toBe('true');
	});

	// Step 30.
	desktop('keeps Grid and the category across a restart, and forgets both when the leaf is closed and reopened', async ({
		native: { browser, page, ui },
	}) => {
		const lib = await openCatalogue(browser, page, ui);
		await lib.layout('Grid');
		await lib.category('Furniture').click();
		const saved = [{ assetId: '', expanded: [], layout: 'grid', category: 'furniture' }];
		await expect.poll(lib.viewState).toEqual(saved);

		await restart(browser, page.getVaultPath(), ui, lib, saved);
		await expect.poll(() => pressed(lib)).toEqual({ layout: 'Grid', category: 'Furniture' });

		// FINDING: the row's own gesture — close THIS leaf, then reopen the library — opens a new
		// leaf, and a new leaf's view state is the default: List over every category.
		await browser.executeObsidian(({ app }, type) => {
			for (const leaf of app.workspace.getLeavesOfType(type)) leaf.detach();
		}, LIBRARY);
		await expect.poll(lib.viewState).toEqual([]);
		await lib.open(CATALOGUE.length);
		expect(await lib.viewState()).toEqual([{ assetId: '', expanded: [] }]);
		expect(await lib.library().$('.rp-al-layout__option[aria-pressed="true"]').getAttribute('aria-label')).toBe('List');
		expect(await lib.library().$('.rp-al-tiles').isExisting()).toBe(false);
	});

	// Step 31.
	desktop('adds nothing to the leaf\'s back history for a layout or a category change', async ({ native: { browser, page, ui } }) => {
		const lib = await openCatalogue(browser, page, ui);
		const before = await history(browser, lib);
		for (const word of ['Grid', 'List', 'Grid'] as const) await lib.layout(word);
		for (const label of ['Furniture', 'Material', 'All']) await lib.category(label).click();
		await expect.poll(lib.viewState).toEqual([{ assetId: '', expanded: [], layout: 'grid' }]);
		expect(before).toEqual({ lengths: [0, 0], back: 'true' });
		expect(await history(browser, lib)).toEqual(before);
	});
});
