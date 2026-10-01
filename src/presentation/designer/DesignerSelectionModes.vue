<script setup lang="ts">
/**
 * The modes a selected outline is edited in (asset designer symbols spec, Decision 10) — Transform,
 * Edit points, Bend edges — so a rectangle's box handles and its vertex handles never compete for
 * one pointer.
 *
 * Mounted by `DesignerToolbar` only while Select is active and an OUTLINE is selected; the anchor and
 * the facing have no modes. Choosing a mode writes nothing: it is `assetDesignStore.setMode`, and the
 * store resets it to Transform whenever a different part is selected.
 *
 * **An OPEN graphic is offered Transform and nothing else** (AD11 review, finding 1).
 * `selection/handles.ts`'s `selectionHandles` opens with `outlineOf`, which answers `null` for a
 * path, so it returns `[]` in every mode: Edit points drew no vertex handles and Bend edges drew no
 * edge handles, and both buttons sat enabled on the card's very first gesture, since `completeDetail`
 * returns to Select with the new line selected. **Dropped rather than `:disabled`**, which is the
 * shape AD10's review accepted for the Arrange panel — *"Which parts a control needs is what decides
 * whether it is DRAWN, never a `:disabled`"* (`DesignerArrangePanel.vue`) — so the two surfaces answer
 * "this part cannot do that" the same way. Transform STAYS because its gesture works: a body drag
 * (`dragSnap.snapBody` via `partPoints`) and the inspector's centre, size and rotate-by fields
 * (`mapPartOutline`, which keeps a graphic's kind). What it does not draw is a box or a rotate
 * handle, and that is said in its tooltip rather than left in this docblock, where no user is.
 *
 * Nothing has to unwind a mode on the way in: `select` resets the mode to Transform for any
 * different part, so `points` and `bend` cannot be live while an open graphic is selected and their
 * buttons are absent.
 *
 * **A `group` of toggle buttons carrying `aria-pressed`, not a `radiogroup`** — the toolbar around it
 * already speaks that way, and a radiogroup owes roving focus and arrow keys this control does not have.
 *
 * **Its buttons ARE `.rp-designer-tool-button`s**, inside the toolbar's `.rp-designer-tools`, so the
 * flat-button rules and the active-state rule that already win Obsidian's
 * `button:not(.clickable-icon)` contest (`buttonSpecificity.test.ts`) style them — no second button
 * rule to argue. `styles/designer-selection.css` adds only the group's border and the pressed mode's
 * plain border, which is what sets a mode apart from a pressed tool.
 *
 * **Each button's `title` names the gesture its mode offers** — which handles a mode draws says nothing
 * about what dragging them does — using the `title` tooltip both designer toolbars already use. The button's
 * TEXT stays its accessible name; a `title` beside visible text is read as its description.
 */
import { computed } from 'vue';
import { tr } from '../i18n/strings';
import type { StringKey } from '../i18n/locales/en';
import { isOpenGraphicSelection, type SelectionMode } from './selection/designerSelection';
import { useAssetDesignStore } from './stores/assetDesignStore';

const store = useAssetDesignStore();

interface ModeRow {
	readonly id: SelectionMode;
	readonly label: StringKey;
	readonly tip: StringKey;
}

const MODES: readonly ModeRow[] = [
	{ id: 'transform', label: 'designer.selection.mode.transform', tip: 'designer.selection.mode.transform.tip' },
	{ id: 'points', label: 'designer.selection.mode.points', tip: 'designer.selection.mode.points.tip' },
	{ id: 'bend', label: 'designer.selection.mode.bend', tip: 'designer.selection.mode.bend.tip' },
];

/**
 * An OPEN graphic's one mode. Same id and same label as Transform above — it IS Transform — with the
 * tooltip naming the gesture a path actually offers rather than the handles it has none of.
 */
const OPEN_MODES: readonly ModeRow[] = [{ id: 'transform', label: 'designer.selection.mode.transform', tip: 'designer.selection.mode.transform.open' }];

/**
 * Is the selected part an open graphic? Asked of `shape.details` directly rather than through
 * `outlineOf`, which answers `null` for an open graphic AND for a part that is not there — the same
 * conflation `selectionExists` records having been bitten by. The footprint and the clearance are
 * `CurvedPolygon`s by type and can never be the open case, so only a `detail` selection has a
 * question to ask.
 */
const openGraphic = computed((): boolean => isOpenGraphicSelection(store.design?.shape, store.selection));

const modes = computed((): readonly ModeRow[] => (openGraphic.value ? OPEN_MODES : MODES));
</script>

<template>
	<div
		class="rp-designer-selection-modes"
		role="group"
		:aria-label="tr('designer.selection.mode')"
	>
		<button
			v-for="mode in modes"
			:key="mode.id"
			type="button"
			class="rp-designer-tool-button"
			:class="{ 'rp-designer-tool-active': store.mode === mode.id }"
			:aria-pressed="store.mode === mode.id"
			:title="tr(mode.tip)"
			@click="store.setMode(mode.id)"
		>
			{{ tr(mode.label) }}
		</button>
	</div>
</template>
