import { expect, it } from 'vitest';
import { isItemColor, itemColorKind, ITEM_COLORS } from '../../../src/domain/spatial/ItemColor';
import { validSpatialElement, type SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { PlanGeometrySchemaV14, PlanGeometrySchemaV15 } from '../../../src/infrastructure/persistence/dto/planGeometry';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { itemColorFill } from '../../../src/presentation/editor/elements/itemColorAppearance';
import { assetShapeConfig } from '../../../src/presentation/editor/elements/assetShapeConfig';
import { THEME_TOKENS, type ThemeTokens } from '../../../src/presentation/editor/theme/themeTokens';
import { sameGeometryDocument } from '../../../src/application/commands/spatial/sameGeometryDocument';

const item: SpatialElement = { id: 'element-item', kind: 'object', points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }] };
const structure = { walls: [], openings: [], boundaries: [], elements: [item] };
const old = { schemaVersion: 12, planId: 'floor', revision: 0, unit: 'mm', calibration: null, objects: [], structure };

it('includes placement color in document equality for current and intended history baselines', () => {
	const document = { calibration: null, objects: [], structure };
	const colored = { ...structure, elements: [{ ...item, color: 'blue' as const }] };
	expect(sameGeometryDocument(document, { ...document, structure: colored })).toBe(false);
	expect(sameGeometryDocument({ ...document, intended: structure }, { ...document, intended: colored })).toBe(false);
	expect(sameGeometryDocument(document, { ...document, structure: { ...structure, elements: [{ ...item, color: undefined }] } })).toBe(true);
});

it('limits durable ids to six presets and eligible identities to objects and asset placements', () => {
	expect(ITEM_COLORS.every(color => isItemColor(color))).toBe(true); expect(isItemColor('default')).toBe(false); expect(isItemColor('#ffffff')).toBe(false);
	expect(isItemColor(null)).toBe(false);
	const kinds = ['object', 'asset', 'path', 'fence', 'measurement', 'stair', 'arrow', 'post', 'beam', 'dimension', 'section', 'view', 'hatch', 'text', 'boundary', 'grid', 'Room', 'Area', 'wall', 'opening', 'reference'];
	expect(kinds.filter(kind => itemColorKind(kind))).toEqual(['object', 'asset']);
	expect(validSpatialElement({ ...item, color: 'blue' })).toBe(true);
	expect(validSpatialElement({ ...item, color: 'unknown' as never })).toBe(false);
	expect(validSpatialElement({ ...item, kind: 'path', color: 'blue' })).toBe(false);
});

it('migrates old sidecars without inventing colors and refuses unknown colors and ineligible kinds', () => {
	const migrations = new MigrationRunner(); migrations.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS);
	const migrated = migrations.migrateToLatest('plan-geometry', old, 12);
	expect(PlanGeometrySchemaV15.parse(migrated).structure?.elements?.[0]).not.toHaveProperty('color');
	expect(old.schemaVersion).toBe(12);
	const colored = { ...old, schemaVersion: 14, structure: { ...structure, elements: [{ ...item, color: 'rose' }] } };
	expect(PlanGeometrySchemaV14.parse(colored).structure?.elements?.[0].color).toBe('rose');
	for (const invalid of [{ ...item, color: 'pink' }, { ...item, color: null }, { ...item, kind: 'path', color: 'rose' }]) {
		expect(PlanGeometrySchemaV14.safeParse({ ...colored, structure: { ...structure, elements: [invalid] } }).success).toBe(false);
	}
	const previous = new MigrationRunner(); previous.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(migration => migration.toVersion <= 13));
	expect(() => previous.migrateToLatest('plan-geometry', colored, 14)).toThrow('newer than this build supports');
});

it('tints against light, dark and custom host backgrounds, preserving Default and unrelated kinds', () => {
	expect(itemColorFill({ ...item, color: 'blue' }, '#ffffff')).toBe('rgb(206, 223, 241)');
	expect(itemColorFill({ ...item, color: 'blue' }, '#1e1e1e')).toBe('rgb(44, 61, 79)');
	expect(itemColorFill({ ...item, color: 'blue' }, 'rgb(240, 230, 210)')).toBe('rgb(195, 205, 209)');
	expect(itemColorFill(item, '#abcdef')).toBe('#abcdef');
	expect(itemColorFill({ kind: 'path', color: 'blue' }, '#abcdef')).toBe('#abcdef');
	expect(itemColorFill({ ...item, color: 'blue' }, 'unparseable')).toBe('unparseable');
});

it('colors a missing-asset placeholder while retaining its selected outline, dashed shape and label', () => {
	const tokens = Object.fromEntries(Object.keys(THEME_TOKENS).map(key => [key, key === 'canvasBackground' ? '#ffffff' : '#222222'])) as ThemeTokens;
	const element = { id: 'element-asset', kind: 'asset' as const, points: [{ x: 1000, y: 1000 }, { x: 1100, y: 1000 }], assetId: 'missing', name: 'Armchair', color: 'blue' as const };
	const result = assetShapeConfig(element, () => null, { selected: true, hovered: false, tokens, zoom: 1 });
	expect(result.footprint.fill).toBe('rgb(206, 223, 241)'); expect(result.footprint.stroke).toBe(tokens.accent);
	expect(result.footprint.dash).toEqual([6, 4]); expect(result.label.text).toBe('Armchair'); expect(result.cross).not.toBeNull();
});
