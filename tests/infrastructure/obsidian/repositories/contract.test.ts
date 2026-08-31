import { describe, expect, it } from 'vitest';
import {
	createRepositoryStack,
	serializeFrontmatter,
	parseFrontmatter,
	type RepositoryStack,
} from '../../../helpers/vault';
import { expectOk } from '../../../helpers/domain';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity, makeZone as makeZoneEntity } from '../../../helpers/entities';
import { assetRepositoryContract } from '../../../contracts/asset-repository.contract';
import { requirementRepositoryContract } from '../../../contracts/requirement-repository.contract';
import {
	createPlanId,
	type PlanId,
} from '../../../../src/domain/plan/PlanId';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import type { EntityId } from '../../../../src/core/identity/EntityId';
import type { Plan } from '../../../../src/domain/plan/Plan';
import type { Project } from '../../../../src/domain/project/Project';
import { projectRepositoryContract } from '../../../contracts/project-repository.contract';
import { planRepositoryContract } from '../../../contracts/plan-repository.contract';
import { zoneRepositoryContract } from '../../../contracts/zone-repository.contract';
import { normalizeFolder, plansFolderFor, projectFolderOf, sidecarPathFor } from '../../../../src/infrastructure/obsidian/repositories/paths';
import { projectToPersistence } from '../../../../src/infrastructure/persistence/mappers/projectMapper';
import { planToPersistence } from '../../../../src/infrastructure/persistence/mappers/planMapper';

/**
 * Slice 4's half of SDD §72: THE SAME suites slice 3 wrote against the in-memory
 * repositories, imported verbatim, run against the Obsidian-backed ones. The suite body
 * was not edited to accommodate this side; only fixtures live here.
 *
 * The fixture hooks are synchronous BY CONTRACT (`touch` and `otherParents` return
 * plain values in the shared suites), so anything the real persistence needs on disk
 * before a Zone can exist — its Project note, its Plan note, the Plan's sidecar, their
 * index entries — is planted directly here, in exactly the layout and byte shape the
 * repositories themselves produce.
 */

/**
 * The four keys a hand edit must not be made to, so that what it proves is the OBSERVATION
 * token moving and not the revision channel beside it — `revision` is the other half of
 * `checkExpectedVersion`, and `type`/`schema-version`/`id` are what a note IS.
 */
const NOT_A_HAND_EDIT = new Set(['type', 'schema-version', 'id', 'revision']);

/**
 * A hand edit: rewrites an OWNED key's value outside any repository — token moves, revision
 * does not.
 *
 * It picks a key the note ACTUALLY HOLDS rather than naming one, and that is a correction.
 * It used to append to `name`, which a Requirement note does not have: no schema of that kind
 * declares one, so the edit added an undeclared key, and the case passed only because the
 * digest was minting its token over the union of all five schemas — a key it should never
 * have been reading for that note. Scoping the digest to a note's own kind turned this green
 * case red, which is the honest outcome: `requirement.external-modification` was being proved
 * by the very defect the scoping fixed. Every key a note here holds was written by the
 * repository through `writeOwnedFrontmatter`, so any of them but the four above is owned by
 * that kind by construction.
 */
function handEdit(stack: RepositoryStack, id: string): void {
	const path = stack.index.getPath(id as EntityId<string>);
	if (!path) throw new Error(`nothing indexed under ${id}`);
	const text = stack.vault.entries.get(path);
	if (text === undefined) throw new Error(`no note at ${path}`);
	const { frontmatter, body } = parseFrontmatter(text);
	const key = Object.keys(frontmatter).find((candidate) => !NOT_A_HAND_EDIT.has(candidate));
	if (key === undefined) throw new Error(`nothing but identity keys to hand-edit at ${path}`);
	frontmatter[key] = `${String(frontmatter[key])} (edited by hand)`;
	stack.vault.entries.set(path, `${serializeFrontmatter(frontmatter)}${body}`);
	// Anything the outside world does to a file is something Obsidian parses, so a hand edit
	// is by definition visible to the metadata cache. Without this the fake would model a
	// hand edit nobody has read yet, which is not what any caller of `touch` means.
	stack.metadataCache.catchUp();
}

function plantNote(
	stack: RepositoryStack,
	path: string,
	type: 'renovation-project' | 'renovation-plan',
	owned: Record<string, unknown>,
): void {
	stack.vault.entries.set(path, serializeFrontmatter(owned));
	// Planted from outside, so parsed — see `handEdit`.
	stack.metadataCache.catchUp();
	stack.index.upsert({
		id: owned['id'] as EntityId<string>,
		type,
		path,
		projectId: owned['project'] as ProjectId | undefined,
		planId: owned['plan'] as PlanId | undefined,
	});
}

