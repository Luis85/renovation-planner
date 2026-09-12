// @vitest-environment jsdom
/**
 * The Property tree (ADR-0029): the project row, then EVERY plan of the project nested by parent
 * link as a `role="tree"`, the open plan marked `aria-current`, rows opening through the ONE
 * `navigation.plan` door and drawn as text without it. Keyboard: roving tabindex, arrows.
 *
 * `mountPlanEditorCanvas` attaches to `document.body` (Konva measures its container), so
 * `focus()` moves `document.activeElement` — and every case unmounts what it mounted to keep
 * the body clean for the next.
 */
import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '../../../../src/core/result/Result';
import { t } from '../../../../src/presentation/i18n/strings';
import type { PlanHierarchyDto, PropertyTreeNode } from '../../../../src/presentation/read-models/planHierarchy';
import { fakeQueries, FIXTURE_PLAN, FIXTURE_PROJECT } from '../../../helpers/planFixtures';
import { mountPlanEditorCanvas, settle } from '../../../helpers/editor';

/** `order` is the position among the siblings listed, 0..n-1, as `propertyTreeOf` would sort them. */
const leaf = (id: string, name: string, parentId: string | null, order: number, kind: PropertyTreeNode['kind'] = 'floor'): PropertyTreeNode =>
	({ id, name, kind, order, parentId, children: [] });
/** Site › House › { Ground floor (open), Attic } plus a second root, Garden. */
const TREE: PropertyTreeNode[] = [
	{ ...leaf('plan-site', 'Site', null, 0, 'site'), children: [
		{ ...leaf('plan-house', 'House', 'plan-site', 0, 'building'), children: [leaf('plan-ground', 'Ground floor', 'plan-house', 0), leaf('plan-attic', 'Attic', 'plan-house', 1)] },
	] },
	leaf('plan-garden', 'Garden', null, 1, 'site'),
];
const hierarchy = (tree: PropertyTreeNode[] = TREE, parentZoneMissing = false): PlanHierarchyDto => ({ ancestry: [], detailPlans: [], parentZone: null, parentZoneMissing, tree });
const queries = (tree = TREE) => ({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok(hierarchy(tree))) });
const navigation = (plan = vi.fn<(planId: string) => Promise<void>>(() => Promise.resolve())) => ({ project: () => Promise.resolve(), library: () => undefined, plan });

