import { normalizePath, type App } from 'obsidian';
import type { PluginDataProbe } from '../../../application/ports/PluginDataProbe';

/**
 * The one implementation: `adapter.exists` against the plugin's own folder.
 *
 * A READ, and the only vault-adapter call in this slice. It reads no note — the path is
 * `<configDir>/plugins/<id>/data.json`, plugin-local operational data rather than any part
 * of the vault's Markdown record — so the "no note is read or written before slice 4" rule
 * is intact and the write boundary is untouched.
 *
 * The config directory comes from the VAULT rather than a hard-coded `.obsidian`: a vault
 * can be opened with a different one, and a probe that assumed the default would answer
 * about a folder the plugin is not installed in. That answer is "no file", which is the
 * fresh-install answer, which is precisely the wrong one — the same failure this port
 * exists to fix, reintroduced one level down.
 *
 * The plugin id is a PARAMETER rather than an import: `infrastructure/` may not reach
 * `plugin/`, and the composition root is what knows which plugin it is wiring — the same
 * reasoning that makes `revealView` take a view type as a string.
 *
 * A rejection is not caught here. If the vault cannot say whether the file exists, the
 * caller treats that as unrecovered and refuses to write, which is the conservative
 * direction; answering `false` on an error would claim "fresh install" and invite exactly
 * the overwrite this whole path prevents.
 */
export function createPluginDataProbe(app: App, pluginId: string): PluginDataProbe {
	return {
		dataFileExists: () => app.vault.adapter.exists(normalizePath(`${app.vault.configDir}/plugins/${pluginId}/data.json`)),
	};
}
