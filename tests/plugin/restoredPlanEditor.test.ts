/**
 * @vitest-environment jsdom
 *
 * Reopening Obsidian with a Plan Editor tab open — slice 5's Definition-of-Done item 12,
 * and the one item that failed when a human finally ran the whole list in a vault.
 *
 * Obsidian restores its leaves BEFORE `onLayoutReady`, and the Project Index scan runs
 * FROM `onLayoutReady` (a scan in `onload` competes with workspace restoration and builds
 * a partial index that looks complete, SDD §47). So a restored Plan Editor hydrated against
 * an empty index: `getPath` answered nothing, the read was a legitimate `ok(null)`, and the
 * view said "This plan no longer exists" about a plan that does — permanently, because
 * nothing told it to look again.
 *
 * Only ONE of the user's two tabs was broken, which is the detail that pins the mechanism:
 * Obsidian defers a non-active leaf's view until it is activated, so the second one was
 * constructed after the scan and read a populated index.
 *
 * Driven through the PLUGIN rather than through the editor harness, because the defect is
 * the ordering between two things only the plugin owns — when views are built and when the
 * index is scanned. A harness that hands the view its own queries cannot have this bug.
 */
import { describe, expect, it } from 'vitest';
import type { WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { PLAN_EDITOR_VIEW, type PlanEditorView } from '../../src/presentation/views/PlanEditorView';
import { t } from '../../src/presentation/i18n/strings';
import { loadedPlugin } from '../helpers/plugin';
import { createRepositoryStack } from '../helpers/vault';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity } from '../helpers/entities';
import { expectOk } from '../helpers/domain';
import { FakeLeaf } from '../helpers/workspace';
import { installEditorEnvironment, settle, settleUntil } from '../helpers/editor';

installEditorEnvironment();

/** A vault that already holds one project and one plan, as a restart would find it. */
async function vaultWithAPlan() {
	const stack = createRepositoryStack(DEFAULT_SETTINGS.projectFolder);
	const project = makeProjectEntity();
	expectOk(await stack.projects.save(project, 'absent'));
	const plan = makePlanEntity({ projectId: project.id, name: 'Ground floor' });
	expectOk(await stack.plans.save(plan, 'absent'));
	// Obsidian has parsed all of it: this is a vault from a PREVIOUS session.
	stack.metadataCache.catchUp();
	return { stack, planId: plan.id, planName: plan.name };
}

/** What `registerView`'s factory builds for a leaf Obsidian is restoring. */
async function restoreLeaf(plugin: { views: Map<string, (leaf: WorkspaceLeaf) => unknown> }, planId: string) {
	const factory = plugin.views.get(PLAN_EDITOR_VIEW);
	const view = factory?.(new FakeLeaf() as never) as PlanEditorView;
	await view.onOpen();
	await view.setState({ planId }, {} as never);
	await settle();
	return view;
}

function textOf(view: PlanEditorView): string {
	return (view as unknown as { contentEl: HTMLElement }).contentEl.textContent ?? '';
}

describe('a Plan Editor leaf restored before the index scan', () => {
	it('does not keep claiming the plan no longer exists', async () => {
		const { stack, planId, planName } = await vaultWithAPlan();
		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);

		// The window the defect lives in: the plugin is loaded, the leaf is being restored,
		// and the scan has NOT run — exactly what Obsidian does on startup.
		expect(plugin.root.persistence?.index.entries()).toEqual([]);
		const view = await restoreLeaf(plugin, planId);

		// It says so at first, and that much is honest: with an empty index the read really
		// did answer "nothing here". What was wrong is that it stayed that way.
		expect(textOf(view)).toContain(t('en', 'editor.plan-missing'));

		workspace.layoutReady();
		await settleUntil(() => !textOf(view).includes(t('en', 'editor.plan-missing')), 'the restored plan to load');

		expect(textOf(view)).toContain(planName);
		await view.onClose();
	});

	/**
	 * The second tab, which worked in the vault and must keep working: a view Obsidian
	 * constructs AFTER the scan has run reads a populated index and never shows the message
	 * at all.
	 */
	it('loads immediately for a leaf activated after the scan', async () => {
		const { stack, planId, planName } = await vaultWithAPlan();
		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();

		const view = await restoreLeaf(plugin, planId);
		await settleUntil(() => textOf(view).includes(planName), 'the plan to load');

		expect(textOf(view)).not.toContain(t('en', 'editor.plan-missing'));
		await view.onClose();
	});

	/**
	 * A plan that genuinely is not there must still say so AFTER the scan — otherwise the
	 * fix would have replaced a wrong message with no message, and a leaf pointing at a
	 * deleted plan would sit on "Loading…" for ever.
	 */
	it('still reports a plan that really is gone', async () => {
		const { stack } = await vaultWithAPlan();
		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();

		const view = await restoreLeaf(plugin, 'plan-that-was-deleted');
		await settleUntil(() => textOf(view).includes(t('en', 'editor.plan-missing')), 'the missing-plan message');

		expect(textOf(view)).toContain(t('en', 'editor.plan-missing'));
		await view.onClose();
	});
});
