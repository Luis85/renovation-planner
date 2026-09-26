<script setup lang="ts">
/**
 * Where this object's SCALE comes from (AD12 item 1, contract C07): which sheet it is drawn
 * over, whether that sheet has been calibrated, and which coordinate groups are still in the
 * sheet's own pixels.
 *
 * **It carries exactly ONE action, and the three it merely describes still have their own doors.**
 * The picker (`assetBackgroundPicker.ts`), the toolbar's Calibrate tool and the drawing tools are
 * each bound in `AssetDesignerRoot.vue`, and repeating any of them here would break CLAUDE.md's
 * "one action, every input" rule. What this block owns is the one gesture that had NO door
 * anywhere: taking the reference away again (AD12-R2). It belongs beside the sentence naming the
 * sheet because that sentence is the only place in the designer that says which sheet this is.
 *
 * **The Remove button is drawn only while there IS a sheet** — a predicate, never a `:disabled`,
 * which is the repository's own rule about a control that can only refuse. It is not confirmed
 * either: the gesture goes through `SetAssetBackground`'s reversible adapter like every other one
 * here, so Ctrl+Z puts back both the reference and the calibration that went with it.
 *
 * **`removeBackground` is REQUIRED**, and that is the whole guarantee: `vue-tsc` refuses a parent
 * that does not bind it, which is a stronger instrument than any test, and it closes the
 * optional-with-a-permissive-default shape that shipped `lockedGraphics` as a rule no gate could
 * fire. It was optional for exactly as long as `DesignerInspector.vue` — a file the card that
 * built this one did not own — had not yet bound it, and it stopped being optional in the same
 * commit that bound it, because dropping the marker first is what turns `vue-tsc` red.
 *
 * **`canRemove` therefore asks about the SHEET and nothing else.** The `removeBackground !== undefined`
 * conjunct it used to carry went out with the marker rather than being left standing: with the prop
 * required that arm can never be taken, and an unreachable guard costs a branch it can never pay
 * back — against a tree with roughly nine arms of margin above its branch floor.
 *
 * **The pending lines are the guarantee behind AD12's third acceptance criterion.** Replacing a
 * background clears the CALIBRATION and leaves every per-group flag exactly as it was
 * (`SetAssetBackground`, Decision 5), so a measured outline is not re-flagged and a pending one
 * does not lose its warning. That behaviour was already correct and invisible: the inspector
 * warned about the footprint alone, through `designer.dimensions.unscaled`, and said nothing
 * about a pending clearance, anchor or graphic. This draws all four.
 *
 * **One `<p>` per pending group rather than one sentence listing them**, because a list joined
 * in a template is a translated fragment concatenated with another — what `strings.ts` refuses.
 *
 * **The FACTS block draws nothing for an asset that has no sheet, no calibration and nothing
 * pending**, and that is still right: typing a width and a depth is a whole path through this
 * designer that never touches a reference, and a block of "none" rows would be noise on every asset
 * that took it.
 *
 * **What was wrong is that the whole component then drew nothing, and since AD18-R2 this component
 * is the entire Reference TAB PANEL.** `DesignerInspector.vue`'s own template comment recorded that
 * gap: an asset typed from dimensions with no sheet selected the Reference tab and got an empty
 * panel. So `DesignerTraceChecklist` is a SIBLING of the facts block rather than a child of it —
 * it draws in every state, which is what makes the panel never empty, and in exactly the state that
 * was blank it is the whole answer: step one, `Choose a sheet`, marked as the current step. That is
 * a better sentence than the line the gap note asked for, because it says what to do rather than
 * only what is missing.
 *
 * **The facts block stays FIRST.** A user who has a sheet came here for the sheet; the guide is
 * what is left once those facts are read, and in the state where there are no facts it is the only
 * thing drawn anyway. Both sections head themselves with an `<h3>` — the SAME level, deliberately,
 * because the facts block is the one that disappears: a guide headed `<h4>` would be the panel's
 * first heading in exactly that state, which is the jump axe's `heading-order` reports.
 * `designerTraceChecklist.test.ts` pins the pair in order.
 */
import { computed } from 'vue';
import type { AssetDesignDto } from '../../../application/queries/GetAssetDesign';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import DesignerTraceChecklist from './DesignerTraceChecklist.vue';

const props = defineProps<{ design: AssetDesignDto; removeBackground: () => Promise<void> }>();

/**
 * The sheet's own name, and its page where it has one. The basename rather than the vault
 * path: the inspector is a narrow column, and the leading folders are the part of a path that
 * is never the answer to "which sheet is this".
 */
const sheet = computed(() => {
	const background = props.design.background;
	if (background === null) return tr('designer.reference.sheet.none');
	const name = background.path.slice(background.path.lastIndexOf('/') + 1);
	if (background.page === null) return name;
	return tr('designer.reference.sheet.page', { name, page: String(background.page) });
});

const scale = computed(() =>
	tr(props.design.calibration === null ? 'designer.reference.scale.none' : 'designer.reference.scale.set'),
);

/**
 * Which coordinate groups still hold sheet pixels, in the order the user captured them.
 *
 * Read off the STORED flags, never re-derived from whether a calibration exists — the join
 * `GetAssetDesign`'s own `dimensionsUnscaled` docblock refuses for both of its readings.
 */
const pending = computed((): StringKey[] => {
	const shape = props.design.shape;
	if (shape === null) return [];
	return [
		...(shape.footprintPending ? (['designer.reference.pending.footprint'] as const) : []),
		...(shape.clearancePending ? (['designer.reference.pending.clearance'] as const) : []),
		...(shape.anchorPending ? (['designer.reference.pending.anchor'] as const) : []),
		...(shape.details.some((detail) => detail.pending) ? (['designer.reference.pending.graphics'] as const) : []),
	];
});

/**
 * Both halves, and both are load-bearing: there is a reference to take away, and something is
 * actually bound to take it away with. Either missing and no control is drawn.
 */
const canRemove = computed(() => props.design.background !== null);

const relevant = computed(
	() => props.design.background !== null || props.design.calibration !== null || pending.value.length > 0,
);
</script>

<template>
	<section
		v-if="relevant"
		class="rp-designer-reference"
	>
		<h3 class="rp-designer-panel-title rp-designer-section-title">
			{{ tr('designer.reference') }}
		</h3>
		<dl class="rp-designer-reference-fields">
			<dt>{{ tr('designer.reference.sheet') }}</dt>
			<dd>{{ sheet }}</dd>
			<dt>{{ tr('designer.reference.scale') }}</dt>
			<dd>{{ scale }}</dd>
		</dl>
		<button
			v-if="canRemove"
			type="button"
			name="remove-reference"
			class="rp-designer-selection-button"
			@click="() => void props.removeBackground()"
		>
			{{ tr('designer.reference.remove') }}
		</button>
		<p
			v-for="key in pending"
			:key="key"
			class="rp-designer-unscaled"
		>
			{{ tr(key) }}
		</p>
		<p
			v-if="pending.length > 0"
			class="rp-designer-field-hint"
		>
			{{ tr('designer.reference.pending.hint') }}
		</p>
	</section>
	<!--
		Outside the `v-if` on purpose (AD18 item 7). The guide is the one thing this panel owes an
		asset that has no reference at all, so it is a second root rather than a section inside the
		one that is allowed to disappear.

		`pending.length` rather than the list: the checklist's last step asks only whether ANY
		coordinate group is still in sheet pixels, and the four sentences naming which ones are the
		block above's job.
	-->
	<DesignerTraceChecklist
		:design="design"
		:pending-count="pending.length"
	/>
</template>
