/** @vitest-environment jsdom */
import { afterEach, expect, it } from 'vitest';
import type Konva from 'konva';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { EMPTY_DEPTH, type Evidence } from '../../../src/domain/renovation/PlanningDepth';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

/**
 * `notesVisible` gates ONE computed in `PlanCanvas.vue` that feeds both the annotation layer
 * (`RenovationLayer`, which draws the `.evidence-pin` markers themselves) and the zone layer
 * (`ZoneLayer`, which only takes the same pins as caption-clearance obstacles — see
 * `captionPlacement.ts`). A pin drawn at the Room's own centre is exactly what
 * `evidenceCaptionPlacement.test.ts`'s 'restores centered captions...' case uses to move the
 * caption off `1500`, so the same displacement here is proof the zone layer saw the pins too.
 */
it('gates evidence pins on both the annotation layer that draws them and the zone layer that clears captions around them', async () => {
	const rig = await renovationEditor(true); mounted.push(rig);
	const evidence: Evidence = {
		id: 'notes-toggle-photo', roomId: rig.room.id, targetId: rig.room.id, workId: '', recordId: '',
		path: 'scan.png', subpath: '', description: 'Notes toggle', type: 'photo', phase: 'before',
		pin: { x: 0.5, y: 0.5 },
	};
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [], work: [], decisions: [], depth: { ...EMPTY_DEPTH, evidence: [evidence] } }, intended: undefined }, rig.runtime.structureTask.ledger)));
	rig.runtime.renovation.focus(rig.room.id, 'photos'); await settle();

	const group = expectDefined(rig.stage.findOne<Konva.Group>('.zone')?.findOne<Konva.Group>('.' + rig.room.id), 'Room render group');
	const caption = expectDefined(group.findOne<Konva.Text>('Text'), 'Room caption');

	// Both arms of the `notesVisible ? all : []` conditional, reached in order: visible first.
	expect(rig.stage.find<Konva.Group>('.evidence-pin')).toHaveLength(1);
	const displaced = caption.y();
	expect(displaced).not.toBe(1500);

	const workspace = useWorkspaceStore(rig.pinia);
	workspace.toggleNotes(); await settle();

	expect(rig.stage.find<Konva.Group>('.evidence-pin')).toHaveLength(0);
	expect(caption.y()).toBe(1500);

	// Back on: both layers pick the pin back up from the same store flag.
	workspace.toggleNotes(); await settle();
	expect(rig.stage.find<Konva.Group>('.evidence-pin')).toHaveLength(1);
	expect(caption.y()).toBe(displaced);
});
