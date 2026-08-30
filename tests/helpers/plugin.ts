import type { FileManager, MetadataCache, TAbstractFile, TFile, Vault } from 'obsidian';
import RenovationPlannerPlugin from '../../src/plugin/RenovationPlannerPlugin';
import { FakeWorkspace } from './workspace';

/**
 * What the plugin reaches through the host surfaces — a STRUCTURAL contract, not the fake's
 * classes.
 *
 * It was `Pick<RepositoryStack, 'vault' | 'fileManager' | 'metadataCache'>`, which binds it
 * to `FakeVault`/`FakeFileManager`/`FakeMetadataCache` themselves. All three carry `private`
 * members, and a class with a private member is assignable only from its own declaration —
 * so a SECOND adapter over the same surface can never satisfy that type however faithful it
 * is, and the only way in is a cast that hides the very mismatch this parameter exists to
 * check. Slice 12's disk-backed `FixtureVaultAdapter` is that second adapter.
 */
export interface VaultSurface {
	vault: Pick<
		Vault,
		| 'getMarkdownFiles'
		| 'getFiles'
		| 'getAbstractFileByPath'
		| 'read'
		// `cachedRead` is called by this file's own `cachedRead` delegate below, and a draft
		// of this list omitted it — the widening has to be COMPLETE or it re-creates the hole
		// it removes, one member along.
		// Derive the list by reading every `mustHaveSurface().<member>` call in that file
		// rather than by recalling which ones matter.
		| 'cachedRead'
		| 'create'
		| 'modify'
		| 'delete'
		// NOT `on`. `loadedPlugin` does not delegate it through the surface — it defines its
		// own handler-recording stub (`on`, below), so no member of the passed surface is ever
		// consulted for it. Measured, not merely argued: including it does NOT fail to
		// type-check, because Obsidian's `EventRef` is declared as an EMPTY interface
		// (`obsidian.d.ts:2769`), so `FakeVault.on`'s `{ off(): void }` satisfies it
		// structurally regardless. Excluded anyway, for the reason stated above: nothing here
		// reads it through the surface.
	> & {
		/**
		 * NOT picked from `Vault`, and the exception is deliberate.
		 *
		 * Obsidian declares `createFolder(path: string): Promise<TFolder>`
		 * (`obsidian.d.ts:7312`), while `FakeVault.createFolder` and this file's own
		 * `createFolder` delegate below both return `Promise<void>` — so picking it would fail
		 * type-checking the moment the `*.test-d.ts` pulls this file in, before Task 11 can land.
		 *
		 * `Promise<unknown>` rather than widening the fakes, because the alternative touches
		 * `tests/helpers/vault.ts` — the one file PR 25 edits — and would reopen the conflict
		 * surface this plan just spent a round narrowing to a single `tsconfig.json` line. It
		 * is a genuine widening rather than a fudge: `Promise<TFolder>` is assignable to it,
		 * so production's real `Vault` satisfies this surface too, and the plugin's own callers
		 * ignore the return value.
		 *
		 * The honest cost: this one member is anchored to what the plugin USES rather than to
		 * what Obsidian declares. Recorded here rather than left for a reader to infer from the
		 * `&`.
		 */
		createFolder(path: string): Promise<unknown>;
	};
	fileManager: Pick<FileManager, 'processFrontMatter' | 'trashFile'>;
	metadataCache: Pick<MetadataCache, 'getFileCache'>;
}

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
	const mustHaveSurface = (): VaultSurface['vault'] => {
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
		getAbstractFileByPath: (path: string): TAbstractFile | null => surface?.vault.getAbstractFileByPath(path) ?? null,
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
		createFolder: (path: string): Promise<unknown> => mustHaveSurface().createFolder(path),
		on: (_event: string, handler: (...args: never[]) => void): { off(): void } => {
			vaultHandlers.push(handler);
			return { off: () => undefined };
		},
	};
	// The persistence stack gathers these three from the app; with no surface passed
	// nothing here behaves, which is honest — an empty collaborator answers no note.
	const app = { workspace, vault, fileManager: surface?.fileManager ?? {}, metadataCache: surface?.metadataCache ?? {} };

	// `RenovationPlannerPlugin extends Plugin` resolves against the REAL `obsidian` package's
	// types here — `vitest.config.ts`'s alias to `obsidian-mock.ts` is a vitest-only module
	// resolution, invisible to `vue-tsc` — so the real `Plugin` constructor wants a full
	// `PluginManifest` and carries no `data`/`loadFailure` fields at all; the mock's `Plugin`
	// carries both (`obsidian-mock.ts`). One cast for the constructor's second argument and
	// one for the instance, rather than widening either the real type or the mock's runtime
	// shape, since both are honest as they stand and only this bridge needs to say so.
	const plugin = new RenovationPlannerPlugin(app as never, { id: PLUGIN_ID } as never) as RenovationPlannerPlugin & {
		data: unknown;
		loadFailure: unknown;
	};
	plugin.data = stored;
	plugin.loadFailure = loadFailure;
	await plugin.onload();
	return { plugin, workspace, asked, vaultHandlers };
}
