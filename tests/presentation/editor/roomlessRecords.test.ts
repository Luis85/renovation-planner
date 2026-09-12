// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { EMPTY_DEPTH } from '../../../src/domain/renovation/PlanningDepth';
import type { Renovation } from '../../../src/domain/renovation/Renovation';
import { of } from '../../../src/core/money/Money';
import { renovationCostSummary } from '../../../src/presentation/editor/renovation/renovationCostSummary';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() { const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle(); return rig; }
type Rig = Awaited<ReturnType<typeof setup>>;
const border: Renovation = { subjects: [], decisions: [],
	work: [{ id: 'work-border', targetId: 'wall-a', title: 'Repoint the border wall', description: '', order: 0, progress: 'pending', responsibility: 'diy', outcomes: [], dependencies: [] }],
	depth: { ...EMPTY_DEPTH, costs: [{ id: 'cost-border', targetId: 'wall-a', workId: 'work-border', title: 'Mortar', category: 'other', requirementId: '', planned: of('40', 'EUR'), facts: [], cancelled: false }] } };
async function saveBorder(rig: Rig) {
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), { renovation: border, intended: undefined }, rig.runtime.structureTask.ledger)));
	rig.changePlan(); await settle();
}

it('saves Work and a cost on a wall that bounds no room and counts that cost once on the floor', async () => {
	const rig = await setup(); await saveBorder(rig);
	const baseline = expectOk(await expectDefined(rig.deps.commands.planning, 'planning services').read(rig.plan.id));
	expect(renovationCostSummary(baseline).count).toBe(1);
	expect(renovationCostSummary(baseline, '', 'wall-a').count).toBe(1);
	expect(renovationCostSummary(baseline, rig.room.id).count).toBe(0);
	expect(renovationCostSummary(baseline).totals).not.toBeNull();
});

it('focuses a room-less record with no room in the session and its wall selected', async () => {
	const rig = await setup(); await saveBorder(rig);
	rig.runtime.renovation.focus('', 'work', 'work-border'); await settle();
	expect(rig.session.roomId).toBe(''); expect(rig.session.targetId).toBe('wall-a');
	expect(rig.selection.selectedIds).toEqual(['wall-a']);
});
