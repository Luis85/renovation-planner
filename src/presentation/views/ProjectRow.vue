<script setup lang="ts">
/**
 * One project as a list row — the design package's P00 (wide) and P06 (narrow) anatomy:
 * a leading decorative glyph, the name, the facts, a status PILL and a trailing chevron.
 *
 * **The ten-cell tick strip is gone and this is where it went.** It was design spec §6's
 * reading of the lifecycle as an arc; the design package draws a chip instead, and the user
 * decided between the two. `projectStatusStage` survives because `src/prototypes/StatusTicks.vue`
 * still imports it — grep before deleting it, which is how that was found.
 *
 * **The dot carries ONE colour for every status (`--text-accent`), deliberately.** A
 * status-to-colour mapping is a mapping this design package does not define, and inventing one
 * here would be a second answer to what a status means. The translated WORD is the whole
 * accessible name either way, which is SDD §85's rule: a status is never carried by colour.
 *
 * **It keeps `ProjectList`'s class names for the name, the status and the §83 marker.** Those
 * three have shipped rules in `forms.css` and `project-list-overlap.css` that were each found
 * by a capture and are each argued for where they live. What is NEW here gets
 * `rp-project-row__*`.
 *
 * It DISPATCHES nothing and opens nothing: it emits an id, `ProjectList` re-emits it and the
 * VIEW decides what that means. That is design slice 16's division, unchanged.
 */
import { computed } from 'vue';
import type { ProjectSummaryDto } from '../read-models/PlanDto';
import HostIcon from '../components/HostIcon.vue';
import { statusLabel } from './statusLabel';
import { splitMatch } from './projectFilter';
import { currentLanguage, tr } from '../i18n/strings';
import { opensNote } from './platformModifier';

/**
 * TWO NEW PROPS AND ONLY ONE OF THEM IS REQUIRED, which is this file arguing both sides of one
 * rule three lines apart — so the asymmetry is stated rather than left to read as an oversight.
 * What separates them is what a FORGOTTEN one draws.
 *
 * `collator` is REQUIRED, and that is a deliberate departure from the brief, which had this
 * component build one inside the highlight computed. `Intl.Collator`'s construction is the
 * expensive half and its `compare` the cheap one, so a per-render build is thirty collators per
 * keystroke — the very cost `projectOrder`'s own hoisting comment exists to avoid. Optional
 * would mean a fallback, and a fallback is that per-render build arriving at exactly the mount
 * that forgot to pass one: correct output at silently thirty times the cost, which no test can
 * see. Same shape as `ProjectList`'s own `unreadable`, where an absent field and a zero render
 * identically.
 *
 * `query` is OPTIONAL because the brief specifies it so, and because the harm is bounded and
 * VISIBLE: a mount that forgets it draws the name with no highlight, which is exactly what a
 * row above no filter is meant to look like. Nothing is silently wrong and nothing costs
 * anything it should not.
 */
/**
 * `withDefaults` rather than `tabbable ?? true` at the point of use: a TS type of `boolean`
 * compiles to a runtime `type: Boolean` declaration, and Vue's own prop system casts an ABSENT
 * boolean prop to `false` rather than `undefined` unless a `default` says otherwise — so
 * `??`, which falls back only on `null`/`undefined`, silently never fires and every row drawn
 * without the prop read as `tabbable: false`. Measured, not assumed: the very first case
 * written against `?? true` failed with `tabindex="-1"` on a mount that passed no prop at all.
 */
const props = withDefaults(
	defineProps<{
		project: ProjectSummaryDto;
		collator: Intl.Collator;
		query?: string;
		/**
		 * Whether this row is the roving group's one tab stop (Task 8, design spec §7). `true`
		 * by default so a row drawn OUTSIDE a roving group — a harness prototype — is an
		 * ordinary control, which is what §7 requires of it. `ProjectList` is the one caller
		 * that ever passes `false`.
		 */
		tabbable?: boolean;
	}>(),
	// `query` gains a default here too, and not merely to silence a lint rule that only
	// activates once ANY prop is defaulted through `withDefaults`: a concrete `''` is exactly
	// what `splitMatch` already treated an absent query as, so the fallback below simplifies to
	// reading the prop directly rather than needing its own `?? ''`.
	{ tabbable: true, query: '' },
);
const emit = defineEmits<{ open: [projectId: string]; openNote: [projectId: string] }>();

