import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createMigrationRunner } from '../../src/infrastructure/persistence/migration/MigrationRunner';
import { MIGRATION_SET } from '../../src/infrastructure/persistence/migration/migrationSet';
import { AssetGeometrySchema } from '../../src/infrastructure/persistence/dto/assetGeometry';
import { projectToPersistence } from '../../src/infrastructure/persistence/mappers/projectMapper';
import { planToPersistence } from '../../src/infrastructure/persistence/mappers/planMapper';
import { zoneToPersistence } from '../../src/infrastructure/persistence/mappers/zoneMapper';
import { requirementToPersistence } from '../../src/infrastructure/persistence/mappers/requirementMapper';
import { assetToPersistence } from '../../src/infrastructure/persistence/mappers/assetMapper';
import { assetPriceToPersistence } from '../../src/infrastructure/persistence/mappers/assetPriceMapper';
import { SUPPLIER_MAPPER, TRADE_MAPPER } from '../../src/infrastructure/persistence/mappers/namedCatalogueMapper';
import { quoteToPersistence } from '../../src/infrastructure/persistence/mappers/quoteMapper';
import { assetSidecarPathFor } from '../../src/infrastructure/obsidian/repositories/paths';
import { ContinueContextStore } from '../../src/infrastructure/obsidian/plugin-data/continueContextStore';
import { SEQUENCE_MARKER_SCHEMA_VERSION } from '../../src/application/reference/deleteResolution';
import { WRITE_INCIDENT_SCHEMA_VERSION } from '../../src/application/incidents/WriteIncident';
import { settingsFrom } from '../../src/plugin/settings/settings';
import { AssetPriceOverride } from '../../src/domain/asset-price/AssetPriceOverride';
import { createAssetPriceOverrideId } from '../../src/domain/asset-price/AssetPriceOverrideId';
import { createAssetId } from '../../src/domain/asset/AssetId';
import { createZoneId } from '../../src/domain/zone/ZoneId';
import { createTrade, type TradeId } from '../../src/domain/trade/Trade';
import { createSupplier, type SupplierId } from '../../src/domain/supplier/Supplier';
import type { QuoteId } from '../../src/domain/quote/Quote';
import { of as moneyOf } from '../../src/core/money/Money';
import { expectDefined, expectOk } from '../helpers/domain';
import { makeAsset, makePlan, makeProject, makeRequirement, makeZone } from '../helpers/entities';
import { createRepositoryStack } from '../helpers/vault';

/**
 * BP-11 Action 3: `docs/using-planning-recovery.md` § Existing vaults tabulates what this build
 * reads and writes, and this file is what keeps that table from going stale. It reads the
 * page's own tables — split on pipes and backticks, never a regular expression — and compares
 * the cells the page names as checked with the code that decides them: the migration runner for
 * Reads and the newer-version code, a plain entity through each real mapper or store for the
 * lowest Writes value, and the runner's latest version for the highest "by content" one. What a
 * "by content" row writes BETWEEN those bounds is each feature's own test's business
 * (`roomlessPlanVersions`, `zoneLockPersistence`, `elementVersions`, `itemColorWrittenSchema`, …).
 */
const PAGE = 'docs/using-planning-recovery.md';
type Row = Readonly<Record<string, string>>;

function sectionRows(): Row[] {
	const text = readFileSync(PAGE, 'utf8').replaceAll('\r\n', '\n');
	const start = text.indexOf('\n## Existing vaults\n');
	const end = text.indexOf('\n## ', start + 1);
	const rows: Row[] = [];
	let header: string[] | null = null;
	for (const line of text.slice(start, end === -1 ? undefined : end).split('\n')) {
		if (!line.startsWith('|')) {
			header = null;
			continue;
		}
		const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
		if (header === null) header = cells;
		else if (!cells.every((cell) => cell.startsWith('---'))) rows.push(Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ''])));
	}
	return rows;
}

const ticked = (cell: string | undefined): string[] => (cell ?? '').split('`').filter((_, index) => index % 2 === 1);
const rows = sectionRows();
const byKey = new Map(rows.filter((row) => row['Key']).map((row) => [ticked(row['Key'])[0], row]));
const row = (key: string): Row => expectDefined(byKey.get(key), `a table row keyed \`${key}\``);

/** `1` or `1–12`, the en dash the page uses. */
function bounds(cell: string): { low: number; high: number } {
	const [low, high = low] = cell.split(' ')[0].split('–').map(Number);
	return { low, high };
}

/** `always 2` is exact; `1–12 by content` is a range whose top is the latest version. */
function writes(cell: string): { always: boolean; low: number; high: number } {
	const always = cell.startsWith('always ');
	return { always, ...bounds(always ? cell.slice('always '.length) : cell) };
}

const project = makeProject();
const plan = makePlan({ projectId: project.id });
const assetId = createAssetId();

