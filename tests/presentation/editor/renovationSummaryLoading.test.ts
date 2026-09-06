// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { referenceWorkspace } from '../../harness/referenceWorkspace';
import { HARNESS_PLAN, harnessDeps } from '../../harness/planEditor';
import { mountPlanEditorCanvas, runtimeOf, settle } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { defer } from '../../helpers/async';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { createRequirementId } from '../../../src/domain/requirement/RequirementId';

it('withholds an initial unloaded estimate, then shows the real material count and reconciled estimate', async () => {
	const workspace = referenceWorkspace(harnessDeps(), HARNESS_PLAN, true); await workspace.ready;
	const room = expectOk(await workspace.deps.commands.createZone.execute({ planId: workspace.plan.id, name: 'Studio', zoneType: 'Room', geometry: { points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }] } })).zone.entity;
	const services = expectDefined(workspace.deps.commands.planning, 'planning'), loaded = await services.read(workspace.plan.id), signal = defer<typeof loaded>();
	const read = vi.spyOn(services, 'read').mockReturnValue(signal.promise);
	const rig = await mountPlanEditorCanvas({ plan: HARNESS_PLAN, queries: workspace.deps.queries, commands: workspace.deps.commands, vault: workspace.deps.vault });
	try {
		const runtime = runtimeOf(rig); useSelectionStore(rig.pinia).select([room.id]);
		runtime.renovation.focus(room.id, 'overview'); await settle();
		expect(rig.wrapper.find('[data-rp-stat="renovation-cost"]').exists()).toBe(false);
		expect(rig.wrapper.get('.rp-renovation-linked-summary [role="status"]').text()).not.toBe('');
		expect(rig.wrapper.findAll('[data-rp-linked]')).toHaveLength(0);
		signal.resolve(loaded); await settle(); read.mockRestore(); expect(rig.wrapper.get('[data-rp-linked="materials"]').text()).toContain('0');
		const baseline = expectOk(await services.read(workspace.plan.id)), asset = baseline.catalogue[0].asset;
		expectOk(await runtime.dispatcher.run(services.material(baseline, { id: createRequirementId(), roomId: room.id, assetId: asset.id, waste: '0', override: '', source: { planId: workspace.plan.id, targetId: room.id, workId: '', outcomeId: '', state: 'current', rule: 'manual', manual: '2', coverage: '1', lot: '', minimum: '' } }, runtime.structureTask.ledger)));
		rig.changePlan(); await settle();
		expect(rig.wrapper.get('[data-rp-linked="materials"]').text()).toContain('1');
		expect(rig.wrapper.get('[data-rp-linked="costs"]').text()).toContain('1');
		expect(rig.wrapper.find('[data-rp-stat="renovation-cost"]').exists()).toBe(true);
	} finally { signal.resolve(loaded); read.mockRestore(); rig.unmount(); }
});
