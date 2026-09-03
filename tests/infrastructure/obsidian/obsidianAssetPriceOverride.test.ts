import { describe, expect, it } from 'vitest';
import {
	createRepositoryStack,
	parseFrontmatter,
	serializeFrontmatter,
	type RepositoryStack,
} from '../../helpers/vault';
import { expectOk } from '../../helpers/domain';
import { makeProject as makeProjectEntity } from '../../helpers/entities';
import { normalizeFolder } from '../../../src/infrastructure/obsidian/repositories/paths';
import { projectToPersistence } from '../../../src/infrastructure/persistence/mappers/projectMapper';
import { currencyOf } from '../../../src/core/money/Money';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { createProjectId, type ProjectId } from '../../../src/domain/project/ProjectId';
import type { AssetPriceOverrideId } from '../../../src/domain/asset-price/AssetPriceOverrideId';
import { ObsidianAssetPriceOverrideRepository } from '../../../src/infrastructure/obsidian/repositories/ObsidianAssetPriceOverrideRepository';
import {
	assetPriceOverrideRepositoryContract,
	makeOverride,
} from '../../contracts/asset-price-override-repository.contract';

/**
 * A project the fixture has PROVISIONED, not a bare `createProjectId()` — the note-backed
 * repository resolves an insert's folder through `projectFolderOf(index, projectId)` and
 * refuses an unknown project outright. Planted the way `contract.test.ts`'s own
 * `registerOtherProject` plants one: `ObsidianProjectRepository.save` is a promise the
 * contract's `newProject()` has nowhere to await (`AssetPriceOverrideFixture.newProject`'s
 * own header says why), so the note and its index entry are written SYNCHRONOUSLY instead,
 * in exactly the bytes and shape a real save would produce, via `projectToPersistence`.
 *
 * GBP, since `makeOverride`'s own default currency is GBP and spec Decision 2 means the
 * read never checks the two against each other.
 */
function plantProject(stack: RepositoryStack): ProjectId {
	const folder = normalizeFolder(stack.projectFolder);
	const project = makeProjectEntity({ currency: currencyOf('GBP') });
	const path = `${folder}/${project.name} ${project.id}.md`;
	stack.vault.entries.set(path, serializeFrontmatter(projectToPersistence(project, 1)));
	stack.metadataCache.catchUp();
	stack.index.upsert({ id: project.id, type: 'renovation-project', path });
	return project.id;
}

/**
 * A hand edit: rewrites the CURRENCY field outside any repository — the observation token
 * moves, the revision does not — the same shape `contract.test.ts`'s own `handEdit` uses
 * for its sibling repositories' external-modification cases.
 */
function touch(stack: RepositoryStack, id: AssetPriceOverrideId): void {
	const path = stack.index.getPath(id);
	if (!path) throw new Error(`nothing indexed under ${id}`);
	const text = stack.vault.entries.get(path);
	if (text === undefined) throw new Error(`no note at ${path}`);
	const { frontmatter, body } = parseFrontmatter(text);
	frontmatter['currency'] = frontmatter['currency'] === 'GBP' ? 'EUR' : 'GBP';
	stack.vault.entries.set(path, `${serializeFrontmatter(frontmatter)}${body}`);
	// Anything the outside world does to a file is something Obsidian parses.
	stack.metadataCache.catchUp();
}

/** A note from a build this one predates — the same `schema-version` corruption
 *  `errorPaths.test.ts`'s `plantFutureSchemaVersion` drives, local to this file because it
 *  is asked of an id the shared repository stack does not resolve to a repository member. */
function poisonSchemaVersion(stack: RepositoryStack, id: AssetPriceOverrideId): void {
	const path = stack.index.getPath(id);
	if (!path) throw new Error(`nothing indexed under ${id}`);
	stack.vault.entries.set(
		path,
		(stack.vault.entries.get(path) ?? '').replace('schema-version: 1', 'schema-version: 99'),
	);
	stack.metadataCache.catchUp();
}

