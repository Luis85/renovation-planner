// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import type Konva from 'konva';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { resizeTo } from '../../helpers/layout';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('distinguishes identical descriptions by saved kind in Existing/Planned rows and markers without changing their identities', async () => {
	const rig = await renovationEditor(); mounted.push(rig);
	const roomId = rig.room.id;
	const subjects = (['floor', 'wall'] as const).map(kind => ({
		id: `detail-${kind}`, kind, roomId, targetId: roomId,
		existing: { description: 'White tile', condition: 'good' as const },
		planned: { description: 'New tile', change: 'modify' as const },
	}));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)),
		{ renovation: { subjects, work: [], decisions: [] }, intended: undefined }, rig.runtime.structureTask.ledger)));
	const saved = new Map(rig.stack.vault.entries);
	for (const mode of ['existing', 'planned'] as const) {
		rig.runtime.renovation.focus(roomId, mode); await settle();
		const rows = rig.wrapper.findAll('.rp-subject-row .rp-record-title');
		expect(rows.map(row => row.text())).toEqual(mode === 'existing'
			? ['Floor finish White tile', 'Wall finish White tile']
			: ['Floor finish New tile', 'Wall finish New tile']);
		const markers = rig.stage.find<Konva.Group>('.renovation-marker');
		expect(markers.map(marker => marker.findOne('Text')?.getAttr('text'))).toEqual(mode === 'existing'
			? ['1. Floor finish · White tile', '2. Wall finish · White tile']
			: ['1. Floor finish · Modify (~) New tile', '2. Wall finish · Modify (~) New tile']);
		await rows[0].trigger('click'); await settle(); expect(rig.session.focusedId).toBe('detail-floor');
		expect(rig.wrapper.get<HTMLDetailsElement>('[data-rp-record="detail-floor"] .rp-record-actions').element.open).toBe(true);
		expect(rig.wrapper.get('[data-rp-record="detail-floor"] [data-rp-subject-area]').text()).toContain('12 m²');
		expect(rig.wrapper.find('[data-rp-record="detail-wall"] [data-rp-subject-area]').exists()).toBe(false);
		markers[1].fire('click'); await settle(); expect(rig.session.focusedId).toBe('detail-wall');
		expect(rig.selection.selectedIds).toEqual([roomId]);
	}
	resizeTo(rig.rootEl, 460, 900); await settle();
	useWorkspaceStore(rig.pinia).openOverlay('inspector'); await settle();
	expect(rig.wrapper.get('[data-rp-record="detail-wall"] .rp-record-title').text()).toBe('Wall finish New tile');
	expect(new Map(rig.stack.vault.entries)).toEqual(saved);
});
