import { describe, expect, it } from 'vitest';
import { currencyOf } from '../../../../src/core/money/Money';
import { createRepositoryStack, serializeFrontmatter } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makeAsset as makeAssetEntity, makePlan as makePlanEntity, makeProject as makeProjectEntity, makeZone as makeZoneEntity } from '../../../helpers/entities';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { VaultChangeAdapter } from '../../../../src/infrastructure/persistence/index/VaultChangeAdapter';
import { buildProjectIndexEntries } from '../../../../src/infrastructure/persistence/index/buildProjectIndexEntries';
import { parsePersisted } from '../../../../src/infrastructure/persistence/mappers/parse';
import {
	projectFromPersistence,
} from '../../../../src/infrastructure/persistence/mappers/projectMapper';
import {
	planFromPersistence,
} from '../../../../src/infrastructure/persistence/mappers/planMapper';
import { zoneFromPersistence } from '../../../../src/infrastructure/persistence/mappers/zoneMapper';
import { fileStatAt } from '../../../../src/infrastructure/obsidian/repositories/noteIo';
import { z } from 'zod';

/**
 * Negative-path coverage for the vault-change pipeline and the mappers' early returns —
 * the arms that only fire when a file is foreign, malformed, or moved.
 */

function adapterOf(stack: ReturnType<typeof createRepositoryStack>): VaultChangeAdapter {
	return new VaultChangeAdapter({
		vault: stack.vault as never,
		metadataCache: stack.metadataCache as never,
		index: stack.index,
		echo: stack.echo,
		logger: stack.logger,
		// A real bus with no subscribers: the pipeline announces every entry it changes, and
		// a fake that accepted no publish would be thinner than the port it stands for.
		events: createEventBus(() => undefined),
		debounceMs: 0,
	});
}

async function seed(stack: ReturnType<typeof createRepositoryStack>) {
	const projectId = createProjectId();
	const planId = createPlanId();
	expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
	expectOk(await stack.plans.save(makePlanEntity({ id: planId, projectId }), 'absent'));
	return { projectId, planId };
}

