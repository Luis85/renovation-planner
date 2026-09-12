// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanNorthServices } from '../../../src/application/commands/plan/SetPlanNorth';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { err, ok } from '../../../src/core/result/Result';
import { unavailablePlanEditorCommands } from '../../../src/presentation/editor/planEditorCommands';
import { useRenovationSession } from '../../../src/presentation/editor/renovation/renovationSession';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { mountPlanEditorCanvas, settle, type EditorHarness } from '../../helpers/editor';
import { Notice } from '../../helpers/obsidian-mock';
import { FIXTURE_PLAN } from '../../helpers/planFixtures';
import { installObsidianDom } from '../../helpers/dom';

installObsidianDom();
beforeEach(() => { activateNotices(); });

function northService(execute: () => Promise<DispatchResult> = () => Promise.resolve(ok('wrote'))) {
	const command = vi.fn<PlanNorthServices['command']>(() => ({ execute, undo: () => Promise.resolve(ok('wrote')) }));
	return { command, commands: { ...unavailablePlanEditorCommands(), planNorth: { command } } };
}

async function shown(h: EditorHarness) {
	expect(h.wrapper.find('.rp-north-arrow').exists()).toBe(false);
	await h.wrapper.get('[data-rp-view="north"]').setValue(true);
	return h.wrapper.get('.rp-north-arrow');
}

async function pointer(arrow: { readonly element: Element }, type: string, clientX: number, clientY: number): Promise<void> {
	arrow.element.dispatchEvent(new PointerEvent(type, { pointerId: 1, clientX, clientY, bubbles: true }));
	await settle();
}

describe('north arrow', () => {
	it('shows from the View menu at the plan\'s saved bearing, and an arrow key saves one step', async () => {
		const { command, commands } = northService();
		const h = await mountPlanEditorCanvas({ plan: { ...FIXTURE_PLAN, north: 90 }, commands });
		try {
			const arrow = await shown(h);
			expect(arrow.get('g').attributes('transform')).toBe('rotate(90)');
			expect(arrow.attributes('aria-valuenow')).toBe('90');
			expect(arrow.attributes('aria-disabled')).toBe('false');
			await arrow.trigger('keydown', { key: 'ArrowRight' });
			await settle();
			await arrow.trigger('keydown', { key: 'ArrowDown' });
			await arrow.trigger('keydown', { key: 'a' });
			await settle();
			expect(command.mock.calls).toEqual([['plan-ground', 105], ['plan-ground', 75]]);
		} finally { h.unmount(); }
	});

	it('previews a drag snapped to 15 degrees, saves once on release, and saves nothing for a cancel or no turn', async () => {
		const { command, commands } = northService();
		const h = await mountPlanEditorCanvas({ commands });
		try {
			const arrow = await shown(h);
			const capture = vi.fn<(pointerId: number) => void>();
			Object.assign(arrow.element, { setPointerCapture: capture });
			await pointer(arrow, 'pointerdown', 10, 1);
			expect(capture).toHaveBeenCalledWith(1);
			expect(arrow.get('g').attributes('transform')).toBe('rotate(90)');
			await pointer(arrow, 'pointermove', 1, 10);
			expect(arrow.get('g').attributes('transform')).toBe('rotate(180)');
			await pointer(arrow, 'pointerup', 1, 10);
			expect(command.mock.calls).toEqual([['plan-ground', 180]]);
			await pointer(arrow, 'pointermove', 10, 0);
			await pointer(arrow, 'pointerup', 10, 0);
			delete (arrow.element as { setPointerCapture?: unknown }).setPointerCapture;
			await pointer(arrow, 'pointerdown', -10, 0);
			await pointer(arrow, 'pointercancel', -10, 0);
			expect(arrow.get('g').attributes('transform')).toBe('rotate(0)');
			await pointer(arrow, 'pointerdown', 0, -10);
			await pointer(arrow, 'pointerup', 0, -10);
			expect(command).toHaveBeenCalledTimes(1);
		} finally { h.unmount(); }
	});

	it('draws a still arrow with no service, in review, or once writes block mid-drag', async () => {
		const bare = await mountPlanEditorCanvas();
		try {
			const arrow = await shown(bare);
			expect(arrow.attributes('aria-disabled')).toBe('true');
			await arrow.trigger('keydown', { key: 'ArrowRight' });
			await pointer(arrow, 'pointerdown', 10, 0);
			expect(arrow.get('g').attributes('transform')).toBe('rotate(0)');
		} finally { bare.unmount(); }

		const { command, commands } = northService();
		const h = await mountPlanEditorCanvas({ commands });
		try {
			const arrow = await shown(h);
			const session = useRenovationSession(h.pinia);
			await pointer(arrow, 'pointerdown', 10, 0);
			session.perspective = 'review'; await settle();
			await pointer(arrow, 'pointerup', 10, 0);
			expect(arrow.get('g').attributes('transform')).toBe('rotate(0)');
			expect(arrow.attributes('aria-disabled')).toBe('true');
			expect(command).not.toHaveBeenCalled();
		} finally { h.unmount(); }
	});

	it('surfaces a refused write and a thrown one as notices, and drops the preview', async () => {
		const refused = northService(() => Promise.resolve(err({ category: 'Validation', code: 'plan.revision-conflict', message: 'stale' })));
		const thrown = northService(() => Promise.reject(new Error('disk unavailable')));
		for (const { commands } of [refused, thrown]) {
			const h = await mountPlanEditorCanvas({ commands });
			try {
				const arrow = await shown(h), before = Notice.shown.length;
				await arrow.trigger('keydown', { key: 'ArrowLeft' });
				await settle();
				expect(Notice.shown.length).toBe(before + 1);
				expect(arrow.get('g').attributes('transform')).toBe('rotate(0)');
			} finally { h.unmount(); }
		}
	});
});
