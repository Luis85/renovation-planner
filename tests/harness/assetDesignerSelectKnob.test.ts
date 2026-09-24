/**
 * @vitest-environment jsdom
 *
 * The asset designer harness's knobs (`tests/harness/assetDesigner.ts`, read from the URL by `page.ts`):
 * `&select=` and `&mode=`, `&pending`, `&draw=`, `&camera=default` and `&stale` (Task 11,
 * AD18-R13/R15) beside `&preset=`, and the fit an opened design takes. Every preset-bearing fixed
 * shot in `scripts/harness-shot.mjs` waits on the `data-rp-harness-ready` mark `driveHarness` sets
 * last, so this file is what makes that mark mean the knobs landed rather than merely that a timer
 * ran.
 *
 * The canvas is sized as `designerRig` sizes it — jsdom lays nothing out, and a fit into 0 × 0 frames
 * nothing — and the leaf's Pinia is reached the way the harness itself reaches it.
 */
import Konva from 'konva';
import { afterEach, expect, it, vi } from 'vitest';
import type { App } from 'vue';
import { mountAssetDesignerHarness } from './assetDesigner';
import { useAssetDesignStore } from '../../src/presentation/designer/stores/assetDesignStore';
import { useSaveStateStore } from '../../src/presentation/editor/save-state/save-state-store';
import { useEditorStore } from '../../src/presentation/stores/EditorStore';
import { DEFAULT_VIEWPORT } from '../../src/presentation/editor/viewport/Viewport';
import { tr } from '../../src/presentation/i18n/strings';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver, placeAt, resizeTo } from '../helpers/layout';
import { settle, settleUntil } from '../helpers/settle';

