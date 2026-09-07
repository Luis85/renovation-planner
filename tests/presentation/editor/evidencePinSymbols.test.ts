/** @vitest-environment jsdom */
import { afterEach, expect, it } from 'vitest';
import type Konva from 'konva';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { editorIconNodes } from '../../helpers/editorIconNodes';
import { EMPTY_DEPTH, type Evidence } from '../../../src/domain/renovation/PlanningDepth';
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

async function withTypedPin(type: Evidence['type'], count = 1) {
	const rig = await renovationEditor(true); mounted.push(rig);
	rig.stack.vault.entries.set('Notes/site.md', '# Site observation');
	const path = type === 'photo' ? 'scan.png' : type === 'document' ? 'scan.pdf' : 'Notes/site.md';
	const evidence: Evidence[] = Array.from({ length: count }, (_, index) => ({
		id: 'typed-evidence-' + index, roomId: rig.room.id, targetId: rig.room.id, workId: '', recordId: '', path, subpath: '',
		description: 'Site observation ' + (index + 1), type, phase: 'before', pin: index === count - 1 ? { x: 0.5, y: 0.5 } : null,
	}));
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [], work: [], decisions: [], depth: { ...EMPTY_DEPTH, evidence } }, intended: undefined }, rig.runtime.structureTask.ledger)));
	rig.runtime.renovation.focus(rig.room.id, type === 'photo' ? 'photos' : type === 'document' ? 'documents' : 'notes'); await settle();
	const pin = expectDefined(rig.stage.findOne<Konva.Group>('.evidence-pin'), 'evidence pin');
	return { ...rig, pin };
}

function expectInside(child: Konva.Node, parent: Konva.Node): void {
	const inner = child.getClientRect(), outer = parent.getClientRect();
	expect(inner.x).toBeGreaterThanOrEqual(outer.x); expect(inner.y).toBeGreaterThanOrEqual(outer.y);
	expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width);
	expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height);
}

it.each([
	['photo', 'image'], ['document', 'file-text'], ['note', 'sticky-note'],
] as const)('pairs the %s pin number with its existing host %s geometry and keeps selection connected', async (type, iconName) => {
	const rig = await withTypedPin(type), glyph = expectDefined(rig.pin.findOne<Konva.Group>('.evidence-icon-' + type), 'type glyph');
	const target = expectDefined(rig.pin.findOne<Konva.Rect>('.evidence-pin-target'), 'pin surface');
	const label = expectDefined(rig.pin.findOne<Konva.Text>('Text'), 'pin number');
	expect(label.text()).toBe('1');
	expect(glyph.find<Konva.Path>('Path').map(path => path.data())).toEqual(editorIconNodes[iconName].filter(node => node.tag === 'path').map(node => node.attributes.d));
	expect(glyph.find('Rect')).toHaveLength(editorIconNodes[iconName].filter(node => node.tag === 'rect').length);
	expect(glyph.find('Circle')).toHaveLength(editorIconNodes[iconName].filter(node => node.tag === 'circle').length);
	expectInside(glyph, target); expectInside(label, target);
	expect(rig.pin.position()).toEqual({ x: 2000, y: 1500 });
	const bytes = [...rig.stack.vault.entries]; rig.pin.fire('click'); await settle();
	expect(rig.session.focusedId).toBe('typed-evidence-0'); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('shows a complete three-digit evidence number inside its pin surface without overlapping Room captions', async () => {
	const rig = await withTypedPin('photo', 100);
	const target = expectDefined(rig.pin.findOne<Konva.Rect>('.evidence-pin-target'), 'pin surface');
	const label = expectDefined(rig.pin.findOne<Konva.Text>('Text'), 'pin number');
	expect(label.text()).toBe('100'); expectInside(label, target);
	const bounds = target.getClientRect();
	for (const caption of expectDefined(rig.stage.findOne<Konva.Layer>('.zone'), 'Room layer').find<Konva.Text>('Text')) {
		const text = caption.getClientRect();
		expect(text.x + text.width <= bounds.x || bounds.x + bounds.width <= text.x || text.y + text.height <= bounds.y || bounds.y + bounds.height <= text.y).toBe(true);
	}
});
