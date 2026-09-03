<script setup lang="ts">
/**
 * One project as a list row — the Home design spec §6's anatomy, extracted out of
 * `ProjectList.vue` because the list around it grows four regions and a row living inside it
 * would be edited by every one of them.
 *
 * **It keeps `ProjectList`'s class names for the name, the status and the §83 marker.** Those
 * three have shipped rules in `forms.css` and `project-list-overlap.css` that were each found
 * by a capture and are each argued for where they live; renaming them would be re-litigating
 * three settled layout findings inside a change about composition. It is also what keeps
 * `projectList.test.ts` and `projectListOverlap.test.ts` addressing the row they already
 * address. What is NEW here gets `rp-project-row__*` — the facts slot and the tick strip — so
 * the two vintages are legible.
 *
 * It DISPATCHES nothing and opens nothing: it emits an id, `ProjectList` re-emits it and the
 * VIEW decides what that means. That is design slice 16's division, unchanged.
 */
import { computed } from 'vue';
import type { ProjectSummaryDto } from '../read-models/PlanDto';
import { statusLabel } from './statusLabel';
import { PROJECT_STATUS_STAGE_COUNT, projectStatusStage } from './projectStatusStage';
import { splitMatch } from './projectFilter';
import { tr } from '../i18n/strings';

/**
 * `query` is OPTIONAL because a row can be drawn with no filter above it — the Continue group
 * and the prototypes both do — and defaulting to no match is the honest answer for those rather
 * than a flag each has to remember to pass.
 *
 * `collator` is REQUIRED, and that is a deliberate departure from the brief, which had this
 * component build one inside the highlight computed. `Intl.Collator`'s construction is the
 * expensive half and its `compare` the cheap one, so a per-render build is thirty collators per
 * keystroke — the very cost `projectOrder`'s own hoisting comment exists to avoid. Required
 * rather than optional-with-a-fallback for the reason `unreadable` on `ProjectList` is: an
 * optional one would be silently forgotten at the mount that needed it most, and the compiler
 * naming every site is cheap when the production site is `ProjectList` alone.
 */
const props = defineProps<{
	project: ProjectSummaryDto;
	collator: Intl.Collator;
	query?: string;
}>();
defineEmits<{ open: [projectId: string] }>();

/**
 * The name, split around the matched run. The runs carry the NAME's own characters — a `Küche`
 * found by typing `kuche` still renders with its umlaut — because a highlight says WHERE the
 * match is and never replaces the text.
 */
const runs = computed(() => splitMatch(props.project.name, props.query ?? '', props.collator));

/**
 * The facts slot's content, in the order §8 specifies, with EMPTY ENTRIES ABSENT rather than
 * blank.
 *
 * The governing rule from the confirmed brief: the row must look complete today, not like a
 * card with holes. A slot with nothing in it renders nothing — no dash, no `—`, no skeleton,
 * no "not yet calculated" — and its neighbours close up. A project with no plans therefore
 * shows its currency alone, not `0 plans · EUR`.
 *
 * The singular is `view.project.plans-one`, whose English copy SPELLS THE NUMERAL OUT (`One
 * plan`); `en.ts` records the lint reason at the key. Picking by `count === 1` here is the
 * whole of this plugin's plural machinery — `t` has none.
 *
 * **Budget and progress are RESERVED and render nothing.** §8 specifies this slot to receive
 * them, in that order, when and only when a query supplies them — and no query derives either
 * from real requirements and real costs yet. A builder may not approximate either, and may not
 * add a third fact here without amending the spec.
 */
const facts = computed(() => {
	const entries: string[] = [];
	if (props.project.planCount > 0) {
		entries.push(
			props.project.planCount === 1
				? tr('view.project.plans-one')
				: tr('view.project.plans-many', { count: String(props.project.planCount) }),
		);
	}
	entries.push(props.project.currency);
	return entries.join(' · ');
});

/**
 * The lifecycle arc as ten cells, or `null` for a status this build cannot place — in which
 * case no strip is drawn at all and the translated word stands alone, which is exactly the
 * composition the narrow row already uses, so nothing extra had to be designed for it.
 *
 * `reached` is inclusive of the current stage: a project at DESIGN has three of ten cells
 * filled, not two, because the stage it is AT is one it has reached.
 */
const ticks = computed(() => {
	const stage = projectStatusStage(props.project.status);
	if (stage === null) return null;
	return Array.from({ length: PROJECT_STATUS_STAGE_COUNT }, (_, cell) => cell <= stage);
});
</script>

<template>
	<button
		type="button"
		class="rp-project-list__row rp-project-row"
		:data-project-id="project.id"
		@click="$emit('open', project.id)"
	>
		<!-- The half that gives way. `title` is what makes a truncated name readable at all,
		     and it is the shipped rule `forms.css` records finding at 460px. -->
		<!--
			The runs are written with NO WHITESPACE between the tags. Vue's default
			`whitespace: 'condense'` removes whitespace between two elements only when it
			contains a newline, and a name split into runs must not gain or lose a character —
			this is the `ZonePanelprototype` defect read from the other side.
		-->
		<span
			class="rp-project-list__name"
			:title="project.name"
		><span
			v-for="(run, at) in runs"
			:key="at"
			:class="{ 'rp-project-row__match': run.matched }"
		>{{ run.text }}</span></span>
		<span class="rp-project-row__facts">{{ facts }}</span>
		<span class="rp-project-list__status rp-project-row__status">
			{{ statusLabel(project.status) }}
			<!-- `aria-hidden` and text-free, so the WORD above stays the whole accessible name.
			     The strip is an enhancement over a channel that is already complete, which is
			     what makes dropping it at narrow lossless rather than a downgrade. -->
			<span
				v-if="ticks !== null"
				class="rp-project-row__ticks"
				aria-hidden="true"
			>
				<span
					v-for="(reached, cell) in ticks"
					:key="cell"
					class="rp-project-row__tick"
					:class="{ 'rp-project-row__tick--reached': reached }"
				/>
			</span>
		</span>
		<!-- PRD §83's marker, unchanged from design slice 19: a CSS-drawn triangle on the
		     class's `::before` and a translated sentence as the element's own text, so the row
		     says what is wrong to a reader who cannot see the colour and to one who cannot see
		     the glyph alike. It sits AFTER the status and never shrinks. -->
		<span
			v-if="project.libraryOverlap"
			class="rp-project-list__overlap"
		>{{ tr('view.project.library-overlap') }}</span>
	</button>
</template>
