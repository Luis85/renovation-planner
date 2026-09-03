import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { isErr } from '../../../src/core/result/Result';
import type { RequirementRepository } from '../../../src/application/ports/RequirementRepository';
import { InMemoryRequirementRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { createRepositoryStack, type RepositoryStack } from '../../helpers/vault';
import { openFixtureVault, type FixtureStack } from '../../helpers/fixtureVault';
import { expectOk } from '../../helpers/domain';
import { makeProject as makeProjectEntity, makeRequirement as makeRequirementEntity, makePlan as makePlanEntity } from '../../helpers/entities';
import { createProjectId, type ProjectId } from '../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { createZoneId } from '../../../src/domain/zone/ZoneId';
import type { RequirementId } from '../../../src/domain/requirement/RequirementId';

/**
 * One row's whole interface: `.requirements` is the port under test everywhere, and the
 * other three members are how each row answers the questions the generic cases need to
 * ask — "make this project exist", "put a non-requirement entry under it" and "make one
 * requirement note unreadable" — without the test bodies caring which host they are
 * driving. `seedPlan` and `corruptRequirementNote` are no-ops on the in-memory row: it
 * holds nothing but Requirement objects, so there is no index to intersect and no note to
 * corrupt, which is also why the two `it.runIf(hasVault)` cases never call the latter.
 */
interface RequirementRow {
	requirements: RequirementRepository;
	seedProject(id: ProjectId): Promise<void>;
	/** Indexes a Plan under `projectId` — the MIXED-axis entry `getIdsByProject` must not answer as a requirement. */
	seedPlan(projectId: ProjectId): Promise<void>;
	/** Rewrites one requirement note's `schema-version` to a value no migration reaches — a note from a build this one predates. Vault-backed rows only. */
	corruptRequirementNote?(id: RequirementId): Promise<void>;
	dispose(): void;
}

function zoneOrigin(): { readonly kind: 'zone'; readonly zoneId: ReturnType<typeof createZoneId> } {
	return { kind: 'zone', zoneId: createZoneId() };
}

async function seedRequirement(row: RequirementRow, projectId: ProjectId, id?: RequirementId): Promise<RequirementId> {
	const saved = expectOk(
		await row.requirements.save(
			makeRequirementEntity({ id, projectId, assetId: createAssetId(), origin: zoneOrigin() }),
			'absent',
		),
	);
	return saved.entity.id;
}

function openInMemoryRequirements(): Promise<RequirementRow> {
	const requirements = new InMemoryRequirementRepository();
	return Promise.resolve({
		requirements,
		seedProject: () => Promise.resolve(),
		seedPlan: () => Promise.resolve(),
		dispose: () => {},
	});
}

function openFakeVaultRow(): Promise<RequirementRow> {
	const stack: RepositoryStack = createRepositoryStack();
	return Promise.resolve({
		requirements: stack.requirements,
		seedProject: async (id) => {
			expectOk(await stack.projects.save(makeProjectEntity({ id }), 'absent'));
		},
		seedPlan: async (projectId) => {
			expectOk(await stack.plans.save(makePlanEntity({ projectId }), 'absent'));
		},
		corruptRequirementNote: (id) => {
			const path = stack.index.getPath(id);
			if (!path) throw new Error(`No path indexed for requirement ${id}`);
			const before = stack.vault.entries.get(path) ?? '';
			const after = before.replace('schema-version: 1', 'schema-version: 999');
			if (after === before) throw new Error(`Corrupting ${path} changed nothing — the fixture's frontmatter has moved`);
			// An "outside write": `entries.set` retires the parse-lag record the way a hand
			// edit or a sync client's write would, so no `catchUp()` is needed — see
			// `errorPaths.test.ts`'s `plantFutureSchemaVersion`, the same shape.
			stack.vault.entries.set(path, after);
			return Promise.resolve();
		},
		dispose: () => {},
	});
}

async function openDiskRow(): Promise<RequirementRow> {
	const stack: FixtureStack = await openFixtureVault('valid-project');
	return {
		requirements: stack.requirements,
		seedProject: async (id) => {
			expectOk(await stack.projects.save(makeProjectEntity({ id }), 'absent'));
		},
		seedPlan: async (projectId) => {
			expectOk(await stack.plans.save(makePlanEntity({ projectId }), 'absent'));
		},
		corruptRequirementNote: async (id) => {
			const path = stack.index.getPath(id);
			if (!path) throw new Error(`No path indexed for requirement ${id}`);
			const file = stack.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) throw new Error(`No fixture note at ${path}`);
			const before = await stack.vault.read(file);
			const after = before.replace('schema-version: 1', 'schema-version: 999');
			if (after === before) throw new Error(`Corrupting ${path} changed nothing — the fixture's frontmatter has moved`);
			await stack.vault.modify(file, after);
			stack.metadataCache.catchUp();
		},
		dispose: () => stack.dispose(),
	};
}

