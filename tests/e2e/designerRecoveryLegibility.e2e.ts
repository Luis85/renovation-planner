import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage } from './designer';
import { contrastOf } from './designerParity';
import { writeEvidence } from './diagnostics';
import { inBothThemes, paints, TEXT_CONTRAST } from './legibility';
import { setSchema, staleAfter } from './recovery';
import type { NativeBrowser } from './session';
import { mobileEmulation } from './session';

/**
 * UI critique round, Task 1: `docs/tests/cases/Recover an asset design rather than lose it.md`'s
 * stale notice, WCAG 2.x SC 1.4.3. `.rp-designer-notice`'s own comment (`styles/designer-notice.css`)
 * records the pair this measures: `--text-warning` as TEXT on `--background-secondary` — the exact
 * pair `.rp-designer-unscaled`'s and `.rp-dialog-warning`'s own comments measured at about 2.73:1
 * in the light theme, under the 4.5:1 floor. GUARD, not a discharge: this reads the notice's own
 * paint in the real host, in both of Obsidian's themes, staged the same way
 * `assetDesignerGeometry.e2e.ts`'s *keeps the stale notice's Try again…* case already stages it
 * (`staleAfter`/`setSchema`). Desktop only, as the designer is.
 */
const desktop = mobileEmulation ? test.skip : test;

/** The active project view leaf's own content element, as a `browser.execute` querySelector takes it. */
const ACTIVE_PROJECT = '.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-project"]';

/**
 * `.rp-asset-price-orphan`/`.rp-asset-price-unreadable` (`styles/asset-prices.css:140`) also draw
 * `--text-warning` as text, but on no background either rule or any of its ancestors declares
 * (`.rp-project-detail`, `.rp-project-detail__body`, `.rp-asset-price-list` and
 * `.rp-asset-price-row` are read at source and none sets one) — a different pairing from the
 * designer notice's own `--background-secondary`, so the brief's "only fix it the same way if you
 * MEASURE it failing" cannot be answered by inference from the designer's ratio. Building an
 * actual orphan or unreadable price row needs a project, an asset, a price override AND a broken
 * note behind it — fixture work this task does not otherwise need. What decides the ratio is the
 * ANCESTOR CHAIN's background, which is pure CSS cascade and does not depend on the row's data
 * state, so a synthetic element wearing the real class chain, appended where a real row would
 * render, reads the same background the cascade would give an actual one.
 */
const priceWarningPaint = (browser: NativeBrowser, className: string) =>
	browser.execute(
		(root, cls) => {
			const body = document.querySelector(`${root} .rp-project-detail__body`);
			if (!body) throw new Error('No project detail body.');
			const list = document.createElement('ul');
			list.className = 'rp-asset-price-list';
			const row = document.createElement('li');
			row.className = 'rp-asset-price-row';
			const probe = document.createElement('p');
			probe.className = cls;
			probe.textContent = 'probe';
			row.append(probe);
			list.append(row);
			body.append(list);
			const chain: Element[] = [];
			for (let el: Element | null = probe; el; el = el.parentElement) chain.push(el);
			const style = getComputedStyle(probe);
			const result = { stroke: style.color, opacity: 1, backgrounds: chain.map((el) => getComputedStyle(el).backgroundColor) };
			list.remove();
			return result;
		},
		ACTIVE_PROJECT,
		className,
	);

describe('Recover an asset design, legibility guard in the real Obsidian host', () => {
	desktop('draws the stale notice’s text at 4.5:1 or more against its background, in both themes', async ({
		native: { browser, page, ui, directory },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createToilet('Faded toilet');
		await staleAfter(designer, assetId, setSchema(99));

		const measured = await inBothThemes(browser, () => paints(browser, '.rp-designer-notice', 'color', 'role'));
		const ratios = { light: measured.light.map((paint) => contrastOf(paint).ratio), dark: measured.dark.map((paint) => contrastOf(paint).ratio) };
		await writeEvidence(directory, 'stale-notice-contrast', { measured, ratios });

		expect(measured.light.length, 'the stale notice painted').toBeGreaterThan(0);
		expect.soft(Math.min(...ratios.light), `light theme ${JSON.stringify(ratios.light)}`).toBeGreaterThanOrEqual(TEXT_CONTRAST);
		expect.soft(Math.min(...ratios.dark), `dark theme ${JSON.stringify(ratios.dark)}`).toBeGreaterThanOrEqual(TEXT_CONTRAST);
	});
});

describe('Asset prices’ orphan and unreadable rows, the same pairing checked rather than assumed', () => {
	/**
	 * MEASURED failing (UI critique round, Task 1: light theme, about 2.95:1) before this task's
	 * fix — the brief's own text was "fix it the same way only if you MEASURE it failing", and this
	 * is that measurement, now a GUARD on the fix it justified. Read the docblock above
	 * `priceWarningPaint` for what the synthetic element does and does not stand in for.
	 */
	desktop('draws --text-warning at 4.5:1 or more against the price row’s real, inherited background, in both themes', async ({
		native: { browser, ui, directory },
	}) => {
		await ui.openProjectView();
		await ui.projectView().$('.rp-empty-state__action').click();
		await ui.submitForm('Priced project');
		await expect.poll(() => ui.projectView().$('.rp-project-detail__name').getText()).toBe('Priced project');

		const measured = await inBothThemes(browser, async () => ({
			orphan: contrastOf(await priceWarningPaint(browser, 'rp-asset-price-orphan')).ratio,
			unreadable: contrastOf(await priceWarningPaint(browser, 'rp-asset-price-unreadable')).ratio,
		}));
		await writeEvidence(directory, 'price-warning-contrast', measured);

		for (const [theme, ratios] of Object.entries(measured)) {
			expect.soft(ratios.orphan, `${theme} orphan`).toBeGreaterThanOrEqual(TEXT_CONTRAST);
			expect.soft(ratios.unreadable, `${theme} unreadable`).toBeGreaterThanOrEqual(TEXT_CONTRAST);
		}
	});
});
