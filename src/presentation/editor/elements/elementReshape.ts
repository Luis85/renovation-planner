import type { Ref } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { NamedSpatialElement, SpatialElement } from '../../../domain/spatial/SpatialElement';
import { withPlacementSize } from '../../../domain/spatial/assetPlacement';
import type { RenovationBaseline } from '../../../application/commands/renovation/RenovationCommand';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { notifyOperationFailure } from '../../notices/notify';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import { elementInput } from './elementInput';
import type { ResizedGeometry } from './transformBox';

/** The saved element is still the one the gesture captured: kind, points, stair, and a placement's size. */
function unchanged(element: SpatialElement, original: SpatialElement): boolean {
	return element.kind === original.kind && JSON.stringify(element.points) === JSON.stringify(original.points) && JSON.stringify(element.stair) === JSON.stringify(original.stair)
		&& JSON.stringify(element.size) === JSON.stringify(original.size);
}

/** What `move`/`resize` share with `elementActions.ts`'s guarded write, pulled out for the caller's own `max-lines-per-function` budget. */
export interface ElementReshapeDeps {
	readonly operate: (id: string, action: (value: { baseline: RenovationBaseline; element: NamedSpatialElement }) => Promise<void>) => Promise<void>;
	readonly preview: Ref<NamedSpatialElement | null>;
	readonly blocked: Ref<boolean>;
	readonly alive: () => boolean;
	readonly rotationEpoch: () => number;
}

/** A body/vertex drag (`move`) and a transform-box/Inspector resize (`resize`), both a `reshape` of the same guarded write, and the preview each drives. */
export function createElementReshape(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'dispatcher' | 'structureTask'>, deps: ElementReshapeDeps) {
	const project = useProjectStore();
	async function reshape(id: string, original: SpatialElement, change: (element: NamedSpatialElement) => NamedSpatialElement): Promise<void> {
		const epoch = deps.rotationEpoch();
		try {
			await deps.operate(id, async ({ baseline, element }) => {
				if (epoch !== deps.rotationEpoch()) return;
				if (!unchanged(element, original)) { notifyOperationFailure(staleWriteRefusal()); return; }
				if (!context.commands.renovation) return;
				const result = await runtime.dispatcher.run(context.commands.renovation.command(baseline, elementInput(baseline, change(element)), runtime.structureTask.ledger));
				if (deps.alive() && !result.ok) notifyOperationFailure(result.error);
			});
		} finally {
			// A pointer drop leaves its preview up until here; `operate` refusing before its own `finally` must not strand it.
			if (deps.preview.value?.id === id) deps.preview.value = null;
		}
	}
	/** A body or vertex drag: new points, every other fact — a placement's size included — kept. */
	function move(id: string, points: readonly Point[], original: SpatialElement): Promise<void> {
		return reshape(id, original, element => ({ ...element, points }));
	}
	/** A transform box or Inspector resize: new points, and a placement's own size set or removed. */
	function resize(id: string, next: ResizedGeometry, original: SpatialElement): Promise<void> {
		return reshape(id, original, element => withPlacementSize({ ...element, points: next.points }, next.size));
	}
	function previewReshape(id: string | null, change?: (element: SpatialElement) => SpatialElement): void {
		const element = project.structure.elements?.find(item => item.id === id), name = project.plan?.spatialElements?.find(item => item.id === id)?.name;
		deps.preview.value = deps.alive() && !deps.blocked.value && element && name && change ? { ...change(element), name } : null;
	}
	function previewElement(id: string | null, points?: readonly Point[]): void {
		previewReshape(id, points ? element => ({ ...element, points }) : undefined);
	}
	function previewResize(id: string | null, next?: ResizedGeometry): void {
		previewReshape(id, next ? element => withPlacementSize({ ...element, points: next.points }, next.size) : undefined);
	}
	return { move, resize, previewElement, previewResize };
}
