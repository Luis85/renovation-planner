/**
 * @vitest-environment jsdom
 *
 * The browser harness's HOME knobs — `?projects=<n>` and `?q=<text>` (Task 12).
 *
 * Split out of `harness.test.ts` rather than added to it: that file was already at its
 * 450-line budget and these cases are one subject, which is what the budget exists to force.
 * The subject is not "does `ProjectList` work" — its own unit tests own that — but **does the
 * FIXTURE behind the five Home captures actually supply what those captures are of.**
 *
 * That distinction is the whole reason this file exists. All five Home shots wait on
 * `.renovation-planner-view`, which the EMPTY state satisfies exactly as well as a list of
 * thirty, so a seed that stopped seeding writes five PNGs of an empty pane and exits 0 — the
 * silent wrong-picture outcome the capture tool exists against. Every assertion below is
 * therefore about a fact the SEED has to establish rather than about a component.
 *
 * jsdom lays nothing out, so nothing here can say anything about the pictures themselves:
 * spacing, wrapping, overflow, hit size and contrast are settled by `npm run harness-shot` and
 * by an eye, and by nothing in this repository's gates.
 */
import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountHarness } from './mount';

describe('the browser harness Home fixture', () => {
	/**
	 * The `?projects=` knob (Task 12), which is the only way any capture reaches a POPULATED
	 * Home surface: the bare root's world is empty by construction, so the three fixed shots
	 * above it photograph the empty state and nothing else ever drew a row.
	 *
	 * Driven here for the reason the `?project=` case above gives, and more sharply: the five
	 * shots that use this knob wait on `.renovation-planner-view`, which the EMPTY state
	 * satisfies just as well as a list of thirty — so a seed that stopped seeding would write
	 * five PNGs of an empty pane and exit 0.
	 *
	 * **Every assertion here is about a fact the FIXTURE has to supply rather than about the
	 * components, which are covered by their own unit tests.** Three of the five fields a row
	 * renders (`planCount`, `lastWorked`, `libraryOverlap`) are derived from the Project INDEX
	 * and the vault's file stats, not from the project repository — so a seed that reached only
	 * the repositories draws thirty rows all reading `EUR` alone, with no plan count, no date
	 * and no marker. That is a picture of the facts slot with no facts in it, and it reads
	 * exactly like a picture that found nothing wrong.
	 */
	it('opens a populated list over the seeded stress fixture, facts and all', async () => {
		const { view } = mountHarness(document.body, { projects: 30 });

		await flushPromises();

		const el = view.contentEl;

		// Thirty projects plus the Continue row, which is a `.rp-project-list__row` too.
		expect(el.querySelectorAll('.rp-project-list__row')).toHaveLength(31);
		// The facts slot with real facts in it, which is the half only the index can supply.
		// `toContain` on the joined text rather than an index into the list: the rows are
		// SORTED, so an assertion keyed on position would pin the collator's output rather than
		// the seed's.
		const facts = [...el.querySelectorAll('.rp-project-row__facts')].map((node) => node.textContent);
		expect(facts).toContain('4 plans · EUR');
		// §8's content rule: an empty entry renders NOTHING and its neighbours close up, so the
		// project seeded with no plans shows its currency alone. A fixture where every project
		// had plans could not demonstrate it, and this is the assertion that keeps one that
		// does.
		expect(facts).toContain('EUR');
		// PRD §83's marker, which needs the project's note filed inside the library folder —
		// a fact about the INDEX path and about nothing the repository holds.
		expect(el.querySelectorAll('.rp-project-list__overlap')).toHaveLength(1);
		// The collapsed group, which needs at least one COMPLETE or AS_BUILT: without one
		// `<details>` never renders and the capture inspects nothing about it.
		expect(el.querySelector('.rp-project-list__completed')).not.toBeNull();
		// §7's Continue group, which renders only when BOTH stored ids resolve — the plan half
		// through `listPlansByProject`, so the fixture has to save a real `Plan` and not merely
		// index one.
		expect(el.querySelector('.rp-continue')).not.toBeNull();
		expect(el.querySelector('.rp-continue__resume')).not.toBeNull();
	});

	/**
	 * The `?q=` knob, which reaches a state `harness-shot` has no other route to: it navigates
	 * and screenshots and types nothing, so without a URL-seeded query the no-match block — §3's
	 * signature interaction, and the only place `overflow-wrap: anywhere` is on screen to be
	 * looked at — could never be in a picture.
	 *
	 * Asserted on the BLOCK and on the create action's own label, because a query that simply
	 * failed to reach the filter would leave thirty ordinary rows and a green
	 * `.renovation-planner-view` behind it.
	 *
	 * **The query carries NO HYPHEN, and that is the shot's requirement rather than this case's.**
	 * A hyphen-minus is a UAX #14 break opportunity, so a hyphenated query wraps at its own
	 * hyphens and `home-no-match-narrow` photographs the easy case — measured, the first version
	 * of that shot produced a byte-identical PNG with `overflow-wrap: anywhere` deleted. Nothing
	 * jsdom can do sees any of that; this case matches the shot's string so the two cannot drift
	 * into testing different queries, and the sentence is here so a later edit that "tidies" this
	 * one knows what it would cost.
	 *
	 * **ONE row survives a query that matches nothing, and it is the Continue row** — measured
	 * here rather than predicted: the first draft of this case asserted zero and failed. The
	 * `Continue` group is outside the filter by construction (`ProjectList`'s own `v-if` reads
	 * `continueProject`, which is resolved by the VIEW against the stored context and never
	 * against the query), so a "filtered to nothing" pane is not an empty one. That is
	 * defensible — Continue is an ACTION and the groups below it are the index — and it is
	 * pinned here as behaviour rather than left as a surprise, because the alternative reading
	 * (filter the Continue row too) is a design decision nobody has taken and this is the case
	 * that would have to change to take it.
	 */
	it('seeds the filter from the query, down to the no-match state', async () => {
		const { view } = mountHarness(document.body, { projects: 30, initialQuery: 'Dachgeschossausbauwintergartensanierungsplanungsbesprechung' });

		await flushPromises();

		const el = view.contentEl;

		// The Continue row and nothing else — no project row survives the query.
		expect(el.querySelectorAll('.rp-project-list__row')).toHaveLength(1);
		expect(el.querySelector('.rp-project-list__row')?.classList.contains('rp-continue')).toBe(true);
		expect(el.querySelector('.rp-project-list__no-match')).not.toBeNull();
		expect(el.querySelector('.rp-project-list__create-named')?.textContent).toContain(
			'Dachgeschossausbauwintergartensanierungsplanungsbesprechung',
		);
	});

});
