<script setup lang="ts">
/**
 * The Inspector FRAME (component library §8): the ONE `<aside>` and `aria-label` for §60's
 * inspector region, and the routing — FOUR arms since the Add Room increment. The first is
 * about the TASK rather than the selection: while `activeToolId === 'draw-room'` this region
 * is the New room form (`NewRoomInspector.vue`), ahead of everything below it, because the
 * naming step lives in the Inspector rather than in a dialog (Add Room design spec §2.3 — a
 * `FormDialog` would make the rest of the view `inert`, so the user could not re-drag after
 * seeing the numbers). A selection made before the task began is deliberately not drawn
 * beside it: one region, one subject.
 *
 * The other three route by `selectedIds` as they always did — the floor state
 * (`FloorInspector.vue`, Task 7's `buildFloorSummary`) while nothing is selected, the
 * multiple-selection text while several ids are, and the room body (`RoomInspector.vue`,
 * `InspectorPanel.vue` through Task 15) for exactly one. Through Task 14 that body
 * drew its OWN aside and decided this same routing off `InspectorStore.dto.kind`; a second
 * `<aside class="rp-editor-inspector">` nested inside the first would double the landmark
 * `shell.test.ts` asserts is singular, so Task 15 moved both up here and left the body a
 * body.
 *
 * **The `role="status"` return-to-floor announcement (design spec §6.6) lives in
 * `SelectionGuidance.vue` now, not here (R15, 2026-09-04).** `ResponsiveEditorShell` mounts
 * this aside in `constrained` layout only while its drawer is open, so a watcher living here
 * would hear nothing about a selection cleared while the drawer is closed — see
 * [[Selection clearing is silent while the constrained Inspector is closed]]. This component
 * is responsible only for visible Inspector content.
 *
 * **`tabindex="-1"` and `data-rp-region="inspector"` make this aside PROGRAMMATICALLY focusable
 * and nothing else** (R10). A pane growing from `constrained` back to `full` closes the drawer
 * that stood in for this region — the drawer draws this very component inside itself — and the
 * rail button a close would normally return focus to is removed by the same transition, so
 * `ResponsiveEditorShell.measure` focuses this region instead of leaving the keyboard user on
 * `<body>`. `-1` rather than `0` because that is the whole of it: this is a surviving TARGET,
 * not a new Tab stop, and the Inspector's own controls are what a user tabs to. It is the
 * hand-off `NewRoomInspector.onBeforeUnmount` takes as well, for the same reason: the room
 * task ends by returning to Select, which unmounts the very control the user pressed.
 */
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { tr } from '../../i18n/strings';
import { useEditorStore } from '../../stores/EditorStore';
import { useSelectionStore } from '../selection/selection-store';
import FloorInspector from './FloorInspector.vue';
import NewRoomInspector from './NewRoomInspector.vue';
import RoomInspector from './RoomInspector.vue';
import MultiSelectionInspector from './MultiSelectionInspector.vue';
import { useSpatialRecords } from './useSpatialRecords';
import { useProjectStore } from '../../stores/ProjectStore';
import { spatialSelection } from '../selection/spatialSelection';
import StructureInspector from '../structure/StructureInspector.vue';
import RenovationInspector from '../renovation/RenovationInspector.vue';
import { useRenovationSession } from '../renovation/renovationSession';
import { structureRecords } from '../structure/structureRecords';
import { useAssetShapeStore } from '../../stores/AssetShapeStore';
import ElementInspector from '../elements/ElementInspector.vue';
import ElementTaskForm from '../elements/ElementTaskForm.vue';
import AssetPlacementForm from '../elements/AssetPlacementForm.vue';
import { isElementTool } from '../elements/elementDraft';
import StructureTaskForm from '../structure/StructureTaskForm.vue';
import CurveTaskForm from '../curves/CurveTaskForm.vue';
import { isStructureTool } from '../structure/structureDraft';
import GroupControls from '../groups/GroupControls.vue';
import StructureBulkEditAction from '../structure/StructureBulkEditAction.vue';

const { selectedIds } = storeToRefs(useSelectionStore());
const { activeToolId } = storeToRefs(useEditorStore());
const project = useProjectStore();
const rooms = useSpatialRecords();
const renovationSession = useRenovationSession();
const assetShapes = useAssetShapeStore();
const records = computed(() => [...rooms.value, ...structureRecords(project.structure, project.plan?.id ?? '', project.plan?.spatialElements, assetShapes.shapeOf)]);
const selection = computed(() => spatialSelection(selectedIds.value, records.value));

/**
 * Which single-selection body the chain below draws once the review, task-tool and multiple
 * arms have passed — named ONCE, rather than re-derived beside the chain, so the room, structure,
 * element and renovate arms can take `GroupControls` through their `actions` slot (above Delete,
 * side panels spec §3; `RenovationInspector` routes it to its own wall or element body) and the
 * trailing mount is left with the floor alone, which has no Delete.
 */
const body = computed(() => {
	if (renovationSession.perspective === 'renovate') return 'renovate';
	const id = selectedIds.value[0];
	if (id === undefined) return 'floor';
	if (project.structure.walls.some(wall => wall.id === id) || project.structure.openings.some(opening => opening.id === id)) return 'structure';
	if (project.structure.elements?.some(element => element.id === id)) return 'element';
	return 'room';
});
const groupsShown = computed(() => activeToolId.value === 'select' && renovationSession.perspective !== 'review');
</script>

<template>
	<aside
		class="rp-editor-inspector"
		tabindex="-1"
		data-rp-region="inspector"
		:aria-label="tr('editor.inspector')"
	>
		<h2 class="rp-editor-panel-title rp-visually-hidden">
			{{ tr('editor.inspector') }}
		</h2>
		<RenovationInspector v-if="renovationSession.perspective === 'review'" />
		<NewRoomInspector v-else-if="activeToolId === 'draw-room'" />
		<CurveTaskForm v-else-if="activeToolId === 'edit-curves'" />
		<StructureTaskForm v-else-if="isStructureTool(activeToolId)" />
		<ElementTaskForm v-else-if="isElementTool(activeToolId)" />
		<AssetPlacementForm v-else-if="activeToolId === 'place-asset'" />
		<MultiSelectionInspector
			v-else-if="selection.kind === 'multiple'"
			:selection="selection"
		>
			<template #actions>
				<GroupControls />
				<StructureBulkEditAction :ids="selection.ids" />
			</template>
		</MultiSelectionInspector>
		<RenovationInspector v-else-if="body === 'renovate'">
			<template #actions>
				<GroupControls v-if="groupsShown" />
			</template>
		</RenovationInspector>
		<FloorInspector v-else-if="body === 'floor'" />
		<StructureInspector v-else-if="body === 'structure'">
			<template #actions>
				<GroupControls v-if="groupsShown" />
			</template>
		</StructureInspector>
		<ElementInspector v-else-if="body === 'element'">
			<template #actions>
				<GroupControls v-if="groupsShown" />
			</template>
		</ElementInspector>
		<RoomInspector v-else>
			<template #actions>
				<GroupControls v-if="groupsShown" />
			</template>
		</RoomInspector>
		<GroupControls v-if="selection.kind !== 'multiple' && groupsShown && body === 'floor'" />
	</aside>
</template>
