import type { TFile } from 'obsidian';
import RenovationPlannerPlugin from '../../src/plugin/RenovationPlannerPlugin';
import type { RepositoryStack } from './vault';
import { FakeWorkspace } from './workspace';

/**
 * The three app members the persistence stack reads through. A suite passes a real
 * `createRepositoryStack()` here when it needs the index scan to FIND something — the
 * empty default proves wiring, not contents, and a scan over nothing cannot tell a rebuilt
 * index from an untouched one.
 */
export type VaultSurface = Pick<RepositoryStack, 'vault' | 'fileManager' | 'metadataCache'>;

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
export async function loadedPlugin(
	stored: unknown = null,
	loadFailure?: unknown,
	dataFileExists = stored !== null,
	surface?: VaultSurface,
) {
	const workspace = new FakeWorkspace();
	/**
	 * A content read with no stack behind it THROWS rather than answering emptily. The
	 * listing members above are safe to answer "nothing" for — an empty vault is a real
	 * vault — but "read this file" has no honest empty answer, and a stub that invented one
	 * would let a suite assert about content it never provided.
	 */
	const mustHaveSurface = (): RepositoryStack['vault'] => {
		if (!surface) throw new Error('This test read vault CONTENT; pass a createRepositoryStack() surface.');
		return surface.vault;
	};
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
		// The index scan iterates these. An empty vault is the honest default; a suite that
		// needs the scan to find notes passes a real stack (see tests/helpers/vault.ts),
		// and these then read through IT rather than through a second copy.
		getMarkdownFiles: (): TFile[] => surface?.vault.getMarkdownFiles() ?? [],
		getFiles: (): TFile[] => surface?.vault.getFiles() ?? [],
		getAbstractFileByPath: (path: string): TFile | null => surface?.vault.getAbstractFileByPath(path) ?? null,
		// The CONTENT half, and it was missing — which made this stub thin rather than
		// merely small: the plugin's own repositories read through `this.app.vault`, so a
		// stub that could list files but not read one answered every plan read with
		// `plan-geometry.unreadable`. Invisible until a test built a Plan Editor through the
		// plugin's own view factory, since nothing else here reads an entity end to end.
		// Delegated rather than reimplemented, so there is one FakeVault deciding what a
		// read does.
		read: (file: TFile): Promise<string> => mustHaveSurface().read(file),
		cachedRead: (file: TFile): Promise<string> => mustHaveSurface().cachedRead(file),
		create: (path: string, data: string): Promise<TFile> => mustHaveSurface().create(path, data),
		modify: (file: TFile, data: string): Promise<void> => mustHaveSurface().modify(file, data),
		delete: (file: TFile): Promise<void> => mustHaveSurface().delete(file),
		createFolder: (path: string): Promise<void> => mustHaveSurface().createFolder(path),
		on: (_event: string, handler: (...args: never[]) => void): { off(): void } => {
			vaultHandlers.push(handler);
			return { off: () => undefined };
		},
	};
	// The persistence stack gathers these three from the app; with no surface passed
	// nothing here behaves, which is honest — an empty collaborator answers no note.
	const app = { workspace, vault, fileManager: surface?.fileManager ?? {}, metadataCache: surface?.metadataCache ?? {} };

	const plugin = new RenovationPlannerPlugin(app as never, { id: PLUGIN_ID });
	plugin.data = stored;
	plugin.loadFailure = loadFailure;
	await plugin.onload();
	return { plugin, workspace, asked, vaultHandlers };
}
