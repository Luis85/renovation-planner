<script setup lang="ts">
/**
 * A collapsed full-layout side panel (2026-09-12 side panels spec §1): an expand button, then one
 * button per `PANEL_SECTIONS` entry. It emits which section was asked for — `null` for the expand
 * button — and `EditorSidePanel` does the expanding and the focus move, because only it can see
 * the section once it is drawn again.
 */
import { ref } from 'vue';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
import { PANEL_COPY, PANEL_SECTIONS } from './panelSections';
import type { PanelSide } from './panelLayout';

defineProps<{ side: PanelSide; controls: string }>();
const emit = defineEmits<{ expand: [section: string | null] }>();
const expandButton = ref<HTMLButtonElement | null>(null);

defineExpose({ focusExpand: (): void => (expandButton.value as HTMLButtonElement).focus() });
</script>

<template>
	<div
		class="rp-side-panel__strip"
		:data-rp-strip="side"
	>
		<button
			ref="expandButton"
			type="button"
			class="rp-side-panel__strip-button"
			:data-rp-panel-toggle="side"
			aria-expanded="false"
			:aria-controls="controls"
			:aria-label="tr(PANEL_COPY[side].expand)"
			:title="tr(PANEL_COPY[side].expand)"
			@click="emit('expand', null)"
		>
			<HostIcon :name="side === 'layers' ? 'chevron-right' : 'chevron-left'" />
		</button>
		<button
			v-for="section in PANEL_SECTIONS[side]"
			:key="section.key"
			type="button"
			class="rp-side-panel__strip-button"
			:data-rp-strip-section="section.key"
			:aria-label="tr(section.labelKey)"
			:title="tr(section.labelKey)"
			@click="emit('expand', section.key)"
		>
			<HostIcon :name="section.icon" />
		</button>
	</div>
</template>
