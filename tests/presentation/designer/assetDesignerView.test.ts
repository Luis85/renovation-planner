/**
 * @vitest-environment jsdom
 *
 * The asset designer's Obsidian lifecycle (ADR-0015): one isolated Vue app per leaf, keyed to
 * an asset that travels in the leaf's own view state.
 *
 * The `as never` on every `FakeLeaf` is this suite's one cast and it is unavoidable rather than
 * a convenience: `tests/helpers/workspace.ts` implements the MOCK module's `WorkspaceLeaf`,
 * while `src/` names the real `obsidian` typings and `tsconfig.json` declares no `paths`
 * mapping between them. `planEditorView.test.ts` carries the identical cast for the identical
 * reason; `makeRenovationProjectView.ts` puts it behind a factory only because the browser
 * harness builds that view too, and nothing outside this file builds this one.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { err, ok } from '../../../src/core/result/Result';
import {
	ASSET_DESIGNER_ICON,
	ASSET_DESIGNER_VIEW,
	AssetDesignerView,
} from '../../../src/presentation/designer/AssetDesignerView';
import type { AssetDesignerDeps } from '../../../src/presentation/designer/AssetDesignerContext';
import type { AssetDesignerQueryServices } from '../../../src/presentation/read-models/assetDesignerQueries';
import { unavailableAssetDesignerQueries } from '../../../src/presentation/read-models/assetDesignerQueries';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/async';
import { FakeLeaf } from '../../helpers/workspace';

installObsidianDom();

/** The one door the designer reads through, named so every `vi.fn` here can be typed as it. */
type ReadDesign = AssetDesignerQueryServices['getAssetDesign'];

const ASSET_ID = 'asset-01JABC';

function deps(overrides: Partial<AssetDesignerDeps> = {}): AssetDesignerDeps {
	return {
		queries: { getAssetDesign: () => Promise.resolve(ok(assetDesign())) },
		...overrides,
	};
}

/**
 * Every view a case opened, closed afterwards. Not tidiness: the view mounts a real Vue app
 * with a real Pinia, and a leaf left mounted keeps its effects alive against a detached tree —
 * the same reason `planEditorView.test.ts` keeps this list.
 */
const openViews: AssetDesignerView[] = [];

function makeView(bundle: AssetDesignerDeps = deps(), leaf: FakeLeaf = new FakeLeaf()): AssetDesignerView {
	const view = new AssetDesignerView(leaf as never, bundle);
	openViews.push(view);
	return view;
}

async function opened(bundle: AssetDesignerDeps = deps(), assetId: string = ASSET_ID): Promise<AssetDesignerView> {
	const view = makeView(bundle);
	await view.setState({ assetId }, {} as never);
	await view.onOpen();
	await settle();
	return view;
}

afterEach(async () => {
	for (const view of openViews.splice(0)) await view.onClose();
	await settle();
});

describe('what the designer tells Obsidian about itself', () => {
	/**
	 * The view type is DATA: Obsidian persists it in the workspace layout, so renaming it
	 * orphans every designer leaf a user has open. The display name beside it is text, and is
	 * asserted THROUGH the string table so that a copy edit does not break a wiring test.
	 */
	it('answers its persisted type, its icon, and a translated display name', () => {
		const view = makeView();

		expect(view.getViewType()).toBe(ASSET_DESIGNER_VIEW);
		expect(view.getIcon()).toBe(ASSET_DESIGNER_ICON);
		expect(view.getDisplayText()).toBe(t('en', 'view.asset-designer.name'));
	});

	/**
	 * The class `styles/chrome.css` keys off — the ONE line of this view's lifecycle that is
	 * genuinely a shared rule rather than Obsidian's own interface, and the third place it is
	 * written. Both other views assert it and this one did not; without it the leaf chrome
	 * Obsidian nests around every view is styled for two surfaces out of three, and nothing in
	 * jsdom draws enough to notice.
	 */
	it('adds the container class the leaf chrome is styled through', async () => {
		const view = makeView();

		await view.onOpen();

		expect(view.containerEl.classList.contains('renovation-planner-container')).toBe(true);
	});
});

