<script setup lang="ts">
/**
 * The asset designer's View menu (snapping spec 2026-09-15, §2.6): Grid shows the designer's grid and lets
 * gestures snap to it; Snap to objects turns vertex, edge and alignment snapping on and off. The same two stores the
 * Plan Editor's `EditorViewMenu` drives, per leaf, with its dismissal (`useDisclosureDismissal`); remembered per
 * device by `AssetDesignerRoot`'s `useViewPreferences`. No zoom or fit actions: nothing asked for them here.
 *
 * **The REFERENCE OPACITY row** (AD12-R1) differs from Grid and Snap in
 * both directions worth stating. It is NOT remembered per device: it is a leaf-local view
 * preference held on the runtime as a plain `ref`, written nowhere, exactly as `PartView` is — so
 * it reaches no command, no note, no sidecar and no undo entry, and a reopened leaf starts fully
 * opaque again. And it is DRAWN ONLY while this asset has a reference, because an opacity control
 * over no sheet is the live control that does nothing; the predicate is what stops it being
 * drawn, never a `:disabled`.
 *
 * **The floor is 0.1 and not 0**, deliberately: a fully transparent sheet is indistinguishable
 * from one that failed to load, and this surface's two background notices — missing and
 * unreadable — would then be saying nothing about the picture the user cannot see.
 *
 * **The `All dimensions` row** (AD18-R12) is the reference opacity's kind of row
 * rather than Grid's: a plain `ref` on `useDesignerRuntime()`, leaf-local and persisted nowhere. It
 * widens the on-canvas dimensions from the selection alone to every part. The persisted arm was
 * refused for a layering reason rather than a cost one — `runtime.ts`'s `allDimensions` carries the
 * whole account — and unlike the opacity row it is drawn UNCONDITIONALLY. Both halves of that are
 * deliberate. It has no predicate because every state that withdraws the overlay — an unscaled
 * design, or a drawing tool being active — is one the user changes from moment to moment, where a
 * reference either exists for this asset or does not. And it sits BEFORE the opacity row rather
 * than last, so the rows that are always there keep a fixed order: a row that appears and
 * disappears between two fixed ones would move its neighbour under the pointer.
 *
 * **The `Legend` row** (AD18-R16 Task 4) is `allDimensions`'s kind of row again, by the same
 * AD18-R12 precedent: leaf-local, written nowhere, default ON rather than off. It sits AFTER
 * `All dimensions` and BEFORE the opacity row, for the same fixed-then-conditional ordering that
 * puts opacity last: both `All dimensions` and `Legend` are drawn unconditionally, so the rows
 * that are always there keep one fixed order and the row that appears and disappears stays at
 * the end, where its coming and going cannot move a neighbour under the pointer.
 *
 * **No row is addressed here by its POSITION**, and that is a correction rather than a style: this
 * header called the opacity "the third row" and this one "the fourth" for exactly as long as it
 * took to add a row above the opacity, at which point both sentences were false and the template
 * was the only thing that knew.
 *
 * **There is no lock row and one is not owed.** Every designer layer is `listening: false` and no
 * tool moves the background, so the property a lock names already holds (AD12-R1).
 */
import { computed, ref } from 'vue';
import { useDisclosureDismissal } from '../composables/use-disclosure-dismissal';
import { tr } from '../i18n/strings';
import { useEditorStore } from '../stores/EditorStore';
import { useWorkspaceStore } from '../stores/WorkspaceStore';
import { useDesignerRuntime } from './runtime';
import { useAssetDesignStore } from './stores/assetDesignStore';

const editor = useEditorStore(), workspace = useWorkspaceStore();
const runtime = useDesignerRuntime();
/**
 * Destructured, unlike `runtime` above: a top-level setup binding that IS a `Ref` is unwrapped by
 * the template compiler, which is what lets `v-model` below write the number rather than replace
 * the ref. `runtime.backgroundOpacity` — a property access on a plain object — is not unwrapped,
 * the same trap `DesignerCanvas` records about `editorRefs.activeToolId` from the other side.
 */
const { backgroundOpacity, allDimensions, showLegend } = runtime;
const designStore = useAssetDesignStore();
/** Whether there is a sheet to fade at all. `undefined` while the design is still being read. */
const hasReference = computed(() => (designStore.design?.background ?? null) !== null);
const disclosure = ref<HTMLDetailsElement | null>(null);
const escape = useDisclosureDismissal(disclosure);

/** Refused while a press is held — a pan, or a tool's gesture — as `EditorViewMenu` refuses it: a drag's landing must not change under it. */
function toggleSnap(event: Event): void {
	const input = event.target as HTMLInputElement;
	if (editor.dragState === null && !runtime.toolManager.gestureInFlight) editor.snappingEnabled = input.checked;
	input.checked = editor.snappingEnabled;
}
</script>

<template>
	<details
		ref="disclosure"
		class="rp-view-menu"
		@keydown="escape"
	>
		<summary class="rp-designer-tool-button">
			{{ tr('editor.view') }}
		</summary>
		<div class="rp-view-menu__content">
			<label><input
				v-model="workspace.gridVisible"
				type="checkbox"
				data-rp-view="grid"
			>{{ tr('editor.view.grid') }}</label>
			<label><input
				:checked="editor.snappingEnabled"
				type="checkbox"
				data-rp-view="snap"
				@change="toggleSnap"
			>{{ tr('editor.view.snap') }}</label>
			<label><input
				v-model="allDimensions"
				type="checkbox"
				data-rp-view="all-dimensions"
			>{{ tr('designer.view.all-dimensions') }}</label>
			<label><input
				v-model="showLegend"
				type="checkbox"
				data-rp-view="legend"
			>{{ tr('designer.view.legend') }}</label>
			<label v-if="hasReference">{{ tr('designer.view.reference-opacity') }}<input
				v-model.number="backgroundOpacity"
				type="range"
				min="0.1"
				max="1"
				step="0.1"
				data-rp-view="reference-opacity"
			></label>
		</div>
	</details>
</template>
