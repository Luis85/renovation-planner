<script setup lang="ts">
/**
 * Where the user was, as P00/P06's CARD.
 *
 * **It was a row and this file's header used to argue that it must be one** — "the same
 * armature as every other row, distinguished by its group heading and by carrying a SECOND
 * action, never by being a different shape", with a raised card named as the composition that
 * direction had not locked. The design package locks it: P00 and P06 both draw a bordered,
 * tinted block with a leading glyph, the project name on one line, the plan name muted under
 * it and two actions. The old argument is kept above rather than deleted, because the reason
 * it was made — a card must not smuggle in a continue-first structure — is still the thing
 * this component has to not do, and it does not: the card carries the same two destinations
 * and the list below it is still the index.
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
 *
 * **THE DATE AND THE STATUS WORD ARE GONE.** Both were drawn beside the two actions and
 * neither is in P00's or P06's card: the group heading already names what this is, and the
 * project's own row below repeats every fact this card was restating. `ProjectRow` owns the
 * date formatter now — a relocation, not a deletion, and not a second copy.
 */
import { useId } from 'vue';
import type { PlanSummaryDto, ProjectSummaryDto } from '../read-models/PlanDto';
import HostIcon from '../components/HostIcon.vue';
import { tr } from '../i18n/strings';
import { opensNote } from './platformModifier';

/**
 * **No `planId` here, deliberately** — the brief that specified this component's own interface
 * named one, and `fallow`'s `unused component prop` check is what caught it: this component
 * reads nothing off an id, only off the RESOLVED `plan`, and the eventual `resume` emit is
 * payload-less by design (the mount site already holds the project and the plan id, and supplies
 * both when it re-emits — see `ProjectList.vue`). A prop nothing inside a component reads is
 * exactly the class of defect `unused-component-props` exists to catch.
 */
/**
 * Declared without binding `props`, because nothing in this block reads one any more: the date
 * computed that did went to `ProjectRow` with P00's `Last worked` column. The template reads
 * them directly, which is what `defineProps` already exposes.
 */
defineProps<{
	readOnly?: boolean;
	readOnlyReasonId?: string;
	project: ProjectSummaryDto;
	/** The resolved plan this will resume, or `null` when the context names the project alone. */
	plan: PlanSummaryDto | null;
}>();
const emit = defineEmits<{ resume: []; open: []; openNote: [] }>();

/**
 * THE THREE IDS THAT MAKE THE TWO ACTIONS SAY WHICH PROJECT THEY ACT ON.
 *
 * Both buttons read `Resume` and `Open project` and the project's name sat beside them in an
 * unassociated span under an `<h3>Resume</h3>` heading, so a screen reader heard "Resume,
 * button" with no idea which project — on the one surface whose whole job is picking a project.
 *
 * `aria-labelledby` listing the BUTTON ITSELF FIRST and then the name span is what fixes it
 * with no new locale key: the accessible name becomes the concatenation, `Resume
 * <project name>`, in whatever order the locale's own words already read. An `aria-label`
 * interpolating the name would need a key per action and would freeze the word order in
 * English; referring to the button's own text keeps the translated verb the translator wrote.
 *
 * `useId` rather than hand-built ids, and `app.config.idPrefix` is set at every `createApp`
 * site (`app-id-prefix.ts`) so two Vue apps' ids cannot collide — the mechanism design slice
 * 16's `FieldError` established and `tests/build/appIdPrefix.test.ts` keeps true.
 */
const nameId = useId();
const resumeId = useId();
const openId = useId();

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
</script>

<template>
	<div class="rp-continue">
		<!-- P00's leading glyph, `aria-hidden` at HostIcon's own root: the card's text already
		     says everything, and a card is not a control. -->
		<HostIcon
			name="house"
			class="rp-continue__glyph"
		/>
		<span class="rp-continue__names">
			<!--
				The project AND the work inside it — P00's card is the project name on one line
				with the plan name muted underneath, which is what makes it answer "which plan
				will this open" on a project that has several. Absent, not blank, when the
				context names no plan: the content rule is that an empty slot renders nothing
				and its neighbours close up.

				`:id` is what both buttons' `aria-labelledby` points at, so the name is the
				second half of each action's accessible name rather than a sibling nothing
				associates.
			-->
			<span
				:id="nameId"
				class="rp-project-list__name rp-continue__project"
				:title="project.name"
			>{{ project.name }}</span>
			<span
				v-if="plan !== null"
				class="rp-continue__plan"
				:title="plan.name"
			>{{ plan.name }}</span>
		</span>
		<div class="rp-continue__actions">
			<!-- `mod-cta` is Obsidian's own primary-button class, so the filled treatment P00
			     draws is the host's accent rather than a colour this sheet invents. -->
			<button
				:id="resumeId"
				type="button"
				class="rp-continue__resume mod-cta"
				:aria-labelledby="`${resumeId} ${nameId}`"
				:disabled="readOnly && plan !== null"
				:aria-describedby="readOnly && plan !== null ? readOnlyReasonId : undefined"
				@click="$emit('resume')"
			>
				{{ tr('view.project.continue.resume') }}
			</button>
			<button
				:id="openId"
				type="button"
				class="rp-continue__open"
				:aria-labelledby="`${openId} ${nameId}`"
				@mousedown="onOpenMouseDown"
				@click="onOpen"
				@auxclick="onOpenAux"
			>
				{{ tr('view.project.continue.open') }}
			</button>
		</div>
	</div>
</template>
