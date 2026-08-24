import RenovationPlannerPlugin from '../../src/plugin/RenovationPlannerPlugin';
import { FakeWorkspace } from './workspace';

/** The plugin id the manifest declares, and what the data-file path is built from. */
const PLUGIN_ID = 'renovation-planner';

/**
 * The ONE place the plugin-under-test ritual lives: the app stub, its `as never` cast,
 * planting what `loadData` will answer, and awaiting `onload`. Two test files performing
 * this separately is two casts to keep honest — when the plugin starts reading a second
 * `app` member, this is the single stub to grow, and every suite meets the change at once.
 *
 * `vault` is that second member, and it is a real stub rather than a mocked module: the
 * plugin builds its data-file path and normalizes it for real, so the path this answers
 * about is the path production code would ask. A mocked probe module would have proven the
 * branch and nothing about the path.
 *
 * `dataFileExists` defaults to whether `stored` was planted, which keeps the fake COHERENT:
 * data on disk implies a file on disk. The interesting case is the incoherent one, and it
 * has to be asked for explicitly — no data but a file present, which is what Obsidian hands
 * a plugin when `data.json` will not parse.
 */
export async function loadedPlugin(stored: unknown = null, loadFailure?: unknown, dataFileExists = stored !== null) {
	const workspace = new FakeWorkspace();
	const asked: string[] = [];
	/** Vault event handlers the plugin registered — tests fire these directly. */
	const vaultHandlers: ((...args: never[]) => void)[] = [];
	const vault = {
		configDir: '.obsidian',
		adapter: {
			exists: (path: string): Promise<boolean> => {
				asked.push(path);
				return Promise.resolve(dataFileExists);
			},
		},
		// The index scan iterates these; an empty vault is the honest default here —
		// suites that need contents build a real stack (see tests/helpers/vault.ts).
		getMarkdownFiles: (): never[] => [],
		getFiles: (): never[] => [],
		getAbstractFileByPath: (): null => null,
		on: (_event: string, handler: (...args: never[]) => void): { off(): void } => {
			vaultHandlers.push(handler);
			return { off: () => undefined };
		},
	};
	// The persistence stack gathers these three from the app; nothing in this stub
	// behaves, so empty collaborators are honest — a test that needs a real vault builds
	// its own stack (see tests/helpers/vault.ts).
	const app = { workspace, vault, fileManager: {}, metadataCache: {} };

	const plugin = new RenovationPlannerPlugin(app as never, { id: PLUGIN_ID });
	plugin.data = stored;
	plugin.loadFailure = loadFailure;
	await plugin.onload();
	return { plugin, workspace, asked, vaultHandlers };
}
