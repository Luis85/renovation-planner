<script setup lang="ts">
/**
 * Where the user was, as a row (design spec §7).
 *
 * **The same armature as every other row**, distinguished by its group heading and by carrying a
 * SECOND action — never by being a different shape. A raised card above a flat list is the
 * composition this direction did not lock, and drawing one here would be adopting the
 * continue-first structure's form while claiming the launcher's.
 *
 * It is a `<div>` with two `<button>`s rather than a `<button>` with two inside it, which is
 * invalid HTML and is also the composite §7 refuses: a roving list whose first item contains
 * its own controls forces a grid pattern onto everything below it. That is the other half of
 * why this row sits OUTSIDE the `Projects` list rather than at the top of it.
 *
 * **`Continue` and `Open` are two destinations, not one with a shortcut.** Continue restores
 * where the user was — the plan editor, when the context names a plan; the detail state
 * otherwise — and Open ALWAYS opens the detail state. That distinction is A.4's own and it is
 * what the usability script in the workspace prototype spec §13 is written to test.
 */
import { computed } from 'vue';
import type { PlanSummaryDto, ProjectSummaryDto } from '../read-models/PlanDto';
import { statusLabel } from './statusLabel';
import { currentLanguage, tr } from '../i18n/strings';
import { opensNote } from './platformModifier';

/**
 * **No `planId` here, deliberately** — the brief that specified this component's own interface
 * named one, and `fallow`'s `unused component prop` check is what caught it: this component
 * reads nothing off an id, only off the RESOLVED `plan`, and the eventual `resume` emit is
 * payload-less by design (the mount site already holds the project and the plan id, and supplies
 * both when it re-emits — see `ProjectList.vue`). A prop nothing inside a component reads is
 * exactly the class of defect `unused-component-props` exists to catch.
 */
const props = defineProps<{
	readOnly?: boolean;
	project: ProjectSummaryDto;
	/** The resolved plan this will resume, or `null` when the context names the project alone. */
	plan: PlanSummaryDto | null;
}>();
const emit = defineEmits<{ resume: []; open: []; openNote: [] }>();

/**
 * `Open` takes the SAME three-arm gesture every other row's target takes — platform modifier
 * opens the note, plain activates, anything else does neither — through the same `opensNote`
 * predicate, so this pane has one gesture vocabulary rather than one per component.
 *
 * **`Continue` deliberately takes none of it.** Resume restores a context — the plan editor when
 * one names a plan — and a note is not a context; a modifier there would have to mean something
 * this row has not been asked to define.
 */
function onOpen(event: MouseEvent): void {
	if (opensNote(event)) {
		event.preventDefault();
		emit('openNote');
		return;
	}
	if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
	emit('open');
}

/**
 * **The autoscroll widget is suppressed HERE, on `mousedown`, and cannot be suppressed on
 * `auxclick`.** Chrome opens it as a default action of the PRESS; `auxclick` fires only after the
 * button is released, by which point the widget has already opened, so cancelling that event
 * cancels nothing. `ProjectRow` learned this against the plan text and this row shipped the
 * pre-fix shape three tasks later — the same gesture vocabulary claim in this file's own header
 * is what makes the two doors owe each other the same handler.
 */
function onOpenMouseDown(event: MouseEvent): void {
	if (event.button === 1) event.preventDefault();
}

/**
 * The middle button, which fires `auxclick` and never `click`. `2` is the context menu's.
 *
 * It only EMITS: the autoscroll suppression this door cannot deliver lives at
 * `onOpenMouseDown`, above.
 */
function onOpenAux(event: MouseEvent): void {
	if (event.button !== 1) return;
	emit('openNote');
}

/**
 * An ABSOLUTE short date, never a relative time (§8). A relative time needs a live ticker,
 * makes every test time-dependent, and `Last opened yesterday` is a wireframe's nicety rather
 * than a requirement.
 *
 * Empty rather than a dash when there is no date, per the content rule: a slot with nothing in
 * it renders nothing and its neighbours close up.
 */
const worked = computed(() => {
	if (props.project.lastWorked === null) return '';
	return new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'medium' }).format(
		new Date(props.project.lastWorked),
	);
});
</script>

<template>
	<div class="rp-project-list__row rp-continue">
		<!--
			The project AND the work inside it — §7's diagram is `House Renovation 2026 ·
			Kitchen › Work`, and the plan half is what makes the row answer "which plan will
			this open" on a project that has several. Absent, not blank, when the context names
			no plan: the content rule is that an empty slot renders nothing and its neighbours
			close up.
		-->
		<span
			class="rp-project-list__name"
			:title="plan === null ? project.name : `${project.name} · ${plan.name}`"
		>{{ project.name }}<span
			v-if="plan !== null"
			class="rp-continue__plan"
		> · {{ plan.name }}</span></span>
		<span class="rp-project-row__facts">{{ worked }}</span>
		<span class="rp-project-list__status">{{ statusLabel(project.status) }}</span>
		<button
			type="button"
			class="rp-continue__resume"
			:disabled="readOnly && plan !== null"
			@click="$emit('resume')"
		>
			{{ tr('view.project.continue.resume') }}
		</button>
		<button
			type="button"
			class="rp-continue__open"
			@mousedown="onOpenMouseDown"
			@click="onOpen"
			@auxclick="onOpenAux"
		>
			{{ tr('view.project.continue.open') }}
		</button>
	</div>
</template>
