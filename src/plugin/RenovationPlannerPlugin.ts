import { Plugin } from 'obsidian';
import { RENOVATION_PROJECT_ICON, RENOVATION_PROJECT_VIEW, RenovationProjectView } from '../presentation/views/RenovationProjectView';
import { tr } from '../presentation/i18n/strings';
import { revealView } from '../infrastructure/obsidian/workspace/revealView';
import { DEFAULT_SETTINGS, settingsFrom, type RenovationPlannerSettings } from './settings/settings';
import { SettingsTab } from './settings/SettingsTab';

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
	settings: RenovationPlannerSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		// Settings first — the SDD's stated onload order (§10) — so everything registered
		// below may read them. The merge is pure (`settingsFrom`); only the `loadData`
		// call lives here, in the layer allowed to name it.
		this.settings = settingsFrom(await this.loadData());
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
	}

	/**
	 * The one write path for settings, so no control has to know how they are persisted —
	 * and so a future migration or debounce has a single place to live. `saveData` replaces
	 * the whole file, which is why the tab mutates `settings` and then calls this rather
	 * than writing a patch.
	 */
	saveSettings(): Promise<void> {
		return this.saveData(this.settings);
	}

	private openProject(): Promise<void> {
		return revealView(this.app.workspace, RENOVATION_PROJECT_VIEW);
	}
}
