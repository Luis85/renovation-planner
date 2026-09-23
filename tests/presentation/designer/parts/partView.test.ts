import { describe, expect, it } from 'vitest';
import { createPartView } from '../../../../src/presentation/designer/parts/partView';

/**
 * AD09's leaf-local view preferences: which graphics are hidden, which are locked against editing,
 * and which group rows are collapsed.
 *
 * **None of it is symbol content and none of it is ever written** (AD09 item 3, criterion 3). It
 * holds ids and nothing else — no shape, no command, no port — which is the structural half of
 * "editing isolation does not remove content from placement, quantities or export": the plan's
 * placement and the library's mark read the stored shape, and nothing here can reach it.
 *
 * Per LEAF, like `multiSelectionMode`: two designer tabs on two assets must not share a hidden set,
 * and a second tab on ONE asset is still a second workspace.
 */
describe('createPartView', () => {
	it('starts with nothing hidden, nothing locked and every group expanded', () => {
		const view = createPartView();

		expect([view.hidden.value.size, view.locked.value.size, view.collapsed.value.size]).toEqual([0, 0, 0]);
	});

	it.each([
		['hidden', (view: ReturnType<typeof createPartView>) => ({ toggle: view.toggleHidden, set: () => view.hidden.value })],
		['locked', (view: ReturnType<typeof createPartView>) => ({ toggle: view.toggleLocked, set: () => view.locked.value })],
	])('toggles %s on and back off again, which is what makes one control both halves', (_name, pick) => {
		const view = createPartView();
		const { toggle, set } = pick(view);

		toggle('detail-1');
		expect([...set()]).toEqual(['detail-1']);
		toggle('detail-2');
		expect([...set()].toSorted()).toEqual(['detail-1', 'detail-2']);
		toggle('detail-1');
		expect([...set()]).toEqual(['detail-2']);
	});

	/** A group row is EXPANDED by default, so the set holds the collapsed ones and an unknown id reads as expanded. */
	it('collapses and expands a group by id', () => {
		const view = createPartView();

		view.toggleGroup('group-1');
		expect(view.collapsed.value.has('group-1')).toBe(true);
		view.toggleGroup('group-1');
		expect(view.collapsed.value.has('group-1')).toBe(false);
	});

	/**
	 * Isolation is "hide the others", held in exactly the same set as a hand-hidden graphic — so
	 * there is one question the canvas asks ("is this hidden") rather than two that can disagree,
	 * and Show all is the one way back from either.
	 */
	it('isolates one graphic by hiding every other, and shows all again', () => {
		const view = createPartView();

		view.isolate('detail-2', ['detail-1', 'detail-2', 'detail-3']);
		expect([...view.hidden.value].toSorted()).toEqual(['detail-1', 'detail-3']);
		view.showAll();
		expect(view.hidden.value.size).toBe(0);
	});

	/** Isolating REPLACES what was hidden, rather than adding to it: two isolations in a row must not leave the first one's set behind. */
	it('replaces the hidden set on each isolation rather than accumulating', () => {
		const view = createPartView();

		view.isolate('detail-1', ['detail-1', 'detail-2', 'detail-3']);
		view.isolate('detail-3', ['detail-1', 'detail-2', 'detail-3']);
		expect([...view.hidden.value].toSorted()).toEqual(['detail-1', 'detail-2']);
	});

	/** Show all leaves LOCKS alone: they are a different question, and a user who unhid everything did not ask to unlock anything. */
	it('leaves locks alone when everything is shown again', () => {
		const view = createPartView();

		view.toggleLocked('detail-1');
		view.toggleHidden('detail-2');
		view.showAll();
		expect([...view.locked.value]).toEqual(['detail-1']);
	});

	/**
	 * Ids ARE recycled — `nextDetailId` and `nextGroupId` count from the highest id still PRESENT — so
	 * what the design no longer has is forgotten, and a re-allocated id is never born hidden, locked or
	 * collapsed. An id still present keeps its state, and a prune that forgets nothing writes nothing.
	 */
	it('forgets the state of every graphic and group the design no longer has', () => {
		const view = createPartView();
		view.toggleHidden('detail-1');
		view.toggleHidden('detail-3');
		view.toggleLocked('detail-3');
		view.toggleGroup('group-1');
		view.toggleGroup('group-2');

		view.prune(new Set(['detail-1', 'detail-2']), new Set(['group-2']));
		expect([[...view.hidden.value], [...view.locked.value], [...view.collapsed.value]]).toEqual([['detail-1'], [], ['group-2']]);

		const kept = [view.hidden.value, view.locked.value, view.collapsed.value];
		view.prune(new Set(['detail-1', 'detail-2']), new Set(['group-2']));
		expect([view.hidden.value, view.locked.value, view.collapsed.value]).toEqual(kept);
		expect(view.hidden.value).toBe(kept[0]);
	});

	/** A new set on every write, never a mutated one: `ref` compares by identity, so a mutated Set updates nothing. */
	it('replaces the set rather than mutating it, so a reader actually re-renders', () => {
		const view = createPartView();
		const before = view.hidden.value;

		view.toggleHidden('detail-1');
		expect(view.hidden.value).not.toBe(before);
	});
});
