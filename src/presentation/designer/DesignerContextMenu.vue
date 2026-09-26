<script setup lang="ts">
/**
 * Draws the asset designer's context menu — `designerMenu.ts` holds what it is about, where it
 * opens and how it closes, and `AssetDesignerRoot` binds that composable's handlers on its own root.
 * The list itself is the Plan Editor's `CanvasMenuList`, drawn only while the menu is open AND still
 * has a part to be about: a refresh that took the part away leaves nothing to draw, and the next press closes it.
 */
import CanvasMenuList from '../editor/selection/CanvasMenuList.vue';
import { tr } from '../i18n/strings';
import type { DesignerContextMenuState } from './designerMenu';

defineProps<{ menu: DesignerContextMenuState }>();
</script>

<template>
	<div class="rp-context-menu-anchor">
		<CanvasMenuList
			v-if="menu.open && menu.focused !== null"
			:items="menu.items"
			:label="tr('designer.menu')"
			:host="null"
			:position="menu.position"
			@run="menu.run"
			@close="menu.close"
		/>
	</div>
</template>