describe('pipeline negatives', () => {
	/**
	 * What `processPath`'s "not a note" arm actually models, now that slice 18 has deleted
	 * the folder bound this case used to be named for: a path with NO FILE behind it that the
	 * index does not hold either — a delete Obsidian raised for a file this plugin never
	 * indexed, or a debounced event whose file was gone by the time the queue drained.
	 * Nothing resolves, there is no entry to remove, and the index must be left alone.
	 *
	 * The previous name, 'ignores markdown files outside the project folder entirely', stated
	 * precisely the bound slice 18 removed, and the case was green only because its fixture
	 * was never written into the vault at all — so it took this arm rather than the location
	 * rule it claimed. A note of ours in `Elsewhere/` IS indexed now, which
	 * `pipeline.test.ts`'s 'indexes a note of ours created outside the configured folder'
	 * asserts head-on; nothing is re-asserted here.
	 */
	it('an event for a path with no file behind it leaves the index untouched', async () => {
		const stack = createRepositoryStack();
		await seed(stack);
		const adapter = adapterOf(stack);
		// Against a POPULATED index, so "untouched" is a claim with something to lose: the
		// empty index the old case compared could not tell a no-op from a wipe.
		expect(stack.index.entries().length).toBeGreaterThan(0);
		const before = JSON.stringify(stack.index.entries());

		adapter.onModify({ path: 'Renovation/Plans/Vanished.md', stat: {} } as never);
		adapter.flush();
		expect(JSON.stringify(stack.index.entries())).toBe(before);
	});

	it('renaming an unindexed note just processes the new path', async () => {
		const stack = createRepositoryStack();
		await seed(stack);
		const adapter = adapterOf(stack);

		stack.vault.entries.set('Renovation/Zones/Fresh.md', 'plain text, not ours');
		adapter.onRename(stack.vault.getAbstractFileByPath('Renovation/Zones/Fresh.md') as never, 'Renovation/Zones/Old.md');
		adapter.flush();

		// Not our type → no entry; nothing crashed.
		expect(stack.index.entries().find((entry) => entry.path === 'Renovation/Zones/Fresh.md')).toBeUndefined();
	});

	it('an rpgeo whose basename names no plan is diagnosed, wherever it sits', async () => {
		// The pipeline's bound is no longer a folder prefix — a sidecar's plan id is its
		// basename (ADR-011), so a stray file gets the same diagnostic whether it sits
		// beside the configured Geometry folder or somewhere else entirely.
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const adapter = adapterOf(stack);

		stack.vault.entries.set('Renovation/Stray.rpgeo', '{}');
		const warnsBefore = stack.logged.length;
		adapter.onModify(stack.vault.getAbstractFileByPath('Renovation/Stray.rpgeo') as never);
		adapter.flush();
		expect(
			stack.logged.slice(warnsBefore).some((line) => line.event === 'persistence.pipeline.sidecar-skipped'),
		).toBe(true);

		// An orphan under a second root gets the identical diagnostic instead of a guessed
		// mapping.
		const orphanPath = `Elsewhere/Geometry/${createPlanId()}.rpgeo`;
		stack.vault.entries.set(orphanPath, '{}');
		adapter.onModify(stack.vault.getAbstractFileByPath(orphanPath) as never);
		adapter.flush();
		expect(stack.logged.some((line) => line.event === 'persistence.pipeline.sidecar-skipped')).toBe(true);
		expect(stack.index.getGeometrySidecarPath(planId)).toContain('.rpgeo');
	});

	/**
	 * An ASSET's sidecar arriving out of band, which this door used to call an orphan.
	 *
	 * `processSidecar` recovers an id from the basename and asks the index for it (ADR-011).
	 * For an asset that lookup SUCCEEDS — the id is a real catalogue entry — and the type test
	 * below it then reported `reason: 'no indexed plan carries this id'`, which is false twice
	 * over: an indexed ASSET carries it, and nothing about the file is wrong. Every hand move,
	 * every sync, every restore of an asset sidecar produced that line.
	 *
	 * Silence rather than a corrected warning, because there is no INDEX WORK here: ADR-0014
	 * gives an asset's sidecar one derived home, so no mapping is stored for it and none can go
	 * stale. What the ADR ALSO asks for — resolution through the index, as plans have — is not
	 * built, and is recorded as a residual in this increment's plan rather than left implied by
	 * a diagnostic nobody can act on.
	 *
	 * **Silence in the LOG only, which this case is about, and not silence at the event bus.**
	 * An earlier version of this paragraph said "nothing here to do", conflating the two, and
	 * that reading was the defect: a designer showing the asset still has to hear its shape
	 * moved. `announcements.test.ts`'s sidecar cases are where the announcement is asserted.
	 *
	 * The genuine orphan above keeps its warning, which is what stops this from being a
	 * silencing: measured, returning early for every non-plan entry leaves that case green
	 * only because a stray `.rpgeo` resolves to no entry at all.
	 */
	it('says nothing about an asset sidecar arriving out of band, since nothing is wrong with it', async () => {
		const stack = createRepositoryStack();
		await seed(stack);
		const assetId = createAssetId();
		expectOk(await stack.assets.save(makeAssetEntity({ id: assetId }), 'absent'));
		const adapter = adapterOf(stack);

		// Written straight into the vault rather than through the store, so the echo window
		// does not know it — an echoed path returns two lines earlier and would pass here
		// whatever the type test did.
		const sidecarPath = `${stack.libraryFolder}/Geometry/${assetId}.rpgeo`;
		stack.vault.entries.set(sidecarPath, '{}');
		const before = stack.logged.length;
		adapter.onModify(stack.vault.getAbstractFileByPath(sidecarPath) as never);
		adapter.flush();

		expect(
			stack.logged.slice(before).some((line) => line.event === 'persistence.pipeline.sidecar-skipped'),
		).toBe(false);
	});

	/**
	 * A sidecar deleted OUT OF BAND — the file explorer, a sync client — must clear the
	 * index mapping rather than re-affirm a path that is gone. Leaving it would break every
	 * Zone read on that Plan with no future event to repair it: the sidecar path lives only
	 * in this index, so nothing else would ever notice.
	 *
	 * Fired twice on purpose. The second pass is the arm where the mapping has ALREADY been
	 * cleared, which must forget the echo and leave the entry alone instead of upserting a
	 * second time.
	 */
	it('a sidecar deleted out of band clears the mapping, and a repeat is a no-op', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const adapter = adapterOf(stack);
		const sidecarPath = stack.index.getGeometrySidecarPath(planId) ?? '';
		expect(sidecarPath).toContain('.rpgeo');

		stack.vault.entries.delete(sidecarPath);
		adapter.onDelete({ path: sidecarPath } as never);
		adapter.flush();

		expect(stack.index.getGeometrySidecarPath(planId)).toBeUndefined();
		// The note entry itself is untouched — a sidecar event never moves it.
		expect(stack.index.getPath(planId)).toBeDefined();

		adapter.onDelete({ path: sidecarPath } as never);
		adapter.flush();
		expect(stack.index.getGeometrySidecarPath(planId)).toBeUndefined();
		expect(stack.index.getPath(planId)).toBeDefined();
	});

	it('a note that loses its frontmatter loses its index entry (with diagnostic)', async () => {
		const stack = createRepositoryStack();
		const { projectId } = await seed(stack);
		const adapter = adapterOf(stack);
		const path = stack.index.getPath(projectId) ?? '';

		stack.vault.entries.set(path, 'just prose now');
		adapter.onModify(stack.vault.getAbstractFileByPath(path) as never);
		adapter.flush();

		expect(stack.index.getPath(projectId)).toBeUndefined();
	});

	/**
	 * The other half of the note-identity defect, at the end that stops the stale entry
	 * EXISTING rather than the end that stops it being believed. `existing` is found by PATH,
	 * so a note whose `id` a user rewrites arrives here as an upsert of the NEW id while the
	 * old id's entry goes on pointing at the same file — and every read resolves through the
	 * index, so that entry then served this note under an id it no longer declares.
	 *
	 * The `!== 'ours'` arm three lines above has removed such an entry since the pipeline was
	 * written ("if it USED to be [ours], it changed into something we cannot index"); a note
	 * that stayed ours and changed WHICH entity it is was the case that arm does not cover.
	 *
	 * This is not the guard and does not replace it: it is one vault event late by
	 * construction, does not fire at all for an edit made while Obsidian is closed, and the
	 * index is rebuilt from scratch at every load anyway. `openNoteById`'s comparison is what
	 * is fail-closed. What this buys is that the refusal is TRANSIENT — once the pipeline has
	 * seen the edit, the old id reads as genuinely absent instead of refusing forever.
	 */
	it('a note whose id is rewritten loses the OLD id\'s entry rather than keeping a stale one', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const adapter = adapterOf(stack);
		const path = stack.index.getPath(planId) ?? '';

		const text = stack.vault.entries.get(path) ?? '';
		stack.vault.entries.set(path, text.replace(/^id: "[^"]*"/m, 'id: "01JPLANSOMEBODYELSE0000000"'));
		adapter.onModify(stack.vault.getAbstractFileByPath(path) as never);
		adapter.flush();

		// The stale entry is gone...
		expect(stack.index.getPath(planId)).toBeUndefined();
		// ...and the note is indexed under what it now declares, at the same path.
		expect(stack.index.getPath('01JPLANSOMEBODYELSE0000000' as never)).toBe(path);
	});

	it('a note of ours without a readable id is excluded with a diagnostic', async () => {
		const stack = createRepositoryStack();
		const { planId, projectId } = await seed(stack);
		const adapter = adapterOf(stack);
		const path = stack.index.getPath(planId) ?? '';

		const text = stack.vault.entries.get(path) ?? '';
		stack.vault.entries.set(
			path,
			text.replace(/id: "[^"]*"/, 'id: ""'),
		);
		adapter.onModify(stack.vault.getAbstractFileByPath(path) as never);
		adapter.flush();

		expect(stack.index.getPath(planId)).toBeUndefined();
		// The name says "with a diagnostic" and nothing used to assert one — the same
		// name-outruns-its-assertions defect this round is closing in the scan case below.
		expect(
			stack.logged.some(
				(line) => line.event === 'persistence.pipeline.note-excluded' && line.context?.['path'] === path,
			),
		).toBe(true);
		void projectId;
	});

});

