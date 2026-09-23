<script setup lang="ts">
/**
 * The inspector's COMPOSITION block (AD10, contract C06): group and ungroup the selected graphics,
 * move a group to either end of the drawing order, align them, space them out, transform them as
 * one body and repeat them along an axis.
 *
 * **Every control is one `editShape` call over a pure domain edit** — `DesignerSelectionInspector`'s
 * own door, not a second one — so a gesture here is ONE `SetAssetShape` conditional on the version
 * the step read, one undo entry, and nothing at all when the edit refuses. Nothing in this file
 * computes geometry; `domain/asset/arrangeDetails.ts` and `groupEdits.ts` do, and this chooses which
 * of them to call and with what.
 *
 * **It acts on the SET, where the section above it acts on the primary.** The two are siblings
 * rather than nested for that reason: a width field that belongs to one part and an alignment that
 * belongs to several are different subjects, and the count line `DesignerInspector` draws above both
 * says which is which.
 *
 * **A LOCKED graphic refuses the whole operation rather than being left out of it.** The lock is
 * leaf-local UI state (`parts/partView.ts`) and the domain knows nothing about it; this panel hands
 * the locked ids over as `immovable` and `resolveParticipants` refuses, which is what keeps a
 * half-aligned design impossible. The refusal says so, in the alert below.
 *
 * Which parts a control needs is what decides whether it is DRAWN, never a `:disabled` — a button
 * offering an arrangement two parts cannot have is the live control that does nothing this
 * repository refuses. So align appears at two graphics, distribute at three, a group's ordering
 * actions only where the focused graphic is in one, and **Group only where every selected graphic
 * is still ungrouped**: with all of them already in one, the only outcome the button has is
 * `overlapping-groups`, which is the same defect wearing a refusal.
 *
 * **A gesture that would change nothing writes nothing** (contract C05). `commit` answers
 * `editShape`'s `null` whenever the edit hands back the very shape it was given, which is what the
 * pure edits do for an alignment already aligned, a row already even, a move of zero and a group
 * already at that end. `null` resolves `no-write`, so no `SetAssetShape` is dispatched and
 * `CommandHistory` pushes no entry — the guard has to live here rather than in the command, because
 * `SetAssetShapeCommand` compares nothing by design and history pushes for any ok result. One place
 * closes every control this panel has and every one it grows.
 */
import { computed, ref, watch } from 'vue';
import type { IconName } from 'obsidian';
import type { AssetDesignDto } from '../../../application/queries/GetAssetDesign';
import type { AppError } from '../../../core/errors/AppError';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import {
	alignDetails,
	distributeDetails,
	type AlignEdge,
	type AlignReference,
	type ArrangeAxis,
	type SpacingMode,
} from '../../../domain/asset/arrangeDetails';
import { groupDetails, groupOfDetail, moveGroupToEnd, ungroupDetails } from '../../../domain/asset/groupEdits';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import type { EditShape, ShapeEdit } from '../selection/editShape';
import type { DesignerSelection } from '../selection/designerSelection';
import { semanticLabel } from '../parts/partNames';
import DesignerActionRow from './DesignerActionRow.vue';
import DesignerSetTransform from './DesignerSetTransform.vue';
import DesignerRepeatForm from './DesignerRepeatForm.vue';

const props = defineProps<{
	design: AssetDesignDto;
	/** Every selected part in SELECTION order; only the graphics among them take part. */
	selected: readonly DesignerSelection[];
	editShape: EditShape;
	/** The leaf's locked graphic ids (`PartView.locked`), handed to the domain as `immovable`. */
	locked: ReadonlySet<string>;
}>();

interface Action {
	readonly name: string;
	readonly label: StringKey;
	readonly run: () => void;
	readonly icon?: IconName;
}

const ALIGN_EDGES: readonly AlignEdge[] = ['left', 'centre-x', 'right', 'top', 'centre-y', 'bottom'];
const DISTRIBUTIONS: ReadonlyArray<readonly [SpacingMode, ArrangeAxis]> = [
	['centres', 'x'],
	['centres', 'y'],
	['gaps', 'x'],
	['gaps', 'y'],
];

/**
 * AD18-R16 Task 10: both boards draw align and distribute as an icon row rather than the ten text
 * buttons this panel drew before. Every one of the ten pinned Lucide names below exists at the
 * pinned revision under its own spelling — none is a closest-match substitute — so this is a plain
 * lookup rather than a fallback table.
 */
const ALIGN_ICONS: Readonly<Record<AlignEdge, IconName>> = {
	left: 'align-horizontal-justify-start',
	'centre-x': 'align-horizontal-justify-center',
	right: 'align-horizontal-justify-end',
	top: 'align-vertical-justify-start',
	'centre-y': 'align-vertical-justify-center',
	bottom: 'align-vertical-justify-end',
};

const DISTRIBUTE_ICONS: Readonly<Record<`${SpacingMode}-${ArrangeAxis}`, IconName>> = {
	'centres-x': 'align-horizontal-distribute-center',
	'centres-y': 'align-vertical-distribute-center',
	'gaps-x': 'align-horizontal-space-between',
	'gaps-y': 'align-vertical-space-between',
};

const refusal = ref<AppError | null>(null);
/** Which reference an alignment holds still. Ephemeral: a choice about the next gesture, never data. */
const reference = ref<'bounds' | 'key'>('bounds');

/** Read only where `graphics` is non-empty, which already implies the design has a shape. */
const shape = computed(() => props.design.shape as AssetShape);

/**
 * The selected GRAPHICS, in selection order, so the last is the one a key-object alignment names.
 *
 * Filtered against the shape as well as the selection: the store prunes a member whose part a write
 * removed, and this covers the frame between the write and that read — the guard
 * `DesignerSelectionInspector` states for the same reason.
 */
