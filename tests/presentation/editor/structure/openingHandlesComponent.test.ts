// @vitest-environment jsdom
import type Konva from 'konva';
import { expect, it, vi } from 'vitest';
import { mountPlanEditorCanvas, settle } from '../../../helpers/editor';
import { expectDefined } from '../../../helpers/domain';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { useRenovationSession, type Perspective } from '../../../../src/presentation/editor/renovation/renovationSession';
import { resolveThemeTokens } from '../../../../src/presentation/editor/theme/themeTokens';
import { openingHandleDoors } from '../../../../src/presentation/editor/structure/openingHandleDoors';
import type { OpeningGrip } from '../../../../src/presentation/editor/structure/openingHandles';
import { STAGE_PIXELS, worldToScreen } from '../../../../src/presentation/editor/viewport/Viewport';
import type { Opening, Structure, Wall } from '../../../../src/domain/spatial/Structure';
import type { EntityId } from '../../../../src/core/identity/EntityId';

const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 200 };
const door: Opening = { id: 'opening-a', kind: 'door', hostId: wall.id, offset: 800, width: 1200, height: 2100, sill: 0 };
const structure: Structure = { walls: [wall], openings: [door], boundaries: [] };

/**
 * Mounts the real Plan Editor (the pattern `interactionLayer.test.ts`'s own "hover outline" and
 * "multi-selection" suites use: `mountPlanEditorCanvas` plus store writes, no gesture replayed),
 * seeds it with this file's wall-and-door structure, and answers every node `OpeningHandles.vue`
 * drew — everything under its own `.opening-handles` group, so a node from any OTHER family on
 * the interaction layer can never be mistaken for one of these.
 */
async function drawn(options: {
	structure?: Structure;
	selectedIds?: readonly string[];
	zoom?: number;
	perspective?: Perspective;
} = {}): Promise<Konva.Node[]> {
	const harness = await mountPlanEditorCanvas();
	useProjectStore().structure = options.structure ?? structure;
	useSelectionStore().select((options.selectedIds ?? [door.id]).map(id => id as EntityId<string>));
	const editor = useEditorStore();
	editor.viewport = { ...editor.viewport, zoom: options.zoom ?? 1 };
	useRenovationSession().perspective = options.perspective ?? 'plan';
	await settle();
	const nodes = harness.stage.findOne<Konva.Group>('.opening-handles')?.getChildren() ?? [];
	harness.unmount();
	return [...nodes];
}

it('draws seven marks for a selected door', async () => {
	// Two width circles, one move circle, two step arrows, two chevrons.
	expect(await drawn()).toHaveLength(7);
});

it('draws five for a plain opening, none of them a chevron', async () => {
	const openings = [{ ...door, kind: 'opening' as const }];
	const nodes = await drawn({ structure: { ...structure, openings } });
	expect(nodes).toHaveLength(5);
	expect(nodes.every(node => node.name() !== 'opening-chevron')).toBe(true);
});

it('draws three for a crowded door — the move grip and its two chevrons', async () => {
	// At this zoom the centre-line marks are under the separation floor; the chevrons are off it.
	const nodes = await drawn({ zoom: 0.01 });
	expect(nodes).toHaveLength(3);
	expect(nodes.filter(node => node.name() === 'opening-chevron')).toHaveLength(2);
});

it('draws nothing with no selection, a multi-selection, or a selected wall', async () => {
	expect(await drawn({ selectedIds: [] })).toHaveLength(0);
	expect(await drawn({ selectedIds: [door.id, wall.id] })).toHaveLength(0);
	expect(await drawn({ selectedIds: [wall.id] })).toHaveLength(0);
});

it('draws nothing outside the Plan perspective', async () => {
	expect(await drawn({ perspective: 'renovate' })).toHaveLength(0);
	expect(await drawn({ perspective: 'review' })).toHaveLength(0);
});

it('listens for no pointer events, on every node it draws', async () => {
	const nodes = await drawn();
	expect(nodes.length).toBeGreaterThan(0);
	expect(nodes.every(node => node.listening() === false)).toBe(true);
});

/**
 * The check the restored docblocks in `openingHandles.ts` and `openingHandleDoors.ts` promise:
 * what draws is what a press acts on. `openingHandleDoors(...).openingHandles()` is the SAME
 * door `SelectTool` hit-tests through — built directly here rather than reached through the
 * mounted runtime, since `EditorRuntime`'s own type omits the opening doors it merely spreads —
 * against `worldToScreen` of the drawn nodes' own screen positions, grip by grip.
 */
it('draws exactly what a press would act on, grip by grip', async () => {
	const harness = await mountPlanEditorCanvas();
	useProjectStore().structure = structure;
	useSelectionStore().select([door.id as EntityId<string>]);
	const editor = useEditorStore();
	editor.viewport = { ...editor.viewport, zoom: 1 };
	await settle();

	const applyOpening = vi.fn<(id: string, transform: (opening: Opening, host: Wall) => Opening | null) => Promise<void>>().mockResolvedValue();
	const previewOpening = vi.fn<(id: string | null, next?: Opening) => void>();
	const doors = openingHandleDoors({ applyOpening, previewOpening });
	const hitTested = expectDefined(doors.openingHandles(), 'opening handles from the door');
	const expectedScreen = new Map(hitTested.handles.map(handle => [handle.grip, worldToScreen(handle.point, editor.viewport, STAGE_PIXELS)]));

	const group = expectDefined(harness.stage.findOne<Konva.Group>('.opening-handles'), 'opening handles group');
	for (const node of group.getChildren()) {
		if (node.name() === 'opening-chevron') continue; // no per-grip name; checked below instead
		const grip = node.name().replace('opening-handle-', '');
		const expectedAt = expectDefined(expectedScreen.get(grip as OpeningGrip), `expected screen point for ${grip}`);
		expect((node as Konva.Circle).x()).toBeCloseTo(expectedAt.x);
		expect((node as Konva.Circle).y()).toBeCloseTo(expectedAt.y);
	}

	// Both chevrons share the one name, so their tips — a `VLine`'s own middle point — are
	// checked as a SET against the door's two chevron grips instead of by name.
	const chevronTips = group.find('.opening-chevron').map(node => {
		const points = (node as Konva.Line).points();
		return { x: points[2], y: points[3] };
	});
	for (const grip of ['side-left', 'side-right'] as const) {
		const expectedAt = expectDefined(expectedScreen.get(grip), `expected screen point for ${grip}`);
		expect(chevronTips.some(tip => Math.abs(tip.x - expectedAt.x) < 0.01 && Math.abs(tip.y - expectedAt.y) < 0.01)).toBe(true);
	}

	harness.unmount();
});

it('takes every colour from the theme tokens, never a literal one', async () => {
	// The same resolution `useThemeTokens.ts` performs against the mounted tree's own root —
	// under jsdom, with no CSS variable defined anywhere, every token collapses to the one
	// fallback ink `zoneEditing.test.ts` and this suite's sibling files already rely on, so
	// this checks that no colour ESCAPES that set rather than that the marks differ by colour.
	const tokens = new Set(Object.values(resolveThemeTokens(document.documentElement)));
	const nodes = await drawn();
	expect(nodes.length).toBeGreaterThan(0);
	for (const node of nodes) {
		const shape = node as unknown as { fill?: () => string; stroke?: () => string };
		for (const colour of [shape.fill?.(), shape.stroke?.()].filter((value): value is string => Boolean(value))) {
			expect(tokens.has(colour)).toBe(true);
		}
	}
});
