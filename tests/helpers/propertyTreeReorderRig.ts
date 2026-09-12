import { vi } from 'vitest';
import { ok } from '../../src/core/result/Result';
import type { PlanHierarchyDto, PropertyTreeNode } from '../../src/presentation/read-models/planHierarchy';
import { unavailablePlanEditorCommands } from '../../src/presentation/editor/planEditorCommands';
import { fakeQueries, FIXTURE_PLAN } from './planFixtures';
import { mountPlanEditorCanvas, type CanvasHarness } from './editor';

/**
 * The Property tree reorder rig, shared by `tests/presentation/editor/shell/propertyTreeReorder.test.ts`
 * and `propertyTreeReorderWrites.test.ts` — one file until the second crossed the 450-line cap,
 * split by SUBJECT (gestures against the sequence flag) with the fixtures held here once.
 *
 * `order` on every fixture is its position among its siblings, 0..n-1, as `propertyTreeOf` sorts
 * them — so the writes a case asserts are exactly the siblings whose position changed. The fake
 * `hierarchy` answers the tree AS WRITTEN (siblings re-sorted by the orders `execute` recorded),
 * because the focus cases exist for what the re-read does to the DOM: Vue's keyed diff moves the
 * `li`, and a moved focused element drops focus to `body` — invisible against a fake that answered
 * the original tree on every read.
 */
export const REFUSED = { ok: false as const, error: { category: 'Validation', code: 'plan.not-found', message: 'x' } };

export const leaf = (id: string, name: string, parentId: string | null, order: number): PropertyTreeNode => ({ id, name, kind: 'floor', order, parentId, children: [] });
export const TREE: PropertyTreeNode[] = [
	{ ...leaf('plan-house', 'House', null, 0), children: [leaf('plan-ground', 'Ground floor', 'plan-house', 0), leaf('plan-first', 'First floor', 'plan-house', 1), leaf('plan-attic', 'Attic', 'plan-house', 2)] },
	leaf('plan-garden', 'Garden', null, 1),
];
/** The tree with every sibling list re-sorted by the orders written so far. */
const sorted = (nodes: readonly PropertyTreeNode[], orders: Map<string, number>): PropertyTreeNode[] =>
	nodes.map((node) => ({ ...node, order: orders.get(node.id) ?? node.order, children: sorted(node.children, orders) })).toSorted((a, b) => a.order - b.order);
export const hierarchy = (orders = new Map<string, number>(), tree = TREE): PlanHierarchyDto => ({ ancestry: [], detailPlans: [], parentZone: null, parentZoneMissing: false, tree: sorted(tree, orders) });
export type UpdateInput = { planId: string; order?: number; kind?: string };
export type UpdateResult = ReturnType<typeof ok<{ plan: { entity: typeof FIXTURE_PLAN; version: { revision: number } } }>> | { ok: false; error: { category: string; code: string; message: string } };
export function rig(tree = TREE) {
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
export function deferred(execute: ReturnType<typeof rig>['execute']): () => void {
	let release!: () => void;
	const gate = new Promise<void>((resolve) => { release = resolve; });
	const answer = execute.getMockImplementation() as (input: UpdateInput) => Promise<UpdateResult>;
	execute.mockImplementation(async (input) => { await gate; return answer(input); });
	return release;
}
export const item = (harness: CanvasHarness, id: string) => harness.wrapper.get(`[data-rp-plan-id="${id}"]`);
export const menuOpen = (harness: CanvasHarness) => harness.wrapper.find('.rp-property-tree__menu').exists();
export const dataTransfer = { setData: () => undefined, effectAllowed: '' };

/** Every tree a file mounted, for `unmountTrees` — registered as that file's `afterEach`, so a failed assertion cannot leave a Konva stage on the body for the next case. */
const mounted: CanvasHarness[] = [];
export async function openTree(options: Parameters<typeof mountPlanEditorCanvas>[0]): Promise<CanvasHarness> {
	const harness = await mountPlanEditorCanvas(options);
	mounted.push(harness);
	return harness;
}
export function unmountTrees(): void {
	for (const harness of mounted.splice(0)) harness.unmount();
}