const mounted: Array<ReturnType<typeof mountAssetDesignerHarness>> = [];
afterEach(async () => {
	for (const { view } of mounted.splice(0)) await view.onClose();
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

async function mountKnobs(presetId: string | null, knobs: Parameters<typeof mountAssetDesignerHarness>[2] = {}) {
	installCanvas();
	installResizeObserver();
	const harness = mountAssetDesignerHarness(document.body, presetId, knobs);
	mounted.push(harness);
	const { view } = harness;
	await settleUntil(() => view.contentEl.querySelector('.rp-plan-canvas') !== null, 'the designer canvas');
	const canvas = view.contentEl.querySelector<HTMLElement>('.rp-plan-canvas') as HTMLElement;
	placeAt(canvas, 0, 0, 800, 600);
	resizeTo(canvas, 800, 600);
	const host = view.contentEl.querySelector('.renovation-asset-designer-view') as HTMLElement & { __vue_app__: App };
	const pinia = host.__vue_app__.config.globalProperties.$pinia;
	return { view, canvas, pinia, store: useAssetDesignStore(pinia), editor: useEditorStore(pinia) };
}

const ready = (view: { contentEl: HTMLElement }): boolean => view.contentEl.dataset.rpHarnessReady !== undefined;

/** The mark, then one flush so the DOM shows what the knobs wrote to the stores. */
async function landed(view: { contentEl: HTMLElement }): Promise<void> {
	await settleUntil(() => ready(view), 'the designer knobs to land');
	await settle();
}

it('&select= and &mode= select that part in that mode under the real Select button, then mark the view ready', async () => {
	const { view, store } = await mountKnobs('toilet', { select: 'detail-2', mode: 'points' });
	await landed(view);

	expect(store.selection).toEqual({ kind: 'detail', id: 'detail-2' });
	expect(store.mode).toBe('points');
	const pressed = [...view.contentEl.querySelectorAll('.rp-designer-tools > button[aria-pressed="true"]')].map((button) => button.textContent?.trim());
	expect(pressed).toEqual([tr('designer.toolbar.select')]);
	expect(view.contentEl.querySelector('.rp-designer-selection-modes [aria-pressed="true"]')?.textContent?.trim()).toBe(tr('designer.selection.mode.points'));
});

it('reads an unknown &mode= as Transform, and draws no mode control for the anchor', async () => {
	const { view, store } = await mountKnobs('toilet', { select: 'anchor', mode: 'bogus' });
	await landed(view);

	expect(store.selection).toEqual({ kind: 'anchor' });
	expect(store.mode).toBe('transform');
	expect(view.contentEl.querySelector('.rp-designer-selection-modes')).toBeNull();
});

/** A shapeless fixture has no part to select: the knobs are honoured only beside a preset. */
it('honours no knob without a preset: nothing is selected and the view is never marked', async () => {
	const { view, store } = await mountKnobs(null, { select: 'detail-2', mode: 'points' });
	await settleUntil(() => store.design !== null, 'the shapeless fixture');
	await settle();
	await settle();

	expect(store.selection).toBeNull();
	expect(ready(view)).toBe(false);
});

/**
 * A second Shift+1 is the instrument: the fit the designer took on opening, against the measured canvas,
 * leaves nothing for the press to move — while a fit that never ran, or ran into 0 × 0, would move it now.
 * The harness presses no fit of its own, so this is the product's.
 */
it('opens a preset framed exactly as Shift+1 frames it, and &camera=default puts the default camera back', async () => {
	const framed = await mountKnobs('curved-table');
	await landed(framed.view);
	const fitted = framed.editor.viewport;
	framed.canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', shiftKey: true, bubbles: true, cancelable: true }));
	expect(framed.editor.viewport).toEqual(fitted);
	expect(fitted).not.toEqual(DEFAULT_VIEWPORT);

	const opened = await mountKnobs('curved-table', { camera: 'default' });
	await landed(opened.view);
	expect(opened.editor.viewport).toEqual(DEFAULT_VIEWPORT);
});

it('&pending marks every part of the preset as captured before a scale existed', async () => {
	const { view, store } = await mountKnobs('toilet', { pending: true });
	await landed(view);

	expect(store.design?.shape?.footprintPending).toBe(true);
	expect(store.design?.shape?.anchorPending).toBe(true);
	expect(store.design?.shape?.clearancePending).toBe(true);
	expect(store.design?.shape?.details.map((detail) => detail.pending)).toEqual([true, true]);
	expect(store.design?.dimensionsUnscaled).toBe(true);
});

it.each(['draw-rect', 'draw-circle'] as const)('&draw=%s holds its drag, so the preview is drawn and nothing is written', async (draw) => {
	const { view, editor, pinia } = await mountKnobs('toilet', { draw });
	await landed(view);

	expect(editor.activeToolId).toBe(draw);
	expect((Konva.stages.at(-1) as Konva.Stage).findOne('.detail-preview')).toBeDefined();
	// Every harness write refuses, so a release that slipped through would flip the badge.
	expect(useSaveStateStore(pinia).state).not.toBe('save-error');
});

it('&draw=trace-detail leaves three vertices placed and the outline open', async () => {
	const { view, editor, pinia } = await mountKnobs('toilet', { draw: 'trace-detail' });
	await landed(view);

	expect(editor.activeToolId).toBe('trace-detail');
	expect(((Konva.stages.at(-1) as Konva.Stage).findOne('.gesture-sketch') as Konva.Group).find('Circle')).toHaveLength(3);
	expect(useSaveStateStore(pinia).state).not.toBe('save-error');
});

it('refuses a &draw= tool it does not know, loudly, and still marks the view', async () => {
	const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	const { view, editor } = await mountKnobs('toilet', { draw: 'wiggle' });
	await landed(view);

	expect(error).toHaveBeenCalledWith(expect.stringContaining('wiggle'));
	// The refused knob presses nothing, so the leaf keeps the Select it rests in (AD18-R20).
	expect(editor.activeToolId).toBe('select');
});

/**
 * **The OTHER way a `&draw=` capture can come out empty, and it was silent until AD18 item 5.**
 * `pressTool` used to answer a button it could not find with `?.click()` on `undefined` — nothing —
 * so a tool whose button had MOVED left `harness-shot` writing `asset-designer-draw-rect.png` of an
 * idle canvas and exiting 0. AD18-R3 moved four buttons, which is exactly that hazard arriving, and
 * the fix is the refusal the case above already pins for an unknown tool NAME: the repository was
 * testing the loud failure one level up and permitting the silent one a function below it.
 *
 * Driven by removing the rail's shape group before the knobs run, which is deterministic rather
 * than raced: `driveHarness` waits on `editor.stageSize.width > 0`, and nothing sets that until the
 * `resizeTo` below — so the DOM edit lands strictly between the mount and the press. That is also
 * the only honest way to reach this arm, since every label the knob can name is rendered today.
 */
it('refuses a &draw= tool whose button it cannot find, rather than capturing an idle canvas', async () => {
	const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	installCanvas();
	installResizeObserver();
	const harness = mountAssetDesignerHarness(document.body, 'toilet', { draw: 'draw-rect' });
	mounted.push(harness);
	const { view } = harness;
	await settleUntil(() => view.contentEl.querySelector('.rp-plan-canvas') !== null, 'the designer canvas');
	// The `Add` rail is where AD18-R3 put `draw-rect`; taking the group away is a button that moved
	// again, which is the regression this refusal exists for.
	view.contentEl.querySelector('.rp-designer-add-shapes')?.remove();
	const canvas = view.contentEl.querySelector<HTMLElement>('.rp-plan-canvas') as HTMLElement;
	placeAt(canvas, 0, 0, 800, 600);
	resizeTo(canvas, 800, 600);
	await landed(view);

	const host = view.contentEl.querySelector('.renovation-asset-designer-view') as HTMLElement & { __vue_app__: App };
	expect(error).toHaveBeenCalledWith(expect.stringContaining(tr('designer.toolbar.draw-rect')));
	// The refused knob presses nothing, so the leaf keeps the Select it rests in (AD18-R20).
	expect(useEditorStore(host.__vue_app__.config.globalProperties.$pinia).activeToolId).toBe('select');
});

/**
 * `&stale` (Task 11, AD18-R13/R15): the knob `designerStaleRetry.test.ts`'s own docblock records
 * as missing — no fixture could put the designer into this state, so AD18-R15's whole finding was
 * measured through an injected probe rather than a capture. Driven through `AssetDesignStore.
 * hydrate`'s real keep-previous door, exactly as that unit test's own `goStale` helper drives it,
 * so this is the same episode a real vault fault produces rather than a shortcut past it.
 */
it('&stale re-hydrates through the store’s real door, landing on a notice and a retry over content that stays on screen', async () => {
	const { view, store } = await mountKnobs('toilet', { stale: true });
	await landed(view);

	expect(store.stale).toBe(true);
	// The canvas was never taken away: AD18-R13's whole point is that a non-authoritative read
	// failure must not blank a design that is still perfectly drawable.
	expect(store.design).not.toBeNull();
	const notices = [...view.contentEl.querySelectorAll('.rp-designer-notice')].map((notice) => notice.textContent?.trim());
	expect(notices).toContain(tr('designer.refresh-failed'));
	expect(view.contentEl.querySelector('button[data-rp-action="retry"]')).not.toBeNull();
});

it('honours &stale only beside a preset: a shapeless fixture never goes stale', async () => {
	const { view, store } = await mountKnobs(null, { stale: true });
	await settleUntil(() => store.design !== null, 'the shapeless fixture');
	await settle();

	expect(store.stale).toBe(false);
	expect(ready(view)).toBe(false);
});