/**
 * A project the caller never intends to touch through `ObsidianProjectRepository` — the
 * shared contract's `otherProject()` mints a project and expects a Plan or Zone built
 * against it to save normally. Folder resolution now goes through the index (ADR-0013),
 * so that project needs a real note, planted in exactly the layout and byte shape the
 * repository itself produces — `plantNote` plus the real `projectToPersistence` mapper,
 * the same pair `provision()` below already uses for a Plan's owning project, rather than
 * a bare index entry pointing at a filename no repository would ever write. Nothing reads
 * this note today, but a fixture note that could not survive being read is the thin-fake
 * shape this repository keeps finding.
 */
function registerOtherProject(stack: RepositoryStack): ProjectId {
	const folder = normalizeFolder(stack.projectFolder);
	const project = makeProjectEntity();
	const path = `${folder}/${project.name} ${project.id}.md`;
	plantNote(stack, path, 'renovation-project', projectToPersistence(project, 1));
	return project.id;
}

function fixEntry(
	stack: RepositoryStack,
	id: EntityId<string>,
	patch: (entry: { id: EntityId<string>; type: string; path: string; projectId?: ProjectId; planId?: PlanId; geometrySidecarPath?: string }) => {
		id: EntityId<string>;
		type: string;
		path: string;
		projectId?: ProjectId;
		planId?: PlanId;
		geometrySidecarPath?: string;
	},
): void {
	const entry = stack.index.entries().find((candidate) => candidate.id === id);
	if (entry) stack.index.upsert(patch(entry) as never);
}

projectRepositoryContract(() => {
	const stack = createRepositoryStack();
	return {
		repository: stack.projects,
		makeProject: (name?: string) => makeProjectEntity(name ? { name } : undefined),
		touch: (id) => handEdit(stack, id),
	};
});

planRepositoryContract(() => {
	const stack = createRepositoryStack();
	return {
		repository: stack.plans,
		makePlan: (projectId: ProjectId, name?: string) => makePlanEntity({ projectId, ...(name ? { name } : {}) }),
		touch: (id) => handEdit(stack, id),
		otherProject: () => registerOtherProject(stack),
	};
});

zoneRepositoryContract(() => {
	const stack = createRepositoryStack();
	const folder = normalizeFolder(stack.projectFolder);

	function provision(): { projectId: ProjectId; planId: PlanId } {
		const projectId = createProjectId();
		const planId = createPlanId();
		const project: Project = makeProjectEntity({ id: projectId });
		const plan: Plan = makePlanEntity({ id: planId, projectId });

		// Through the REAL mappers, not a hand-copied shape. A hand-built record is a second
		// answer to what a note holds: it drifts silently the day a mapper adds, renames or
		// re-spells a key, and the Obsidian-side contract run then passes against a layout
		// the repositories no longer write. `revision: 1` is what a first save records.
		const projectPath = `${folder}/${project.name} ${project.id}.md`;
		plantNote(stack, projectPath, 'renovation-project', projectToPersistence(project, 1));

		// `plantNote` reads `project` straight out of the record for the index entry, and
		// the mapper puts it there — so no separate patch for `projectId` is needed.
		const planPath = `${plansFolderFor(folder)}/${plan.name} ${plan.id}.md`;
		plantNote(stack, planPath, 'renovation-plan', planToPersistence(plan, 1));

		const sidecarPath = sidecarPathFor(folder, plan.id);
		stack.vault.entries.set(
			sidecarPath,
			JSON.stringify(
				{ schemaVersion: 1, planId: plan.id, revision: 1, unit: 'mm', calibration: null, objects: [] },
				null,
				'\t',
			),
		);
		fixEntry(stack, plan.id, (entry) => ({ ...entry, geometrySidecarPath: sidecarPath }));

		return { projectId, planId };
	}

	return {
		repository: stack.zones,
		makeZone: (projectId, planId, name?) => makeZoneEntity({ projectId, planId, ...(name ? { name } : {}) }),
		touch: (id) => handEdit(stack, id),
		otherParents: () => provision(),
		otherProject: () => registerOtherProject(stack),
	};
});

