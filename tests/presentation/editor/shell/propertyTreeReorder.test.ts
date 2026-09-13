// @vitest-environment jsdom
/**
 * Reordering in the Property tree (ADR-0029): the row menu, Alt+arrows and a drop all reach ONE
 * door (`usePlanReorder`) and one command (`updatePlanDetails`), a drop across parents does
 * nothing, with no command there is no menu and no drag, and while writes are paused the menu
 * still opens with every entry greyed and titled with the stale-write reason.
 *
 * The rig — fixtures, the fake command and queries, and what `order` on every fixture means — is
 * `tests/helpers/propertyTreeReorderRig.ts`, shared with `propertyTreeReorderWrites.test.ts`,
 * which holds the sequence-flag cases this file outgrew.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { propertyOf, show, stylesheetRules, type StyleRule } from '../../../helpers/selectors';
import { t } from '../../../../src/presentation/i18n/strings';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
import { usePlanHierarchyStore } from '../../../../src/presentation/stores/PlanHierarchyStore';
import * as notices from '../../../../src/presentation/notices/notify';
import { ok } from '../../../../src/core/result/Result';
import { fakeQueries, FIXTURE_PLAN } from '../../../helpers/planFixtures';
import { runtimeOf, settle } from '../../../helpers/editor';
import { dataTransfer, deferred, hierarchy, item, leaf, menuOpen, openTree as open, REFUSED, rig, TREE, unmountTrees, type UpdateInput, type UpdateResult } from '../../../helpers/propertyTreeReorderRig';

afterEach(unmountTrees);

/** The rules of `styles/editor-shell-fidelity.css` whose serialized selector is `selector`, from the parsed sheet. */
const rulesFor = (selector: string): StyleRule[] =>
	stylesheetRules(readFileSync('styles/editor-shell-fidelity.css', 'utf8')).filter((rule) => rule.selectors.map(show).includes(selector));

