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
 *
 * **The row shape is P01's and P02's**: a leading glyph, the task worded as a benefit, its one
 * control, and a chevron. The chevron is `HostIcon`, which renders an `aria-hidden` `<span>` —
 * so it adds no focus stop and nests no interactive element inside the entry, both of which P02
 * forbids by name.
 *
 * **The visibility toggle sits BELOW the entries**, which is where all three screens draw it. It
 * was above the region's own heading, so the first thing on the page was an offer to remove it.
 */
import { computed } from 'vue';
import type { IconName } from 'obsidian';
import type { PlanSummaryDto } from '../read-models/PlanDto';
import type { StringKey } from '../i18n/locales/en';
import HostIcon from '../components/HostIcon.vue';
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
const emit = defineEmits<{ toggleGuidance: []; openNote: []; createPlan: []; openPlan: [planId: string]; choosePlan: []; prices: [] }>();

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
	/** The row's leading glyph, decorative and `aria-hidden` — P01/P02 draw one per entry. */
	readonly icon: IconName;
	/** Resolved rather than a key, because the plan entry's label interpolates a plan's name. */
	readonly label: string;
	/**
	 * §6's three RANKS — primary, secondary, understated — rather than the two the first version
	 * had, where `at === 0` took `mod-cta` and the other two were indistinguishable. Assigned by
	 * POSITION in `entries` below, because that is what §6's own table does: the ordering IS the
	 * ranking, in both variants.
	 */
	readonly priority: 'primary' | 'secondary' | 'understated';
	readonly disabled: boolean;
	/** Set only where `disabled` is a consequence of the READ-ONLY surface, never of a failed read. */
	readonly describedBy: string | undefined;
	readonly act: () => void;
}

type Ranked = Omit<Entry, 'priority'>;

const noteEntry = computed<Ranked>(() => ({
	key: 'note',
	title: 'view.project.entry-note-title',
	body: 'view.project.entry-note-body',
	icon: 'file-text',
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
const planEntry = computed<Ranked>(() => {
	const last = props.lastPlan ?? null;

	return {
		key: 'plan',
		title: props.isNew ? 'view.project.entry-plan-start-title' : 'view.project.entry-plan-continue-title',
		body: props.isNew ? 'view.project.entry-plan-start-body' : 'view.project.entry-plan-continue-body',
		icon: 'panels-top-left',
		label: props.isNew
			? tr('view.project.entry-plan-create')
			: last === null
				? tr('view.project.entry-plan-choose')
				: tr('view.project.entry-plan-open', { planName: last.name }),
		// The only entry a read-only surface withholds (P12): the other two navigate and read.
		// Also disabled on the active variant when no plan ROW will render to focus — a failed
		// read draws its own notice and an all-unreadable read draws the list with no rows in it
		// (`planRowsAbsent`, resolved by `ProjectDetail`), so "Choose a plan" would otherwise be
		// a button with nothing for it to do.
		disabled: props.readOnly === true || (!props.isNew && props.planRowsAbsent),
		describedBy: props.readOnly === true ? props.readOnlyReasonId : undefined,
		act: props.isNew
			? () => emit('createPlan')
			: last === null
				? () => emit('choosePlan')
				: () => emit('openPlan', last.id),
	};
});

const pricesEntry = computed<Ranked>(() => ({
	key: 'prices',
	title: 'view.project.entry-prices-title',
	body: 'view.project.entry-prices-body',
	icon: 'circle-dollar-sign',
	label: tr('view.project.prices-open'),
	disabled: false,
	describedBy: undefined,
	act: () => emit('prices'),
}));

const RANKS = ['primary', 'secondary', 'understated'] as const;

/**
 * Note first on a new project and the plan first on an active one — P01 and P02's own orders.
 * The position decides the rank, which is §6's table read literally.
 */
const entries = computed<readonly Entry[]>(() =>
	(props.isNew
		? [noteEntry.value, planEntry.value, pricesEntry.value]
		: [planEntry.value, noteEntry.value, pricesEntry.value]
	).map((entry, at) => ({ ...entry, priority: RANKS[at] ?? 'understated' })),
);
</script>

<template>
	<div class="rp-project-guidance">
		<template v-if="!guidanceHidden">
			<h3>{{ tr(isNew ? 'view.project.guidance-start-title' : 'view.project.guidance-title') }}</h3>
			<p v-if="isNew">
				{{ tr('view.project.guidance-optional-plan') }}
			</p>
		</template>
		<!--
			Hiding guidance drops the EXPLANATIONS and keeps every action (P01's own
			acceptance criterion), so the same three buttons in the same order collapse
			into the compact row the schedule/quote pair below the plans already uses.

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
				v-for="entry in entries"
				:key="entry.key"
				class="rp-project-detail__entry"
			>
				<HostIcon
					v-if="!guidanceHidden"
					:name="entry.icon"
					class="rp-project-detail__entry-glyph"
				/>
				<div
					v-if="!guidanceHidden"
					class="rp-project-detail__entry-text"
				>
					<h4 class="rp-project-detail__entry-title">
						{{ tr(entry.title) }}
					</h4>
					<p class="rp-project-detail__entry-body">
						{{ tr(entry.body) }}
					</p>
				</div>
				<button
					type="button"
					class="rp-project-detail__entry-action"
					:class="[
						`rp-project-detail__entry-action--${entry.priority}`,
						{ 'rp-project-prices-open': entry.key === 'prices' },
					]"
					:disabled="entry.disabled"
					:aria-describedby="entry.describedBy"
					@click="entry.act()"
				>
					{{ entry.label }}
				</button>
				<HostIcon
					v-if="!guidanceHidden"
					name="chevron-right"
					class="rp-project-detail__entry-chevron"
				/>
			</div>
		</div>
		<div class="rp-project-guidance__toggle-line">
			<button
				type="button"
				class="rp-project-guidance__toggle"
				:aria-expanded="!guidanceHidden"
				@click="$emit('toggleGuidance')"
			>
				<HostIcon :name="guidanceHidden ? 'chevron-right' : 'chevron-down'" />
				{{ tr(guidanceHidden ? 'view.project.guidance-show' : 'view.project.guidance-hide') }}
			</button>
		</div>
	</div>
</template>
