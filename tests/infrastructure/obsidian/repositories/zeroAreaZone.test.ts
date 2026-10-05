import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openFixtureVault, type FixtureStack } from '../../../helpers/fixtureVault';
import { makeDeleteZoneCommand } from '../../../helpers/slice10';
import { expectErr, expectFound, expectOk } from '../../../helpers/domain';
import { MoveSpatialObjectCommand } from '../../../../src/application/commands/zone/MoveSpatialObject';
import { RenameZoneCommand } from '../../../../src/application/commands/zone/RenameZone';
import { EditZoneDetailsCommand } from '../../../../src/application/commands/zone/EditZoneDetails';
import { groupGeometryServices } from '../../../../src/application/commands/spatial/GroupGeometryCommand';
import { SessionWriteLedger } from '../../../../src/application/editor/WriteLedger';
import { ObsidianPlanGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import type { PlanId } from '../../../../src/domain/plan/PlanId';
import type { ZoneId } from '../../../../src/domain/zone/ZoneId';

/**
 * L-23 against a vault that ALREADY holds a zero-area Room (`tests/vault/zero-area-zone/`), through
 * the real Obsidian repositories. Ruling 34: it still loads. Ruling 35: every edit that touches
 * its outline is refused until one gives it an area, and a rename, a details change, a lock and a
 * delete still pass. "Refused" is asserted as the clone's files byte-for-byte unchanged.
 */
const PLAN = 'plan-ground' as PlanId;
const SLIVER = 'sliver' as ZoneId;
const STORED = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 2000, y: 0 }];

let open: FixtureStack | null = null;
afterEach(() => { open?.dispose(); open = null; });

async function stack(): Promise<FixtureStack> {
	open = await openFixtureVault('zero-area-zone');
	open.rebuildIndex();
	return open;
}

/** Every file in the clone and its bytes, so a refusal is checked against the disk rather than a repository read. */
function files(root: string): Map<string, string> {
	const found = new Map<string, string>();
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) walk(path);
			else found.set(path, readFileSync(path, 'utf8'));
		}
	};
	walk(root);
	return found;
}

const move = (s: FixtureStack) => new MoveSpatialObjectCommand(s.zones, s.events);
const sliver = async (s: FixtureStack) => expectFound(await s.zones.getById(SLIVER));

describe('a vault holding a zone that encloses no area', () => {
	it('still loads it, exactly as stored, and refuses nothing', async () => {
		const s = await stack();
		const listed = expectOk(await s.zones.listByPlan(PLAN));
		expect(listed.refused).toBe(0);
		expect(listed.loaded.map(zone => zone.entity.id)).toEqual([SLIVER]);
		expect(listed.loaded[0]?.entity.geometry.points).toEqual(STORED);
		expect(s.ledger.issues()).toEqual([]);
	});

	it('takes an outline change that gives it an area', async () => {
		const s = await stack();
		const fixed = [...STORED.slice(0, 2), { x: 1000, y: 1000 }];
		expectOk(await move(s).execute({ zoneId: SLIVER, geometry: { points: fixed } }));
		expect((await sliver(s)).entity.geometry.points).toEqual(fixed);
	});

	describe('refuses an edit that touches its outline and leaves it without one', () => {
		it.each([
			['a body drag', { points: STORED.map(point => ({ x: point.x + 500, y: point.y + 500 })) }],
			['a caption drag, which restates the outline', { points: STORED, labelOffset: { dx: 10, dy: 20 } }],
		])('%s', async (_what, input) => {
			const s = await stack(), before = files(s.root);
			const { points, ...rest } = input;
			expect(expectErr(await move(s).execute({ zoneId: SLIVER, geometry: { points }, ...rest })).code).toBe('polygon-zero-area');
			expect(files(s.root)).toEqual(before);
		});

		it('a recolour, whose version check replays the outline through the entity', async () => {
			const s = await stack(), before = files(s.root);
			const groups = groupGeometryServices(new ObsidianPlanGeometrySidecar(s.store), s.zones, s.events);
			const baseline = expectOk(await groups.read(PLAN));
			const objects = baseline.document.objects.map(object => ({ ...object, color: 'rose' as const }));
			const recolor = groups.command({ planId: PLAN, baseline, document: { ...baseline.document, objects }, ledger: new SessionWriteLedger() });
			expect(expectErr(await recolor.execute()).code).toBe('polygon-zero-area');
			expect(files(s.root)).toEqual(before);
		});
	});

	describe('still takes what does not touch its outline, so it can be found and deleted', () => {
		it('a rename', async () => {
			const s = await stack();
			const { version } = await sliver(s);
			expectOk(await new RenameZoneCommand(s.zones, s.events).execute({ zoneId: SLIVER, name: 'Found it', expected: version }));
			expect((await sliver(s)).entity.name).toBe('Found it');
		});

		it('a details change and a lock', async () => {
			const s = await stack();
			const { version } = await sliver(s);
			const input = { zoneId: SLIVER, expected: version, inverse: { name: 'Sliver', zoneType: 'Room' as const }, forward: { name: 'Nook', zoneType: 'Room' as const, locked: true } };
			expectOk(await new EditZoneDetailsCommand(s.zones, s.events, new SessionWriteLedger(), input).execute());
			expect((await sliver(s)).entity).toMatchObject({ name: 'Nook', locked: true });
		});

		it('a delete', async () => {
			const s = await stack();
			expectOk(await makeDeleteZoneCommand(s.zones, s.events, s.requirements).execute({ zoneId: SLIVER }));
			expect(expectOk(await s.zones.getById(SLIVER))).toBeNull();
		});
	});
});
