/**
 * @vitest-environment jsdom
 *
 * L-43: on a mobile device the Asset library stays READABLE and refuses every write, with the
 * read-only sentence as each refused control's description (requirement extension 4a of
 * `docs/requirements/Bound the mobile surface to what it can actually do.md`).
 *
 * Mounts the real `AssetLibraryView`, so `Platform.isMobile` is read where production reads it.
 * The command spies are enumerated over the bundle's own keys, so a command added to
 * `AssetLibraryCommandServices` later is spied here without an edit. The desktop case drives the
 * same gestures and must reach the commands, because a driver that reaches nothing passes the
 * mobile case for free.
 *
 * **`main`'s AD13 cases live here too, turned round.** AD13 criterion 6 refused the whole library on
 * mobile; owner ruling 66 (2026-10-01) kept L-43's read-only library when the two branches met. Each
 * of the four AD13 cases still had a true subject — which sentence a phone reads, what mounts, what a
 * desktop draws, what a reopened leaf carries — so each asserts the read-only answer now rather than
 * being deleted. They are the last describe in this file.
 */
import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { DOMWrapper } from '@vue/test-utils';
import { Platform } from 'obsidian';
import { ok } from '../../../src/core/result/Result';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import type { AssetLibraryView } from '../../../src/presentation/library/AssetLibraryView';
import {
	unavailableAssetLibraryCommands,
	type AssetLibraryCommandServices,
	type AssetLibraryDeps,
} from '../../../src/presentation/library/AssetLibraryDeps';
import type { AssetLibraryQueryServices } from '../../../src/presentation/read-models/assetLibraryQueries';
import { tr } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';
import { makeAsset } from '../../helpers/entities';
import { anEntry } from '../../helpers/assetLibraryRootHarness';
import { defaultAssetLibraryDeps, makeAssetLibraryView } from '../../helpers/makeAssetLibraryView';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/async';

installObsidianDom();

