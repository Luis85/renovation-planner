import { onBeforeUnmount, onMounted, onUpdated, type Ref } from 'vue';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import { screenPoint, screenToWorld, STAGE_PIXELS, type Viewport } from '../viewport/Viewport';

export interface DimensionObstacleLayout {
	readonly bounds: readonly BoundingBox[];
	readonly viewport: BoundingBox | null;
}

function sameBox(box: BoundingBox | null, other: BoundingBox | null): boolean {
	return box === null || other === null ? box === other
		: box.min.x === other.min.x && box.min.y === other.min.y && box.max.x === other.max.x && box.max.y === other.max.y;
}

/** Native dimension controls own one observer; room renderers consume only world rectangles. */
export function useDimensionObstacles(root: Ref<HTMLElement | null>, viewport: () => Viewport, publish: (layout: DimensionObstacleLayout) => void): void {
	let observer: ResizeObserver | null = null, frame: { id: number; view: Window } | null = null;
	let alive = true, previous: DimensionObstacleLayout = { bounds: [], viewport: null };
	const observed = new Set<Element>();
	// The controls use a 2px outline with a 2px offset. Reserve it even without focus.
	const clearance = 4;
	function update(layout: DimensionObstacleLayout): void {
		if (sameBox(layout.viewport, previous.viewport) && layout.bounds.length === previous.bounds.length && layout.bounds.every((box, index) => sameBox(box, previous.bounds[index]))) return;
		previous = layout;
		publish(layout);
	}
	function measure(): void {
		frame = null;
		if (!alive || !root.value) return;
		const container = root.value, origin = container.getBoundingClientRect();
		const anchors = [...container.querySelectorAll<HTMLElement>('.rp-dimension-anchor')];
		const targets = new Set<Element>([container, ...anchors]);
		for (const element of observed) if (!targets.has(element)) { observer?.unobserve(element); observed.delete(element); }
		for (const element of targets) if (!observed.has(element)) { observer?.observe(element); observed.add(element); }
		if (!origin.width || !origin.height) { update({ bounds: [], viewport: null }); return; }
		const camera = viewport();
		const bounds = anchors.flatMap(anchor => {
			const rect = anchor.getBoundingClientRect();
			if (!rect.width || !rect.height) return [];
			return [{ min: screenToWorld(screenPoint(rect.left - origin.left - clearance, rect.top - origin.top - clearance), camera, STAGE_PIXELS),
				max: screenToWorld(screenPoint(rect.right - origin.left + clearance, rect.bottom - origin.top + clearance), camera, STAGE_PIXELS) }];
		});
		update({ bounds, viewport: { min: screenToWorld(screenPoint(0, 0), camera, STAGE_PIXELS), max: screenToWorld(screenPoint(origin.width, origin.height), camera, STAGE_PIXELS) } });
	}
	function schedule(): void {
		const view = root.value?.ownerDocument.defaultView;
		if (alive && frame === null && view) frame = { id: view.requestAnimationFrame(measure), view };
	}
	onMounted(() => { observer = new ResizeObserver(schedule); schedule(); });
	// Position changes and button/inline-form replacement need measurement even without resize.
	onUpdated(schedule);
	onBeforeUnmount(() => {
		alive = false;
		if (frame !== null) frame.view.cancelAnimationFrame(frame.id);
		frame = null;
		observer?.disconnect(); observer = null; observed.clear(); update({ bounds: [], viewport: null });
	});
}
