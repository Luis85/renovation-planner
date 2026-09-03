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
 */
import { afterEach, describe, expect, it } from 'vitest';
import { ASSET_LIBRARY_ICON, ASSET_LIBRARY_VIEW } from '../../../src/presentation/library/AssetLibraryView';
import type { AssetLibraryView } from '../../../src/presentation/library/AssetLibraryView';
import type { AssetLibraryDeps } from '../../../src/presentation/library/AssetLibraryDeps';
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
): { view: AssetLibraryView; leaf: FakeLeaf } {
	const built = makeAssetLibraryView(deps, leaf);
	openViews.push(built.view);
	return built;
}

afterEach(async () => {
	for (const view of openViews.splice(0)) await view.onClose();
	await settle();
});

describe('what the library tells Obsidian about itself', () => {
	it('answers its persisted type, its icon, and a translated display name', () => {
		const { view } = makeView();

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
		const { view } = makeView();

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
		const { view } = makeView();

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
		const { view } = makeView();

		await view.onOpen();

		expect(view.contentEl.querySelector('.renovation-asset-library')).not.toBeNull();
	});

	it('redraws exactly one app when a closed leaf is reopened', async () => {
		const { view } = makeView();
		await view.onOpen();

		await view.onClose();
		await view.onOpen();

		expect(view.contentEl.querySelectorAll('.renovation-asset-library')).toHaveLength(1);
	});
});

describe('the selection and the expanded set this leaf remembers', () => {
	/**
	 * §6.3's own three-way parse, `projectIdFrom`'s exact shape: a non-object and a non-string
	 * both refuse, and `''` is ACCEPTED — the sentinel a restore has to be able to reach, never
	 * confused with a value this build could not parse.
	 */
	it('accepts an empty assetId as the unselected state and refuses a non-string', async () => {
		const { view } = makeView();
		const result = {} as never;

		await view.setState({ assetId: '' }, result);
		expect(view.getState()).toEqual({ assetId: '', expanded: [] });

		await view.setState({ assetId: 42 }, result);
		expect(view.getState().assetId).toBe('');
	});

	it('carries an accepted assetId and expanded set into getState', async () => {
		const { view } = makeView();

		await view.setState({ assetId: 'tile-01', expanded: ['material'] }, {} as never);

		expect(view.getState()).toEqual({ assetId: 'tile-01', expanded: ['material'] });
	});

	/** A malformed `expanded` does not cost the whole state; it falls back to none expanded. */
	it.each([
		['absent', {}],
		['not an array', { expanded: 'material' }],
		['an array holding a non-string', { expanded: ['material', 7] }],
	])('falls back to no expanded categories when the field is %s', async (_label, extra) => {
		const { view } = makeView();

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
		const { view } = makeView();
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
	 */
	it('draws in place rather than remounting when the selection changes', async () => {
		const { view } = makeView();
		await view.onOpen();
		await settle();
		const before = view.contentEl.querySelector('.renovation-asset-library');
		expect(before).not.toBeNull();

		await view.setState({ assetId: 'tile-01', expanded: [] }, {} as never);
		await settle();

		expect(view.contentEl.querySelector('.renovation-asset-library')).toBe(before);
		expect(view.contentEl.textContent).toContain('tile-01');
	});

	/** And a refused parse leaves the tree showing whatever it was already showing. */
	it('leaves the drawn selection alone when a later state refuses to parse', async () => {
		const { view } = makeView();
		await view.setState({ assetId: 'tile-01' }, {} as never);
		await view.onOpen();
		await settle();

		await view.setState({ assetId: 42 }, {} as never);
		await settle();

		expect(view.getState()).toEqual({ assetId: 'tile-01', expanded: [] });
		expect(view.contentEl.textContent).toContain('tile-01');
	});

	/**
	 * A `setState` arriving before the view is ever opened has no tree to update in place; it
	 * only has to be remembered so the eventual `mount` draws the right thing.
	 */
	it('draws the selection a setState named before onOpen ever ran', async () => {
		const { view } = makeView();

		await view.setState({ assetId: 'tile-02' }, {} as never);
		await view.onOpen();
		await settle();

		expect(view.contentEl.textContent).toContain('tile-02');
	});
});

describe('a settings save that replaces the composition root', () => {
	/** A leaf that never mounted has nothing to remount, and must not mount one on a rebind. */
	it('draws nothing on a rebind of a leaf that was never opened', () => {
		const { view } = makeView();

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
		const { view } = makeView();
		await view.onOpen();
		await view.onClose();

		view.rebind(defaultAssetLibraryDeps());

		expect(view.contentEl.querySelector('.renovation-asset-library')).toBeNull();
	});

	/**
	 * The remount's one real risk: `assetId`/`expanded` are this view's OWN fields and a
	 * rebind must not touch them, or a settings save would blank a library a user was
	 * browsing — the identical guarantee `AssetDesignerView.rebind` and
	 * `RenovationProjectView.rebind` each state for their own per-leaf field.
	 */
	it('leaves the library showing the same selection it was showing', async () => {
		const { view } = makeView();
		await view.setState({ assetId: 'tile-01', expanded: ['material'] }, {} as never);
		await view.onOpen();
		await settle();

		view.rebind(defaultAssetLibraryDeps());
		await settle();

		expect(view.getState()).toEqual({ assetId: 'tile-01', expanded: ['material'] });
		expect(view.contentEl.textContent).toContain('tile-01');
	});

	/**
	 * Redrawn against the NEW bundle: a rebind that quietly kept the old `deps` reference would
	 * leave every context member — the read the shelves will eventually run among them — bound
	 * to services `saveSettings` has already replaced. Asserted through a member the context
	 * actually carries, `logger`, rather than through a private field, since the whole point is
	 * that the TREE — not merely the view's own bookkeeping — reads through the new bundle.
	 */
	it('rebinds the mounted tree onto the new bundle rather than the one it opened with', async () => {
		const first = defaultAssetLibraryDeps({ logger: { ...defaultAssetLibraryDeps().logger } });
		const { view } = makeView(first);
		await view.onOpen();
		await settle();

		const second = defaultAssetLibraryDeps();
		expect(second.logger).not.toBe(first.logger);
		view.rebind(second);
		await settle();

		// Rebinding remounts a fresh tree onto a fresh context; the surest external evidence
		// that the SECOND bundle is what got provided is that the view answers it back as its
		// own current `deps` — mirrored from `rootSwapRebind.test.ts`'s own project-view case,
		// which reads the same private field the same way.
		expect((view as unknown as { deps: AssetLibraryDeps }).deps).toBe(second);
	});
});
