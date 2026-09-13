// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { t } from '../../../../src/presentation/i18n/strings';
import { useRenovationSession } from '../../../../src/presentation/editor/renovation/renovationSession';
import { mountPlanEditorCanvas, runtimeOf, settle } from '../../../helpers/editor';

const mounted: Awaited<ReturnType<typeof mountPlanEditorCanvas>>[] = [];
afterEach(() => { for (const harness of mounted.splice(0)) harness.unmount(); });

it('keeps Select and Pan in both perspectives but reserves layout Add for Plan', async () => {
	const harness = await mountPlanEditorCanvas(); mounted.push(harness);
	const actionIds = () => harness.wrapper.findAll('.rp-primary-actions button').map(button => button.attributes('data-rp-action'));

	expect(actionIds()).toEqual(['select', 'pan', 'add']);
	useRenovationSession(harness.pinia).perspective = 'renovate';
	await settle();
	expect(actionIds()).toEqual(['select', 'pan']);
});

it('names shared room-draft invalid and busy outcomes without offering busy cancellation', async () => {
	const harness = await mountPlanEditorCanvas(); mounted.push(harness);
	const runtime = runtimeOf(harness);
	runtime.setTool('draw-room');
	runtime.roomDraft.setRect({ x: 0, y: 0, width: 4200, depth: 3000 });
	await settle();

	const banner = () => harness.wrapper.get('.rp-task-banner');
	expect(banner().attributes('data-rp-task-state')).toBeUndefined();
	expect(banner().get('.rp-task-banner__finish').attributes('aria-disabled')).toBe('false');

	runtime.roomDraft.commitDimension('width', '0', () => ({ x: 0, y: 0 }));
	await settle();
	expect(banner().attributes('data-rp-task-state')).toBe('invalid');
	expect(banner().classes()).toContain('rp-task-banner--invalid');
	expect(banner().get('[data-rp-task-state-message="invalid"]').text()).toBe(t('en', 'editor.task.finish.blocked'));
	expect(banner().get('.rp-task-banner__finish').attributes('aria-disabled')).toBe('true');

	runtime.roomDraft.setRect({ x: 0, y: 0, width: 4200, depth: 3000 });
	runtime.roomDraft.setSubmitting(true);
	await settle();
	const cancel = banner().get('.rp-task-banner__cancel');
	expect(banner().attributes('data-rp-task-state')).toBe('busy');
	expect(banner().classes()).toContain('rp-task-banner--busy');
	expect(banner().get('[data-rp-task-state-message="busy"]').text()).toBe(t('en', 'save-state.saving'));
	expect(banner().get('.rp-task-banner__finish').attributes('aria-disabled')).toBe('true');
	expect(cancel.attributes('aria-disabled')).toBe('true');

	await cancel.trigger('click');
	expect(runtime.activeToolId.value).toBe('draw-room');
	expect(runtime.roomDraft.submitting).toBe(true);
});
