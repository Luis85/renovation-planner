import { describe, expect } from 'vitest';
import { en } from '../../src/presentation/i18n/locales/en';
import { test } from './fixture';
import { logEvidence } from './diagnostics';
import { DESIGNER, LIBRARY, PLAN_EDITOR, type ObsidianPage } from './designer';
import type { PlannerPage } from './helpers';
import { openCatalogue } from './library';
import { collectRendererErrors, rendererErrors, seedProjectWithPlan } from './planner';
import { mobileEmulation, PLUGIN_ID, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Read projects on mobile.md` steps 1, 2, 4, 5, 6, 7 and 8, and the Asset
 * library's read-only guard (tracker L-43, owner ruling 66), on the `mobile-emulation` leg:
 * DESKTOP Obsidian emulating a phone, which is NOT a device test — the case's own Runs table
 * still waits on a device. The desktop legs skip every case here.
 *
 * Step 3 (a screen reader announcing the reason) is not drivable; what IS checked, at every
 * refused control, is that its `aria-describedby` resolves in the real DOM to the read-only
 * sentence — the attribute half, never the announcement.
 *
 * **The seed is the risk, so it proves itself.** Creation is refused on mobile by design, so the
 * vault is seeded on a DESKTOP boot: `localStorage.EmulateMobile` (the key the service seeds,
 * wdio-obsidian-service 3.2.1, `electronSetupConfigDir`) is removed and Obsidian restarted over the
 * same profile, the projects are made through the real forms, and the key is set back before a
 * second restart. `Platform.isMobile` is asserted — and logged — after EACH restart, so a host that
 * ignored the key fails there rather than letting the read-only checks run on a desktop.
 *
 * Copy is read from the `en` locale module. Written from source and not yet run when committed:
 * CI's E2E workflow is its first run.
 */
const mobile = mobileEmulation ? test : test.skip;

const READ_ONLY = en['view.mobile.read-only'];
const DESKTOP_ONLY = en['view.mobile.desktop-only'];
const PROJECTS = '.rp-project-list__group--projects';
const FLAT_ROW = '.rp-project-row*=Flat';
/** `openCatalogue`'s first asset, and the one this project prices for itself. */
const SOFA = { id: 'asset-e2e-0', name: 'Sofa', catalogue: '10.00 EUR', own: '7.50 EUR' };

/** What a seeded project row reads: its name laid out, its plan count, a fresh project's status, its currency. */
const fact = (name: string, plans: string | null) => ({ name, shown: true, plans, status: en['form.new-project.status.idea'], currency: 'EUR' });

interface Seeded {
	flatNote: string;
	planId: string;
}

/** `Platform.isMobile` as this boot of Obsidian answers it. */
const isMobile = (browser: NativeBrowser): Promise<boolean> => browser.executeObsidian(({ obsidian }) => obsidian.Platform.isMobile);

/** Restart Obsidian over the same profile with the emulation key on or off, answering what the new boot reports. */
async function restart(browser: NativeBrowser, emulate: boolean): Promise<boolean> {
	await browser.execute((on: boolean) => {
		if (on) window.localStorage.setItem('EmulateMobile', '1');
		else window.localStorage.removeItem('EmulateMobile');
	}, emulate);
	await browser.reloadObsidian();
	return isMobile(browser);
}

/**
 * Two projects — Flat with the plan Ground floor, and Loft with none — through the real forms on
 * a desktop boot, `openCatalogue`'s six assets, and Flat's own price for the Sofa written as the
 * note the price row would write. Then back to a mobile boot.
 */
async function seedOnDesktop(browser: NativeBrowser, page: ObsidianPage, ui: PlannerPage, directory: string): Promise<Seeded> {
	const atStart = await isMobile(browser);
	const desktop = await restart(browser, false);
	await logEvidence(directory, 'platform-desktop-boot', { atStart, desktop });
	expect(desktop, 'Obsidian restarted with EmulateMobile removed and still reports Platform.isMobile').toBe(false);
	await browser.executeObsidian(({ app }) => {
		app.workspace.leftSplit.collapse();
		app.workspace.rightSplit.collapse();
	});
	await seedProjectWithPlan(ui);
	await ui.projectView().$('.rp-project-detail__back').click();
	await ui.projectView().$('.rp-project-list__create').click();
	await ui.submitForm('Loft');
	await expect.poll(async () => Object.values(await ui.notesOfType('renovation-project')).map((note) => String(note.name)).toSorted()).toEqual(['Flat', 'Loft']);
	await openCatalogue(browser, page, ui);

	const [flatNote, flat] = Object.entries(await ui.notesOfType('renovation-project')).find(([, note]) => note.name === 'Flat') ?? [];
	expect(flat, 'the Flat project note is not indexed').toMatchObject({ currency: 'EUR' });
	const [plan] = Object.values(await ui.notesOfType('renovation-plan'));
	expect(plan, 'the Ground floor plan note is not indexed').toMatchObject({ name: 'Ground floor' });
	await browser.executeObsidian(
		async ({ app }, path, projectId, assetId) => {
			const lines = ['type: renovation-asset-price', 'schema-version: 1', 'id: assetprice-e2e-sofa', 'revision: 1', `project: ${projectId}`, `asset: ${assetId}`, 'unit-cost: "7.50"', 'currency: EUR'];
			await app.vault.create(path.replace(/[^/]+$/u, 'Sofa price.md'), `---\n${lines.join('\n')}\n---\n`);
		},
		String(flatNote),
		String(flat?.id),
		SOFA.id,
	);
	await expect.poll(async () => Object.keys(await ui.notesOfType('renovation-asset-price')).length).toBe(1);

	const phone = await restart(browser, true);
	await logEvidence(directory, 'platform-mobile-boot', { phone });
	expect(phone, 'Obsidian restarted with EmulateMobile=1 and does not report Platform.isMobile').toBe(true);
	return { flatNote: String(flatNote), planId: String(plan?.id) };
}

interface Control {
	selector: string;
	found: boolean;
	refused: boolean;
	described: boolean;
}

/**
 * Every control in the active leaf matching each selector: refused (`disabled`, `aria-disabled` or
 * read-only) and described by an element whose text is the read-only sentence. A selector matching
 * nothing answers one `found: false` row, so neither expectation below can pass by reaching nothing.
 */
const controls = (browser: NativeBrowser, selectors: readonly string[]): Promise<Control[]> =>
	browser.execute(
		(list: string[], sentence: string) =>
			list.flatMap((selector): Control[] => {
				const matched = [...document.querySelectorAll(`.workspace-leaf.mod-active ${selector}`)];
				if (matched.length === 0) return [{ selector, found: false, refused: false, described: false }];
				return matched.map((el) => ({
					selector,
					found: true,
					refused: el.getAttribute('aria-disabled') === 'true' || (el as HTMLButtonElement).disabled === true || (el as HTMLInputElement).readOnly === true,
					described: (el.getAttribute('aria-describedby') ?? '').split(' ').some((id) => id !== '' && document.getElementById(id)?.textContent.trim() === sentence),
				}));
			}),
		[...selectors],
		READ_ONLY,
	);

/** Drawn, disabled and pointing at the read-only sentence — the triple, every match of every selector. */
async function expectRefused(browser: NativeBrowser, selectors: readonly string[]): Promise<void> {
	const rows = await controls(browser, selectors);
	expect(rows.length).toBeGreaterThanOrEqual(selectors.length);
	expect(rows).toEqual(rows.map(({ selector }) => ({ selector, found: true, refused: true, described: true })));
}

/** Drawn and live: a control that reads, which a read-only surface is entitled to keep. */
async function expectLive(browser: NativeBrowser, selectors: readonly string[]): Promise<void> {
	const rows = await controls(browser, selectors);
	expect(rows).toEqual(selectors.map((selector) => ({ selector, found: true, refused: false, described: false })));
}

/** The text of every `.rp-view-notice` in the active leaf — the mobile notice carries that class too. */
const notices = (browser: NativeBrowser): Promise<string[]> =>
	browser.execute(() => [...document.querySelectorAll('.workspace-leaf.mod-active .rp-view-notice')].map((notice) => notice.textContent.trim()));

/** The project view, polled until the seeded list draws, and the Flat row pressed into its detail state. */
async function openFlat(ui: PlannerPage): Promise<void> {
	await ui.openProjectView();
	const row = () => ui.projectView().$(PROJECTS).$(FLAT_ROW);
	await expect.poll(() => row().isDisplayed()).toBe(true);
	await row().click();
	await expect.poll(() => ui.projectView().$('.rp-project-detail__name').getText()).toBe('Flat');
}

/** A refused canvas leaf's whole content: what it holds, the sentences it says, the canvases it drew. */
const surface = (browser: NativeBrowser, type: string) =>
	browser.execute((viewType: string) => {
		const content = document.querySelector(`.workspace-leaf-content[data-type="${viewType}"] > .view-content`);
		if (content === null) return null;
		return {
			children: content.children.length,
			messages: [...content.querySelectorAll('.rp-view-message')].map((message) => message.textContent.trim()),
			canvases: content.querySelectorAll('canvas').length,
		};
	}, type);

describe('Read projects on mobile, under desktop mobile emulation (NOT a device)', () => {
	// Steps 1 and 2: the list readable under ONE notice; its three writes refused, its two reads live.
	mobile('draws the list under one notice, refusing New project, New asset and Create but not Assets or Clear search', async ({ native: { browser, page, ui, directory } }) => {
		await seedOnDesktop(browser, page, ui, directory);
		await ui.openProjectView();
		await expect.poll(() => ui.projectView().$(PROJECTS).$(FLAT_ROW).isDisplayed()).toBe(true);
		expect(await notices(browser)).toEqual([READ_ONLY]);
		// "Above everything else": the notice is the view root's first child, before either state.
		expect(await browser.execute(() => document.querySelector('.workspace-leaf.mod-active .renovation-planner-view')?.firstElementChild?.className ?? '')).toContain('rp-mobile-notice');

		const rows = await browser.execute((group: string) =>
			[...document.querySelectorAll(`.workspace-leaf.mod-active ${group} .rp-project-row`)].map((row) => {
				const name = row.querySelector('.rp-project-list__name');
				const box = name?.getBoundingClientRect();
				return {
					name: name?.textContent.trim() ?? '',
					shown: box !== undefined && box.width > 0 && box.height > 0,
					plans: row.querySelector('.rp-project-row__plans')?.textContent.trim() ?? null,
					status: row.querySelector('.rp-project-row__status')?.textContent.trim() ?? '',
					currency: row.querySelector('.rp-project-row__currency')?.textContent.trim() ?? '',
				};
			}), PROJECTS);
		await logEvidence(directory, 'mobile-list-rows', rows);
		expect(rows.toSorted((a, b) => a.name.localeCompare(b.name))).toEqual([fact('Flat', en['view.project.plans-one']), fact('Loft', null)]);

		await expectRefused(browser, ['.rp-project-list__create', '.rp-view-aside__create-asset']);
		await expectLive(browser, ['.rp-project-list__open-library']);
		await ui.projectView().$('.rp-project-filter__input').setValue('nothing matches this');
		await expect.poll(() => ui.projectView().$('.rp-project-list__no-match').isDisplayed()).toBe(true);
		await expectRefused(browser, ['.rp-project-list__create-named']);
		await expectLive(browser, ['.rp-project-list__clear-filter']);
		// Both reads do what they say: Clear search brings the rows back, Assets opens the library.
		await ui.projectView().$('.rp-project-list__clear-filter').click();
		await expect.poll(() => ui.projectView().$(PROJECTS).$(FLAT_ROW).isDisplayed()).toBe(true);
		await ui.projectView().$('.rp-project-list__open-library').click();
		await expect.poll(() => ui.leafCount(LIBRARY)).toBe(1);
	});

	// Step 4: a row navigates; inside, the plan's writes are refused and every read still works.
	mobile('navigates into a project whose plan controls are refused while Open note, Schedule, Quotes and back work', async ({ native: { browser, page, ui, directory } }) => {
		const { flatNote } = await seedOnDesktop(browser, page, ui, directory);
		await openFlat(ui);
		expect(await notices(browser)).toEqual([READ_ONLY]);
		// The first entry card on a project with a plan is the plan's: the one entry a read-only surface withholds.
		await expectRefused(browser, ['.rp-plan-list__create', '.rp-plan-list__row', '.rp-plan-list__delete', '.rp-project-detail__entry-action--primary']);
		await expectLive(browser, ['.rp-project-detail__back', '.rp-project-detail__open-note', '.rp-project-prices-open']);

		await ui.projectView().$('.rp-project-detail__open-note').click();
		await expect.poll(() => browser.executeObsidian(({ app }) => app.workspace.getLeavesOfType('markdown').map((leaf) => (leaf.view as { file?: { path: string } }).file?.path ?? ''))).toContain(flatNote);
		await ui.activate('renovation-project');

		for (const [label, title] of [[en['schedule.open'], en['schedule.title']], [en['quote.comparison'], en['quote.comparison']]]) {
			await ui.projectView().$(`button=${label}`).click();
			await expect.poll(() => ui.projectView().$('.rp-project-detail__name').getText()).toBe(`Flat · ${title}`);
			expect(await notices(browser)).toEqual([READ_ONLY]);
			await ui.projectView().$('.rp-project-detail__back').click();
			await expect.poll(() => ui.projectView().$('.rp-project-detail__name').getText()).toBe('Flat');
		}

		await ui.projectView().$('.rp-project-detail__back').click();
		await expect.poll(() => ui.projectView().$(PROJECTS).$(FLAT_ROW).isDisplayed()).toBe(true);
		expect(await notices(browser)).toEqual([READ_ONLY]);
	});

	// Step 5: both prices read as text; the editor's invitation and Clear are drawn and refused.
	mobile('reads the catalogue price and the project price, with the price editor and Clear refused', async ({ native: { browser, page, ui, directory } }) => {
		await seedOnDesktop(browser, page, ui, directory);
		await openFlat(ui);
		await ui.projectView().$('.rp-project-prices-open').click();
		const sofa = () =>
			browser.execute((name: string) => {
				const row = [...document.querySelectorAll('.workspace-leaf.mod-active .rp-asset-price-row')].find((item) => item.querySelector('.rp-asset-price-name')?.textContent.trim() === name);
				const text = (selector: string) => row?.querySelector(selector)?.textContent.trim() ?? null;
				return row === undefined ? null : {
					catalogue: text('.rp-asset-price-catalogue .rp-asset-price-value'),
					own: text('.rp-asset-price-yours .rp-asset-price-value'),
					used: text('.rp-asset-price-used .rp-asset-price-value'),
					editors: row.querySelectorAll('.rp-asset-price-input, .rp-asset-price-apply, .rp-asset-price-cancel').length,
				};
			}, SOFA.name);
		const reading = { catalogue: SOFA.catalogue, own: SOFA.own, used: SOFA.own, editors: 0 };
		await expect.poll(sofa).toEqual(reading);
		expect(await browser.$$('.workspace-leaf.mod-active .rp-asset-price-row').length).toBe(6);
		// Every row's edit invitation (P04 moved the refusal off the field and onto it) and the Sofa's Clear.
		await expectRefused(browser, ['.rp-asset-price-edit', '.rp-asset-price-clear']);

		// A real tap on the refused invitation: no field, no Apply and no Cancel may appear.
		const edit = ui.projectView().$(`.//li[contains(@class, "rp-asset-price-row")][.//*[contains(@class, "rp-asset-price-name") and normalize-space(.)="${SOFA.name}"]]//button[contains(@class, "rp-asset-price-edit")]`);
		await edit.click();
		await browser.pause(300);
		expect(await sofa()).toEqual(reading);
	});

	// Step 6: the five writing commands are out of the palette, `Open renovation project` is in it.
	// A refused Plan Editor leaf holding a plan id is ACTIVE while the palette is read, because that
	// is the one state in which `set-plan-background` would otherwise answer true.
	mobile('lists Open renovation project in the palette and none of the five commands that write or draw', async ({ native: { browser, ui, directory } }) => {
		await browser.executeObsidian(async ({ app }, type) => {
			await app.workspace.getLeaf('tab').setViewState({ type, active: true, state: { planId: 'plan-from-a-desktop-session' } });
		}, PLAN_EDITOR);
		await ui.activate(PLAN_EDITOR);
		const ids = ['open-plan-editor', 'set-plan-background', 'open-asset-designer', 'new-project', 'create-sample-project', 'open-project'];
		const commands = await browser.executeObsidian(
			({ app }, plugin, wanted) => {
				const all = (app as unknown as { commands: { commands: Record<string, { name: string; checkCallback?: (checking: boolean) => boolean | undefined } | undefined> } }).commands.commands;
				return wanted.map((id) => ({ name: all[`${plugin}:${id}`]?.name ?? null, offered: all[`${plugin}:${id}`]?.checkCallback?.(true) ?? true }));
			},
			PLUGIN_ID,
			ids,
		);
		expect(commands.map(({ name }) => typeof name)).toEqual(ids.map(() => 'string'));
		expect(commands.map(({ offered }) => offered)).toEqual([false, false, false, false, false, true]);

		await browser.executeObsidianCommand('command-palette:open');
		await browser.$('.prompt-input').setValue('Renovation');
		const listed = () =>
			browser.execute(() => [...document.querySelectorAll('.prompt .suggestion-item')].map((item) => (item.querySelector('.suggestion-title') ?? item).textContent.trim()));
		await expect.poll(listed).toContain(commands[5].name);
		const shown = await listed();
		await logEvidence(directory, 'mobile-palette', shown);
		expect(commands.slice(0, 5).filter(({ name }) => name !== null && shown.includes(name))).toEqual([]);
		await browser.keys('Escape');
	});

	// Steps 7 and 8: a Plan Editor and an Asset Designer leaf on a REAL plan and asset each draw the
	// one sentence and nothing else, across a switch away and back, and close without a fault.
	mobile('refuses a Plan Editor and an Asset Designer leaf with one sentence, and closes both cleanly', async ({ native: { browser, page, ui, directory } }) => {
		const { planId } = await seedOnDesktop(browser, page, ui, directory);
		await ui.openProjectView();
		await browser.executeObsidian(
			async ({ app }, editor, plan, designer, asset) => {
				await app.workspace.getLeaf('tab').setViewState({ type: editor, state: { planId: plan } });
				await app.workspace.getLeaf('tab').setViewState({ type: designer, state: { assetId: asset } });
			},
			PLAN_EDITOR,
			planId,
			DESIGNER,
			SOFA.id,
		);
		const refused = { children: 1, messages: [DESKTOP_ONLY], canvases: 0 };
		for (const round of ['first', 'after switching away']) {
			for (const type of [PLAN_EDITOR, DESIGNER]) {
				await ui.activate(type);
				await expect.poll(() => surface(browser, type), { message: `${type}, ${round}` }).toEqual(refused);
			}
			await ui.activate('renovation-project');
		}

		await collectRendererErrors(browser);
		expect(await browser.executeObsidian(({ app }, types) => types.map((type) => app.workspace.getLeavesOfType(type).length), [PLAN_EDITOR, DESIGNER])).toEqual([1, 1]);
		await browser.executeObsidian(({ app }, types) => {
			for (const type of types) for (const leaf of app.workspace.getLeavesOfType(type)) leaf.detach();
		}, [PLAN_EDITOR, DESIGNER]);
		await expect.poll(() => browser.executeObsidian(({ app }, types) => types.map((type) => app.workspace.getLeavesOfType(type).length), [PLAN_EDITOR, DESIGNER])).toEqual([0, 0]);
		expect(await Promise.all([surface(browser, PLAN_EDITOR), surface(browser, DESIGNER)])).toEqual([null, null]);
		await browser.pause(500);
		expect(await rendererErrors(browser)).toEqual([]);
	});

	// L-43 (owner ruling 66): the library draws and searches; every write is drawn, refused and says why.
	mobile('opens the asset library read-only: search and selection live, every write refused with the reason', async ({ native: { browser, page, ui } }) => {
		const lib = await openCatalogue(browser, page, ui, { layout: 'Grid' });
		const notice = () => browser.execute(() => [...document.querySelectorAll('.workspace-leaf.mod-active [data-rp-notice="mobile-read-only"]')].map((el) => el.textContent.trim()));
		expect(await notice()).toEqual([READ_ONLY]);

		await lib.search('plank');
		await expect.poll(() => lib.tile('Alder plank').isDisplayed()).toBe(true);
		expect(await lib.tile(SOFA.name).isExisting()).toBe(false);
		await lib.search(SOFA.name);
		await expect.poll(() => lib.tile(SOFA.name).isDisplayed()).toBe(true);
		expect(await lib.tile('Alder plank').isExisting()).toBe(false);
		await lib.tile(SOFA.name).click();
		await expect.poll(() => lib.library().$('.rp-al-inspector__name').getText()).toBe(SOFA.name);

		await expectRefused(browser, [
			'.rp-al-create',
			'.rp-al-action--designer',
			'.rp-al-action--delete',
			'[data-action="duplicate-open"]',
			'.rp-al-definition [data-field]',
			'.rp-al-definition button[type="submit"]',
		]);
		await expectLive(browser, ['.rp-al-search__input']);
		expect(await notice()).toEqual([READ_ONLY]);
	});
});