/**
 * The defect that shipped with slice 4 and was found by running slice 5's
 * `create-sample-project` in a real vault for the first time.
 *
 * Obsidian populates its `MetadataCache` ASYNCHRONOUSLY, so a note read back in the same
 * tick it was created has no cache entry at all. `frontmatterOf` answered `{}` for that,
 * every caller read the missing `schema-version` as version 0, and the migration runner —
 * which has no step from 0, because schema 1 is the first — threw `chain-gap`. So the read
 * failed with "Migrating the project note failed" on a note that had just been written
 * perfectly well, and `CreatePlanCommand`, which reads its Project back to validate the
 * reference, could never create a Plan.
 *
 * Driven through the REPOSITORIES rather than through the seed, because the defect is
 * theirs: any create-then-read pays it, and slice 15's creation dialogs would have paid it
 * next. `FakeMetadataCache` is what makes this reachable — it used to parse the vault's own
 * text synchronously, which is why 860 green tests said nothing about it.
 */
describe('reading a note back inside Obsidian’s parse window', () => {
	it('reads a project the repository has only just created', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity();

		expectOk(await stack.projects.save(project, 'absent'));
		// No `catchUp()`: this is the window, and the assertion is that it works IN it.
		expect(stack.metadataCache.getFileCache(stack.vault.getAbstractFileByPath(stack.index.getPath(project.id) as string) as never)).toBeNull();

		const read = expectOk(await stack.projects.getById(project.id));

		expect(read?.entity.name).toBe(project.name);
		// The revision too: it comes from the same frontmatter, and a fallback that answered
		// the entity but not its version would refuse the next conditional write.
		expect(read?.version.revision).toBe(1);
	});

	it('creates a plan under a project created in the same tick', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity();
		expectOk(await stack.projects.save(project, 'absent'));

		const plan = makePlanEntity({ projectId: project.id });
		expectOk(await stack.plans.save(plan, 'absent'));

		// Both readable, both still inside the window — the exact sequence the sample
		// project performs, and the one that failed in the vault.
		expect(expectOk(await stack.plans.getById(plan.id))?.entity.projectId).toBe(project.id);
		expect(expectOk(await stack.projects.getById(project.id))?.entity.id).toBe(project.id);
	});

	/**
	 * The other half of the same fix, and the reason `frontmatterOf` keys on the cache
	 * ENTRY rather than on its `frontmatter` field: a note Obsidian HAS parsed and found no
	 * frontmatter in must not be answered from what this plugin last wrote there, or a user
	 * deleting a note's frontmatter would be served stale bytes for the rest of the session.
	 */
	it('does not serve its own last write for a note whose frontmatter was deleted', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity();
		expectOk(await stack.projects.save(project, 'absent'));
		const path = stack.index.getPath(project.id) as string;

		stack.vault.entries.set(path, 'someone deleted the frontmatter');
		stack.metadataCache.catchUp();

		expect((await stack.projects.getById(project.id)).ok).toBe(false);
	});
});

/**
 * The third defect a live vault found, and the second one this fake was too kind to show.
 *
 * Obsidian's metadata cache lags a MODIFY as well as a create — the entry is present and
 * parsed from the PREVIOUS version of the file. `frontmatterOf` consulted the echo window
 * only when there was no entry AT ALL, so a read inside that window was served the
 * pre-write frontmatter: `SetPlanBackground` wrote the reference and published its event,
 * the Plan Editor re-hydrated off that event, and the query answered a plan with no
 * background. The canvas drew nothing, and the background appeared only much later, when
 * some unrelated action re-read a note the cache had caught up with in the meantime.
 *
 * The discriminator is `revision`, an owned key on every note kind: a cache entry whose
 * revision is BEHIND the one this plugin last wrote is an entry that predates our write.
 * Anything else — equal, ahead, or a note whose frontmatter is gone — is the cache's to
 * answer, so a hand edit still wins.
 */
