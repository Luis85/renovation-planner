<!--
	The Work Packages list, mocked before any of it exists — no entity, no repository, no
	component. Every number below is invented; nothing on this screen is read from a store.

	**What it composes, which is the point of the file living here.** `<StatusBar />` is the
	REAL component from `src/presentation/editor/shell/`, so the plan name in the footer is
	the one `tests/harness/fixture.ts` seeds and not a second invented world — which is also
	why the zone chips read Kitchen, Bathroom, Terrace and Garden: those are the fixture's
	four zones, so a reader can check the two halves of the screen against each other.
	`<WorkPackageFilters />` is the sibling mock. Neither is imported, and neither can be:
	this FILE is template-only, so both tags resolve through the registry the harness index
	installs.

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
	selection or hover affordance (nothing is clickable in a template-only file — a constraint
	that has since been lifted: a mock may carry a `<script setup>`, and `WorkPackageFilters.vue`
	beside this file now does. The pips stay because eight pips beat a bar at 12%, which is a
	judgement rather than a workaround; this file's own repetition is what a script would
	actually fix), no empty
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
			<li class="rp-wp-row rp-wp-row--done">
				<span class="rp-wp-state">
					<span
						class="rp-wp-glyph"
						aria-hidden="true"
					>✓</span>
					<span>
						Complete
					</span>
				</span>
				<span class="rp-wp-identity">
					<span class="rp-wp-name">
						Strip out and dispose
					</span>
					<span class="rp-wp-zones">
						<span class="rp-wp-zone">
							Kitchen
						</span>
						<span class="rp-wp-zone">
							Bathroom
						</span>
					</span>
				</span>
				<span class="rp-wp-trade">
					Demolition
				</span>
				<span class="rp-wp-progress">
					<span
						class="rp-wp-pips"
						aria-hidden="true"
					>
						<i class="rp-wp-pip rp-wp-pip--done" />
						<i class="rp-wp-pip rp-wp-pip--done" />
						<i class="rp-wp-pip rp-wp-pip--done" />
						<i class="rp-wp-pip rp-wp-pip--done" />
						<i class="rp-wp-pip rp-wp-pip--done" />
						<i class="rp-wp-pip rp-wp-pip--done" />
					</span>
					<span class="rp-wp-count">
						6 of 6 tasks
					</span>
				</span>
			</li>

			<li class="rp-wp-row rp-wp-row--running">
				<span class="rp-wp-state">
					<span
						class="rp-wp-glyph"
						aria-hidden="true"
					>◐</span>
					<span>
						In progress
					</span>
				</span>
				<span class="rp-wp-identity">
					<span class="rp-wp-name">
						First fix plumbing
					</span>
					<span class="rp-wp-zones">
						<span class="rp-wp-zone">
							Kitchen
						</span>
						<span class="rp-wp-zone">
							Bathroom
						</span>
					</span>
				</span>
				<span class="rp-wp-trade">
					Plumbing
				</span>
				<span class="rp-wp-progress">
					<span
						class="rp-wp-pips"
						aria-hidden="true"
					>
						<i class="rp-wp-pip rp-wp-pip--done" />
						<i class="rp-wp-pip rp-wp-pip--done" />
						<i class="rp-wp-pip rp-wp-pip--done" />
						<i class="rp-wp-pip" />
						<i class="rp-wp-pip" />
					</span>
					<span class="rp-wp-count">
						3 of 5 tasks
					</span>
				</span>
			</li>

			<li class="rp-wp-row rp-wp-row--running">
				<span class="rp-wp-state">
					<span
						class="rp-wp-glyph"
						aria-hidden="true"
					>◐</span>
					<span>
						In progress
					</span>
				</span>
				<span class="rp-wp-identity">
					<span class="rp-wp-name">
						First fix electrics
					</span>
					<span class="rp-wp-zones">
						<span class="rp-wp-zone">
							Kitchen
						</span>
						<span class="rp-wp-zone">
							Bathroom
						</span>
						<span class="rp-wp-zone">
							Terrace
						</span>
					</span>
				</span>
				<span class="rp-wp-trade">
					Electrical
				</span>
				<span class="rp-wp-progress">
					<span
						class="rp-wp-pips"
						aria-hidden="true"
					>
						<i class="rp-wp-pip rp-wp-pip--done" />
						<i class="rp-wp-pip rp-wp-pip--done" />
						<i class="rp-wp-pip" />
						<i class="rp-wp-pip" />
						<i class="rp-wp-pip" />
						<i class="rp-wp-pip" />
						<i class="rp-wp-pip" />
					</span>
					<span class="rp-wp-count">
						2 of 7 tasks
					</span>
				</span>
			</li>

			<li class="rp-wp-row rp-wp-row--blocked">
				<span class="rp-wp-state">
					<span
						class="rp-wp-glyph"
						aria-hidden="true"
					>!</span>
					<span>
						Blocked
					</span>
				</span>
				<span class="rp-wp-identity">
					<span class="rp-wp-name">
						Floor screed
					</span>
					<span class="rp-wp-zones">
						<span class="rp-wp-zone">
							Kitchen
						</span>
						<span class="rp-wp-zone">
							Bathroom
						</span>
					</span>
					<span class="rp-wp-note">
						Finish-to-start after First fix plumbing
					</span>
				</span>
				<span class="rp-wp-trade">
					Screeding
				</span>
				<span class="rp-wp-progress">
					<span
						class="rp-wp-pips"
						aria-hidden="true"
					>
						<i class="rp-wp-pip" />
						<i class="rp-wp-pip" />
						<i class="rp-wp-pip" />
					</span>
					<span class="rp-wp-count">
						0 of 3 tasks
					</span>
				</span>
			</li>

			<li class="rp-wp-row">
				<span class="rp-wp-state">
					<span
						class="rp-wp-glyph"
						aria-hidden="true"
					>○</span>
					<span>
						Not started
					</span>
				</span>
				<span class="rp-wp-identity">
					<span class="rp-wp-name">
						Terrace waterproofing
					</span>
					<span class="rp-wp-zones">
						<span class="rp-wp-zone">
							Terrace
						</span>
					</span>
				</span>
				<span class="rp-wp-trade">
					Roofing
				</span>
				<span class="rp-wp-progress">
					<span
						class="rp-wp-pips"
						aria-hidden="true"
					>
						<i class="rp-wp-pip" />
						<i class="rp-wp-pip" />
						<i class="rp-wp-pip" />
						<i class="rp-wp-pip" />
					</span>
					<span class="rp-wp-count">
						0 of 4 tasks
					</span>
				</span>
			</li>

			<li class="rp-wp-row">
				<span class="rp-wp-state">
					<span
						class="rp-wp-glyph"
						aria-hidden="true"
					>○</span>
					<span>
						Not started
					</span>
				</span>
				<span class="rp-wp-identity">
					<span class="rp-wp-name">
						Garden levelling
					</span>
					<span class="rp-wp-zones">
						<span class="rp-wp-zone">
							Garden
						</span>
					</span>
				</span>
				<span class="rp-wp-trade">
					Groundworks
				</span>
				<span class="rp-wp-progress">
					<span
						class="rp-wp-pips"
						aria-hidden="true"
					>
						<i class="rp-wp-pip" />
						<i class="rp-wp-pip" />
					</span>
					<span class="rp-wp-count">
						0 of 2 tasks
					</span>
				</span>
			</li>
		</ol>

		<StatusBar />
	</section>
</template>
