/**
 * @vitest-environment jsdom
 *
 * The asset designer harness's `&writable` knob (AD18-R23): the page composed over the in-memory
 * stack through `../helpers/designerComposition`, so a Group, an undo and a redo really write.
 * Mounted through `mountAssetDesignerHarness`, the function `page.ts` calls. Every assertion that a
 * GESTURE wrote reads the design back through the stack's own `GetAssetDesignQuery` rather than
 * trusting the leaf's store; the peer case asserts on the store, because what it checks is that the
 * leaf re-read.
 *
 * The set is built on the Parts rows and the menu opened by a right-click on one of them:
 * `../helpers/designerRightClick` takes a `DesignerRig` (it resolves a world point through
 * `rig.at`), which this page mount is not.
 */
import { afterEach, expect, it, vi } from 'vitest';
import type { App } from 'vue';
import { mountAssetDesignerHarness, pressTool } from './assetDesigner';
import type { AssetDesignerView } from '../../src/presentation/designer/AssetDesignerView';
import { useAssetDesignStore } from '../../src/presentation/designer/stores/assetDesignStore';
import type { StringKey } from '../../src/presentation/i18n/locales/en';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver, placeAt, resizeTo } from '../helpers/layout';
import { expectOk } from '../helpers/domain';
import { settle, settleUntil } from '../helpers/settle';

const mounted: Array<ReturnType<typeof mountAssetDesignerHarness>> = [];
afterEach(async () => {
	for (const { view } of mounted.splice(0)) await view.onClose();
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

const GROUP = [{ id: 'group-1', members: ['detail-1', 'detail-2'] }];

async function mountWritable(knobs: Parameters<typeof mountAssetDesignerHarness>[2] = {}) {
	installCanvas();
	installResizeObserver();
	const harness = mountAssetDesignerHarness(document.body, 'toilet', { writable: true, ...knobs });
	mounted.push(harness);
	const { view } = harness;
	await settleUntil(() => view.contentEl.querySelector('.rp-plan-canvas') !== null, 'the designer canvas');
	const canvas = view.contentEl.querySelector<HTMLElement>('.rp-plan-canvas') as HTMLElement;
	placeAt(canvas, 0, 0, 800, 600);
	resizeTo(canvas, 800, 600);
	await settleUntil(() => view.contentEl.dataset.rpHarnessReady !== undefined, 'the designer knobs to land');
	await settle();
	const composed = await (harness.composed as NonNullable<typeof harness.composed>);
	const host = view.contentEl.querySelector('.renovation-asset-designer-view') as HTMLElement & { __vue_app__: App };
	const store = useAssetDesignStore(host.__vue_app__.config.globalProperties.$pinia);
	/** The groups as the STACK holds them, read through the real query. */
	const groups = async () => expectOk(await composed.queries.getAssetDesign(composed.assetId)).shape?.groups;
	return { view, composed, store, groups };
}

function row(view: { contentEl: HTMLElement }, name: string): HTMLElement {
	return view.contentEl.querySelector(`.rp-designer-part-row[name="${name}"]`) as HTMLElement;
}

async function press(target: HTMLElement, init: MouseEventInit = {}): Promise<void> {
	target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
	await settle();
}

/** The harness's own `pressTool`, so the accessible-name lookup lives in one place. */
async function pressAndSettle(view: AssetDesignerView, label: StringKey): Promise<void> {
	pressTool(view, label);
	await settle();
}

it('groups two details from the right-click menu, and the stack reads the group back; undo and redo write too', async () => {
	const { view, groups } = await mountWritable();
	expect(await groups()).toEqual([]);

	await press(row(view, 'detail:detail-1'));
	await press(row(view, 'detail:detail-2'), { shiftKey: true });
	row(view, 'detail:detail-2').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
	await settle();
	await press(view.contentEl.querySelector('.rp-canvas-context-menu [data-rp-context-action="group"]') as HTMLElement);
	expect(await groups()).toEqual(GROUP);

	await pressAndSettle(view, 'designer.toolbar.undo');
	expect(await groups()).toEqual([]);
	await pressAndSettle(view, 'designer.toolbar.redo');
	expect(await groups()).toEqual(GROUP);
});

it('re-hydrates the leaf when a PEER writes, because onDesignChanged is a real bus', async () => {
	const { composed, store } = await mountWritable();
	expect(store.design?.shape?.facing).not.toBe(Math.PI);

	expectOk(await composed.setFacing.execute({ assetId: composed.assetId, facing: Math.PI }));
	await settleUntil(() => store.design?.shape?.facing === Math.PI, 'the leaf to re-read the peer write');
});

it('refuses &stale beside &writable on the console and opens the writable leaf anyway', async () => {
	const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	const { store } = await mountWritable({ stale: true });

	expect(error).toHaveBeenCalledWith(expect.stringContaining('&stale does not compose with &writable'));
	expect(store.stale).toBe(false);
});