describe('index builder negatives', () => {
	/**
	 * The idless fixture used to sit at `Elsewhere/x.md` and the case was named for the
	 * LOCATION, which slice 18 stopped being a bound: give that note an id and it is indexed
	 * where it sits, so the case passed on the missing-`id` rule while claiming to prove a
	 * folder one. It sits under `Renovation/` now, which says plainly that the id is the whole
	 * reason it is skipped.
	 *
	 * The two SCAN-side diagnostics are ASSERTED here rather than merely produced — this is
	 * the only case in the suite that ASSERTS either, which is a narrower claim than
	 * "reaches", and the difference is a real case: `pipeline.test.ts`'s "excludes a malformed
	 * note with a diagnostic" rebuilds the index over an id-less note and therefore reaches
	 * `persistence.index.note-excluded`, but asserts only that at least one `persistence.*`
	 * warning was logged, never which. `entityRef.test.ts` unit-tests
	 * `entityRefOf`'s no-id verdict, not `collectNotes`'s warn arm, and the orphan-sidecar
	 * warning `branches.test.ts` drives is the PIPELINE door's, under its own event name.
	 */
	it('skips a plain note and a foreign one, and diagnoses an idless note and an orphan sidecar', async () => {
		const stack = createRepositoryStack();
		await seed(stack);

		stack.vault.entries.set('Renovation/idless.md', '---\ntype: renovation-project\n---\n');
		stack.vault.entries.set('Renovation/plain.md', 'no frontmatter here');
		stack.vault.entries.set('Renovation/foreign.md', '---\ntype: something-else\nid: "x"\n---\n');
		const orphanSidecar = `Renovation/Geometry/${createPlanId()}.rpgeo`;
		stack.vault.entries.set(orphanSidecar, '{}');

		const { entries } = buildProjectIndexEntries({
			vault: stack.vault as never,
			metadataCache: stack.metadataCache as never,
			echo: stack.echo,
			logger: stack.logger,
		});

		expect(entries.some((entry) => entry.path === 'Renovation/idless.md')).toBe(false);
		expect(entries.some((entry) => entry.path === 'Renovation/plain.md')).toBe(false);
		expect(entries.some((entry) => entry.path === 'Renovation/foreign.md')).toBe(false);

		// A note of OURS that cannot be indexed is a diagnostic; a foreign note is silent and
		// correct, which is the distinction `EntityRef`'s third case exists for.
		const excluded = stack.logged.find((line) => line.event === 'persistence.index.note-excluded');
		expect(excluded?.context?.['path']).toBe('Renovation/idless.md');
		expect(
			stack.logged.some(
				(line) => line.event === 'persistence.index.note-excluded' && line.context?.['path'] === 'Renovation/foreign.md',
			),
		).toBe(false);

		const skipped = stack.logged.find((line) => line.event === 'persistence.index.sidecar-skipped');
		expect(skipped?.context?.['path']).toBe(orphanSidecar);
	});
});

