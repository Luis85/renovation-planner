// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import type { EntityId } from '../../../../src/core/identity/EntityId';

describe('SelectionStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('initial selection is empty', () => {
		const store = useSelectionStore();
		expect(store.selectedIds).toEqual([]);
	});

	it('select replaces prior selection rather than adding to it', () => {
		const store = useSelectionStore();
		const firstIds = ['zone-1', 'zone-2'] as EntityId<string>[];
		const secondIds = ['zone-3'] as EntityId<string>[];

		store.select(firstIds);
		expect(store.selectedIds).toEqual(firstIds);

		store.select(secondIds);
		expect(store.selectedIds).toEqual(secondIds);
	});

	it('select defensively copies its argument', () => {
		const store = useSelectionStore();
		const ids = ['zone-1', 'zone-2'] as EntityId<string>[];

		store.select(ids);
		// Mutate the original array after calling select
		ids.push('zone-3' as EntityId<string>);

		// The store should be unchanged
		expect(store.selectedIds).toEqual(['zone-1', 'zone-2'] as EntityId<string>[]);
	});

	it('clear empties the selection', () => {
		const store = useSelectionStore();
		const ids = ['zone-1', 'zone-2'] as EntityId<string>[];

		store.select(ids);
		expect(store.selectedIds).not.toEqual([]);

		store.clear();
		expect(store.selectedIds).toEqual([]);
	});

	it('isSelected returns true for selected ids', () => {
		const store = useSelectionStore();
		const selectedId = 'zone-1' as EntityId<string>;
		const ids = [selectedId, 'zone-2' as EntityId<string>] as EntityId<string>[];

		store.select(ids);
		expect(store.isSelected(selectedId)).toBe(true);
	});

	it('isSelected returns false for unselected ids', () => {
		const store = useSelectionStore();
		const selectedId = 'zone-1' as EntityId<string>;
		const unselectedId = 'zone-99' as EntityId<string>;

		store.select([selectedId] as EntityId<string>[]);
		expect(store.isSelected(unselectedId)).toBe(false);
	});
	it('re-selecting the SAME ids keeps the array identity, so watchers do not fire', () => {
		// `SelectTool.pointerDown` calls `select([hit.id])` on every click that lands on a
		// zone, the one that starts a drag on the already-selected zone included. Assigning
		// a fresh array each time made the Inspector's watcher fire on every one of those —
		// a note read plus a parse and a schema validation of the plan's whole geometry
		// sidecar, to arrive at the answer already on screen.
		const store = useSelectionStore();
		const ids = ['zone-1', 'zone-2'] as EntityId<string>[];

		store.select(ids);
		const first = store.selectedIds;
		store.select(['zone-1', 'zone-2'] as EntityId<string>[]); // same ids, different array

		expect(store.selectedIds).toBe(first);
	});

	it('a genuinely different selection DOES replace the array', () => {
		const store = useSelectionStore();
		store.select(['zone-1'] as EntityId<string>[]);
		const first = store.selectedIds;

		store.select(['zone-2'] as EntityId<string>[]);

		expect(store.selectedIds).not.toBe(first);
		expect(store.selectedIds).toEqual(['zone-2']);
	});

	it('order matters: the same ids in a different order is a different selection', () => {
		const store = useSelectionStore();
		store.select(['zone-1', 'zone-2'] as EntityId<string>[]);
		const first = store.selectedIds;

		store.select(['zone-2', 'zone-1'] as EntityId<string>[]);

		expect(store.selectedIds).not.toBe(first);
	});

	it('clear on an already-empty selection keeps the array identity too', () => {
		const store = useSelectionStore();
		const empty = store.selectedIds;

		store.clear();

		expect(store.selectedIds).toBe(empty);
	});
});
