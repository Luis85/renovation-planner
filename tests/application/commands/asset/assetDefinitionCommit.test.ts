import { describe, expect, it } from 'vitest';
import { UpdateAssetCommand } from '../../../../src/application/commands/asset/UpdateAsset';
import { ListCatalogueEntries } from '../../../../src/application/queries/ListCatalogueEntries';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectOk, expectErr } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';

describe('asset definition conditional commit against vault notes', () => {
	it('saves metadata and height together and preserves unrelated frontmatter and body', async () => {
		const stack = createRepositoryStack();
		const asset = makeAsset({ supplier: 'Timber supplier', notes: 'Keep these notes', height: 10 });
		expectOk(await stack.assets.save(asset, 'absent'));
		const path = stack.index.getPath(asset.id);
		if (path === undefined) throw new Error('missing asset path');
		const text = stack.vault.entries.get(path);
		if (text === undefined) throw new Error('missing note');
		stack.vault.entries.set(path, text.replace('---', '---\ncustom-property: preserved') + '\nKeep this body.');
		const entry = expectOk(await new ListCatalogueEntries(stack.assets, stack.index).execute()).entries[0];
		if (entry === undefined) throw new Error('missing entry');
		const command = new UpdateAssetCommand(stack.assets, stack.requirements, createEventBus(), new ReferenceLocks());
		expectOk(await command.execute({ assetId: asset.id, expected: entry.version, changes: { supplier: 'Northern timber supplier', height: 190 } }));
		const stored = expectOk(await stack.assets.getById(asset.id));
		expect(stored?.entity).toMatchObject({ supplier: 'Northern timber supplier', height: 190, notes: 'Keep these notes' });
		expect(stack.vault.entries.get(path)).toContain('custom-property: "preserved"');
		expect(stack.vault.entries.get(path)).toContain('Keep this body.');
	});
	it('refuses a note externally edited after the form baseline without overwriting it', async () => {
		const stack = createRepositoryStack(); const asset = makeAsset({ supplier: 'original' });
		const loaded = expectOk(await stack.assets.save(asset, 'absent'));
		const path = stack.index.getPath(asset.id);
		if (path === undefined) throw new Error('missing path');
		const note = stack.vault.entries.get(path);
		if (note === undefined) throw new Error('missing note');
		stack.vault.entries.set(path, note.replace('original', 'external'));
		const command = new UpdateAssetCommand(stack.assets, stack.requirements, createEventBus(), new ReferenceLocks());
		expect(expectErr(await command.execute({ assetId: asset.id, expected: loaded.version, changes: { supplier: 'draft', height: 190 } })).code).toBe('asset.external-modification');
		expect(stack.vault.entries.get(path)).toContain('external');
		expect(expectOk(await stack.assets.getById(asset.id))?.entity.height).toBeNull();
	});
	it('validates the whole form before writing any field', async () => {
		const stack = createRepositoryStack(); const asset = makeAsset({ supplier: 'original' });
		const loaded = expectOk(await stack.assets.save(asset, 'absent'));
		const command = new UpdateAssetCommand(stack.assets, stack.requirements, createEventBus(), new ReferenceLocks());
		expect(expectErr(await command.execute({ assetId: asset.id, expected: loaded.version, changes: { supplier: 'draft', height: -1 } })).code).toBe('asset.negative-height');
		expect(expectOk(await stack.assets.getById(asset.id))?.entity.supplier).toBe('original');
	});
});
