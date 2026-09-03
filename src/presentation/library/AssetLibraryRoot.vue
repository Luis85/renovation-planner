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
 * **Neither `assetId` nor `expanded` reaches the DOM as prose — both are `data-*` attributes on
 * the root, never text a user reads.** An earlier draft printed `assetId` as the pane's own text
 * (`{{ context.assetId.value }}`), which is a real asset id a user could read the moment they
 * restore a leaf carrying a selection, since the palette command and both in-app doors are live
 * as of this task and this placeholder is what they open onto. A review round then found the
 * identical exposure ONE ELEMENT ALONG: `expanded` had moved to its own `<p>` rendering
 * `context.expanded.value.join(', ')` as visible text — raw category keys, in a class no
 * stylesheet declared, and unconditionally, so an empty `<p>` rendered even with nothing
 * expanded. Both attributes now live on the ONE root element, and there is no second element to
 * repeat the mistake on. §3.5's own row and §3.2's shelves are Task 12–14's to build, with real
 * names resolved from the catalogue and real disclosure buttons; until then,
 * `data-selected-asset-id`/`data-expanded-categories` carry the same values for a test to
 * observe the in-place-update mechanism without putting an internal identifier in front of
 * anyone.
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
	<div
		class="renovation-asset-library"
		:data-selected-asset-id="context.assetId.value"
		:data-expanded-categories="context.expanded.value.join(',')"
	>
		<h2 class="rp-asset-library__title">
			{{ tr('view.asset-library.title') }}
		</h2>
		<p
			v-if="context.assetId.value === ''"
			class="rp-view-message"
		>
			{{ tr('view.asset-library.unselected') }}
		</p>
	</div>
</template>