const originalMobile = Platform.isMobile;
const openViews: AssetLibraryView[] = [];
afterEach(async () => {
	for (const view of openViews.splice(0)) await view.onClose();
	Platform.isMobile = originalMobile;
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

const ENTRY = anEntry();
const CREATED = makeAsset();

function queriesOver(entries: readonly (typeof ENTRY)[]): AssetLibraryQueryServices {
	return {
		listCatalogue: () => Promise.resolve(ok({ entries, unreadable: [] })),
		listOutlines: (ids) => Promise.resolve(new Map(ids.map((id) => [id, { kind: 'none' as const }]))),
		getDesign: (assetId) => Promise.resolve(ok(assetDesign({ assetId }))),
		listReferencing: () => Promise.resolve(ok([])),
		listOverridingProjects: () => Promise.resolve(ok([])),
		listReassignmentTargets: () => Promise.resolve(ok([])),
		listPlansUsingAsset: () => Promise.resolve(ok({ plans: [], unreadable: 0 })),
	};
}

/** The reachable doors answer success; every door of every member is then spied, by key. */
function spiedCommands() {
	const commands: AssetLibraryCommandServices = {
		...unavailableAssetLibraryCommands(),
		updateAsset: { execute: () => Promise.resolve(ok(makeAsset({ id: ENTRY.assetId }))) },
		deleteAsset: {
			execute: () => Promise.resolve(ok({ deletedId: ENTRY.assetId, affectedBefore: [], affectedAfter: [] })),
		},
		createAsset: { execute: () => Promise.resolve(ok(CREATED)) },
		setAssetFootprintFromDimensions: { execute: () => Promise.resolve(ok('wrote' as const)) },
	};
	const spies = new Map<string, MockInstance>();
	for (const [key, member] of Object.entries(commands) as [string, unknown][]) {
		if (typeof member !== 'object' || member === null) continue;
		const doors = member as Record<string, (...args: unknown[]) => unknown>;
		for (const door of Object.keys(doors)) spies.set(`${key}.${door}`, vi.spyOn(doors, door));
	}
	expect(spies.size).toBeGreaterThanOrEqual(5);
	return { commands, spies };
}

function reached(spies: ReadonlyMap<string, MockInstance>): string[] {
	return [...spies].filter(([, spy]) => spy.mock.calls.length > 0).map(([name]) => name).toSorted();
}

async function openLibrary(
	entries: readonly (typeof ENTRY)[],
	overrides: Partial<AssetLibraryDeps>,
	selected = '',
	layout: 'list' | 'grid' = 'list',
) {
	const view = makeAssetLibraryView(defaultAssetLibraryDeps({ queries: queriesOver(entries), ...overrides }));
	openViews.push(view);
	document.body.append(view.containerEl);
	await view.setState({ assetId: selected, expanded: ['material'], layout }, { history: false });
	await view.onOpen();
	await settle();
	return { view, wrapper: new DOMWrapper(view.contentEl) };
}

/** A click dispatched on the element itself, so a handler behind a disabled look is still asked. */
async function press(wrapper: DOMWrapper<Element>, selector: string): Promise<void> {
	wrapper.get(selector).element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	await settle();
}

/**
 * Every write gesture the census found, in the order a desktop session can complete them all:
 * Duplicate's panel opened (a write only once confirmed, so nothing is confirmed here), the designer
 * launch before a draft exists, the definition save, the delete, then the create. Answers how many
 * Duplicate panels the press opened, counted before the later gestures move the selection.
 */
async function driveEveryWrite(wrapper: DOMWrapper<Element>): Promise<number> {
	await press(wrapper, '[data-action="duplicate-open"]');
	const duplicatePanels = wrapper.findAll('[data-field="duplicate-name"]').length;
	await press(wrapper, '.rp-al-action--designer');
	const supplier = wrapper.get<HTMLInputElement>('[data-field="supplier"]');
	supplier.element.value = 'Northern timber supplier';
	supplier.element.dispatchEvent(new Event('input', { bubbles: true }));
	wrapper.get('.rp-al-definition').element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
	await settle();
	await press(wrapper, '.rp-al-action--delete');
	await press(wrapper, '.rp-al-create');
	const form = wrapper.find('.rp-dialog form');
	if (!form.exists()) return duplicatePanels;
	await form.get('[data-field="name"]').setValue('Kitchen island');
	await form.get('[data-field="unitCostAmount"]').setValue('450.00');
	await form.get('[data-field="width"]').setValue('1200');
	await form.get('[data-field="depth"]').setValue('800');
	await form.trigger('submit');
	await settle();
	return duplicatePanels;
}

/** Refused: `disabled`, `aria-disabled`, or a read-only text field — the three spellings here. */
function refused(element: Element): boolean {
	if (element.getAttribute('aria-disabled') === 'true') return true;
	if (element instanceof HTMLInputElement) return element.readOnly || element.disabled;
	return (element as HTMLButtonElement | HTMLSelectElement).disabled;
}

/** Whether one of the control's `aria-describedby` ids names the read-only sentence. */
function describedByReadOnly(element: Element): boolean {
	const ids = (element.getAttribute('aria-describedby') ?? '').split(' ').filter((id) => id !== '');
	return ids.some((id) => document.getElementById(id)?.textContent.trim() === tr('view.mobile.read-only'));
}

/** One row per matched control, so a failure names the selector and which half is missing. */
function expectRefusedWithReason(wrapper: DOMWrapper<Element>, selectors: readonly string[]): void {
	const rows = selectors.flatMap((selector) => {
		const controls = wrapper.findAll(selector);
		if (controls.length === 0) return [{ selector, refused: false, described: false }];
		return controls.map((control) => ({
			selector,
			refused: refused(control.element),
			described: describedByReadOnly(control.element),
		}));
	});
	expect(rows).toEqual(rows.map(({ selector }) => ({ selector, refused: true, described: true })));
}

const WRITE_CONTROLS = [
	'.rp-al-create',
	'.rp-al-action--designer',
	'.rp-al-action--delete',
	// AD13's Duplicate, from `main` — a write, so L-43's every-write rule reaches it too.
	'[data-action="duplicate-open"]',
	'.rp-al-definition [data-field]',
	'.rp-al-definition button[type="submit"]',
];

describe('the Asset library on mobile', () => {
	it('reaches no command and no designer from any write gesture, and says why at each control', async () => {
		Platform.isMobile = true;
		const { commands, spies } = spiedCommands();
		const openDesigner = vi.fn<(assetId: AssetId) => Promise<void>>(() => Promise.resolve());
		const { wrapper } = await openLibrary([ENTRY], { commands, openDesigner }, ENTRY.assetId);

		const duplicatePanels = await driveEveryWrite(wrapper);

		expect(reached(spies)).toEqual([]);
		expect(openDesigner).not.toHaveBeenCalled();
		expect(duplicatePanels).toBe(0);
		expectRefusedWithReason(wrapper, WRITE_CONTROLS);
		// Still READABLE: the row, the inspector's name and the search field stay live.
		expect(wrapper.get(`[data-asset-id="${ENTRY.assetId}"]`).text()).toContain(ENTRY.name);
		expect(wrapper.get('.rp-al-inspector__name').text()).toBe(ENTRY.name);
		expect(wrapper.get<HTMLInputElement>('.rp-al-search__input').element.disabled).toBe(false);
		expect(wrapper.findAll('[data-rp-notice="mobile-read-only"]')).toHaveLength(1);
	});

	// AD18-R18's Grid ends in a `Create your own` card, a second New asset door the List never draws.
	it("refuses the Grid card's New asset too, with the same reason", async () => {
		Platform.isMobile = true;
		const { commands, spies } = spiedCommands();
		const { wrapper } = await openLibrary([ENTRY], { commands }, ENTRY.assetId, 'grid');

		await press(wrapper, '.rp-al-create-card__action');
		await driveEveryWrite(wrapper);

		expect(wrapper.find('.rp-dialog').exists()).toBe(false);
		expect(reached(spies)).toEqual([]);
		expectRefusedWithReason(wrapper, [...WRITE_CONTROLS, '.rp-al-create-card__action']);
	});

	// No selection, so no draft: a dirty draft's own leave prompt would otherwise stand in front
	// of the toolbar's refusal and pass this case without it.
	it("refuses both New asset doors of an empty catalogue with the same reason", async () => {
		Platform.isMobile = true;
		const { commands, spies } = spiedCommands();
		const { wrapper } = await openLibrary([], { commands });

		await press(wrapper, '.rp-empty-state__action');
		await press(wrapper, '.rp-al-create');

		expect(wrapper.find('.rp-dialog').exists()).toBe(false);
		expect(reached(spies)).toEqual([]);
		expectRefusedWithReason(wrapper, ['.rp-empty-state__action', '.rp-al-create']);
	});

	it('stays read-only across a rebind, which remounts the tree', async () => {
		Platform.isMobile = true;
		const { commands, spies } = spiedCommands();
		const { view, wrapper } = await openLibrary([ENTRY], { commands }, ENTRY.assetId);

		view.rebind(defaultAssetLibraryDeps({ queries: queriesOver([ENTRY]), commands }));
		await settle();
		await driveEveryWrite(wrapper);

		expect(reached(spies)).toEqual([]);
		expectRefusedWithReason(wrapper, WRITE_CONTROLS);
	});
});

describe('the same gestures on desktop', () => {
	it('reach the commands and the designer, and draw no read-only notice', async () => {
		Platform.isMobile = false;
		const { commands, spies } = spiedCommands();
		const openDesigner = vi.fn<(assetId: AssetId) => Promise<void>>(() => Promise.resolve());
		const { wrapper } = await openLibrary([ENTRY], { commands, openDesigner }, ENTRY.assetId);

		const duplicatePanels = await driveEveryWrite(wrapper);

		expect(duplicatePanels).toBe(1);
		expect(openDesigner).toHaveBeenCalledWith(ENTRY.assetId);
		expect(reached(spies)).toEqual([
			'createAsset.execute',
			'deleteAsset.execute',
			'setAssetFootprintFromDimensions.execute',
			'updateAsset.execute',
		]);
		expect(wrapper.find('[data-rp-notice="mobile-read-only"]').exists()).toBe(false);
	});

	it("reaches the dialog from the empty catalogue's New asset action", async () => {
		Platform.isMobile = false;
		const { commands } = spiedCommands();
		const { wrapper } = await openLibrary([], { commands });

		await press(wrapper, '.rp-empty-state__action');

		expect(wrapper.find('.rp-dialog form').exists()).toBe(true);
	});
});

/**
 * `main`'s four AD13 cases, each kept on its own subject and asserting L-43's answer (owner ruling
 * 66). The first three were the refusal's own sentence, its "mounted nothing" and its desktop arm;
 * the fourth reopened one view off mobile, where `contentEl` is the SAME element both times.
 */
const notice = (wrapper: DOMWrapper<Element>) => wrapper.findAll('[data-rp-notice="mobile-read-only"]').map((element) => element.text());
const desktopOnly = (wrapper: DOMWrapper<Element>) => wrapper.findAll('.rp-view-message').some((element) => element.text() === tr('view.mobile.desktop-only'));

describe('the view the library draws on each device, after ruling 66', () => {
	it('says read-only once on mobile, in the sentence the project view shares, and never desktop-only', async () => {
		Platform.isMobile = true;
		const { wrapper } = await openLibrary([ENTRY], {});

		expect(notice(wrapper)).toEqual([tr('view.mobile.read-only')]);
		expect(desktopOnly(wrapper)).toBe(false);
	});

	it('mounts the catalogue behind the read-only notice on mobile', async () => {
		Platform.isMobile = true;
		const { wrapper } = await openLibrary([ENTRY], {});

		expect(wrapper.find('.renovation-asset-library').exists()).toBe(true);
		expect(wrapper.get(`[data-asset-id="${ENTRY.assetId}"]`).text()).toContain(ENTRY.name);
	});

	it('draws the catalogue on a desktop with neither the notice nor a refusal', async () => {
		const { wrapper } = await openLibrary([ENTRY], {});

		expect(notice(wrapper)).toEqual([]);
		expect(desktopOnly(wrapper)).toBe(false);
		expect(wrapper.find('.renovation-asset-library').exists()).toBe(true);
	});

	it('drops the read-only notice when the same view is reopened off mobile', async () => {
		Platform.isMobile = true;
		const { view, wrapper } = await openLibrary([ENTRY], {});
		expect(notice(wrapper)).toHaveLength(1);
		await view.onClose();

		Platform.isMobile = false;
		await view.onOpen();
		await settle();

		expect(notice(wrapper)).toEqual([]);
		expect(wrapper.find('.renovation-asset-library').exists()).toBe(true);
	});
});
