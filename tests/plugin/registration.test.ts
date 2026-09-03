/**
 * @vitest-environment jsdom
 *
 * What `onload` registers, and that both ways in do the same thing.
 *
 * The plugin shell is measured by coverage like the rest of `src/` (only `src/main.ts`
 * is excluded), and "the ribbon opens the view, once" is exactly the wiring that breaks
 * silently — so it is driven here against the module mock rather than trusted.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installObsidianDom } from '../helpers/dom';

import {
	RENOVATION_PROJECT_ICON,
	RENOVATION_PROJECT_VIEW,
	RenovationProjectView,
} from '../../src/presentation/views/RenovationProjectView';
import { GEOMETRY_SIDECAR_VIEW, GeometrySidecarView } from '../../src/presentation/views/GeometrySidecarView';
import { PLAN_EDITOR_VIEW } from '../../src/presentation/views/PlanEditorView';
import { ASSET_DESIGNER_VIEW, AssetDesignerView } from '../../src/presentation/designer/AssetDesignerView';
import { ASSET_LIBRARY_VIEW, AssetLibraryView } from '../../src/presentation/library/AssetLibraryView';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { t } from '../../src/presentation/i18n/strings';
import { loadedPlugin, type LoadedPlugin } from '../helpers/plugin';
import { FakeLeaf, type FakeWorkspace } from '../helpers/workspace';
import { levelChanges, levels, lines, recorder, resetRecorder } from '../helpers/logger';
import { settle } from '../helpers/async';


// Hoisted above the imports by vitest, which is why the factory imports the helper itself
// rather than closing over a module-scope binding that would not exist yet. Measured, not
// assumed: the static form fails with `Cannot access '__vi_import_5__' before
// initialization` — vitest rewrites the import into a lazy binding the hoisted factory
// reaches before it is initialised.
vi.mock('../../src/infrastructure/logging/consoleLogger', async () => (await import('../helpers/logger')).consoleLoggerMock());

installObsidianDom();

let plugin: LoadedPlugin;
let workspace: FakeWorkspace;

beforeEach(async () => {
	resetRecorder();
	({ plugin, workspace } = await loadedPlugin());
});

describe('what onload registers', () => {
	it('registers each view under its persisted type', () => {
		expect([...plugin.views.keys()]).toEqual([
			RENOVATION_PROJECT_VIEW,
			PLAN_EDITOR_VIEW,
			// ADR-0015's fourth registration and third workspace surface. A view type is DATA:
			// Obsidian persists it in the layout, so this list is asserted rather than counted.
			ASSET_DESIGNER_VIEW,
			// §2's fifth registration and fourth workspace surface — the vault-wide catalogue,
			// a singleton like the project view rather than per-subject like the two above it.
			ASSET_LIBRARY_VIEW,
			GEOMETRY_SIDECAR_VIEW,
		]);
	});

	/**
	 * A factory that returns the wrong thing registers fine and fails when a user clicks, which
	 * is why the project view already has this case. The designer's is the one that MATTERS
	 * most of the four: it is the only registered view whose factory has to reach a bundle that
	 * did not exist before this task, so a composition that forgot `assetDesignerDeps` would
	 * register perfectly and throw on the first open.
	 */
	it('registers a factory that builds the asset designer', () => {
		const built = plugin.views.get(ASSET_DESIGNER_VIEW)?.(new FakeLeaf() as never);

		expect(built).toBeInstanceOf(AssetDesignerView);
	});

	// A factory that returns the wrong thing registers fine and fails when a user clicks.
	it('registers a factory that builds the view', () => {
		const built = plugin.views.get(RENOVATION_PROJECT_VIEW)?.(new FakeLeaf() as never);

		expect(built).toBeInstanceOf(RenovationProjectView);
	});

	/**
	 * The library's own factory has to reach `assetLibraryDeps`, which did not exist before
	 * this task — the same reason the designer's own case above matters most of the four.
	 */
	it('registers a factory that builds the asset library', () => {
		const built = plugin.views.get(ASSET_LIBRARY_VIEW)?.(new FakeLeaf() as never);

		expect(built).toBeInstanceOf(AssetLibraryView);
	});

	/**
	 * Asserted THROUGH the string table, not against a literal: the subject here is that
	 * the ribbon is wired through `tr()` (a literal pin would break on every copy edit
	 * while proving nothing about the wiring — sentence case is `en.ts`'s lint's job).
	 * The icon is asserted against the view's exported constant for the same reason: one
	 * fact, and a ribbon disagreeing with the tab it opens is invisible to every check.
	 */
	it('adds one ribbon button, named from the string table', () => {
		expect(plugin.ribbon).toHaveLength(1);
		expect(plugin.ribbon[0].title).toBe(t('en', 'command.open-project'));
		expect(plugin.ribbon[0].icon).toBe(RENOVATION_PROJECT_ICON);
	});

	/**
	 * The command id must not repeat the plugin id: Obsidian prefixes it itself, so
	 * `renovation-planner:renovation-planner-open-project` is what a duplicated prefix
	 * produces in the palette. It is also a persisted identifier — a user's hotkey binds to
	 * it — so renaming one costs them the binding.
	 */
	it('adds every command with an unprefixed id', () => {
		expect(plugin.commands.map((c) => c.id)).toEqual([
			'open-project',
			// Slice 21's SECOND door into this view, and a second id rather than new behaviour
			// behind the first for exactly the reason above: a user's hotkey on `open-project`
			// means "show me the pane", and it must not start meaning "open a fuzzy picker".
			'open-project-detail',
			// One of the diagnostics report's TWO doors; the settings action row is the other,
			// and both reach `openDiagnosticsReport`. Pinned here as an id like the rest,
			// because a user's hotkey binds to this string.
			'show-diagnostics-report',
			// §2's fourth registration's own command: a plain callback, never gated on the
			// active note, exactly like every other command in this list.
			'open-asset-library',
			'open-plan-editor',
			'set-plan-background',
			// Task B9: what makes ADR-0015's Asset Designer reachable at all — a picker over
			// the vault's whole catalogue, the same shape `open-plan-editor` already takes.
			'open-asset-designer',
			// Scaffolding, and it still has to obey the id rule — a user who binds a hotkey to
			// it has bound it to this string. `sampleProject.ts` names what deletes it.
			'create-sample-project',
		]);
	});

	// Sidecars are registered as visible, openable files (ADR-011), wired to their viewer.
	it('registers the rpgeo extension to its viewer view', () => {
		expect([...plugin.extensions.entries()]).toEqual([[['rpgeo'], GEOMETRY_SIDECAR_VIEW]]);
		const built = plugin.views.get(GEOMETRY_SIDECAR_VIEW)?.(new FakeLeaf() as never);
		expect(built).toBeInstanceOf(GeometrySidecarView);
		expect(plugin.commands[0].name).toBe(t('en', 'command.open-project'));
	});

	// SDD §10: settings load FIRST in onload, so everything registered below may read
	// them. Driven for both halves of `settingsFrom`'s contract: absence and presence.
	it('loads the default settings on a fresh install', () => {
		expect(plugin.root.settings).toEqual({ ...DEFAULT_SETTINGS });
	});

	it('loads stored settings over the defaults', async () => {
		const { plugin: withStored } = await loadedPlugin({ ...DEFAULT_SETTINGS, units: 'imperial' });

		expect(withStored.root.settings).toEqual({ ...DEFAULT_SETTINGS, units: 'imperial' });
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
		await settle();

		expect(workspace.getLeavesOfType(RENOVATION_PROJECT_VIEW)).toHaveLength(1);
	});

	it('open the view from the command', async () => {
		plugin.commands[0].callback?.();
		await settle();

		expect(workspace.getLeavesOfType(RENOVATION_PROJECT_VIEW)).toHaveLength(1);
	});

	it('share one leaf between them', async () => {
		// The gap between the two gestures is REAL, and it has to be: a ribbon click and a
		// command invocation are two things a human does one after the other, seconds apart,
		// and a single microtask between them is an input no user can produce. That mattered
		// the moment `revealCandidate` learned to coalesce activations still in flight — with
		// one `await Promise.resolve()` the first activation had not settled, so the second
		// gesture was correctly treated as the same request and revealed nothing of its own.
		// The assertion this file cares about (`leaves`) held either way; `revealed` is what
		// said the stream was wrong. Both hold once the gestures are actually sequential.
		plugin.ribbon[0].click();
		await settle();
		plugin.commands[0].callback?.();
		await settle();

		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.revealed).toHaveLength(2);
	});

	/**
	 * §2's own command, with no ribbon beside it: a plain callback exactly like the other two
	 * above, driven through `plugin.commands` the same way — `openAssetLibrary`'s own
	 * `revealView` call, composed directly on the plugin rather than through
	 * `RenovationProjectDeps.openAssetLibrary`, which `renovationProjectOpenSeams.test.ts` and
	 * `renovationProjectWiring.test.ts` already drive for the other door.
	 */
	it('opens the asset library from its own command', async () => {
		const command = plugin.commands.find((c) => c.id === 'open-asset-library');

		command?.callback?.();
		await settle();

		expect(workspace.getLeavesOfType(ASSET_LIBRARY_VIEW)).toHaveLength(1);
	});
});

