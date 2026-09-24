<script setup lang="ts">
/**
 * AD09's Parts panel: one row per part of the object being designed, so a small graphic can be
 * found, named and isolated without precision clicking.
 *
 * **It is a FINDER over the canonical selection, not a second model of the object.** Every row
 * comes from `partRows` over the shape this leaf already read; selecting a row calls the same
 * `select` a canvas press calls, and the canvas's own selection lights the row back up. Nothing
 * here holds a copy of what is selected (C05: one selected set and a derived primary), and the
 * rows are rebuilt from the design on every read-back rather than mutated.
 *
 * **Groups create no second rendering order and no layer per row** (C06, criterion 6). A group row
 * is a disclosure over rows that are already in the list; collapsing one hides those rows and
 * changes nothing the canvas draws. `details` stays the one draw order — `partRows` reads it from
 * the other end and reorders nothing.
 *
 * **Hiding and locking are leaf-local editing aids** (`partView.ts`, criterion 3). They are ids in
 * a `Set`, never a write, so a hidden graphic is still in the stored shape and still reaches plan
 * placement, the library mark and every quantity derived from the asset. Nothing here can reach a
 * price or a procurement unit either — a part is a piece of one symbol, which is criterion 5 held
 * by the panel having no such data rather than by a rule about not showing it.
 *
 * **Rename writes `label` and never `name`** (C02). The semantic key a preset, a test and
 * `semanticLabel`'s own lookup resolve by is not the user's words for the same graphic.
 *
 * **The row component reads the `PartView` itself.** This template used to hand it eight booleans,
 * each an inline expression repeating the same `row.detail !== null` guard the row already answers
 * once — which is what put BOTH templates over fallow's cognitive budget. The question moved to the
 * component that knows the answer rather than a suppression being written on either.
 *
 * Keyboard: the list is ONE tab stop, and Up/Down/Home/End move focus between rows — WAI-ARIA's
 * roving-tabindex pattern. A row is a `<button>` rather than a listbox `option` because the
 * selected row opens controls beneath it, and interactive controls inside an `option` is invalid
 * ARIA that `tests/harness/accessibility*.test.ts` would be right to refuse.
 */
import { computed, nextTick, ref, watch } from 'vue';
import { rovingIndex } from '../../components/rovingIndex';
import type { AssetDesignDto } from '../../../application/queries/GetAssetDesign';
import { reorderDetail, updateDetail } from '../../../domain/asset/detailEdits';
import { tr } from '../../i18n/strings';
import type { EditShape } from '../selection/editShape';
import { partKey, type DesignerSelection } from '../selection/designerSelection';
import { designerShortcut, focusDropped, selectionKeyActions, selectionKeysRefused, type SelectionKeyGate } from '../designerKeys';
import { partRows, type PartRow } from './partRows';
import type { PartView } from './partView';
import DesignerPartRow from './DesignerPartRow.vue';

const props = defineProps<{
	design: AssetDesignDto;
	/** Every selected part, in selection order (AD08) — every one of them lights its row. */
	selected: readonly DesignerSelection[];
	select: (next: DesignerSelection | null) => void;
	/** The leaf's `editShape`, whose edit may answer `null` for nothing to do — the selection keys' edits do. */
	editShape: EditShape;
	view: PartView;
	/**
	 * Whether the sticky "select multiple" mode is on (AD08). Moved here from
	 * `DesignerInspector`'s Asset block at AD18-R16 Task 7: it is a selection affordance rather
	 * than an asset fact, and AD08-R1 already blesses this panel as C05's accessible alternative
	 * to an overlap chooser.
	 */
	multiSelectionMode?: boolean;
	/**
	 * Turn that mode on or off, or `undefined` where no runtime binds one — the same value-down,
	 * callback-up shape `DesignerInspector` took it in before this task, and for the same reason:
	 * `v-model` on a prop is a mutation of it, which `vue/no-mutating-props` refuses.
	 */
	setMultiSelectionMode?: (next: boolean) => void;
	/**
	 * The leaf's selection store, for the selection keys (AD18-R17 Task 3): their actions read it at the
	 * CALL — a prop re-renders a tick late — and `focus` retargets a member first, as the context menu does.
	 */
	selectionStore: Parameters<typeof selectionKeyActions>[0] & { focus(next: DesignerSelection): void; extend(next: DesignerSelection): void };
	/** The leaf's runtime, asked only whether the keys are refused (`selectionKeysRefused`). */
	tools: SelectionKeyGate;
}>();