/**
 * Two notes carrying one id is a state Obsidian's own "Duplicate file" command produces in
 * one click, and a sync conflict copy produces without asking. The index is keyed by id, so
 * one of the two is unreachable either way — the diagnostic is the whole remedy, and both
 * halves of the index (the full scan and the incremental pipeline) have to give it.
 */
describe('duplicate frontmatter ids', () => {
	it('the scan indexes one note and warns about the other', async () => {
		const stack = createRepositoryStack();
		const { projectId } = await seed(stack);
		const original = stack.index.getPath(projectId) ?? '';
		const copyPath = 'Renovation/Kitchen renovation 1.md';
		stack.vault.entries.set(copyPath, stack.vault.entries.get(original) ?? '');

		const { entries } = buildProjectIndexEntries({
			vault: stack.vault as never,
			metadataCache: stack.metadataCache as never,
			echo: stack.echo,
			logger: stack.logger,
		});

		// One entry for the id, and a warning naming BOTH paths — a diagnostic that named
		// only the loser would not tell a user which file to open.
		expect(entries.filter((entry) => entry.id === projectId)).toHaveLength(1);
		const warning = stack.logged.find((line) => line.event === 'persistence.index.duplicate-id');
		expect(warning?.context?.['otherPath']).toBeDefined();
		expect(warning?.context?.['path']).toBeDefined();
	});

	it('the pipeline warns when an arriving note claims an id another live note holds', async () => {
		const stack = createRepositoryStack();
		const { projectId } = await seed(stack);
		const adapter = adapterOf(stack);
		const original = stack.index.getPath(projectId) ?? '';
		const copyPath = 'Renovation/Kitchen renovation 1.md';
		stack.vault.entries.set(copyPath, stack.vault.entries.get(original) ?? '');

		adapter.onCreate(stack.vault.getAbstractFileByPath(copyPath) as never);
		adapter.flush();

		expect(stack.logged.some((line) => line.event === 'persistence.pipeline.duplicate-id')).toBe(true);
		// Semantics unchanged: last writer still wins, so the copy now holds the id.
		expect(stack.index.getPath(projectId)).toBe(copyPath);
	});

	it('a note relocated with no rename event is a MOVE, not a duplicate', async () => {
		const stack = createRepositoryStack();
		const { projectId } = await seed(stack);
		const adapter = adapterOf(stack);
		const original = stack.index.getPath(projectId) ?? '';
		const movedTo = 'Renovation/Moved by sync.md';

		// What a sync client does: the note appears at the new path and is GONE from the old
		// one. The index still points at the old path, which is what makes this look like a
		// duplicate until the existence of the old file is actually checked.
		stack.vault.entries.set(movedTo, stack.vault.entries.get(original) ?? '');
		stack.vault.entries.delete(original);

		adapter.onCreate(stack.vault.getAbstractFileByPath(movedTo) as never);
		adapter.flush();

		expect(stack.logged.some((line) => line.event === 'persistence.pipeline.duplicate-id')).toBe(false);
		expect(stack.index.getPath(projectId)).toBe(movedTo);
	});
});

