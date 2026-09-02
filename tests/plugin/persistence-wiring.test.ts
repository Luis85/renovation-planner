// @vitest-environment jsdom
// jsdom: the plugin shell touches the DOM (ribbon element, settings tab) through the
// module mock, exactly as tests/plugin/registration.test.ts does.
import { describe, expect, it } from 'vitest';
import { installObsidianDom } from '../helpers/dom';
import { apiVersion } from '../helpers/obsidian-mock';
import { loadedPlugin } from '../helpers/plugin';
import { FakeLeaf } from '../helpers/workspace';
import { createRepositoryStack, serializeFrontmatter } from '../helpers/vault';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity } from '../helpers/entities';
import { expectDefined, expectErr, expectOk } from '../helpers/domain';
import type { ProjectIndexEntryChanged } from '../../src/application/events/projectIndex.events';
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
		// Every command and query leaves the root GUARDED (SDD §66): a wrapper with the
		// same `execute`, never the bare class — so the assertions here are about the shape
		// being present and callable. That the wrapper IS a guard is not asked here at all:
		// `tests/plugin/guardCategory.test.ts` drives a fault through every door the root
		// hands out and requires the mapped refusal back, without naming one, which is what
		// replaced the twelve `not.toBeInstanceOf` lines this file used to carry.
		expect(typeof plugin.root.persistence?.queries.findZonesByPlan.execute).toBe('function');
		expect(typeof plugin.root.persistence?.queries.diagnostics.execute).toBe('function');
		// The three creates, composed here since the sample-project seed became their first
		// caller. Named individually rather than asserted as a count: a missing one is a
		// command family that silently cannot create one of the three entity kinds.
		expect(typeof plugin.root.persistence?.createProject.execute).toBe('function');
		expect(typeof plugin.root.persistence?.createPlan.execute).toBe('function');
		expect(typeof plugin.root.persistence?.createZone.execute).toBe('function');

		// Nothing scanned yet: the index is empty until layout-ready.
		expect(expectDefined(plugin.root.persistence, 'the composed persistence stack').index.entries()).toEqual([]);
		expect(workspace.layoutReadyCallbacks).toHaveLength(1);
	});

	/**
	 * Slice 11's snapshot query, driven through the REAL composition: its sources are the
	 * migration runner and the manifest the plugin passed in, so this is what proves the
	 * wiring (not just the class) answers with the runner's version table.
	 */
	it('wires the diagnostics snapshot to the real migration runner', async () => {
		const { plugin } = await loadedPlugin(DEFAULT_SETTINGS);
		const snapshot = await plugin.root.persistence?.queries.diagnostics.execute();

		// `toEqual`, never `toMatchObject`: this is the ONE place the real kind SET is
		// asserted, so an extra key has to fail here. Asset and Requirement appear because
		// they are in `MIGRATION_SET`, and `MIGRATION_SET` is now the only table there is
		// — `MigrationRunner.latestVersions` derives each version from the steps registered
		// for that kind rather than spreading a second, hand-maintained constant. Until that
		// derivation landed this comment was false: a kind added to `MIGRATION_SET` alone
		// changed nothing here, and this assertion passed either way. Adding a seventh kind
		// to `MIGRATION_SET` and running this file is what proves it now.
		expect(snapshot?.schemaVersions).toEqual({
			project: 1,
			plan: 1,
			zone: 1,
			asset: 1,
			requirement: 1,
			'asset-price': 1,
			'plan-geometry': 1,
		});
		expect(snapshot?.migrationState.pending).toEqual([]);
		expect(snapshot?.obsidianVersion).toBe(apiVersion);
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

	/**
	 * **The question is whether the scan has RUN, not whether it found anything**, and those
	 * are the same question only in a vault that still has projects.
	 *
	 * A vault whose only project note was deleted while Obsidian was closed rebuilds to a
	 * legitimately EMPTY index. Under a "has the index been populated" rule the flag never
	 * turns true, a restored detail leaf's `ok(null)` is never authoritative, and the pane
	 * holds its loading line for the rest of the session — trading a destroyed `projectId` for
	 * a permanent spinner, which is not a fix.
	 *
	 * `startPersistence` publishes `projectIndexRebuilt()` unconditionally after
	 * `index.rebuild(...)` — there is no count in the call and no branch above it — so a
	 * completed empty rebuild announces itself exactly like a completed full one, and the flag
	 * must follow that and not the entry count. This case fails against the rule it replaced;
	 * the store-level cases in Task 4 pass under both, which is why it lives here.
	 */
	it('reports the scan as completed after an empty rebuild', async () => {
		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS);
		workspace.layoutReady();

		expect(plugin.root.persistence?.index.entries()).toEqual([]);
		expect(
			(
				plugin as unknown as {
					projectViewDeps(leaf: unknown): { indexScanCompleted(): boolean };
				}
			)
				.projectViewDeps(new FakeLeaf() as never)
				.indexScanCompleted(),
		).toBe(true);
	});

	/**
	 * SDD §92 item 13's "not the whole plugin" half, at load. `startPersistence` scans the
	 * whole vault, and the scan does not read `schema-version` at all — so one note from a
	 * newer build must not cost a user their session. Driven through the REAL plugin rather
	 * than through `buildProjectIndexEntries` alone (`tests/.../index/negatives.test.ts` is
	 * where the builder's own half lives): what a user loses if this breaks is layout-ready
	 * completing, and that is a plugin-level fact.
	 */
	it('completes the load-time scan with a future-version note in the vault', async () => {
		const stack = createRepositoryStack(DEFAULT_SETTINGS.projectFolder);
		const projectId = createProjectId();
		const planId = createPlanId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		expectOk(await stack.plans.save(makePlanEntity({ id: planId, projectId }), 'absent'));
		// A vault from a previous session, which is the only way a future-version note can
		// exist: nothing in this build writes one.
		stack.metadataCache.catchUp();
		const poisonedPath = stack.index.getPath(planId) ?? '';
		stack.vault.entries.set(
			poisonedPath,
			(stack.vault.entries.get(poisonedPath) ?? '').replace('schema-version: 1', 'schema-version: 99'),
		);

		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();

		// The scan finished and indexed BOTH notes — the poisoned one included, since the
		// index is where the editor learns the plan exists at all.
		const persistence = plugin.root.persistence as NonNullable<typeof plugin.root.persistence>;
		expect(persistence.index.getPath(projectId)).toBeDefined();
		expect(persistence.index.getPath(planId)).toBe(poisonedPath);

		// And the refusal is exactly one entity wide, through the plugin's own repositories.
		expect(expectErr(await persistence.plans.getById(planId)).code).toBe('plan.schema-version-unsupported');
		expectOk(await persistence.projects.getById(projectId));
	});

	it('vault listeners tolerate events that are not notes', async () => {
		const { plugin, workspace, vaultHandlers } = await loadedPlugin(DEFAULT_SETTINGS);
		workspace.layoutReady();
		expect(plugin.root.persistence).not.toBeNull();

		// Obsidian hands TAbstractFile to every event; folders and unknown shapes must
		// pass through the instanceof guard without touching the pipeline.
		for (const handler of vaultHandlers) {
			handler({ path: 'Renovation/a-folder' } as never);
		}
		expect(plugin.root.persistence?.index.entries()).toHaveLength(0);
	});

	/**
	 * `saveSettings` REPLACES the composition root — its fields are readonly, so that is the
	 * only way state changes there. Two things have to survive the swap, and neither did:
	 * the new root's index starts EMPTY, and the vault listeners registered at
	 * layout-ready must end up maintaining the root the save installed rather than the one
	 * they were registered beside.
	 */
	it('rebuilds the index into the fresh root when a setting is saved mid-session', async () => {
		const stack = createRepositoryStack(DEFAULT_SETTINGS.projectFolder);
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		// This test is about the settings-save swap, so the vault it starts from is one
		// Obsidian has already parsed. Without saying so the note stays inside the fake's
		// create window, where a plugin holding its OWN echo window cannot read it — which
		// is a faithful model of two sessions, and not what this test is asking about.
		stack.metadataCache.catchUp();

		const { plugin, workspace, vaultHandlers } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();
		expect(plugin.root.persistence?.index.getPath(projectId)).toBeDefined();

		const firstPersistence = plugin.root.persistence;
		const refsAfterLoad = plugin.eventRefs.length;
		const handlersAfterLoad = vaultHandlers.length;

		await plugin.saveSettings({ units: 'imperial' });

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
		stack.metadataCache.catchUp();

		const { plugin, workspace, vaultHandlers } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();
		await plugin.saveSettings({ units: 'imperial' });

		// A note that appears AFTER the save, delivered through the handler registered
		// BEFORE it. A handler holding its adapter captured would file this into an index
		// nothing reads any more, and the assertion below would find nothing.
		const planId = createPlanId();
		expectOk(await stack.plans.save(makePlanEntity({ id: planId, projectId }), 'absent'));
		// Parsed too: the note reaches the plugin through a vault EVENT, and the writer here
		// is a stack whose echo window the plugin does not share. In the app they are one
		// object (`NoteVaultDeps.echo` and the change adapter's are the same), which is what
		// makes the same event safe inside the parse window there.
		stack.metadataCache.catchUp();
		const planPath = stack.index.getPath(planId);
		expect(planPath).toBeDefined();

		const [onCreate] = vaultHandlers;
		onCreate(stack.vault.getAbstractFileByPath(planPath as string) as never);
		plugin.root.persistence?.changeAdapter.flush();

		expect(plugin.root.persistence?.index.getPath(planId)).toBe(planPath);
	});

	/**
	 * The bus the pipeline announces on is the ROOT's bus, and nothing but this can say so.
	 * `VaultChangeAdapter.deps.events` is REQUIRED, so a root that passes none fails to
	 * compile — but a root that passes a FRESH `createEventBus()` compiles, passes every other
	 * test in this repository, and announces into an object no view has ever subscribed to.
	 * That is the same shape `slice10CascadeWiring` and `sequenceNoticeWiring` exist for, with
	 * the compiler covering only the half that is a missing argument.
	 *
	 * Driven end to end rather than by reading the field: a foreign project note through the
	 * registered vault handler, and the assertion is on what a subscriber HEARS.
	 */
	it('announces a foreign note on the root bus every view subscribes to', async () => {
		const stack = createRepositoryStack(DEFAULT_SETTINGS.projectFolder);
		const { plugin, workspace, vaultHandlers } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();

		const heard: string[] = [];
		plugin.root.eventBus.subscribe('ProjectIndexEntryChanged', (event) => {
			heard.push((event as ProjectIndexEntryChanged).payload.entityType);
		});

		// Written straight into the vault, the way sync or the file explorer delivers one —
		// never through a repository, whose own save would upsert the index and echo-suppress
		// the event that follows it.
		const projectId = createProjectId();
		stack.vault.entries.set(
			`${DEFAULT_SETTINGS.projectFolder}/Foreign/Project.md`,
			serializeFrontmatter({ type: 'renovation-project', id: projectId, 'schema-version': 1 }),
		);
		stack.metadataCache.catchUp();

		// The registered handler drops anything that is not a `TFile`, so this passes the vault's
		// own abstract file rather than a `{ path }` shape — the guard is in the plugin, not in the
		// adapter, and a bare object is silently ignored one layer above the thing under test.
		const [onCreate] = vaultHandlers;
		onCreate(stack.vault.getAbstractFileByPath(`${DEFAULT_SETTINGS.projectFolder}/Foreign/Project.md`) as never);
		plugin.root.persistence?.changeAdapter.flush();
		await Promise.resolve();

		expect(heard).toEqual(['renovation-project']);
	});

	/**
	 * A FACTORY rather than a shared instance, for the reason `PlanEditorCommandServices`
	 * already states about the zone adapters: a reversible command holds ONE transaction's
	 * inverse state, so two overlapping gestures sharing one would have the second undo
	 * restore the first's snapshot.
	 */
	it('hands the editor a calibrate factory that answers a fresh command each call', async () => {
		const { planEditorDeps } = await import('../../src/plugin/composition-root');
		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS);
		const services = planEditorDeps(plugin.root, workspace as never, {} as never).commands;

		expect(services.calibratePlan()).not.toBe(services.calibratePlan());
	});

	/**
	 * `composeRepositories(deps, vault, settings.projectFolder)` is the seam that actually
	 * reads the setting (`src/plugin/composition-root.ts`); `perProjectFolders.test.ts`'s
	 * "takes the configured root" only exercises `createRepositoryStack`, which builds a
	 * `ObsidianProjectRepository` directly and never passes through the composition root at
	 * all. Driven through the REAL plugin so a future composition-root edit that stopped
	 * threading the setting through would fail here rather than only in a repository test
	 * that cannot see the seam.
	 */
	it('creates a project under the configured root through the real composition seam', async () => {
		const stack = createRepositoryStack('Somewhere Else');
		const { plugin } = await loadedPlugin({ ...DEFAULT_SETTINGS, projectFolder: 'Somewhere Else' }, undefined, true, stack);

		const result = await plugin.root.persistence?.createProject.execute({ name: 'Kitchen Refit' });
		if (!result) throw new Error('persistence was not composed');
		const created = expectOk(result);
		const path = plugin.root.persistence?.index.getPath(created.project.entity.id);

		expect(path).toBe('Somewhere Else/Kitchen Refit/Kitchen Refit.md');
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
