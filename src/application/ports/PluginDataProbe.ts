/**
 * Whether the plugin's own persisted data file is on disk.
 *
 * A port with one question on it, and it exists because of a defect no gate in this
 * repository could have found. Obsidian's `loadData()` does NOT reject when `data.json`
 * cannot be parsed: it catches the `JSON.parse` failure itself, logs `failed to read
 * JSON …` on its own side, and resolves EMPTY. So the shape a caller sees for a fresh
 * install and the shape it sees for a file Obsidian could not read are the same shape, and
 * the settings-write refusal that depends on telling them apart never engaged — measured in
 * a real vault, where a hand-broken `data.json` was replaced with defaults.
 *
 * The existence of the file is the discriminator: no file is a fresh install, a file that
 * came back empty is unreadable. That is a question about the filesystem, so it is a port
 * here and an adapter in `infrastructure/` — the plugin shell must not answer it itself.
 *
 * Deliberately NOT "read the settings file": that would duplicate the path resolution and
 * the parsing `loadData` already owns, to answer a question that only needs a boolean.
 */
export interface PluginDataProbe {
	dataFileExists(): Promise<boolean>;
}