/**
 * Two `.rpgeo` files can share a basename the same way two notes can share an id: a user
 * copying a whole project folder as a backup — the "moves, backs up and deletes as one
 * unit" property ADR-0013 celebrates — produces a second sidecar naming the same plan id.
 * Neither the scan nor the pipeline has a folder prefix left to keep the two apart, so the
 * copy is reachable from an ordinary backup rather than only from a deliberately crafted
 * vault.
 *
 * A warning alone is not enough on either side: the mapping is what every geometry WRITE
 * resolves through, so a repointed mapping sends the live plan's zones into the backup and
 * leaves the file the user is looking at frozen. Both doors keep the sidecar the project
 * folder DERIVES (ADR-0011: derivability is the repair path for a damaged index), which is
 * the same answer whichever order the two files are reached in.
 */
describe('duplicate sidecar basenames', () => {
	it('the scan keeps the derived sidecar, in either order, and warns about the other', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const original = stack.index.getGeometrySidecarPath(planId) ?? '';
		const backupPath = original.replace('Renovation/', 'Renovation Backup/');
		const text = stack.vault.entries.get(original) ?? '';
		const scan = (): ReturnType<typeof buildProjectIndexEntries> =>
			buildProjectIndexEntries({
				vault: stack.vault as never,
				metadataCache: stack.metadataCache as never,
				echo: stack.echo,
				logger: stack.logger,
			});

		// The diagnostic is asked for AFTER each scan against a cleared recorder, because a
		// shared one answers the second question with the first scan's line — which is how
		// this case once asserted "either way" while reading one order twice.
		const reportOf = (): Record<string, unknown> => {
			stack.logged.length = 0;
			const { entries } = scan();
			expect(entries.find((entry) => entry.id === planId)?.geometrySidecarPath).toBe(original);
			const warning = stack.logged.find((line) => line.event === 'persistence.index.sidecar-duplicate');
			expect(warning).toBeDefined();
			return warning?.context ?? {};
		};

		// `getFiles()` answers in insertion order, so this pair of scans is the pair of scan
		// orders: the copy reached last, then the copy reached first. Obsidian promises no
		// order at all, which is why both have to report.
		stack.vault.entries.set(backupPath, text);
		const copyLast = reportOf();

		stack.vault.entries.delete(original);
		stack.vault.entries.set(original, text);
		const copyFirst = reportOf();

		// Which of the two is `path` and which is `otherPath` follows the order — `path` is
		// always the one that arrived. What must not follow the order is WHICH FILES are named,
		// which sidecar is kept, or whether a line is emitted at all.
		for (const report of [copyLast, copyFirst]) {
			expect([report['path'], report['otherPath']].toSorted()).toEqual([backupPath, original].toSorted());
			expect(report['derivedPath']).toBe(original);
			expect(report['kept']).toBe(original);
		}
		expect(copyLast['path']).toBe(backupPath);
		expect(copyFirst['path']).toBe(original);
	});

	it('a sidecar re-affirming the path already mapped is not a duplicate', () => {
		// One `.rpgeo` in the vault, edited out of band. The mapping it re-affirms is its own,
		// so there is nothing to adjudicate and nothing to report — a line naming one file as
		// both `path` and `otherPath` is a duplicate that does not exist, and a user acts on it.
		const stack = createRepositoryStack();
		const sidecar = 'Loose/Geometry/pl-solo.rpgeo';
		stack.vault.entries.set(
			'Loose/Ground.md',
			serializeFrontmatter({ type: 'renovation-plan', id: 'pl-solo', 'schema-version': 1 }),
		);
		stack.vault.entries.set(sidecar, '{}');
		stack.rebuildIndex();
		stack.logged.length = 0;

		adapterOf(stack).onModify(stack.vault.getAbstractFileByPath(sidecar) as never);

		expect(stack.logged.filter((line) => line.event === 'persistence.pipeline.sidecar-duplicate')).toEqual([]);
		expect(stack.index.getGeometrySidecarPath('pl-solo' as never)).toBe(sidecar);
	});

	it('a plan declaring no project keeps the sidecar it holds, and the line says so', () => {
		// Nothing to derive from at all (no `project:` in the frontmatter), as distinct from the
		// case below, where a project IS declared and simply is not indexed. Both keep what is
		// held; both still report; `derivedPath` is what tells a reader which situation this is.
		const stack = createRepositoryStack();
		stack.vault.entries.set(
			'Loose/Ground.md',
			serializeFrontmatter({ type: 'renovation-plan', id: 'pl-rootless', 'schema-version': 1 }),
		);
		stack.vault.entries.set('Loose/Geometry/pl-rootless.rpgeo', '{}');
		stack.vault.entries.set('Loose Backup/Geometry/pl-rootless.rpgeo', '{}');

		const { entries } = buildProjectIndexEntries({
			vault: stack.vault as never,
			metadataCache: stack.metadataCache as never,
			echo: stack.echo,
			logger: stack.logger,
		});

		expect(entries.find((entry) => entry.id === 'pl-rootless')?.geometrySidecarPath).toBe(
			'Loose/Geometry/pl-rootless.rpgeo',
		);
		const warning = stack.logged.find((line) => line.event === 'persistence.index.sidecar-duplicate');
		expect(warning?.context?.['kept']).toBe('Loose/Geometry/pl-rootless.rpgeo');
		expect(warning?.context?.['derivedPath']).toBeUndefined();
	});

	it('the scan keeps the first sidecar when no project folder can derive one', () => {
		// A plan whose project note is not in the vault: nothing can say which of the two
		// files is canonical, so the arriving duplicate does not displace the mapping that
		// is already held — first scanned wins, warned, rather than a silent repoint.
		const stack = createRepositoryStack();
		stack.vault.entries.set(
			'Loose/Ground.md',
			serializeFrontmatter({ type: 'renovation-plan', id: 'pl-loose', project: 'project-gone', 'schema-version': 1 }),
		);
		stack.vault.entries.set('Loose/Geometry/pl-loose.rpgeo', '{}');
		stack.vault.entries.set('Loose Backup/Geometry/pl-loose.rpgeo', '{}');

		const { entries } = buildProjectIndexEntries({
			vault: stack.vault as never,
			metadataCache: stack.metadataCache as never,
			echo: stack.echo,
			logger: stack.logger,
		});

		expect(entries.find((entry) => entry.id === 'pl-loose')?.geometrySidecarPath).toBe(
			'Loose/Geometry/pl-loose.rpgeo',
		);
		const warning = stack.logged.find((line) => line.event === 'persistence.index.sidecar-duplicate');
		expect(warning?.context?.['kept']).toBe('Loose/Geometry/pl-loose.rpgeo');
		expect(warning?.context?.['derivedPath']).toBeUndefined();
	});

	it('the pipeline keeps the live mapping when a copied sidecar arrives beside it', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const adapter = adapterOf(stack);
		const original = stack.index.getGeometrySidecarPath(planId) ?? '';
		const backupPath = original.replace('Renovation/', 'Renovation Backup/');
		stack.vault.entries.set(backupPath, stack.vault.entries.get(original) ?? '');

		adapter.onCreate(stack.vault.getAbstractFileByPath(backupPath) as never);
		adapter.flush();

		expect(stack.index.getGeometrySidecarPath(planId)).toBe(original);
		const warning = stack.logged.find((line) => line.event === 'persistence.pipeline.sidecar-duplicate');
		expect(warning?.context?.['path']).toBe(backupPath);
		expect(warning?.context?.['otherPath']).toBe(original);
		expect(warning?.context?.['derivedPath']).toBe(original);
		expect(warning?.context?.['kept']).toBe(original);

		// And deleting the copy again takes nothing with it. The delete arm's path-equality
		// guard was always right; what made it clear the mapping was the repoint above it.
		stack.vault.entries.delete(backupPath);
		adapter.onDelete({ path: backupPath } as never);
		expect(stack.index.getGeometrySidecarPath(planId)).toBe(original);
	});

	it('a project folder copied wholesale leaves the original geometry mapping alone', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const adapter = adapterOf(stack);
		const original = stack.index.getGeometrySidecarPath(planId) ?? '';
		const folder = original.slice(0, original.indexOf('/Geometry/'));

		// Every file of the project, copied, and delivered in the order a directory walk
		// produces: `Geometry/` sorts ahead of the note that would repoint the plan entry,
		// so the sidecar arrives while the index still points at the live project.
		const copies = [...stack.vault.entries]
			.filter(([path]) => path.startsWith(`${folder}/`))
			.map(([path, text]): [string, string] => [path.replace(folder, `${folder} backup`), text])
			.toSorted(([left], [right]) => left.localeCompare(right));
		for (const [path, text] of copies) stack.vault.entries.set(path, text);
		stack.metadataCache.catchUp();
		for (const [path] of copies) adapter.onCreate({ path } as never);
		adapter.flush();

		expect(copies.map(([path]) => path)).toContain(original.replace(folder, `${folder} backup`));
		expect(stack.index.getGeometrySidecarPath(planId)).toBe(original);
		// The copied NOTES are a duplicate-id finding and still take the index over — that
		// is slice 18's warned, deliberate last-writer-wins, and this fix does not touch it.
		// What it stops is the geometry mapping following them silently. Measured rather
		// than assumed, and it is why `sidecarMappingFor` promises agreement of the two
		// halves for the SCAN and not for a live copy: mid-copy the note entry has moved to
		// the backup while the mapping has not, and the next full scan is what reconciles
		// them (it resolves every note before it joins a single sidecar).
		expect(stack.logged.some((line) => line.event === 'persistence.pipeline.duplicate-id')).toBe(true);
		expect(stack.index.getPath(planId)?.startsWith(`${folder} backup/`)).toBe(true);
	});
});

