import { expect, it } from 'vitest';
import { structureStack } from '../../../helpers/structure';
import { expectDefined, expectErr, expectOk } from '../../../helpers/domain';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';
import type { PlanGeometryDTO } from '../../../../src/infrastructure/persistence/dto/planGeometry';

async function setup() {
	const rig = await structureStack(); expectOk(await rig.room.execute());
	const id = expectDefined(rig.room.createdZoneId, 'Room');
	const path = expectDefined(rig.stack.index.getPath(id), 'Room note');
	return { ...rig, id, path, shape: { points: rig.room.points } };
}

it('reads legacy group and curve schema stages without rewriting bytes or losing introduced metadata', async () => {
	const rig = await setup(), sidecar = expectDefined(rig.stack.index.getGeometrySidecarPath(rig.plan.id), 'sidecar');
	const dto = JSON.parse(expectDefined(rig.stack.vault.entries.get(sidecar), 'sidecar bytes')) as PlanGeometryDTO;
	for (const schemaVersion of [5, 6, 7]) {
		const groups = schemaVersion >= 6 ? [{ id: 'group-room', name: 'Original order', memberIds: [rig.id] }] : undefined;
		const bulges = schemaVersion === 7 ? [0.25, 0, 0, 0] : undefined;
		const stored = { ...dto, schemaVersion, groups, objects: dto.objects.map(object => ({ ...object, ...(bulges ? { bulges } : {}) })) };
		rig.stack.vault.entries.set(sidecar, JSON.stringify(stored)); const bytes = [...rig.stack.vault.entries];
		const read = expectOk(await rig.geometry.read(rig.plan.id));
		expect(read.document.groups).toEqual(groups); expect(read.document.objects[0].bulges).toEqual(bulges);
		expect(read.document.objects[0].points).toEqual(rig.shape.points);
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	}
});

it('returns no version source for an absent Room without adding a note or sidecar entry', async () => {
	const rig = await setup(), bytes = [...rig.stack.vault.entries];
	expect(expectOk(await rig.stack.zones.prepareGeometryVersions(createZoneId(), rig.shape))).toBeNull();
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it.each(['future-note', 'invalid-name'] as const)('refuses a pre-write version source from a %s and preserves all bytes', async kind => {
	const rig = await setup(), note = expectDefined(rig.stack.vault.entries.get(rig.path), 'note bytes');
	const edited = kind === 'future-note' ? note.replace('schema-version: 1', 'schema-version: 999') : note.replace('"Kitchen"', '"   "');
	expect(edited).not.toBe(note); rig.stack.vault.entries.set(rig.path, edited);
	const bytes = [...rig.stack.vault.entries], error = expectErr(await rig.stack.zones.prepareGeometryVersions(rig.id, rig.shape));
	expect(error.code).toBe(kind === 'future-note' ? 'zone.schema-version-unsupported' : 'zone.entity-invalid');
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('keeps a receipt frozen across a peer rename and refuses an invalid future outline without adopting a peer version', async () => {
	const rig = await setup(), receipt = expectDefined(expectOk(await rig.stack.zones.prepareGeometryVersions(rig.id, rig.shape)), 'receipt');
	const changed = { ...rig.shape, bulges: [0.25, 0, 0, 0] }, version = expectOk(receipt.versionFor(changed));
	expect(expectErr(receipt.versionFor({ points: [] }))).toMatchObject({ category: 'Geometry' });
	const note = expectDefined(rig.stack.vault.entries.get(rig.path), 'note');
	rig.stack.vault.entries.set(rig.path, note.replace('"Kitchen"', '"Peer kitchen"'));
	const peer = expectDefined(expectOk(await rig.stack.zones.prepareGeometryVersions(rig.id, rig.shape)), 'peer receipt');
	expect(peer.zone.entity.name).toBe('Peer kitchen');
	expect(peer.zone.version).not.toEqual(receipt.zone.version);
	expect(expectOk(receipt.versionFor(changed))).toEqual(version);
	expect(receipt.zone.entity.name).toBe('Kitchen');
});

it('refuses invalid curved content on read and dangling group membership on write without modifying the sidecar', async () => {
	const rig = await setup(), sidecar = expectDefined(rig.stack.index.getGeometrySidecarPath(rig.plan.id), 'sidecar');
	const text = expectDefined(rig.stack.vault.entries.get(sidecar), 'sidecar bytes'), dto = JSON.parse(text) as PlanGeometryDTO;
	const invalidCurve = JSON.stringify({ ...dto, schemaVersion: 7, objects: dto.objects.map(object => ({ ...object, bulges: [0.25] })) });
	rig.stack.vault.entries.set(sidecar, invalidCurve);
	expect(expectErr(await rig.geometry.read(rig.plan.id))).toMatchObject({ code: 'plan-geometry.curve-invalid' });
	expect(rig.stack.vault.entries.get(sidecar)).toBe(invalidCurve);
	rig.stack.vault.entries.set(sidecar, text); const baseline = expectOk(await rig.geometry.read(rig.plan.id)), bytes = [...rig.stack.vault.entries];
	expect(expectErr(await rig.geometry.write(rig.plan.id, { ...baseline.document, groups: [{ id: 'group-dangling', name: 'Missing Room', memberIds: ['missing-room'] }] }, baseline.version))).toMatchObject({ code: 'spatial-group.invalid' });
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});