// The two REAL implementations, plus the second host. `createRepositoryStack` and
// `openFixtureVault` both build `ObsidianRequirementRepository` — over `FakeVault` and
// over disk — so listing only those two compares one implementation against itself. The
// third column is `hasVault` and it is REQUIRED: three cases below are vault-backed only
// and gate on it, so a two-column row leaves `hasVault` an undefined free variable.
describe.each([
	['in-memory', openInMemoryRequirements, false],
	['obsidian/fake-vault', openFakeVaultRow, true],
	['obsidian/disk', openDiskRow, true],
] as const)('listByProject (%s)', (_name, open, hasVault) => {
	it('returns this project’s requirements and nothing else', async () => {
		const row = await open();
		try {
			const projectA = createProjectId();
			const projectB = createProjectId();
			await row.seedProject(projectA);
			await row.seedProject(projectB);
			const a1 = await seedRequirement(row, projectA);
			const a2 = await seedRequirement(row, projectA);
			await seedRequirement(row, projectB);

			const listed = await row.requirements.listByProject(projectA);

			expect(listed.ok).toBe(true);
			if (!listed.ok) return;
			expect(listed.value.refused).toBe(0);
			expect(new Set(listed.value.loaded.map((l) => l.entity.id))).toEqual(new Set([a1, a2]));
		} finally {
			row.dispose();
		}
	});

	// The two unreadable-note cases are VAULT-BACKED ONLY: `InMemoryRequirementRepository`
	// always answers `ok()` off its own store and has no note to make unreadable, so a stub
	// pretending to refuse here would be testing the stub rather than the repository.
	it.runIf(hasVault)('counts an unreadable note instead of refusing the whole list', async () => {
		const row = await open();
		try {
			const projectA = createProjectId();
			await row.seedProject(projectA);
			const bad = await seedRequirement(row, projectA);
			await seedRequirement(row, projectA);
			await row.corruptRequirementNote?.(bad);

			const listed = await row.requirements.listByProject(projectA);

			expect(listed.ok).toBe(true);
			if (!listed.ok) return;
			expect(listed.value.loaded).toHaveLength(1);
			expect(listed.value.refused).toBe(1);
		} finally {
			row.dispose();
		}
	});

	it.runIf(hasVault)('counts only THIS project’s unreadable note', async () => {
		const row = await open();
		try {
			const projectA = createProjectId();
			const projectB = createProjectId();
			await row.seedProject(projectA);
			await row.seedProject(projectB);
			const good = await seedRequirement(row, projectA);
			const bad = await seedRequirement(row, projectB);
			await row.corruptRequirementNote?.(bad);

			// Unscoped ids would count project B's bad note against project A too.
			const listedA = await row.requirements.listByProject(projectA);
			expect(listedA.ok).toBe(true);
			if (!listedA.ok) return;
			expect(listedA.value.loaded.map((l) => l.entity.id)).toEqual([good]);
			expect(listedA.value.refused).toBe(0);

			// And it IS counted against the project it actually belongs to.
			const listedB = await row.requirements.listByProject(projectB);
			expect(listedB.ok).toBe(true);
			if (!listedB.ok) return;
			expect(listedB.value.loaded).toHaveLength(0);
			expect(listedB.value.refused).toBe(1);
		} finally {
			row.dispose();
		}
	});

	it('does not try to parse a plan as a requirement', async () => {
		// `getIdsByProject` is a MIXED axis: plans, zones and requirements all carry a
		// `projectId`. Without the type intersection this inflates `refused` on every
		// ordinary project — see the mutation in the docstring of the port method.
		const row = await open();
		try {
			const projectA = createProjectId();
			await row.seedProject(projectA);
			await row.seedPlan(projectA);
			const requirementId = await seedRequirement(row, projectA);

			const listed = await row.requirements.listByProject(projectA);

			expect(listed.ok).toBe(true);
			if (!listed.ok) return;
			expect(listed.value.loaded.map((l) => l.entity.id)).toEqual([requirementId]);
			expect(listed.value.refused).toBe(0);
		} finally {
			row.dispose();
		}
	});

	// Vault-backed only, for the same reason as the two unreadable-note cases above: the
	// write guarantee this pins is `DeleteZoneCommand`'s, and only a real note can be made
	// unreadable to prove `listByZone` still returns on the first one rather than skipping.
	it.runIf(hasVault)('leaves listByZone strict', async () => {
		const row = await open();
		try {
			const projectA = createProjectId();
			await row.seedProject(projectA);
			const bad = await seedRequirement(row, projectA);
			await row.corruptRequirementNote?.(bad);

			// `listByZone` reads every requirement id in the vault before it ever applies the
			// zone predicate, so ANY zone id — not only the corrupted note's own — meets the
			// unreadable note and refuses on it.
			const listed = await row.requirements.listByZone(createZoneId());

			expect(isErr(listed)).toBe(true);
		} finally {
			row.dispose();
		}
	});
});
