<script setup lang="ts">
/**
 * The three modes a selected outline is edited in (asset designer symbols spec, Decision 10) —
 * Transform, Edit points, Bend edges — so a rectangle's box handles and its vertex handles never
 * compete for one pointer.
 *
 * Mounted by `DesignerToolbar` only while Select is active and an OUTLINE is selected; the anchor and
 * the facing have no modes. Choosing a mode writes nothing: it is `assetDesignStore.setMode`, and the
 * store resets it to Transform whenever a different part is selected.
 *
 * **A `group` of toggle buttons carrying `aria-pressed`, not a `radiogroup`** — the toolbar around it
 * already speaks that way, and a radiogroup owes roving focus and arrow keys this control does not have.
 *
 * **Its buttons ARE `.rp-designer-tool-button`s**, inside the toolbar's `.rp-designer-tools`, so the
 * flat-button rules and the active-state rule that already win Obsidian's
 * `button:not(.clickable-icon)` contest (`buttonSpecificity.test.ts`) style them — no second button
 * rule to argue. `styles/designer.css` adds only the group's own rule.
 */
import { tr } from '../i18n/strings';
import type { StringKey } from '../i18n/locales/en';
import type { SelectionMode } from './selection/designerSelection';
import { useAssetDesignStore } from './stores/assetDesignStore';

const store = useAssetDesignStore();

const MODES: readonly { readonly id: SelectionMode; readonly label: StringKey }[] = [
	{ id: 'transform', label: 'designer.selection.mode.transform' },
	{ id: 'points', label: 'designer.selection.mode.points' },
	{ id: 'bend', label: 'designer.selection.mode.bend' },
];
</script>

<template>
	<div
		class="rp-designer-selection-modes"
		role="group"
		:aria-label="tr('designer.selection.mode')"
	>
		<button
			v-for="mode in MODES"
			:key="mode.id"
			type="button"
			class="rp-designer-tool-button"
			:class="{ 'rp-designer-tool-active': store.mode === mode.id }"
			:aria-pressed="store.mode === mode.id"
			:title="tr(mode.label)"
			@click="store.setMode(mode.id)"
		>
			{{ tr(mode.label) }}
		</button>
	</div>
</template>
