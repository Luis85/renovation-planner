/**
 * @vitest-environment jsdom
 *
 * The Asset library's Obsidian lifecycle (§2, ADR-0015's fourth workspace surface): one
 * isolated Vue app for the whole session, mounted once, never remounted for a selection.
 *
 * Mirrors `assetDesignerView.test.ts` and `renovationProjectView.test.ts` for the lifecycle
 * shape shared by every registered view here, and departs from both exactly where §6.3 says
 * this surface departs: there is no "nothing to draw yet" state (the library always has a
 * catalogue to show), and a changed `assetId`/`expanded` must NOT remount the tree.
 *
 * The root renders the selected asset id as a `data-selected-asset-id` ATTRIBUTE rather than as
 * prose (`AssetLibraryRoot.vue`'s own docblock says why — a raw id is not user-facing text this
 * placeholder should ever have shown), so every assertion below that means "the tree still shows
 * this selection" reads the attribute rather than `textContent`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { ASSET_LIBRARY_ICON, ASSET_LIBRARY_VIEW } from '../../../src/presentation/library/AssetLibraryView';
import type { AssetLibraryView } from '../../../src/presentation/library/AssetLibraryView';
import type { AssetLibraryDeps } from '../../../src/presentation/library/AssetLibraryDeps';
import { useAssetLibraryContext } from '../../../src/presentation/library/AssetLibraryContext';
import { t } from '../../../src/presentation/i18n/strings';
import { defaultAssetLibraryDeps, makeAssetLibraryView } from '../../helpers/makeAssetLibraryView';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/async';
import { FakeLeaf } from '../../helpers/workspace';

installObsidianDom();

/**
 * Every view a case opened, closed afterwards — the view mounts a real Vue app with a real
 * Pinia, and a leaf left mounted keeps its effects alive against a detached tree, exactly as
 * `assetDesignerView.test.ts` and `planEditorView.test.ts` already guard.
 */
const openViews: AssetLibraryView[] = [];

function makeView(
	deps: AssetLibraryDeps = defaultAssetLibraryDeps(),
	leaf: FakeLeaf = new FakeLeaf(),
): AssetLibraryView {
	const view = makeAssetLibraryView(deps, leaf);
	openViews.push(view);
	return view;
}

/** The root's own attribute for the selection, read off the DOM rather than off the context. */
function selectedAssetId(view: AssetLibraryView): string | null {
	return view.contentEl.querySelector('.renovation-asset-library')?.getAttribute('data-selected-asset-id') ?? null;
}

/** Its sibling for the expanded set, comma-joined the same way the root renders it. */
function expandedCategories(view: AssetLibraryView): string | null {
	return (
		view.contentEl.querySelector('.rp-asset-library__expanded')?.getAttribute('data-expanded-categories') ?? null
	);
}

afterEach(async () => {
	for (const view of openViews.splice(0)) await view.onClose();
	await settle();
});

describe('what the library tells Obsidian about itself', () => {
	it('answers its persisted type, its icon, and a translated display name', () => {
		const view = makeView();

		expect(view.getViewType()).toBe(ASSET_LIBRARY_VIEW);
		expect(view.getIcon()).toBe(ASSET_LIBRARY_ICON);
		expect(view.getDisplayText()).toBe(t('en', 'view.asset-library.title'));
	});

	/**
	 * The class `styles/chrome.css` keys off. Every other registered view here asserts it, and
	 * without it the leaf chrome Obsidian nests around every view is styled for three surfaces
	 * out of four — nothing in jsdom draws enough to notice on its own.
	 */
	it('adds the container class the leaf chrome is styled through', async () => {
		const view = makeView();

		await view.onOpen();

		expect(view.containerEl.classList.contains('renovation-planner-container')).toBe(true);
	});

	/**
	 * Mounted directly onto `contentEl` with NO wrapper `div` — the brief's own requirement,
	 * for `RenovationProjectView`'s reason: a `contentEl.createDiv(...)` host has `height: auto`
	 * and collapses the pane to a sliver. `contentEl`'s own root element is the component's
	 * root, so the stylesheet's entry point is a DIRECT child of `contentEl`.
	 */
	it('mounts directly onto contentEl with no wrapper element', async () => {
		const view = makeView();

		await view.onOpen();

		expect(view.contentEl.children).toHaveLength(1);
		expect(view.contentEl.firstElementChild?.classList.contains('renovation-asset-library')).toBe(true);
	});
});

