<!--
	Project Home: the project detail state grown from one flat screen into a place with
	sections, per the workspace UXD §7 and §10 and the prototype spec's §A.10 wireframe.

	**What this mock exists to answer, and it is not "does the nav work".** The wireframe asks
	for six things on Overview and four of them read entities that do not exist — planning
	completeness, next-best-action, work items, a schedule. What is left, once the fakes are
	refused, is thinner than the wireframe looks: a status, a date range, three counts and one
	cost. Whether that is a screen worth navigating TO is a judgement an eye makes on a
	picture, and it is the whole reason to draw this before building it.

	**The cost is the point of the screen.** Slice 10 closed the loop
	`Zone Geometry -> Area -> Requirement -> Cost`, and the only surface that shows a cost today
	is the Plan Editor's Inspector, one requirement at a time. This is the first place a
	renovator can ask what the project costs, which is why the figure is the largest thing here
	and the counts sit under it rather than beside it as four equal tiles. The wireframe draws
	four equal tiles; that is the first thing this mock deliberately disagrees with.

	**The qualifier under the figure is not decoration.** A total that silently drops stale
	rows understates the project, and one that refuses while anything is stale is blank in the
	common case, since any geometry edit makes figures stale. So everything is summed and the
	sentence says what it knows — a sentence rather than a badge alone, per SDD §85.

	**Vocabulary, unresolved and deliberately visible.** This says "Zones" because that is what
	the shipped UI says today (`editor.layer.zone`). The Plan Editor redesign's principle 8
	renames it to "Room" for the user. Whichever branch lands second inherits the rename, and
	drawing it in today's word rather than guessing keeps the disagreement legible instead of
	settling it in a mock.

	The five unbuilt sections are absent from the nav rather than disabled, per slice 14's rule
	that a surface renders no control rather than a live one that does nothing.
-->
<script setup lang="ts">
import { ref } from 'vue';

/**
 * The sections that EXIST. The shipped `SECTIONS` list is the same shape and the same length:
 * a section becomes reachable by being added to it once its domain exists, which is what
 * makes hiding the other five a one-line change rather than a redraw.
 */
const sections = ['Overview', 'Design'] as const;

const active = ref<string>(sections[0]);

/**
 * The counts, as data rather than as four copies of one block — the shape a promoted
 * component takes from `ProjectSummary` rather than markup a promotion would have to unpick.
 */
const counts = [
	{ label: 'Plans', value: '2' },
	{ label: 'Zones', value: '11' },
	{ label: 'Requirements', value: '24' },
] as const;

const plans = [
	{ name: 'Ground floor', detail: '7 zones · calibrated' },
	{ name: 'Upper floor', detail: '4 zones · not calibrated' },
] as const;
</script>

<template>
	<div class="rp-project-home">
		<header class="rp-project-home__header">
			<button
				type="button"
				class="rp-project-home__back"
			>
				‹ Projects
			</button>
			<h2 class="rp-project-home__title">
				House renovation 2026
			</h2>
			<span class="rp-project-home__status">Planning</span>
			<button
				type="button"
				class="rp-project-home__note"
			>
				Open note
			</button>
		</header>

		<nav
			class="rp-project-home__nav"
			aria-label="Project sections"
		>
			<button
				v-for="section in sections"
				:key="section"
				type="button"
				class="rp-project-home__section"
				:class="{ 'rp-project-home__section--on': section === active }"
				:aria-current="section === active ? 'page' : undefined"
				@click="active = section"
			>
				{{ section }}
			</button>
		</nav>

		<section
			v-if="active === 'Overview'"
			class="rp-project-home__body"
		>
			<p class="rp-project-home__meta">
				Started 4 March 2026 · target 30 November 2026
			</p>

			<div class="rp-project-home__cost">
				<p class="rp-project-home__cost-figure">
					€42,300.00
				</p>
				<p class="rp-project-home__cost-label">
					Estimated cost
				</p>
				<p class="rp-project-home__cost-qualifier">
					3 figures need recalculating. 1 is priced in another currency and is not
					counted.
				</p>
			</div>

			<dl class="rp-project-home__counts">
				<div
					v-for="count in counts"
					:key="count.label"
					class="rp-project-home__count"
				>
					<dt class="rp-project-home__count-label">
						{{ count.label }}
					</dt>
					<dd class="rp-project-home__count-value">
						{{ count.value }}
					</dd>
				</div>
			</dl>

			<p class="rp-project-home__notice">
				1 plan note could not be read.
			</p>
		</section>

		<section
			v-else
			class="rp-project-home__body"
		>
			<div class="rp-project-home__section-head">
				<h3 class="rp-project-home__section-title">
					Plans
				</h3>
				<button
					type="button"
					class="rp-project-home__new"
				>
					New plan
				</button>
			</div>
			<ul class="rp-project-home__plans">
				<li
					v-for="plan in plans"
					:key="plan.name"
					class="rp-project-home__plan"
				>
					<span class="rp-project-home__plan-name">{{ plan.name }}</span>
					<span class="rp-project-home__plan-detail">{{ plan.detail }}</span>
				</li>
			</ul>
		</section>
	</div>
</template>

<style scoped>
.rp-project-home {
	display: flex;
	flex-direction: column;
	height: 100%;
}

/*
 * A GRID rather than a row flex, which is slice 21's own correction carried forward: the back
 * control needs its own line and must not stretch across it, and `flex-basis: 100%` buys the
 * line break by making the item full width — two properties fighting. Here the break is the
 * grid's and the width is `justify-self`'s, so each does one job.
 */