describe('PropertyTree reordering', () => {
	it('Move down from the menu writes the two changed siblings in order and re-reads the hierarchy', async () => {
		const { execute, queries, commands } = rig();
		const harness = await open({ queries, commands });
		await settle();
		await item(harness, 'plan-ground').trigger('contextmenu', { clientX: 20, clientY: 20 });
		await harness.wrapper.get('[data-rp-tree-action="move-down"]').trigger('click');
		await settle();
		expect(execute.mock.calls.map(([input]) => input)).toEqual([{ planId: 'plan-first', order: 0 }, { planId: 'plan-ground', order: 1 }]);
		expect(queries.hierarchy).toHaveBeenCalledTimes(2);
		expect(harness.wrapper.find('.rp-property-tree__menu').exists()).toBe(false);
	});

	it('Alt+ArrowUp moves the focused row up, keeps focus on it, and the menu marks the first and last rows', async () => {
		const { execute, queries, commands } = rig();
		const harness = await open({ queries, commands });
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
		// ↑ with focus outside the items lands on the LAST entry — the last kind radio, which is what
		// pins this menu's selector counting `menuitemradio` — not on the one before it.
		(document.activeElement as HTMLElement).blur();
		await harness.wrapper.get('.rp-property-tree__menu').trigger('keydown', { key: 'ArrowUp' });
		expect(document.activeElement).toBe(harness.wrapper.get('[data-rp-tree-action="kind:room"]').element);
		await harness.wrapper.get('.rp-property-tree__menu').trigger('keydown', { key: 'Escape' });
		expect(harness.wrapper.find('.rp-property-tree__menu').exists()).toBe(false);
		expect(document.activeElement).toBe(item(harness, 'plan-ground').element);
	});

	it('Move up from the menu reorders and leaves focus on the moved row', async () => {
		const { execute, queries, commands } = rig();
		const harness = await open({ queries, commands });
		await settle();
		(item(harness, 'plan-first').element as HTMLElement).focus();
		await item(harness, 'plan-first').trigger('keydown', { key: 'ContextMenu' });
		await harness.wrapper.get('[data-rp-tree-action="move-up"]').trigger('click');
		await settle();
		expect(execute.mock.calls.map(([input]) => input)).toEqual([{ planId: 'plan-first', order: 0 }, { planId: 'plan-ground', order: 1 }]);
		expect(harness.wrapper.findAll('[role="treeitem"]').map((row) => row.attributes('data-rp-plan-id'))).toEqual(['plan-house', 'plan-first', 'plan-ground', 'plan-attic', 'plan-garden']);
		expect(document.activeElement).toBe(item(harness, 'plan-first').element);
	});

	/**
	 * The restore is for focus the DOM move dropped, never for focus the user moved: a move is N
	 * sequential writes plus a re-read, and a click elsewhere in that window is the user's.
	 * `execute` is gated on a deferred promise so the case can move focus mid-write.
	 */
	it('does not pull focus back to the tree when the user moved it elsewhere during the writes', async () => {
		const { execute, queries, commands } = rig();
		const release = deferred(execute);
		const harness = await open({ queries, commands });
		await settle();
		(item(harness, 'plan-attic').element as HTMLElement).focus();
		await item(harness, 'plan-attic').trigger('keydown', { key: 'ArrowUp', altKey: true });
		const elsewhere = document.createElement('button');
		document.body.appendChild(elsewhere);
		onTestFinished(() => elsewhere.remove());
		elsewhere.focus();
		release();
		await settle();
		expect(execute).toHaveBeenCalledTimes(2);
		expect(item(harness, 'plan-attic').attributes('aria-level')).toBe('2');
		expect(document.activeElement).toBe(elsewhere);
	});

	/**
	 * The checked kind has to be VISIBLE, not only announced: jsdom draws nothing, so the pin is on
	 * the stylesheet rule keyed on the attribute the component sets — the same seam
	 * `tests/build/prototype-styles.test.ts` reads through.
	 */
	it('Mark as building writes the kind alone, and the current kind is checked and drawn so', async () => {
		const { execute, queries, commands } = rig();
		const harness = await open({ queries, commands });
		await settle();
		await item(harness, 'plan-house').trigger('contextmenu', { clientX: 20, clientY: 20 });
		const radios = harness.wrapper.findAll('[role="menuitemradio"]');
		expect(radios.map((radio) => radio.attributes('aria-checked'))).toEqual(['false', 'false', 'true', 'false']);
		// The base rule is what makes the dot EXIST (`content`); the checked rule only fills it, with
		// the accent. Asked of the parsed sheet, by property name and by the variable the value names.
		const [dot] = rulesFor('.renovation-plan-editor .rp-property-tree__menu [role="menuitemradio"]::before');
		expect(dot?.declarations.map(propertyOf)).toContain('content');
		const [checked] = rulesFor('.renovation-plan-editor .rp-property-tree__menu [role="menuitemradio"][aria-checked="true"]::before');
		expect(checked?.declarations.map(propertyOf)).toEqual(['border-color', 'background']);
		expect(JSON.stringify(checked?.declarations)).toContain('"--interactive-accent"');
		await harness.wrapper.get('[data-rp-tree-action="kind:building"]').trigger('click');
		await settle();
		expect(execute).toHaveBeenCalledWith({ planId: 'plan-house', kind: 'building' });
	});

	it('a drop on a sibling reorders, a drop on another parent does nothing', async () => {
		const { execute, queries, commands } = rig();
		const harness = await open({ queries, commands });
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
	});

	it('offers no menu and no drag without the command', async () => {
		const queries = { ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok(hierarchy())) };
		const harness = await open({ queries });
		await settle();
		await item(harness, 'plan-ground').trigger('contextmenu', { clientX: 20, clientY: 20 });
		expect(harness.wrapper.find('.rp-property-tree__menu').exists()).toBe(false);
		expect(item(harness, 'plan-ground').attributes('draggable')).toBeUndefined();
	});

	it('while writes are paused the menu opens greyed with the stale reason, and nothing dispatches', async () => {
		const { execute, queries, commands } = rig();
		const harness = await open({ queries, commands });
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
	});

	it('stops at the first refused write, reports it once, and still re-reads the hierarchy', async () => {
		const { queries, commands } = rig();
		const execute = vi.fn<(input: UpdateInput) => Promise<UpdateResult>>()
			.mockResolvedValueOnce({ ok: false, error: { category: 'Validation', code: 'plan.not-found', message: 'x' } })
			.mockResolvedValue(ok({ plan: { entity: FIXTURE_PLAN, version: { revision: 1 } } }));
		const notify = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
		onTestFinished(() => notify.mockRestore());
		const harness = await open({ queries, commands: { ...(commands as object), updatePlanDetails: { execute } } as never });
		await settle();
		await item(harness, 'plan-ground').trigger('keydown', { key: 'ArrowDown', altKey: true });
		await settle();
		expect(execute).toHaveBeenCalledTimes(1);
		expect(notify).toHaveBeenCalledOnce();
		expect(queries.hierarchy).toHaveBeenCalledTimes(2);
	});

	/**
	 * A held Alt+↑ auto-repeats before the re-read lands. The repeat is DROPPED: a second sequence
	 * computed from the stale tree would dispatch the same writes concurrently and trip the version
	 * check. One sequence, one re-read.
	 */
	it('drops a repeat Alt+ArrowUp while the first sequence is still writing', async () => {
		const { execute, queries, commands } = rig();
		const release = deferred(execute);
		const harness = await open({ queries, commands });
		await settle();
		await item(harness, 'plan-attic').trigger('keydown', { key: 'ArrowUp', altKey: true });
		await item(harness, 'plan-attic').trigger('keydown', { key: 'ArrowUp', altKey: true });
		release();
		await settle();
		expect(execute.mock.calls.map(([input]) => input)).toEqual([{ planId: 'plan-attic', order: 1 }, { planId: 'plan-first', order: 2 }]);
		expect(queries.hierarchy).toHaveBeenCalledTimes(2);
	});

	/** jsdom's rects are all zero, so `clientY: 1` is below every row's midpoint — the `after` edge — and `0` is not. */
	it('drops a row after another on the lower half of its row, and the indicator follows the drag out of the tree', async () => {
		const { execute, queries, commands } = rig();
		const harness = await open({ queries, commands });
		await settle();
		const tree = harness.wrapper.get('[role="tree"]');
		await item(harness, 'plan-ground').trigger('dragstart', { dataTransfer });
		await item(harness, 'plan-attic').trigger('dragover', { dataTransfer, clientY: 1 });
		expect(item(harness, 'plan-attic').attributes('data-rp-drop')).toBe('after');
		// The `after` line is the `li`'s own positioned pseudo-element — the whole subtree the drop
		// lands after, painted above its rows' backgrounds — never on the row alone. Asked of the
		// parsed sheet: every rule naming the `after` state, by its serialized selector.
		const afterRules = stylesheetRules(readFileSync('styles/editor-shell-fidelity.css', 'utf8'))
			.flatMap((rule) => rule.selectors.map(show))
			.filter((selector) => selector.includes('[data-rp-drop="after"]'));
		expect(afterRules).toEqual(['.renovation-plan-editor [role="treeitem"][data-rp-drop="after"]::after']);
		expect(rulesFor(afterRules[0] ?? '')[0]?.declarations.map(propertyOf)).toContain('position');
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
	});

	it('writes nothing and re-reads nothing for a drop onto the row\'s own place', async () => {
		const { execute, queries, commands } = rig();
		const harness = await open({ queries, commands });
		await settle();
		await item(harness, 'plan-first').trigger('dragstart', { dataTransfer });
		await item(harness, 'plan-ground').trigger('dragover', { dataTransfer, clientY: 1 });
		await item(harness, 'plan-ground').trigger('drop', { dataTransfer });
		await settle();
		expect(execute).not.toHaveBeenCalled();
		expect(queries.hierarchy).toHaveBeenCalledTimes(1);
	});

	/**
	 * Another leaf's write lands between two gestures: a re-read that keeps the row leaves the menu
	 * open, one that takes the row CLOSES it — not merely hides it, which the same id coming back
	 * on a later read proves, since a hidden menu would reopen at its old point and take focus — and
	 * a drop whose target is gone moves nothing.
	 */
	it('closes the menu for good and voids a pending drop when a re-read takes the row away', async () => {
		const { execute, queries, commands } = rig();
		const harness = await open({ queries, commands });
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
		const harness = await open({ queries, commands });
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
	});

	/** The release is `write()`'s `finally`, so a REFUSED sequence frees the menu exactly as a landed one does. */
	it('frees the menu again when the sequence it was greyed for is refused', async () => {
		const { execute, queries, commands } = rig();
		execute.mockImplementation(() => Promise.resolve(REFUSED));
		const release = deferred(execute);
		const notify = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
		onTestFinished(() => notify.mockRestore());
		const harness = await open({ queries, commands });
		await settle();
		await item(harness, 'plan-attic').trigger('keydown', { key: 'ArrowUp', altKey: true });
		await item(harness, 'plan-ground').trigger('keydown', { key: 'F10', shiftKey: true });
		expect(harness.wrapper.get('[data-rp-tree-action="kind:building"]').attributes('aria-disabled')).toBe('true');
		release();
		await settle();
		expect(notify).toHaveBeenCalledOnce();
		expect(menuOpen(harness)).toBe(true);
		for (const entry of harness.wrapper.findAll('.rp-property-tree__menu [data-rp-tree-action="kind:building"], .rp-property-tree__menu [data-rp-tree-action="move-down"]')) {
			expect(entry.attributes('aria-disabled')).toBeUndefined();
		}
	});

	it('claims nothing in review perspective: the native menu, Shift+F10 and Alt moves are left alone', async () => {
		const { execute, queries, commands } = rig();
		const harness = await open({ queries, commands });
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
	});

	/** An outside pointer is the user putting focus somewhere else; closing must not pull it back to the row. */
	it('closes on a pointer outside the menu without stealing focus from where it landed, not on one inside it', async () => {
		const { queries, commands } = rig();
		const harness = await open({ queries, commands });
		await settle();
		await item(harness, 'plan-ground').trigger('contextmenu', { clientX: 20, clientY: 20 });
		harness.wrapper.get('[data-rp-tree-action="move-up"]').element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		await settle();
		expect(menuOpen(harness)).toBe(true);
		// A browser fires pointerdown BEFORE it moves focus, so the menu's close runs while focus is
		// still on the opener — the order in which a restore would be observable.
		const elsewhere = document.createElement('button');
		document.body.appendChild(elsewhere);
		onTestFinished(() => elsewhere.remove());
		elsewhere.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		elsewhere.focus();
		await settle();
		expect(menuOpen(harness)).toBe(false);
		expect(document.activeElement).toBe(elsewhere);
	});

	/**
	 * A NON-focusable target is where a pulled-back focus is visible at all: a click on plain text
	 * moves focus to `body`, and a close that refocused the row would leave the row focused instead.
	 */
	it('leaves focus off the row after a pointer on a non-focusable target outside the menu', async () => {
		const { queries, commands } = rig();
		const harness = await open({ queries, commands });
		await settle();
		await item(harness, 'plan-ground').trigger('contextmenu', { clientX: 20, clientY: 20 });
		await settle();
		expect(menuOpen(harness)).toBe(true);
		const text = document.createElement('div');
		document.body.appendChild(text);
		onTestFinished(() => text.remove());
		text.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		(document.activeElement as HTMLElement | null)?.blur();
		await settle();
		expect(menuOpen(harness)).toBe(false);
		expect(item(harness, 'plan-ground').element.contains(document.activeElement)).toBe(false);
	});

	/** A parent under the SECOND root: the sibling lookup walks the first root's subtree, finds nothing, and moves on. */
	it('flags first and last among the siblings of a second root, and names an unnamed row\'s menu the floor', async () => {
		const { queries, commands } = rig([TREE[0], { ...TREE[1], children: [leaf('plan-shed', 'Shed', 'plan-garden', 0), leaf('plan-pond', '', 'plan-garden', 1)] }]);
		const harness = await open({ queries, commands });
		await settle();
		await item(harness, 'plan-pond').trigger('contextmenu', { clientX: 20, clientY: 20 });
		expect(harness.wrapper.get('.rp-property-tree__menu').attributes('aria-label')).toBe(t('en', 'editor.shell.row-menu', { name: t('en', 'editor.floor') }));
		expect(harness.wrapper.get('[data-rp-tree-action="move-up"]').attributes('aria-disabled')).toBeUndefined();
		expect(harness.wrapper.get('[data-rp-tree-action="move-down"]').attributes('aria-disabled')).toBe('true');
	});

	it('offers no move for the open plan drawn alone, when the leaf answers no hierarchy', async () => {
		const { execute, commands } = rig();
		const harness = await open({ queries: fakeQueries(FIXTURE_PLAN), commands });
		await settle();
		await item(harness, FIXTURE_PLAN.id).trigger('keydown', { key: 'ArrowUp', altKey: true });
		await settle();
		expect(execute).not.toHaveBeenCalled();
	});
});
