// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { rig } from '../../../helpers/planEditorRig';
import { runtimeOf, settle, settleUntil } from '../../../helpers/editor';

const mounted: Awaited<ReturnType<typeof rig>>[] = [];
const form = '[data-rp-form="room-dimension"]';

afterEach(() => { for (const value of mounted.splice(0)) value.harness.unmount(); });

async function openWidth(value: Awaited<ReturnType<typeof rig>>): Promise<void> {
	runtimeOf(value.harness).selectAndFrame('zone-a');
	await settle();
	await value.harness.wrapper.get('[data-rp-dimension="width"]').trigger('click');
	await settleUntil(() => value.harness.wrapper.find(form).exists(), 'inline room dimension form');
}

it('I10 keeps the scalar proposal, its scope, and a no-write cancel together', async () => {
	const value = await rig();
	mounted.push(value);
	const runtime = runtimeOf(value.harness);
	await openWidth(value);

	const feedback = value.harness.wrapper.get('[data-rp-dimension-feedback]');
	expect(feedback.text()).toContain('Starting size:');
	expect(feedback.get('[role="status"]').text()).toContain('Preview:');
	expect(feedback.text()).toContain('Independent walls stay unchanged.');

	await value.harness.wrapper.get(`${form} input`).setValue('4.2');
	await settle();
	expect(feedback.get('[role="status"]').text()).toContain('4.2 m');
	expect(runtime.renderState.previewPolygon).not.toBeNull();

	await value.harness.wrapper.get(`${form} button[type="button"]`).trigger('click');
	await settle();
	expect(value.harness.wrapper.find(form).exists()).toBe(false);
	expect(runtime.renderState.previewPolygon).toBeNull();
	expect(runtime.canUndo.value).toBe(false);
});
