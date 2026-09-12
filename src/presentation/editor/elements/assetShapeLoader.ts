import { computed, onScopeDispose, watch } from 'vue';
import type { PlanEditorContext } from '../PlanEditorContext';
import { useProjectStore } from '../../stores/ProjectStore';
import { useAssetShapeStore } from '../../stores/AssetShapeStore';
import { NO_SHAPES, type ShapeLookup } from './elementFootprint';

const registered = new WeakMap<ReturnType<typeof useProjectStore>, ShapeLookup>();
/**
 * The shape lookup of the leaf whose project store this is, for a caller that runs with no
 * injection context (a list row's click) and so cannot ask Pinia which leaf it belongs to.
 * `NO_SHAPES` when no mounted leaf registered it.
 */
export function assetShapesFor(project: ReturnType<typeof useProjectStore>): ShapeLookup {
	return registered.get(project) ?? NO_SHAPES;
}

/** Re-read shapes whenever the set of placed assets changes or the catalogue does; the latest read wins. */
export function watchAssetShapes(context: PlanEditorContext): void {
	const project = useProjectStore(), shapes = useAssetShapeStore();
	registered.set(project, shapes.shapeOf);
	onScopeDispose(() => { registered.delete(project); });
	const ids = computed(() => [...new Set([project.structure, project.intended].flatMap(structure => structure?.elements ?? [])
		.flatMap(element => element.kind === 'asset' && element.assetId ? [element.assetId] : []))].toSorted());
	let ticket = 0;
	async function load(): Promise<void> {
		const mine = ++ticket;
		// Called straight off `context.queries` rather than lifted into a local first: a bare
		// reference to a method-shaped interface member is what `@typescript-eslint/unbound-method`
		// refuses, the same reason `guardedServices.ts`'s own header states for its guard calls.
		if (!context.queries.assetShapes) return;
		const answers = await context.queries.assetShapes(ids.value);
		if (mine === ticket) shapes.set(answers);
	}
	// Detached: never awaited, so a rejection here would be unhandled. Safe because production wires
	// `assetShapes` to the guarded `assetDesign.get` (`composition-root.ts`), and `guardQuery` maps
	// every throw to a resolved Result rather than a rejection — proven category-wide, not merely
	// here, by `tests/plugin/guardCategory.test.ts`, which detonates every guarded door including
	// this one and requires a resolved refusal back. A caller that wires `assetShapes` to a query
	// that can genuinely reject (an editor test rig's raw `GetAssetDesignQuery`, say) would see that
	// surface as an unhandled rejection from this line rather than a mapped refusal.
	watch(() => ids.value.join('\n'), () => { void load(); }, { immediate: true });
	onScopeDispose(context.onCatalogueChanged(() => { void load(); }));
}