describe('the asset a designer leaf is showing', () => {
	it('carries the open asset in its own view state, so a workspace restore reopens the same asset', async () => {
		const view = makeView();

		await view.setState({ assetId: ASSET_ID }, {} as never);

		expect(view.getState()).toEqual({ assetId: ASSET_ID });
	});

	/**
	 * The workspace layout is a file the user can edit and a file another version of this plugin
	 * wrote, so the id arrives as `unknown` and is validated rather than cast — the same trust
	 * boundary `settingsFrom` draws around `data.json`.
	 *
	 * **`''` and not `null`**, which is where this departs from the increment plan's own snippet.
	 * `PlanEditorView.getState` already writes `''` for a plan-less leaf and says why: a key that
	 * is sometimes absent is a different shape for every reader to reason about. Two per-subject
	 * views spelling one absence two ways is drift with nothing to catch it, so this mirrors the
	 * sibling rather than the snippet.
	 */
	it.each([
		['a state that names no asset', {}],
		['a state that is not an object at all', 'asset-01JABC'],
		['an id of the wrong type', { assetId: 7 }],
		['an empty id', { assetId: '' }],
	])('falls back rather than throwing for %s', async (_label, state) => {
		const view = makeView();

		await view.setState(state, {} as never);

		expect(view.getState()).toEqual({ assetId: '' });
	});

	/**
	 * A restored leaf and a leaf Obsidian has just created arrive in the OPPOSITE order —
	 * `setState` before `onOpen` for the first, `onOpen` before `setState` for the second — and
	 * Obsidian promises neither. Both route through one `sync`, so the tree is mounted once
	 * either way and a second state naming the same asset does not remount it.
	 */
	it.each([
		['state first, as a restored leaf arrives', true],
		['open first, as a leaf Obsidian just created arrives', false],
	])('mounts the designer once for %s', async (_label, stateFirst) => {
		const getAssetDesign = vi.fn<ReadDesign>(() => Promise.resolve(ok(assetDesign())));
		const view = makeView(deps({ queries: { getAssetDesign } }));

		if (stateFirst) {
			await view.setState({ assetId: ASSET_ID }, {} as never);
			await view.onOpen();
		} else {
			await view.onOpen();
			await view.setState({ assetId: ASSET_ID }, {} as never);
		}
		await settle();
		await view.setState({ assetId: ASSET_ID }, {} as never);
		await settle();

		expect(view.contentEl.querySelectorAll('.renovation-asset-designer')).toHaveLength(1);
		// The COUNT of elements cannot see a needless remount — `sync` unmounts before it mounts,
		// so a build with no "same asset" guard still draws exactly one. The number of READS can:
		// a second `setState` naming the asset already open must not send the vault another
		// query, and from Task B3a it must not throw away an undo history either.
		expect(getAssetDesign).toHaveBeenCalledTimes(1);
	});

	/** Nothing is drawn until there is an asset to draw: a leaf with no state mounts no app. */
	it('draws nothing at all until a state names an asset', async () => {
		const view = makeView();

		await view.onOpen();
		await settle();

		expect(view.contentEl.querySelector('.renovation-asset-designer')).toBeNull();
	});

	/**
	 * And an EMPTY id draws nothing either, which the round-trip above cannot say.
	 *
	 * Measured rather than predicted: relaxing `assetIdFrom` to accept `''` leaves every
	 * `getState` case green, because the view then stores `''` and reports back the very
	 * sentinel the fallback was going to produce anyway. What the relaxation actually costs is
	 * a whole designer mounted on an asset that does not exist — a query for `''`, a refusal,
	 * and a failure panel where an unopened leaf belongs. So the discriminating assertion is
	 * about what is DRAWN.
	 */
	it('draws nothing for an empty id, which is not an asset to open', async () => {
		const getAssetDesign = vi.fn<ReadDesign>(() => Promise.resolve(ok(assetDesign())));
		const view = makeView(deps({ queries: { getAssetDesign } }));

		await view.setState({ assetId: '' }, {} as never);
		await view.onOpen();
		await settle();

		expect(view.contentEl.querySelector('.renovation-asset-designer')).toBeNull();
		expect(getAssetDesign).not.toHaveBeenCalled();
	});

	/**
	 * Obsidian keeps the leaf and REUSES the view, so a close must both tear the app down and
	 * leave the leaf able to draw again — and the assertion is a COUNT rather than a presence
	 * because it has to discriminate in both directions. Forgetting `unmount` leaves
	 * `mountedAssetId` set, `sync` returns early and the reopened leaf draws NOTHING; forgetting
	 * to clear it on unmount would let the reopen stack a second app on the first.
	 */
	it('redraws exactly one app when a closed leaf is reopened', async () => {
		const view = await opened();

		await view.onClose();
		await view.onOpen();
		await settle();

		expect(view.contentEl.querySelectorAll('.renovation-asset-designer')).toHaveLength(1);
	});

	/**
	 * A settings save replaces the composition root, and a view left pointing at the old one
	 * goes on reading through services nothing maintains. `rebind` remounts against the new
	 * bundle — and the ASSET is this view's own field, never the bundle's, so a rebind cannot
	 * silently move the leaf to a different asset.
	 */
	it('re-reads through the new bundle when the composition root is replaced', async () => {
		const first = vi.fn<ReadDesign>(() => Promise.resolve(ok(assetDesign())));
		const second = vi.fn<ReadDesign>(() => Promise.resolve(ok(assetDesign())));
		const view = await opened(deps({ queries: { getAssetDesign: first } }));

		view.rebind(deps({ queries: { getAssetDesign: second } }));
		await settle();

		expect(second).toHaveBeenCalledWith(ASSET_ID);
		expect(view.getState()).toEqual({ assetId: ASSET_ID });
	});

	/** A leaf that never mounted has nothing to remount, and must not mount one on a rebind. */
	it('draws nothing on a rebind of a leaf that has no asset yet', async () => {
		const view = makeView();
		await view.onOpen();

		view.rebind(deps());
		await settle();

		expect(view.contentEl.querySelector('.renovation-asset-designer')).toBeNull();
	});

	/**
	 * A CLOSED leaf stays closed across a settings save, and this is the case that pins
	 * `rebind`'s "nothing is mounted" guard — the one above cannot, because a view that never
	 * had an asset falls out at `sync`'s own guard whether `rebind` checks or not. Measured: a
	 * `rebind` without the guard runs `sync` over an `assetId` this view still remembers and
	 * builds a whole Vue tree inside the `contentEl` of a leaf Obsidian has closed.
	 */
	it('draws nothing when a CLOSED leaf is rebound, rather than resurrecting its tree', async () => {
		const view = await opened();
		await view.onClose();

		view.rebind(deps());
		await settle();

		expect(view.contentEl.querySelector('.renovation-asset-designer')).toBeNull();
	});
});

describe('what the designer mounts', () => {
	/**
	 * A failed read must not be reported as an empty asset. `unavailableAssetDesignerQueries`
	 * refuses with `settings.unrecovered`, which is the one failure that gets no retry.
	 */
	it('draws a failure rather than an empty state when the read refuses', async () => {
		const view = await opened(deps({ queries: unavailableAssetDesignerQueries() }));

		expect(view.contentEl.querySelector('.rp-view-failure')).not.toBeNull();
		expect(view.contentEl.querySelector('.rp-empty-state')).toBeNull();
	});

	/** And a refusal that really tried is offered one, which is the difference the origin makes. */
	it('offers a retry for a refusal that is not a bootstrap failure', async () => {
		const view = await opened(
			deps({
				queries: {
					getAssetDesign: () =>
						Promise.resolve(
							err({ category: 'Reference' as const, code: 'asset.not-found', message: 'gone' }),
						),
				},
			}),
		);

		expect(view.contentEl.querySelector('.rp-view-failure__action')).not.toBeNull();
	});
});
