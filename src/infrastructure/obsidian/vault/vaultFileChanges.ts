import { TFile, type Vault } from 'obsidian';

/**
 * "A file in the vault appeared, changed, moved or went" — Obsidian's four vault events, as one
 * plain subscribe-returns-unsubscribe function over the PATHS they name.
 *
 * The reason it exists, and it is `BackgroundLayer.vue`'s: a background document is a PNG or a
 * PDF the user put in their vault, so nothing in this plugin's own write pipeline ever hears
 * about it changing. `VaultChangeAdapter` reads `.md` and `.rpgeo` and drops everything else, and
 * the reference in a note's frontmatter does not move when the file it names does — so a surface
 * that had decoded a raster went on drawing it after the file was replaced or deleted, for as
 * long as nothing else happened to re-read the subject. Reported on PR 43 as the residual the
 * document key disclosed: the key carries the file's `mtime:size`, and the only thing that
 * re-evaluated it was a new `reference`.
 *
 * **All four events, and the rename reports BOTH paths.** A `create` matters because a reference
 * that was dangling becomes live the moment a file appears at its path — pick a sheet, delete it,
 * put it back — and refusing to notice that would leave a `missing` status nothing retracts. A
 * rename is a delete at the old path and a create at the new one as far as any reference is
 * concerned, and Obsidian rewrites markdown LINKS on a rename while a frontmatter string is not
 * one: the reference goes stale, so the surface naming the old path has to hear about it.
 *
 * **UNFILTERED, deliberately.** Every listener hears every file, and the subscriber compares the
 * path against the one it cares about — which is a string comparison per event per mounted layer,
 * against the alternative of this module learning what a background is. Filtering here would put
 * the presentation layer's question in `infrastructure/`, and there is more than one asker.
 *
 * `offref` and not `off`, for `createThemeChangeSource`'s reason: Obsidian's `on` mints a
 * reference and `offref` is what retires that one registration, while `off(name, callback)`
 * compares callbacks and silently fails to detach a bound or wrapped one. Four references,
 * released together, because a partial release is a listener that outlives its view.
 *
 * `instanceof TFile` because Obsidian hands `TAbstractFile` to every one of these and a FOLDER
 * has no bytes to draw — the same narrowing `createVaultFileProbe` and `loadBackground` each
 * state their own reason for.
 */
export function createVaultFileChangeSource(vault: Vault): (listener: (path: string) => void) => () => void {
	return (listener: (path: string) => void) => {
		const references = [
			vault.on('create', (file) => {
				if (file instanceof TFile) listener(file.path);
			}),
			vault.on('modify', (file) => {
				if (file instanceof TFile) listener(file.path);
			}),
			vault.on('delete', (file) => {
				if (file instanceof TFile) listener(file.path);
			}),
			vault.on('rename', (file, oldPath) => {
				if (!(file instanceof TFile)) return;
				listener(oldPath);
				listener(file.path);
			}),
		];
		return () => {
			for (const reference of references) vault.offref(reference);
		};
	};
}
