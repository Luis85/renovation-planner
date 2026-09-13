/**
 * @vitest-environment jsdom
 *
 * `?rooms=N` (2026-09-13 performance pass): a plan with N synthetic rooms after the seeded ones,
 * so a capture or a probe can look at the canvas at the size SDD §62 budgets for.
 */
import { beforeEach, expect, it } from 'vitest';
import { mountPlanEditorHarness } from './planEditor';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver } from '../helpers/layout';
import { settleUntil, sizedShellRoot } from '../helpers/editor';

beforeEach(() => {
	document.body.innerHTML = '';
});

it('?rooms=40 draws forty rooms after the seeded ones, each with its own id', async () => {
	installCanvas();
	installResizeObserver();
	const { leafEl } = mountPlanEditorHarness(document.body, { rooms: 40 });
	sizedShellRoot(leafEl);
	await settleUntil(() => leafEl.querySelectorAll('.rp-floor-inspector .rp-room-list__row').length >= 40, 'forty rooms');
	const ids = [...leafEl.querySelectorAll<HTMLElement>('.rp-floor-inspector .rp-room-list__row')].map((row) => row.dataset['rpId']);
	expect(ids.filter((id) => id?.startsWith('harness-room-'))).toHaveLength(40);
	expect(new Set(ids).size).toBe(ids.length);
});