describe('mapper parse failures return before construction', () => {
	it('project mapper refuses schema-invalid raw frontmatter', () => {
		expect(projectFromPersistence({ type: 'renovation-project' }, currencyOf('EUR')).ok).toBe(false);
	});

	it('plan mapper refuses schema-invalid raw frontmatter', () => {
		expect(planFromPersistence({ type: 'renovation-plan' }, null).ok).toBe(false);
	});

	it('zone mapper refuses broken frontmatter before touching geometry', () => {
		expect(zoneFromPersistence({ type: 'renovation-zone' }, { id: 'z', type: 'polygon', points: [] }).ok).toBe(false);
	});

	it('parsePersisted labels root-level failures', () => {
		const error = expectErr(parsePersisted(z.string(), 42, 'test.root', 'Fixture'));
		expect(error.message).toContain('(root)');
	});
});

/**
 * Reported from a real vault: creating the sample project worked, and logged
 * `persistence.pipeline.sidecar-skipped … no indexed plan carries this id` while doing it.
 *
 * Nothing was wrong. `ObsidianPlanRepository.insertNew` writes the SIDECAR first, then the
 * note, then upserts the index — so between the sidecar's `create` event and the plan
 * becoming indexed there is a window of a few milliseconds, and the pipeline's 500ms
 * debounce can land inside it when a seed is doing many sequential writes. The pipeline was
 * right to do nothing; it was wrong to shout, and a diagnostic that fires on correct
 * behaviour is one people learn to ignore.
 *
 * The cause is an asymmetry: `processNote` asks the `EchoWindow` whether this plugin wrote
 * the file before acting on it, and `processSidecar` did not ask at all.
 */
