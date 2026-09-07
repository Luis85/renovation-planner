// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { planningStack } from '../../helpers/planning';
import { expectDefined, expectErr, expectFound, expectOk } from '../../helpers/domain';
import { parseFrontmatter } from '../../helpers/vault';
import { createRequirementId } from '../../../src/domain/requirement/RequirementId';
import { sourceMeasurement } from '../../../src/domain/requirement/RequirementSource';
import { validateStructure } from '../../../src/domain/spatial/structureGeometry';
import { fileAt } from '../../../src/infrastructure/obsidian/repositories/NoteVaultDeps';
import { RequirementFrontmatterSchema } from '../../../src/infrastructure/persistence/dto/requirementFrontmatter';
import { requirementFromPersistence } from '../../../src/infrastructure/persistence/mappers/requirementMapper';

afterEach(() => { vi.restoreAllMocks(); });

async function wallMaterialStack() {
	const rig = await planningStack();
	const input = { ...rig.input, source: { ...rig.input.source, targetId: 'wall-a', rule: 'wall-net' as const } };
	expectOk(await rig.planning.material(expectOk(await rig.read()), input, rig.ledger).execute());
	const material = expectDefined(expectOk(await rig.read()).materials.find(item => item.entity.id === input.id), 'persisted wall material');
	return { ...rig, material };
}

it('refuses a valid wall height change when a persisted material has a schema-valid but domain-invalid waste factor', async () => {
	const rig = await wallMaterialStack();
	const baseline = expectOk(await rig.services.read(rig.plan.id));
	const before = expectDefined(baseline.document.structure, 'persisted structure');
	const structure = { ...before, walls: before.walls.map(wall => wall.id === 'wall-a' ? { ...wall, height: 2500 } : wall) };
	expectOk(validateStructure(structure, baseline.document.objects.map(room => room.id)));
	expectOk(sourceMeasurement(expectDefined(rig.material.entity.source, 'wall material source'), rig.roomId, { ...baseline.document, structure }, rig.material.entity.unit));
	const file = expectDefined(fileAt(rig.stack.deps.vault, rig.stack.index.getPath(rig.material.entity.id)), 'material note');
	await rig.stack.fileManager.processFrontMatter(file, raw => { raw['waste-factor'] = '2'; });
	const raw = parseFrontmatter(await rig.stack.vault.read(file)).frontmatter;
	expect(RequirementFrontmatterSchema.safeParse(raw).success).toBe(true);
	expect(expectErr(requirementFromPersistence(raw)).code).toBe('requirement.waste-factor-above-one');
	const bytes = [...rig.stack.vault.entries];
	const modify = vi.spyOn(rig.stack.vault, 'modify');
	const read = vi.spyOn(rig.stack.vault, 'read');
	const publish = vi.spyOn(rig.stack.events, 'publish');
	const result = await rig.services.command({ planId: rig.plan.id, baseline, structure, ledger: rig.ledger }).execute();
	expect(expectErr(result).code).toBe('renovation.depth-invalid');
	expect(read.mock.calls.some(([readFile]) => readFile.path === file.path)).toBe(true);
	expect(modify).not.toHaveBeenCalled();
	expect([...rig.stack.vault.entries]).toEqual(bytes);
	expect(expectOk(await rig.services.read(rig.plan.id))).toEqual(baseline);
	expect(publish).not.toHaveBeenCalled();
});

