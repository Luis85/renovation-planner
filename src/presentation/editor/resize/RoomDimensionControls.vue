<script setup lang="ts">
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { RoomDimensionDraft } from './roomDimensionDraft';
import { dimensionTexts, type DimensionsText } from './roomDimensions';
import { tr } from '../../i18n/strings';
import InlineRoomDimension from './InlineRoomDimension.vue';
import RoomDimensionButton from './RoomDimensionButton.vue';

type Style = Readonly<Record<string, string>>;
const props = defineProps<{
	box: BoundingBox;
	draft: RoomDimensionDraft | null;
	inlinePreview: (DimensionsText & { area: string }) | null;
	blocked: boolean;
	position: (axis: keyof DimensionsText, bounds: BoundingBox) => Style;
	guides: (bounds: BoundingBox) => { width: Style; depth: Style };
	open: (axis: keyof DimensionsText) => void;
	cancel: () => void;
}>();
const axes = ['width', 'depth'] as const;
</script>

<template>
	<template v-if="draft === null">
		<span
			class="rp-dimension-guide rp-dimension-guide--width"
			:style="guides(box).width"
			aria-hidden="true"
		/>
		<span
			class="rp-dimension-guide rp-dimension-guide--depth"
			:style="guides(box).depth"
			aria-hidden="true"
		/>
	</template>
	<div
		v-for="axis in axes"
		:key="axis"
		class="rp-dimension-anchor"
		:style="position(axis, box)"
	>
		<InlineRoomDimension
			v-if="draft?.axis === axis"
			:draft="draft"
			:cancel="cancel"
		/>
		<div
			v-if="draft?.axis === axis && inlinePreview !== null"
			class="rp-inline-dimension__feedback"
			data-rp-dimension-feedback
		>
			<p>{{ tr('editor.resize.current', dimensionTexts(draft.box)) }}</p>
			<p role="status">{{ tr('editor.resize.preview', inlinePreview) }}</p>
			<p>{{ tr('editor.resize.anchor') }}</p>
		</div>
		<RoomDimensionButton
			v-else
			:axis="axis"
			:text="dimensionTexts(box)[axis]"
			:disabled="blocked || draft !== null"
			@click="open(axis)"
		/>
	</div>
</template>
