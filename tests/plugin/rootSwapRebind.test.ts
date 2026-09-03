/**
 * @vitest-environment jsdom
 *
 * What happens to a view that is already on screen when `saveSettings` replaces the root.
 *
 * `registerView`'s factory resolves each view's dependencies PER CALL from `this.root`, and
 * the comment beside it said that was what made a root swap safe. It is half of it: Obsidian
 * calls a registered factory when it CONSTRUCTS a view, so "per call" only ever covered views
 * opened AFTER the swap. Every view already open kept the previous root — reading through a
 * Project Index that `VaultChangeAdapter` stops maintaining the moment the root is replaced,
 * dispatching into the previous root's commands, putting new projects under the previous
 * default folder, and holding its `ProjectIndexRebuilt` subscription on a bus nothing
 * publishes to any more.
 *
 * Reported in review as a P1 against the Renovation Project view. It was true of the Plan
 * Editor for the same reason and since three slices earlier, so both are driven here: the
 * subject is the CATEGORY — a view built against a replaced root — rather than the member of
 * it that was reported.
 */
import { describe, expect, it, vi } from 'vitest';
import { installObsidianDom } from '../helpers/dom';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { RENOVATION_PROJECT_VIEW, RenovationProjectView } from '../../src/presentation/views/RenovationProjectView';
import { PLAN_EDITOR_VIEW, PlanEditorView } from '../../src/presentation/views/PlanEditorView';
import { ASSET_DESIGNER_VIEW, AssetDesignerView } from '../../src/presentation/designer/AssetDesignerView';
import { ASSET_LIBRARY_VIEW, AssetLibraryView } from '../../src/presentation/library/AssetLibraryView';
import { loadedPlugin } from '../helpers/plugin';
import { FakeLeaf, type FakeWorkspace } from '../helpers/workspace';
import { resetRecorder } from '../helpers/logger';
import { settle } from '../helpers/async';
import type RenovationPlannerPlugin from '../../src/plugin/RenovationPlannerPlugin';

vi.mock('../../src/infrastructure/logging/consoleLogger', async () => (await import('../helpers/logger')).consoleLoggerMock());

installObsidianDom();

/**
 * Obsidian's own part: build the registered view for a leaf, put it ON the leaf, and give
 * the leaf the view state that makes `getLeavesOfType` answer for it. All three, because a
 * fake that only built the view leaves `rebindOpenViews` nothing to find — the thin-fake
 * shape this repository keeps paying for.
 */
async function openViewOnLeaf(
	plugin: RenovationPlannerPlugin,
	workspace: FakeWorkspace,
	type: string,
	state?: Record<string, unknown>,
) {
	const leaf = new FakeLeaf();
	await leaf.setViewState({ type, state });
	// `views` is the plugin's own registry and not part of its public surface — reached here on
	// purpose, because a rebind test has to get at the view instance the plugin built.
	const views = (plugin as unknown as { views: Map<string, (leaf: never) => unknown> }).views;
	// `getState` is declared here rather than asserted at each call site: every `View` Obsidian
	// knows has one, the fake is playing Obsidian's part, and two cases below ask a rebound view
	// which subject it is still showing. It used to be a second `as never` per case — a cast
	// added because the helper's own shape was thinner than the thing it stands for.
	const view = views.get(type)?.(leaf as never) as never as {
		onOpen: () => Promise<void>;
		setState?: (state: unknown, result: unknown) => Promise<void>;
		getState: () => Record<string, unknown>;
		deps: Record<string, unknown>;
	};
	leaf.view = view;
	workspace.leaves.push(leaf);
	if (state !== undefined) await view.setState?.(state, {});
	await view.onOpen();
	return { leaf, view };
}

