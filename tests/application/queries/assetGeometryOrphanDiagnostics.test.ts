/**
 * `docs/tests/cases/Recover an asset design rather than lose it.md` step 30: a note deleted
 * from Obsidian's file explorer leaves its `.rpgeo` sidecar behind — `ObsidianAssetRepository
 * .delete` removes both together (`alsoRemove`), but a raw file-explorer delete never reaches
 * it, so the sidecar is orphaned — and the step's own pass condition is that the file is still
 * there, nothing told the user, nothing offered to remove it, and NO DIAGNOSTIC names it.
 *
 * Built the way the product actually builds this report: `GetDiagnosticsSnapshotQuery` over a
 * real `createRepositoryStack()` and its own `InMemoryDiagnosticsLedger`
 * (`showDiagnosticsReport.ts`'s composition, and `RenovationPlannerPlugin`'s own ledger field —
 * this is not a fixture built to look content-free, it is the real ledger a real read populates).
 * `stack.assets.listAll()` is run too, matching the vault-wide scan the asset library performs
 * after such a delete and the ONE place that already calls `ledger.record('asset', id, …)`
 * (`ObsidianAssetRepository.list`) — so this exercises the real path that WOULD have recorded
 * this asset had the index still listed it, and confirms it does not, because by the time a
 * user reaches the state step 30 describes the index has already dropped the id
 * (`stack.rebuildIndex()` stands in for the scan `VaultChangeAdapter` schedules 500 ms after a
 * real delete, which this bare repository stack does not run on its own).
 *
 * A compile-time version of this clause (`assetGeometryOrphanDiagnostics.test-d.ts`, since
 * deleted) pinned only that the LITERAL union member `'asset-geometry'` cannot be spelled at a
 * `ledger.record` call site. Review found that a proxy: `'asset'` — the kind assets already
 * record under — type-checks today, so a future "fix" that (wrongly) reports the orphan under
 * the EXISTING kind would sail straight through it. This file replaces it with a runtime check
 * of the actual OUTPUT, which does not care which kind a caller used.
 */
import { describe, expect, it } from 'vitest';
import { GetDiagnosticsSnapshotQuery } from '../../../src/application/queries/GetDiagnosticsSnapshot';
import { assetSidecarPathFor } from '../../../src/infrastructure/obsidian/repositories/paths';
import { createRepositoryStack } from '../../helpers/vault';
import { expectOk } from '../../helpers/domain';
import { makeAsset } from '../../helpers/entities';

describe('recover.md step 30 — no diagnostic names the orphaned sidecar', () => {
	it('leaves the orphan out of the real diagnostics report, though the file is still on disk', async () => {
		const stack = createRepositoryStack();
		const asset = expectOk(await stack.assets.save(makeAsset({ height: 700 }), 'absent')).entity;
		const assetId = asset.id;
		expectOk(await stack.assetGeometry.write(assetId, { calibration: null, shape: null }));
		stack.rebuildIndex();
		const sidecarPath = assetSidecarPathFor(stack.libraryFolder, assetId);
		// The PRECONDITION this clause is about: there really is an orphan to find, not an empty
		// vault this assertion would pass over vacuously.
		expect(stack.vault.entries.has(sidecarPath)).toBe(true);

		const notePath = stack.index.getPath(assetId);
		if (notePath === undefined) throw new Error('the asset note was not indexed after save');
		const noteFile = stack.vault.getAbstractFileByPath(notePath);
		if (noteFile === null) throw new Error(`no file at ${notePath} to delete`);
		// A raw vault delete, standing for the file explorer — NOT `stack.assets.delete`, which
		// would remove the sidecar too and leave nothing to be orphaned.
		await stack.vault.delete(noteFile);
		// Standing in for the scan `VaultChangeAdapter` runs 500 ms after a real delete: this bare
		// stack fires no such adapter on its own, so the settled, post-scan state has to be made
		// rather than waited for.
		stack.rebuildIndex();
		expect(stack.index.getPath(assetId)).toBeUndefined();
		// The sidecar survives the rebuild: nothing here deletes it, matching the case's own "it
		// is still there" (step 30's own A-bucket clause, `assetGeometrySidecar.test.ts`'s sibling).
		expect(stack.vault.entries.has(sidecarPath)).toBe(true);

		// The real trigger a user would hit next: opening the asset library re-lists every asset
		// the index still knows about, and `ObsidianAssetRepository.list` is the one place in
		// `src/` that already records a failed read to the ledger.
		expectOk(await stack.assets.listAll());

		const snapshot = await new GetDiagnosticsSnapshotQuery({
			versions: { pluginVersion: '0.0.0', obsidianVersion: '0.0.0' },
			latestSchemaVersions: () => stack.migrations.latestVersions,
			lastAppliedMigration: () => stack.migrations.lastApplied,
			ledger: stack.ledger,
		}).execute();

		expect(snapshot.validationIssues).toEqual([]);
		expect(snapshot.validationIssues.some((issue) => issue.entityId === assetId)).toBe(false);
	});
});
