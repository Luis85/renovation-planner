<!--
	Project Home: the project detail state grown from one flat screen into a place with
	sections, per the workspace UXD §7 and §10 and the prototype spec's §A.10 wireframe.

	**This mock is mostly a REUSE, and that is the finding rather than the caveat.** The first
	draft redrew the header — its own grid, its own back control, its own status pill, its own
	`‹ Projects` copy — and every one of those already ships. `.rp-project-detail__header` is a
	grid whose back control takes `grid-column: 1 / -1; justify-self: start`, whose name column
	carries `min-width: 0` so a long name ellipses rather than shoving the status off a 460px
	leaf, and whose two buttons opt their focus rings back in because Obsidian's global
	`:focus { outline: none }` reaches buttons and the vendored reduction puts nothing back.
	The redraw inherited none of that, so it shipped a header with NO VISIBLE FOCUS INDICATOR —
	a WCAG 2.2 2.4.7 failure at AA, which `PRODUCT.md` binds by name and which the harness
	index's own review already caught once on this exact axis. The copy was invented too: the
	string is `view.project.back`, "Back to projects", and it has been translated since slice
	21.

	So this file reuses `.rp-project-detail__*` and `.rp-plan-list__*` verbatim — the harness
	serves the real assembled `/styles.css`, so those rules are live here — and styles only what
	is genuinely new: the section switch, the estimate block and the counts.

	**What the editor concept had already decided, and this now follows.**

	- The counts are `canvas.css`'s `.rc-counts`: a hairline grid of cells, `tabular-nums`, and
	  a zero that DIMS rather than colours, because "a count of zero is not the same shape as a
	  count of eight, and the difference has to survive without colour". They are NAVIGATION —
	  "not values anybody edits, so they must not wear the bordered box `concept.css` reserves
	  for 'you can change this'". Only Plans has a destination today, so only Plans is a
	  control; the other two are the same cell drawn as text, which is the honest version of a
	  count that leads nowhere yet.
	- The estimate is a `CalculatedValue`, which the component library says "must expose
	  provenance and cannot masquerade as a manually editable stored value" — so the derivation
	  is printed under it rather than implied. `canvas.css`'s meter states the same rule from
	  the other side: a bare percentage is "exactly the derived-value-that-is-not-derived the
	  README caught in the areas". This is the product's central claim rendered as a sentence.
	- The qualifiers are `concept.css`'s `.rp-badge`, whose `data-health="stale"` variant this
	  screen needs by name. A label first and a mark second, the hue on the border and the icon
	  and never on the word.
	- The section switch takes `PerspectiveSwitch`'s contract from the component library:
	  "tablist or radiogroup semantics; arrow-key navigation; explicit active state". A roving
	  `tabindex` is what makes that real rather than asserted — the first draft was a row of
	  ordinary buttons with `aria-current`, which is reachable and is not what the contract asks
	  for.
	- No hero metric. The estimate leads by weight and position, not by a 2rem literal: the
	  craft floor refuses "big number, small label, supporting stats, accent" as a page
	  scaffold, and every size here resolves to an Obsidian font variable, per the concept's own
	  rule that a value the host declares is READ rather than restated.

	**Vocabulary: this surface says "Rooms" and the rest of the plugin still says "Zones".**
	The editor redesign's principle 8 is explicit — Room, Wall, Area, Work, never Zone or
	Polygon — and this surface is new, so it is born in the destination word. `Zone` stays the
	DOMAIN word: the entity, the events, the frontmatter and every existing locale key are
	untouched, and only the copy this screen renders moves. The cost is a real inconsistency for
	the length of one branch, accepted deliberately.

	**Sample content is invented and labelled as such**, per `PRODUCT.md`: there is no real
	renovation project, no floor plan and no cost data anywhere in this repository.

	The five unbuilt sections are absent from the switch rather than disabled, per slice 14's
	rule that a surface renders no control rather than a live one that does nothing.