describe('the library always has something to draw', () => {
	/**
	 * Unlike the Asset designer or the Plan Editor, there is no "nothing to show yet" state:
	 * the catalogue exists whether or not anything is selected, so `onOpen` mounts even with no
	 * view state at all.
	 */
	it('mounts on open with no state at all', async () => {
		const view = makeView();

		await view.onOpen();

		expect(view.contentEl.querySelector('.renovation-asset-library')).not.toBeNull();
	});

	it('redraws exactly one app when a closed leaf is reopened', async () => {
		const view = makeView();
		await view.onOpen();

		await view.onClose();
		await view.onOpen();

		expect(view.contentEl.querySelectorAll('.renovation-asset-library')).toHaveLength(1);
	});

	/**
	 * The implicit `else` of `onOpen`'s own guard: Obsidian does not promise it calls `onOpen`
	 * only once per mounted lifetime, and a second call while the tree is already up must be a
	 * no-op rather than a second mount stacked on the first.
	 *
	 * **A element COUNT cannot see this**, because `mount()` empties `contentEl` before it
	 * builds — so an unguarded second `mount()` still leaves exactly one
	 * `.renovation-asset-library` node, replacing the first with a second one nobody unmounted,
	 * rather than adding a sibling. Watched failing to discriminate this way before landing on
	 * DOM NODE IDENTITY, the same instrument the in-place and the rebind-remount cases use.
	 */
	it('leaves the mounted tree untouched across two consecutive onOpen calls', async () => {
		const view = makeView();

		await view.onOpen();
		const before = view.contentEl.querySelector('.renovation-asset-library');
		await view.onOpen();

		expect(view.contentEl.querySelector('.renovation-asset-library')).toBe(before);
	});
});

