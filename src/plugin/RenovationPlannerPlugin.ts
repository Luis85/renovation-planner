import { Plugin } from 'obsidian';
import { RENOVATION_PROJECT_ICON, RENOVATION_PROJECT_VIEW, RenovationProjectView } from '../presentation/views/RenovationProjectView';
import { tr } from '../presentation/i18n/strings';
import { revealView } from '../infrastructure/obsidian/workspace/revealView';
import type { LogLevel, Logger } from '../application/ports/Logger';
import { createConsoleLogger } from '../infrastructure/logging/consoleLogger';
import { createCompositionRoot, type CompositionRoot } from './composition-root';
import { settingsFrom, type RenovationPlannerSettings } from './settings/settings';
import { SettingsTab } from './settings/SettingsTab';

/**
 * The threshold is an argument to the adapter, not a setting: this slice's `debug` calls
 * compile and emit nothing, while the levels slice 11 adds still reach a released build
 * where they are worth having. A user-facing switch belongs with slice 11's diagnostics
 * work — "copy diagnostics" and "turn on verbose logging" are the same conversation — and
 * this slice does not add a settings field no feature reads yet.
 */
const LOG_LEVEL: LogLevel = 'info';

/**
 * The plugin shell: the ONLY place anything is registered with Obsidian, and the only layer
 * allowed to reach every other one — it composes them (SDD §9, §10).
 *
 * `onload` registers and nothing more. No domain logic belongs here, and neither does
 * work: startup cost is paid by every user on every launch, and "register, do not scan" is
 * one of the recurring plugin review rejections. The order the SDD states is settings →
 * composition root → workspace views → Bases views → commands → vault listeners → project
 * index, and `onunload` is its reverse: flush pending writes, stop listeners, dispose
 * services.
 *
 * There is no `onunload` here, deliberately. `registerView`, `addRibbonIcon` and
 * `addCommand` are all registered through the `Plugin` base class, which unregisters them
 * itself; a handler that only repeats what the base class already does is a place for a
 * future mistake to hide. It arrives with the first thing that genuinely needs disposing.
 *
 * Measured by coverage like everything else in `src/` — only `src/main.ts` is excluded
 * (`vitest.config.ts`). The wiring here is exactly what breaks silently, so
 * `tests/plugin/registration.test.ts` drives it against the module mock rather than
 * trusting it.
 */
export default class RenovationPlannerPlugin extends Plugin {
	/**
	 * One field, not a bare `settings` one: a view or the settings tab reaches persisted
	 * state through `plugin.root.settings` — one path in, not two that could drift.
	 * Definitely assigned in `onload`, which Obsidian calls before anything can read it.
	 */
	root!: CompositionRoot;

	async onload(): Promise<void> {
		// The logger is deliberately AHEAD of §9's first step rather than inside its list:
		// it is not one of the things bootstrap sets up, it is what the setup steps report
		// through, and the step below is the first one that can fail.
		const logger = createConsoleLogger(LOG_LEVEL);
		logger.debug('plugin.load.started');

		// Settings first of the steps — the SDD's stated onload order (§9) — so everything
		// registered below may read them. The merge is pure (`settingsFrom`); only the
		// `loadData` call lives here, in the layer allowed to name it.
		this.root = createCompositionRoot(await this.loadSettings(logger), logger);
		// The tab is registered, not drawn: Obsidian calls `display()` when the pane is
		// opened. Registering it right after the load keeps the SDD's order readable —
		// nothing below this line can be configured before it exists.
		this.addSettingTab(new SettingsTab(this));

		this.registerView(RENOVATION_PROJECT_VIEW, (leaf) => new RenovationProjectView(leaf));

		// Two ways in, one behaviour: both call the same function, so neither can grow its
		// own idea of what opening the view means. `void` rather than an async handler —
		// Obsidian ignores a returned promise, and the explicit void is what says the
		// rejection is unhandled on purpose here rather than by omission.
		this.addRibbonIcon(RENOVATION_PROJECT_ICON, tr('command.open-project'), () => {
			void this.openProject();
		});

		this.addCommand({
			id: 'open-project',
			name: tr('command.open-project'),
			callback: () => {
				void this.openProject();
			},
		});

		// A `debug` line rather than an `info` one, and that is the publishing guidance
		// rather than taste: a plugin that announces itself on every start is the plainest
		// instance of the "console noise" rejection. What survives as `info` is RARITY —
		// something that happened once and would be worth having in a support thread.
		logger.debug('plugin.loaded');
	}

	/**
	 * `loadData()` RESOLVING null is a fresh install, not a failure: `settingsFrom(null)`
	 * returns defaults and the plugin is fully configured. Only a REJECTION is unrecovered,
	 * and recovery is a reload rather than a repair UI — fixing or removing `data.json` and
	 * toggling the plugin re-runs this. Nothing here re-reads on a timer and nothing writes a
	 * replacement file, because both amount to guessing at data the user still has.
	 */
	private async loadSettings(logger: Logger): Promise<RenovationPlannerSettings | null> {
		try {
			return settingsFrom(await this.loadData());
		} catch (cause) {
			logger.error('settings.load.failed', { cause });
			return null;
		}
	}

	/**
	 * The one write path for settings, so no control has to know how they are persisted.
	 * `saveData` replaces the whole file, which is why this takes the complete next settings
	 * object rather than a patch — and why the root is REPLACED rather than mutated: its
	 * fields are readonly, so there is exactly one way state changes here.
	 */
	saveSettings(next: RenovationPlannerSettings): Promise<void> {
		// Refused for the whole SESSION, not only at bootstrap: a transient read failure
		// must not stamp defaults over a `data.json` that is sitting there intact. The tab
		// is the other writer and is guarded independently (`getSettingDefinitions`).
		if (this.root.settings === null) return Promise.resolve();

		this.root = createCompositionRoot(next, this.root.logger);
		return this.saveData(next);
	}

	private openProject(): Promise<void> {
		return revealView(this.app.workspace, RENOVATION_PROJECT_VIEW);
	}
}