assetPriceOverrideRepositoryContract(() => {
	const stack = createRepositoryStack();
	return {
		repository: new ObsidianAssetPriceOverrideRepository(stack.deps),
		touch: (id) => touch(stack, id),
		newProject: () => plantProject(stack),
		newAsset: () => createAssetId(),
	};
});

describe('ObsidianAssetPriceOverrideRepository', () => {
	/**
	 * The insert path's own refusal — `saveNoteBackedEntity`'s `notesFolder === undefined`
	 * arm — driven the way `perProjectFolders.test.ts` drives it for every sibling kind: a
	 * bare `createProjectId()` resolves to no folder at all, because nothing registered it.
	 */
	it('refuses an insert whose project is not registered in the index', async () => {
		const stack = createRepositoryStack();
		const overrides = new ObsidianAssetPriceOverrideRepository(stack.deps);

		const result = await overrides.save(makeOverride(createProjectId(), createAssetId()), 'absent');

		expect(result.ok).toBe(false);
		expect(!result.ok && result.error.code).toBe('asset-price.project-folder-unresolved');
	});

	/**
	 * The duplicate-pair rule, which only the note-backed repository can exercise: two notes,
	 * one pair. Asserting the warning ALONE would pass against a build that then refuses, so
	 * this asserts BOTH — a price still comes back.
	 */
	it('warns and returns one price when two notes name the same pair', async () => {
		const stack = createRepositoryStack();
		const overrides = new ObsidianAssetPriceOverrideRepository(stack.deps);
		const projectId = plantProject(stack);
		const assetId = createAssetId();
		const older = makeOverride(projectId, assetId, '19.50');
		const newer = makeOverride(projectId, assetId, '21.00');
		expectOk(await overrides.save(older, 'absent'));
		expectOk(await overrides.save(newer, 'absent'));

		const found = expectOk(await overrides.getForPair(projectId, assetId));
		expect(found).not.toBeNull();
		expect(found?.entity.id).toBe(newer.id);
		expect(stack.logged.some((line) => line.event === 'asset-price.duplicate-pair')).toBe(true);
	});

	/**
	 * The vault-wide coupling, closed. Plant a MALFORMED price note in project A, then ask
	 * `getForPair` about project B — it must answer, because A's note is never read. Watch it
	 * fail against a build that hydrates every `renovation-asset-price` id: one broken note
	 * anywhere refuses every pair everywhere, and with it every assign and recalculation.
	 */
	it('answers for one project while another project holds an unreadable price note', async () => {
		const stack = createRepositoryStack();
		const overrides = new ObsidianAssetPriceOverrideRepository(stack.deps);

		const brokenProjectId = plantProject(stack);
		const brokenAssetId = createAssetId();
		const broken = expectOk(await overrides.save(makeOverride(brokenProjectId, brokenAssetId), 'absent'));
		poisonSchemaVersion(stack, broken.entity.id);

		const otherProjectId = plantProject(stack);
		const otherAssetId = createAssetId();
		expectOk(await overrides.save(makeOverride(otherProjectId, otherAssetId), 'absent'));

		const found = expectOk(await overrides.getForPair(otherProjectId, otherAssetId));
		expect(found).not.toBeNull();
	});

	/**
	 * And the other half, so the narrowing is not mistaken for tolerance: a malformed note in
	 * project B's OWN scope still refuses, because it might be the note being asked about, and
	 * skipping it would price the requirement at the catalogue default while saying nothing.
	 */
	it('refuses when the unreadable note is in the project being asked about', async () => {
		const stack = createRepositoryStack();
		const overrides = new ObsidianAssetPriceOverrideRepository(stack.deps);

		const projectId = plantProject(stack);
		const assetId = createAssetId();
		const saved = expectOk(await overrides.save(makeOverride(projectId, assetId), 'absent'));
		poisonSchemaVersion(stack, saved.entity.id);

		const result = await overrides.getForPair(projectId, assetId);
		expect(result.ok).toBe(false);
	});
});
