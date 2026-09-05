import type { Asset } from '../../../src/domain/asset/Asset';
import type { Result } from '../../../src/core/result/Result';
/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '../../../src/core/result/Result';
import { markTechnicalFault } from '../../../src/core/errors/technical-fault';
import { useAssetLibraryStore } from '../../../src/presentation/stores/AssetLibraryStore';
import { installObsidianDom } from '../../helpers/dom';
import { anEntry } from '../../helpers/assetLibraryRootHarness';
import { mountInspector } from '../../helpers/assetInspectorHarness';
import { makeAsset } from '../../helpers/entities';
import { settle } from '../../helpers/async';
import type { UpdateAssetInput, UpdateAssetErrors } from '../../../src/application/commands/asset/UpdateAsset';
import type { CatalogueEntryDto } from '../../../src/application/queries/ListCatalogueEntries';
import type { ObservationToken } from '../../../src/application/ports/versioning';

installObsidianDom();
type Update = (input: UpdateAssetInput) => Promise<Result<Asset, UpdateAssetErrors>>;
const refused = () => err({ category: 'Validation' as const, code: 'asset.unit-kind-referenced', message: 'refused' });

describe('explicit asset definition draft', () => {
	it('keeps blur local and submits one change bag including height and factor conversion', async () => {
		let entry = anEntry();
		const execute = vi.fn<Update>((input: UpdateAssetInput) => {
			entry = { ...entry, name: input.changes.name ?? entry.name, category: input.changes.category ?? entry.category, unitCostAmount: input.changes.unitCost?.amount.toString() ?? entry.unitCostAmount, sku: input.changes.sku ?? null, notes: input.changes.notes ?? null, supplier: input.changes.supplier ?? null, height: input.changes.height ?? null,
				wasteFactorDefault: input.changes.wasteFactorDefault?.toString() ?? entry.wasteFactorDefault,
				version: { revision: 2, observed: 'saved' as ObservationToken } };
			return Promise.resolve(ok(makeAsset({ id: entry.assetId })));
		});
		const { panel } = await mountInspector({ assetId: entry.assetId, entries: [entry],
			queries: { listCatalogue: () => Promise.resolve(ok({ entries: [entry], unreadable: [] })) }, commands: { updateAsset: { execute } } });
		await panel.get('[data-field="supplier"]').setValue('Northern timber supplier');
		await panel.get('[data-field="supplier"]').trigger('blur');
		expect(execute).not.toHaveBeenCalled();
		await panel.get('[data-field="name"]').setValue('Oak cabinet');
		await panel.get('[data-field="category"]').setValue('furniture');
		await panel.get('[data-field="unitCost"]').setValue(' 249.50 ');
		await panel.get('[data-field="sku"]').setValue('OC-100');
		await panel.get('[data-field="notes"]').setValue('Site delivery');
		await panel.get('[data-field="waste"]').setValue('12.5');
		await panel.get('[data-field="height"]').setValue('190');
		await panel.get('.rp-al-definition').trigger('submit');
		await settle();
		expect(execute).toHaveBeenCalledTimes(1);
		expect(execute.mock.calls[0]?.[0]).toMatchObject({ expected: { revision: 1 }, changes: { name: 'Oak cabinet', category: 'furniture', sku: 'OC-100', notes: 'Site delivery', supplier: 'Northern timber supplier', height: 190 } });
		expect(execute.mock.calls[0]?.[0].changes.wasteFactorDefault?.toString()).toBe('0.125');
		expect(execute.mock.calls[0]?.[0].changes.unitCost?.amount.toString()).toBe('249.5');
		expect(panel.text()).toContain('Asset saved');
		panel.unmount();
	});

	it('clears nullable metadata and height in one definition change', async () => {
		const entry = { ...anEntry(), height: 190, notes: 'old notes', sku: 'old sku' };
		const execute = vi.fn<Update>(() => Promise.resolve(refused()));
		const { panel } = await mountInspector({ assetId: entry.assetId, entries: [entry], commands: { updateAsset: { execute } } });
		for (const field of ['supplier', 'sku', 'notes', 'height']) await panel.get(`[data-field="${field}"]`).setValue('');
		await panel.get('.rp-al-definition').trigger('submit'); await settle();
		expect(execute.mock.calls[0]?.[0].changes).toEqual({ supplier: null, sku: null, notes: null, height: null });
		panel.unmount();
	});
	it('retains a refused unit and routes the error to that field', async () => {
		const entry = anEntry();
		const { panel } = await mountInspector({ assetId: entry.assetId, entries: [entry], commands: { updateAsset: { execute: () => Promise.resolve(refused()) } } });
		await panel.get('[data-field="unit"]').setValue('m');
		await panel.get('.rp-al-definition').trigger('submit'); await settle();
		expect(panel.get('[data-field="unit"]').attributes('aria-invalid')).toBe('true');
		expect((panel.get('[data-field="unit"]').element as HTMLSelectElement).value).toBe('m');
		panel.unmount();
	});
	it.each([['unitCost', 'NaN'], ['unitCost', '0xff'], ['unitCost', '1_000'], ['waste', '101'], ['waste', 'Infinity'], ['height', '-1'], ['name', '   ']])('rejects invalid %s input %s before dispatch', async (field, value) => {
		const entry = anEntry(); const execute = vi.fn<Update>(() => Promise.resolve(refused()));
		const { panel } = await mountInspector({ assetId: entry.assetId, entries: [entry], commands: { updateAsset: { execute } } });
		await panel.get(`[data-field="${field}"]`).setValue(value);
		await panel.get('.rp-al-definition').trigger('submit');
		expect(execute).not.toHaveBeenCalled();
		expect(panel.get(`[data-field="${field}"]`).attributes('aria-invalid')).toBe('true');
		panel.unmount();
	});
	it('discards locally and never writes on Escape', async () => {
		const entry = anEntry(); const execute = vi.fn<Update>(() => Promise.resolve(refused()));
		const { panel } = await mountInspector({ assetId: entry.assetId, entries: [entry], commands: { updateAsset: { execute } } });
		await panel.get('[data-field="supplier"]').setValue('draft');
		await panel.get('[data-field="supplier"]').trigger('keydown', { key: 'Escape' });
		expect((panel.get('[data-field="supplier"]').element as HTMLInputElement).value).toBe('draft');
		await panel.get('.rp-al-draft-actions button[type="button"]').trigger('click');
		expect((panel.get('[data-field="supplier"]').element as HTMLInputElement).value).toBe(entry.supplier);
		expect(execute).not.toHaveBeenCalled(); panel.unmount();
	});
	it('blocks duplicate submissions while the command is pending', async () => {
		const entry = anEntry(); const pending: { finish?: () => void } = {};
		const execute = vi.fn<Update>(() => new Promise<ReturnType<typeof refused>>((resolve) => { pending.finish = () => resolve(refused()); }));
		const { panel } = await mountInspector({ assetId: entry.assetId, entries: [entry], commands: { updateAsset: { execute } } });
		await panel.get('[data-field="supplier"]').setValue('draft');
		await panel.get('.rp-al-definition').trigger('submit'); await panel.get('.rp-al-definition').trigger('submit');
		expect(execute).toHaveBeenCalledTimes(1); pending.finish?.(); await settle(); panel.unmount();
	});
	it('preserves confirmed input and allows only a read after read-back fails', async () => {
		let fail = false; let entry = anEntry();
		const execute = vi.fn<Update>(() => { fail = true; return Promise.resolve(ok(makeAsset({ id: entry.assetId }))); });
		const { panel } = await mountInspector({ assetId: entry.assetId, entries: [entry], commands: { updateAsset: { execute } },
			queries: { listCatalogue: () => Promise.resolve(fail ? err({ category: 'Persistence', code: 'vault.read-failed', message: 'failed' }) : ok({ entries: [entry], unreadable: [] })) } });
		await panel.get('[data-field="supplier"]').setValue('confirmed');
		await panel.get('.rp-al-definition').trigger('submit'); await settle();
		expect(panel.text()).toContain('Asset saved. Refresh needed');
		expect((panel.get('[data-field="supplier"]').element as HTMLInputElement).value).toBe('confirmed');
		await panel.get('.rp-al-definition').trigger('submit');
		expect(execute).toHaveBeenCalledTimes(1);
		fail = false; entry = { ...entry, supplier: 'confirmed', version: { revision: 2, observed: 'confirmed' as ObservationToken } };
		await panel.get('.rp-al-draft-actions button[type="button"]').trigger('click'); await settle();
		expect(panel.text()).not.toContain('Refresh needed');
		expect(panel.get('.rp-al-definition button[type="submit"]').attributes('disabled')).toBeDefined();
		expect(execute).toHaveBeenCalledTimes(1); panel.unmount();
	});
	it('blocks retry of a mapped technical fault with unknown write outcome', async () => {
		const entry = anEntry(); const execute = vi.fn<Update>(() => Promise.resolve(err(markTechnicalFault({ category: 'Persistence' as const, code: 'vault.unexpected-failure', message: 'unknown' }))));
		const { panel } = await mountInspector({ assetId: entry.assetId, entries: [entry], commands: { updateAsset: { execute } } });
		await panel.get('[data-field="supplier"]').setValue('draft');
		await panel.get('.rp-al-definition').trigger('submit'); await settle();
		await panel.get('.rp-al-definition').trigger('submit');
		expect(execute).toHaveBeenCalledTimes(1); expect(panel.text()).toContain('outcome could not be confirmed'); panel.unmount();
	});
	it('shows external differences without replacing the local draft', async () => {
		let entry: CatalogueEntryDto = anEntry(); const execute = vi.fn<Update>(() => Promise.resolve(refused()));
		const listCatalogue = () => Promise.resolve(ok({ entries: [entry], unreadable: [] }));
		const { panel } = await mountInspector({ assetId: entry.assetId, entries: [entry], queries: { listCatalogue }, commands: { updateAsset: { execute } } });
		await panel.get('[data-field="supplier"]').setValue('my draft');
		entry = { ...entry, supplier: 'external', version: { revision: 2, observed: 'external' as ObservationToken } };
		await useAssetLibraryStore().hydrate({ listCatalogue } as never, () => true); await settle();
		expect(panel.text()).toContain('external'); expect((panel.get('[data-field="supplier"]').element as HTMLInputElement).value).toBe('my draft');
		await panel.get('.rp-al-definition').trigger('submit'); expect(execute).not.toHaveBeenCalled(); panel.unmount();
	});
});