describe('the composition root', () => {
	/**
	 * ONE logger, asserted by identity rather than by shape: two different loggers both
	 * satisfy a shape assertion, and "one instance, reached through one path" is the
	 * property every later slice inherits from this seam.
	 */
	it('holds the logger onload constructed', () => {
		expect(levels).toEqual(['info']);
		expect(plugin.root.logger).toBe(recorder);
	});

	/**
	 * The threshold is an argument to the adapter, not a setting: `debug` compiles and emits
	 * nothing in a released build, while the levels slice 11 adds still reach it.
	 */
	it('is reached through one field rather than a bare settings field', () => {
		expect(plugin.root.settings).toEqual({ ...DEFAULT_SETTINGS });
	});

	/**
	 * Slice 11's verbose-logging switch, observed at the wiring rather than the adapter:
	 * a stored `verboseLogging: true` must reach the adapter as a floor change to `debug`
	 * — and a default install (above) must ask for NO change, which is what keeps console
	 * noise a choice the user made.
	 */
	it('widens the log floor only when the stored setting asks for it', async () => {
		expect(levelChanges).toEqual([]);
		await loadedPlugin({ ...DEFAULT_SETTINGS, verboseLogging: true });
		expect(levelChanges).toEqual(['debug']);
	});

	/**
	 * And the toggle is LIVE: `saveSettings` re-applies the floor in both directions, so
	 * flipping it in the pane takes effect without disabling and re-enabling the plugin.
	 */
	it('re-applies the log floor when settings are saved', async () => {
		expect(levelChanges).toEqual([]);

		await plugin.saveSettings({ verboseLogging: true });
		expect(levelChanges).toEqual(['debug']);

		await plugin.saveSettings({ verboseLogging: false });
		expect(levelChanges).toEqual(['debug', 'info']);
	});

	/**
	 * "Console noise: logging that is not an actual error path" is one of the marketplace
	 * rejections only a human reviewer catches, so a released build must be silent unless
	 * something failed. Invisible to a test that only counts calls, which is why the levels
	 * are filtered rather than the length asserted.
	 */
	it('emits nothing above debug on a successful load', () => {
		expect(lines.filter((line) => line.level !== 'debug')).toEqual([]);
	});
});

