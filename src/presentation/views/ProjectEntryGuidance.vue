<script setup lang="ts">
/**
 * The three ENTRY PATHS a project's detail state offers, and the optional guidance around them
 * (design slice 22, task 1) — screens P01 and P02, `interaction-concept.md` §6–§7, and the
 * `ProjectEntryGuidance` the design package's `components/component-library.md` proposes.
 *
 * Its own component rather than a region of `ProjectDetail.vue`, because that template crossed
 * fallow's template-complexity threshold once this region and the mobile `readOnly` branches
 * landed on it in the same slice — 28 cognitive over 304 lines, measured, and an ignore
 * directive there would have kept the number rather than the region.
 *
 * It DISPATCHES nothing and reads nothing: every entry emits an intent `ProjectDetail` carries
 * up to `ViewRoot`. `choosePlan` is the one that does not leave the detail state — the caret
 * goes to the plan list, whose `ref` stays in `ProjectDetail`, where the list is drawn.
 */
import { computed } from 'vue';
import type { PlanSummaryDto } from '../read-models/PlanDto';
import type { StringKey } from '../i18n/locales/en';
import { tr } from '../i18n/strings';

const props = defineProps<{
	guidanceHidden?: boolean;
	readOnly?: boolean;
	/**
	 * The id of `ViewRoot`'s ONE mobile notice, or absent on desktop. Every control this
	 * component refuses points at it with `aria-describedby`, so the reason travels with the
	 * refusal rather than being discovered by pressing a dead button (requirement 4a).
	 */
	readOnlyReasonId?: string;
	/**
	 * **A project with no plans, as opposed to a project whose plans this build could not read.**
	 *
	 * Resolved by `ProjectDetail`, which is where the plan read's three facts arrive: a refused
	 * read and a partly unreadable one both leave the list empty, and inviting a FIRST plan onto
	 * a project that may already hold several is the one thing the start variant must never do
	 * (P01, "unreadable plans show a read-error state, not this 'new' layout").
	 */
	isNew: boolean;
	/**
	 * Whether no plan ROW will render — the one fact "Choose a plan" needs, since it hands the
	 * caret to a row rather than to the list element around it. Resolved by `ProjectDetail`,
	 * which is where the plan read's three facts arrive.
	 */
	planRowsAbsent: boolean;
	/**
	 * The plan the stored continue context names, when it is one of this project's plans. `null`
	 * is the ordinary case and the only thing this component does with it is choose between
	 * naming a plan and offering the list.
	 */
	lastPlan?: PlanSummaryDto | null;
}>();
const emit = defineEmits<{ toggleGuidance: []; openNote: []; createPlan: []; openPlan: [planId: string]; choosePlan: []; prices: []; schedule: []; quotes: [] }>();

/**
 * One entry path: a task worded as a benefit, and exactly one control that starts it (design
 * package `components/component-library.md`, `ProjectEntryAction`).
 *
 * A DESCRIPTOR rather than three near-identical blocks in the template, because the two variants
 * differ only in the ORDER of the same three entries and in which one is primary — spelling that
 * out twice is two places for the plan entry's four states to drift apart, and this template's
 * own cognitive complexity is a measured constraint (see this file's header).
 */
interface Entry {
	readonly key: string;
	readonly title: StringKey;
	readonly body: StringKey;
	/** Resolved rather than a key, because the plan entry's label interpolates a plan's name. */
	readonly label: string;
	readonly disabled: boolean;
	/** Set only where `disabled` is a consequence of the READ-ONLY surface, never of a failed read. */
	readonly describedBy: string | undefined;
	readonly act: () => void;
}

const noteEntry = computed<Entry>(() => ({
	key: 'note',
	title: 'view.project.entry-note-title',
	body: 'view.project.entry-note-body',
	label: tr('view.project.entry-note-action'),
	disabled: false,
	describedBy: undefined,
	act: () => emit('openNote'),
}));

/**
 * The one entry with four states: create on a new project, and on an active one either the plan
 * the user last worked in BY NAME or, with nothing stored that still resolves, a hand-off to the
 * list below rather than a guess at which plan they meant.
 */