describe('reading back inside the metadata cache parse window', () => {
	it('answers with what this plugin just wrote, not the frontmatter the cache still holds', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity();
		expectOk(await stack.projects.save(project, 'absent'));
		const plan = makePlanEntity({ projectId: project.id });
		expectOk(await stack.plans.save(plan, 'absent'));
		stack.metadataCache.catchUp();

		const loaded = expectOk(await stack.plans.getById(plan.id));
		const background = { path: 'Plans/floor.png', kind: 'image' } as const;
		const updated = expectOk(loaded?.entity.withBackground(background) as never) as Plan;
		expectOk(await stack.plans.save(updated, (loaded as NonNullable<typeof loaded>).version));

		// No `catchUp()`: this is the tick the event fires in, and Obsidian has not re-parsed.
		expect(expectOk(await stack.plans.getById(plan.id))?.entity.background).toEqual(background);
	});

	/**
	 * The rule the echo fallback must not break, driven from the other side. Preferring our
	 * own last write unconditionally would serve stale bytes over a real edit for as long as
	 * the change pipeline had not run.
	 */
	it('prefers a hand edit the cache has already parsed over its own last write', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity();
		expectOk(await stack.projects.save(project, 'absent'));
		const path = stack.index.getPath(project.id) as string;

		const written = stack.vault.entries.get(path) as string;
		stack.vault.entries.set(path, written.replace(/^name: .*$/m, 'name: Renamed by hand'));
		stack.metadataCache.catchUp();

		expect(expectOk(await stack.projects.getById(project.id))?.entity.name).toBe('Renamed by hand');
	});
});

/**
 * A read that must have found something, without a non-null assertion: these cases have just
 * written the note they are reading, so an absent one is a broken fixture and says so here
 * rather than at whichever property is touched next.
 */
function asLoaded<T>(loaded: T | null): T {
	if (loaded === null) throw new Error("the fixture wrote a note this read did not find");
	return loaded;
}

/**
 * The two P1s a review of the parse-lag fix found, both driven rather than argued.
 *
 * They share a root: a comparison of cache TOKENS cannot tell "the cache is behind US" from
 * "the cache is behind SOMEBODY ELSE", and it cannot see an external edit at all, because an
 * unparsed edit is by definition invisible to the cache. So the echo is served only when BOTH
 * questions answer yes — is the file still the one we wrote, and is the cache showing a state
 * of ours that we have since superseded.
 */
describe('the echo fallback refuses itself when it cannot prove the cache is behind US', () => {
	/**
	 * The one that was a REGRESSION rather than a gap. Before the parse-lag fix this save was
	 * refused — the stale cached revision differed from the expectation the command held — and
	 * the fix turned that refusal into a silent overwrite of somebody else's edit, which is the
	 * exact harm the conditional-write contract exists to prevent.
	 */
	it('does not hide, or overwrite, an external edit that landed during the window', async () => {
		const stack = createRepositoryStack();
		const id = makeProjectEntity().id;
		expectOk(await stack.projects.save(makeProjectEntity({ id, name: 'Original' }), 'absent'));
		stack.metadataCache.catchUp();
		const path = stack.index.getPath(id) as string;
		const before = stack.vault.entries.get(path) as string;

		const read = expectOk(await stack.projects.getById(id));
		const ours = expectOk(await stack.projects.save(makeProjectEntity({ id, name: 'Ours' }), asLoaded(read).version));

		// Somebody else writes, and Obsidian has parsed NEITHER write.
		stack.vault.entries.set(path, before.replace(/name: .*/, 'name: Edited by hand'));
		stack.vault.pendingParse.set(path, before);

		// NOT our own bytes. It cannot be the external edit either — the cache has not parsed
		// that, and this function does not read files — so the honest answer is the stale cache,
		// which is what makes the conditional write below refuse rather than overwrite.
		expect(expectOk(await stack.projects.getById(id))?.entity.name).not.toBe('Ours');
		expect((await stack.projects.save(makeProjectEntity({ id, name: 'Ours again' }), ours.version)).ok).toBe(false);
		expect(stack.vault.entries.get(path)).toContain('Edited by hand');
	});

	/**
	 * The one that was already there and which the fix narrowed without closing: two writes
	 * inside one window, and Obsidian parses the FIRST before the second. The cached token then
	 * matches neither the reading taken before the latest write nor the latest echo, so the
	 * intermediate state was served as if it were current.
	 */
	it('serves the latest write when the cache has parsed only an earlier one of ours', async () => {
		const stack = createRepositoryStack();
		const id = makeProjectEntity().id;
		expectOk(await stack.projects.save(makeProjectEntity({ id, name: 'Original' }), 'absent'));
		stack.metadataCache.catchUp();
		const path = stack.index.getPath(id) as string;
		const before = stack.vault.entries.get(path) as string;

		const first = expectOk(await stack.projects.getById(id));
		expectOk(await stack.projects.save(makeProjectEntity({ id, name: 'First' }), asLoaded(first).version));
		stack.vault.pendingParse.set(path, before);
		const afterFirst = stack.vault.entries.get(path) as string;

		const second = expectOk(await stack.projects.getById(id));
		expectOk(await stack.projects.save(makeProjectEntity({ id, name: 'Second' }), asLoaded(second).version));

		// Obsidian's queue reaches the first write's bytes, before the second are parsed.
		stack.vault.pendingParse.set(path, afterFirst);

		expect(expectOk(await stack.projects.getById(id))?.entity.name).toBe('Second');
	});

	/**
	 * The stat is a statement about the file WE wrote, so it has to be taken while that is
	 * still what is on disk. Every other writer takes it with nothing but synchronous index
	 * bookkeeping between the note write and the reading; the Zone repository writes its note,
	 * then AWAITS a whole sidecar mutation, and took the reading after that. An external edit
	 * landing in that window was recorded as OUR stat, and `frontmatterOf` then vouched for a
	 * file somebody else had written — the same overwrite the case above exists to refuse,
	 * reached through the one path with an await in the middle of it.
	 */
	it('does not vouch for an external edit that landed while the sidecar write was in flight', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity();
		expectOk(await stack.projects.save(project, 'absent'));
		const plan = makePlanEntity({ projectId: project.id });
		expectOk(await stack.plans.save(plan, 'absent'));
		const zone = makeZoneEntity({ projectId: project.id, planId: plan.id, name: 'Original' });
		const named = (name: string) => makeZoneEntity({ id: zone.id, projectId: project.id, planId: plan.id, name });
		expectOk(await stack.zones.save(zone, 'absent'));
		stack.metadataCache.catchUp();

		const path = stack.index.getPath(zone.id) as string;
		const before = stack.vault.entries.get(path) as string;
		const read = asLoaded(expectOk(await stack.zones.getById(zone.id)));

		// Somebody else writes the NOTE while the sidecar write this save awaits is running,
		// and Obsidian has parsed neither that edit nor our own write.
		const mutate = stack.store.mutate.bind(stack.store);
		stack.store.mutate = async (...args: Parameters<typeof mutate>) => {
			const result = await mutate(...args);
			stack.vault.entries.set(path, before.replace(/name: .*/, 'name: Edited by hand'));
			stack.vault.pendingParse.set(path, before);
			return result;
		};

		const ours = expectOk(await stack.zones.save(named('Ours'), read.version));

		expect(expectOk(await stack.zones.getById(zone.id))?.entity.name).not.toBe('Ours');
		expect((await stack.zones.save(named('Ours again'), ours.version)).ok).toBe(false);
		expect(stack.vault.entries.get(path)).toContain('Edited by hand');
	});
});

