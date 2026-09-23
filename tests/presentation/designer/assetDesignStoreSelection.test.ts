import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { err, ok } from '../../../src/core/result/Result';
import type { AssetDesignError } from '../../../src/application/queries/GetAssetDesign';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import type { DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
import type { AssetDesignerQueryServices } from '../../../src/presentation/read-models/assetDesignerQueries';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { assetDesign } from '../../helpers/assetDesign';
import { unwiredPlanUsage } from '../../helpers/designerQueries';
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
	return { getAssetDesign: () => Promise.resolve(ok(assetDesign({ shape }))), listPlansUsingAsset: unwiredPlanUsage };
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

	it('focuses a member without changing the set, and selects a part that is not one alone', () => {
		const store = useAssetDesignStore();
		const tank = { kind: 'detail', id: 'detail-1' } as const;
		store.select(tank);
		store.extend(BOWL);
		store.setMode('points');
		store.focus(BOWL);
		expect([store.selected, store.mode]).toEqual([[tank, BOWL], 'points']);
		store.focus(tank);
		expect([store.selected, store.selection, store.mode]).toEqual([[BOWL, tank], tank, 'transform']);
		store.focus({ kind: 'clearance' });
		expect(store.selected).toEqual([{ kind: 'clearance' }]);
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
		await store.hydrate(
			{ getAssetDesign: () => Promise.resolve(err(VAULT_FAILED)), listPlansUsingAsset: unwiredPlanUsage },
			'asset-1',
			OPTIONS,
		);
		expect([store.status, store.selection]).toEqual(['failed', null]);
	});
});

/**
 * AD08 / C05: a selected SET plus a derived primary. One list, not two synchronised copies — the
 * primary is a `computed` over the set precisely so a writer that forgot to update it cannot exist.
 */
const detail = (id: string): DesignerSelection => ({ kind: 'detail', id });

describe('a selection of several parts', () => {
	it('starts empty, and a plain select holds exactly one part', () => {
		const store = useAssetDesignStore();
		expect(store.selected).toEqual([]);
		store.select(detail('detail-1'));
		expect(store.selected).toEqual([detail('detail-1')]);
		expect(store.selection).toEqual(detail('detail-1'));
	});

	it('extends to a second graphic, and focuses the one just added', () => {
		const store = useAssetDesignStore();
		store.select(detail('detail-1'));
		store.extend(detail('detail-2'));
		expect(store.selected).toEqual([detail('detail-1'), detail('detail-2')]);
		expect(store.selection).toEqual(detail('detail-2'));
	});

	/** One control for both halves: extending onto a member removes it, so the gesture reverses itself. */
	it('removes a member it is extended onto again, and focuses what is left', () => {
		const store = useAssetDesignStore();
		store.select(detail('detail-1'));
		store.extend(detail('detail-2'));
		store.extend(detail('detail-2'));
		expect(store.selected).toEqual([detail('detail-1')]);
		expect(store.selection).toEqual(detail('detail-1'));
	});

	it('empties when its last member is removed, leaving no phantom primary', () => {
		const store = useAssetDesignStore();
		store.select(detail('detail-1'));
		store.extend(detail('detail-1'));
		expect(store.selected).toEqual([]);
		expect(store.selection).toBeNull();
	});

	/**
	 * C05: the footprint, the clearance, the anchor and the facing stay SPECIAL. Each is one
	 * attribute with its own fields and its own gestures, so a set holding the anchor and two
	 * graphics has nothing a group action could do to it. Extending toward one replaces the
	 * selection — the same answer a plain press gives.
	 */
	it.each([
		['the footprint', { kind: 'footprint' } as DesignerSelection],
		['the clearance', { kind: 'clearance' } as DesignerSelection],
		['the anchor', { kind: 'anchor' } as DesignerSelection],
		['the facing', { kind: 'facing' } as DesignerSelection],
	])('replaces the selection rather than adding %s to it', (_label, special) => {
		const store = useAssetDesignStore();
		store.select(detail('detail-1'));
		store.extend(special);
		expect(store.selected).toEqual([special]);
	});

	it('replaces a special selection when a graphic is added to it, rather than mixing the two', () => {
		const store = useAssetDesignStore();
		store.select({ kind: 'anchor' });
		store.extend(detail('detail-1'));
		expect(store.selected).toEqual([detail('detail-1')]);
	});
});

/**
 * C05's pruning rule, on a SET: a refresh that removed one member must leave the others alone. A
 * clear-the-whole-selection answer would be the quiet version of retargeting — the user's next
 * command lands somewhere they did not choose.
 */
describe('pruning a multi-selection across a refresh', () => {
	it('drops only the member whose part is gone', async () => {
		const store = useAssetDesignStore();
		const toilet = toiletShape();
		await store.hydrate(answering(toilet), 'asset-1', OPTIONS);
		store.select({ kind: 'detail', id: 'detail-1' });
		store.extend(BOWL);

		await store.hydrate(answering({ ...toilet, details: toilet.details.slice(0, 1) }), 'asset-1', OPTIONS);

		expect(store.selected).toEqual([{ kind: 'detail', id: 'detail-1' }]);
		expect(store.selection).toEqual({ kind: 'detail', id: 'detail-1' });
	});
});
