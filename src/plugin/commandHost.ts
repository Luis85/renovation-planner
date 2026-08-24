import type { App, Command } from 'obsidian';
import type { CompositionRoot } from './composition-root';

/**
 * What a command module needs from the plugin, and nothing more.
 *
 * Extracted the moment there was a SECOND command module (`sampleProject.ts` beside
 * `planEditorCommands.ts`): both take exactly this, and two copies of a three-member
 * interface is the shape that drifts — one gains a member the other lacks and the plugin
 * satisfies both by accident.
 *
 * A structural interface rather than `RenovationPlannerPlugin`, and that is the point: a
 * test drives a command family with three members instead of a loaded plugin, and no
 * command module can reach the rest of the shell.
 *
 * `root` is read PER CALL by every consumer here, never captured — `saveSettings` replaces
 * the composition root, and a command closing over the one it was registered with would
 * keep writing through repositories pointed at the previous project folder.
 */
export interface PluginCommandHost {
	readonly app: App;
	readonly root: CompositionRoot;
	addCommand(command: Command): unknown;
}
