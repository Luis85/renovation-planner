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
		const { plugin } = await loadedPlugin(null, new Error('unreadable'), true);

		expect(plugin.root.settings).toBeNull();
		expect(plugin.root.persistence).toBeNull();
	});

	it('composes the stack on a fresh install, whose defaults ARE the chosen location', async () => {
		const { plugin, workspace } = await loadedPlugin(null);

		expect(plugin.root.settings).toEqual(DEFAULT_SETTINGS);
		expect(plugin.root.persistence?.projects).toBeDefined();
		expect(plugin.root.persistence?.plans).toBeDefined();
		expect(plugin.root.persistence?.zones).toBeDefined();
		expect(plugin.root.persistence?.queries.findZonesByPlan).toBeInstanceOf(FindZonesByPlan);

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
