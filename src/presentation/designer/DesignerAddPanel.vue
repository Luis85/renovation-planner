<script setup lang="ts">
/**
 * The `Add` half of the Add/Parts rail (AD18 item 5) — the four Basic-shape tools and the door
 * into the preset gallery, the two entry paths a novice has into a drawing.
 *
 * **It answers §4 row 1's complaint rather than the board's picture.** That row is one of only two
 * ADOPT rows, and AD18 item 3's own finding was that "start from a preset" and "draw a shape" were
 * two unrelated mechanisms in two unrelated places — a modal behind an inspector button, and four
 * text buttons in the top toolbar. They are one place now.
 *
 * Three rulings shape it, each taken before this file was written:
 *
 * - **AD18-R3 — the shape buttons MOVE.** They are not duplicated here and not left in the
 *   toolbar. `DesignerToolbar.vue` filters them out of the very list this one filters them into,
 *   over `DESIGNER_TOOL_ICONS`'s `group` field, so the two predicates are complements of each
 *   other over a two-valued type and every registered tool is drawn exactly once. That is the
 *   property `designerAddRail.test.ts` pins against the table rather than against either template.
 * - **AD18-R5 — this STACKS above `DesignerPartsPanel` and is not a tab pair**, in the one
 *   existing rail region. Nothing here is gated on the design: a shape button activates a tool,
 *   which exists whether or not a design has been read, so the rail keeps a condition on one child
 *   and none on the other — the shape `AssetDesignerRoot.vue` already had, and the gate AD18-R2
 *   and AD18-R5 both refuse to move.
 * - **AD18-R6 — the preset door lives HERE and the Inspector's copy is deleted.** It calls the
 *   same `startFromPreset` the empty state's ranked action calls, which is why it is a prop rather
 *   than a second dialog gesture: `startFromPreset` REPLACES the whole design, and two spellings
 *   of that would be two places for the `replaces` warning to differ. The presets stay a MODAL —
 *   board 02 draws the gallery inline in the rail, and a panel labelled `Add` whose gallery wipes
 *   the drawing is a false label at any width.
 *
 * **The buttons are `DesignerToolButton`s, unchanged, which is what makes the move a move.** They
 * carry the same labels (`designer.toolbar.draw-*` — deliberately NOT renamed; `en/designerAdd.ts`
 * carries that argument), the same glyphs, the same `aria-pressed` mirror and the same active
 * class. What differs is the rule that draws them: `styles/designer-add.css` hides the text at
 * EVERY width here, where `styles/designer-toolbar.css` hides it below 80rem — that 80rem is a
 * measurement of the TOOLBAR's row count and says nothing about a rail whose own declared width is
 * capped at `min(11rem, 22cqi)`. Which of the two is right on screen is a rendered question and
 * this file cannot answer it.
 */
import type { IconName } from 'obsidian';
import { tr } from '../i18n/strings';
import type { StringKey } from '../i18n/locales/en';
import type { ToolId } from '../editor/tools/editor-tool';
import { DESIGNER_TOOL_LABELS } from './tools/registerDesignerTools';
import { DESIGNER_TOOL_ICONS } from './tools/designerToolIcons';
import { useDesignerRuntime } from './runtime';
import DesignerToolButton from './DesignerToolButton.vue';

defineProps<{
	/**
	 * The root's own preset gesture, passed in rather than re-spelled — `DesignerEntryPaths`'s
	 * rule, and the reason AD18-R6 can call the Inspector's button a second copy of ONE gesture.
	 */
	startFromPreset: () => Promise<void>;
}>();

const runtime = useDesignerRuntime();

/**
 * The four drawing tools as DATA, filtered out of `DESIGNER_TOOL_ICONS` by its `group` field —
 * the discriminator that table's own docblock says exists for this rail.
 *
 * Read off the ICON table rather than the label table because `group` is what decides membership;
 * the label is then looked up by key, which `DESIGNER_TOOL_LABELS` is total over. `Object.entries`
 * loses the key's literal type, so the row is typed on the way out — the same unchecked step
 * `DesignerToolbar.vue` names, and the reason `designerAddRail.test.ts` clicks every button and
 * asserts the manager's active tool rather than counting them.
 */
const SHAPE_MODES: readonly { readonly id: ToolId; readonly label: StringKey; readonly icon: IconName }[] = Object.entries(DESIGNER_TOOL_ICONS)
	.filter(([, entry]) => entry.group === 'shape')
	.map(([id, entry]) => ({
		id: id as ToolId,
		label: DESIGNER_TOOL_LABELS[id as keyof typeof DESIGNER_TOOL_LABELS] as StringKey,
		icon: entry.icon as IconName,
	}));
</script>

<template>
	<!--
		A `<section>` with a name of its own, exactly as `DesignerPartsPanel` draws one, so the two
		halves of the rail are two named regions rather than one undifferentiated column. It DOES
		carry a class where the Parts panel's deliberately does not: `styles/designer-add.css`
		declares `.rp-designer-add`, so this hook styles something rather than nothing.
	-->
	<section
		class="rp-designer-add"
		:aria-label="tr('designer.add')"
	>
		<h2 class="rp-designer-panel-title">
			{{ tr('designer.add') }}
		</h2>
		<!--
			The group survives the move whole, `role` and name included — it was created in wave 10
			precisely so this card could lift it rather than re-invent it, which is why the label key
			is `designer.shapes.group` and not a toolbar one.
		-->
		<div
			class="rp-designer-add-shapes"
			role="group"
			:aria-label="tr('designer.shapes.group')"
		>
			<DesignerToolButton
				v-for="mode in SHAPE_MODES"
				:key="mode.label"
				:label="mode.label"
				:icon="mode.icon"
				:class="{ 'rp-designer-tool-active': runtime.activeToolId.value === mode.id }"
				:aria-pressed="runtime.activeToolId.value === mode.id"
				@click="runtime.setTool(mode.id)"
			/>
		</div>
		<button
			type="button"
			class="rp-designer-start-preset"
			@click="() => void startFromPreset()"
		>
			{{ tr('designer.inspector.start-preset') }}
		</button>
	</section>
</template>