-->
<script setup lang="ts">
import { ref, useId } from 'vue';
import ProjectCounts from './ProjectCounts.vue';
import ProjectEstimate from './ProjectEstimate.vue';

const sections = ['Overview', 'Design'] as const;
type Section = (typeof sections)[number];

const active = ref<Section>('Overview');

/**
 * One id root per MOUNTED APP, not per section name.
 *
 * `rp-tab-Overview` looks stable and is the wrong kind of stable: the Renovation Project view
 * can be split, and each leaf mounts its own Vue app, so two panes would emit the same
 * `aria-controls` target and a screen reader would resolve one pane's tab to the other pane's
 * panel. That is the exact hazard `app-id-prefix.ts` exists for — `app.config.idPrefix` is set
 * at BOTH `createApp` sites so two apps' `useId()` calls cannot collide — and a hand-built id
 * walks straight past it, because a literal is not a `useId()` call.
 *
 * `FieldError` is the house pattern and it mints its own ids the same way.
 */
const idRoot = useId();

const tabId = (section: Section): string => `${idRoot}-tab-${section}`;
const panelId = (section: Section): string => `${idRoot}-panel-${section}`;

/**
 * A roving `tabindex`: exactly one tab is in the document's tab order and the arrow keys move
 * between them, which is what `PerspectiveSwitch`'s "arrow-key navigation" means in practice.
 * Without it a tablist is a row of buttons wearing tablist roles — the shape a screen reader
 * announces as a tab set and the keyboard then contradicts.
 */
/**
 * The newly selected tab is the only tabbable one, so focus has to follow the selection or the
 * user's next Tab leaves the switch entirely.
 *
 * Extracted out of `onKey` because `npm run analyze` breached its CRAP threshold at 42 — cyclomatic 6
 * against zero coverage, which is what an uncovered branchy function scores. A table lookup
 * replacing the ternary chain and the DOM walk moved out are what brought it down; neither is
 * decoration, and the handler reads as the two things it does rather than as five guards.
 */
function focusTab(from: EventTarget | null, index: number): void {
	if (!(from instanceof HTMLElement)) return;
	const target = from.parentElement?.children[index];
	if (target instanceof HTMLElement) target.focus();
}

const STEPS: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 };

function onKey(event: KeyboardEvent, index: number): void {
	const step = STEPS[event.key];
	if (step === undefined) return;
	event.preventDefault();
	const next = (index + step + sections.length) % sections.length;
	active.value = sections[next] as Section;
	focusTab(event.currentTarget, next);
}

/** Handed to `ProjectCounts`, which owns how they are drawn. */
const counts = [
	{ label: 'Plans', value: 2 },
	{ label: 'Rooms', value: 11 },
	{ label: 'Requirements', value: 24 },
];

const plans = [
	{ name: 'Ground floor', detail: '7 rooms · scale set' },
	{ name: 'Upper floor', detail: '4 rooms · no scale yet' },
];

/**
 * The project's own timeline, and it went MISSING for two rounds.
 *
 * The first mock drew it; the rebuild against the editor concept dropped the line while the
 * spec went on promising "status, dates, currency, …" in its Scope section — a surface and its
 * specification disagreeing, found by review rather than by any gate, because nothing here reads
 * a spec against a mock.
 *
 * `null` when a project has neither date, which renders nothing rather than "No dates set":
 * both are optional on `Project`, a renovation planned without a deadline is an ordinary
 * project, and a line whose whole content is an absence is noise on the surface that exists to
 * answer what this project costs.
 */
const dates: string | null = 'Started 4 March 2026 · target 30 November 2026';

const staleCount = 3;
const unsummableCount = 1;
/**
 * Supplied, never derived. subtracting every exclusion category double-counts a row caught by two
 * of them, and the counts are deliberately independent — only the query knows the size of their
 * union.
 */
const summedCount = 23;

</script>

