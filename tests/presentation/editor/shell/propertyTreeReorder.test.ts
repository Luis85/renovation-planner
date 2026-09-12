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
import { fakeQueries, FIXTURE_PLAN } from '../../../helpers/planFixtures';
import { mountPlanEditorCanvas, settle } from '../../../helpers/editor';
import { unavailablePlanEditorCommands } from '../../../../src/presentation/editor/planEditorCommands';

const leaf = (id: string, name: string, parentId: string | null, order: number): PropertyTreeNode => ({ id, name, kind: 'floor', order, parentId, children: [] });
const TREE: PropertyTreeNode[] = [
	{ ...leaf('plan-house', 'House', null, 0), children: [leaf('plan-ground', 'Ground floor', 'plan-house', 0), leaf('plan-first', 'First floor', 'plan-house', 1), leaf('plan-attic', 'Attic', 'plan-house', 2)] },
	leaf('plan-garden', 'Garden', null, 1),
];
/** The tree with every sibling list re-sorted by the orders written so far. */
const sorted = (nodes: readonly PropertyTreeNode[], orders: Map<string, number>): PropertyTreeNode[] =>
	nodes.map((node) => ({ ...node, order: orders.get(node.id) ?? node.order, children: sorted(node.children, orders) })).toSorted((a, b) => a.order - b.order);
const hierarchy = (orders = new Map<string, number>()): PlanHierarchyDto => ({ ancestry: [], detailPlans: [], parentZone: null, parentZoneMissing: false, tree: sorted(TREE, orders) });
type UpdateInput = { planId: string; order?: number; kind?: string };
type UpdateResult = ReturnType<typeof ok<{ plan: { entity: typeof FIXTURE_PLAN; version: { revision: number } } }>> | { ok: false; error: { category: string; code: string; message: string } };
function rig() {
	const orders = new Map<string, number>();
	const execute = vi.fn<(input: UpdateInput) => Promise<UpdateResult>>((input) => {
		if (input.order !== undefined) orders.set(input.planId, input.order);
		return Promise.resolve(ok({ plan: { entity: { ...FIXTURE_PLAN, ...input } as typeof FIXTURE_PLAN, version: { revision: 1 } } }));
	});
	const queries = { ...fakeQueries(FIXTURE_PLAN), hierarchy: vi.fn<() => Promise<ReturnType<typeof ok<PlanHierarchyDto>>>>(() => Promise.resolve(ok(hierarchy(orders)))) };
	const commands = { ...unavailablePlanEditorCommands(), updatePlanDetails: { execute } };
	return { execute, queries, commands: commands as never };
}
const item = (harness: Awaited<ReturnType<typeof mountPlanEditorCanvas>>, id: string) => harness.wrapper.get(`[data-rp-plan-id="${id}"]`);
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

	it('stops at the first refused write and still re-reads the hierarchy', async () => {
		const { queries, commands } = rig();
		const execute = vi.fn<(input: UpdateInput) => Promise<UpdateResult>>()
			.mockResolvedValueOnce({ ok: false, error: { category: 'Persistence', code: 'vault.write-failed', message: 'x' } })
			.mockResolvedValue(ok({ plan: { entity: FIXTURE_PLAN, version: { revision: 1 } } }));
		const harness = await mountPlanEditorCanvas({ queries, commands: { ...(commands as object), updatePlanDetails: { execute } } as never });
		await settle();
		await item(harness, 'plan-ground').trigger('keydown', { key: 'ArrowDown', altKey: true });
		await settle();
		expect(execute).toHaveBeenCalledTimes(1);
		expect(queries.hierarchy).toHaveBeenCalledTimes(2);
		harness.unmount();
	});
});
