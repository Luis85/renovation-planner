import type { NamedSpatialElement } from '../../src/domain/spatial/SpatialElement';
import { elementInput } from '../../src/presentation/editor/elements/elementInput';
import { assetPlacementRig } from './assetPlacement';
import { expectOk } from './domain';
import { settle } from './editor';

export const CABINET: NamedSpatialElement = { id: 'element-cabinet', kind: 'object', name: 'Cabinet', points: [{ x: 500, y: 500 }, { x: 1500, y: 500 }, { x: 1500, y: 1000 }, { x: 500, y: 1000 }] };

/** An asset placement rig with one item saved and selected: where a transform box starts. */
export async function selectedItemRig() {
	const rig = await assetPlacementRig(); rig.changePlan(); await settle();
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, CABINET), rig.runtime.structureTask.ledger)));
	await settle(); rig.selection.select([CABINET.id as never]); await settle();
	return rig;
}
