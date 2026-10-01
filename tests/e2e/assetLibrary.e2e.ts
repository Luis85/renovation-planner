import { describe, expect } from 'vitest';
import { test } from './fixture';
import { CATALOGUE, CATEGORY_ICONS, DESIGNED, openCatalogue, WIDE } from './library';
import { mobileEmulation } from './session';

/**
 * `docs/tests/cases/Browse the asset library.md`'s Grid-view rows (AD18-R18, R20/R21), walked in
 * a real Obsidian at a full pane's width: the tiles against the list's rows, the category sidebar
 * and the one filter it drives, the filtered empty states and where the caret goes from them, the
 * `Create your own` card, and the tile's placeholder icon. The narrow pane's rows are
 * `assetLibraryNarrow.e2e.ts`; the view state across a close and a restart is
 * `assetLibraryState.e2e.ts`. The library refuses to mount on mobile, so every case is desktop.
 */
const desktop = mobileEmulation ? test.skip : test;

describe('Browse the asset library in Grid, in the real Obsidian host', () => {
	// Step 20.
	desktop('replaces the shelves with one tile per asset, drawing the list row\'s own mark and size words', async ({ native: { browser, page, ui } }) => {
		const lib = await openCatalogue(browser, page, ui, { designed: true, width: WIDE });
		await lib.shelfHead('Material').click();
		const row = lib.row(DESIGNED);
		await expect.poll(() => row.isDisplayed()).toBe(true);
		const rowMark = await row.$('.rp-al-mark path').getAttribute('d');
		const rowWords = await row.parentElement().$('.rp-al-row__mark-words').getText();

		await lib.layout('Grid');
		await expect.poll(() => lib.library().$$('.rp-al-tile').length).toBe(CATALOGUE.length + 1);
		expect(await lib.library().$('.rp-al-shelf').isExisting()).toBe(false);
		expect(await lib.library().$$('.rp-al-tile__name').map((name) => name.getText())).toEqual(
			[...CATALOGUE.map((asset) => asset.name), DESIGNED].toSorted((one, other) => one.localeCompare(other)),
		);
		const tile = lib.tile(DESIGNED);
		expect(await tile.$('.rp-al-mark path').getAttribute('d')).toBe(rowMark);
		const size = await tile.$('.rp-al-tile__size').getText();
		expect(size).toMatch(/^\d+ × \d+ mm$/);
		expect(rowWords).toBe(`Measured footprint, ${size}`);
	});

	// Step 22.
	desktop('lists All and every DECLARED category with its icon, and refuses a category the build does not declare', async ({
		native: { browser, page, ui },
	}) => {
		const lib = await openCatalogue(browser, page, ui, { width: WIDE, layout: 'Grid' });
		await browser.executeObsidian(async ({ app }) => {
			await app.vault.create(
				'Renovation/Library/Assets/Lamp.md',
				'---\ntype: renovation-asset\nschema-version: 1\nid: asset-lamp\nrevision: 1\nname: Lamp\ncategory: lighting\nsupplier:\nsku:\nunit-cost: "5.00"\ncurrency: EUR\nunit: piece\nwaste-factor-default: "0"\nnotes:\n---\n',
			);
		});
		await expect.poll(() => lib.sidebar().isDisplayed()).toBe(true);
		const labels = await lib.library().$$('.rp-al-category').map((button) => button.getText());
		// FINDING: every declared category is listed whether the vault uses it or not (Plant,
		// Building element and Custom hold nothing here), and an undeclared one never reaches the
		// list — the note parser refuses it, so it lands in the repair strip.
		expect(labels).toEqual(Object.keys(CATEGORY_ICONS));
		for (const label of labels) expect((await lib.iconOf(lib.category(label))).icon).toBe(CATEGORY_ICONS[label]);
		await expect.poll(() => lib.library().$('.rp-al-repair').getText()).toContain('Renovation/Library/Assets/Lamp.md');
		expect(await lib.library().$$('.rp-al-tile__name').map((name) => name.getText())).not.toContain('Lamp');
	});

	// Step 23, and the count half of step 24's reason.
	desktop('narrows the grid AND the shelves to the chosen category, and counts only what it draws', async ({
		native: { browser, page, ui },
	}) => {
		const lib = await openCatalogue(browser, page, ui, { width: WIDE, layout: 'Grid' });
		await lib.category('Furniture').click();
		const furniture = CATALOGUE.filter((asset) => asset.category === 'furniture').map((asset) => asset.name).toSorted();
		await expect.poll(() => lib.library().$$('.rp-al-tile__name').map((name) => name.getText())).toEqual(furniture);
		expect(await lib.category('Furniture').getAttribute('aria-pressed')).toBe('true');

		await lib.layout('List');
		const drawnShelves = () => lib.library().$$('.rp-al-shelf .rp-al-shelf__name').map((name) => name.getText());
		await expect.poll(drawnShelves).toEqual(['Furniture']);

		// "a" matches assets in three categories; the count names only the two the pane draws.
		await lib.search('a');
		await expect.poll(() => lib.library().$('.rp-al-results').getText()).toBe('2 matching assets');
		expect(await lib.library().$$('.rp-al-row__name').map((name) => name.getText())).toEqual(furniture);
		await lib.category('All').click();
		await expect.poll(() => lib.library().$('.rp-al-results').getText()).not.toBe('2 matching assets');
	});

	// Steps 24 and 24a.
	desktop('words each empty state for the narrowed set, and Show all categories clears only the filter, landing on All', async ({
		native: { browser, page, ui },
	}) => {
		const lib = await openCatalogue(browser, page, ui, { width: WIDE, layout: 'Grid' });
		await lib.search('zzz');
		await expect.poll(() => lib.headline().getText()).toBe('No matching assets');
		// FINDING: the row's own route — a term matching NOTHING, then a category — keeps the
		// plain message, because the whole-catalogue "no matches" state is decided first.
		await lib.category('Furniture').click();
		await expect.poll(() => lib.category('Furniture').getAttribute('aria-pressed')).toBe('true');
		expect(await lib.headline().getText()).toBe('No matching assets');

		// A term matching another category's asset is what reaches "No matches in {category}".
		await lib.emptyIn('Furniture', 'plank');
		await lib.showAllCategories();
		// Step 24a: the caret lands on the pressed All, inside a sidebar that is laid out.
		expect(await lib.focused()).toEqual({ className: 'rp-al-category', text: 'All', pressed: 'true' });
		expect(await lib.library().$('.rp-al-search__input').getValue()).toBe('plank');
		expect(await lib.library().$$('.rp-al-tile__name').map((name) => name.getText())).toEqual(['Alder plank']);

		// No search running: a category holding nothing says so in its own words.
		await lib.library().$('.rp-al-search__clear').click();
		await lib.category('Plant').click();
		await expect.poll(() => lib.headline().getText()).toBe('No assets in Plant');
	});

	// Steps 28 and 29.
	desktop('ends the grid with a Create your own card whose New asset opens the toolbar\'s own dialog', async ({
		native: { browser, page, ui },
	}) => {
		const lib = await openCatalogue(browser, page, ui, { width: WIDE, layout: 'Grid' });
		const card = lib.library().$('.rp-al-tiles > li:last-child');
		await card.scrollIntoView();
		expect(await card.getAttribute('class')).toBe('rp-al-create-card');
		expect(await card.isDisplayed({ withinViewport: true })).toBe(true);
		expect((await lib.iconOf(card.$('.rp-host-icon'))).icon).toBe('lucide-pencil');
		expect(await card.$('.rp-al-create-card__title').getText()).toBe('Create your own');
		expect(await card.$('.rp-al-create-card__hint').getText()).toBe('Cannot find what you need? Design your own asset.');

		const dialog = () => browser.$('.rp-dialog');
		const opened = async (door: ReturnType<typeof lib.library>): Promise<string> => {
			await door.click();
			await expect.poll(() => dialog().isDisplayed()).toBe(true);
			// Every id is minted per mount, so two opens of one dialog differ in those and nothing else.
			const html = (await dialog().getHTML({ prettify: false })).replaceAll(/rp-\d+-\d+/g, 'rp-id');
			await browser.keys('Escape');
			await expect.poll(() => dialog().isExisting()).toBe(false);
			return html;
		};
		const button = card.$('button.rp-al-create-card__action');
		expect(await button.getText()).toBe('New asset');
		const fromCard = await opened(button);
		const fromToolbar = await opened(lib.library().$('.rp-al-toolbar button.rp-al-create'));
		expect(fromCard).toContain('rp-dialog-form');
		expect(fromCard).toBe(fromToolbar);
	});

	// Step 32.
	desktop('starts every tile\'s name and size on the same left edge, one line or two', async ({ native: { browser, page, ui } }) => {
		const lib = await openCatalogue(browser, page, ui, { designed: true, width: WIDE, layout: 'Grid' });
		const named = (name: string) => lib.glyphOffset(lib.tile(name).$('.rp-al-tile__name'), lib.tile(name));
		await expect.poll(() => lib.tile(DESIGNED).isDisplayed()).toBe(true);
		// The fixture has to exercise both cases for the claim to mean anything.
		expect(await named('Sofa')).toEqual({ offset: 0, lines: 1 });
		const wrapped = await named('Reading chair with a very long upholstered name');
		expect(wrapped.offset).toBe(0);
		expect(wrapped.lines).toBeGreaterThan(1);
		expect(await named(DESIGNED)).toEqual({ offset: 0, lines: 1 });
		expect(await lib.glyphOffset(lib.tile(DESIGNED).$('.rp-al-tile__size'), lib.tile(DESIGNED))).toEqual({ offset: 0, lines: 1 });
	});

	// Steps 33 and 34.
	desktop('draws a design-less tile\'s category icon, faint and at half the mark\'s box, identical to the sidebar\'s', async ({
		native: { browser, page, ui },
	}) => {
		const lib = await openCatalogue(browser, page, ui, { designed: true, width: WIDE, layout: 'Grid' });
		await expect.poll(() => lib.tile('Tile cutter').$('.rp-al-tile__category-icon svg').isExisting()).toBe(true);
		const placeholders: Record<string, string> = { 'Tile cutter': 'Equipment', Sofa: 'Furniture', 'Alder plank': 'Material', Vanity: 'Fixture' };
		for (const [asset, category] of Object.entries(placeholders)) {
			const icon = await lib.iconOf(lib.tile(asset).$('.rp-al-tile__category-icon'));
			expect(icon.icon).toBe(CATEGORY_ICONS[category]);
			// Step 34: the same drawing the sidebar's own row carries.
			expect(icon).toEqual(await lib.iconOf(lib.category(category)));
		}
		expect(await lib.tile(DESIGNED).$('.rp-al-tile__category-icon').isExisting()).toBe(false);

		const paint = await browser.execute(() => {
			const probe = document.createElement('span');
			document.body.append(probe);
			const resolve = (value: string): string => {
				probe.style.color = value;
				return getComputedStyle(probe).color;
			};
			const faint = resolve('var(--text-faint)');
			const muted = resolve('var(--text-muted)');
			probe.remove();
			const slot = document.querySelector<HTMLElement>('.workspace-leaf.mod-active .rp-al-tile__category-icon');
			const svg = slot?.querySelector('svg');
			const mark = document.querySelector('.workspace-leaf.mod-active .rp-al-tile .rp-al-mark--measured');
			return {
				faint,
				muted,
				icon: slot ? getComputedStyle(slot).color : null,
				mark: mark ? getComputedStyle(mark).color : null,
				ratio: slot && svg ? Math.round((svg.getBoundingClientRect().width / slot.getBoundingClientRect().width) * 100) / 100 : null,
				markBox: mark ? Math.round(mark.getBoundingClientRect().width) : null,
				slotBox: slot ? Math.round(slot.getBoundingClientRect().width) : null,
				stroke: svg?.firstElementChild ? getComputedStyle(svg.firstElementChild).strokeWidth : null,
			};
		});
		expect(paint.faint).not.toBe(paint.muted);
		expect(paint).toMatchObject({ icon: paint.faint, mark: paint.muted, ratio: 0.5, slotBox: paint.markBox, stroke: '1.5px' });
	});
});
