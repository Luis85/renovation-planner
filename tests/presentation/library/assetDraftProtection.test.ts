/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { anEntry, mountRoot } from '../../helpers/assetLibraryRootHarness';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/async';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';

installObsidianDom();
describe('asset draft navigation protection', () => {
	it('keeps A on cancellation and performs the requested B selection once after discard', async () => {
		const a = anEntry(); const b = anEntry({ name: 'Paint' });
		const root = await mountRoot({ entries: [a, b], assetId: ref(a.assetId), expanded: ref(['material']) });
		await root.get('[data-field="supplier"]').setValue('my draft');
		await root.get(`[data-asset-id="${b.assetId}"]`).trigger('click'); await settle();
		expect(root.text()).toContain('Discard and continue');
		useDialogStore().resolve('cancel'); await settle();
		expect(root.attributes('data-selected-asset-id')).toBe(a.assetId);
		expect((root.get('[data-field="supplier"]').element as HTMLInputElement).value).toBe('my draft');
		await root.get(`[data-asset-id="${b.assetId}"]`).trigger('click'); await settle();
		useDialogStore().resolve('confirm'); await settle();
		expect(root.attributes('data-selected-asset-id')).toBe(b.assetId);
		expect((root.get('[data-field="supplier"]').element as HTMLInputElement).value).toBe(b.supplier);
		root.unmount();
	});
	it('shows a new externally requested selection after returning to the shelf', async () => {
		const a = anEntry(); const b = anEntry({ name: 'Paint' }); const assetId = ref<string>(a.assetId);
		const root = await mountRoot({ entries: [a, b], assetId });
		await root.get('.rp-al-inspector__back').trigger('click');
		assetId.value = b.assetId; await settle();
		expect(root.attributes('data-selected-asset-id')).toBe(b.assetId);
		expect(root.get('.rp-al-inspector__name').text()).toBe('Paint'); root.unmount();
	});
	it('restores the published selection when an external switch is cancelled', async () => {
		const a = anEntry(); const b = anEntry(); const assetId = ref<string>(a.assetId);
		const root = await mountRoot({ entries: [a, b], assetId });
		await root.get('[data-field="supplier"]').setValue('my draft');
		assetId.value = b.assetId; await settle();
		useDialogStore().resolve('cancel'); await settle();
		expect(assetId.value).toBe(a.assetId);
		expect((root.get('[data-field="supplier"]').element as HTMLInputElement).value).toBe('my draft'); root.unmount();
	});
	it('search and return to the list preserve a draft without a dialog', async () => {
		const a = anEntry(); const root = await mountRoot({ entries: [a], assetId: ref(a.assetId) });
		await root.get('[data-field="sku"]').setValue('local-sku');
		await root.get('.rp-al-search__input').setValue('no matches');
		await root.get('.rp-al-inspector__back').trigger('click'); await settle();
		expect(useDialogStore().current).toBeNull();
		expect((root.get('[data-field="sku"]').element as HTMLInputElement).value).toBe('local-sku');
		root.unmount();
	});
	it('guards New asset and source navigation with the same pending-action dialog', async () => {
		const a = anEntry(); const root = await mountRoot({ entries: [a], assetId: ref(a.assetId) });
		await root.get('[data-field="sku"]').setValue('local-sku');
		await root.get('.rp-al-create').trigger('click'); await settle();
		expect(useDialogStore().current?.kind).toBe('confirm');
		useDialogStore().resolve('cancel'); await settle();
		await root.get('.rp-al-action--note').trigger('click'); await settle();
		expect(useDialogStore().current?.kind).toBe('confirm');
		useDialogStore().resolve('cancel'); await settle(); root.unmount();
	});
});
