// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { AssignAssetCommand } from '../../../src/application/commands/requirement/AssignAsset';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';
import { InMemoryAssetPriceOverrideRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { materialInput, planningDraft } from '../../../src/presentation/editor/planning/planningDraft';
import type { PlanGeometryDTO } from '../../../src/infrastructure/persistence/dto/planGeometry';
import { err } from '../../../src/core/result/Result';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() {
	const rig = await renovationEditor(true); mounted.push(rig);
	rig.changePlan(); await settle();
	return rig;
}

describe('material markers retain legacy and unavailable source semantics', () => {
	it('uses a legacy Requirement’s Room origin for marker placement and native record navigation', async () => {
		const rig = await setup();
		const asset = expectDefined(expectOk(await rig.stack.assets.listAll()).loaded.find(item => item.entity.unit === 'm2'), 'area material').entity;
		const assign = new AssignAssetCommand({ ...rig.stack, locks: new ReferenceLocks(), overrides: new InMemoryAssetPriceOverrideRepository() });
		const requirement = expectOk(await assign.execute({ zoneId: rig.room.id, assetId: asset.id })).requirement;
		expect(requirement.source).toBeUndefined();
		await rig.runtime.refreshProjection(); rig.runtime.renovation.focus(rig.room.id, 'materials'); await settle();
		const marker = expectDefined(rig.stage?.findOne('.material-marker'), 'legacy material marker');
		expect(marker.id()).toBe(requirement.id);
		const bytes = [...rig.stack.vault.entries];
		marker.fire('click'); await settle();
		expect(rig.session.focusedId).toBe(requirement.id); expect(rig.session.targetId).toBe(rig.room.id);
		expect(rig.stage?.findOne('.material-source')?.getAttr('points')).toEqual(rig.room.geometry.points.flatMap(point => [point.x, point.y]));
		expect(rig.wrapper.get(`[data-rp-record="${requirement.id}"]`).text()).toContain(asset.name);
		expect(expectOk(await rig.stack.requirements.getById(requirement.id))?.entity.source).toBeUndefined();
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it('retains material facts after a peer removes its target while omitting the obsolete spatial marker', async () => {
		const rig = await setup(), planning = expectDefined(rig.deps.commands.planning, 'planning');
		const baseline = expectOk(await planning.read(rig.plan.id)), draft = planningDraft('material', baseline, rig.room.id);
		draft.assetId = expectDefined(baseline.catalogue.find(item => item.asset.unit === 'm2'), 'area material').asset.id;
		draft.targetId = 'wall-a'; draft.source = { ...draft.source, targetId: 'wall-a', rule: 'wall-net' };
		expectOk(await rig.runtime.dispatcher.run(planning.material(baseline, materialInput(draft), rig.runtime.structureTask.ledger)));
		rig.runtime.renovation.focus(rig.room.id, 'materials'); await settle();
		expect(rig.stage?.find('.material-marker')).toHaveLength(1);
		const retained = expectDefined(rig.runtime.planning.baseline.value, 'retained projection');
		const requirement = expectOk(await rig.stack.requirements.getById(draft.id as Parameters<typeof rig.stack.requirements.getById>[0]));
		// Ordinary external sidecar editing bypasses plugin referential commands. The UI must
		// report/retain this inconsistent source, rather than invent geometry for its marker.
		const path = expectDefined(rig.stack.index.getGeometrySidecarPath(rig.plan.id), 'sidecar path');
		const document = JSON.parse(expectDefined(rig.stack.vault.entries.get(path), 'sidecar bytes')) as PlanGeometryDTO;
		const structure = expectDefined(document.structure, 'current structure');
		rig.stack.vault.entries.set(path, JSON.stringify({ ...document, revision: document.revision + 1,
			structure: { ...structure, walls: structure.walls.filter(wall => wall.id !== 'wall-a'), boundaries: [] } }));
		vi.spyOn(planning, 'read').mockResolvedValue(err(injectedPersistenceError()));
		const bytes = [...rig.stack.vault.entries];
		await rig.runtime.refreshProjection(); await settle();
		expect(rig.runtime.planning.failed.value).toBe(true); expect(rig.runtime.writesBlocked.value).toBe(true);
		expect(rig.runtime.planning.baseline.value).toBe(retained);
		expect(rig.project.structure.walls.some(wall => wall.id === 'wall-a')).toBe(false);
		expect(rig.stage?.find('.material-marker')).toHaveLength(0);
		expect(rig.wrapper.find(`[data-rp-record="${draft.id}"]`).exists()).toBe(true);
		expect(expectOk(await rig.stack.requirements.getById(draft.id as Parameters<typeof rig.stack.requirements.getById>[0]))).toEqual(requirement);
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
});
