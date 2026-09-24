<script setup lang="ts">
/**
 * The controls under the SELECTED graphic's row (AD09): its user label, and the five things that can
 * be done to it.
 *
 * **It takes the graphic itself, never a row that might not have one**, which is why it is a
 * component rather than a block inside `DesignerPartRow`. There it had to ask `detail === null`
 * three times over — in the action list, in the rename handler and on the rename field's own value —
 * and every one of those was a branch the row model had already ruled out and nothing could ever
 * cover. A component whose prop is an `AssetDetail` asks none of them.
 *
 * They are drawn for the selected row alone. Five buttons and a field on every row would triple the
 * panel's height for an object with a dozen graphics, and the selected row is the one a user has
 * just told the panel they are working on — one press away from any other.
 */
import { computed } from 'vue';
import type { IconName } from 'obsidian';
import type { AssetDetail } from '../../../domain/asset/AssetDetail';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
import type { PartView } from './partView';

/**
 * One control: its `name`, its words, its glyph, whether it has anything to do, and what it does.
 *
 * AD18-R21 Task 7: icon-only now, through `HostIcon`, following `ZoneLockToggle.vue`'s own
 * convention — the glyph draws the CURRENT state (open eye while visible, closed padlock while
 * locked), never the action a press would take, and `label` (still the action, unchanged) is what
 * `aria-label` carries as the accessible name. **No control takes `aria-pressed` (fix round,
 * final-fix-wave)**: the fix round before this one had it swap the name to the state AND carry
 * `aria-pressed` for the same state, so a hidden part announced "Show, toggle button, pressed" —
 * the checked state saying the opposite of what "Show" means. The swapping name alone already
 * carries the state; `aria-pressed` on top of it is a second, contradictory channel, not a
 * confirmation of the first. `ZoneLockToggle.vue` (Plan Editor) carries the identical flaw and is
 * a recorded follow-up rather than fixed here.
 */
interface RowAction {
	readonly name: string;
	readonly label: StringKey;
	readonly icon: IconName;
	readonly disabled: boolean;
	readonly run: () => void;
}

const props = defineProps<{
	detail: AssetDetail;
	view: PartView;
	/** Every graphic id in draw order: what Isolate hides the rest of, and what decides the two order actions. */
	graphicIds: readonly string[];
	reorder: (id: string, direction: 'forward' | 'backward') => void;
	rename: (id: string, label: string) => void;
}>();

const hidden = computed(() => props.view.hidden.value.has(props.detail.id));
const locked = computed(() => props.view.locked.value.has(props.detail.id));

const actions = computed((): readonly RowAction[] => {
	const { id } = props.detail;
	return [
		{ name: 'toggle-hidden', label: hidden.value ? 'designer.parts.show' : 'designer.parts.hide', icon: hidden.value ? 'eye-off' : 'eye', disabled: false, run: () => props.view.toggleHidden(id) },
		{ name: 'toggle-locked', label: locked.value ? 'designer.parts.unlock' : 'designer.parts.lock', icon: locked.value ? 'lock' : 'lock-open', disabled: false, run: () => props.view.toggleLocked(id) },
		{ name: 'isolate', label: 'designer.parts.isolate', icon: 'focus', disabled: false, run: () => props.view.isolate(id, props.graphicIds) },
		// The LAST id draws on top, so Bring forward has nothing to do there and Send backward has
		// nothing to do at the first — `reorderDetail`'s own directions, read off the same array.
		{ name: 'bring-forward', label: 'designer.selection.bring-forward', icon: 'arrow-up', disabled: props.graphicIds.at(-1) === id, run: () => props.reorder(id, 'forward') },
		{ name: 'send-backward', label: 'designer.selection.send-backward', icon: 'arrow-down', disabled: props.graphicIds[0] === id, run: () => props.reorder(id, 'backward') },
	];
});

/**
 * `aria-disabled` and a press that runs nothing, never `:disabled` — `DesignerActionButton`'s own
 * rule: pressing Send backward until the graphic is last would otherwise disable the button holding
 * focus, and Chromium drops focus to `<body>`.
 */
const ariaDisabled = (action: RowAction): 'true' | undefined => (action.disabled ? 'true' : undefined);

function run(action: RowAction): void {
	if (!action.disabled) action.run();
}

function onRename(event: Event): void {
	props.rename(props.detail.id, (event.target as HTMLInputElement).value);
}
</script>

<template>
	<div class="rp-designer-part-controls">
		<label class="rp-designer-field">
			{{ tr('designer.parts.label') }}
			<input
				type="text"
				name="part-label"
				:value="detail.label ?? ''"
				@change="onRename"
			>
		</label>
		<div class="rp-designer-part-actions">
			<button
				v-for="action in actions"
				:key="action.name"
				type="button"
				class="rp-designer-part-action"
				:name="action.name"
				:aria-label="tr(action.label)"
				:aria-disabled="ariaDisabled(action)"
				@click="run(action)"
			>
				<HostIcon :name="action.icon" />
			</button>
		</div>
	</div>
</template>
