// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { t } from '../../../../src/presentation/i18n/strings';
import CanvasContextMenu from '../../../../src/presentation/editor/selection/CanvasContextMenu.vue';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
import { useWorkspaceStore } from '../../../../src/presentation/stores/WorkspaceStore';
import { mountPlanEditorCanvas, runtimeOf, settle } from '../../../helpers/editor';
import { renovationEditor } from '../../../helpers/renovationEditor';

const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const harness of mounted.splice(0)) harness.unmount(); });

it('keeps Select and Pan in both perspectives but reserves layout Add for Plan', async () => {
	const harness = await renovationEditor(); mounted.push(harness);
	const runtime = harness.runtime;
	const actionIds = () => harness.wrapper.findAll('.rp-primary-actions button').map(button => button.attributes('data-rp-action'));
	const contextMenu = harness.wrapper.getComponent(CanvasContextMenu);

	expect(actionIds()).toEqual(['select', 'pan', 'add']);
	contextMenu.vm.$emit('openAdd');
	await settle();
	expect(harness.wrapper.find('.rp-add-menu').exists()).toBe(true);
	const roomId = [...useProjectStore(harness.pinia).zones.keys()].at(0) ?? '';
	expect(roomId).not.toBe('');
	runtime.renovation.focus(roomId, 'overview');
	await settle();
	expect(actionIds()).toEqual(['select', 'pan', 'add-work', 'renovation-more']);
	expect(harness.wrapper.get('[data-rp-action="renovation-more"] [data-icon="panels-top-left"]').attributes('data-icon-missing')).toBeUndefined();
	expect(harness.wrapper.find('.rp-add-menu').exists()).toBe(false);
	contextMenu.vm.$emit('openAdd');
	await settle();
	expect(harness.wrapper.find('.rp-add-menu').exists()).toBe(false);

	const addWork = vi.spyOn(runtime.renovation, 'addWork').mockResolvedValue();
	await harness.wrapper.get('[data-rp-action="add-work"]').trigger('click');
	expect(addWork).toHaveBeenCalledWith(roomId);
	const workspace = useWorkspaceStore(harness.pinia);
	workspace.setPanel('inspector', { collapsed: true });
	await harness.wrapper.get('[data-rp-action="renovation-more"]').trigger('click');
	await settle();
	expect(workspace.panelLayout.inspector.collapsed).toBe(false);
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
	const detailsCancel = harness.wrapper.get('.rp-new-room__cancel');
	expect(banner().attributes('data-rp-task-state')).toBe('busy');
	expect(banner().classes()).toContain('rp-task-banner--busy');
	expect(banner().get('[data-rp-task-state-message="busy"]').text()).toBe(t('en', 'save-state.saving'));
	expect(banner().get('.rp-task-banner__finish').attributes('aria-disabled')).toBe('true');
	expect(cancel.attributes('aria-disabled')).toBe('true');
	expect(detailsCancel.attributes('aria-disabled')).toBe('true');

	await cancel.trigger('click');
	await detailsCancel.trigger('click');
	expect(runtime.activeToolId.value).toBe('draw-room');
	expect(runtime.roomDraft.submitting).toBe(true);

	runtime.roomDraft.setSubmitting(false);
	await settle();
	expect(banner().get('.rp-task-banner__cancel').attributes('aria-disabled')).toBe('false');
	expect(harness.wrapper.get('.rp-new-room__cancel').attributes('aria-disabled')).toBe('false');
	await harness.wrapper.get('.rp-new-room__cancel').trigger('click');
	await settle();
	expect(runtime.activeToolId.value).toBe('select');
});
