import { afterEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { AssetId } from '../../../../src/domain/asset/AssetId';
import type { PlanId } from '../../../../src/domain/plan/PlanId';
import type { ProjectId } from '../../../../src/domain/project/ProjectId';
import type { ZoneId } from '../../../../src/domain/zone/ZoneId';
import { expectDefined, expectFound, expectOk } from '../../../helpers/domain';
import { makeZone } from '../../../helpers/entities';
import { parseFrontmatter } from '../../../helpers/vault';
import { openFixtureVault, type FixtureStack } from '../../../helpers/fixtureVault';

let open: FixtureStack | null = null;
afterEach(() => {
	open?.dispose();
	open = null;
});

/** Every file under a directory, as vault-relative path → bytes. The whole tree, not a list of expected names. */
function snapshot(root: string): Map<string, string> {
	const files = new Map<string, string>();
	const walk = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) walk(path);
			else files.set(relative(root, path).replaceAll('\\', '/'), readFileSync(path, 'latin1'));
		}
	};
	walk(root);
	return files;
}

/**
 * BP-11 Action 4, first clause, through the DISK-BACKED stack: opening notes and sidecars
 * written at versions below what this build writes leaves every byte of the vault as it was.
 * Each read is asserted to SUCCEED at the legacy version first, so a case whose read quietly
 * refused could not pass on bytes it never reached.
 *
 * - `unreadable-zone` (nothing planted in it): a Plan note at `schema-version: 1` (this build
 *   reads through 12 and lifts it in memory by eleven discriminator steps), two Zone notes at
 *   1 (lifted to 2), and a plan geometry sidecar at `schemaVersion: 1` (lifted to 16).
 * - `valid-project`: an Asset note at 1 and an asset geometry sidecar at `schemaVersion: 1`,
 *   which `AssetGeometrySchema` raises to 2 in memory and every WRITE stamps as 2.
 */
describe('opening a legacy vault rewrites nothing', () => {
	it('leaves a v1 plan, its zones and its v1 sidecar byte-identical after they are read', async () => {
		open = await openFixtureVault('unreadable-zone');
		const before = snapshot(open.root);
		open.rebuildIndex();

		expectFound(await open.projects.getById('proj-unreadable' as ProjectId));
		expect(expectFound(await open.plans.getById('plan-ground' as PlanId)).entity.name).toBe('Ground');
		expect(expectOk(await open.plans.listByProject('proj-unreadable' as ProjectId)).loaded).toHaveLength(1);
		expect(expectFound(await open.zones.getById('kitchen' as ZoneId)).entity.locked).toBe(false);
		expect(expectOk(await open.zones.listByPlan('plan-ground' as PlanId)).loaded).toHaveLength(2);
		expect(expectOk(await open.store.read('plan-ground' as PlanId)).dto.objects).toHaveLength(2);

		expect(snapshot(open.root)).toEqual(before);
	});

	it('leaves a v1 asset note and its v1 geometry sidecar byte-identical after they are read', async () => {
		open = await openFixtureVault('valid-project');
		const before = snapshot(open.root);
		open.rebuildIndex();

		expect(expectFound(await open.assets.getById('asset-designed' as AssetId)).entity.name).toBe('Base cabinet 600');
		expect(expectOk(await open.assetGeometry.read('asset-designed' as AssetId)).dto.schemaVersion).toBe(2);

		expect(snapshot(open.root)).toEqual(before);
	});

	/**
	 * The instrument, driven against the thing it exists to see: a real WRITE through the same
	 * stack and the same clone is visible to `snapshot`, so the two cases above are not green
	 * because the comparison reaches nothing. It also pins the write half of "no gratuitous
	 * bump": an unlocked v1 zone saved by this build is still written at 1, with the body a
	 * person added above the save still there.
	 */
	it('sees a real write, and a saved v1 zone keeps version 1 and its human-written body', async () => {
		open = await openFixtureVault('unreadable-zone');
		open.rebuildIndex();
		const read = expectFound(await open.zones.getById('kitchen' as ZoneId));
		const notePath = 'Zones/Kitchen.md';
		const note = expectDefined(open.vault.getAbstractFileByPath(notePath), 'kitchen note') as never;
		await open.vault.modify(note, `${await open.vault.read(note)}\nA sentence somebody wrote.\n`);
		open.metadataCache.catchUp();
		const before = snapshot(open.root);

		const renamed = makeZone({ ...read.entity, id: read.entity.id, name: 'Kitchen (renamed)' });
		expectOk(await open.zones.save(renamed, expectFound(await open.zones.getById(read.entity.id)).version));

		const after = snapshot(open.root);
		const changed = [...after.keys()].filter((path) => after.get(path) !== before.get(path));
		expect(changed).toContain(notePath);
		const saved = parseFrontmatter(expectDefined(after.get(notePath), 'saved note'));
		expect(saved.frontmatter).toMatchObject({ 'schema-version': 1, name: 'Kitchen (renamed)' });
		expect(saved.body).toContain('A sentence somebody wrote.');
	});
});