/** The row the roving tabindex is on. A KEY rather than an index, so a reorder or a rename moves it with its row. */
const focusedKey = ref<string | null>(null);

/** How many graphics this design has — what decides whether composing a set is even possible. */
const graphicCount = computed(() => props.design.shape?.details.length ?? 0);

/**
 * Whether the multiple-selection toggle can be drawn: the host has to have passed the setter, and
 * either there is more than one graphic to compose or the mode is already on — it STAYS while on,
 * for that control's own reason, since the mode also governs canvas presses and must never be left
 * unreachable. Named rather than inlined for the same GATE `DesignerInspector` named it for before
 * this task moved it: `fallow`'s `maxCognitive` counts every boolean operator inside a `v-if`.
 */
const showMultiSelectToggle = computed(
	() => props.setMultiSelectionMode !== undefined && (graphicCount.value > 1 || props.multiSelectionMode === true),
);

const rows = computed(() => partRows(props.design.shape, { hasReference: props.design.background !== null }));

/** Collapsed group members are dropped from the list, which is the whole of what a group row does. */
const shown = computed(() =>
	rows.value.filter((row) => row.kind === 'group' || row.groupId === null || !props.view.collapsed.value.has(row.groupId)),
);

/**
 * Every graphic id in DRAW order — read back off `rows` rather than off the shape, so there is no
 * `shape === null` arm here that nothing can reach: a shapeless design produces no rows at all, and
 * this list is never asked for. `rows` is topmost-first, so it is reversed back.
 */
const graphicIds = computed(() => rows.value.flatMap((row) => (row.kind === 'detail' ? [row.detail.id] : [])).toReversed());
/**
 * Every read-back forgets the view state of a graphic or group the design no longer has
 * (`PartView.prune`), since ids are recycled — a regrouped `group-1` must not inherit a collapse.
 * `immediate`, so a panel remounted after a failed read prunes what changed while it was away.
 */
watch(
	rows,
	(next) => props.view.prune(new Set(graphicIds.value), new Set(next.flatMap((row) => (row.kind === 'group' ? [row.groupId] : [])))),
	{ immediate: true },
);

const selectedKeys = computed(() => new Set(props.selected.map((member) => partKey(member))));

/** Every row that can take focus, in the order they are drawn — the reference sheet's plain text is not one. */
const focusable = computed(() => shown.value.filter((row) => row.selection !== null || row.kind === 'group'));

/**
 * Where the one tab stop sits: the row that last had focus while it is still in the list, else the
 * first selected row, else the first focusable one. Falling back rather than holding a stale key is
 * what keeps the list reachable after the graphic that had focus is deleted from the inspector.
 */
const tabbableKey = computed((): string => {
	const candidates = focusable.value;
	const remembered = candidates.find((row) => row.key === focusedKey.value);
	// `candidates[0]` without a guard: this is read from inside the `v-for` over `shown`, which the
	// list renders only as the `v-else` of an EMPTY panel — so there is always a row here, and an
	// empty-list arm would be a branch nothing could ever cover.
	return (remembered ?? candidates.find((row) => selectedKeys.value.has(row.key)) ?? candidates[0]).key;
});

const list = ref<HTMLElement | null>(null);

/**
 * A row press: remember it for the roving tabindex, and select what it names — or, with Shift held or
 * `Select multiple` on, ADD it to the selection (`AssetDesignStore.extend`, which takes a member back
 * out and selects a non-graphic alone), the canvas press's own `additive` rule. Until AD18-R20 a row
 * always replaced the selection, so the toggle this panel draws as C05's modifier-free way to build a
 * set built nothing here, and a keyboard user could not group at all.
 *
 * `row.selection` goes through as it is, `null` included, rather than behind a guard. Only the
 * selectable rows bind this — a group header is a disclosure and the reference sheet is plain text —
 * so the null case is unreachable AND harmless on both arms: `select(null)` is the store's own
 * "nothing is selected", and `extend(null)` falls through to that same `select(null)`, since a
 * `null` is not an outline selection.
 *
 * A PLAIN press on a member of a set replaces the set, unlike a plain canvas press on one, which keeps
 * it for a drag (AD08). A row carries no drag, and pressing a row to take it alone is the list's own
 * convention (the Plan Editor's `ElementList`).
 */