.rp-project-home__header {
	display: grid;
	grid-template-columns: 1fr auto auto;
	gap: var(--size-4-1) var(--size-4-2);
	align-items: center;
	padding: var(--size-4-3) var(--size-4-4) var(--size-4-2);
}

/*
 * `box-shadow: none` is the load-bearing declaration here, and the first draft of this comment
 * got the reason wrong in an instructive way. It blamed specificity — Obsidian's
 * `button:not(.clickable-icon)` at (0,1,1) beating a bare class at (0,1,0), the defect
 * `.rp-dialog-button-danger` already cost this repository — and qualified the selector to win.
 * The box stayed. Specificity was never the issue: a `<style scoped>` rule carries a
 * `[data-v-…]` attribute, so it was already (0,2,0) and already winning every property it
 * DECLARED. It declared `background-color` and `border` and not `box-shadow`, and
 * `--input-shadow` is `inset 0 0 0 1px rgba(0,0,0,0.12)` — a 1px ring drawn INSIDE the box,
 * which is exactly the border that was visible. An unstated property is not an overridden one.
 *
 * The qualification is kept because it costs nothing and the block class is a real containment
 * boundary once this promotes into a `styles/` partial with no `scoped` attribute to lean on.
 *
 * Measured in a browser at both widths. jsdom resolves no `var()` and no cascade, so nothing
 * in `npm run check` could have seen any of it.
 */
.rp-project-home .rp-project-home__back {
	grid-column: 1 / -1;
	justify-self: start;
	padding: 0;
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
	background-color: transparent;
	border: none;
	box-shadow: none;
	cursor: pointer;
}

.rp-project-home .rp-project-home__back:hover {
	color: var(--text-normal);
}

.rp-project-home__title {
	margin: 0;
	font-size: var(--font-ui-large);
	text-align: left;
}

.rp-project-home__status {
	padding: var(--size-4-1) var(--size-4-2);
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-l);
}

.rp-project-home__note {
	font-size: var(--font-ui-smaller);
	cursor: pointer;
}

.rp-project-home__nav {
	display: flex;
	flex-wrap: wrap;
	gap: var(--size-4-1);
	padding: 0 var(--size-4-4);
	border-bottom: 1px solid var(--background-modifier-border);
}

/*
 * The current section is marked by an underline AND by `aria-current`, never by colour alone.
 * The rule keys on a class rather than on `[aria-current]` so it survives promotion unchanged.
 */
.rp-project-home .rp-project-home__section {
	padding: var(--size-4-2);
	font-size: var(--font-ui-small);
	color: var(--text-muted);
	background-color: transparent;
	border: none;
	border-bottom: 2px solid transparent;
	border-radius: 0;
	/* Same reason as the back control above: unstated is not overridden. */
	box-shadow: none;
	cursor: pointer;
}

.rp-project-home .rp-project-home__section:hover {
	color: var(--text-normal);
	background-color: var(--background-modifier-hover);
}

.rp-project-home .rp-project-home__section--on {
	color: var(--text-normal);
	border-bottom-color: var(--interactive-accent);
}

.rp-project-home__body {
	flex: 1;
	min-height: 0;
	padding: var(--size-4-4);
	overflow-y: auto;
}

.rp-project-home__meta {
	margin: 0 0 var(--size-4-4);
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
}

/*
 * The figure leads and the counts follow. The wireframe draws four equal tiles; four equal
 * tiles say the cost is as interesting as the number of plans, and it is the reason the
 * screen exists.
 */
.rp-project-home__cost {
	margin-bottom: var(--size-4-5);
}

.rp-project-home__cost-figure {
	margin: 0;
	font-size: 2rem;
	font-weight: var(--font-bold);
	line-height: 1.1;
}

.rp-project-home__cost-label {
	margin: var(--size-4-1) 0 0;
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
}

.rp-project-home__cost-qualifier {
	max-width: 42ch;
	margin: var(--size-4-2) 0 0;
	font-size: var(--font-ui-smaller);
	color: var(--text-faint);
}

/*
 * A grid of fixed-minimum columns rather than a flex row. Flexed, each item was only as wide
 * as its own digits, so `2 Plans 11 Zones 24 Requirements` read as one run-on line however
 * large the gap — the count and the label of DIFFERENT facts sat closer than the count and
 * label of the same one. The minimum is what makes each one a column the eye can land in.
 */
.rp-project-home__counts {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(9rem, max-content));
	gap: var(--size-4-3) var(--size-4-4);
	margin: 0 0 var(--size-4-4);
	padding: var(--size-4-3) 0;
	border-top: 1px solid var(--background-modifier-border);
	border-bottom: 1px solid var(--background-modifier-border);
}

.rp-project-home__count {
	display: flex;
	flex-direction: column-reverse;
}

.rp-project-home__count-label {
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
}

.rp-project-home__count-value {
	margin: 0;
	font-size: var(--font-ui-medium);
}

.rp-project-home__notice {
	margin: 0;
	padding: var(--size-4-2);
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
	background-color: var(--background-secondary);
	border-radius: var(--radius-s);
}

.rp-project-home__section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--size-4-2);
	margin-bottom: var(--size-4-2);
}

.rp-project-home__section-title {
	margin: 0;
	font-size: var(--font-ui-medium);
}

.rp-project-home__new {
	font-size: var(--font-ui-smaller);
	cursor: pointer;
}

.rp-project-home__plans {
	margin: 0;
	padding: 0;
	list-style: none;
}

.rp-project-home__plan {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: var(--size-4-2);
	padding: var(--size-4-2) 0;
	border-bottom: 1px solid var(--background-modifier-border);
}

.rp-project-home__plan-name {
	flex-grow: 1;
}

.rp-project-home__plan-detail {
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
}
</style>