describe('PropertyTree', () => {
	it('draws the project row, then every plan nested under its parent with its level', async () => {
		const harness = await mountPlanEditorCanvas({ queries: queries() });
		await settle();
		const tree = harness.wrapper.get('.rp-property-tree');
		expect(tree.get('.rp-property-tree__project').text()).toContain(FIXTURE_PROJECT.name);
		const items = tree.findAll('[role="treeitem"]');
		expect(items.map((item) => item.attributes('data-rp-plan-id'))).toEqual(['plan-site', 'plan-house', 'plan-ground', 'plan-attic', 'plan-garden']);
		expect(items.map((item) => item.attributes('aria-level'))).toEqual(['1', '2', '3', '3', '1']);
		expect(tree.get('[role="tree"]').attributes('aria-label')).toBe(t('en', 'editor.shell.tree'));
		harness.unmount();
	});

	it('marks the open plan current and draws it as text, the rest as buttons when navigable', async () => {
		const harness = await mountPlanEditorCanvas({ queries: queries(), navigation: navigation() });
		await settle();
		const tree = harness.wrapper.get('.rp-property-tree');
		expect(tree.get('[data-rp-plan-id="plan-ground"] .rp-property-tree__row').attributes('aria-current')).toBe('page');
		expect(tree.get('[data-rp-plan-id="plan-ground"] .rp-property-tree__row').element.tagName).toBe('SPAN');
		expect(tree.findAll('button.rp-property-tree__row')).toHaveLength(4);
		harness.unmount();
	});

	it('opens another plan through navigation.plan, and draws rows as text without one', async () => {
		const plan = vi.fn<(planId: string) => Promise<void>>(() => Promise.resolve());
		const withNav = await mountPlanEditorCanvas({ queries: queries(), navigation: navigation(plan) });
		await settle();
		await withNav.wrapper.get('[data-rp-open-plan="plan-attic"]').trigger('click');
		expect(plan).toHaveBeenCalledWith('plan-attic');
		withNav.unmount();
		const without = await mountPlanEditorCanvas({ queries: queries() });
		await settle();
		expect(without.wrapper.findAll('button.rp-property-tree__row')).toHaveLength(0);
		expect(without.wrapper.findAll('[role="treeitem"]')).toHaveLength(5);
		without.unmount();
	});

	it('opens the project through navigation.project', async () => {
		const project = vi.fn<(projectId: string) => Promise<void>>(() => Promise.resolve());
		const harness = await mountPlanEditorCanvas({ queries: queries(), navigation: { ...navigation(), project } });
		await settle();
		await harness.wrapper.get('.rp-property-tree__project').trigger('click');
		expect(project).toHaveBeenCalledWith(FIXTURE_PROJECT.id);
		harness.unmount();
	});

	/**
	 * Name and description sit on the FOCUSED element, the `li`: a description is never computed
	 * from descendants, and a name computed from the subtree would read "House Ground floor Attic".
	 */
	it('names the treeitem by the plan name alone, describes it by its kind and draws the kind icon', async () => {
		const harness = await mountPlanEditorCanvas({ queries: queries() });
		await settle();
		const item = harness.wrapper.get('[data-rp-plan-id="plan-house"]');
		expect(item.attributes('aria-description')).toBe(t('en', 'editor.shell.kind.building'));
		const label = document.getElementById(item.attributes('aria-labelledby') ?? '');
		expect(label?.textContent).toBe('House');
		expect(item.find('.rp-property-tree__row').attributes('aria-description')).toBeUndefined();
		// `data-icon` is the canonical name the mock `setIcon` records; `data-icon-request` carries
		// the `lucide-` prefix `HostIcon` adds, so it is the wrong attribute to match a bare kind icon on.
		expect(item.get('.rp-property-tree__row').find('.rp-host-icon[data-icon="building"]').exists()).toBe(true);
		harness.unmount();
	});

	it('roves focus with the arrow keys and opens with Enter or Space', async () => {
		const plan = vi.fn<(planId: string) => Promise<void>>(() => Promise.resolve());
		const harness = await mountPlanEditorCanvas({ queries: queries(), navigation: navigation(plan) });
		await settle();
		const items = harness.wrapper.findAll('[role="treeitem"]');
		expect(items.map((item) => item.attributes('tabindex'))).toEqual(['-1', '-1', '0', '-1', '-1']);
		(items[2].element as HTMLElement).focus();
		await items[2].trigger('keydown', { key: 'ArrowDown' });
		expect(document.activeElement).toBe(items[3].element);
		await items[3].trigger('keydown', { key: 'ArrowLeft' });
		expect(document.activeElement).toBe(items[1].element);
		await items[1].trigger('keydown', { key: 'ArrowRight' });
		expect(document.activeElement).toBe(items[2].element);
		await items[2].trigger('keydown', { key: 'End' });
		expect(document.activeElement).toBe(items[4].element);
		await items[4].trigger('keydown', { key: 'Home' });
		expect(document.activeElement).toBe(items[0].element);
		await items[0].trigger('keydown', { key: 'Enter' });
		expect(plan).toHaveBeenCalledWith('plan-site');
		await items[1].trigger('keydown', { key: ' ' });
		expect(plan).toHaveBeenCalledWith('plan-house');
		// ↑ from the second row focuses the first; ← on a root and → on a leaf have nowhere to go.
		await items[1].trigger('keydown', { key: 'ArrowUp' });
		await items[0].trigger('keydown', { key: 'ArrowLeft' });
		await items[3].trigger('keydown', { key: 'ArrowRight' });
		expect(document.activeElement).toBe(items[0].element);
		// Enter on the open plan opens nothing, a modified arrow is the host's, an unhandled key is left alone.
		await items[2].trigger('keydown', { key: 'Enter' });
		await items[2].trigger('keydown', { key: 'ArrowDown', ctrlKey: true });
		await items[2].trigger('keydown', { key: 'a' });
		expect(plan).toHaveBeenCalledTimes(2);
		expect(document.activeElement).toBe(items[0].element);
		harness.unmount();
	});

	it('shows the missing-parent line only when the hierarchy reports one', async () => {
		const missing = await mountPlanEditorCanvas({ queries: { ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok(hierarchy(TREE, true))) } });
		await settle();
		expect(missing.wrapper.get('.rp-property-tree').text()).toContain(t('en', 'editor.input.parent-zone-missing'));
		missing.unmount();
		const present = await mountPlanEditorCanvas({ queries: queries() });
		await settle();
		expect(present.wrapper.get('.rp-property-tree').text()).not.toContain(t('en', 'editor.input.parent-zone-missing'));
		present.unmount();
	});

	it('says the hierarchy could not be read rather than drawing a parentless plan', async () => {
		const harness = await mountPlanEditorCanvas({
			queries: { ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'io' } as const)) },
		});
		await settle();
		expect(harness.wrapper.get('.rp-property-tree').text()).toContain(t('en', 'editor.input.hierarchy-unreadable'));
		harness.unmount();
	});

	it('draws the open plan alone when the leaf answers no hierarchy', async () => {
		const harness = await mountPlanEditorCanvas({ queries: fakeQueries(FIXTURE_PLAN) });
		await settle();
		const items = harness.wrapper.findAll('[role="treeitem"]');
		expect(items.map((item) => item.attributes('data-rp-plan-id'))).toEqual([FIXTURE_PLAN.id]);
		expect(items[0].get('.rp-property-tree__row').attributes('aria-current')).toBe('page');
		harness.unmount();
	});

	it('falls back to the floor label for an unnamed plan, as text and as a button', async () => {
		const harness = await mountPlanEditorCanvas({ queries: queries([leaf('plan-ground', '', null, 0)]) });
		await settle();
		expect(harness.wrapper.get('[data-rp-plan-id="plan-ground"]').text()).toContain(t('en', 'editor.floor'));
		harness.unmount();
		const navigable = await mountPlanEditorCanvas({ queries: queries([leaf('plan-ground', '', null, 0), leaf('plan-attic', '', null, 1)]), navigation: navigation() });
		await settle();
		expect(navigable.wrapper.get('button[data-rp-open-plan="plan-attic"]').text()).toBe(t('en', 'editor.floor'));
		navigable.unmount();
	});
});
