// @vitest-environment jsdom
/**
 * Reordering in the Property tree (ADR-0029): the row menu, Alt+arrows and a drop all reach ONE
 * door (`usePlanReorder`) and one command (`updatePlanDetails`), a drop across parents does
 * nothing, with no command there is no menu and no drag, and while writes are paused the menu
 * still opens with every entry greyed and titled with the stale-write reason.
 *
 * `order` on every fixture is its position among its siblings, 0..n-1, as `propertyTreeOf`
 * sorts them — so the writes asserted are exactly the siblings whose position changed. The fake
 * `hierarchy` answers the tree AS WRITTEN (siblings re-sorted by the orders `execute` recorded),
 * because the focus cases below exist for what the re-read does to the DOM: Vue's keyed diff
 * moves the `li`, and a moved focused element drops focus to `body` — invisible against a fake
 * that answered the original tree on every read.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ok } from '../../../../src/core/result/Result';
import { t } from '../../../../src/presentation/i18n/strings';
import type { PlanHierarchyDto, PropertyTreeNode } from '../../../../src/presentation/read-models/planHierarchy';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
import { usePlanHierarchyStore } from '../../../../src/presentation/stores/PlanHierarchyStore';
import * as notices from '../../../../src/presentation/notices/notify';
import { fakeQueries, FIXTURE_PLAN } from '../../../helpers/planFixtures';
import { mountPlanEditorCanvas, runtimeOf, settle } from '../../../helpers/editor';
import { unavailablePlanEditorCommands } from '../../../../src/presentation/editor/planEditorCommands';

const leaf = (id: string, name: string, parentId: string | null, order: number): PropertyTreeNode => ({ id, name, kind: 'floor', order, parentId, children: [] });
const TREE: PropertyTreeNode[] = [
	{ ...leaf('plan-house', 'House', null, 0), children: [leaf('plan-ground', 'Ground floor', 'plan-house', 0), leaf('plan-first', 'First floor', 'plan-house', 1), leaf('plan-attic', 'Attic', 'plan-house', 2)] },
	leaf('plan-garden', 'Garden', null, 1),
];
/** The tree with every sibling list re-sorted by the orders written so far. */
const sorted = (nodes: readonly PropertyTreeNode[], orders: Map<string, number>): PropertyTreeNode[] =>
	nodes.map((node) => ({ ...node, order: orders.get(node.id) ?? node.order, children: sorted(node.children, orders) })).toSorted((a, b) => a.order - b.order);
const hierarchy = (orders = new Map<string, number>(), tree = TREE): PlanHierarchyDto => ({ ancestry: [], detailPlans: [], parentZone: null, parentZoneMissing: false, tree: sorted(tree, orders) });
type UpdateInput = { planId: string; order?: number; kind?: string };
type UpdateResult = ReturnType<typeof ok<{ plan: { entity: typeof FIXTURE_PLAN; version: { revision: number } } }>> | { ok: false; error: { category: string; code: string; message: string } };
function rig(tree = TREE) {
	const orders = new Map<string, number>();
	const execute = vi.fn<(input: UpdateInput) => Promise<UpdateResult>>((input) => {
		if (input.order !== undefined) orders.set(input.planId, input.order);
		return Promise.resolve(ok({ plan: { entity: { ...FIXTURE_PLAN, ...input } as typeof FIXTURE_PLAN, version: { revision: 1 } } }));
	});
	const queries = { ...fakeQueries(FIXTURE_PLAN), hierarchy: vi.fn<() => Promise<ReturnType<typeof ok<PlanHierarchyDto>>>>(() => Promise.resolve(ok(hierarchy(orders, tree)))) };
	const commands = { ...unavailablePlanEditorCommands(), updatePlanDetails: { execute } };
	return { execute, queries, commands: commands as never };
}
/** Gates every `execute` on one promise, so a case can act mid-write; resolves to the release. */
function deferred(execute: ReturnType<typeof rig>['execute']): () => void {
	let release!: () => void;
	const gate = new Promise<void>((resolve) => { release = resolve; });
	const answer = execute.getMockImplementation() as (input: UpdateInput) => Promise<UpdateResult>;
	execute.mockImplementation(async (input) => { await gate; return answer(input); });
	return release;
}
const item = (harness: Awaited<ReturnType<typeof mountPlanEditorCanvas>>, id: string) => harness.wrapper.get(`[data-rp-plan-id="${id}"]`);
const menuOpen = (harness: Awaited<ReturnType<typeof mountPlanEditorCanvas>>) => harness.wrapper.find('.rp-property-tree__menu').exists();
const dataTransfer = { setData: () => undefined, effectAllowed: '' };

