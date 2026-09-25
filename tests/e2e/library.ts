import { expect } from 'vitest';
import { createDesignerPage, LIBRARY, type ObsidianPage } from './designer';
import type { PlannerPage } from './helpers';
import type { NativeBrowser } from './session';

/** One catalogue note, written straight into the copied vault the way a user or a sync client writes one. */
export interface SeedAsset {
	readonly name: string;
	readonly category: string;
}

/** A catalogue with no designs, four categories, a one-line name and a wrapped one. */
export const CATALOGUE: readonly SeedAsset[] = [
	{ name: 'Sofa', category: 'furniture' },
	{ name: 'Reading chair with a very long upholstered name', category: 'furniture' },
	{ name: 'Alder plank', category: 'material' },
	{ name: 'Wall paint', category: 'material' },
	{ name: 'Vanity', category: 'fixture' },
	{ name: 'Tile cutter', category: 'equipment' },
];

/** The one designed asset, made through the designer's own toilet preset: a MEASURED outline. */
export const DESIGNED = 'Toilet';

/** What the sidebar's `All` draws, and what each category it lists draws — `categoryIcons.ts`'s table. */
export const CATEGORY_ICONS: Readonly<Record<string, string>> = {
	All: 'lucide-grid-2x-2',
	Material: 'lucide-layers',
	Furniture: 'lucide-armchair',
	Fixture: 'lucide-bath',
	Plant: 'lucide-sprout',
	Equipment: 'lucide-hammer',
	'Building element': 'lucide-brick-wall',
	Custom: 'lucide-pencil',
};

/**
 * Window widths, not pane widths: `resize` answers the container width they produce (measured,
 * the window less 45px of ribbon and frame). 1400 is plainly past §7's 45rem; 480 is under 35rem.
 */
export const WIDE = 1400;
export const NARROW = 480;

type Located = ReturnType<NativeBrowser['$']>;

/** An XPath predicate for an element whose whole text is `text`. */
const exact = (text: string) => `[normalize-space(.)="${text}"]`;

/**
 * The Asset library as a user reaches it, plus the measurements a jsdom tree cannot answer: what
 * is laid out at a real container width, where a text node's first glyph sits, and which element
 * holds the caret.
 */
