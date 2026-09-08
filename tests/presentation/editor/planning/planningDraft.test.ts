import { expect, it } from 'vitest';
import { planningStack } from '../../../helpers/planning';
import { expectOk } from '../../../helpers/domain';
import { planningDraft } from '../../../../src/presentation/editor/planning/planningDraft';

it('scopes a focused-record draft to the Room when the focus names no target of its own', async () => {
 const rig = await planningStack(), baseline = expectOk(await rig.read());
 const draft = planningDraft('material', baseline, rig.roomId, '', { focusedId: 'work-sand' });
 expect(draft).toMatchObject({ targetId: rig.roomId, workId: 'work-sand' });
 expect(draft.source).toMatchObject({ targetId: rig.roomId, workId: 'work-sand' });
});

it('keeps an edited material on the Room that owns it', async () => {
 const rig = await planningStack(); expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
 const baseline = expectOk(await rig.read());
 expect(planningDraft('material', baseline, rig.roomId, rig.input.id)).toMatchObject({ id: rig.input.id, requirementId: rig.input.id, roomId: rig.roomId, assetId: rig.asset.id });
});
