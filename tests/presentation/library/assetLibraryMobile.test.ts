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

async function openLibrary(entries: readonly (typeof ENTRY)[], overrides: Partial<AssetLibraryDeps>, selected = '') {
	const view = makeAssetLibraryView(defaultAssetLibraryDeps({ queries: queriesOver(entries), ...overrides }));
	openViews.push(view);
	document.body.append(view.containerEl);
	await view.setState({ assetId: selected, expanded: ['material'] }, { history: false });
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
 * the designer launch before a draft exists, the definition save, the delete, then the create.
 */
async function driveEveryWrite(wrapper: DOMWrapper<Element>): Promise<void> {
	await press(wrapper, '.rp-al-action--designer');
	const supplier = wrapper.get<HTMLInputElement>('[data-field="supplier"]');
	supplier.element.value = 'Northern timber supplier';
	supplier.element.dispatchEvent(new Event('input', { bubbles: true }));
	wrapper.get('.rp-al-definition').element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
	await settle();
	await press(wrapper, '.rp-al-action--delete');
	await press(wrapper, '.rp-al-create');
	const form = wrapper.find('.rp-dialog form');
	if (!form.exists()) return;
	await form.get('[data-field="name"]').setValue('Kitchen island');
	await form.get('[data-field="unitCostAmount"]').setValue('450.00');
	await form.get('[data-field="width"]').setValue('1200');
	await form.get('[data-field="depth"]').setValue('800');
	await form.trigger('submit');
	await settle();
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
	'.rp-al-definition [data-field]',
	'.rp-al-definition button[type="submit"]',
];

describe('the Asset library on mobile', () => {
	it('reaches no command and no designer from any write gesture, and says why at each control', async () => {
		Platform.isMobile = true;
		const { commands, spies } = spiedCommands();
		const openDesigner = vi.fn<(assetId: AssetId) => Promise<void>>(() => Promise.resolve());
		const { wrapper } = await openLibrary([ENTRY], { commands, openDesigner }, ENTRY.assetId);

		await driveEveryWrite(wrapper);

		expect(reached(spies)).toEqual([]);
		expect(openDesigner).not.toHaveBeenCalled();
		expectRefusedWithReason(wrapper, WRITE_CONTROLS);
		// Still READABLE: the row, the inspector's name and the search field stay live.
		expect(wrapper.get(`[data-asset-id="${ENTRY.assetId}"]`).text()).toContain(ENTRY.name);
		expect(wrapper.get('.rp-al-inspector__name').text()).toBe(ENTRY.name);
		expect(wrapper.get<HTMLInputElement>('.rp-al-search__input').element.disabled).toBe(false);
		expect(wrapper.findAll('.rp-mobile-notice')).toHaveLength(1);
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

		await driveEveryWrite(wrapper);

		expect(openDesigner).toHaveBeenCalledWith(ENTRY.assetId);
		expect(reached(spies)).toEqual([
			'createAsset.execute',
			'deleteAsset.execute',
			'setAssetFootprintFromDimensions.execute',
			'updateAsset.execute',
		]);
		expect(wrapper.find('.rp-mobile-notice').exists()).toBe(false);
	});

	it("reaches the dialog from the empty catalogue's New asset action", async () => {
		Platform.isMobile = false;
		const { commands } = spiedCommands();
		const { wrapper } = await openLibrary([], { commands });

		await press(wrapper, '.rp-empty-state__action');

		expect(wrapper.find('.rp-dialog form').exists()).toBe(true);
	});
});