<template>
	<div class="rp-project-detail">
		<div class="rp-project-detail__header">
			<button
				type="button"
				class="rp-project-detail__back"
			>
				Back to projects
			</button>
			<h2 class="rp-project-detail__name">
				House renovation 2026
			</h2>
			<span class="rp-project-detail__status">Planning</span>
			<span class="rp-project-detail__currency">EUR</span>
			<button
				type="button"
				class="rp-project-detail__open-note"
			>
				Open note
			</button>
		</div>

		<div
			class="rp-project-nav"
			role="tablist"
			aria-label="Project sections"
		>
			<button
				v-for="(section, index) in sections"
				:id="tabId(section)"
				:key="section"
				type="button"
				role="tab"
				class="rp-project-nav__tab"
				:class="{ 'rp-project-nav__tab--on': section === active }"
				:aria-selected="section === active"
				:aria-controls="panelId(section)"
				:tabindex="section === active ? 0 : -1"
				@click="active = section"
				@keydown="onKey($event, index)"
			>
				{{ section }}
			</button>
		</div>

		<!--
			The warning names ROOMS and not costs, which is a correction a review caught after the
			walk changed. An unreadable PLAN note used to remove costs from the total, because the
			walk reached requirements THROUGH that plan's zones; the project-scoped walk reaches
			them directly, so the requirements are still summed and only the zone count is short.
			Copy that describes a data path is copy that goes stale when the path moves.
		-->
		<div
			v-if="active === 'Overview'"
			:id="panelId(active)"
			class="rp-project-section"
			role="tabpanel"
			:aria-labelledby="tabId(active)"
			tabindex="0"
		>
			<p
				v-if="dates !== null"
				class="rp-project-dates"
			>
				{{ dates }}
			</p>

			<ProjectEstimate
				amount="€42,300.00"
				:requirements="counts[2]?.value ?? 0"
				:rooms="counts[1]?.value ?? 0"
				:summed="summedCount"
				:stale="staleCount"
				:unsummable="unsummableCount"
			/>

			<ProjectCounts :counts="counts" />

			<aside class="rp-warning">
				<p class="rp-warning__heading">
					One plan note could not be read
				</p>
				<p class="rp-warning__body">
					Its rooms are missing from the counts above. The note may be from a newer
					version of this plugin.
				</p>
				<button
					type="button"
					class="rp-warning__action"
				>
					Open diagnostics
				</button>
			</aside>
		</div>

		<div
			v-else
			:id="panelId(active)"
			class="rp-project-section"
			role="tabpanel"
			:aria-labelledby="tabId(active)"
			tabindex="0"
		>
			<div class="rp-plan-list__header">
				<h3 class="rp-plan-list__title">
					Plans
				</h3>
				<button
					type="button"
					class="rp-plan-list__create"
				>
					New plan
				</button>
			</div>
			<ul class="rp-plan-list">
				<li
					v-for="plan in plans"
					:key="plan.name"
				>
					<button
						type="button"
						class="rp-plan-list__row"
					>
						<span class="rp-plan-list__name">{{ plan.name }}</span>
						<span class="rp-plan-list__detail">{{ plan.detail }}</span>
					</button>
				</li>
			</ul>
		</div>
	</div>
</template>

<style scoped>
/*
 * The section switch. A bottom rule spanning the full width joins it to the header above,
 * which is what makes the two read as one piece of chrome rather than two bars.
 */
.rp-project-nav {
	display: flex;
	flex-wrap: wrap;
	gap: var(--size-4-1);
	flex: 0 0 auto;
	padding: 0 var(--size-4-2);
	border-bottom: 1px solid var(--background-modifier-border);
}