/**
 * The second defect a live vault found, on the very next command after the parse-window one
 * was fixed: "the geometry sidecar could not be created".
 *
 * ADR-011 puts a Plan's sidecar in a `Geometry/` folder of its own, and `PlanGeometryStore`
 * went straight to `vault.create` for it. The project, plans and zones folders each get an
 * `ensureFolder` from the repository that writes into them; `Geometry/` had none, and no
 * note ever lands there to create it as a side effect. Obsidian refuses a create whose
 * parent does not exist, so on a fresh vault the FIRST write of the FIRST plan failed — and
 * because the sidecar is written before the note, the plan save failed outright.
 *
 * `FakeVault.create` accepted a missing parent, which is why 869 green tests said nothing.
 * It refuses now, and making it refuse turned 86 tests red at once.
 */
describe('writing into a folder nothing has created yet', () => {
	it('creates a plan into an empty vault, geometry folder and all', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity();
		expectOk(await stack.projects.save(project, 'absent'));

		const plan = makePlanEntity({ projectId: project.id });
		expectOk(await stack.plans.save(plan, 'absent'));

		// The sidecar exists, at the path the index maps the plan to — not merely "the save
		// returned ok", which is what a fake with no folders would have allowed. Under its
		// project's OWN folder (ADR-0013), not the bare configured root.
		const sidecarPath = stack.index.getGeometrySidecarPath(plan.id);
		// No `?? normalizeFolder(stack.projectFolder)` fallback: the project was just saved
		// above, so `projectFolderOf` always resolves — a fallback that never fires is dead
		// tolerance that would silently reconstruct the old flat path the day it stopped.
		const projectFolder = projectFolderOf(stack.index, project.id);
		if (projectFolder === undefined) throw new Error(`no folder indexed for project ${project.id}`);
		expect(sidecarPath).toBe(sidecarPathFor(projectFolder, plan.id));
		expect(stack.vault.entries.has(sidecarPath as string)).toBe(true);
	});

	/**
	 * The whole sequence the sample project runs, into a vault with nothing in it — the one
	 * that failed in Obsidian twice for two different reasons. A zone as well as a plan,
	 * because the Zones folder is a third folder and the sidecar MUTATION path is the one
	 * that reads the file back.
	 */
	it('creates a project, a plan and a zone with no folders in place', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity();
		expectOk(await stack.projects.save(project, 'absent'));
		const plan = makePlanEntity({ projectId: project.id });
		expectOk(await stack.plans.save(plan, 'absent'));
		const zone = makeZoneEntity({ projectId: project.id, planId: plan.id });
		expectOk(await stack.zones.save(zone, 'absent'));

		expect(expectOk(await stack.zones.listByPlan(plan.id))).toHaveLength(1);
	});
	/**
	 * The geometry sidecar is PLAN-grained: one vault read, one JSON parse, one migration
	 * and one Zod validation of every spatial object in the plan. Loading N zones by
	 * calling `getById` N times therefore did N of those — O(N) file reads and O(N²) point
	 * validations to answer one listing — and the Plan Editor's post-command refresh
	 * re-hydrates the whole plan after every drag release, drawn polygon, delete and Undo
	 * press.
	 *
	 * Counted at the vault rather than argued about: a memo that quietly stopped memoising
	 * would answer every other assertion in this file identically.
	 */
	it('reads a plan geometry sidecar ONCE per listing, not once per zone', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity();
		expectOk(await stack.projects.save(project, 'absent'));
		const plan = makePlanEntity({ projectId: project.id });
		expectOk(await stack.plans.save(plan, 'absent'));
		for (let index = 0; index < 4; index += 1) {
			expectOk(await stack.zones.save(makeZoneEntity({ projectId: project.id, planId: plan.id }), 'absent'));
		}

		stack.vault.operations.length = 0;
		expect(expectOk(await stack.zones.listByPlan(plan.id))).toHaveLength(4);

		const sidecarReads = stack.vault.operations.filter(
			(operation) => operation.startsWith('read:') && operation.includes('Geometry/'),
		);
		expect(sidecarReads).toHaveLength(1);
	});
});