/**
 * The name, split around the matched run. The runs carry the NAME's own characters — a `Küche`
 * found by typing `kuche` still renders with its umlaut — because a highlight says WHERE the
 * match is and never replaces the text.
 */
const runs = computed(() => splitMatch(props.project.name, props.query, props.collator));

/**
 * THE PLAN COUNT, and `null` rather than `''` for a project with none.
 *
 * The governing content rule from the confirmed brief is unchanged: the row must look complete
 * today, not like a card with holes. A slot with nothing in it renders nothing — no dash, no
 * em-dash, no skeleton — and its neighbours close up. What changed is HOW: P00 gives plans and
 * currency their own columns under their own headings, so the two are two elements rather than
 * one joined string. At WIDE width closing up is what a grid does anyway — an absent item
 * leaves an empty cell under its own heading, which reads as an empty cell rather than as a
 * hole. At NARROW there is no heading to explain the gap, so the narrow sheet moves the
 * currency into the count's track with an adjacent-sibling selector
 * (`.rp-project-list__name + .rp-project-row__currency`) that matches only when this is `null`.
 * `null` rather than `''` is what makes the element ABSENT, and that selector reads absence.
 *
 * The singular is `view.project.plans-one`, whose English copy SPELLS THE NUMERAL OUT (`One
 * plan`); `en.ts` records the lint reason at the key. Picking by `count === 1` here is the
 * whole of this plugin's plural machinery — `t` has none.
 *
 * **The counted PHRASE at both widths, where P00's mockup draws a bare numeral under its
 * `Plans` heading.** A bare numeral is only readable while the heading is on screen, and the
 * heading is dropped at narrow — so the numeral would be a naked digit in the one composition
 * that cannot explain it. One string, both widths.
 */
const plans = computed(() => {
	// `> 0` rather than `!== 0`, which is what this test has always been and is deliberately not
	// "simplified": the two differ on a count that is not a number at all, and the strict form
	// renders `undefined plans` where this one renders nothing.
	if (!(props.project.planCount > 0)) return null;
	return props.project.planCount === 1
		? tr('view.project.plans-one')
		: tr('view.project.plans-many', { count: String(props.project.planCount) });
});

/**
 * P00's `Last worked` column — a required index fact (`ProjectSummaryDto.lastWorked`) the row
 * drew nowhere until this package asked for it. It is LAST WORKED and not "last opened", which
 * P00's own data contract states in so many words.
 *
 * An ABSOLUTE short date, never a relative time. A relative time needs a live ticker, makes
 * every test time-dependent, and "worked on yesterday" is a wireframe's nicety rather than a
 * requirement. Moved here from `ContinueRow`, which stopped drawing a date when its row became
 * P00's card — so this is a relocation rather than a second copy of the formatter.
 *
 * Empty rather than a dash when there is no date, per the content rule above. Dropped entirely
 * at narrow (P06: "Date may be omitted"), by the narrow sheet rather than by a branch here —
 * P06 also says the visually omitted date retains its value, and `display: none` is what makes
 * the wide composition and the narrow one one component.
 */
const worked = computed(() => {
	const at = new Date(props.project.lastWorked ?? '');

	// **A DATE THIS CANNOT READ RENDERS NOTHING, and the guard is `Number.isNaN` rather than a
	// `=== null` test on the field.** `Intl.DateTimeFormat.format` THROWS a `RangeError` on an
	// invalid date, and this is a computed inside a `v-for` — so one unreadable value does not
	// blank one cell, it takes down the render of the whole list and leaves an empty pane. Found
	// exactly that way: a test double supplying `{ id, name, status }` and no `lastWorked` at all
	// turned seven unrelated `ViewRoot` cases red with `Unhandled error during execution of
	// render function`, and the pane drew nothing.
	//
	// The field is typed `string | null`, so in production `?? ''` covers the declared absence
	// and the NaN check covers a value that is present and unparseable — which no type can rule
	// out, since it arrives from the vault's own file stats through the index. A row that cannot
	// be dated is still a row; a display-only fact must never be able to remove one.
	if (Number.isNaN(at.getTime())) return '';
	return new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'medium' }).format(at);
});

