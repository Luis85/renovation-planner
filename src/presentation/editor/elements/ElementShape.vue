<script setup lang="ts">
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import type { StairOptions } from '../../../domain/spatial/stairGeometry';
import type { ThemeTokens } from '../theme/themeTokens';
import StairShape from './StairShape.vue';
import DirectionArrowShape from './DirectionArrowShape.vue';
import StructuralShape from './StructuralShape.vue';
import DraftingShape from './DraftingShape.vue';
/** One element's drawn shape, out of `ElementShapes.vue`'s template and into its own file so this
 *  per-item branch chain has its own fallow complexity budget rather than sharing one with the
 *  `v-for` and the group that wraps it. `line`/`marks`/`label`/`handles` are opaque Konva
 *  configs (vue-konva's own `config` prop is `Record<string, unknown>`) — nothing here reads
 *  their fields, only passes them through. */
interface ElementShapeItem {
	id: string;
	name: string;
	element: NamedSpatialElement;
	selected: boolean;
	single: boolean;
	structural: boolean;
	drafting: boolean;
	stair: StairOptions | undefined;
	handles: readonly Record<string, unknown>[];
	marks: Record<string, unknown> | null;
	line: Record<string, unknown>;
	label: Record<string, unknown> | null;
}
defineProps<{ shape: ElementShapeItem; tokens: ThemeTokens; zoom: number }>();
</script>
<template>
	<StairShape
		v-if="shape.stair"
		:points="shape.element.points"
		:options="shape.stair"
		:selected="shape.selected"
		:tokens="tokens"
		:zoom="zoom"
	/>
	<DirectionArrowShape
		v-else-if="shape.element.kind === 'arrow'"
		:points="shape.element.points"
		:selected="shape.selected"
		:editable="shape.single"
		:tokens="tokens"
		:zoom="zoom"
	/>
	<StructuralShape
		v-else-if="shape.structural"
		:element="shape.element"
		:selected="shape.selected"
		:tokens="tokens"
		:zoom="zoom"
	/>
	<DraftingShape
		v-else-if="shape.drafting"
		:element="shape.element"
		:selected="shape.selected"
		:tokens="tokens"
		:zoom="zoom"
	/>
	<VLine
		v-else
		:config="shape.line"
	/>
	<VCircle
		v-for="(handle, index) in shape.handles"
		:key="index"
		:config="handle"
	/>
	<VShape
		v-if="shape.marks"
		:config="shape.marks"
	/>
	<VText
		v-if="shape.label"
		:config="shape.label"
	/>
</template>
