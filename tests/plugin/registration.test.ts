/**
 * @vitest-environment jsdom
 *
 * What `onload` registers, and that both ways in do the same thing.
 *
 * The plugin shell is measured by coverage like the rest of `src/` (only `src/main.ts`
 * is excluded), and "the ribbon opens the view, once" is exactly the wiring that breaks
 * silently — so it is driven here against the module mock rather than trusted.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { installObsidianDom } from '../helpers/dom';
import RenovationPlannerPlugin from '../../src/plugin/RenovationPlannerPlugin';
import { RENOVATION_PROJECT_VIEW, RenovationProjectView } from '../../src/presentation/views/RenovationProjectView';
import { FakeLeaf, FakeWorkspace } from '../helpers/workspace';

installObsidianDom();

const loaded = async (stored: unknown = null) => {
	const workspace = new FakeWorkspace();
	const plugin = new RenovationPlannerPlugin({ workspace } as never, {});
	plugin.data = stored;
	await plugin.onload();
	return { plugin, workspace };
};

let plugin: RenovationPlannerPlugin;
let workspace: FakeWorkspace;

beforeEach(async () => {
	({ plugin, workspace } = await loaded());
});

describe('what onload registers', () => {
	it('registers the project view under its persisted type', () => {
		expect([...plugin.views.keys()]).toEqual([RENOVATION_PROJECT_VIEW]);
	});

	// A factory that returns the wrong thing registers fine and fails when a user clicks.
	it('registers a factory that builds the view', () => {
		const built = plugin.views.get(RENOVATION_PROJECT_VIEW)?.(new FakeLeaf() as never);

		expect(built).toBeInstanceOf(RenovationProjectView);
	});

	it('adds one ribbon button, named in sentence case', () => {
		expect(plugin.ribbon).toHaveLength(1);
		expect(plugin.ribbon[0].title).toBe('Open renovation project');
		expect(plugin.ribbon[0].icon).not.toBe('');
	});

	/**
	 * The command id must not repeat the plugin id: Obsidian prefixes it itself, so
	 * `renovation-planner:renovation-planner-open-project` is what a duplicated prefix
	 * produces in the palette. It is also a persisted identifier — a user's hotkey binds to
	 * it — so renaming one costs them the binding.
	 */
	it('adds the open command with an unprefixed id', () => {
		expect(plugin.commands.map((c) => c.id)).toEqual(['open-project']);
		expect(plugin.commands[0].name).toBe('Open renovation project');
	});

	// SDD §10: settings load FIRST in onload, so everything registered below may read
	// them. Driven for both halves of `settingsFrom`'s contract: absence and presence.
	it('loads the default settings on a fresh install', () => {
		expect(plugin.settings).toEqual({ units: 'metric' });
	});

	it('loads stored settings over the defaults', async () => {
		const { plugin: withStored } = await loaded({ units: 'imperial' });

		expect(withStored.settings.units).toBe('imperial');
	});
});

describe('both ways in', () => {
	/**
	 * One behaviour, two entry points. Driven separately and then together, because the
	 * failure worth catching is a second entry point growing its own activation — which
	 * looks correct in isolation and opens a duplicate tab the moment a user uses both.
	 */
	it('open the view from the ribbon', async () => {
		plugin.ribbon[0].click();
		await Promise.resolve();

		expect(workspace.getLeavesOfType(RENOVATION_PROJECT_VIEW)).toHaveLength(1);
	});

	it('open the view from the command', async () => {
		plugin.commands[0].callback?.();
		await Promise.resolve();

		expect(workspace.getLeavesOfType(RENOVATION_PROJECT_VIEW)).toHaveLength(1);
	});

	it('share one leaf between them', async () => {
		plugin.ribbon[0].click();
		await Promise.resolve();
		plugin.commands[0].callback?.();
		await Promise.resolve();

		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.revealed).toHaveLength(2);
	});
});