/**
 * A modifier-click opens the NOTE, a PLAIN click navigates, and a click carrying any OTHER
 * modifier does NEITHER — design spec §7's Pointer section.
 *
 * That third arm is load-bearing: `opensNote` answers only for the platform's own key, so
 * without it a Ctrl-click on macOS — the platform's OWN secondary-click gesture — would fall
 * straight through to plain navigation, moving a user reaching for a context menu into the
 * project instead. The same refusal covers `Alt` and `Shift`, neither of which this surface
 * claims either.
 *
 * `Enter` reaches this handler too, as the button's own native activation, so a `Ctrl+Enter`
 * on macOS is refused here for the same reason rather than needing a second guard in
 * `onKeydown`.
 */
function onClick(event: MouseEvent): void {
	if (opensNote(event)) {
		event.preventDefault();
		emit('openNote', props.project.id);
		return;
	}
	if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
	emit('open', props.project.id);
}

/**
 * **The autoscroll widget is suppressed HERE, on `mousedown`, and cannot be suppressed on
 * `auxclick`.** Chrome opens it as a default action of the PRESS; `auxclick` fires only after
 * the button is released, by which point the widget has already opened, so cancelling that
 * event cancels nothing. The exact lesson this repository's own plan editor canvas already
 * paid for at its own middle button (`EditorSurface.vue`'s `onMouseDown`, cited in CLAUDE.md):
 * "no pointer handler hears every press" — `auxclick` is one more handler that does not hear
 * the one that matters.
 */
function onMouseDown(event: MouseEvent): void {
	if (event.button === 1) event.preventDefault();
}

/**
 * The MIDDLE button, which fires `auxclick` rather than `click` — a `click` handler testing
 * `event.button === 1` would never run, because the middle button never produces one.
 *
 * `event.button === 1` is still tested here, because `auxclick` fires for the secondary
 * button too and the right button belongs to the context menu. It only EMITS: the autoscroll
 * suppression this door cannot deliver lives at `onMouseDown`, above.
 */
function onAuxClick(event: MouseEvent): void {
	if (event.button !== 1) return;
	emit('openNote', props.project.id);
}

/**
 * `Mod+Enter` opens the note; a bare Enter is the button's own native activation and is
 * deliberately NOT handled here — intercepting it would reimplement what the element already
 * does.
 */
function onKeydown(event: KeyboardEvent): void {
	if (event.key !== 'Enter' || !opensNote(event)) return;
	event.preventDefault();
	emit('openNote', props.project.id);
}
</script>

<template>
	<button
		type="button"
		class="rp-project-list__row rp-project-row"
		:data-project-id="project.id"
		:tabindex="tabbable ? 0 : -1"
		@mousedown="onMouseDown"
		@click="onClick"
		@auxclick="onAuxClick"
		@keydown="onKeydown"
	>
		<!-- P00's leading glyph. `HostIcon` is `aria-hidden` at its own root, so this adds
		     nothing to the row's accessible name — it is decoration beside text that already
		     says everything. -->
		<HostIcon
			name="house"
			class="rp-project-row__glyph"
		/>
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
		<!-- ABSENT rather than empty at zero, which is what the narrow separator rule reads. -->
		<span
			v-if="plans !== null"
			class="rp-project-row__plans"
		>{{ plans }}</span>
		<span class="rp-project-row__currency">{{ project.currency }}</span>
		<span class="rp-project-list__status rp-project-row__status">
			<!-- THE PILL. The dot is `aria-hidden` and text-free, so the WORD is the whole
			     accessible name — a status is never carried by colour (SDD §85), and one
			     accent dot for every status is what keeps this from becoming a status-to-colour
			     mapping this package has not defined. -->
			<span class="rp-project-row__pill"><span
				class="rp-project-row__dot"
				aria-hidden="true"
			/>{{ statusLabel(project.status) }}</span>
		</span>
		<span class="rp-project-row__worked">{{ worked }}</span>
		<!-- PRD §83's marker, unchanged from design slice 19: a CSS-drawn triangle on the
		     class's `::before` and a translated sentence as the element's own text, so the row
		     says what is wrong to a reader who cannot see the colour and to one who cannot see
		     the glyph alike. It sits AFTER the status and takes a line of its own. -->
		<span
			v-if="project.libraryOverlap"
			class="rp-project-list__overlap"
		>{{ tr('view.project.library-overlap') }}</span>
		<!-- P00's trailing chevron. Decorative and `aria-hidden` at HostIcon's own root, so it
		     adds NO focus stop: the row is already one `<button>`. -->
		<HostIcon
			name="chevron-right"
			class="rp-project-row__chevron"
		/>
	</button>
</template>