describe('PropertyTree reordering', () => {
	it('Move down from the menu writes the two changed siblings in order and re-reads the hierarchy', async () => {
		const { execute, queries, commands } = rig();
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		await item(harness, 'plan-ground').trigger('contextmenu', { clientX: 20, clientY: 20 });
		await harness.wrapper.get('[data-rp-tree-action="move-down"]').trigger('click');
		await settle();
		expect(execute.mock.calls.map(([input]) => input)).toEqual([{ planId: 'plan-first', order: 0 }, { planId: 'plan-ground', order: 1 }]);
		expect(queries.hierarchy).toHaveBeenCalledTimes(2);
		expect(harness.wrapper.find('.rp-property-tree__menu').exists()).toBe(false);
		harness.unmount();
	});

	it('Alt+ArrowUp moves the focused row up, keeps focus on it, and the menu marks the first and last rows', async () => {
		const { execute, queries, commands } = rig();
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		(item(harness, 'plan-attic').element as HTMLElement).focus();
		await item(harness, 'plan-attic').trigger('keydown', { key: 'ArrowUp', altKey: true });
		await settle();
		expect(execute.mock.calls.map(([input]) => input)).toEqual([{ planId: 'plan-attic', order: 1 }, { planId: 'plan-first', order: 2 }]);
		const rows = harness.wrapper.findAll('[role="treeitem"]').map((row) => row.attributes('data-rp-plan-id'));
		expect(rows).toEqual(['plan-house', 'plan-ground', 'plan-attic', 'plan-first', 'plan-garden']);
		expect(document.activeElement).toBe(item(harness, 'plan-attic').element);
		await item(harness, 'plan-ground').trigger('keydown', { key: 'F10', shiftKey: true });
		expect(harness.wrapper.get('[data-rp-tree-action="move-up"]').attributes('aria-disabled')).toBe('true');
		expect(harness.wrapper.get('[data-rp-tree-action="move-down"]').attributes('aria-disabled')).toBeUndefined();
		expect(document.activeElement).toBe(harness.wrapper.get('[data-rp-tree-action="move-up"]').element);
		await harness.wrapper.get('.rp-property-tree__menu').trigger('keydown', { key: 'Escape' });
		expect(harness.wrapper.find('.rp-property-tree__menu').exists()).toBe(false);
		expect(document.activeElement).toBe(item(harness, 'plan-ground').element);
		harness.unmount();
	});

	it('Move up from the menu reorders and leaves focus on the moved row', async () => {
		const { execute, queries, commands } = rig();
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		(item(harness, 'plan-first').element as HTMLElement).focus();
		await item(harness, 'plan-first').trigger('keydown', { key: 'ContextMenu' });
		await harness.wrapper.get('[data-rp-tree-action="move-up"]').trigger('click');
		await settle();
		expect(execute.mock.calls.map(([input]) => input)).toEqual([{ planId: 'plan-first', order: 0 }, { planId: 'plan-ground', order: 1 }]);
		expect(harness.wrapper.findAll('[role="treeitem"]').map((row) => row.attributes('data-rp-plan-id'))).toEqual(['plan-house', 'plan-first', 'plan-ground', 'plan-attic', 'plan-garden']);
		expect(document.activeElement).toBe(item(harness, 'plan-first').element);
		harness.unmount();
	});

	/**
	 * The restore is for focus the DOM move dropped, never for focus the user moved: a move is N
	 * sequential writes plus a re-read, and a click elsewhere in that window is the user's.
	 * `execute` is gated on a deferred promise so the case can move focus mid-write.
	 */
	it('does not pull focus back to the tree when the user moved it elsewhere during the writes', async () => {
		const { execute, queries, commands } = rig();
		const release = deferred(execute);
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		(item(harness, 'plan-attic').element as HTMLElement).focus();
		await item(harness, 'plan-attic').trigger('keydown', { key: 'ArrowUp', altKey: true });
		const elsewhere = document.createElement('button');
		document.body.appendChild(elsewhere);
		elsewhere.focus();
		release();
		await settle();
		expect(execute).toHaveBeenCalledTimes(2);
		expect(item(harness, 'plan-attic').attributes('aria-level')).toBe('2');
		expect(document.activeElement).toBe(elsewhere);
		elsewhere.remove();
		harness.unmount();
	});

	/**
	 * The checked kind has to be VISIBLE, not only announced: jsdom draws nothing, so the pin is on
	 * the stylesheet rule keyed on the attribute the component sets — the same seam
	 * `tests/build/prototype-styles.test.ts` reads through.
	 */
	it('Mark as building writes the kind alone, and the current kind is checked and drawn so', async () => {
		const { execute, queries, commands } = rig();
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		await item(harness, 'plan-house').trigger('contextmenu', { clientX: 20, clientY: 20 });
		const radios = harness.wrapper.findAll('[role="menuitemradio"]');
		expect(radios.map((radio) => radio.attributes('aria-checked'))).toEqual(['false', 'false', 'true', 'false']);
		expect(readFileSync('styles/editor-shell-fidelity.css', 'utf8')).toMatch(/\.rp-property-tree__menu \[role="menuitemradio"\]\[aria-checked="true"\]::before \{[^}]*var\(--interactive-accent\)/);
		await harness.wrapper.get('[data-rp-tree-action="kind:building"]').trigger('click');
		await settle();
		expect(execute).toHaveBeenCalledWith({ planId: 'plan-house', kind: 'building' });
		harness.unmount();
	});

	it('a drop on a sibling reorders, a drop on another parent does nothing', async () => {
		const { execute, queries, commands } = rig();
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		await item(harness, 'plan-attic').trigger('dragstart', { dataTransfer });
		await item(harness, 'plan-garden').trigger('dragover', { dataTransfer, clientY: 0 });
		expect(item(harness, 'plan-garden').attributes('data-rp-drop')).toBeUndefined();
		await item(harness, 'plan-garden').trigger('drop', { dataTransfer });
		await settle();
		expect(execute).not.toHaveBeenCalled();
		await item(harness, 'plan-attic').trigger('dragstart', { dataTransfer });
		await item(harness, 'plan-ground').trigger('dragover', { dataTransfer, clientY: 0 });
		expect(item(harness, 'plan-ground').attributes('data-rp-drop')).toBe('before');
		await item(harness, 'plan-ground').trigger('drop', { dataTransfer });
		await settle();
		expect(execute.mock.calls.map(([input]) => input)).toEqual([{ planId: 'plan-attic', order: 0 }, { planId: 'plan-ground', order: 1 }, { planId: 'plan-first', order: 2 }]);
		expect(item(harness, 'plan-ground').attributes('data-rp-drop')).toBeUndefined();
		harness.unmount();
	});

	it('offers no menu and no drag without the command', async () => {
		const queries = { ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok(hierarchy())) };
		const harness = await mountPlanEditorCanvas({ queries });
		await settle();
		await item(harness, 'plan-ground').trigger('contextmenu', { clientX: 20, clientY: 20 });
		expect(harness.wrapper.find('.rp-property-tree__menu').exists()).toBe(false);
		expect(item(harness, 'plan-ground').attributes('draggable')).toBeUndefined();
		harness.unmount();
	});

	it('while writes are paused the menu opens greyed with the stale reason, and nothing dispatches', async () => {
		const { execute, queries, commands } = rig();
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		expect(item(harness, 'plan-ground').attributes('draggable')).toBe('true');
		useProjectStore(harness.pinia).stale = true;
		await settle();
		expect(item(harness, 'plan-ground').attributes('draggable')).toBeUndefined();
		await item(harness, 'plan-ground').trigger('contextmenu', { clientX: 20, clientY: 20 });
		const entries = harness.wrapper.findAll('.rp-property-tree__menu [data-rp-tree-action]');
		expect(entries.length).toBeGreaterThan(2);
		for (const entry of entries) {
			expect(entry.attributes('aria-disabled')).toBe('true');
			expect(entry.attributes('title')).toBe(t('en', 'editor.stale-write-refused'));
		}
		await harness.wrapper.get('[data-rp-tree-action="move-down"]').trigger('click');
		await harness.wrapper.get('[data-rp-tree-action="kind:building"]').trigger('click');
		await item(harness, 'plan-ground').trigger('keydown', { key: 'ArrowDown', altKey: true });
		await settle();
		expect(execute).not.toHaveBeenCalled();
		expect(harness.wrapper.find('.rp-property-tree__menu').exists()).toBe(true);
		harness.unmount();
	});

	it('stops at the first refused write, reports it once, and still re-reads the hierarchy', async () => {
		const { queries, commands } = rig();
		const execute = vi.fn<(input: UpdateInput) => Promise<UpdateResult>>()
			.mockResolvedValueOnce({ ok: false, error: { category: 'Validation', code: 'plan.not-found', message: 'x' } })
			.mockResolvedValue(ok({ plan: { entity: FIXTURE_PLAN, version: { revision: 1 } } }));
		const notify = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
		const harness = await mountPlanEditorCanvas({ queries, commands: { ...(commands as object), updatePlanDetails: { execute } } as never });
		await settle();
		await item(harness, 'plan-ground').trigger('keydown', { key: 'ArrowDown', altKey: true });
		await settle();
		expect(execute).toHaveBeenCalledTimes(1);
		expect(notify).toHaveBeenCalledOnce();
		expect(queries.hierarchy).toHaveBeenCalledTimes(2);
		notify.mockRestore();
		harness.unmount();
	});

	/**
	 * A held Alt+↑ auto-repeats before the re-read lands. The repeat is DROPPED: a second sequence
	 * computed from the stale tree would dispatch the same writes concurrently and trip the version
	 * check. One sequence, one re-read.
	 */
	it('drops a repeat Alt+ArrowUp while the first sequence is still writing', async () => {
		const { execute, queries, commands } = rig();
		const release = deferred(execute);
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		await item(harness, 'plan-attic').trigger('keydown', { key: 'ArrowUp', altKey: true });
		await item(harness, 'plan-attic').trigger('keydown', { key: 'ArrowUp', altKey: true });
		release();
		await settle();
		expect(execute.mock.calls.map(([input]) => input)).toEqual([{ planId: 'plan-attic', order: 1 }, { planId: 'plan-first', order: 2 }]);
		expect(queries.hierarchy).toHaveBeenCalledTimes(2);
		harness.unmount();
	});

	/** jsdom's rects are all zero, so `clientY: 1` is below every row's midpoint — the `after` edge — and `0` is not. */
	it('drops a row after another on the lower half of its row, and the indicator follows the drag out of the tree', async () => {
		const { execute, queries, commands } = rig();
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		const tree = harness.wrapper.get('[role="tree"]');
		await item(harness, 'plan-ground').trigger('dragstart', { dataTransfer });
		await item(harness, 'plan-attic').trigger('dragover', { dataTransfer, clientY: 1 });
		expect(item(harness, 'plan-attic').attributes('data-rp-drop')).toBe('after');
		await tree.trigger('dragleave', { relatedTarget: item(harness, 'plan-first').element });
		expect(item(harness, 'plan-attic').attributes('data-rp-drop')).toBe('after');
		await tree.trigger('dragleave', { relatedTarget: document.body });
		expect(item(harness, 'plan-attic').attributes('data-rp-drop')).toBeUndefined();
		// Over the list's own padding, beside every row, there is nothing to land on either.
		await item(harness, 'plan-attic').trigger('dragover', { dataTransfer, clientY: 1 });
		await tree.trigger('dragover', { dataTransfer, clientY: 1 });
		expect(item(harness, 'plan-attic').attributes('data-rp-drop')).toBeUndefined();
		await item(harness, 'plan-attic').trigger('dragover', { dataTransfer, clientY: 1 });
		await tree.trigger('dragend');
		expect(item(harness, 'plan-attic').attributes('data-rp-drop')).toBeUndefined();
		await item(harness, 'plan-ground').trigger('dragstart', { dataTransfer });
		await item(harness, 'plan-attic').trigger('dragover', { dataTransfer, clientY: 1 });
		await item(harness, 'plan-attic').trigger('drop', { dataTransfer });
		await settle();
		expect(execute.mock.calls.map(([input]) => input)).toEqual([{ planId: 'plan-first', order: 0 }, { planId: 'plan-attic', order: 1 }, { planId: 'plan-ground', order: 2 }]);
		harness.unmount();
	});

	it('writes nothing and re-reads nothing for a drop onto the row\'s own place', async () => {
		const { execute, queries, commands } = rig();
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		await item(harness, 'plan-first').trigger('dragstart', { dataTransfer });
		await item(harness, 'plan-ground').trigger('dragover', { dataTransfer, clientY: 1 });
		await item(harness, 'plan-ground').trigger('drop', { dataTransfer });
		await settle();
		expect(execute).not.toHaveBeenCalled();
		expect(queries.hierarchy).toHaveBeenCalledTimes(1);
		harness.unmount();
	});

	/**
	 * Another leaf's write lands between two gestures: a re-read that keeps the row leaves the menu
	 * open, one that takes the row CLOSES it — not merely hides it, which the same id coming back
	 * on a later read proves, since a hidden menu would reopen at its old point and take focus — and
	 * a drop whose target is gone moves nothing.
	 */
	it('closes the menu for good and voids a pending drop when a re-read takes the row away', async () => {
		const { execute, queries, commands } = rig();
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		await item(harness, 'plan-ground').trigger('contextmenu', { clientX: 20, clientY: 20 });
		expect(menuOpen(harness)).toBe(true);
		usePlanHierarchyStore(harness.pinia).hierarchy = hierarchy(new Map([['plan-garden', 0], ['plan-house', 1]]));
		await settle();
		expect(menuOpen(harness)).toBe(true);
		await item(harness, 'plan-attic').trigger('dragstart', { dataTransfer });
		await item(harness, 'plan-first').trigger('dragover', { dataTransfer, clientY: 0 });
		expect(item(harness, 'plan-first').attributes('data-rp-drop')).toBe('before');
		usePlanHierarchyStore(harness.pinia).hierarchy = hierarchy(new Map(), [{ ...TREE[0], children: [TREE[0].children[2]] }, TREE[1]]);
		await settle();
		expect(menuOpen(harness)).toBe(false);
		await harness.wrapper.get('[role="tree"]').trigger('drop', { dataTransfer });
		await settle();
		expect(execute).not.toHaveBeenCalled();
		usePlanHierarchyStore(harness.pinia).hierarchy = hierarchy();
		await settle();
		expect(menuOpen(harness)).toBe(false);
		expect(document.activeElement).not.toBe(item(harness, 'plan-ground').element);
		harness.unmount();
	});

	/**
	 * A "Mark as …" chosen from a menu opened DURING an Alt+↑ move used to close the menu and do
	 * nothing: `write()` drops an input that arrives mid-sequence. The entries grey with the
	 * save-state's reason until the re-read lands, the click drops nothing silently, and the menu
	 * stays open and live once the sequence is through.
	 */
	it('greys the menu with the saving reason while a sequence is writing, and drops nothing silently', async () => {
		const { execute, queries, commands } = rig();
		const release = deferred(execute);
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		await item(harness, 'plan-attic').trigger('keydown', { key: 'ArrowUp', altKey: true });
		await item(harness, 'plan-ground').trigger('keydown', { key: 'F10', shiftKey: true });
		const entries = harness.wrapper.findAll('.rp-property-tree__menu [data-rp-tree-action]');
		expect(entries.length).toBeGreaterThan(2);
		for (const entry of entries) {
			expect(entry.attributes('aria-disabled')).toBe('true');
			expect(entry.attributes('title')).toBe(t('en', 'save-state.saving'));
		}
		await harness.wrapper.get('[data-rp-tree-action="kind:building"]').trigger('click');
		expect(menuOpen(harness)).toBe(true);
		release();
		await settle();
		expect(execute.mock.calls.map(([input]) => input)).toEqual([{ planId: 'plan-attic', order: 1 }, { planId: 'plan-first', order: 2 }]);
		const building = harness.wrapper.get('[data-rp-tree-action="kind:building"]');
		expect(building.attributes('aria-disabled')).toBeUndefined();
		expect(building.attributes('title')).toBeUndefined();
		await building.trigger('click');
		await settle();
		expect(execute).toHaveBeenLastCalledWith({ planId: 'plan-ground', kind: 'building' });
		harness.unmount();
	});

	it('claims nothing in review perspective: the native menu, Shift+F10 and Alt moves are left alone', async () => {
		const { execute, queries, commands } = rig();
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		await runtimeOf(harness).renovation.perspective('review');
		await settle();
		const row = item(harness, 'plan-ground');
		const contextmenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 });
		row.element.dispatchEvent(contextmenu);
		await settle();
		expect(contextmenu.defaultPrevented).toBe(false);
		expect(menuOpen(harness)).toBe(false);
		await row.trigger('keydown', { key: 'F10', shiftKey: true });
		expect(menuOpen(harness)).toBe(false);
		expect(row.attributes('draggable')).toBeUndefined();
		await row.trigger('keydown', { key: 'ArrowDown', altKey: true });
		await settle();
		expect(execute).not.toHaveBeenCalled();
		harness.unmount();
	});

	it('closes on a pointer outside the menu and returns focus to the row, not on one inside it', async () => {
		const { queries, commands } = rig();
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		await item(harness, 'plan-ground').trigger('contextmenu', { clientX: 20, clientY: 20 });
		harness.wrapper.get('[data-rp-tree-action="move-up"]').element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		await settle();
		expect(menuOpen(harness)).toBe(true);
		document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		await settle();
		expect(menuOpen(harness)).toBe(false);
		expect(document.activeElement).toBe(item(harness, 'plan-ground').element);
		harness.unmount();
	});

	/** A parent under the SECOND root: the sibling lookup walks the first root's subtree, finds nothing, and moves on. */
	it('flags first and last among the siblings of a second root, and names an unnamed row\'s menu the floor', async () => {
		const { queries, commands } = rig([TREE[0], { ...TREE[1], children: [leaf('plan-shed', 'Shed', 'plan-garden', 0), leaf('plan-pond', '', 'plan-garden', 1)] }]);
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		await item(harness, 'plan-pond').trigger('contextmenu', { clientX: 20, clientY: 20 });
		expect(harness.wrapper.get('.rp-property-tree__menu').attributes('aria-label')).toBe(t('en', 'editor.shell.row-menu', { name: t('en', 'editor.floor') }));
		expect(harness.wrapper.get('[data-rp-tree-action="move-up"]').attributes('aria-disabled')).toBeUndefined();
		expect(harness.wrapper.get('[data-rp-tree-action="move-down"]').attributes('aria-disabled')).toBe('true');
		harness.unmount();
	});

	it('offers no move for the open plan drawn alone, when the leaf answers no hierarchy', async () => {
		const { execute, commands } = rig();
		const harness = await mountPlanEditorCanvas({ queries: fakeQueries(FIXTURE_PLAN), commands });
		await settle();
		await item(harness, FIXTURE_PLAN.id).trigger('keydown', { key: 'ArrowUp', altKey: true });
		await settle();
		expect(execute).not.toHaveBeenCalled();
		harness.unmount();
	});
});
