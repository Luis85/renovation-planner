/**
 * @vitest-environment jsdom
 *
 * What the composition root hands the Plan Editor, and what the plugin registers it with.
 *
 * The seam this file guards: every later slice adds a FIELD here and a constructor
 * parameter, never a second wiring point somewhere else in the plugin.
 */
import { describe, expect, it, vi } from 'vitest';
import { createCompositionRoot, type VaultStack } from '../../src/plugin/composition-root';
import { planEditorDeps } from '../../src/plugin/planEditorDeps';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { PLAN_EDITOR_VIEW, PlanEditorView } from '../../src/presentation/views/PlanEditorView';
import { planBackgroundChanged } from '../../src/domain/plan/Plan.events';
import { t } from '../../src/presentation/i18n/strings';
import { activateNotices } from '../../src/presentation/notices/notify';
import { installObsidianDom } from '../helpers/dom';
import { recorder, lines, resetRecorder } from '../helpers/logger';
// Mock-only surface, imported BY NAME — see `sequenceNoticeWiring.test.ts`'s own comment for
// why this is the same class the `'obsidian'` alias resolves to.
import { Notice } from '../helpers/obsidian-mock';
import { FakeLeaf, FakeWorkspace } from '../helpers/workspace';

installObsidianDom();

// Typed as `VaultStack`, not `as never`: the cast made every `.vault` read below an error,
// because `never` has no properties. `as never` on a whole double is the spelling that hides
// which members it is actually standing in for.
const vaultStack = (): VaultStack =>
	({
		vault: { getAbstractFileByPath: () => null, getFiles: () => [] },
		fileManager: {},
		metadataCache: { getFileCache: () => null },
	}) as unknown as VaultStack;

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
	 * Design spec §2.6: the SAME `openProjectNote` the project view uses, because that
	 * function resolves ANY entity id through the index — a plan's note needs no second
	 * opener. `'missing'` is `openProjectNote`'s own answer for an id the index does not
	 * resolve, which a made-up id always is.
	 */
	it('binds openNote to the real index-resolving opener when persistence is composed', async () => {
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());
		const workspace = new FakeWorkspace();
		const stack = vaultStack();
		const deps = planEditorDeps(root, workspace as never, stack.vault);

		expect(await deps.openNote('no-such-id')).toBe('missing');
	});

	/**
	 * The refusal shape every sibling `unavailable*` bundle uses (`showDiagnosticsReport`,
	 * `unavailablePlanEditorCommands`'s own `settings.unrecovered` codes): with no persistence
	 * there is no index to resolve through, so the honest answer is `'failed'`, notified once
	 * here rather than left to whatever called `openNote` to discover silently.
	 */
	it('answers failed and notifies when settings were never recovered', async () => {
		activateNotices();
		Notice.shown.length = 0;
		const root = createCompositionRoot(null, recorder, vaultStack());
		const deps = planEditorDeps(root, new FakeWorkspace() as never, vaultStack().vault);

		expect(await deps.openNote('any')).toBe('failed');
		expect(Notice.shown.at(-1)).toBe(t('en', 'settings.unrecovered'));
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

	/**
	 * The theme case's sibling, and it earns its place for the reason that one does: the member is
	 * REQUIRED, so a root that passes nothing fails to build — and a root that passes a FRESH
	 * no-op compiles, passes every other case here, and leaves both surfaces deaf to the file
	 * events PR 43's idle-sheet finding is about. The compiler covers the missing argument; only
	 * this covers the wrong one.
	 *
	 * Asserted by the exact set rather than by a count, so an event dropping OUT is as visible as
	 * one joining: `create` is what makes a dangling reference live again when the file comes
	 * back, and `rename` is the one that reports two paths.
	 */
	it('wires the vault-file subscription to the vault it was given', () => {
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());
		const registered: string[] = [];
		const vault = { on: (name: string) => registered.push(name), offref: () => undefined };

		planEditorDeps(root, { on: () => undefined, offref: () => undefined } as never, vault as never)
			.onVaultFileChanged(() => undefined);

		expect(registered.toSorted()).toEqual(['create', 'delete', 'modify', 'rename']);
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
