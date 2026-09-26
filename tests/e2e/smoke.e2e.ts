import path from 'node:path';
import type Konva from 'konva';
import { describe, expect } from 'vitest';
import { test } from './fixture';
import { EDITOR, collectRendererErrors, reloadPlugin, rendererErrors, seedSampleProject } from './planner';
import { PLUGIN_ID, mobileEmulation, type NativeBrowser } from './session';

/**
 * A01 — no unhandled renderer error across every route — and the one Empty States row the
 * suite could not answer (`docs/tests/cases/Empty States Walkthrough.md`, step 4). Spec
 * `docs/superpowers/specs/2026-09-25-pr231-e2e-suite-design.md` §3.8.
 *
 * Every case seeds through `create-sample-project`, a write, so all three run on the desktop
 * legs; mobile is view-only by design.
 *
 * Selectors taken from SOURCE rather than from a run, since these cases had not run when they
 * were written: `.rp-al-create` (`AssetLibraryRoot.vue`), `.rp-al-action--designer`
 * (`AssetInspector.vue`), `.renovation-asset-designer` (`AssetDesignerRoot.vue`),
 * `.rp-diagnostics` (`DiagnosticsReportModal.ts`), the Konva layer name `zone`
 * (`ZoneLayer.vue`), the group name `model.id` (`ZoneShape.vue`), `.rp-floor-start`
 * (`FloorStart.vue`) and `.rp-empty-state` (`EmptyState.vue`).
 */
const desktop = mobileEmulation ? test.skip : test;

const LIBRARY = '.workspace-leaf-content[data-type="renovation-asset-library"]';
const DESIGNER = '.workspace-leaf-content[data-type="renovation-asset-designer"]';

/** `rendererErrors` answers `[]` for a collector that never installed, so each case asks first. */
const collecting = (browser: NativeBrowser): Promise<boolean> =>
	browser.execute(() => Array.isArray((window as unknown as { __rpErrors?: unknown }).__rpErrors));

/** `typeof window.Konva`, as a string: an `undefined` does not survive the WebDriver wire as itself. */
const konvaType = (browser: NativeBrowser): Promise<string> =>
	browser.execute(() => typeof (window as unknown as { Konva?: unknown }).Konva);

/**
 * The names of the children of the editor stage's `zone` layer, sorted, or `null` with no such
 * layer. Each child is one `ZoneShape`'s group, named by its zone's id.
 */
const drawnZones = (browser: NativeBrowser): Promise<string[] | null> =>
	browser.execute((editor: string) => {
		const stages = (window as unknown as { Konva?: typeof Konva }).Konva?.stages ?? [];
		const layer = stages.find((stage) => stage.container().closest(editor) !== null)?.findOne<Konva.Layer>('.zone');
		return layer ? layer.getChildren().map((group) => group.name()).toSorted() : null;
	}, EDITOR);

describe('A01 smoke in the real host', () => {
	desktop('raises no unhandled renderer error across every route and a reload', async ({ native: { browser, page, ui } }) => {
		// Installed BEFORE a reload, so it sees a whole load rather than the tail of one.
		await collectRendererErrors(browser);
		await reloadPlugin(page);

		await ui.openProjectView();
		await seedSampleProject(browser, ui);
		await ui.command('open-asset-library');
		await expect.poll(() => browser.$(LIBRARY).isDisplayed()).toBe(true);

		// The asset designer, on an asset made through the real New asset form (`NewAssetForm.vue`):
		// the sample project seeds none, and the library selects what it has just created, so the
		// inspector's Open designer is one click away.
		await browser.$(LIBRARY).$('.rp-al-create').click();
		await ui.submitForm('Floor tile');
		const openDesigner = () => browser.$(LIBRARY).$('.rp-al-action--designer');
		await expect.poll(() => openDesigner().isDisplayed()).toBe(true);
		await openDesigner().click();
		await expect.poll(() => browser.$(DESIGNER).$('.renovation-asset-designer').isDisplayed()).toBe(true);

		await ui.command('show-diagnostics-report');
		await expect.poll(() => browser.$('.rp-diagnostics').isDisplayed()).toBe(true);
		await browser.keys('Escape');
		await expect.poll(() => browser.$('.rp-diagnostics').isExisting()).toBe(false);

		await reloadPlugin(page);
		expect(await collecting(browser)).toBe(true);
		expect(await rendererErrors(browser)).toEqual([]);
	});

	desktop('releases the Konva global on disable, and a re-enable logs no duplicate instance', async ({ native: { browser, page, ui } }) => {
		await collectRendererErrors(browser);
		await seedSampleProject(browser, ui);
		// The global has to be there first, or its absence below proves nothing.
		expect(await konvaType(browser)).not.toBe('undefined');

		await page.disablePlugin(PLUGIN_ID);
		expect(await konvaType(browser)).toBe('undefined');

		// Re-seed nothing: Konva's module scope runs on load, which is where the duplicate check lives.
		await page.enablePlugin(PLUGIN_ID);
		expect(await konvaType(browser)).not.toBe('undefined');
		expect(await collecting(browser)).toBe(true);
		expect((await rendererErrors(browser)).filter((line) => line.includes('Several Konva instances'))).toEqual([]);
	});

	// Empty States step 4. `PlanEditorRoot.vue`'s `overlay` computed returns `null` for the
	// `noBackground` key while `projectStore.zones.size > 0`, and its template draws either
	// `FloorStart` (root `.rp-floor-start`) or `EmptyState` (root `.rp-empty-state`) from it —
	// nothing else under `src/presentation/editor/` draws either class.
	desktop('draws the seeded plan\'s five zones with no overlay over them', async ({ native: { browser, ui, directory } }) => {
		await seedSampleProject(browser, ui);
		const zoneIds = Object.values(await ui.notesOfType('renovation-zone'))
			.map((zone) => String(zone.id))
			.toSorted();
		expect(zoneIds).toHaveLength(5);
		// The plan's wording is "five nodes named `zone`", but `zone` names the LAYER (one node);
		// its five children are the zones, each named by its id — so that is what is compared.
		await expect.poll(() => drawnZones(browser)).toEqual(zoneIds);

		const editor = browser.$(EDITOR);
		expect(await editor.$('.rp-floor-start').isExisting()).toBe(false);
		expect(await editor.$('.rp-empty-state').isExisting()).toBe(false);
		await browser.saveScreenshot(path.join(directory, 'empty-states-step-4.png'));
	});
});