/**
 * `onunload` is not symmetry for its own sake: the base class already unregisters views,
 * commands and the ribbon, and repeating that would only be somewhere for a mistake to
 * hide. What it exists for is `window.Konva`, which Konva assigns at module scope on every
 * load and nothing removed — so reactivating the plugin logged "Several Konva instances
 * detected" and the previous load's bundle stayed reachable from `window`.
 */
describe('what onunload disposes', () => {
	const host = window as unknown as Record<string, unknown>;

	it('releases the global Konva installed, so a reload has nothing to warn about', async () => {
		// Konva's own module scope has already run for real by the time the plugin loads in
		// this suite, so the global is genuinely there rather than planted.
		host['Konva'] = { version: 'test' };
		const { plugin: loaded } = await loadedPlugin(DEFAULT_SETTINGS);

		loaded.onunload();

		expect('Konva' in host).toBe(false);
	});

	/**
	 * One disposer must not be able to abandon the rest of the teardown. Driven by pushing a
	 * throwing one onto the list, because the alternative — waiting until a real disposer can
	 * throw — is how this arm would stay untested until it mattered.
	 */
	it('logs a failing disposer and keeps disposing', async () => {
		const { plugin: loaded } = await loadedPlugin(DEFAULT_SETTINGS);
		const ran: string[] = [];
		const disposers = (loaded as unknown as { disposers: (() => void)[] }).disposers;
		disposers.push(() => {
			throw new Error('disposer exploded');
		});
		disposers.push(() => ran.push('after'));

		loaded.onunload();

		expect(ran).toEqual(['after']);
		expect(lines.some((line) => line.event === 'plugin.unload.disposer-failed')).toBe(true);
		// And nothing is disposed twice: a second call has an empty list to walk.
		expect(() => loaded.onunload()).not.toThrow();
	});
});
