import { describe, expect, it } from 'vitest';
import {
	createRepositoryStack,
	parseFrontmatter,
	serializeFrontmatter,
	type RepositoryStack,
} from '../../../helpers/vault';
import { writeOwnedFrontmatter } from '../../../../src/infrastructure/obsidian/repositories/noteIo';
import { expectFound, expectOk } from '../../../helpers/domain';
import {
	makeAsset,
	makePlan,
	makeProject,
	makeRequirement,
	makeZone,
} from '../../../helpers/entities';
import { expectTargetedUpdatePreservesUserContent } from '../../../contracts/notePreservation';
import { Decimal } from 'decimal.js';
import { MIGRATION_SET } from '../../../../src/infrastructure/persistence/migration/migrationSet';
import type { DiagnosticEntityKind } from '../../../../src/application/ports/diagnostics';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import { createPlanId, type PlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';

/**
 * Slice 11 DoD item 8 — "a note with unknown extra frontmatter keys and a hand-authored
 * body survives a targeted property-update round trip unchanged in both" — driven for
 * EVERY note-backed write path the plugin has, not for one of them.
 *
 * The rule itself lives in `tests/contracts/notePreservation.ts`; this file is the list of
 * callers. It was a single Zone case in `consistency.test.ts` for seven slices, under a
 * title that read as a category: the guarantee is `writeOwnedFrontmatter`'s and
 * `observeFrontmatter`'s, both shared by five repositories and by `markStale`, so a Zone
 * sample said nothing about the four that go through `saveNoteBackedEntity` or about the
 * one write path that is not a save at all.
 *
 * **The list is ANCHORED, because a list is what it is.** The rule could not go into the
 * five `*.contract.ts` files — each of those runs against an in-memory repository too, and
 * an in-memory repository has no note, no body and no undeclared key, so the term could
 * only have been an optional hook half its callers decline. Moving it here bought that
 * honesty and cost the compulsion: a seventh note-backed repository is FORCED into the
 * fail-closed table one file over (`errorPaths.test.ts` measures its kinds against
 * `MIGRATION_SET`) and, until the completeness case below existed, was not forced into
 * preservation at all. Somebody had to remember, which is exactly what this repository
 * refuses to check by listing.
 *
 * `markStale` stays a standalone caller underneath rather than joining the table, because
 * it is not a KIND — it is a second write path belonging to a kind the table already names,
 * and folding it in would make the completeness assertion below false.
 */

async function seedProject(stack: RepositoryStack): Promise<ProjectId> {
	const projectId = createProjectId();
	expectOk(await stack.projects.save(makeProject({ id: projectId }), 'absent'));
	return projectId;
}

async function seedPlan(stack: RepositoryStack): Promise<{ projectId: ProjectId; planId: PlanId }> {
	const projectId = await seedProject(stack);
	const planId = createPlanId();
	expectOk(await stack.plans.save(makePlan({ id: planId, projectId }), 'absent'));
	return { projectId, planId };
}

/**
 * One case per note-backed kind. `drive` seeds the entity, runs the shared rule over that
 * repository's targeted update, and answers the entity-specific value the test body then
 * asserts — a READ BACK through the repository, which is the half the byte-level assertions
 * inside the rule cannot make: a note carrying a key no schema declares must still parse.
 */
const PRESERVATION_CASES: ReadonlyArray<{
	kind: DiagnosticEntityKind;
	drive: (stack: RepositoryStack) => Promise<unknown>;
	reads: unknown;
}> = [
	{
		kind: 'project',
		reads: 'Renamed project',
		drive: async (stack) => {
			const id = createProjectId();
			const written = expectOk(await stack.projects.save(makeProject({ id }), 'absent'));
			await expectTargetedUpdatePreservesUserContent({
				stack,
				id,
				write: () => stack.projects.save(makeProject({ id, name: 'Renamed project' }), written.version),
				expectOwned: { name: 'Renamed project' },
			});
			return expectOk(await stack.projects.getById(id))?.entity.name;
		},
	},
	{
		kind: 'plan',
		reads: 'Renamed plan',
		drive: async (stack) => {
			const { projectId, planId } = await seedPlan(stack);
			const read = expectFound(await stack.plans.getById(planId));
			await expectTargetedUpdatePreservesUserContent({
				stack,
				id: planId,
				write: () =>
					stack.plans.save(makePlan({ id: planId, projectId, name: 'Renamed plan' }), read.version),
				expectOwned: { name: 'Renamed plan' },
			});
			return expectOk(await stack.plans.getById(planId))?.entity.name;
		},
	},
	{
		// The note half of a write that also touches the geometry sidecar.
		kind: 'zone',
		reads: 'Terrace',
		drive: async (stack) => {
			const { projectId, planId } = await seedPlan(stack);
			const id = createZoneId();
			const written = expectOk(await stack.zones.save(makeZone({ id, projectId, planId }), 'absent'));
			await expectTargetedUpdatePreservesUserContent({
				stack,
				id,
				write: () =>
					stack.zones.save(
						makeZone({ id, projectId, planId, name: 'Renamed zone', zoneType: 'Terrace' }),
						written.version,
					),
				// Two keys, because a Zone's write is the compensated one: a restore that put
				// back the pre-write bytes would leave both at their old values.
				expectOwned: { name: 'Renamed zone', 'zone-type': 'terrace' },
			});
			return expectOk(await stack.zones.getById(id))?.entity.zoneType;
		},
	},
	{
		kind: 'asset',
		reads: 'Renamed asset',
		drive: async (stack) => {
			const id = createAssetId();
			const written = expectOk(await stack.assets.save(makeAsset({ id }), 'absent'));
			await expectTargetedUpdatePreservesUserContent({
				stack,
				id,
				write: () =>
					stack.assets.save(makeAsset({ id, name: 'Renamed asset' }), written.version),
				expectOwned: { name: 'Renamed asset' },
			});
			return expectOk(await stack.assets.getById(id))?.entity.name;
		},
	},
	{
		kind: 'requirement',
		reads: '0.25',
		drive: async (stack) => {
			const projectId = await seedProject(stack);
			const origin = { kind: 'zone', zoneId: createZoneId() } as const;
			const assetId = createAssetId();
			const requirement = makeRequirement({ projectId, assetId, origin });
			const written = expectOk(await stack.requirements.save(requirement, 'absent'));
			await expectTargetedUpdatePreservesUserContent({
				stack,
				id: requirement.id,
				write: () =>
					stack.requirements.save(
						makeRequirement({
							id: requirement.id,
							projectId,
							assetId,
							origin,
							wasteFactor: new Decimal('0.25'),
						}),
						written.version,
					),
				// A Requirement has no name to rename, so the proof is the field this entity
				// actually owns — persisted as a decimal STRING (ADR-010).
				expectOwned: { 'waste-factor': '0.25' },
			});
			return expectOk(await stack.requirements.getById(requirement.id))?.entity.wasteFactor.toString();
		},
	},
];

describe('a targeted property update preserves the user’s own note content', () => {
	it.each(PRESERVATION_CASES.map((testCase) => [testCase.kind, testCase] as const))(
		'%s.save keeps the body and the undeclared key, and still parses afterwards',
		async (_kind, testCase) => {
			expect(await testCase.drive(createRepositoryStack())).toBe(testCase.reads);
		},
	);

	/**
	 * The instrument, and the whole reason the callers above are a TABLE. Anchored to the
	 * plugin's own migration set — the same list `errorPaths.test.ts` measures its
	 * fail-closed cases against — minus the one kind that is not a note, excluded BY NAME
	 * rather than by the list happening not to mention it: `plan-geometry` is a sidecar with
	 * no repository and no `writeOwnedFrontmatter` call, and it has no body or undeclared
	 * keys to preserve because every key in that document is plugin-owned — which is exactly
	 * why `observeSidecar` digests the whole file where `observeFrontmatter` digests the
	 * owned keys alone.
	 *
	 * A seventh note-backed kind added to `MIGRATION_SET` turns this red until it has a
	 * preservation case, which is what the six hand-written `it()`s this file used to be
	 * could not do.
	 */
	it('covers every note-backed kind the plugin registers', () => {
		const noteBacked = Object.keys(MIGRATION_SET).filter((kind) => kind !== 'plan-geometry');
		expect(PRESERVATION_CASES.map((testCase) => testCase.kind).toSorted()).toEqual(noteBacked.toSorted());
	});

	/**
	 * The write path no term over `save` can reach, and the reason it is not in the table:
	 * `markStale` sets ONE field on a note it read itself, through a second
	 * `writeOwnedFrontmatter` call of its own. It is a second path belonging to
	 * `requirement`, not a sixth kind. It also keeps the revision it read, so "the note
	 * changed" cannot be argued from the revision here — the stale marker itself is the
	 * evidence.
	 */
	it('requirement.markStale — a second writeOwnedFrontmatter call, and not an upsert', async () => {
		const stack = createRepositoryStack();
		const projectId = await seedProject(stack);
		const requirement = makeRequirement({
			projectId,
			assetId: createAssetId(),
			origin: { kind: 'zone', zoneId: createZoneId() },
		});
		expectOk(await stack.requirements.save(requirement, 'absent'));

		await expectTargetedUpdatePreservesUserContent({
			stack,
			id: requirement.id,
			write: () => stack.requirements.markStale(requirement.id),
			expectOwned: { 'recalculation-status': 'stale' },
		});

		const reread = expectOk(await stack.requirements.getById(requirement.id));
		expect(reread?.entity.recalculationStatus).toBe('stale');
	});
});

/**
 * The other half of the same door. Preservation is about keys this build does NOT own;
 * retirement is about a key it USED to own and no longer writes — and omitting it from the
 * DTO cannot express that, because `writeOwnedFrontmatter` is a merge (`Object.assign`).
 * Without the `retired` list a note carrying `project:` would keep it forever, and dropping
 * the key from `AssetFrontmatterSchemaV1` at the same time made it look like one of the
 * unowned extras the case above exists to protect.
 */
describe('a retired owned key is removed from the note it survives on', () => {
	it('round-trips a note carrying a leftover project key to a note that does not', async () => {
		const stack = createRepositoryStack('Renovation');
		const id = createAssetId();
		const written = expectOk(await stack.assets.save(makeAsset({ id, name: 'Tiles' }), 'absent'));
		const path = stack.index.getPath(id) ?? '';

		// A slice-18-era note: the same bytes this build writes, plus the `project` key it
		// used to own. Hand-edited rather than mapper-produced, because the mapper that
		// produced it no longer exists.
		const before = parseFrontmatter(stack.vault.entries.get(path) ?? '');
		stack.vault.entries.set(
			path,
			serializeFrontmatter({ ...before.frontmatter, project: 'project-1' }) + before.body,
		);
		stack.metadataCache.catchUp();

		// It PARSES — the schema is not strict, so an existing note is readable rather than
		// refused.
		const loaded = expectOk(await stack.assets.getById(id));
		if (loaded === null) throw new Error('the leftover key should not stop the note parsing');
		expect(parseFrontmatter(stack.vault.entries.get(path) ?? '').frontmatter).toHaveProperty('project');

		const saved = expectOk(await stack.assets.save(loaded.entity, loaded.version));

		expect(saved.version.revision).toBe(written.version.revision + 1);
		// And the BYTES no longer carry it. Narrow claim, deliberately: this happens on a
		// SAVE. A note nobody ever saves again keeps the stale key on disk forever, there is
		// no sweep, and there will not be one.
		expect(parseFrontmatter(stack.vault.entries.get(path) ?? '').frontmatter).not.toHaveProperty('project');
	});

	it('lets a retired key that is re-owned survive as its new value', async () => {
		// Ordering inside `writeOwnedFrontmatter`: delete FIRST, assign second. Driven at that
		// function's own door, since no repository spec both owns and retires one key —
		// putting `name` in both lists asks whether a deletion can outrank the write that
		// follows it, and only this door can be asked.
		const stack = createRepositoryStack('Renovation');
		const path = 'Inbox/Note.md';
		stack.vault.entries.set(path, serializeFrontmatter({ name: 'Before', project: 'project-1' }));
		const file = stack.vault.getAbstractFileByPath(path);
		if (file === null) throw new Error('the planted note should resolve');

		await writeOwnedFrontmatter(stack.fileManager as never, file as never, { name: 'After' }, [
			'name',
			'project',
		]);

		expect(parseFrontmatter(stack.vault.entries.get(path) ?? '').frontmatter).toEqual({
			name: 'After',
		});
	});
});