export function createLibraryPage(browser: NativeBrowser, ui: PlannerPage) {
	const library = () => ui.leaf(LIBRARY);

	const seed = (assets: readonly SeedAsset[]) =>
		browser.executeObsidian(async ({ app }, list) => {
			const folder = 'Renovation/Library/Assets';
			if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
			for (const [index, asset] of list.entries()) {
				const frontmatter = [
					'type: renovation-asset',
					'schema-version: 1',
					`id: asset-e2e-${String(index)}`,
					'revision: 1',
					`name: ${asset.name}`,
					`category: ${asset.category}`,
					'supplier:',
					'sku:',
					'unit-cost: "10.00"',
					'currency: EUR',
					'unit: piece',
					'waste-factor-default: "0"',
					'notes:',
				];
				await app.vault.create(`${folder}/${asset.name}.md`, `---\n${frontmatter.join('\n')}\n---\n`);
			}
		}, assets);

	/** The palette command, then the leaf brought forward and its catalogue read. */
	const open = async (count: number): Promise<void> => {
		await ui.command('open-asset-library');
		await ui.activate(LIBRARY);
		await expect.poll(() => library().$('.rp-al-status__count').getText()).toBe(`${String(count)} assets`);
	};

	/**
	 * The library's own box, set by the window: the side docks collapse so the main area is the
	 * only thing the window's width is spent on, and the answer is the CONTAINER's width, which is
	 * what `@container rp-al` measures.
	 */
	const resize = async (width: number): Promise<number> => {
		await browser.executeObsidian(({ app }) => {
			app.workspace.leftSplit.collapse();
			app.workspace.rightSplit.collapse();
		});
		// WebDriver's own window/rect is refused by Electron's chromedriver (`Browser.getWindowForTarget`
		// wasn't found), so the window is sized through Electron itself.
		await browser.execute((px) => {
			const remote = (window as unknown as { require(id: string): { getCurrentWindow(): { setSize(w: number, h: number): void } } }).require('@electron/remote');
			remote.getCurrentWindow().setSize(px, 900);
		}, width);
		await browser.pause(400);
		return browser.execute(() => document.querySelector('.workspace-leaf.mod-active .renovation-asset-library')?.clientWidth ?? 0);
	};

	/** Obsidian's own view state for every library leaf, as it would persist it. */
	const viewState = () =>
		browser.executeObsidian(({ app }, type) => app.workspace.getLeavesOfType(type).map((leaf) => leaf.getViewState().state), LIBRARY);

	/** The element holding the caret, described by what a test can name it by. */
	const focused = () =>
		browser.execute(() => {
			const el = document.activeElement;
			return { className: el?.className ?? '', text: el?.textContent?.trim() ?? '', pressed: el?.getAttribute('aria-pressed') ?? null };
		});

	/**
	 * Where the first glyph of an element's text sits, measured from the left of `box`'s CONTENT
	 * edge (inside its border and padding) — a Range over the text, not the element's own box,
	 * because a stretched span's box starts at the content edge whatever its text does.
	 */
	const glyphOffset = async (element: Located, box: Located) =>
		browser.execute(
			(el: HTMLElement, outer: HTMLElement) => {
				const range = document.createRange();
				range.selectNodeContents(el);
				const first = range.getClientRects()[0];
				const style = getComputedStyle(outer);
				const edge = outer.getBoundingClientRect().left + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft);
				return { offset: Math.round((first?.left ?? Number.NaN) - edge), lines: range.getClientRects().length };
			},
			await element.getElement(),
			await box.getElement(),
		);

	/** The Lucide icon an element draws, and its drawing, so two icons can be compared exactly. */
	const iconOf = async (host: Located) =>
		browser.execute((el: HTMLElement) => {
			const svg = el.querySelector('svg');
			return { icon: [...(svg?.classList ?? [])].find((name) => name.startsWith('lucide-')) ?? null, drawing: svg?.innerHTML ?? null };
		}, await host.getElement());

	return {
		library,
		seed,
		open,
		resize,
		viewState,
		focused,
		glyphOffset,
		iconOf,
		layout: (word: 'Grid' | 'List') => library().$(`button.rp-al-layout__option[aria-label="${word}"]`).click(),
		category: (label: string) => library().$(`.//button[contains(@class, "rp-al-category")]${exact(label)}`),
		shelfHead: (label: string) => library().$(`.//button[contains(@class, "rp-al-shelf__head")][.//span[contains(@class, "rp-al-shelf__name")]${exact(label)}]`),
		tile: (name: string) => library().$(`.//button[contains(@class, "rp-al-tile")][.//span[contains(@class, "rp-al-tile__name")]${exact(name)}]`),
		row: (name: string) => library().$(`.//button[contains(@class, "rp-al-row")][.//span[contains(@class, "rp-al-row__name")]${exact(name)}]`),
		search: (text: string) => library().$('.rp-al-search__input').setValue(text),
		headline: () => library().$('.rp-empty-state__headline'),
		funnel: () => library().$('button.rp-al-filter'),
		sidebar: () => library().$('.rp-al-categories'),
		/** One funnel press, waited for until the sidebar's layout answers `shown`. */
		async pressFunnel(shown: boolean): Promise<void> {
			await library().$('button.rp-al-filter').click();
			await expect.poll(() => library().$('.rp-al-categories').isDisplayed()).toBe(shown);
		},
		/** A category chosen and a term typed, landing on the empty state that names the category. */
		async emptyIn(label: string, term: string): Promise<void> {
			await library().$(`.//button[contains(@class, "rp-al-category")]${exact(label)}`).click();
			await library().$('.rp-al-search__input').setValue(term);
			await expect.poll(() => library().$('.rp-empty-state__headline').getText()).toBe(`No matches in ${label}`);
		},
		/** The filtered empty state's own action, waited for until the empty state is gone. */
		async showAllCategories(): Promise<void> {
			await library().$('button=Show all categories').click();
			await expect.poll(() => library().$('.rp-empty-state__headline').isExisting()).toBe(false);
		},
	};
}

export type LibraryPage = ReturnType<typeof createLibraryPage>;

export interface CatalogueOptions {
	/** Design the toilet beside the catalogue. */
	readonly designed?: boolean;
	/** A window width to size the library by — `WIDE` or `NARROW` — asserted against §7's rungs. */
	readonly width?: number;
	readonly layout?: 'Grid' | 'List';
}

/** The catalogue above in a fresh vault, the toilet designed beside it when asked, and the library open on it. */
export async function openCatalogue(browser: NativeBrowser, page: ObsidianPage, ui: PlannerPage, options: CatalogueOptions = {}): Promise<LibraryPage> {
	const { designed = false, width, layout } = options;
	if (designed) {
		const designer = createDesignerPage(browser, page, ui);
		await designer.createAsset(DESIGNED);
		await designer.applyPreset('toilet');
	}
	const lib = createLibraryPage(browser, ui);
	await lib.seed(CATALOGUE);
	// Every note parsed by the host before the library reads the index: a note still in flight
	// was measured missing from an open library for the whole 10 s poll once, under load.
	await expect.poll(async () => Object.keys(await ui.notesOfType('renovation-asset')).length).toBe(CATALOGUE.length + (designed ? 1 : 0));
	await lib.open(CATALOGUE.length + (designed ? 1 : 0));
	if (layout) await lib.layout(layout);
	if (width !== undefined) {
		const container = await lib.resize(width);
		// Under 35rem for a narrow window, past 45rem for a wide one: the rung each case is about.
		expect(width === NARROW ? container < 560 : container > 720).toBe(true);
	}
	return lib;
}