describe('a sidecar whose plan is still being written', () => {
	it('says nothing about a sidecar this plugin just wrote', async () => {
		const stack = createRepositoryStack();
		await seed(stack);
		const adapter = adapterOf(stack);

		// The in-flight window, built exactly: the sidecar exists and this plugin has marked
		// it, and the plan it belongs to is NOT indexed yet — which is the state
		// `insertNew` is in between its first write and its `index.upsert`.
		const pendingPlanId = createPlanId();
		const pendingPath = `Renovation/Geometry/${pendingPlanId}.rpgeo`;
		stack.vault.entries.set(pendingPath, '{}');
		// The STAT with it, because that is the state `createLocked` really leaves: the echo
		// window recognises a sidecar of ours by identity now — "is the file still the one we
		// wrote" — rather than by having heard of the path. Marking without one would build a
		// window thinner than the writer's, and this case would then pass or fail for a reason
		// the vault it stands for cannot produce.
		stack.echo.mark(
			pendingPath,
			'whatever-this-plugin-wrote' as never,
			fileStatAt(stack.vault as never, pendingPath),
		);
		expect(stack.index.getPath(pendingPlanId)).toBeUndefined();

		const before = stack.logged.length;
		adapter.onCreate(stack.vault.getAbstractFileByPath(pendingPath) as never);
		adapter.flush();

		expect(stack.logged.slice(before)).toHaveLength(0);
	});

	/**
	 * The path echo suppression left as the ONLY way to reach the mapping upsert, and the
	 * scenario it exists for: a sidecar this session did not write, for a plan that IS here.
	 * A sync client delivering a sidecar after a restart is the real case — the echo is
	 * empty on a fresh session, so nothing suppresses it and the mapping is affirmed.
	 */
	it('maps a sidecar this session did not write onto the plan that claims it', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const adapter = adapterOf(stack);
		const sidecarPath = stack.index.getGeometrySidecarPath(planId) ?? '';

		// Drop the mapping AND the echo record — a session that never wrote this file, which
		// is what every session after a restart is.
		const entry = stack.index.entries().find((candidate) => candidate.id === planId);
		stack.index.upsert({ ...entry, geometrySidecarPath: undefined } as never);
		stack.echo.forget(sidecarPath);
		expect(stack.index.getGeometrySidecarPath(planId)).toBeUndefined();

		const before = stack.logged.length;
		adapter.onCreate(stack.vault.getAbstractFileByPath(sidecarPath) as never);
		adapter.flush();

		expect(stack.index.getGeometrySidecarPath(planId)).toBe(sidecarPath);
		expect(stack.logged.slice(before)).toHaveLength(0);
	});

	/**
	 * And the diagnostic still fires for what it was added for: a sidecar in the geometry
	 * folder that this plugin did NOT write and no indexed plan claims — a leftover file, or
	 * one a sync brought in for a plan that is not here.
	 */
	it('still reports a sidecar nothing wrote and no plan claims', async () => {
		const stack = createRepositoryStack();
		await seed(stack);
		const adapter = adapterOf(stack);

		const orphanPath = `Renovation/Geometry/${createPlanId()}.rpgeo`;
		stack.vault.entries.set(orphanPath, '{}');
		adapter.onCreate(stack.vault.getAbstractFileByPath(orphanPath) as never);
		adapter.flush();

		expect(stack.logged.some((line) => line.event === 'persistence.pipeline.sidecar-skipped')).toBe(true);
	});
});