const graphics = computed(() =>
	props.selected.flatMap((part) => (part.kind === 'detail' && onShape(part.id) ? [part.id] : [])),
);

function onShape(id: string): boolean {
	return props.design.shape?.details.some((detail) => detail.id === id) === true;
}

const primary = computed(() => graphics.value.at(-1) ?? null);

/** The group the FOCUSED graphic is in — what ungroup and the two ordering actions act on. */
const group = computed(() => (primary.value === null ? null : groupOfDetail(shape.value, primary.value)));

/** What the key-object option is called: the focused part's own name, so the choice names a part. */
const keyName = computed(() => {
	const detail = props.design.shape?.details.find((item) => item.id === primary.value);
	return detail === undefined ? '' : (detail.label ?? semanticLabel(detail.name));
});

/**
 * One control's edit, dispatched unless it would change nothing.
 *
 * The comparison is IDENTITY against the shape the step was handed, not a deep equality: the pure
 * edits answer their own input object for a no-op precisely so this one line can tell them apart,
 * and a structural comparison of two whole shapes per press would be both slower and kinder than
 * the rule needs to be.
 */
async function commit(edit: ShapeEdit): Promise<boolean> {
	const result = await props.editShape((current) => {
		const next = edit(current);
		return next.ok && next.value === current ? null : next;
	});
	refusal.value = result.ok ? null : result.error;
	return result.ok;
}

/** The selection as the domain takes it, with the leaf's locks translated into `immovable`. */
function selection(): { readonly ids: readonly string[]; readonly immovable: ReadonlySet<string> } {
	return { ids: graphics.value, immovable: props.locked };
}

function alignReference(): AlignReference {
	return reference.value === 'key' && primary.value !== null ? { kind: 'key', id: primary.value } : { kind: 'bounds' };
}

function orderActions(groupId: string): Action[] {
	return [
		{ name: 'ungroup', label: 'designer.arrange.ungroup', run: () => void commit((current) => ungroupDetails(current, groupId)) },
		{ name: 'group-front', label: 'designer.arrange.group-front', run: () => void commit((current) => moveGroupToEnd(current, groupId, 'front')) },
		{ name: 'group-back', label: 'designer.arrange.group-back', run: () => void commit((current) => moveGroupToEnd(current, groupId, 'back')) },
	];
}

/** Two or more graphics, none of them already grouped — the whole of what `groupDetails` can accept. */
const groupable = computed(
	() => graphics.value.length > 1 && graphics.value.every((id) => groupOfDetail(shape.value, id) === null),
);

const groupActions = computed((): Action[] => [
	...(groupable.value
		? [{ name: 'group', label: 'designer.arrange.group' as StringKey, run: () => void commit((current) => groupDetails(current, graphics.value)) }]
		: []),
	...(group.value === null ? [] : orderActions(group.value.id)),
]);

const alignActions = computed((): Action[] =>
	graphics.value.length < 2
		? []
		: ALIGN_EDGES.map((edge) => ({
				name: `align-${edge}`,
				label: `designer.arrange.align.${edge}` as StringKey,
				icon: ALIGN_ICONS[edge],
				run: () => void commit((current) => alignDetails(current, { ...selection(), edge, reference: alignReference() })),
			})),
);

const distributeActions = computed((): Action[] =>
	graphics.value.length < 3
		? []
		: DISTRIBUTIONS.map(([spacing, axis]) => ({
				name: `distribute-${spacing}-${axis}`,
				label: `designer.arrange.distribute.${spacing}-${axis}` as StringKey,
				icon: DISTRIBUTE_ICONS[`${spacing}-${axis}`],
				run: () => void commit((current) => distributeDetails(current, { ...selection(), axis, spacing })),
			})),
);
// A refusal is about the selection that RAISED it, so a new selection must not inherit one: a stale
// alert beside parts it was never about reads as a refusal of the gesture nobody has made yet.
// Watched on the id LIST rather than on `graphics` itself: that computed also depends on the design,
// so it answers a fresh array after any refresh, and watching the array would clear a refusal on a
// peer leaf's write as well as on a real change of selection.
watch(
	() => graphics.value.join(','),
	() => {
		refusal.value = null;
	},
);
</script>

<template>
	<section
		v-if="graphics.length > 0"
		class="rp-designer-arrange"
	>
		<h3 class="rp-designer-panel-title rp-designer-section-title">
			{{ tr('designer.arrange') }}
		</h3>
		<DesignerActionRow :actions="groupActions" />
		<label
			v-if="graphics.length > 1"
			class="rp-designer-field"
		>
			{{ tr('designer.arrange.reference') }}
			<select
				name="align-reference"
				:value="reference"
				@change="reference = ($event.target as HTMLSelectElement).value === 'key' ? 'key' : 'bounds'"
			>
				<option value="bounds">
					{{ tr('designer.arrange.reference.bounds') }}
				</option>
				<option value="key">
					{{ tr('designer.arrange.reference.key', { name: keyName }) }}
				</option>
			</select>
		</label>
		<DesignerActionRow
			:actions="alignActions"
			class="rp-designer-arrange-align"
		/>
		<DesignerActionRow
			:actions="distributeActions"
			class="rp-designer-arrange-distribute"
		/>
		<DesignerSetTransform
			:ids="graphics"
			:locked="locked"
			:commit="commit"
		/>
		<DesignerRepeatForm
			:shape="shape"
			:ids="graphics"
			:commit="commit"
		/>
		<p
			v-if="refusal !== null"
			role="alert"
			class="rp-designer-selection-error"
		>
			{{ trError(refusal) }}
		</p>
	</section>
</template>