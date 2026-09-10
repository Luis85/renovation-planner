// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { mountPlanEditorCanvas, runtimeOf, settleUntil } from '../../helpers/editor';

const mounted: Awaited<ReturnType<typeof mountPlanEditorCanvas>>[] = [];
afterEach(() => { for (const harness of mounted.splice(0)) harness.unmount(); });

it('reports the wall tool unavailable when no structure service is wired, rather than reading an absent one', async () => {
	const harness = await mountPlanEditorCanvas(); mounted.push(harness);
	const runtime = runtimeOf(harness);
	expect(runtime.structureTask.available).toBe(false);
	runtime.setTool('draw-wall');
	await settleUntil(() => !runtime.structureTask.draft.loading, 'wall task settled without a structure service');
	expect(runtime.structureTask.draft.error?.code).toBe('spatial.unavailable');
});
