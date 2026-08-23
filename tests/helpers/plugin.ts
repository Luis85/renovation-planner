import RenovationPlannerPlugin from '../../src/plugin/RenovationPlannerPlugin';
import { FakeWorkspace } from './workspace';

/**
 * The ONE place the plugin-under-test ritual lives: the app stub, its `as never` cast,
 * planting what `loadData` will answer, and awaiting `onload`. Two test files performing
 * this separately is two casts to keep honest — when the plugin starts reading a second
 * `app` member, this is the single stub to grow, and every suite meets the change at once.
 */
export async function loadedPlugin(stored: unknown = null, loadFailure?: unknown) {
	const workspace = new FakeWorkspace();
	const plugin = new RenovationPlannerPlugin({ workspace } as never, {});
	plugin.data = stored;
	plugin.loadFailure = loadFailure;
	await plugin.onload();
	return { plugin, workspace };
}