/*
 * `box-shadow: none` is the load-bearing declaration, and the first diagnosis of why was
 * wrong in an instructive way. It blamed specificity — Obsidian's `button:not(.clickable-icon)`
 * at (0,1,1) beating a bare class — and qualified the selector to win. The box stayed. A
 * `<style scoped>` rule carries a `[data-v-…]` attribute, so it was already (0,2,0) and already
 * winning every property it DECLARED. It declared `background-color` and `border` and not
 * `box-shadow`, and `--input-shadow` is `inset 0 0 0 1px rgba(0,0,0,0.12)` — a ring drawn
 * inside the box, which is exactly the border that was visible. An unstated property is not an
 * overridden one. `concept.css`'s own button reset had already recorded this trap; reading it
 * first would have been cheaper than measuring it.
 */
.rp-project-nav__tab {
	padding: var(--size-4-2);
	border: none;
	border-bottom: 2px solid transparent;
	border-radius: 0;
	background-color: transparent;
	box-shadow: none;
	color: var(--text-muted);
	font-size: var(--font-ui-small);
	cursor: pointer;
}

.rp-project-nav__tab:hover {
	background-color: var(--background-modifier-hover);
	color: var(--text-normal);
}

/*
 * The selected tab carries THREE channels and none of them is hue alone: the label goes to
 * full contrast, it gains weight, and the accent rides a 2px rule under it. `concept.css`
 * measured `--interactive-accent` as TEXT at 3.17:1 light and 3.46:1 dark, so it is never the
 * word — only the mark, where WCAG's 3:1 non-text threshold is the one that applies.
 */
.rp-project-nav__tab--on {
	border-bottom-color: var(--interactive-accent);
	color: var(--text-normal);
	font-weight: 600;
}

/*
 * Obsidian's global `:focus { outline: none }` reaches buttons and the vendored reduction puts
 * nothing back — the same reason `.rp-project-detail__back` states at length in
 * `styles/project-detail.css`. `outline-offset` is NEGATIVE here because the tab sits flush
 * against the rule below it and a positive offset would be clipped by the panel.
 */
.rp-project-nav__tab:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: -2px;
}

.rp-project-dates {
	margin: 0 0 var(--size-4-4);
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
}

.rp-project-section {
	flex: 1;
	min-height: 0;
	padding: var(--size-4-3) var(--size-4-2) var(--size-4-4);
	overflow-y: auto;
}

/* A tabpanel is focusable so that the arrow keys can hand the reader onward into it. */
.rp-project-section:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: -2px;
}

/*
 * The persistent warning. Obsidian's own answer to "this block matters" is a tint rather than a
 * border — `.callout` in the vendored app.css sets `--callout-border-width: 0px` and carries
 * its emphasis in a `color-mix` — so this does the same with the warning colour. `canvas.css`
 * settled that for the guidance block and the reasoning is the host's, not ours. The heading is
 * the second channel, so the tint reinforces something it never carries alone.
 */
.rp-warning {
	padding: var(--size-4-2);
	border-radius: var(--radius-s);
	background: color-mix(in oklch, var(--text-warning) 10%, transparent);
}

.rp-warning__heading {
	margin: 0;
	color: var(--text-normal);
	font-size: var(--font-ui-smaller);
	font-weight: 600;
}

.rp-warning__body {
	max-width: 60ch;
	margin: var(--size-4-1) 0 0;
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
	line-height: 1.4;
}

/*
 * An action inside a tinted block, styled the way `concept.css`'s toast action is and for the
 * measurement it records: the accent is not readable enough as text, so weight and an underline
 * carry the affordance and the accent moves to the underline itself.
 */
.rp-warning__action {
	margin-top: var(--size-4-2);
	padding: 0;
	border: 0;
	background: transparent;
	box-shadow: none;
	color: var(--text-normal);
	font: inherit;
	font-size: var(--font-ui-smaller);
	font-weight: 600;
	text-decoration: underline;
	text-decoration-color: var(--interactive-accent);
	text-decoration-thickness: 2px;
	text-underline-offset: 3px;
	cursor: pointer;
}

.rp-warning__action:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 2px;
}

.rp-plan-list__detail {
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
}
</style>
