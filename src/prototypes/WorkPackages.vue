<!--
	The Work Packages list, mocked before any of it exists — no entity, no repository, no
	component. Every number below is invented; nothing on this screen is read from a store.

	**What it composes, which is the point of the file living here.** `<StatusBar />` is the
	REAL component from `src/presentation/editor/shell/`, so the plan name in the footer is
	the one `tests/harness/fixture.ts` seeds and not a second invented world — which is also
	why the zone chips read Kitchen, Bathroom, Terrace and Garden: those are the fixture's
	four zones, so a reader can check the two halves of the screen against each other.
	`<WorkPackageFilters />` is the sibling mock. Neither is imported: both tags resolve
	through the registry the harness index installs. That used to be forced — a template-only
	file has nowhere to put an import — and is now a CHOICE, since this file carries a
	`<script setup>`; the registry keeps the two tags reading the same way they did.

	**The design, and the three decisions inside it worth arguing with:**

	1. *A row, not a card.* The renovator's question is comparative — which package is
	   blocked, who is waiting on whom — and cards put whitespace between the things being
	   compared. The row is a four-column grid: state, identity, trade, progress.
	2. *Progress is PIPS, one per task, not a percentage bar.* `docs/requirements/Work
	   package progress.md` refuses a typed percentage outright ("the number that stays at
	   ninety for three weeks") and derives progress from the tasks inside the package. Pips
	   show the derivation instead of hiding it: eight pips means eight tasks, and three
	   filled means three are done. It also survives the small-count case a bar makes a lie
	   of — a bar at 0% and a bar at 12% look identical, two pips do not.
	3. *Status is a glyph AND a word, never a colour alone.* SDD §85 forbids colour as the
	   only channel and `themeTokens.ts` already pays that cost on the canvas; a list is the
	   easiest place to forget it.

	**What this mock deliberately does not draw**, so the gaps read as decisions: no
	selection or hover affordance (nothing was clickable while this file was template-only — a
	constraint since lifted: a mock may carry a `<script setup>`, and `WorkPackageFilters.vue`
	beside this file already did. The pips stay because eight pips beat a bar at 12%, which is a
	judgement rather than a workaround. The repetition this paragraph used to name as "what a
	script would actually fix" IS fixed: the six rows are data and one `v-for`, and the rendered
	DOM was diffed against the hand-written version rather than assumed — see the script block
	for the two differences that remain and why neither is visible), no empty
	state (that is slice 14's, and drawing a second screen here would hide this one), and no
	sort control — the order below is the dependency order the schedule would impose, which
	is the only ordering a renovator asked for in `docs/requirements/Schedule.md`.

	**One thing this screen contradicts, recorded rather than smoothed over.**
	`docs/deliverables/Sitemap.md` lists Work Packages as a *Bases view* — Obsidian's own
	table over the notes, read-only, registering no view type. A plugin-drawn list like this
	one is a different answer to the same row, and a better-informed person than me should
	settle which before any of it is built. It is drawn this way because the ask was a list
	VIEW to look at, and because the two decisions above are invisible in a Bases table:
	Bases renders the columns it is given, so the pips and the paired glyph/word would each
	become a text column.
-->
<script setup lang="ts">
/**
 * The invented rows, as DATA rather than as six copies of one `<li>`.
 *
 * This file's own header used to name that repetition as "what a script would actually fix",
 * under a constraint — no `<script>` in a mock — that has since been lifted; `npm run analyze`
 * reported it as two clone groups, 35 lines. Every number here is still invented and every
 * zone name is still one of `tests/harness/fixture.ts`'s four, so the screen a designer looks
 * at is unchanged. The rendered DOM was DIFFED against the hand-written version rather than
 * assumed, and it is not byte-identical — two differences remain, both checked rather than
 * waved through:
 *
 *  - `v-if` on the note leaves a `<!--v-if-->` placeholder on the five rows without one. A
 *    comment node renders nothing and occupies no box.
 *  - text nodes lose the single spaces the old markup's indentation put around them
 *    (`<span> Kitchen </span>` became `<span>Kitchen</span>`). Those spaces were an artifact of
 *    pretty-printing, not a design choice, and they are invisible: `.rp-wp-zones` and
 *    `.rp-wp-state` are flex containers with a `gap`, `.rp-wp-zone` carries its own padding,
 *    and leading and trailing whitespace inside an item is collapsed away by ordinary CSS text
 *    processing. The separation a reader sees comes from the stylesheet, never from these.
 *
 * That distinction is worth the paragraph because this repository has already shipped the
 * opposite mistake — `ZonePanelprototype`, two inline elements whose only separator was the
 * whitespace Vue's `condense` removed, found by photographing the page after forty-four review
 * rounds over it.
 *
 * The status table is the part that earns more than the line count. Glyph, word and row
 * modifier are three expressions of ONE state, and spelled out per row they could drift into
 * a `◐` beside "Blocked" with nothing to notice — which is the failure the design note above
 * about a glyph AND a word exists to prevent, so it is the last thing this screen should be
 * able to get wrong.
 */
type Status = 'done' | 'running' | 'blocked' | 'todo';

const STATUS: Record<Status, { modifier: string; glyph: string; word: string }> = {
	done: { modifier: 'rp-wp-row--done', glyph: '✓', word: 'Complete' },
	running: { modifier: 'rp-wp-row--running', glyph: '◐', word: 'In progress' },
	blocked: { modifier: 'rp-wp-row--blocked', glyph: '!', word: 'Blocked' },
	// No modifier: the resting row carries the base class alone, as it did when written out.
	todo: { modifier: '', glyph: '○', word: 'Not started' },
};

const ROWS: readonly {
	status: Status;
	name: string;
	zones: readonly string[];
	trade: string;
	done: number;
	total: number;
	note?: string;
}[] = [
	{ status: 'done', name: 'Strip out and dispose', zones: ['Kitchen', 'Bathroom'], trade: 'Demolition', done: 6, total: 6 },
	{ status: 'running', name: 'First fix plumbing', zones: ['Kitchen', 'Bathroom'], trade: 'Plumbing', done: 3, total: 5 },
	{ status: 'running', name: 'First fix electrics', zones: ['Kitchen', 'Bathroom', 'Terrace'], trade: 'Electrical', done: 2, total: 7 },
	{
		status: 'blocked',
		name: 'Floor screed',
		zones: ['Kitchen', 'Bathroom'],
		trade: 'Screeding',
		done: 0,
		total: 3,
		note: 'Finish-to-start after First fix plumbing',
	},
	{ status: 'todo', name: 'Terrace waterproofing', zones: ['Terrace'], trade: 'Roofing', done: 0, total: 4 },
	{ status: 'todo', name: 'Garden levelling', zones: ['Garden'], trade: 'Groundworks', done: 0, total: 2 },
];
</script>

<template>
	<section class="rp-work-packages">
		<header class="rp-wp-header">
			<h2 class="rp-wp-title">
				Work packages
			</h2>
			<button
				type="button"
				class="rp-wp-new"
			>
				New package
			</button>
		</header>

		<WorkPackageFilters />

		<ol class="rp-wp-list">
			<li
				v-for="row in ROWS"
				:key="row.name"
				class="rp-wp-row"
				:class="STATUS[row.status].modifier"
			>
				<span class="rp-wp-state">
					<span
						class="rp-wp-glyph"
						aria-hidden="true"
					>{{ STATUS[row.status].glyph }}</span>
					<span> {{ STATUS[row.status].word }} </span>
				</span>
				<span class="rp-wp-identity">
					<span class="rp-wp-name"> {{ row.name }} </span>
					<span class="rp-wp-zones">
						<span
							v-for="zone in row.zones"
							:key="zone"
							class="rp-wp-zone"
						> {{ zone }} </span>
					</span>
					<span
						v-if="row.note"
						class="rp-wp-note"
					> {{ row.note }} </span>
				</span>
				<span class="rp-wp-trade"> {{ row.trade }} </span>
				<span class="rp-wp-progress">
					<span
						class="rp-wp-pips"
						aria-hidden="true"
					>
						<i
							v-for="pip in row.total"
							:key="pip"
							class="rp-wp-pip"
							:class="pip <= row.done ? 'rp-wp-pip--done' : ''"
						/>
					</span>
					<span class="rp-wp-count"> {{ row.done }} of {{ row.total }} tasks </span>
				</span>
			</li>
		</ol>

		<StatusBar />
	</section>
</template>