const planEntry = computed<Entry>(() => {
	const last = props.lastPlan ?? null;

	return {
		key: 'plan',
		title: props.isNew ? 'view.project.entry-plan-start-title' : 'view.project.entry-plan-continue-title',
		body: props.isNew ? 'view.project.entry-plan-start-body' : 'view.project.entry-plan-continue-body',
		label: props.isNew
			? tr('view.project.entry-plan-create')
			: last === null
				? tr('view.project.entry-plan-choose')
				: tr('view.project.entry-plan-open', { planName: last.name }),
		// The only entry a read-only surface withholds (P12): the other two navigate and read.
		// Also disabled on the active variant when no plan ROW will render to focus — a failed
		// read draws its own notice, an empty state replaces the list, and an all-unreadable read
		// draws the list with no rows in it (`planRowsAbsent`, resolved by `ProjectDetail`), so
		// "Choose a plan" would otherwise be a button with nothing for it to do.
		disabled: props.readOnly === true || (!props.isNew && props.planRowsAbsent),
		describedBy: props.readOnly === true ? props.readOnlyReasonId : undefined,
		act: props.isNew
			? () => emit('createPlan')
			: last === null
				? () => emit('choosePlan')
				: () => emit('openPlan', last.id),
	};
});

const pricesEntry = computed<Entry>(() => ({
	key: 'prices',
	title: 'view.project.entry-prices-title',
	body: 'view.project.entry-prices-body',
	label: tr('view.project.prices-open'),
	disabled: false,
	describedBy: undefined,
	act: () => emit('prices'),
}));

/**
 * Note first on a new project and the plan first on an active one — P01 and P02's own orders.
 * The FIRST entry is the primary one, which is what `mod-cta` on its action says; nothing else
 * about an entry changes with its position.
 */
const entries = computed<readonly Entry[]>(() =>
	props.isNew
		? [noteEntry.value, planEntry.value, pricesEntry.value]
		: [planEntry.value, noteEntry.value, pricesEntry.value],
);
</script>

<template>
	<div class="rp-project-guidance">
		<button
			type="button"
			class="rp-project-guidance__toggle"
			:aria-expanded="!guidanceHidden"
			@click="$emit('toggleGuidance')"
		>
			{{ tr(guidanceHidden ? 'view.project.guidance-show' : 'view.project.guidance-hide') }}
		</button>
		<template v-if="!guidanceHidden">
			<h3>{{ tr(isNew ? 'view.project.guidance-start-title' : 'view.project.guidance-title') }}</h3>
			<p v-if="isNew">
				{{ tr('view.project.guidance-optional-plan') }}
			</p>
		</template>
		<!--
			Hiding guidance drops the EXPLANATIONS and keeps every action (P01's own
			acceptance criterion), so the same three buttons in the same order collapse
			into the compact row the downstream pair below already uses.

			`rp-project-prices-open` is spelled here as a LITERAL rather than carried on
			the entry descriptor, and that is about a scan rather than about style:
			`tests/helpers/buttonRules.ts` reads `rp-*` tokens out of a `<button>` tag's
			own class attributes, so a class arriving through a variable is a class both
			button gates stop seeing — a selector older than this region quietly leaving
			the sweep, which is the shape those files keep paying for. The class itself
			is kept because two checks and this region's focus ring key on it.
		-->
		<div
			class="rp-project-detail__entries"
			:class="{ 'rp-project-detail__entry-row': guidanceHidden }"
		>
			<div
				v-for="(entry, at) in entries"
				:key="entry.key"
				class="rp-project-detail__entry"
			>
				<template v-if="!guidanceHidden">
					<h4 class="rp-project-detail__entry-title">
						{{ tr(entry.title) }}
					</h4>
					<p class="rp-project-detail__entry-body">
						{{ tr(entry.body) }}
					</p>
				</template>
				<button
					type="button"
					class="rp-project-detail__entry-action"
					:class="{ 'rp-project-prices-open': entry.key === 'prices', 'mod-cta': at === 0 }"
					:disabled="entry.disabled"
					:aria-describedby="entry.describedBy"
					@click="entry.act()"
				>
					{{ entry.label }}
				</button>
			</div>
		</div>
		<div class="rp-project-detail__entry-row">
			<button
				type="button"
				@click="$emit('schedule')"
			>
				{{ tr('schedule.open') }}
			</button>
			<button
				type="button"
				@click="$emit('quotes')"
			>
				{{ tr('quote.comparison') }}
			</button>
		</div>
	</div>
</template>