describe('write-boundary conflict recovery', () => {
	it.each(['asset.revision-conflict', 'asset.external-modification'])('requires a successful read and explicit discard after %s', async (code) => {
		let entry = anEntry(); let failRead = false;
		const execute = vi.fn<Update>(() => Promise.resolve(err({ category: 'Persistence', code, message: 'conflict' })));
		const listCatalogue = () => Promise.resolve(failRead ? err({ category: 'Persistence' as const, code: 'vault.read-failed', message: 'read failed' }) : ok({ entries: [entry], unreadable: [] }));
		const { panel } = await mountInspector({ assetId: entry.assetId, entries: [entry], queries: { listCatalogue }, commands: { updateAsset: { execute } } });
		await panel.get('[data-field="supplier"]').setValue('my draft');
		await panel.get('.rp-al-definition').trigger('submit'); await settle();
		const retry = () => panel.get('.rp-al-draft-actions button:last-child');
		expect(retry().text()).toBe('Try again');
		expect(panel.get('button[type="submit"]').attributes('disabled')).toBeDefined();
		await panel.get('.rp-al-definition').trigger('submit'); expect(execute).toHaveBeenCalledTimes(1);
		failRead = true;
		await retry().trigger('click'); await settle();
		expect(panel.get('button[type="submit"]').attributes('disabled')).toBeDefined();
		expect((panel.get('[data-field="supplier"]').element as HTMLInputElement).value).toBe('my draft');
		failRead = false;
		entry = { ...entry, supplier: 'external', version: { revision: 2, observed: 'fresh' as ObservationToken } };
		await retry().trigger('click'); await settle();
		expect(panel.text()).toContain('external');
		expect(panel.get('button[type="submit"]').attributes('disabled')).toBeDefined();
		await panel.get('.rp-al-draft-actions button[type="button"]').trigger('click');
		await panel.get('[data-field="supplier"]').setValue('new draft');
		await panel.get('.rp-al-definition').trigger('submit'); await settle();
		expect(execute).toHaveBeenCalledTimes(2);
		expect(execute.mock.calls[1]?.[0].expected).toEqual(entry.version);
		panel.unmount();
	});
});
