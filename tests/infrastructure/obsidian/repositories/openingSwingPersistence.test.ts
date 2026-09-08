import { expect, it } from 'vitest';
import { structureStack, WALL_LOOP } from '../../../helpers/structure';
import { expectDefined, expectOk } from '../../../helpers/domain';
import type { Opening } from '../../../../src/domain/spatial/Structure';
import { openingSwing } from '../../../../src/domain/spatial/openingSwing';
import { sameGeometryDocument } from '../../../../src/application/commands/spatial/sameGeometryDocument';
import { PlanGeometrySchemaV4 } from '../../../../src/infrastructure/persistence/dto/planGeometry';

const door: Opening = { id: 'opening-door', kind: 'door', hostId: 'wall-a', offset: 800, width: 900, height: 2100, sill: 0 };

it('keeps legacy defaults implicit and round-trips swing through schema5 with exact undo', async () => {
	const rig = await structureStack();
	const structure = { ...WALL_LOOP, openings: [door] };
	expectOk(await rig.geometry.write(rig.plan.id, { ...rig.baseline.document, structure }, rig.baseline.version));
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const before = [...rig.stack.vault.entries];
	expect(openingSwing(baseline.document.structure!.openings[0])).toEqual({ hinge: 'start', side: 'left', angle: 90 });
	expect(openingSwing({ ...door, kind: 'window' })?.angle).toBe(0);
	expect(openingSwing({ ...door, kind: 'opening' })).toBeNull();
	expect([...rig.stack.vault.entries]).toEqual(before);
	const next = { ...structure, openings: [{ ...door, swing: { hinge: 'end' as const, side: 'right' as const, angle: 35 } }] };
	const command = rig.services.command({ planId: rig.plan.id, baseline, structure: next, ledger: rig.ledger });
	expectOk(await command.execute());
	const path = expectDefined(rig.stack.index.getGeometrySidecarPath(rig.plan.id), 'geometry path');
	const raw = JSON.parse(expectDefined(rig.stack.vault.entries.get(path), 'sidecar'));
	expect(raw.schemaVersion).toBe(5);
	expect(PlanGeometrySchemaV4.safeParse(raw).success).toBe(false);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure).toEqual(next);
	expect(sameGeometryDocument(baseline.document, { ...baseline.document, structure: next })).toBe(false);
	expectOk(await command.undo());
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(baseline.document);
	expect(JSON.parse(expectDefined(rig.stack.vault.entries.get(path), 'restored sidecar')).schemaVersion).toBe(2);
	expectOk(await command.execute());
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure).toEqual(next);
});

it('preserves intended swing and refuses invalid or plain-opening swing without a write', async () => {
	const rig = await structureStack();
	const intended = { ...WALL_LOOP, openings: [{ ...door, swing: { hinge: 'start' as const, side: 'left' as const, angle: 0 } }] };
	expectOk(await rig.geometry.write(rig.plan.id, { ...rig.baseline.document, intended }, rig.baseline.version));
	const read = expectOk(await rig.geometry.read(rig.plan.id));
	expect(read.document.intended).toEqual(intended);
	const bytes = [...rig.stack.vault.entries];
	for (const opening of [{ ...door, swing: { hinge: 'end' as const, side: 'right' as const, angle: 181 } }, { ...intended.openings[0], kind: 'opening' as const }]) {
		expect(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...WALL_LOOP, openings: [opening] } }, read.version)).toMatchObject({ ok: false });
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	}
});
