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
import { loadedPlugin } from '../helpers/plugin';
import { FakeLeaf, type FakeWorkspace } from '../helpers/workspace';
import { resetRecorder } from '../helpers/logger';
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
	const view = plugin.views.get(type)?.(leaf as never) as never as {
		onOpen: () => Promise<void>;
		setState?: (state: unknown, result: unknown) => Promise<void>;
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

	it('rebinds the plan editor too, which was never the reported half', async () => {
		resetRecorder();
		const { plugin, workspace } = await loadedPlugin();
		const { view } = await openViewOnLeaf(plugin, workspace, PLAN_EDITOR_VIEW, { planId: 'plan-1' });
		expect(view).toBeInstanceOf(PlanEditorView);
		const before = view.deps;

		await plugin.saveSettings({ ...DEFAULT_SETTINGS, projectFolder: 'Somewhere Else' });

		expect(view.deps).not.toBe(before);
	});

	it('leaves the plan editor showing the same plan it was showing', async () => {
		// The remount's one real risk: `planId` is this view's own field and a rebind must not
		// touch it, or a settings save would blank an editor the user was working in.
		resetRecorder();
		const { plugin, workspace } = await loadedPlugin();
		const { view } = await openViewOnLeaf(plugin, workspace, PLAN_EDITOR_VIEW, { planId: 'plan-1' });

		await plugin.saveSettings({ ...DEFAULT_SETTINGS, projectFolder: 'Somewhere Else' });

		expect((view as never as { getState: () => Record<string, unknown> }).getState()).toEqual({ planId: 'plan-1' });
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
		for (const type of [RENOVATION_PROJECT_VIEW, PLAN_EDITOR_VIEW]) {
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
