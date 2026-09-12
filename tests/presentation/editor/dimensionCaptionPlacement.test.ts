/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type Konva from 'konva';
import { renovationEditor } from '../../helpers/renovationEditor';
import { installResizeObserver, placeAt, resizeTo } from '../../helpers/layout';
import { expectDefined, expectOk } from '../../helpers/domain';
import { EMPTY_DEPTH, type Evidence } from '../../../src/domain/renovation/PlanningDepth';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { installDimensionFrames, flushDimensionFrames as flushLayout, clearDimensionFrames } from '../../helpers/dimensionFrames';

const cleanups: (() => void)[] = [];
beforeEach(() => {
	installResizeObserver();
	installDimensionFrames();
});
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	clearDimensionFrames(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

const positions = [[0.18, 0.2], [0.7, 0.22], [0.52, 0.82], [0.42, 0.62], [0.86, 0.68], [0.1, 0.76]] as const;
async function gallery() {
	const rig = await renovationEditor(true); cleanups.push(rig.unmount);
	const evidence: Evidence[] = positions.map(([x, y], index) => ({ id: `photo-${index}`, roomId: rig.room.id, targetId: rig.room.id, workId: '', recordId: '', path: 'scan.png', subpath: '',
		type: 'photo', phase: 'during', description: `Photo ${index + 1}`, pin: { x, y } }));
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [], work: [], decisions: [], depth: { ...EMPTY_DEPTH, evidence } }, intended: undefined }, rig.runtime.structureTask.ledger)));
	rig.runtime.renovation.focus(rig.room.id, 'photos'); rig.session.evidencePhase = 'during'; await flushLayout();
	const stage = expectDefined(rig.stage, 'native canvas');
	const group = expectDefined(stage.findOne<Konva.Group>('.zone')?.findOne<Konva.Group>('.' + rig.room.id), 'Room render group');
	return { ...rig, stage, group };
}

/** jsdom has no CSS layout: supply measured DOM bounds, keeping native controls and Konva. */
async function layoutDimensions(rig: Awaited<ReturnType<typeof gallery>>) {
	const root = rig.wrapper.get('.rp-dimension-labels').element as HTMLElement;
	placeAt(root, 200, 50, rig.stage.width(), rig.stage.height());
	for (const wrapper of rig.wrapper.findAll('.rp-dimension-anchor')) {
		const anchor = wrapper.element as HTMLElement, inline = !!anchor.querySelector('form');
		const width = inline ? 240 : 42, height = inline ? 300 : 30;
		placeAt(anchor, 200 + Number.parseFloat(anchor.style.left) - width / 2, 50 + Number.parseFloat(anchor.style.top), width, height);
	}
	resizeTo(root, rig.stage.width(), rig.stage.height()); await flushLayout();
	return [...root.querySelectorAll<HTMLElement>('.rp-dimension-anchor')].map(anchor => {
		const box = anchor.getBoundingClientRect();
		return { x: box.left - 200 - 4, y: box.top - 50 - 4, width: box.width + 8, height: box.height + 8 };
	});
}
type Rectangle = { x: number; y: number; width: number; height: number };
function assertClear(rig: Awaited<ReturnType<typeof gallery>>, dimensions: readonly Rectangle[]): void {
	const pins = rig.stage.find<Konva.Group>('.evidence-pin').map(pin => expectDefined(pin.findOne<Konva.Shape>('.evidence-pin-target'), 'pin target').getClientRect());
	expect(pins).toHaveLength(6);
	const captions = rig.group.find<Konva.Text>('Text').filter(text => text.isVisible()); expect(captions).toHaveLength(2);
	for (const caption of captions) {
		const box = caption.getClientRect();
		expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(rig.stage.height());
		for (const obstacle of [...pins, ...dimensions]) expect(box.x + box.width <= obstacle.x || obstacle.x + obstacle.width <= box.x || box.y + box.height <= obstacle.y || obstacle.y + obstacle.height <= box.y).toBe(true);
	}
}

it.each([0.05, 0.09])('keeps two native captions clear of six fixed pins and measured dimensions at zoom %s, through pan and inline editing', async zoom => {
	const rig = await gallery(), editor = useEditorStore(rig.pinia);
	editor.viewport = { zoom, pan: { x: -1000, y: -4000 } }; await flushLayout();
	const line = expectDefined(rig.group.findOne<Konva.Line>('Line'), 'Room geometry'), points = line.points();
	const pins = rig.stage.find<Konva.Group>('.evidence-pin').map(pin => pin.position()), bytes = [...rig.stack.vault.entries];
	assertClear(rig, await layoutDimensions(rig));
	editor.panByScreen(17, -13); await flushLayout(); assertClear(rig, await layoutDimensions(rig));
	const button = rig.wrapper.get('[data-rp-dimension="width"]'); (button.element as HTMLElement).focus(); await button.trigger('click'); await flushLayout();
	expect(rig.wrapper.find('[data-rp-form="room-dimension"]').exists()).toBe(true);
	assertClear(rig, await layoutDimensions(rig));
	rig.runtime.roomDimension.cancel(); await flushLayout(); assertClear(rig, await layoutDimensions(rig));
	expect(document.activeElement).toBe(rig.wrapper.get('[data-rp-dimension="width"]').element);
	expect(rig.stage.find<Konva.Group>('.evidence-pin').map(pin => pin.position())).toEqual(pins);
	expect(line.points()).toBe(points); expect([...rig.stack.vault.entries]).toEqual(bytes);
	useWorkspaceStore(rig.pinia).toggleLayer('zone'); await flushLayout();
	expect(rig.wrapper.find('.rp-dimension-anchor').exists()).toBe(false);
});

it('uses a visible downward caption position when a native inline dimension is clamped at y48', async () => {
	const rig = await gallery(), editor = useEditorStore(rig.pinia);
	editor.viewport = { zoom: 0.05, pan: { x: -1000, y: 0 } }; await flushLayout();
	const line = expectDefined(rig.group.findOne<Konva.Line>('Line'), 'Room geometry'), points = line.points();
	const pins = rig.stage.find<Konva.Group>('.evidence-pin').map(pin => pin.position()), bytes = [...rig.stack.vault.entries];
	await rig.wrapper.get('[data-rp-dimension="width"]').trigger('click'); await flushLayout();
	const form = rig.wrapper.get('[data-rp-form="room-dimension"]');
	expect((form.element.parentElement as HTMLElement).style.top).toBe('48px');
	const dimensions = await layoutDimensions(rig); assertClear(rig, dimensions);
	const top = Math.min(...rig.group.find<Konva.Text>('Text').map(text => text.getClientRect().y));
	expect(top).toBeGreaterThan(348);
	expect(rig.stage.find<Konva.Group>('.evidence-pin').map(pin => pin.position())).toEqual(pins);
	expect(line.points()).toBe(points); expect([...rig.stack.vault.entries]).toEqual(bytes);
	rig.runtime.roomDimension.cancel(); await flushLayout();
});
