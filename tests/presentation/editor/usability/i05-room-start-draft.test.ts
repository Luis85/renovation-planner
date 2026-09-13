// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { mountPlanEditorCanvas, runtimeOf, settle } from '../../../helpers/editor';

const mounted: Awaited<ReturnType<typeof mountPlanEditorCanvas>>[] = [];
afterEach(() => { for (const harness of mounted.splice(0)) harness.unmount(); });

it('keeps the empty-floor entry point to three real starting routes', async () => {
	const harness = await mountPlanEditorCanvas({ zones: [] }); mounted.push(harness);
	const start = harness.wrapper.get('[data-rp-empty="floor-start"]');

	expect(start.findAll('[data-rp-route]').map(button => button.attributes('data-rp-route'))).toEqual(['rooms', 'reference', 'empty']);
	expect(start.text()).toContain('Add rooms');
	expect(start.text()).toContain('Upload a floor plan');
	expect(start.text()).toContain('Start empty');

	await start.get('[data-rp-route="rooms"]').trigger('click');
	await settle();
	expect(runtimeOf(harness).activeToolId.value).toBe('draw-room');
});

it('puts the ordinary room fields before free-form shape controls and marks the retained preview', async () => {
	const harness = await mountPlanEditorCanvas(); mounted.push(harness);
	const runtime = runtimeOf(harness);
	runtime.setTool('draw-room');
	await settle();

	const form = harness.wrapper.get('.rp-new-room');
	const children = [...form.element.children];
	const advancedIndex = children.findIndex(child => child.matches('.rp-new-room__advanced'));
	const nameIndex = children.findIndex(child => child.matches('.rp-new-room__field') && child.querySelector('.rp-new-room__name') !== null);
	const widthIndex = children.findIndex(child => child.querySelector('input[name="width"]') !== null);
	const depthIndex = children.findIndex(child => child.querySelector('input[name="depth"]') !== null);
	expect(advancedIndex).toBeGreaterThan(Math.max(nameIndex, widthIndex, depthIndex));

	runtime.roomDraft.setName('Kitchen');
	runtime.roomDraft.setRect({ x: 0, y: 0, width: 4200, depth: 3000 });
	await settle();
	expect(form.find('.rp-new-room__keep input').exists()).toBe(true);
	expect(form.get('.rp-new-room__create').attributes('aria-disabled')).toBe('false');
	expect(harness.wrapper.get('.rp-task-banner__finish').attributes('aria-disabled')).toBe('false');

	const width = form.get('input[name="width"]');
	await width.setValue('0');
	await width.trigger('blur');
	await settle();
	expect(width.attributes('aria-invalid')).toBe('true');
	expect(form.find('[data-rp-preview-state="last-valid"]').exists()).toBe(true);
	expect(form.get('.rp-new-room__create').attributes('aria-disabled')).toBe('true');
	expect(harness.wrapper.get('.rp-task-banner__finish').attributes('aria-disabled')).toBe('true');
	// Cancel remains the explicit task exit while the draft is invalid.
	expect(form.find('.rp-new-room__cancel').exists()).toBe(true);
});
