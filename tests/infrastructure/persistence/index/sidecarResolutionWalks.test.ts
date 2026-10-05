import { describe, expect, it, vi } from 'vitest';
import { createRepositoryStack, serializeFrontmatter } from '../../../helpers/vault';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { VaultChangeAdapter } from '../../../../src/infrastructure/persistence/index/VaultChangeAdapter';

const note = (name: string): string =>
	serializeFrontmatter({ type: 'renovation-asset', id: 'asset-tile', 'schema-version': 1, name });

/**
 * How often `processNote` walks the vault for a missing sidecar mapping — pinned, because the
 * walk is `vault.getFiles()` inside one synchronous flush, and a sync burst of shapeless asset
 * notes would pay it once per note per edit. A NEW entry is resolved from the vault (a plan
 * whose note arrives after its `.rpgeo` event, ruling 41's review I1); an entry already indexed
 * under the same id is not, since nothing about a note edit can have created its sidecar.
 */
describe('resolving a missing sidecar mapping from the vault', () => {
	it('walks once for a first arrival and never for later edits of the same shapeless asset', () => {
		const stack = createRepositoryStack();
		const adapter = new VaultChangeAdapter({
			vault: stack.vault as never,
			metadataCache: stack.metadataCache as never,
			index: stack.index,
			echo: stack.echo,
			logger: stack.logger,
			events: createEventBus(() => undefined),
			debounceMs: 0,
		});
		const path = 'Library/Assets/Tile.md';
		const walks = vi.spyOn(stack.vault, 'getFiles');

		stack.vault.entries.set(path, note('Tile'));
		adapter.onCreate(stack.vault.getAbstractFileByPath(path) as never);
		expect(stack.index.getPath('asset-tile' as never)).toBe(path);
		expect(walks).toHaveBeenCalledTimes(1);

		for (const name of ['Tile 2', 'Tile 3']) {
			stack.vault.entries.set(path, note(name));
			adapter.onModify(stack.vault.getAbstractFileByPath(path) as never);
		}

		expect(walks).toHaveBeenCalledTimes(1);
		expect(stack.index.getGeometrySidecarPath('asset-tile' as never)).toBeUndefined();
	});
});
