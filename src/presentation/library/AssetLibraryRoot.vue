<script setup lang="ts">
/**
 * The Vue root of the Asset library view — one isolated app per Obsidian `ItemView` (ADR-004,
 * SDD §12), exactly as `ViewRoot.vue` and `AssetDesignerRoot.vue` are for their own surfaces.
 *
 * MINIMAL on purpose: Task 11 is the view's Obsidian lifecycle, its registration, its rebind
 * and its two in-app doors, none of which needs the toolbar, the shelves or the inspector §3
 * describes. Tasks 12 through 14 fill this in. What this file proves is the one thing those
 * tasks will build ON — that `context.assetId` and `context.expanded` are read here LIVE, so a
 * selection or an expansion changes what is drawn without the view remounting the tree (§6.3).
 *
 * No `<style>` block, ever: `vue/no-restricted-block` fails one, because Obsidian's
 * marketplace rejects inline styles and this plugin's CSS lives in `styles/`, assembled into
 * one sheet. `.renovation-asset-library` (`styles/asset-library.css`) is this file's one entry
 * point into it.
 */
import { useAssetLibraryContext } from './AssetLibraryContext';
import { tr } from '../i18n/strings';

const context = useAssetLibraryContext();
</script>

<template>
	<div class="renovation-asset-library">
		<h2 class="rp-asset-library__title">
			{{ tr('view.asset-library.title') }}
		</h2>
		<p
			v-if="context.assetId.value === ''"
			class="rp-view-message"
		>
			{{ tr('view.asset-library.unselected') }}
		</p>
		<p
			v-else
			class="rp-view-message"
		>
			{{ context.assetId.value }}
		</p>
	</div>
</template>
