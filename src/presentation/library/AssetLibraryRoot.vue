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
 * **`assetId` reaches the DOM only as a `data-*` attribute, never as prose.** An earlier draft
 * printed it as the pane's own text — `{{ context.assetId.value }}` — which is a real asset id
 * a user could read the moment they restore a leaf carrying a selection, since the palette
 * command and both in-app doors are live as of this task and this placeholder is what they
 * open onto. §3.5's own row is Task 14's to build, with a real name resolved from the
 * catalogue; until then, `data-selected-asset-id` carries the same value for a test to observe
 * the in-place-update mechanism without putting an internal identifier in front of anyone.
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
		<!--
			The expanded shelf categories are UI state rather than identifying data — the label
			list §3.2 will eventually put in the shelves themselves — so listing them as plain
			text carries none of `assetId`'s exposure. `data-expanded-categories` sits beside it
			for the same reason `data-selected-asset-id` does: a test asks the DOM rather than
			the injected context directly, which is what actually proves the mechanism reaches
			the rendered tree.
		-->
		<p
			class="rp-asset-library__expanded"
			:data-expanded-categories="context.expanded.value.join(',')"
		>
			{{ context.expanded.value.join(', ') }}
		</p>
	</div>
</template>
