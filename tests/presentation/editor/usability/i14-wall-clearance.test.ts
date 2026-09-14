// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { expectOk } from '../../../helpers/domain';
import { settle } from '../../../helpers/editor';
import { placeAt, resizeTo } from '../../../helpers/layout';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

// Canvas sizes from the accepted EN/DE 460x800 browser evidence. jsdom does not lay out CSS;
// drive the same ResizeObservers with those measurements, including later font/content reflow.
it.each([138.6875, 174.6875])('keeps wall controls above a wrapping taskbar when the canvas starts at %spx', async canvasTop => {
	const rig = await renovationEditor(true); mounted.push(rig);
	rig.selection.select(['wall-a' as never]);
	await rig.runtime.renovation.perspective('renovate'); await settle();
	resizeTo(rig.rootEl, 460, 800); await settle();
	const height = 764 - canvasTop;
	placeAt(rig.canvasEl, 80, canvasTop, 380, height);
	resizeTo(rig.canvasEl, 380, height); await settle();
	const popover = rig.wrapper.get<HTMLElement>('.rp-wall-canvas-actions').element;
	const primary = rig.wrapper.get<HTMLElement>('.rp-primary-actions').element;
	placeAt(popover, 0, 0, 172, 64);
	placeAt(primary, 88, 636, 364, 104);
	const editor = useEditorStore(rig.pinia);
	editor.panByScreen(0, 1000);
	resizeTo(primary, 364, 104); await settle();
	const bottom = (contentHeight: number) => canvasTop + Number.parseFloat(popover.style.top) + contentHeight;
	expect(bottom(64)).toBeLessThanOrEqual(636 - 16);
	const before = expectOk(await rig.geometry.read(rig.plan.id)), camera = { ...editor.viewport };
	const detail = rig.wrapper.get<HTMLButtonElement>('[data-rp-wall-length]').element;
	detail.focus();
	placeAt(primary, 88, 588, 364, 152);
	resizeTo(primary, 364, 152); await settle();
	expect(bottom(64)).toBeLessThanOrEqual(588 - 16);
	placeAt(popover, 0, 0, 172, 110);
	resizeTo(popover, 172, 110); await settle();
	expect(bottom(110)).toBeLessThanOrEqual(588 - 16);
	expect(document.activeElement).toBe(detail);
	expect(editor.viewport).toEqual(camera);
	expect(expectOk(await rig.geometry.read(rig.plan.id))).toEqual(before);
});