it('removes an unbound wall when its material disappears after the guard enumerates it and reads the surviving material', async () => {
	const rig = await wallMaterialStack();
	const initial = expectOk(await rig.services.read(rig.plan.id));
	const original = expectDefined(initial.document.structure, 'persisted structure');
	const extra = { id: 'wall-extra', start: { x: 5000, y: 0 }, end: { x: 6000, y: 0 }, height: 2400, thickness: 150 };
	expectOk(await rig.services.command({ planId: rig.plan.id, baseline: initial, structure: { ...original, walls: [...original.walls, extra] }, ledger: rig.ledger }).execute());
	const inputB = { ...rig.input, id: createRequirementId(), source: { ...rig.input.source, targetId: extra.id, rule: 'wall-net' as const, workId: '', outcomeId: '' } };
	expectOk(await rig.planning.material(expectOk(await rig.read()), inputB, rig.ledger).execute());
	const materialB = expectFound(await rig.stack.requirements.getById(inputB.id));
	const baseline = expectOk(await rig.services.read(rig.plan.id));
	const before = expectDefined(baseline.document.structure, 'structure with extra wall');
	const structure = { ...before, walls: before.walls.filter(wall => wall.id !== extra.id) };
	expect(before.boundaries.every(boundary => !boundary.wallIds.includes(extra.id))).toBe(true);
	expectOk(validateStructure(structure, baseline.document.objects.map(room => room.id)));
	expectOk(sourceMeasurement(inputB.source, rig.roomId, baseline.document, materialB.entity.unit));
	expect(expectErr(sourceMeasurement(inputB.source, rig.roomId, { ...baseline.document, structure }, materialB.entity.unit)).code).toBe('requirement.source-invalid');
	const pathA = expectDefined(rig.stack.index.getPath(rig.material.entity.id), 'material A path');
	const pathB = expectDefined(rig.stack.index.getPath(materialB.entity.id), 'material B path');
	const geometryPath = expectDefined(rig.stack.index.getGeometrySidecarPath(rig.plan.id), 'geometry path');
	const untouched = [...rig.stack.vault.entries].filter(([path]) => path !== pathB && path !== geometryPath);
	const sequence: string[] = [];
	const snapshots: (readonly string[])[] = [];
	const getIds = rig.stack.index.getIdsByType.bind(rig.stack.index);
	const enumerate = vi.spyOn(rig.stack.index, 'getIdsByType').mockImplementation(type => {
		const ids = getIds(type);
		if (type === 'renovation-requirement') {
			snapshots.push(ids);
			sequence.push('enumerated A and B');
		}
		return ids;
	});
	const getPath = rig.stack.index.getPath.bind(rig.stack.index);
	const lookup = vi.spyOn(rig.stack.index, 'getPath').mockImplementation(id => {
		const path = getPath(id);
		if (id === materialB.entity.id && path === undefined) sequence.push('B path missing');
		return path;
	});
	const remove = vi.spyOn(rig.stack.requirements, 'delete');
	const readFile = rig.stack.vault.read.bind(rig.stack.vault);
	const read = vi.spyOn(rig.stack.vault, 'read').mockImplementation(async file => {
		const text = await readFile(file);
		if (file.path === pathA) {
			sequence.push('read A bytes');
			expectOk(await rig.stack.requirements.delete(materialB.entity.id, materialB.version));
			sequence.push('deleted B', 'return A bytes');
		}
		return text;
	});
	const result = await rig.services.command({ planId: rig.plan.id, baseline, structure, ledger: rig.ledger }).execute();
	read.mockRestore(); enumerate.mockRestore(); lookup.mockRestore();
	expect(expectOk(result)).toBe('wrote');
	expect(snapshots).toEqual([[rig.material.entity.id, materialB.entity.id]]);
	expect(sequence).toEqual(['enumerated A and B', 'read A bytes', 'deleted B', 'return A bytes', 'B path missing']);
	expect(remove).toHaveBeenCalledOnce();
	expect(remove).toHaveBeenCalledWith(materialB.entity.id, materialB.version);
	expect(rig.stack.index.getPath(materialB.entity.id)).toBeUndefined();
	expect(rig.stack.vault.entries.has(pathB)).toBe(false);
	expect(expectOk(await rig.stack.requirements.getById(materialB.entity.id))).toBeNull();
	expect([...rig.stack.vault.entries].filter(([path]) => path !== geometryPath)).toEqual(untouched);
	expect(expectOk(await rig.services.read(rig.plan.id)).document).toEqual({ ...baseline.document, structure });
	expect(expectOk(await rig.read()).materials.map(item => item.entity.id)).toEqual([rig.material.entity.id]);
});
