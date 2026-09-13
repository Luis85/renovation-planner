import { renovationEditor } from './renovationEditor';
import { settle } from './editor';
import { expectOk } from './domain';
import { elementInput } from '../../src/presentation/editor/elements/elementInput';
import type { NamedSpatialElement } from '../../src/domain/spatial/SpatialElement';
import { postOutline } from '../../src/domain/spatial/structuralElement';

export type EditorRig = Awaited<ReturnType<typeof renovationEditor>>;
export const POST_A: NamedSpatialElement = { id: 'element-post-a', kind: 'post', name: 'Post A', loadBearing: true, points: postOutline({ x: 1000, y: 1000 }, 140, 140) };
export const KITCHEN_BEAM: NamedSpatialElement = { id: 'element-kitchen-beam', kind: 'beam', name: 'Kitchen beam', loadBearing: true, width: 160, points: [{ x: 0, y: 3000 }, { x: 3000, y: 3000 }] };

/** A mounted planning editor whose plan already holds `elements`, each written through the guarded element command. */
export async function editorWith(mounted: EditorRig[], ...elements: readonly NamedSpatialElement[]): Promise<EditorRig> {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	for (const element of elements) {
		const baseline = expectOk(await rig.renovation.read(rig.plan.id));
		expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, element), rig.runtime.structureTask.ledger)));
	}
	await settle();
	return rig;
}