describe('the selection and the expanded set this leaf remembers', () => {
	/**
	 * §6.3's own three-way parse, `projectIdFrom`'s exact shape: a non-object refuses, a
	 * non-string refuses, and `''` is ACCEPTED — the sentinel a restore has to be able to reach,
	 * never confused with a value this build could not parse.
	 */
	it('accepts an empty assetId as the unselected state and refuses a non-string', async () => {
		const view = makeView();
		const result = {} as never;

		await view.setState({ assetId: '' }, result);
		expect(view.getState()).toEqual({ assetId: '', expanded: [] });

		await view.setState({ assetId: 42 }, result);
		expect(view.getState().assetId).toBe('');
	});

	/**
	 * The non-object arm of the same parse, and the reason it earns its own case rather than
	 * being folded into the one above: for every OTHER primitive (a string, a number, a
	 * boolean) the non-string-`assetId` fallback refuses just as gracefully, since indexing an
	 * arbitrary property off a primitive answers `undefined` rather than throwing — so a test
	 * asserting only the REFUSED outcome cannot tell "caught by the object check" from "caught
	 * by the string check" apart; watched failing to discriminate the OBVIOUS way (deleting the
	 * object check outright, and narrowing it to `state === null` alone) before landing here.
	 * `null` and `undefined` are where the two arms genuinely differ: `(null)['assetId']` and
	 * `(undefined)['assetId']` both THROW, which is the one behaviour the object check actually
	 * prevents — a workspace layout carrying `null` (Obsidian's own JSON round-trip can produce
	 * one) must refuse the state, not crash `setState`.
	 */
	it('refuses a non-object state without throwing, including null and undefined', async () => {
		const view = makeView();
		const result = {} as never;
		await view.setState({ assetId: 'tile-01' }, result);

		for (const state of [null, undefined, 'not an object', 5, ['array']]) {
			await expect(view.setState(state, result)).resolves.toBeUndefined();
		}

		expect(view.getState().assetId).toBe('tile-01');
	});

	it('carries an accepted assetId and expanded set into getState', async () => {
		const view = makeView();

		await view.setState({ assetId: 'tile-01', expanded: ['material'] }, {} as never);

		expect(view.getState()).toEqual({ assetId: 'tile-01', expanded: ['material'] });
	});

	/** A malformed `expanded` does not cost the whole state; it falls back to none expanded. */
	it.each([
		['absent', {}],
		['not an array', { expanded: 'material' }],
		['an array holding a non-string', { expanded: ['material', 7] }],
	])('falls back to no expanded categories when the field is %s', async (_label, extra) => {
		const view = makeView();

		await view.setState({ assetId: 'tile-01', ...extra }, {} as never);

		expect(view.getState()).toEqual({ assetId: 'tile-01', expanded: [] });
	});

	/**
	 * §6.3: neither a selection nor an expansion is a navigation. `RenovationProjectView`'s own
	 * sibling case sets `result.history = true` on an accepted, changed `projectId` — copying
	 * that shape here would put a history entry behind every row a user clicks, which is the
	 * exact defect the spec's own review round found reading the API rather than an early
	 * draft's sentence.
	 */
	it('never records a selection or an expansion as a navigation', async () => {
		const view = makeView();
		const result = {} as never as { history?: boolean };

		await view.setState({ assetId: 'tile-01', expanded: ['material'] }, result as never);

		expect(result.history).toBeFalsy();
	});

	/**
	 * The mechanism behind that rule, not only the flag: a selection change must not tear the
	 * tree down and rebuild it, or the shelves' scroll position — the thing §6.3 names as the
	 * cost of copying `RenovationProjectView`'s remount-per-navigation shape — would be lost on
	 * every row click. Asserted on the DOM NODE identity, which a remount cannot fake: unmounting
	 * and remounting an identically-shaped tree would still replace this element.
	 *
	 * BOTH refs, not only `assetId` — a review round found the `expanded` half of this mechanism
	 * unproven (deleting its in-place write left every existing case green, since nothing here
	 * read it), so this case drives and asserts both.
	 */
	it('draws in place rather than remounting when the selection or the expanded set changes', async () => {
		const view = makeView();
		await view.onOpen();
		await settle();
		const before = view.contentEl.querySelector('.renovation-asset-library');
		expect(before).not.toBeNull();

		await view.setState({ assetId: 'tile-01', expanded: ['material'] }, {} as never);
		await settle();

		expect(view.contentEl.querySelector('.renovation-asset-library')).toBe(before);
		expect(selectedAssetId(view)).toBe('tile-01');
		expect(expandedCategories(view)).toBe('material');
	});

	/** And a refused parse leaves the tree showing whatever it was already showing. */
	it('leaves the drawn selection alone when a later state refuses to parse', async () => {
		const view = makeView();
		await view.setState({ assetId: 'tile-01' }, {} as never);
		await view.onOpen();
		await settle();

		await view.setState({ assetId: 42 }, {} as never);
		await settle();

		expect(view.getState()).toEqual({ assetId: 'tile-01', expanded: [] });
		expect(selectedAssetId(view)).toBe('tile-01');
	});

	/**
	 * A `setState` arriving before the view is ever opened has no tree to update in place; it
	 * only has to be remembered so the eventual `mount` draws the right thing.
	 */
	it('draws the selection a setState named before onOpen ever ran', async () => {
		const view = makeView();

		await view.setState({ assetId: 'tile-02' }, {} as never);
		await view.onOpen();
		await settle();

		expect(selectedAssetId(view)).toBe('tile-02');
	});
});