function choose(row: PartRow, shift: boolean): void {
	focusedKey.value = row.key;
	if (shift || props.multiSelectionMode === true) props.selectionStore.extend(row.selection as DesignerSelection);
	else props.select(row.selection);
}

/**
 * Up/Down/Home/End over the rows, moving the roving tabindex with the focus.
 *
 * The element is found by its KEY rather than by position in the DOM, so a row that collapsed away
 * between the keypress and this lookup is simply absent instead of handing focus to its neighbour by
 * accident.
 *
 * **ONE guard, over the row rather than over the key.** It used to be two — an empty-list check and a
 * "did this key mean anything" check — and the empty-list one could not fire at all, since the `<ul>`
 * is a `v-else` over a list with rows in it. Indexing and then asking whether a row came back covers
 * both, and covers them from both sides: an unowned key and an out-of-range index land in the same
 * place. An unreachable guard is not free — it costs a branch it can never pay back.
 */
function onKeydown(event: KeyboardEvent): void {
	// Home, End and the arrows typed in a row's Label field move the caret, never the list's focus.
	if ((event.target as Element).matches('input, textarea, select')) return;
	const candidates = focusable.value;
	const from = candidates.findIndex((row) => row.key === tabbableKey.value);
	const next = candidates[rovingIndex(event.key, from, candidates.length, false)];
	if (next === undefined) return;
	event.preventDefault();
	focusedKey.value = next.key;
	list.value?.querySelector<HTMLElement>(`[data-key="${CSS.escape(next.key)}"] button`)?.focus();
}

/**
 * Delete, Ctrl+D, Ctrl+G and Ctrl+Shift+G on a SELECTED part row (AD18-R17 Task 3): the canvas's own
 * `designerShortcut` over `selectionKeyActions`, built here over the leaf's store and `editShape` —
 * the very objects the root builds the canvas's instance from, as `DesignerCanvas` builds its own for
 * the arrows. One function per action, never a copy. The panel is a SIBLING of the canvas, so a key
 * handled here never reaches `onCanvasKeyDown` as well. Refused under `selectionKeysRefused`, the
 * gate the canvas and the menu apply.
 *
 * **A selected member is made the FOCUSED one first** — the menu's `store.focus(part)` — because every
 * per-part action acts on the focused member, and the part under the keyboard is the one meant. Asked
 * as if it already were (the set with this member moved last), and retargeted only once a key is
 * CLAIMED, so a Tab or a letter pressed on a row moves nothing. An UNSELECTED row — one the arrows moved
 * focus to without pressing it — claims nothing, and the host keeps the key.
 */
const keyActions = selectionKeyActions(props.selectionStore, (edit) => props.editShape(edit), props.tools.activeToolId);

function shortcut(event: KeyboardEvent, row: PartRow): void {
	// Only a part row binds this, so the row names a part.
	const part = row.selection as DesignerSelection, selected = props.selectionStore.selected;
	const others = selected.filter((member) => partKey(member) !== row.key);
	if (others.length === selected.length || selectionKeysRefused(props.tools)) return;
	const retarget = (run: () => Promise<void>) => (): void => {
		props.selectionStore.focus(part);
		void keepKeyboard(run, row.key);
	};
	designerShortcut(event, { design: props.design, selected: [...others, part] }, {
		deleteSelection: retarget(keyActions.deleteSelection),
		duplicateSelection: retarget(keyActions.duplicateSelection),
		groupSelection: retarget(keyActions.groupSelection),
		ungroupSelection: retarget(keyActions.ungroupSelection),
	});
}

/**
 * Run a row key's action, and hand focus the browser DROPPED (`focusDropped`, the menu's own rule) to
 * the nearest row STILL DRAWN: the rows below the pressed one nearest first, then the rows above it
 * nearest first, named before the write from the rows as they were and each looked up after it. What
 * the code guarantees is that much and no more — focus goes to a drawn row if one is left, and is left
 * where the browser put it if none is; it never focuses a row that is not there. A leaf CLOSED while
 * the write was in flight has no list, and there is nothing to do.
 *
 * The row below is not always drawn: a read-back carries whatever ELSE changed meanwhile, and a row can
 * be folded away under a collapsed group — which `PartView.prune` keeps from happening to a group
 * just made, but this does not rely on it.
 */