/**
 * SDD §92 item 13's "not the whole plugin" half, at the one place a whole vault is read at
 * once. `buildProjectIndexEntries` never reads `schema-version` and never runs the
 * migration runner: a note from a newer build is indexed exactly like its neighbours and
 * refuses only when something OPENS it. That is what confines the refusal to one entity,
 * and it was true by inspection alone — nothing drove a poisoned note past the scan, so an
 * index builder that started dropping or throwing on one would have been a silent, total
 * load failure with every other gate green.
 */
describe('the index scan does not run the fail-closed gate', () => {
	it('indexes a future-version note beside its neighbours, and only the read refuses', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const zoneId = createZoneId();
		expectOk(await stack.zones.save(makeZoneEntity({ id: zoneId, projectId, planId }), 'absent'));
		// A vault Obsidian has already parsed: without this the notes sit inside the fake's
		// create window, where the scan reads them from the echo record — this plugin's own
		// last write, which is not what a hand edit changed.
		stack.metadataCache.catchUp();

		const poisonedPath = stack.index.getPath(planId) ?? '';
		stack.vault.entries.set(
			poisonedPath,
			(stack.vault.entries.get(poisonedPath) ?? '').replace('schema-version: 1', 'schema-version: 99'),
		);

		const { entries } = buildProjectIndexEntries({
			vault: stack.vault as never,
			metadataCache: stack.metadataCache as never,
			echo: stack.echo,
			logger: stack.logger,
		});

		// Every entry, not "most of them" — the poisoned note included.
		expect(entries.map((entry) => String(entry.id)).toSorted()).toEqual(
			[String(projectId), String(planId), String(zoneId)].toSorted(),
		);
		// And a FULL entry rather than a husk: a Plan reachable by path, of the right type,
		// still joined to its geometry sidecar. A degraded entry would leave the editor
		// unable to say anything better than "this plan no longer exists".
		const poisoned = entries.find((entry) => entry.id === planId);
		expect(poisoned?.path).toBe(poisonedPath);
		expect(poisoned?.type).toBe('renovation-plan');
		expect(poisoned?.geometrySidecarPath).toBeDefined();

		// The refusal is where it belongs — at the read of that one entity, with the rest of
		// the project loading through the very index this scan built.
		stack.index.rebuild(entries, []);
		expect(expectErr(await stack.plans.getById(planId)).code).toBe('plan.schema-version-unsupported');
		expectOk(await stack.projects.getById(projectId));
		expectOk(await stack.zones.getById(zoneId));
	});
});