describe('a view already open when the root is replaced', () => {
	it('rebinds the renovation project view to the new root', async () => {
		resetRecorder();
		const { plugin, workspace } = await loadedPlugin();
		const { view } = await openViewOnLeaf(plugin, workspace, RENOVATION_PROJECT_VIEW);
		expect(view).toBeInstanceOf(RenovationProjectView);
		const before = view.deps;

		await plugin.saveSettings({ ...DEFAULT_SETTINGS, projectFolder: 'Somewhere Else' });

		// The whole bundle, not one member: `commands`, `queries`, `openProject` and the
		// rebuild subscription all come from the root this object was built from.
		expect(view.deps).not.toBe(before);
	});

	/**
	 * A settings swap must not silently return a detail-state pane to the list. `navigate`
	 * writes that state through the real `navigateToProject` (Task 11), so this drives the
	 * whole path a user's own click would: navigate, then swap settings, then ask which project
	 * the view still holds.
	 *
	 * **Not "what the pane is showing", which is what this sentence said for one round.**
	 * `getState()` reads `this.projectId`; a rebind that kept the field and drew the LIST anyway
	 * would leave this case green. That gap is covered — `renovationProjectView.test.ts`'s
	 * 'remounts the open project on the new bundle' reddens against exactly that mutation, and
	 * this case reddens against blanking the field — so the pair holds criterion 7 and neither
	 * half holds it alone.
	 *
	 * **It asks the VIEW's own state, and the first version asked the rebound bundle's
	 * `projectId` instead — the wrong side of the seam.** That member is dead:
	 * `RenovationProjectView.mount` provides `{ ...this.deps, projectId }` with its own field
	 * last, so nothing renders what the bundle carries, and the case certified a value no
	 * pane could draw. It went red against the mutation of the day (deleting the plugin's
	 * `projectIdOfLeaf` read), which is exactly what makes a wrongly-pinned case hard to
	 * spot: discriminating and pointed at the wrong thing are not exclusive. `getState()`
	 * reads `this.projectId`, the one field `sync`/`mount` consult — the same assertion the
	 * Plan Editor's sibling case below already made about `planId`, arrived at from the
	 * report of the whole-branch review rather than from the symmetry that was there to see.
	 *
	 * **And re-pointing it required widening the FAKE, which is why the two defects were
	 * one.** `FakeLeaf.setViewState` recorded the state and did not call the view's
	 * `setState`, where Obsidian's does — so this `navigate` moved the leaf and left the view
	 * deaf, and the recorded state reachable only through the dead bundle member was the ONLY
	 * thing the case could have asked. A thin fake does not merely fail to catch a defect; it
	 * shapes the assertion somebody then writes against it. Both halves are watched red:
	 * a `setViewState` that stops routing into the view, and a `rebind` that blanks
	 * `this.projectId`.
	 */
	it('rebinds with the project a leaf had already navigated to, not the list', async () => {
		resetRecorder();
		const { plugin, workspace } = await loadedPlugin();
		const { view } = await openViewOnLeaf(plugin, workspace, RENOVATION_PROJECT_VIEW);

		(view.deps as never as { navigate: (id: string | null) => void }).navigate('project-1');
		await settle();

		await plugin.saveSettings({ ...DEFAULT_SETTINGS, projectFolder: 'Somewhere Else' });

		expect((view as never as { getState: () => Record<string, unknown> }).getState()).toEqual({
			projectId: 'project-1',
		});
	});

	it('rebinds the plan editor too, which was never the reported half', async () => {
		resetRecorder();
		const { plugin, workspace } = await loadedPlugin();
		const { view } = await openViewOnLeaf(plugin, workspace, PLAN_EDITOR_VIEW, { planId: 'plan-1' });
		expect(view).toBeInstanceOf(PlanEditorView);
		const before = view.deps;

		await plugin.saveSettings({ ...DEFAULT_SETTINGS, projectFolder: 'Somewhere Else' });

		expect(view.deps).not.toBe(before);
	});

	/**
	 * The third member of the category, added with ADR-0015's view.
	 *
	 * `rebindOpenViews` is a LOOP PER VIEW TYPE, so a third registered view whose loop nobody
	 * wrote is the guard-nobody-dispatches-through shape: `AssetDesignerView.rebind` can be
	 * present, unit-tested and green while `saveSettings` never calls it, and a designer left
	 * open across a settings save goes on reading through a root nothing maintains. Nothing in
	 * `npm run check` can see a missing loop — the view compiles, the method has callers in its
	 * own suite, and `fallow` counts it used.
	 */
	it('rebinds the asset designer too, which is the third member of the same category', async () => {
		resetRecorder();
		const { plugin, workspace } = await loadedPlugin();
		const { view } = await openViewOnLeaf(plugin, workspace, ASSET_DESIGNER_VIEW, { assetId: 'asset-1' });
		expect(view).toBeInstanceOf(AssetDesignerView);
		const before = view.deps;

		await plugin.saveSettings({ ...DEFAULT_SETTINGS, projectFolder: 'Somewhere Else' });

		expect(view.deps).not.toBe(before);
	});

	/**
	 * The remount's one real risk, asked of the designer for the reason it is asked of the
	 * editor below: `assetId` is this view's own field and a rebind must not touch it, or a
	 * settings save would blank a designer the user was working in.
	 */
	it('leaves the asset designer showing the same asset it was showing', async () => {
		resetRecorder();
		const { plugin, workspace } = await loadedPlugin();
		const { view } = await openViewOnLeaf(plugin, workspace, ASSET_DESIGNER_VIEW, { assetId: 'asset-1' });

		await plugin.saveSettings({ ...DEFAULT_SETTINGS, projectFolder: 'Somewhere Else' });

		expect(view.getState()).toEqual({ assetId: 'asset-1' });
	});

	/**
	 * The fourth member of the category, and the one this task exists for: §2's placement
	 * table names it by name — §83's library-folder migration MOVES every catalogue note and
	 * then swaps the root, so an un-rebound library would go on resolving asset notes at the
	 * folder they have just left.
	 */
	it('rebinds the asset library too, which is the fourth member of the same category', async () => {
		resetRecorder();
		const { plugin, workspace } = await loadedPlugin();
		const { view } = await openViewOnLeaf(plugin, workspace, ASSET_LIBRARY_VIEW, { assetId: 'tile-01' });
		expect(view).toBeInstanceOf(AssetLibraryView);
		const before = view.deps;

		await plugin.saveSettings({ ...DEFAULT_SETTINGS, projectFolder: 'Somewhere Else' });

		expect(view.deps).not.toBe(before);
	});

	/**
	 * The remount's one real risk, asked of the library for the reason it is asked of the
	 * designer above: `assetId` and `expanded` are this view's own fields and a rebind must
	 * not touch them, or a settings save would blank a library a user was browsing.
	 */
	it('leaves the asset library showing the same selection it was showing', async () => {
		resetRecorder();
		const { plugin, workspace } = await loadedPlugin();
		const { view } = await openViewOnLeaf(plugin, workspace, ASSET_LIBRARY_VIEW, {
			assetId: 'tile-01',
			expanded: ['material'],
		});

		await plugin.saveSettings({ ...DEFAULT_SETTINGS, projectFolder: 'Somewhere Else' });

		expect(view.getState()).toEqual({ assetId: 'tile-01', expanded: ['material'] });
	});

	it('leaves the plan editor showing the same plan it was showing', async () => {
		// The remount's one real risk: `planId` is this view's own field and a rebind must not
		// touch it, or a settings save would blank an editor the user was working in.
		resetRecorder();
		const { plugin, workspace } = await loadedPlugin();
		const { view } = await openViewOnLeaf(plugin, workspace, PLAN_EDITOR_VIEW, { planId: 'plan-1' });

		await plugin.saveSettings({ ...DEFAULT_SETTINGS, projectFolder: 'Somewhere Else' });

		expect(view.getState()).toEqual({ planId: 'plan-1' });
	});

	it('delivers the new root rebuild to the rebound project view, and not the old root', async () => {
		// The end the P1 was actually about: after a swap, does the index-rebuilt signal reach
		// the pane? Asserted through the view's OWN dependency bundle rather than a spy on the
		// bus, because a subscription on the right bus that the view no longer holds would
		// satisfy the second and not the first.
		resetRecorder();
		const { plugin, workspace } = await loadedPlugin();
		const { view } = await openViewOnLeaf(plugin, workspace, RENOVATION_PROJECT_VIEW);

		await plugin.saveSettings({ ...DEFAULT_SETTINGS, projectFolder: 'Somewhere Else' });

		const heard = vi.fn<() => void>();
		(view.deps as never as { onProjectsChanged: (l: () => void) => () => void }).onProjectsChanged(heard);
		await (plugin as never as { root: { eventBus: { publish: (e: unknown) => Promise<void> } } }).root.eventBus.publish({
			type: 'ProjectIndexRebuilt',
		});

		expect(heard).toHaveBeenCalledTimes(1);
	});

	it('leaves a leaf of our type alone when the view in it is not ours', async () => {
		// `getLeavesOfType` is keyed by type and Obsidian fills it from our own factory, so
		// this is a narrowing rather than a suspicion — but it is the arm that decides between
		// skipping a foreign view and calling `rebind` on something that has no such method,
		// which is a `TypeError` inside `saveSettings` rather than a wrong picture.
		resetRecorder();
		const { plugin, workspace } = await loadedPlugin();
		for (const type of [RENOVATION_PROJECT_VIEW, PLAN_EDITOR_VIEW, ASSET_DESIGNER_VIEW, ASSET_LIBRARY_VIEW]) {
			const leaf = new FakeLeaf();
			await leaf.setViewState({ type });
			leaf.view = { notOneOfOurs: true };
			workspace.leaves.push(leaf);
		}

		await expect(plugin.saveSettings({ ...DEFAULT_SETTINGS, projectFolder: 'Somewhere Else' })).resolves.not.toThrow();
	});

	it('leaves a view that is not open alone, and still hands it the new root next time', async () => {
		// A closed view takes the new bundle without a remount: there is no Vue app to replace,
		// and `onOpen` is what mounts against whatever `deps` holds by then.
		resetRecorder();
		const { plugin, workspace } = await loadedPlugin();
		const { view } = await openViewOnLeaf(plugin, workspace, RENOVATION_PROJECT_VIEW);
		await (view as never as { onClose: () => Promise<void> }).onClose();
		const before = view.deps;

		await plugin.saveSettings({ ...DEFAULT_SETTINGS, projectFolder: 'Somewhere Else' });

		expect(view.deps).not.toBe(before);
	});
});