async function keepKeyboard(run: () => Promise<void>, key: string): Promise<void> {
	const keys = focusable.value.map((each) => each.key), at = keys.indexOf(key);
	const candidates = [...keys.slice(at + 1), ...keys.slice(0, at).toReversed()];
	await run();
	await nextTick();
	const drawn = list.value;
	if (drawn === null || !focusDropped()) return;
	const found = candidates
		.map((each) => ({ key: each, button: drawn.querySelector<HTMLElement>(`[data-key="${CSS.escape(each)}"] button`) }))
		.filter((each): each is { key: string; button: HTMLElement } => each.button !== null);
	// At most one: the nearest drawn row, or none — never a lookup that found nothing.
	for (const nearest of found.slice(0, 1)) {
		focusedKey.value = nearest.key;
		nearest.button.focus();
	}
}

function rename(id: string, label: string): void {
	void props.editShape((shape) => updateDetail(shape, id, { label }));
}

function reorder(id: string, direction: 'forward' | 'backward'): void {
	void props.editShape((shape) => reorderDetail(shape, id, direction));
}
</script>

<template>
	<!--
		No class here. `AssetDesignerRoot.vue`'s `.rp-designer-parts` div carries the width, the
		padding, the background and the border, so an own class here would style nothing and
		`libraryComponentStyles.test.ts` would be right to flag it undeclared — exactly the split
		`DesignerInspector`'s own `<aside>` takes, for the same reason. Kept as a landmark for its
		`aria-label`.

		**This `<section>` stopped being the WHOLE content of that div at AD18 item 5**, which is
		what this comment used to claim: `DesignerAddPanel` is stacked above it in the same region
		under AD18-R5. The split is unchanged and so is the reason for it — the div still owns the
		box — but the two siblings are no longer symmetrical about it, and `DesignerAddPanel` DOES
		carry a class, because `styles/designer-add.css` declares rules for one. A class is owed
		where rules exist for it and refused where none do; that is the rule, and "this is the only
		child" never was.
	-->
	<section :aria-label="tr('designer.parts')">
		<h2 class="rp-designer-panel-title">
			{{ tr('designer.parts') }}
		</h2>
		<!--
			C05 / AD08: the control that lets a keyboard or a touch user build a selection without a
			modifier — moved here from the Inspector's Asset block (AD18-R16 Task 7), since it is a
			selection affordance rather than an asset fact and AD08-R1 already blesses this panel as
			C05's accessible alternative to an overlap chooser. The Plan Editor's own "Select multiple
			elements" checkbox, in the panel that governs the same gesture — same shape, same binding,
			so the two surfaces behave alike (C12). It STAYS while on, for that control's own reason:
			the mode also governs canvas presses, so it must never be left unreachable. Under the
			heading and above every other control here, so it reads as governing the whole list below.
		-->
		<label
			v-if="showMultiSelectToggle"
			class="rp-designer-multi-select"
		>
			<input
				type="checkbox"
				data-rp-action="multiple-selection"
				:checked="multiSelectionMode === true"
				@change="setMultiSelectionMode?.(($event.target as HTMLInputElement).checked)"
			>
			{{ tr('designer.selection.toggle-mode') }}
		</label>
		<!--
			The way back from any hidden graphic, drawn only while something IS hidden (criterion 4):
			one press restores everything, whether it was hidden one at a time or by an isolation.
		-->
		<button
			v-if="view.hidden.value.size > 0"
			type="button"
			class="rp-designer-parts-show-all"
			@click="view.showAll"
		>
			{{ tr('designer.parts.show-all') }}
		</button>
		<p
			v-if="shown.length === 0"
			class="rp-designer-parts-empty"
		>
			{{ tr('designer.parts.empty') }}
		</p>
		<ul
			v-else
			ref="list"
			class="rp-designer-part-list"
			@keydown="onKeydown"
		>
			<DesignerPartRow
				v-for="row in shown"
				:key="row.key"
				:data-key="row.key"
				:row="row"
				:selected="selectedKeys.has(row.key)"
				:tabbable="row.key === tabbableKey"
				:view="view"
				:graphic-ids="graphicIds"
				:choose="(shift: boolean) => choose(row, shift)"
				:shortcut="(event: KeyboardEvent) => shortcut(event, row)"
				:reorder="reorder"
				:rename="rename"
			/>
		</ul>
	</section>
</template>
