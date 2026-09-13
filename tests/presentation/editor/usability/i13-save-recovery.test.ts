// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import DraftRecovery from '../../../../src/presentation/editor/forms/DraftRecovery.vue';
import PersistentWarningStrip from '../../../../src/presentation/editor/shell/PersistentWarningStrip.vue';
import { editorWarnings } from '../../../../src/presentation/editor/shell/warnings';
import { useSaveStateStore } from '../../../../src/presentation/editor/save-state/save-state-store';
import { t } from '../../../../src/presentation/i18n/strings';
import { FIXTURE_PLAN } from '../../../helpers/planFixtures';
import { mountPlanEditorCanvas, type CanvasHarness } from '../../../helpers/editor';

const canvases: CanvasHarness[] = [];
const wrappers: VueWrapper[] = [];

beforeEach(() => {
	setActivePinia(createPinia());
});

afterEach(() => {
	canvases.splice(0).forEach(canvas => canvas.wrapper.unmount());
	wrappers.splice(0).forEach(wrapper => wrapper.unmount());
});

it('I13 names reference scale only when this loaded plan has a reference background', async () => {
	const noReference = await mountPlanEditorCanvas();
	canvases.push(noReference);
	expect(noReference.wrapper.find('.rp-editor-scale').exists()).toBe(false);

	const reference = await mountPlanEditorCanvas({
		plan: { ...FIXTURE_PLAN, background: { path: 'Plans/ground.png', kind: 'image' } },
	});
	canvases.push(reference);
	expect(reference.wrapper.get('.rp-editor-scale').text()).toBe(t('en', 'editor.status.scale.uncalibrated'));
});

it('I13 keeps an unconfirmed write distinct from a read-failed draft and never restores its read retry', async () => {
	const retry = vi.fn<() => Promise<void>>().mockResolvedValue();
	const openSource = vi.fn<() => Promise<void>>().mockResolvedValue();
	const recovery = mount(DraftRecovery, { props: { retry, openSource } });
	wrappers.push(recovery);

	expect(recovery.attributes('data-rp-recovery-state')).toBe('read-failed');
	expect(recovery.attributes('aria-atomic')).toBe('false');
	expect(recovery.findAll('button')).toHaveLength(2);

	useSaveStateStore().markUnrecovered();
	await recovery.vm.$nextTick();
	expect(recovery.attributes('data-rp-recovery-state')).toBe('unconfirmed');
	expect(recovery.text()).toContain('Reading again cannot repair');
	expect(recovery.findAll('button')).toHaveLength(1);
	await recovery.get('button').trigger('click');
	expect(retry).not.toHaveBeenCalled();
	expect(openSource).toHaveBeenCalledOnce();
});

it('I13 announces only changed warning rows while retaining their safe read actions', () => {
	const warnings = editorWarnings({
		unrecoveredWrite: false,
		stale: true,
		refreshing: false,
		retriesFailed: 0,
		unreadableZones: 0,
		backgroundStatus: 'none',
		retry: () => undefined,
		openSourceNote: () => undefined,
	});
	const strip = mount(PersistentWarningStrip, { props: { warnings } });
	wrappers.push(strip);

	expect(strip.attributes('role')).toBe('status');
	expect(strip.attributes('aria-atomic')).toBe('false');
	expect(strip.attributes('aria-relevant')).toBe('additions text');
	expect(strip.get('[data-rp-warning="stale"]').findAll('[data-rp-action]').map(action => action.attributes('data-rp-action')))
		.toEqual(['retry', 'open-source-note']);
});