/** The version a PLAIN entity is written at, through the real writer — the lowest a row writes. */
const plainWrite: Readonly<Record<string, () => unknown>> = {
	project: () => projectToPersistence(project, 0)['schema-version'],
	plan: () => planToPersistence(plan, 0)['schema-version'],
	zone: () => zoneToPersistence(makeZone({ projectId: project.id, planId: plan.id }), 0)['schema-version'],
	requirement: () => requirementToPersistence(makeRequirement({ projectId: project.id, assetId, origin: { kind: 'zone', zoneId: createZoneId() } }), 0)['schema-version'],
	asset: () => assetToPersistence(makeAsset(), 0)['schema-version'],
	'asset-price': () => assetPriceToPersistence(expectOk(AssetPriceOverride.create({ id: createAssetPriceOverrideId(), projectId: project.id, assetId, unitCost: moneyOf('1', 'EUR') })), 0)['schema-version'],
	trade: () => TRADE_MAPPER.write(expectOk(createTrade('trade-a' as TradeId, 'Tiling')), 0)['schema-version'],
	supplier: () => SUPPLIER_MAPPER.write(expectOk(createSupplier('supplier-a' as SupplierId, 'Builders')), 0)['schema-version'],
	quote: () => quoteToPersistence({ id: 'quote-a' as QuoteId, projectId: project.id, supplierId: 'supplier-a' as SupplierId, title: 'Tiles', issuedOn: '2026-09-30', status: 'draft', items: [] }, 0)['schema-version'],
	'plan-geometry': async () => {
		const stack = createRepositoryStack();
		expectOk(await stack.projects.save(project, 'absent'));
		expectOk(await stack.plans.save(plan, 'absent'));
		return JSON.parse(expectDefined(stack.vault.entries.get(expectDefined(stack.index.getGeometrySidecarPath(plan.id), 'sidecar path')), 'sidecar')).schemaVersion;
	},
	'asset-geometry': async () => {
		const stack = createRepositoryStack();
		expectOk(await stack.assetGeometry.write(assetId, { calibration: null, shape: null }));
		return JSON.parse(expectDefined(stack.vault.entries.get(assetSidecarPathFor(stack.libraryFolder, assetId)), 'sidecar')).schemaVersion;
	},
};

const runner = createMigrationRunner(MIGRATION_SET);
const migratable = Object.keys(MIGRATION_SET);
const thrown = (run: () => unknown): unknown => {
	try {
		run();
	} catch (cause) {
		return (cause as { code?: unknown }).code;
	}
	return undefined;
};

describe('the data compatibility table', () => {
	it('parses something, so an empty or renamed section cannot pass', () => {
		expect(byKey.size).toBeGreaterThan(migratable.length);
	});

	it('has one vault row per kind the migration runner registers, plus asset geometry', () => {
		const vaultRows = rows.filter((entry) => entry['Version field'] !== undefined).map((entry) => ticked(entry['Key'])[0]);
		expect(vaultRows.toSorted()).toEqual([...migratable, 'asset-geometry'].toSorted());
	});

	it.each(migratable)('%s: reads what the runner accepts, and refuses one newer with the stated code', (kind) => {
		const { low, high } = bounds(row(kind)['Reads']);
		expect([low, high]).toEqual([1, runner.latestVersions[kind]]);
		for (let version = low; version <= high; version++) expect(thrown(() => runner.migrateToLatest(kind, {}, version))).toBeUndefined();
		expect(thrown(() => runner.migrateToLatest(kind, {}, 0))).toBe('migration.chain-gap');
		expect(thrown(() => runner.migrateToLatest(kind, {}, high + 1))).toBe(ticked(row(kind)['Newer than this build'])[0]);
	});

	it.each(Object.keys(plainWrite))('%s: writes a plain record at the lowest version, up to the highest it reads', async (kind) => {
		const stated = writes(row(kind)['Writes']);
		expect(await plainWrite[kind]()).toBe(stated.low);
		expect(stated.high).toBe(bounds(row(kind)['Reads']).high);
		expect(!stated.always || stated.low === stated.high).toBe(true);
	});

	it('asset geometry: reads the versions its schema accepts, and refuses one newer with the stated code', async () => {
		const { low, high } = bounds(row('asset-geometry')['Reads']);
		const document = (schemaVersion: number) => ({ schemaVersion, assetId, revision: 0, unit: 'mm', calibration: null, shape: null });
		for (let version = low; version <= high; version++) expect(AssetGeometrySchema.safeParse(document(version)).success).toBe(true);
		expect(AssetGeometrySchema.safeParse(document(low - 1)).success).toBe(false);
		const stack = createRepositoryStack();
		stack.vault.entries.set(assetSidecarPathFor(stack.libraryFolder, assetId), JSON.stringify(document(high + 1)));
		const refused = await stack.assetGeometry.read(assetId);
		expect(refused.ok ? null : refused.error.code).toBe(ticked(row('asset-geometry')['Newer than this build'])[0]);
	});

	it.each([
		['sequence-markers', SEQUENCE_MARKER_SCHEMA_VERSION],
		['write-incidents', WRITE_INCIDENT_SCHEMA_VERSION],
	] as const)('%s: reads and writes the version its store is built on', (key, version) => {
		expect(bounds(row(key)['Reads'])).toEqual({ low: version, high: version });
		expect(writes(row(key)['Writes'])).toEqual({ always: true, low: version, high: version });
	});

	it('continue context: writes the version it reads, and ignores another one', async () => {
		let stored: unknown = null;
		const store = new ContinueContextStore({ loadLocalStorage: () => stored, saveLocalStorage: (_key, value) => { stored = value; } }, 'key', createRepositoryStack().logger);
		await store.write({ projectId: 'p', planId: null });
		const version = (stored as { schemaVersion: number }).schemaVersion;
		expect(writes(row('continue-context')['Writes'])).toEqual({ always: true, low: version, high: version });
		expect(bounds(row('continue-context')['Reads'])).toEqual({ low: version, high: version });
		expect(await store.read()).not.toBeNull();
		stored = { ...(stored as object), schemaVersion: version + 1 };
		expect(await store.read()).toBeNull();
	});

	it('settings: names exactly the fields a read keeps', () => {
		const settings = expectDefined(rows.find((entry) => entry['Record'] === 'Settings'), 'the Settings row');
		expect(ticked(settings['Fields']).toSorted()).toEqual(Object.keys(settingsFrom(null)).toSorted());
	});
});
