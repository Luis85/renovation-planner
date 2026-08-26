import { describe, expect, it } from 'vitest';
import { createRepositoryStack, type RepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import {
	makeAsset,
	makePlan,
	makeProject,
	makeRequirement,
	makeZone,
} from '../../../helpers/entities';
import { createAssetId, type AssetId } from '../../../../src/domain/asset/AssetId';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { createZoneId, type ZoneId } from '../../../../src/domain/zone/ZoneId';
import type { Asset } from '../../../../src/domain/asset/Asset';
import { fileNameFor } from '../../../../src/infrastructure/obsidian/repositories/paths';

/**
 * The slice-10 repositories' failure branches — the diagnostics a broken or
 * concurrently-edited vault can actually produce: unreadable notes, entities that fail
 * their own re-validation, writes whose I/O fails underneath them, a stale marker whose
 * note vanished, and a listing that must propagate rather than skip.
 */

function requirementFor(projectId: ProjectId, zoneId: ZoneId, assetId: AssetId) {
	return makeRequirement({ projectId, assetId, origin: { kind: 'zone', zoneId } });
}

async function seedRequirement(stack: RepositoryStack) {
	const projectId = createProjectId();
	const zoneId = createZoneId();
	const assetId = createAssetId();
	const written = expectOk(
		await stack.requirements.save(requirementFor(projectId, zoneId, assetId), 'absent'),
	);
	const path = stack.index.getPath(written.entity.id) ?? '';
	return { projectId, zoneId, assetId, requirementId: written.entity.id, version: written.version, path };
}

function rewriteNote(stack: RepositoryStack, path: string, from: string, to: string): void {
	stack.vault.entries.set(path, (stack.vault.entries.get(path) ?? '').replace(from, to));
}

async function seedAsset(stack: RepositoryStack, overrides?: Parameters<typeof makeAsset>[0]) {
	const projectId = overrides?.projectId ?? createProjectId();
	const asset = makeAsset({ projectId, ...overrides });
	const written = expectOk(await stack.assets.save(asset, 'absent'));
	const path = stack.index.getPath(written.entity.id) ?? '';
	return { projectId, asset, assetId: written.entity.id, version: written.version, path };
}

async function seedPlanWithZone(stack: RepositoryStack) {
	const projectId = createProjectId();
	const planId = createPlanId();
	expectOk(await stack.projects.save(makeProject({ id: projectId }), 'absent'));
	expectOk(await stack.plans.save(makePlan({ id: planId, projectId }), 'absent'));
	const zone = expectOk(
		await stack.zones.save(makeZone({ projectId, planId }), 'absent'),
	);
	return { projectId, planId, zone };
}

describe('ObsidianRequirementRepository failure branches', () => {
	/**
	 * A schema version that is not a NUMBER is refused before any migration is attempted —
	 * slice 11's fail-closed gate, which reads the version field first and calls a
	 * malformed one a `ValidationError` rather than running a chain against it. These four
	 * cases were written against the behaviour before that gate existed, where the same
	 * note reached the migration runner and came back as `migration-failed`; the code
	 * changed because the DEFECT it names changed, not because the check moved.
	 */
	it('getById reports schema-version-malformed for an unreadable schema version', async () => {
		const stack = createRepositoryStack();
		const { requirementId, path } = await seedRequirement(stack);
		rewriteNote(stack, path, 'schema-version: 1', 'schema-version: "junk"');
		expect(expectErr(await stack.requirements.getById(requirementId)).code).toBe(
			'requirement.schema-version-malformed',
		);
	});

	it('getById reports entity-invalid when the migrated row fails its own validation', async () => {
		const stack = createRepositoryStack();
		const { requirementId, path } = await seedRequirement(stack);
		rewriteNote(stack, path, 'unit: "m2"', 'unit: "furlong"');
		expect(expectErr(await stack.requirements.getById(requirementId)).code).toBe(
			'requirement.entity-invalid',
		);
	});

	it('save refuses an entity that fails pre-write validation before touching the disk', async () => {
		const stack = createRepositoryStack();
		const { requirementId, version } = await seedRequirement(stack);
		const stored = expectOk(await stack.requirements.getById(requirementId));
		Object.assign(stored?.entity as object, { unit: 'furlong' });
		const error = expectErr(await stack.requirements.save(stored?.entity as never, version));
		expect(error.code).toBe('requirement.pre-write-invalid');
	});

	it('an update whose write fails reports requirement.write-failed', async () => {
		const stack = createRepositoryStack();
		const { requirementId, path, version } = await seedRequirement(stack);
		stack.vault.failures.add(`modify:${path}`);
		const stored = expectOk(await stack.requirements.getById(requirementId));
		const error = expectErr(
			await stack.requirements.save(stored?.entity as never, version),
		);
		expect(error.code).toBe('requirement.write-failed');
	});

	it('a delete whose trash fails reports requirement.delete-failed', async () => {
		const stack = createRepositoryStack();
		const { requirementId, version, path } = await seedRequirement(stack);
		stack.vault.failures.add(`delete:${path}`);
		const error = expectErr(await stack.requirements.delete(requirementId, version));
		expect(error.code).toBe('requirement.delete-failed');
	});

	it('markStale reports not-found when the note is gone entirely', async () => {
		const stack = createRepositoryStack();
		const { requirementId, path } = await seedRequirement(stack);
		stack.vault.entries.delete(path);
		const error = expectErr(await stack.requirements.markStale(requirementId));
		expect(error.code).toBe('requirement.not-found');
	});

	it('markStale refuses when the note vanishes between the read and the marker write', async () => {
		const stack = createRepositoryStack();
		const { requirementId } = await seedRequirement(stack);
		// The read resolves through the index; the marker write scans the folder. With
		// nothing to scan, the note this repository just READ cannot be written.
		stack.vault.getMarkdownFiles = () => [];
		const error = expectErr(await stack.requirements.markStale(requirementId));
		expect(error.code).toBe('requirement.mark-stale-failed');
		expect(error.message).toContain('disappeared');
	});

	it('markStale reports a failing marker write instead of pretending it landed', async () => {
		const stack = createRepositoryStack();
		const { requirementId, path } = await seedRequirement(stack);
		stack.vault.failures.add(`modify:${path}`);
		const error = expectErr(await stack.requirements.markStale(requirementId));
		expect(error.code).toBe('requirement.mark-stale-failed');
	});

	it('delete refuses with the note read error when the note is unreadable', async () => {
		const stack = createRepositoryStack();
		const { requirementId, version, path } = await seedRequirement(stack);
		rewriteNote(stack, path, 'schema-version: 1', 'schema-version: "junk"');
		const error = expectErr(await stack.requirements.delete(requirementId, version));
		expect(error.code).toBe('requirement.schema-version-malformed');
	});

	it('markStale propagates a corrupted note instead of writing onto it', async () => {
		const stack = createRepositoryStack();
		const { requirementId, path } = await seedRequirement(stack);
		rewriteNote(stack, path, 'schema-version: 1', 'schema-version: "junk"');
		const error = expectErr(await stack.requirements.markStale(requirementId));
		expect(error.code).toBe('requirement.schema-version-malformed');
	});

	it('getById reports entity-invalid when the figures fail their own re-validation', async () => {
		const stack = createRepositoryStack();
		const { requirementId, path } = await seedRequirement(stack);
		// A negative waste fraction passes the frontmatter schema's decimal-string rule
		// and must be caught by the ENTITY's smart constructor on read.
		rewriteNote(stack, path, 'waste-factor: "0.1"', 'waste-factor: "-0.5"');
		const error = expectErr(await stack.requirements.getById(requirementId));
		expect(error.code).toBe('requirement.entity-invalid');
		expect(error.message).toContain('cannot be negative');
	});

	it('listByZone propagates a corrupt sibling note instead of skipping it', async () => {
		const stack = createRepositoryStack();
		const first = await seedRequirement(stack);

		const projectId = first.projectId;
		const second = expectOk(
			await stack.requirements.save(
				makeRequirement({
					projectId,
					assetId: first.assetId,
					origin: { kind: 'zone', zoneId: first.zoneId },
				}),
				'absent',
			),
		);
		const secondPath = stack.index.getPath(second.entity.id) ?? '';
		stack.vault.entries.set(secondPath, 'someone deleted the frontmatter');

		const listed = await stack.requirements.listByZone(first.zoneId);
		expect(listed.ok).toBe(false);
	});
});

describe('ObsidianAssetRepository failure branches', () => {

	it('getById reports schema-version-malformed for an unreadable schema version', async () => {
		const stack = createRepositoryStack();
		const { assetId, path } = await seedAsset(stack);
		rewriteNote(stack, path, 'schema-version: 1', 'schema-version: "junk"');
		expect(expectErr(await stack.assets.getById(assetId)).code).toBe('asset.schema-version-malformed');
	});

	it('save refuses an entity that fails pre-write validation', async () => {
		const stack = createRepositoryStack();
		const { assetId, version } = await seedAsset(stack);
		const stored = expectOk(await stack.assets.getById(assetId));
		// A category outside the vocabulary cannot be constructed; a bad migration or a
		// future bug can still hand one to the repository, which refuses it here.
		Object.assign(stored?.entity as object, { category: 'bogus' });
		const error = expectErr(await stack.assets.save(stored?.entity as Asset, version));
		expect(error.code).toBe('asset.pre-write-invalid');
	});

	it('an insert whose note create fails reports asset.write-failed', async () => {
		const stack = createRepositoryStack();
		const asset = makeAsset({ projectId: createProjectId(), name: 'Collision' });
		stack.vault.failures.add(`create:${stack.projectFolder}/Assets/Collision.md`);
		const error = expectErr(await stack.assets.save(asset, 'absent'));
		expect(error.code).toBe('asset.write-failed');
	});

	it('a delete whose trash fails reports asset.delete-failed', async () => {
		const stack = createRepositoryStack();
		const { assetId, version, path } = await seedAsset(stack);
		stack.vault.failures.add(`delete:${path}`);
		const error = expectErr(await stack.assets.delete(assetId, version));
		expect(error.code).toBe('asset.delete-failed');
	});

	it('delete of an unknown id answers a revision conflict, like any stale expectation', async () => {
		const stack = createRepositoryStack();
		await seedAsset(stack);
		const error = expectErr(await stack.assets.delete(createAssetId(), { revision: 1, observed: 't' as never }));
		expect(error.category).toBe('Validation');
	});

	it('getById reports entity-invalid when the migrated row fails its own validation', async () => {
		const stack = createRepositoryStack();
		const { assetId, path } = await seedAsset(stack);
		rewriteNote(stack, path, 'unit: "m2"', 'unit: "furlong"');
		expect(expectErr(await stack.assets.getById(assetId)).code).toBe('asset.entity-invalid');
	});

	it('getById reports entity-invalid for figures a hand edit broke', async () => {
		const stack = createRepositoryStack();
		const { assetId, path } = await seedAsset(stack);
		// A default above one passes the frontmatter schema but fails the entity's own
		// smart constructor — the pre-write validation reading it back.
		rewriteNote(stack, path, 'waste-factor-default: "0.1"', 'waste-factor-default: "2"');
		const error = expectErr(await stack.assets.getById(assetId));
		expect(error.code).toBe('asset.entity-invalid');
		expect(error.message).toContain('[0, 1]');
	});

	it('a waste-factor persisted as null reads back as the zero default', async () => {
		const stack = createRepositoryStack();
		const { assetId, path } = await seedAsset(stack);
		rewriteNote(stack, path, 'waste-factor-default: "0.1"', 'waste-factor-default: null');
		const loaded = expectOk(await stack.assets.getById(assetId));
		expect(loaded?.entity.wasteFactorDefault.toString()).toBe('0');
	});

	it('delete refuses with the note read error when the note is unreadable', async () => {
		const stack = createRepositoryStack();
		const { assetId, version, path } = await seedAsset(stack);
		rewriteNote(stack, path, 'schema-version: 1', 'schema-version: "junk"');
		const error = expectErr(await stack.assets.delete(assetId, version));
		expect(error.code).toBe('asset.schema-version-malformed');
	});

	it('listByProject propagates a corrupt sibling note', async () => {
		const stack = createRepositoryStack();
		const { projectId, path } = await seedAsset(stack);
		await seedAsset(stack, { projectId });
		stack.vault.entries.set(path, 'someone deleted the frontmatter');

		const listed = await stack.assets.listByProject(projectId);
		expect(listed.ok).toBe(false);
	});

	it('listByProject skips an indexed id whose note has vanished entirely', async () => {
		const stack = createRepositoryStack();
		const first = await seedAsset(stack);
		const second = await seedAsset(stack, { projectId: first.projectId });

		// The note is gone WITHOUT the index being told — a vault-level deletion this
		// plugin did not observe. The listing skips it rather than failing the whole read.
		stack.vault.entries.delete(second.path);

		const listed = expectOk(await stack.assets.listByProject(first.projectId));
		expect(listed.map((loaded) => loaded.entity.id)).toEqual([first.assetId]);
	});
});

describe('ObsidianZoneRepository compensation arms', () => {
	it('an insert whose sidecar write fails deletes the just-created note', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		const planId = createPlanId();
		expectOk(await stack.projects.save(makeProject({ id: projectId }), 'absent'));
		expectOk(await stack.plans.save(makePlan({ id: planId, projectId }), 'absent'));

		const zone = makeZone({ projectId, planId });
		const sidecarPath = `${stack.projectFolder}/Geometry/${planId}.rpgeo`;
		stack.vault.failures.add(`modify:${sidecarPath}`);

		const error = expectErr(await stack.zones.save(zone, 'absent'));
		expect(error.code).toBe('zone.sidecar-insert-failed');
		// Compensated: the half-written insert left NOTHING behind.
		const notePath = `${stack.projectFolder}/Zones/${fileNameFor(zone.name)}.md`;
		expect(stack.vault.entries.has(notePath)).toBe(false);
	});

	it('an update whose sidecar write fails restores the note bytes it replaced', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId, zone } = await seedPlanWithZone(stack);
		const sidecarPath = `${stack.projectFolder}/Geometry/${planId}.rpgeo`;

		stack.vault.failures.add(`modify:${sidecarPath}`);
		const renamed = makeZone({ id: zone.entity.id, projectId, planId, name: 'Renamed room' });
		const error = expectErr(await stack.zones.save(renamed, zone.version));
		expect(error.code).toBe('zone.sidecar-update-failed');

		// The note text was byte-restored: the OLD name is back, nothing half-updated.
		const noteText = [...stack.vault.entries.entries()].find(([path]) => path.startsWith(`${stack.projectFolder}/Zones/`))?.[1] ?? '';
		expect(noteText).toContain('Living room');
	});
});
