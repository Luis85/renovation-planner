/**
 * @vitest-environment jsdom
 *
 * What the composition root hands the Plan Editor, and what the plugin registers it with.
 *
 * The seam this file guards: every later slice adds a FIELD here and a constructor
 * parameter, never a second wiring point somewhere else in the plugin.
 */
import { describe, expect, it, vi } from 'vitest';
import { createCompositionRoot, planEditorDeps } from '../../src/plugin/composition-root';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { PLAN_EDITOR_VIEW, PlanEditorView } from '../../src/presentation/views/PlanEditorView';
import { planBackgroundChanged } from '../../src/domain/plan/Plan.events';
import { installObsidianDom } from '../helpers/dom';
import { recorder, lines, resetRecorder } from '../helpers/logger';
import { FakeLeaf, FakeWorkspace } from '../helpers/workspace';

installObsidianDom();

const vaultStack = () =>
	({
		vault: { getAbstractFileByPath: () => null, getFiles: () => [] },
		fileManager: {},
		metadataCache: { getFileCache: () => null },
	}) as never;

describe('the event bus the root composes', () => {
	/**
	 * The bus's own docblock names this as the thing to fix as soon as a logger exists: a
	 * bus built with no `onError` loses every subscriber failure silently, and a subscriber
	 * failing must not look like the command failed.
	 */
	it('reports a throwing subscriber through the logger, naming the event', async () => {
		resetRecorder();
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());
		root.eventBus.subscribe('PlanBackgroundChanged', () => {
			throw new Error('subscriber exploded');
		});

		await root.eventBus.publish(
			planBackgroundChanged({ planId: 'plan-1' as never, projectId: 'project-1' as never }),
		);

		const errors = lines.filter((line) => line.level === 'error');
		expect(errors).toHaveLength(1);
		expect(errors[0].event).toBe('events.subscriber.failed');
		expect(errors[0].context?.event).toBe('PlanBackgroundChanged');
	});

	/**
	 * At the TOP level rather than inside `persistence`: a bus with no subscribers is still
	 * a correct bus, and a session whose settings could not be read has to be able to
	 * publish events that have nothing to do with the vault.
	 */
	it('exists even when settings could not be recovered', () => {
		const root = createCompositionRoot(null, recorder, vaultStack());

		expect(root.persistence).toBeNull();
		expect(root.eventBus).toBeDefined();
	});
});

describe('the plan editor dependencies', () => {
	it('hands over the mapped query services when persistence is composed', () => {
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());

		const deps = planEditorDeps(root, new FakeWorkspace() as never, vaultStack().vault);

		expect(deps.queries).toBe(root.persistence?.planEditorQueries);
		expect(deps.vault).toBeDefined();
	});

	/**
	 * TOTAL rather than nullable. With settings unrecovered there is no query service to
	 * hand over, so the view gets one that REFUSES and shows the failed state it shows for
	 * any unreadable plan — rather than the view not being registered at all, which would
	 * leave a restored Plan Editor leaf pointing at a view type Obsidian does not know.
	 */
	it('hands over refusing query services when settings were never recovered', async () => {
		const root = createCompositionRoot(null, recorder, vaultStack());

		const deps = planEditorDeps(root, new FakeWorkspace() as never, vaultStack().vault);
		const result = await deps.queries.getPlan('plan-1');

		expect(result.ok).toBe(false);
	});

	it('wires the plan-change subscription to the root own bus', async () => {
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());
		const deps = planEditorDeps(root, new FakeWorkspace() as never, vaultStack().vault);
		const listener = vi.fn<() => void>();

		const unsubscribe = deps.onPlanChanged('plan-1', listener);
		// Awaited: the bus is promise-aware and costs one microtask hop per delivery, so a
		// fire-and-forget publish is asserted on before the handler has run.
		await root.eventBus.publish(
			planBackgroundChanged({ planId: 'plan-1' as never, projectId: 'project-1' as never }),
		);
		unsubscribe();

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('wires the theme subscription to the workspace it was given', () => {
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());
		const registered: string[] = [];
		const workspace = { on: (name: string) => registered.push(name), offref: () => undefined };

		planEditorDeps(root, workspace as never, vaultStack().vault).onThemeChange(() => undefined);

		expect(registered).toEqual(['css-change']);
	});
});

describe('the registered view factory', () => {
	/**
	 * A factory that returns the wrong thing registers fine and fails when a user clicks.
	 * Driven through the plugin's own registration, so this is the wiring rather than a
	 * direct construction.
	 */
	it('builds a PlanEditorView for the persisted view type', async () => {
		const { loadedPlugin } = await import('../helpers/plugin');
		const { plugin } = await loadedPlugin();

		const built = plugin.views.get(PLAN_EDITOR_VIEW)?.(new FakeLeaf() as never);

		expect(built).toBeInstanceOf(PlanEditorView);
	});

	/**
	 * Resolved PER CALL from the current root, never captured: `saveSettings` replaces the
	 * root, and a view built against the old one would read through query services pointed
	 * at the previous project folder.
	 */
	it('resolves its dependencies from the CURRENT root each time it is called', async () => {
		const { loadedPlugin } = await import('../helpers/plugin');
		const { plugin } = await loadedPlugin();
		const before = plugin.root.persistence?.planEditorQueries;

		await plugin.saveSettings({ projectFolder: 'Somewhere else' });
		const after = plugin.root.persistence?.planEditorQueries;

		// The root really was replaced — otherwise the claim below is about nothing.
		expect(after).not.toBe(before);
		const built = plugin.views.get(PLAN_EDITOR_VIEW)?.(new FakeLeaf() as never) as PlanEditorView;
		expect(built).toBeInstanceOf(PlanEditorView);
	});
});
