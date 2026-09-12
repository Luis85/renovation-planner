/**
 * @vitest-environment jsdom
 *
 * **The Property-tree half of `accessibility.test.ts`, split out for `max-lines` and not for a
 * change of subject** — the same seam `accessibilityTrustPath.test.ts` took, for the same reason:
 * that file sits at 431 code lines under its 450-line cap and this case would cross it. Read that
 * file's header first for the ceiling every scan here runs under, and why each case asserts
 * PRESENCE before scanning. `runOptions` is imported from `./axeOptions` rather than redeclared.
 */
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { runOptions } from './axeOptions';
import { ok } from '../../src/core/result/Result';
import type { PlanHierarchyDto, PropertyTreeNode } from '../../src/presentation/read-models/planHierarchy';
import { unavailablePlanEditorCommands } from '../../src/presentation/editor/planEditorCommands';
import { mountPlanEditor, settle, type EditorHarness } from '../helpers/editor';
import { fakeQueries, FIXTURE_PLAN } from '../helpers/planFixtures';

beforeEach(() => {
	document.body.innerHTML = '';
});

/** Site › House › { Ground floor (open), Attic } — the `?tree` knob's shape; `order` is each node's place among its siblings. */
const leaf = (id: string, name: string, kind: PropertyTreeNode['kind'], parentId: string | null, order: number): PropertyTreeNode =>
	({ id, name, kind, order, parentId, children: [] });
const TREE: PropertyTreeNode[] = [
	{ ...leaf('plan-site', 'Site', 'site', null, 0), children: [
		{ ...leaf('plan-house', 'House', 'building', 'plan-site', 0), children: [
			leaf(FIXTURE_PLAN.id, FIXTURE_PLAN.name, 'floor', 'plan-house', 0),
			leaf('plan-attic', 'Attic', 'floor', 'plan-house', 1),
		] },
	] },
];
const hierarchy: PlanHierarchyDto = { ancestry: [], detailPlans: [], parentZone: null, parentZoneMissing: false, tree: TREE };
const treeQueries = () => ({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok(hierarchy)) });
const treeCommands = () => ({
	...unavailablePlanEditorCommands(),
	updatePlanDetails: { execute: () => Promise.resolve(ok({ plan: { entity: FIXTURE_PLAN, version: { revision: 1 } } })) },
});
const navigation = { project: () => Promise.resolve(), library: () => undefined, plan: () => Promise.resolve() };

describe('axe against the Property tree', () => {
	/**
	 * ADR-0029's tree with every piece of ARIA it carries actually on screen: three nested
	 * `role="treeitem"` levels under `role="group"`s, rows drawn as `<button>`s (a `navigation`
	 * whose `plan` exists — no earlier scan ever mounted one, so no scan had ever graded a button
	 * inside a treeitem), the open plan as `aria-current="page"`, and the row menu OPEN — a
	 * `role="menu"` of two `menuitem`s and four `menuitemradio`s, teleported into the editor
	 * root, which renders only with `updatePlanDetails` present.
	 *
	 * The three presence assertions are the load-bearing half: `violations` is `[]` on a subtree
	 * containing nothing at all, so proving the four rows, a button row and the menu are really
	 * in the DOM this scan ran against is what makes green mean something.
	 */
	it('reports no semantic violations on a three-level Property tree with its row menu open', async () => {
		let mounted: EditorHarness | null = null;
		try {
			mounted = await mountPlanEditor({ queries: treeQueries(), commands: treeCommands() as never, navigation });
			await settle();
			const root = mounted.wrapper.element as HTMLElement;
			expect(root.querySelectorAll('[role="treeitem"]').length).toBe(4);
			expect(root.querySelector('button.rp-property-tree__row')).not.toBeNull();
			await mounted.wrapper.get('[data-rp-plan-id="plan-attic"]').trigger('keydown', { key: 'F10', shiftKey: true });
			expect(root.querySelector('.rp-property-tree__menu')).not.toBeNull();

			const results = await axe.run(root, runOptions);

			expect(results.violations).toEqual([]);
		} finally {
			mounted?.unmount();
		}
	});
});