/**
 * `ObsidianPlanRepository.listByProject`'s own drop, driven through the real index/note
 * loop rather than through a hand-built `PlanRepository` double. `listPlansByProject.test.ts`
 * used to claim this behaviour from the application layer with a fake repository that could
 * only ever return an already-filtered array — it could not produce an indexed id whose note
 * is gone, so it could not distinguish that from a project that genuinely has one plan, and
 * kept passing no matter what the repository's loop did. This is the fixture that CAN produce
 * it: an index entry planted directly (`index.upsert`, never `plantNote`), pointing at a path
 * nothing ever wrote — the shape a note deleted out from under a stale index entry leaves
 * behind, before `VaultChangeAdapter`'s next pass corrects it.
 */
describe('listByProject and a note the index still points at', () => {
	it('drops an indexed plan id whose note is gone rather than reporting it', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity();
		expectOk(await stack.projects.save(project, 'absent'));
		const survivor = makePlanEntity({ projectId: project.id, name: 'Ground floor' });
		expectOk(await stack.plans.save(survivor, 'absent'));

		// Indexed, never written: `getAbstractFileByPath` answers null for this path, so
		// `openNoteById` reports 'missing' the same way it would for a note removed by hand.
		const folder = projectFolderOf(stack.index, project.id);
		if (folder === undefined) throw new Error(`no folder indexed for project ${project.id}`);
		const staleId = createPlanId();
		stack.index.upsert({
			id: staleId,
			type: 'renovation-plan',
			path: `${plansFolderFor(folder)}/Ghost ${staleId}.md`,
			projectId: project.id,
		});

		const listed = expectOk(await stack.plans.listByProject(project.id));

		expect(listed.map((plan) => plan.entity.name)).toEqual(['Ground floor']);
	});
});

assetRepositoryContract(() => {
	const stack = createRepositoryStack();
	return {
		repository: stack.assets,
		touch: (id) => handEdit(stack, id),
	};
});

requirementRepositoryContract(() => {
	const stack = createRepositoryStack();
	return {
		repository: stack.requirements,
		touch: (id) => handEdit(stack, id),
		otherProject: () => registerOtherProject(stack),
		newZone: () => createZoneId(),
		newAsset: () => createAssetId(),
	};
});