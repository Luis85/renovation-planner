// @vitest-environment jsdom
// jsdom: the plugin shell touches the DOM (ribbon element, settings tab) through the
// module mock, exactly as tests/plugin/registration.test.ts does.
import { describe, expect, it } from 'vitest';
import { installObsidianDom } from '../helpers/dom';
import { loadedPlugin } from '../helpers/plugin';
import { createRepositoryStack } from '../helpers/vault';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity } from '../helpers/entities';
import { expectOk } from '../helpers/domain';
import { FindZonesByPlan } from '../../src/application/queries/FindZonesByPlan';
import { CreatePlanCommand } from '../../src/application/commands/plan/CreatePlan';
import { CreateProjectCommand } from '../../src/application/commands/project/CreateProject';
import { CreateZoneCommand } from '../../src/application/commands/zone/CreateZone';
import { createPlanId } from '../../src/domain/plan/PlanId';
import { createProjectId } from '../../src/domain/project/ProjectId';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';

installObsidianDom();

/**
 * Slice 4's composition-root contract: the persistence stack exists ONLY when settings
 * were recovered (a folder path with no recovered settings is a location nobody chose),
 * and the index scan runs from `onLayoutReady`, never from `onload`.
 */
describe('persistence composition', () => {
	it('composes no repositories, index or queries while settings are unrecovered', async () => {
		const { plugin, workspace } = await loadedPlugin(null, new Error('unreadable'), true);

		expect(plugin.root.settings).toBeNull();
		expect(plugin.root.persistence).toBeNull();

		// Layout-ready with no stack is a no-op: no scan, no listeners, no crash.
		workspace.layoutReady();
		expect(plugin.eventRefs).toHaveLength(0);
	});

	it('composes nothing when the vault collaborators are missing even if settings exist', async () => {
		const { createCompositionRoot } = await import('../../src/plugin/composition-root');
		const root = createCompositionRoot(DEFAULT_SETTINGS, { debug() {}, info() {}, warn() {}, error() {} }, null);
		expect(root.persistence).toBeNull();
	});

	it('composes the stack on a fresh install, whose defaults ARE the chosen location', async () => {
		const { plugin, workspace } = await loadedPlugin(null);

		expect(plugin.root.settings).toEqual(DEFAULT_SETTINGS);
		expect(plugin.root.persistence?.projects).toBeDefined();
		expect(plugin.root.persistence?.plans).toBeDefined();
		expect(plugin.root.persistence?.zones).toBeDefined();
		expect(plugin.root.persistence?.queries.findZonesByPlan).toBeInstanceOf(FindZonesByPlan);
		// The three creates, composed here since the sample-project seed became their first
		// caller. Named individually rather than asserted as a count: a missing one is a
		// command family that silently cannot create one of the three entity kinds.
		expect(plugin.root.persistence?.createProject).toBeInstanceOf(CreateProjectCommand);
		expect(plugin.root.persistence?.createPlan).toBeInstanceOf(CreatePlanCommand);
		expect(plugin.root.persistence?.createZone).toBeInstanceOf(CreateZoneCommand);

		// Nothing scanned yet: the index is empty until layout-ready.
		expect(plugin.root.persistence.index.entries()).toEqual([]);
		expect(workspace.layoutReadyCallbacks).toHaveLength(1);
	});

	it('rebuilds the index from vault contents at layout-ready', async () => {
		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS);
		const stack = createRepositoryStack(DEFAULT_SETTINGS.projectFolder);
		const projectId = createProjectId();
		const planId = createPlanId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		expectOk(await stack.plans.save(makePlanEntity({ id: planId, projectId }), 'absent'));

		// The plugin shares the SAME app surface the stack wrote into? No — this plugin has
		// its own empty stub vault. So assert the WIRING, not contents: layout-ready fires,
		// the scan runs against the app's vault (empty here), and the index stays coherent.
		workspace.layoutReady();

		expect(plugin.root.persistence?.index.entries()).toEqual([]);

		// And vault listeners are registered for the change pipeline.
		expect(plugin.eventRefs.length).toBeGreaterThanOrEqual(4);
	});

	it('vault listeners tolerate events that are not notes', async () => {
		const { plugin, workspace, vaultHandlers } = await loadedPlugin(DEFAULT_SETTINGS);
		workspace.layoutReady();
		expect(plugin.root.persistence).not.toBeNull();

		// Obsidian hands TAbstractFile to every event; folders and unknown shapes must
		// pass through the instanceof guard without touching the pipeline.
		for (const handler of vaultHandlers) {
			handler({ path: 'Renovation/a-folder' });
		}
		expect(plugin.root.persistence?.index.entries()).toHaveLength(0);
	});

	/**
	 * `saveSettings` REPLACES the composition root — its fields are readonly, so that is the
	 * only way state changes there. Two things have to survive the swap, and neither did:
	 * the new root's index starts EMPTY (and `projectFolder` is itself a setting, so the
	 * tree worth scanning may have moved), and the vault listeners registered at
	 * layout-ready must end up maintaining the root the save installed rather than the one
	 * they were registered beside.
	 */
	it('rebuilds the index into the fresh root when a setting is saved mid-session', async () => {
		const stack = createRepositoryStack(DEFAULT_SETTINGS.projectFolder);
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));

		const { plugin, workspace, vaultHandlers } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();
		expect(plugin.root.persistence?.index.getPath(projectId)).toBeDefined();

		const firstPersistence = plugin.root.persistence;
		const refsAfterLoad = plugin.eventRefs.length;
		const handlersAfterLoad = vaultHandlers.length;

		await plugin.saveSettings({ ...DEFAULT_SETTINGS, units: 'imperial' });

		expect(plugin.root.settings?.units).toBe('imperial');
		expect(plugin.root.persistence).not.toBe(firstPersistence);

		// The rebuild is what makes the swap complete: without it this reads undefined and
		// the session queries an index of nothing until the next reload.
		expect(plugin.root.persistence?.index.getPath(projectId)).toBeDefined();

		// And nothing registered a second time. `registerEvent` disposes at UNLOAD, so a
		// duplicate is a second delivery of every event for the rest of the session, with
		// nothing to take the first one back.
		expect(plugin.eventRefs).toHaveLength(refsAfterLoad);
		expect(vaultHandlers).toHaveLength(handlersAfterLoad);
	});

	it('keeps vault events feeding the root a settings save installed', async () => {
		const stack = createRepositoryStack(DEFAULT_SETTINGS.projectFolder);
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));

		const { plugin, workspace, vaultHandlers } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();
		await plugin.saveSettings({ ...DEFAULT_SETTINGS, units: 'imperial' });

		// A note that appears AFTER the save, delivered through the handler registered
		// BEFORE it. A handler holding its adapter captured would file this into an index
		// nothing reads any more, and the assertion below would find nothing.
		const planId = createPlanId();
		expectOk(await stack.plans.save(makePlanEntity({ id: planId, projectId }), 'absent'));
		const planPath = stack.index.getPath(planId);
		expect(planPath).toBeDefined();

		const [onCreate] = vaultHandlers;
		onCreate(stack.vault.getAbstractFileByPath(planPath as string) as never);
		plugin.root.persistence?.changeAdapter.flush();

		expect(plugin.root.persistence?.index.getPath(planId)).toBe(planPath);
	});

	it('declares exactly one folder setting, and Geometry is not among them', async () => {
		const { plugin } = await loadedPlugin(null);
		void plugin;

		// Against the settings SHAPE itself: a geometry-folder field nothing reads would
		// quietly reintroduce the placement decision ADR-011 removed.
		const keys = Object.keys(DEFAULT_SETTINGS);
		expect(keys).toContain('units');
		expect(keys).toContain('projectFolder');
		expect(keys.some((key) => /geometry/i.test(key))).toBe(false);
	});
});