describe('a settings save that replaces the composition root', () => {
	/** A leaf that never mounted has nothing to remount, and must not mount one on a rebind. */
	it('draws nothing on a rebind of a leaf that was never opened', () => {
		const view = makeView();

		view.rebind(defaultAssetLibraryDeps());

		expect(view.contentEl.querySelector('.renovation-asset-library')).toBeNull();
	});

	/**
	 * A CLOSED leaf stays closed across a settings save — the same guard
	 * `assetDesignerView.test.ts` pins for its own view, and for the identical reason: a
	 * `rebind` with no guard runs `mount` over a `contentEl` Obsidian has already emptied and
	 * detached from the workspace.
	 */
	it('draws nothing when a CLOSED leaf is rebound, rather than resurrecting its tree', async () => {
		const view = makeView();
		await view.onOpen();
		await view.onClose();

		view.rebind(defaultAssetLibraryDeps());

		expect(view.contentEl.querySelector('.renovation-asset-library')).toBeNull();
	});

	/**
	 * The remount's one real risk: `assetIdRef`/`expandedRef` are this view's OWN fields,
	 * constructed once and reused across `rebind`'s `unmount()`/`mount()` pair, so a rebind
	 * must not touch what they hold — the identical guarantee `AssetDesignerView.rebind` and
	 * `RenovationProjectView.rebind` each state for their own per-leaf field.
	 */
	it('leaves the library showing the same selection it was showing', async () => {
		const view = makeView();
		await view.setState({ assetId: 'tile-01', expanded: ['material'] }, {} as never);
		await view.onOpen();
		await settle();

		view.rebind(defaultAssetLibraryDeps());
		await settle();

		expect(view.getState()).toEqual({ assetId: 'tile-01', expanded: ['material'] });
		expect(selectedAssetId(view)).toBe('tile-01');
	});

	/**
	 * **The task's own headline guarantee**: a rebind actually REMOUNTS the tree, so the queries
	 * and commands the new `deps` carries reach whatever the tree does next. A review round
	 * found this entirely unpinned — deleting `rebind`'s `unmount(); mount();` while keeping
	 * `this.deps = deps` left the whole suite green, because every other rebind case asserts
	 * either the PRIVATE `deps` field (which a no-op rebind still updates) or that the SELECTION
	 * survives (which is equally true of a rebind that touched nothing at all).
	 *
	 * Asserted on DOM NODE IDENTITY, the same instrument the in-place case above uses from the
	 * opposite direction: a genuine `unmount()`/`mount()` pair always produces a NEW element,
	 * because `mount()` calls `this.contentEl.empty()` and builds a fresh Vue app: `assertion`
	 * here is the exact inverse of "stays the same node" — "does NOT stay the same node".
	 */
	it('remounts the tree on rebind, replacing the element the previous context was provided to', async () => {
		const view = makeView();
		await view.onOpen();
		await settle();
		const before = view.contentEl.querySelector('.renovation-asset-library');
		expect(before).not.toBeNull();

		view.rebind(defaultAssetLibraryDeps());
		await settle();

		const after = view.contentEl.querySelector('.renovation-asset-library');
		expect(after).not.toBeNull();
		expect(after).not.toBe(before);
	});

	/**
	 * Redrawn against the NEW bundle, asserted through the view's own private `deps` field —
	 * which is exactly what it says, and no more: this case alone cannot tell a rebind that
	 * remounts the tree from one that only updates its own bookkeeping, which is why the DOM
	 * node identity above is a SEPARATE case rather than a second assertion folded into this
	 * one. The pair together is what closes the gap a review round found: this proves the
	 * bundle changed, the one above proves the TREE is what changed with it.
	 */
	it('rebinds onto the new bundle rather than the one it opened with', async () => {
		const first = defaultAssetLibraryDeps({ logger: { ...defaultAssetLibraryDeps().logger } });
		const view = makeView(first);
		await view.onOpen();
		await settle();

		const second = defaultAssetLibraryDeps();
		expect(second.logger).not.toBe(first.logger);
		view.rebind(second);
		await settle();

		expect((view as unknown as { deps: AssetLibraryDeps }).deps).toBe(second);
	});
});

/**
 * Mirrors `viewRoot.test.ts`'s "the renovation project context guard" and
 * `assetDesignerRoot.test.ts`'s equivalent: called directly rather than from inside a mounted
 * component, `inject()` finds no active instance and answers `undefined` regardless of what has
 * been provided anywhere, which is the same path a component mounted with no
 * `AssetLibraryContext` takes.
 */
describe('the asset library context guard', () => {
	it('throws rather than mounting a library with nothing behind it', () => {
		expect(() => useAssetLibraryContext()).toThrow(/AssetLibraryContext/);
	});
});
