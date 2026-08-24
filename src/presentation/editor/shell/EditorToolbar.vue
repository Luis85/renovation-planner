<script setup lang="ts">
/**
 * §60's toolbar region. Empty: tool buttons arrive with slice 6's `EditorTool` framework,
 * and there is no tool to press yet.
 *
 * It exists now so that slice 6 adds buttons rather than adding a region — the five §60
 * regions are a layout contract, and a toolbar introduced later would change every other
 * region's size on the day it appeared.
 *
 * A `<div role="toolbar">` and not an empty `<nav>`: the role is what it will BE, and an
 * empty toolbar is a legitimate toolbar, whereas an empty landmark is a thing screen
 * reader users are offered and find nothing in.
 */
import { tr } from '../../i18n/strings';
</script>

<template>
	<div
		class="rp-editor-toolbar"
		role="toolbar"
		:aria-label="tr('editor.toolbar')"
	/>
</template>
