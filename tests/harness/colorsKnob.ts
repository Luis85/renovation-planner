import { withPlanRenovation, withPlanSpatialElements, type Plan } from '../../src/domain/plan/Plan';
import type { ItemColor } from '../../src/domain/spatial/ItemColor';
import { EMPTY_STRUCTURE, type Opening } from '../../src/domain/spatial/Structure';
import type { SpatialElement } from '../../src/domain/spatial/SpatialElement';
import { EMPTY_RENOVATION } from '../../src/domain/renovation/Renovation';
import { DEFAULT_STAIR } from '../../src/domain/spatial/stairGeometry';
import { postOutline } from '../../src/domain/spatial/structuralElement';
import { placementPoints } from '../../src/domain/spatial/assetPlacement';
import { shapeFromDimensions } from '../../src/domain/asset/AssetShape';
import { ObsidianAssetGeometrySidecar } from '../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { expectDefined, expectOk } from '../helpers/domain';
import { makeAsset, makeZone } from '../helpers/entities';
import type { seedDraftingPlan } from './draftingWorkspace';

export type SeedStack = Parameters<typeof seedDraftingPlan>[0];
export type SeedGeometry = Parameters<typeof seedDraftingPlan>[1];

const PALETTE: readonly ItemColor[] = ['blue', 'rose', 'amber', 'green', 'violet', '#3a7bd5'];
/** A door and a window in the north wall, where `?drafting`'s dimension chain already measures two openings. */
const OPENINGS: readonly Opening[] = [
	{ id: 'opening-harness-door', kind: 'door', hostId: 'wall-harness-north', offset: 1190, width: 750, height: 2100, sill: 0 },
	{ id: 'opening-harness-window', kind: 'window', hostId: 'wall-harness-north', offset: 4560, width: 750, height: 1200, sill: 900 },
];
/** One of every family `?drafting` does not draw, each clear of the others inside its walled floor. */
const ITEMS: readonly (SpatialElement & { readonly name: string })[] = [
	{ id: 'element-harness-cabinet', kind: 'object', name: 'Cabinet', points: [{ x: 600, y: 600 }, { x: 1800, y: 600 }, { x: 1800, y: 1200 }, { x: 600, y: 1200 }] },
	{ id: 'element-harness-arrow', kind: 'arrow', name: 'Flow', points: [{ x: 800, y: 4000 }, { x: 2600, y: 4000 }] },
	{ id: 'element-harness-post', kind: 'post', name: 'Post', loadBearing: true, points: postOutline({ x: 4300, y: 5600 }, 200, 200) },
	{ id: 'element-harness-post-free', kind: 'post', name: 'Free post', loadBearing: false, points: postOutline({ x: 5400, y: 5600 }, 200, 200) },
	{ id: 'element-harness-beam', kind: 'beam', name: 'Beam', loadBearing: true, width: 160, points: [{ x: 3700, y: 6800 }, { x: 5900, y: 6800 }] },
	{ id: 'element-harness-stair', kind: 'stair', name: 'Stair', stair: DEFAULT_STAIR, points: [{ x: 1500, y: 8600 }, { x: 1500, y: 5600 }] },
];

/**
 * `?colors`: every family carrying a colour over whatever `?drafting` seeded — a room wash, each wall (the east one
 * patterned with the `?planning` catalogue's brick), a door and a window, a plain item, a placed asset, posts, a beam,
 * a stair, an arrow and every drafting mark, in turn through the presets and one custom hex — so one capture shows
 * tint, ink, hatch-on-tint and wash together (plan colours design §2, §4). Written through the real repositories,
 * schema 16 included.
 */
export async function seedColors(stack: SeedStack, geometry: SeedGeometry, plan: Plan): Promise<void> {
	const room = makeZone({ projectId: plan.projectId, planId: plan.id, name: 'Studio', color: 'green',
		geometry: { points: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 3000 }, { x: 0, y: 3000 }] } });
	expectOk(await stack.zones.save(room, 'absent'));
	const radiator = makeAsset({ name: 'Radiator', unit: 'piece' });
	expectOk(await stack.assets.save(radiator, 'absent'));
	expectOk(await new ObsidianAssetGeometrySidecar(stack.assetGeometry).write(radiator.id, { calibration: null, shape: expectOk(shapeFromDimensions(800, 600)) }));
	const placement = { id: 'element-harness-radiator', kind: 'asset' as const, name: 'Radiator', assetId: radiator.id, points: placementPoints({ x: 3600, y: 1500 }, 0) };
	const added = [...ITEMS, placement];
	const baseline = expectOk(await geometry.read(plan.id)), structure = baseline.document.structure ?? EMPTY_STRUCTURE;
	const paint = <T extends object>(items: readonly T[], offset: number) => items.map((item, index) => ({ ...item, color: PALETTE[(index + offset) % PALETTE.length] }));
	const elements = paint([...structure.elements ?? [], ...added.map(({ name: _name, ...element }) => element)], 0);
	expectOk(await geometry.write(plan.id, { ...baseline.document, structure: { ...structure, walls: paint(structure.walls, 1), openings: paint([...structure.openings, ...OPENINGS], 2), elements } }, baseline.version));
	const brick = expectDefined(expectOk(await stack.assets.listAll()).loaded.find(item => item.entity.planPattern === 'brick'), '?planning brick material').entity;
	const subjects = [{ id: 'detail-harness-east', targetId: 'wall-harness-east', kind: 'wall' as const, existing: { description: 'Clinker brick', condition: 'good' as const, assetId: brick.id }, planned: null }];
	const loaded = expectDefined(expectOk(await stack.plans.getById(plan.id)), 'harness colours plan');
	const named = expectOk(withPlanSpatialElements(loaded.entity, [...loaded.entity.spatialElements ?? [], ...added.map(({ id, name }) => ({ id, name }))]));
	expectOk(await stack.plans.save(expectOk(withPlanRenovation(named, { ...EMPTY_RENOVATION, subjects })), loaded.version));
}
