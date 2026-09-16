// @vitest-environment jsdom
import type Konva from 'konva';
import { expect, it, vi } from 'vitest';
import { mountPlanEditorCanvas, runtimeOf, settle } from '../../../helpers/editor';
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
	// Copied BEFORE unmount: `getChildren()` answers a live reference into the Konva tree, and
	// `unmount()` tears that tree down — a copy taken after would be a copy of what survived
	// destruction, not of what was drawn.
	const nodes = [...(harness.stage.findOne<Konva.Group>('.opening-handles')?.getChildren() ?? [])];
	harness.unmount();
	return nodes;
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

/**
 * The Select-tool gate: `selectedOpeningHandles` itself takes no perspective or tool
 * opinion (its own docblock says so), so the component's `runtime.activeToolId.value !==
 * 'select'` check is the only thing standing between a selected door and marks drawn
 * while, say, a drawing tool is active. Deleting that half of the condition would still
 * pass every other case here (all of them run under the default Select tool), and
 * coverage cannot see an `&&` operand that was never false.
 */
it('draws nothing while a tool other than Select is active', async () => {
	const harness = await mountPlanEditorCanvas();
	useProjectStore().structure = structure;
	useSelectionStore().select([door.id as EntityId<string>]);
	const editor = useEditorStore();
	editor.viewport = { ...editor.viewport, zoom: 1 };
	await settle();
	// Sanity: the marks ARE there under Select, so switching tool is what changes the picture.
	expect(harness.stage.findOne<Konva.Group>('.opening-handles')?.getChildren()).toHaveLength(7);

	runtimeOf(harness).setTool('pan');
	await settle();
	const nodes = [...(harness.stage.findOne<Konva.Group>('.opening-handles')?.getChildren() ?? [])];
	harness.unmount();
	expect(nodes).toHaveLength(0);
});

it('listens for no pointer events, on every node it draws', async () => {
	const nodes = await drawn();
	expect(nodes.length).toBeGreaterThan(0);
	expect(nodes.every(node => node.listening() === false)).toBe(true);
});

interface AgreementData {
	/** Every grip name the door answers for, and every grip name a drawn node identifies as — compared as sets, BOTH ways. */
	readonly doorGrips: ReadonlySet<string>;
	readonly drawnGrips: ReadonlySet<string>;
	/** One pair per drawn node: its own screen position, and the door's for the same grip. Asserted outside this function, unconditionally, so the assertion is never hidden behind a branch. */
	readonly positions: readonly { readonly grip: string; readonly actual: { readonly x: number; readonly y: number }; readonly expected: { readonly x: number; readonly y: number } }[];
}

/** No `expect` in here on purpose — both linted-against shapes (a conditional `expect`, and one an
 * `it()` block never calls directly) start with an assertion living inside a helper like this one. */
async function agreementData(zoom: number): Promise<AgreementData> {
	const harness = await mountPlanEditorCanvas();
	useProjectStore().structure = structure;
	useSelectionStore().select([door.id as EntityId<string>]);
	const editor = useEditorStore();
	editor.viewport = { ...editor.viewport, zoom };
	await settle();

	const applyOpening = vi.fn<(id: string, transform: (opening: Opening, host: Wall) => Opening | null) => Promise<void>>().mockResolvedValue();
	const previewOpening = vi.fn<(id: string | null, next?: Opening) => void>();
	const doors = openingHandleDoors({ applyOpening, previewOpening });
	const hitTested = expectDefined(doors.openingHandles(), 'opening handles from the door');
	const expectedScreen = new Map(hitTested.handles.map(handle => [handle.grip, worldToScreen(handle.point, editor.viewport, STAGE_PIXELS)]));
	const doorGrips = new Set(hitTested.handles.map(handle => handle.grip as string));
	const left = expectDefined(expectedScreen.get('side-left'), 'expected side-left point');
	const right = expectDefined(expectedScreen.get('side-right'), 'expected side-right point');

	const group = expectDefined(harness.stage.findOne<Konva.Group>('.opening-handles'), 'opening handles group');
	const children = [...group.getChildren()];
	harness.unmount();

	// A chevron's identity is read by NEAREST match against the door's two side points, since
	// both chevrons share the one `opening-chevron` name — sound because the two sides sit far
	// apart on opposite wall faces, so a scale error large enough to cross the midpoint would
	// already be failing `positions` below by a wide margin.
	const identified = children.map(node => {
		if (node.name() !== 'opening-chevron') return { grip: node.name().replace('opening-handle-', ''), actual: { x: (node as Konva.Circle).x(), y: (node as Konva.Circle).y() } };
		const points = (node as Konva.Line).points(), tip = { x: points[2], y: points[3] };
		const grip = Math.hypot(tip.x - left.x, tip.y - left.y) <= Math.hypot(tip.x - right.x, tip.y - right.y) ? 'side-left' : 'side-right';
		return { grip, actual: tip };
	});

	return {
		doorGrips,
		drawnGrips: new Set(identified.map(entry => entry.grip)),
		positions: identified.map(entry => ({ grip: entry.grip, actual: entry.actual, expected: expectDefined(expectedScreen.get(entry.grip as OpeningGrip), `expected screen point for ${entry.grip}`) })),
	};
}

/**
 * The check the restored docblocks in `openingHandles.ts` and `openingHandleDoors.ts` promise:
 * what draws is what a press acts on. `openingHandleDoors(...).openingHandles()` is the SAME
 * door `SelectTool` hit-tests through — built directly here rather than reached through the
 * mounted runtime, since `EditorRuntime`'s own type omits the opening doors it merely spreads.
 *
 * Two checks, because either alone misses a real disagreement. The SET of grip names — the
 * door's against what the component actually drew, BOTH ways — catches a DROPPED (or added)
 * grip: a position loop that only walks the drawn nodes and looks each one up in the door's
 * answer never notices one the door still answers for but the component silently stopped
 * drawing. The per-grip POSITION check, kept alongside it, catches the opposite failure: a
 * component that draws every expected NAME but at the wrong screen point — the shape a
 * mismatched `worldPerPixel` between the door and the component would take, since a chevron's
 * own point moves with it (`OPENING_CHEVRON_GAP_PX * worldPerPixel`) while a circle's does not.
 * Run at zoom 1, where nothing is crowded out, AND at the crowded zoom `0.01` the count test
 * above uses, where a wrong scale would also disagree about WHICH grips exist at all.
 */
it('draws exactly what a press would act on, grip by grip, at zoom 1', async () => {
	const data = await agreementData(1);
	expect(data.drawnGrips).toEqual(data.doorGrips);
	for (const { actual, expected } of data.positions) {
		expect(actual.x).toBeCloseTo(expected.x);
		expect(actual.y).toBeCloseTo(expected.y);
	}
});

it('draws exactly what a press would act on, grip by grip, at a crowded zoom', async () => {
	const data = await agreementData(0.01);
	expect(data.drawnGrips).toEqual(data.doorGrips);
	for (const { actual, expected } of data.positions) {
		expect(actual.x).toBeCloseTo(expected.x);
		expect(actual.y).toBeCloseTo(expected.y);
	}
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
