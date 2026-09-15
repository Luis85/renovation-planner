import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { err, ok } from '../../../src/core/result/Result';
import type { AssetDesignError } from '../../../src/application/queries/GetAssetDesign';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import type { AssetDesignerQueryServices } from '../../../src/presentation/read-models/assetDesignerQueries';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { assetDesign } from '../../helpers/assetDesign';
import { toiletShape } from '../../helpers/assetShapes';

/**
 * Spec 2026-09-13 Decision 10 and Amendment 1: the selection lives in the designer's own store, per
 * leaf, writes nothing, and clears when what it names stops existing. The store is asked directly;
 * the canvas that reads it is the rig's subject.
 */
const BOWL = { kind: 'detail', id: 'detail-2' } as const;
const OPTIONS = { indexScanCompleted: true } as const;
const VAULT_FAILED: AssetDesignError = { category: 'Persistence', code: 'vault.unexpected-failure', message: 'the vault could not be read' };

function answering(shape: AssetShape | null): AssetDesignerQueryServices {
	return { getAssetDesign: () => Promise.resolve(ok(assetDesign({ shape }))) };
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('the designer selection in the design store', () => {
	it('starts with nothing selected, in Transform, with no preview', () => {
		const store = useAssetDesignStore();
		expect([store.selection, store.mode, store.preview]).toEqual([null, 'transform', null]);
	});

	it('keeps the mode when the same part is chosen again, and resets it for a different part', () => {
		const store = useAssetDesignStore();
		store.select({ kind: 'footprint' });
		store.setMode('points');
		store.select({ kind: 'footprint' });
		expect(store.mode).toBe('points');
		store.select(BOWL);
		expect([store.selection, store.mode]).toEqual([BOWL, 'transform']);
	});

	/**
	 * A preview belongs to the gesture that drew it, which clears it itself — a drag's commit once its
	 * write has settled. A click landing while that write is in flight must not wipe it, or the canvas
	 * jumps back to the stored shape until the refresh lands.
	 */
	it('leaves a preview it did not draw when a selection is chosen', () => {
		const store = useAssetDesignStore();
		const drawn = toiletShape();
		store.setPreview(drawn);
		store.select(null);
		expect(store.preview).toBe(drawn);
	});

	it('keeps a selection whose part the next read still has', async () => {
		const store = useAssetDesignStore();
		await store.hydrate(answering(toiletShape()), 'asset-1', OPTIONS);
		store.select(BOWL);
		await store.hydrate(answering(toiletShape()), 'asset-1', OPTIONS);
		expect(store.selection).toEqual(BOWL);
	});

	it('drops a selection whose detail the next read no longer has', async () => {
		const store = useAssetDesignStore();
		const toilet = toiletShape();
		await store.hydrate(answering(toilet), 'asset-1', OPTIONS);
		store.select(BOWL);
		await store.hydrate(answering({ ...toilet, details: toilet.details.slice(0, 1) }), 'asset-1', OPTIONS);
		expect(store.selection).toBeNull();
	});

	it('drops the selection when a read fails and the design goes with it', async () => {
		const store = useAssetDesignStore();
		await store.hydrate(answering(toiletShape()), 'asset-1', OPTIONS);
		store.select({ kind: 'anchor' });
		await store.hydrate({ getAssetDesign: () => Promise.resolve(err(VAULT_FAILED)) }, 'asset-1', OPTIONS);
		expect([store.status, store.selection]).toEqual(['failed', null]);
	});
});
