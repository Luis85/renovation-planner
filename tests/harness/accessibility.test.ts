/**
 * @vitest-environment jsdom
 *
 * The accessibility check SDD §85 asks for: keyboard access, visible focus, semantic
 * labels, status not encoded only by colour, and adequate hit targets. Driven with
 * axe-core (https://github.com/dequelabs/axe-core) against the REAL mounted view —
 * `mountHarness`, the same mount the browser harness and `harness.test.ts` use — never a
 * fixture typed into this file, so it reports on what `RenovationProjectView.onOpen`
 * actually draws rather than on a stand-in nobody keeps in sync with it.
 *
 * THE CEILING — stated once here because every description of this check has to repeat
 * it, not widen it. Two separate limits, both measured against this exact file rather
 * than assumed:
 *
 * 1. LAYOUT. axe running inside jsdom checks semantics only — roles, accessible names,
 *    form labels, heading order, ARIA attribute validity. It CANNOT see colour contrast,
 *    a visible focus indicator, or hit-target size — jsdom has no rendering engine, so
 *    none of the three can work, but the three rules involved fail for three DIFFERENT,
 *    separately verified reasons, not one shared "needs layout":
 *
 *    - `color-contrast` IS enabled by default and DOES run, but throws inside axe's own
 *      check every time: `TypeError: Cannot read properties of null (reading 'canvas')`,
 *      from an internal text-detection helper that expects a working
 *      `HTMLCanvasElement.getContext()` — which jsdom does not implement. axe catches
 *      that per-rule error and reports the rule `incomplete` with the error attached,
 *      rather than a pass or a violation. Confirmed by reading the attached error, not
 *      just the bucket it landed in.
 *    - `color-contrast-enhanced` and `target-size` are simply `enabled: false` by
 *      default in this axe-core version (`axe.getRules()` shows both, independent of
 *      jsdom) — the same "off by default" story as `duplicate-id` below, not a layout
 *      story. Forced on anyway, `target-size` shows the deeper problem: run against a
 *      button styled 2px×2px, it reports a false PASS, because
 *      `getBoundingClientRect`/`offsetWidth`/`offsetHeight` all answer zero for every
 *      element in jsdom regardless of its CSS — so even forcing the rule on would not
 *      make it catch a real hit-target defect, it would make it silently pass one.
 *
 *    All three are disabled below (`LAYOUT_DEPENDENT_RULES`) so this file's assertion
 *    doesn't depend on an `incomplete` result it can never act on, or on a rule that
 *    would pass a genuine defect if left forced on. axe has no rule at all for a visible
 *    focus indicator — verified by reading its full rule list — so nothing here checks
 *    that either. A live vault (`npm run test-build`) remains the only place appearance,
 *    contrast, focus visibility and hit-target size are verified.
 *
 * 2. SCOPE. This check runs against `contentEl` — the plugin's own subtree — rather than
 *    the whole `document`, because jsdom's bare test document has no `<title>`, no
 *    `lang`, and none of the landmarks a real Obsidian window supplies around a view, and
 *    scanning the whole document would fail on those instead of on anything this plugin
 *    controls. Two DIFFERENT, separately measured costs follow, and they are not the same
 *    mechanism even though both end in "not caught by this file":
 *
 *    - `duplicate-id` (and `duplicate-id-active`) never fires here, but NOT because of
 *      subtree scoping — `axe.getRules()` shows both `enabled: false` with a
 *      `'deprecated'` tag in this axe-core version, so they are off by default at ANY
 *      scope. Force-enabling `duplicate-id` (`{ rules: { 'duplicate-id': { enabled: true
 *      } } }`) makes it fire correctly on both `contentEl` and `document` — confirmed
 *      both ways. So two ids sharing a value inside `contentEl` today would not be
 *      caught by this file, but that is a rule this axe-core ships disabled, not a
 *      casualty of scoping it here.
 *    - The rules that ARE scope-dependent are the ones enabled by default that need
 *      whole-page context to judge: `region`, `document-title`, `html-has-lang`,
 *      `html-lang-valid`, `skip-link`, `page-has-heading-one`, `duplicate-id-aria`, and
 *      eight of the nine `landmark-*` rules (the ninth,
 *      `landmark-complementary-is-top-level`, is ALSO disabled-by-default like
 *      `duplicate-id` above — unrelated to scope). Scoped to `contentEl`, every one of
 *      those lands in axe's `inapplicable` bucket rather than `violations` or
 *      `incomplete` — they run, axe decides a partial-document context doesn't meet
 *      their precondition, and they report no pass/fail signal this file could act on
 *      even if it looked. Confirmed by dumping all four result buckets for the mounted,
 *      untouched `contentEl`. (`bypass` is also enabled by default and also silent under
 *      subtree scoping, but its bucket wasn't confirmed as `inapplicable` the way the
 *      others were — even isolated with `runOnly: ['bypass']` it appeared in none of the
 *      four buckets — so it is left off this list rather than grouped in on a guess.)
 *
 *    Element-level rules are unaffected by either of the above and fire correctly on a
 *    subtree — confirmed directly below for `image-alt`, and true the same way for
 *    `button-name`, `label`, `link-name`, `heading-order` and the `aria-*` rules.
 *
 * Put together: this file verifies roles, accessible names, form labels, heading order
 * and ARIA attribute validity on the plugin's own drawn content. It does not verify
 * contrast, focus visibility, hit-target size, or page-wide structural rules like
 * duplicate ids or landmark uniqueness. The word "accessibility" in this filename should
 * be read no wider than that.
 *
 * The Renovation Project view drew one empty mount div through slice 13, so its case below
 * reported nothing for every slice up to this file's own adoption — that was this project's
 * stated adoption window ("a rule is adopted while it reports nothing", CLAUDE.md). Design
 * slice 14 gave it a real empty state (a headline and body); design slice 16 gave that same
 * entry (`renovationProject.noProjects`) its action button, so the case below is this file's
 * first BUTTON-CARRYING empty state — proven by an assertion that `.rp-empty-state__action`
 * is in the scanned DOM as well as `.rp-empty-state` itself, not merely by the absence of
 * violations, which a scan of nothing would also report. Slice 16 also gave this view its
 * first real dialog CONTENT — `NewProjectForm`, the button's hand-off — scanned by its own
 * case further down rather than folded into this one, so a defect in the empty state's own
 * markup and a defect in the form's cannot be conflated. The Plan Editor's case was the
 * first surface here with real content graded from its own first commit; this one caught up
 * a slice later, rather than an accessibility pass arriving once twenty views already fail
 * one.
 */
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { prototypeEntries } from './entries';
import { openIndex } from './indexApp';
import { mountHarness } from './mount';
import { mountPlanEditor, type EditorHarness } from '../helpers/editor';
import { FIXTURE_PLAN } from '../helpers/planFixtures';
import { installObsidianDom } from '../helpers/dom';
import { defaultRenovationProjectDeps, makeView } from '../helpers/makeRenovationProjectView';
import { unavailableRenovationProjectCommands } from '../../src/presentation/views/renovationProjectCommands';
import { err, ok } from '../../src/core/result/Result';
import type { Result } from '../../src/core/result/Result';
import type { RepositoryError } from '../../src/application/ports/repositoryErrors';
import type { RenovationProjectQueryServices } from '../../src/presentation/read-models/renovationProjectQueries';
import { useDialogStore, type DialogDescriptor } from '../../src/presentation/dialogs/dialog-store';
import NewProjectForm from '../../src/presentation/views/NewProjectForm.vue';
import type { ViewStateResult } from 'obsidian';
import type { RenovationProjectDeps } from '../../src/presentation/views/RenovationProjectContext';
import type { PlanSummaryDto } from '../../src/presentation/read-models/PlanDto';

/**
 * A read side where every door refuses with the same code — which is what production does for
 * a session that has one (`unavailableRenovationProjectQueries` builds all three members out
 * of one `refuseUnrecovered`). The two cases below grade the FAILURE state, so refusing is
 * the honest stand-in rather than the fake-harsher-than-the-real-thing CLAUDE.md's fifth
 * instance names: there is no production answer being hidden. Design slice 21's two detail
 * doors refuse beside `listProjects` rather than answering, because a bundle that half-refused
 * would model no session this plugin can be in.
 */
const refusingWith = (code: string): RenovationProjectQueryServices => {
	const refuse = (): Promise<Result<never, RepositoryError>> =>
		Promise.resolve(err({ category: 'Persistence', code, message: 'refused' }));
	return { listProjects: refuse, getProject: refuse, listPlansByProject: refuse };
};

/**
 * A view whose DETAIL state has something to draw, for the two scans at the end of this
 * describe block.
 *
 * Over `defaultRenovationProjectDeps()` rather than a hand-built literal, for that factory's
 * own stated reason: it is the one place an honest default per member is written down, so a
 * widened `RenovationProjectDeps` meets this file at the same moment it meets every other
 * consumer — which is exactly what stranded this file's own four-member literal when design
 * slice 21's Task 5 grew the interface by five members.
 *
 * **It sets no `projectId`, and that is a measurement rather than an omission.**
 * `RenovationProjectView.mount` provides `{ ...this.deps, projectId }` with the VIEW's own
 * field last, so `deps.projectId` is written over on every mount and a value set here would be
 * inert — measured directly: a view built with `projectId: 'project-1'` in its bundle and no
 * `setState` draws the LIST. `setState` is what puts the view in the detail state, so that is
 * what both cases below drive, and a member that looked load-bearing here would send the next
 * reader to the wrong line when one of them fails.
 */
function detailDeps(over: { projectId: string; plans: readonly PlanSummaryDto[] }): RenovationProjectDeps {
	const base = defaultRenovationProjectDeps();
	return {
		...base,
		queries: {
			...base.queries,
			getProject: () =>
				Promise.resolve(ok({ id: over.projectId, name: 'Hallway', status: 'IDEA', libraryOverlap: false })),
			listPlansByProject: () => Promise.resolve(ok(over.plans)),
		},
	};
}

/**
 * See LAYOUT in the header for the three separate, verified reasons these cannot work
 * here: one throws inside axe itself (jsdom has no canvas), two are simply shipped
 * disabled and would pass a real defect if forced on. Disabled here explicitly rather
 * than left to their defaults, so the rule set this file actually asserts against does
 * not silently change if a future axe-core release flips a default — and rather than
 * filtering an `incomplete`/false-pass result out afterward, so the rule set this file
 * asserts against matches the rule set the header claims. A filter written once and
 * forgotten is exactly the kind of drift `CLAUDE.md`'s "write the guarantee to the check"
 * warns about.
 */
const LAYOUT_DEPENDENT_RULES = ['color-contrast', 'color-contrast-enhanced', 'target-size'];

const runOptions: Parameters<typeof axe.run>[1] = {
	rules: Object.fromEntries(LAYOUT_DEPENDENT_RULES.map((id) => [id, { enabled: false }])),
};

/** One state of the index, scanned and torn down — the mount must not outlive the scan. */
/**
 * `document.body`, not the wrapper's own element.
 *
 * `<Teleport>` is a Vue built-in and a dialog, menu or tooltip is exactly what a prototype
 * would reach for it with — and teleported content renders OUTSIDE the mounted tree, so a scan
 * of `wrapper.element` stays green over an unlabelled button that a person can see and press.
 * `openIndex` attaches its host to the body, so the body holds the mount AND anything it
 * teleported, and `beforeEach` empties it between cases.
 */
const scanBody = () => axe.run(document.body, runOptions);

const scan = async (query: string) => {
	const wrapper = await openIndex(query);
	try {
		return await scanBody();
	} finally {
		wrapper.unmount();
	}
};

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('axe against the mounted view', () => {
	/**
	 * Proves the mechanism itself bites, on a fragment unrelated to `src/` — a check that
	 * has never gone red is not known to catch anything, it is only known to have run. An
	 * `<img>` with no `alt` is exactly the "semantic label" gap
	 * `docs/requirements/Accessibility.md` names, independent of any styling this project
	 * cannot verify here. Kept as a permanent case rather than a one-off manual run: the
	 * project's own hook test (`tests/build/lint-edited.test.ts`) pairs "flags an offence"
	 * with "says nothing about clean code" for the same reason — a green suite proves
	 * nothing about a checker that would also be green with the checker disabled.
	 *
	 * Deliberately element-level, not a duplicate-id fixture: see SCOPE in the header —
	 * `image-alt` fires reliably under the same subtree scoping the real-view case below
	 * uses, and a page-level rule like `duplicate-id` would not.
	 */
	it('flags a known violation, so a passing suite here is not a check that never fires', async () => {
		const bad = document.createElement('div');
		bad.innerHTML = '<img src="x.png">';
		document.body.appendChild(bad);

		const results = await axe.run(bad, runOptions);

		expect(results.violations.map((violation) => violation.id)).toContain('image-alt');
	});

	it('reports no semantic violations on the surface RenovationProjectView actually draws', async () => {
		const { view } = mountHarness(document.body);
		// `onOpen` mounts synchronously but `RenovationProjectStore.hydrate` — kicked off from
		// `ViewRoot`'s `onMounted` — resolves its query and applies the empty state one
		// microtask tick later; without waiting, `axe.run` below scanned the placeholder
		// `<!--v-if-->` comment nodes Vue leaves before the store settles, and the "no
		// violations" result was true of an empty subtree, not of the empty state. Measured
		// directly: a scan without this line finds zero elements at all under any rule bucket
		// (passes/incomplete/inapplicable/violations combined) — proof it never reached the
		// headline or body this case exists to grade. `flushPromises` (not a fixed count of
		// `nextTick`s) drains both the query's promise and the reactive re-render it triggers.
		await flushPromises();

		// The `.rp-empty-state` assertion is load-bearing, not decorative: `results.violations`
		// is `[]` on a scan of nothing at all, exactly as it is on a scan of a real, compliant
		// empty state — the two are indistinguishable without this line.
		//
		// **ABOVE the scan, and that is a correction rather than a style choice.** It sat below
		// `axe.run` for two slices under a sentence claiming that a regression reopening the
		// timing gap "fails HERE rather than passing vacuously again", and design slice 21
		// measured that false: delete the `flushPromises()` above and this case still PASSED,
		// because `axe.run` awaits enough turns internally for the store to settle before an
		// assertion below it ever runs. The DOM was empty at the moment of the scan and
		// populated by the time anything looked — precisely the vacuous pass that sentence
		// promised to catch. Asked BEFORE the scan it is a statement about the DOM axe is
		// handed, and dropping the wait turns it red (measured both ways, on this case and on
		// the two detail-state ones below).
		expect(view.contentEl.querySelector('.rp-empty-state')).not.toBeNull();
		// Design slice 16's addition: `renovationProject.noProjects` carries an action button
		// now (`EMPTY_STATE_CONTENT`'s `actionLabel`), so this was the first BUTTON-CARRYING
		// empty state this file ever scanned. Asserted directly rather than inferred from
		// "no violations", for the identical reason the line above exists.
		expect(view.contentEl.querySelector('.rp-empty-state__action')).not.toBeNull();

		// Scoped to `contentEl`, not the whole mounted leaf: `containerEl` also carries
		// Obsidian's own `.view-header` chrome (see `tests/helpers/obsidian-mock.ts`),
		// which this plugin does not draw and is not this check's to grade. `contentEl` is
		// exactly the element `onOpen` empties and draws into — the SDD §12 mount point a
		// future Vue app lands in unchanged.
		const results = await axe.run(view.contentEl, runOptions);

		expect(results.violations).toEqual([]);
	});

	/**
	 * The project LIST, carrying design slice 19's §83 library-overlap marker — this project's
	 * first row-level status, and the first thing in this view that says something about a
	 * project rather than merely naming it.
	 *
	 * The case above grades the EMPTY state and can never reach a row: `mountHarness` takes no
	 * `deps`, so its list is empty by construction. This one hands `makeView` a list holding one
	 * marked project — rather than exposing the helper's own `IndexLibraryOverlaps`, which is
	 * built over an empty `InMemoryProjectIndex` and so is incapable of answering "overlapping"
	 * at all. What is graded is the marker's MARKUP, which is what axe can see at this file's
	 * ceiling; the mark itself is CSS-drawn and jsdom resolves no CSS, so the "mark and a word"
	 * contract is held by `projectListOverlap.test.ts` against the stylesheet instead.
	 *
	 * The PRESENCE assertions are the load-bearing half, for this file's standing reason:
	 * `results.violations` is `[]` on a scan of nothing at all, indistinguishable from a scan of
	 * compliant markup — measured here by rendering the marker's `v-if` false, which reddens
	 * this case and nothing else. `flushPromises` is kept for uniformity with its siblings
	 * rather than because this case needs it, and the difference was measured too: this case
	 * `await`s `onOpen` (`mountHarness` does not — it is synchronous and `void`s it), and the
	 * fixture query resolves immediately, so removing the line leaves the case green. Kept
	 * because a case that relies on how few microtasks a hydrate happens to take is one edit
	 * from the vacuous pass the empty-state case above already shipped once.
	 */
	it('reports no semantic violations on a project row carrying the library-overlap marker', async () => {
		installObsidianDom();
		const view = makeView({
			// SPREAD at BOTH levels rather than a bare literal, and slice 21 is why: this bundle
			// was written when `RenovationProjectDeps` had four members and
			// `RenovationProjectQueryServices` had one. The detail state added five to the first
			// and two to the second, so a hand-built literal no longer satisfies either type.
			// The default supplies everything this case has no opinion about; it overrides
			// exactly the one query it is about.
			...defaultRenovationProjectDeps(),
			queries: {
				...defaultRenovationProjectDeps().queries,
				listProjects: () =>
					Promise.resolve(
						ok({
							projects: [{ id: 'p1', name: 'Kitchen refit', status: 'IDEA', libraryOverlap: true }],
							unreadable: 0,
						}),
					),
			},
			commands: unavailableRenovationProjectCommands(),
			openProject: () => Promise.resolve('opened' as const),
			onProjectsChanged: () => () => undefined,
		});
		document.body.appendChild(view.containerEl);
		await view.onOpen();
		await flushPromises();

		const results = await axe.run(view.contentEl, runOptions);

		expect(view.contentEl.querySelector('.rp-project-list__row')).not.toBeNull();
		expect(view.contentEl.querySelector('.rp-project-list__overlap')).not.toBeNull();
		expect(results.violations).toEqual([]);
		await view.onClose();
	});

	/**
	 * The same surface in its FAILED state, which the case above cannot reach: it mounts
	 * through `mountHarness`, whose `makeView()` default answers an empty, clean project list,
	 * so it grades the empty state and only the empty state. Until this case existed,
	 * `.rp-view-message` — the region `ViewRoot` draws for a refused read and for a load in
	 * flight — was in no scanned DOM anywhere in this repository, and the file's green said
	 * nothing whatever about it.
	 *
	 * Built through `makeView` directly rather than through `mountHarness`, because that mount
	 * takes no `deps`: giving it one would change what the browser harness page draws, and the
	 * empty state is what that page exists to show. `makeView` is still the ONE construction
	 * site both the suite and the harness go through, so this case grades the real view.
	 *
	 * The presence assertion is the load-bearing half, for slice 14's own reason:
	 * `results.violations` is `[]` on a scan of a subtree that contains nothing at all, exactly
	 * as it is on a scan of a real, compliant region — a pass that is true of an empty subtree
	 * is indistinguishable from a pass on compliant markup. Asserting the region is present in
	 * the DOM this scan actually ran against is what makes a green here mean something.
	 */
	it('reports no semantic violations on the failure message the view draws for a refused read', async () => {
		installObsidianDom();
		const view = makeView({
			...defaultRenovationProjectDeps(),
			queries: refusingWith('settings.unrecovered'),
			commands: unavailableRenovationProjectCommands(),
		});
		document.body.appendChild(view.containerEl);
		await view.onOpen();
		// Same reason as the case above: `hydrate` settles a tick after the synchronous mount, so
		// without this the scan runs against Vue's `<!--v-if-->` placeholders and grades nothing.
		await flushPromises();

		// ABOVE the scan, for the reason the empty-state case measures out: below it, a presence
		// assertion passes even when the DOM handed to axe was empty.
		expect(view.contentEl.querySelector('.rp-view-failure')).not.toBeNull();

		const results = await axe.run(view.contentEl, runOptions);

		expect(results.violations).toEqual([]);
		await view.onClose();
	});

	/**
	 * The same surface with its ACTION, which is a different scan and not a redundant one.
	 *
	 * The case above uses `settings.unrecovered`, and design slice 17 withholds the retry from
	 * that one deliberately — so it grades a failure state with no button, exactly as the Plan
	 * Editor's DEFAULT fixture grades the buttonless `planEditor.noBackground` (the editor's
	 * action-carrying `planEditor.noZones` has its own case further down, which this one is the
	 * pattern for). A button carries
	 * its own gradeable properties (an accessible name above all), and `role="alert"` on the
	 * container is the one piece of ARIA this slice adds anywhere a scan in this file can reach.
	 *
	 * The presence assertion is load-bearing for this file's usual reason: `violations` is `[]`
	 * on a subtree containing nothing at all, so asserting the control is really in the DOM this
	 * scan ran against is what makes green mean something.
	 */
	it('reports no semantic violations on a failure state carrying a retry', async () => {
		installObsidianDom();
		const view = makeView({
			...defaultRenovationProjectDeps(),
			queries: refusingWith('vault.unexpected-failure'),
			commands: unavailableRenovationProjectCommands(),
		});
		document.body.appendChild(view.containerEl);
		await view.onOpen();
		await flushPromises();

		// ABOVE the scan — same measurement as the empty-state case.
		expect(view.contentEl.querySelector('.rp-view-failure__action')).not.toBeNull();

		const results = await axe.run(view.contentEl, runOptions);

		expect(results.violations).toEqual([]);
		await view.onClose();
	});

	/**
	 * The DETAIL state with no plans, scanned WITH its action button — design slice 21.
	 *
	 * CLAUDE.md recorded `planEditor.noZones` as the one action-carrying empty state no axe scan
	 * in this repository reached, and this slice must not make that two:
	 * `renovationProject.noPlans` carries a button from its first commit, so it is graded here
	 * rather than joining that gap. It is the third button-carrying empty state to exist, and
	 * all three are scanned in this file since the improvement pass closed `noZones` with a
	 * fixture — see the last case in this block.
	 *
	 * `flushPromises()` before scanning is load-bearing, and this file has already been burned by
	 * its absence: the mount is synchronous while `ProjectDetailStore.hydrate` settles a tick
	 * later, so a scan taken early is handed a subtree holding nothing but Vue's `<!--v-if-->`
	 * placeholders — a pass true of an empty subtree and indistinguishable from a pass on
	 * compliant markup. The three presence assertions are what make this a scan of something,
	 * and they sit ABOVE `axe.run` for the reason the empty-state case measures out: below it,
	 * they pass even when the DOM axe was handed was empty. `.rp-project-detail__back` is one of
	 * them because the empty state sits INSIDE the detail shell rather than replacing it, so this
	 * pass grades the header's two controls in the same run — a scan of the real surface, not of
	 * a component in isolation.
	 */
	it('reports no semantic violations on the project detail state and its action', async () => {
		installObsidianDom();
		const view = makeView(detailDeps({ projectId: 'project-1', plans: [] }));
		document.body.appendChild(view.containerEl);
		await view.onOpen();
		// `setState`, not the bundle: see `detailDeps`. It is also the ONE door a real
		// navigation and a restored leaf both arrive through.
		await view.setState({ projectId: 'project-1' }, {} as ViewStateResult);
		await flushPromises();

		expect(view.contentEl.querySelector('.rp-empty-state')).not.toBeNull();
		expect(view.contentEl.querySelector('.rp-empty-state__action')).not.toBeNull();
		expect(view.contentEl.querySelector('.rp-project-detail__back')).not.toBeNull();

		const results = await axe.run(view.contentEl, runOptions);

		expect(results.violations).toEqual([]);
		await view.onClose();
	});

	/**
	 * The POPULATED detail state, which draws different markup — the same header, plus a `Plans`
	 * heading and a list of plan rows. Its own case rather than a second fixture on the one
	 * above, because only this branch has two headings for `heading-order` to judge: the
	 * project's `<h2>` and `PlanList`'s `<h3>`.
	 *
	 * **What neither case grades is the empty branch's heading LEVEL, and that is measured
	 * rather than assumed.** `projectDetail.test.ts`'s own case said this scan "would catch it
	 * … as a heading-order violation"; driven with `:heading-level="3"` removed from
	 * `ProjectDetail`, every case in this file stays green — axe reports a SKIPPED level
	 * (`<h2>` then `<h4>`) and a peer `<h2>` under an `<h2>` is not one. So the tag assertion
	 * over there is not a smaller, closer form of this scan; it is the only instrument for that
	 * decision, and the sentence in it has been narrowed to say so.
	 */
	it('reports no semantic violations on a project with plans', async () => {
		installObsidianDom();
		const view = makeView(detailDeps({ projectId: 'project-1', plans: [{ id: 'plan-1', name: 'Ground floor' }] }));
		document.body.appendChild(view.containerEl);
		await view.onOpen();
		await view.setState({ projectId: 'project-1' }, {} as ViewStateResult);
		await flushPromises();

		// Load-bearing for the same reason every other presence assertion in this file is, and
		// the ROW is asserted beside the shell: `.rp-project-detail` is drawn by the empty
		// branch too, so without the row this case cannot tell a populated list from an empty
		// one and would go on passing over a `PlanList` that rendered no rows at all.
		expect(view.contentEl.querySelector('.rp-project-detail')).not.toBeNull();
		expect(view.contentEl.querySelector('.rp-plan-list__row')).not.toBeNull();

		const results = await axe.run(view.contentEl, runOptions);

		expect(results.violations).toEqual([]);
		await view.onClose();
	});

	/**
	 * The Plan Editor: five §60 regions, seven labelled layer checkboxes, two panel headings
	 * and a focusable canvas. Every one of those is a thing axe CAN grade under this file
	 * ceiling — roles, accessible names, form labels, heading order. The project surface case
	 * above grades real markup now too (design slice 14's empty state), so this is no longer
	 * the only non-placeholder case in this file — see that case's own comment for the timing
	 * gap that had to be closed before it could make the same claim.
	 *
	 * Mounted through the same harness the editor suites use, so it grades what
	 *  actually renders and not a fixture typed into this file.
	 */
	it('reports no semantic violations on the plan editor', async () => {
		let mounted: EditorHarness | null = null;
		try {
			mounted = await mountPlanEditor();

			const results = await axe.run(mounted.wrapper.element as HTMLElement, runOptions);

			expect(results.violations).toEqual([]);
		} finally {
			mounted?.unmount();
		}
	});

	/**
	 * **The last action-carrying empty state no axe scan reached** — and BOTH this branch and
	 * `main` added a case for it independently, which is why this docblock carries two
	 * arguments rather than one.
	 *
	 * The case above mounts the DEFAULT fixture, whose plan has no background, so
	 * `selectPlanEditorEmptyState` answers `planEditor.noBackground` — the entry design slice
	 * 14 ships deliberately buttonless, since `set-plan-background` is a plugin command the
	 * editor's Vue tree cannot reach. `planEditor.noZones` is the other entry, its action
	 * activates the polygon tool, and its only exercise was `emptyStateOverlay.test.ts`:
	 * behaviour, not semantics. A button carries gradeable properties nothing else here has,
	 * an accessible name above all. A plan WITH a background and NO zones is the one input
	 * that reaches it — the fixture `emptyStateOverlay.test.ts` already spells.
	 *
	 * **The presence assertions sit ABOVE `axe.run`, and that ordering is the whole of what
	 * the merge had to decide.** The two versions differed in exactly this: `main`'s placed
	 * them after the scan, arguing that `mountPlanEditor` awaits its own `settle()` so the
	 * overlay is already drawn. That argument is probably true and is not what makes the case
	 * sound — this file measured the counter-case in the Renovation Project section above: an
	 * assertion BELOW `axe.run` passes even when the subtree handed to axe was empty, because
	 * `axe.run` itself awaits enough turns for the store to settle before anything reads the
	 * DOM. Green scan of nothing, green assertion afterwards, nothing graded. Above the scan
	 * the same drift fails at the assertion instead — measured: restoring the default fixture
	 * fails there rather than at the scan. The overlay also yields to an ACTIVE TOOL, a second
	 * way this case could quietly stop scanning what it names, and the same assertion covers
	 * that too.
	 */
	it('reports no semantic violations on the plan editor empty state that carries an action', async () => {
		let mounted: EditorHarness | null = null;
		try {
			mounted = await mountPlanEditor({
				plan: { ...FIXTURE_PLAN, background: { path: 'Plans/ground.png', kind: 'image' } },
				zones: [],
			});
			expect(mounted.wrapper.find('.rp-empty-state').exists()).toBe(true);
			expect(mounted.wrapper.find('.rp-empty-state__action').exists()).toBe(true);

			const results = await axe.run(mounted.wrapper.element as HTMLElement, runOptions);
			expect(results.violations).toEqual([]);
		} finally {
			mounted?.unmount();
		}
	});

	/**
	 * A dialog is the one surface in this plugin that takes the keyboard away from
	 * everything behind it, so it is the one most worth scanning: `role="dialog"` without
	 * an accessible name and a button with no text are both real violations axe sees here.
	 * A heading LEVEL is not one of them at this scope, and that is a limit of the scope
	 * rather than a reason for choosing it. Every kind renders its title as an `<h2>`, and
	 * the Renovation Project view draws no other heading, so the scanned subtree holds one
	 * heading: axe's `heading-order` needs a PRECEDING heading to compare against and lands
	 * a lone one in `passes`, while `page-has-heading-one` (which would otherwise catch "the
	 * first heading is not `<h1>`") is scope-inapplicable per this file's own header.
	 *
	 * The earlier version of this paragraph read the other way round — that a dialog `<h4>`
	 * following the Plan Editor's `<h2>` panel titles WOULD land in `violations`, and that
	 * this was why the case mounts here. There is no `<h4>` anywhere in `src/`; measured
	 * against this branch, the Plan Editor with a dialog open scans as three `<h2>`s and
	 * zero violations, so either mount is clean and the real reason is the one below.
	 *
	 * Mounted through `mountHarness` — the Renovation Project view, which otherwise draws
	 * nothing (see the header) — rather than the Plan Editor case above: `DialogHost`
	 * mounts in both (design slice 15), but the dialog framework's own markup is identical
	 * either way, so scanning it here keeps a finding about the dialog from being
	 * conflated with the Plan Editor's own five regions. `useDialogStore()` with no Pinia
	 * argument resolves to the SAME store `DialogHost` reads: `RenovationProjectView.
	 * onOpen` calls `app.use(createPinia())` synchronously inside `mountHarness`, which is
	 * what makes that instance Pinia's own active one, and `useStore` falls back to it when
	 * called outside a component's `setup`.
	 *
	 * The `form` kind IS included, via the same trivial `StubForm` `dialogHost.test.ts`
	 * already mounts for its own "fourth arm of the switch" case. That stub is slot content,
	 * not the markup under test — `<component :is="descriptor.component">` is the one line
	 * of `FormDialog.vue` it stands in for; the title, the body wrapper and the Cancel
	 * button around it are real `FormDialog.vue` markup, unconditionally rendered no matter
	 * what the caller supplies. Design slice 16's `NewProjectForm` is now a real caller of
	 * `FormDescriptor.component` — see the dedicated case below this block — so the stub
	 * here is a deliberate choice rather than the only option: it isolates the container's
	 * OWN markup (title, body wrapper, Cancel button) from any one form's fields, the same
	 * way the earlier paragraph keeps a dialog finding from being conflated with the Plan
	 * Editor's five regions.
	 *
	 * What this does NOT check is stated once, here, rather than implied: `inert` is not
	 * modelled by jsdom, so "the background is genuinely unreachable" is asserted by
	 * `dialogHost.test.ts` against the ATTRIBUTE, and verified for real only in a vault.
	 */
	it.each([
		['confirm', { kind: 'confirm', title: 'Recalculate costs?', message: 'This overwrites your manual adjustments.' }],
		['delete-reference', { kind: 'delete-reference', entityLabel: 'Kitchen', references: [{ label: 'Requirements', count: 2 }] }],
		['entity-picker', { kind: 'entity-picker', title: 'Choose a replacement zone', candidates: [{ id: 'z-1', label: 'Bathroom' }] }],
		['form', { kind: 'form', title: 'Add a new asset', component: defineComponent({ template: '<p>stub form</p>' }) }],
	] as Array<[string, DialogDescriptor]>)(
		'reports no semantic violation with a %s dialog open',
		async (_kind, descriptor) => {
			const { view } = mountHarness(document.body);
			void useDialogStore().openDialog(descriptor);
			await nextTick();

			const results = await axe.run(view.contentEl, runOptions);

			expect(results.violations).toEqual([]);
		},
	);

	/**
	 * `NewProjectForm` (design slice 16), the New Project dialog's real content — every
	 * `<FieldError>`'s minted id and `aria-describedby` wiring, every `<label for>`, and
	 * `<FormBanner>`'s hidden-until-populated region, none of which the stub `form` case
	 * above renders. Opened the same way `ViewRoot.onCreateProject` opens it (a `form`
	 * descriptor naming the real component and a `dispatch` fixture), never through a click
	 * on the empty state's button — this file already scans that button in the case above;
	 * dispatching through it here would test Vue's click wiring, not axe.
	 */
	it('reports no semantic violations with the New Project form open', async () => {
		const { view } = mountHarness(document.body);
		// Same reason as the empty-state case above: the store's query settles a tick after
		// the synchronous mount, and this dialog is opened from that same view.
		await flushPromises();

		void useDialogStore().openDialog({
			kind: 'form',
			title: 'New project',
			component: NewProjectForm,
			props: {
				dispatch: () => Promise.resolve(ok({ project: { entity: { id: 'p1' } } })),
			},
		});
		await nextTick();

		// Load-bearing for the same reason every other presence assertion in this file is:
		// `results.violations` is `[]` on a scan of nothing at all, indistinguishable from a
		// scan of a real, compliant form without this line. ABOVE the scan, for the reason the
		// empty-state case measures out.
		expect(view.contentEl.querySelector('.rp-dialog-form')).not.toBeNull();

		const results = await axe.run(view.contentEl, runOptions);

		expect(results.violations).toEqual([]);
	});
});

/**
 * The harness index, which this file did not touch until now — and which is the surface here
 * most likely to hold a defect axe CAN see, since it is the only page built out of interactive
 * controls rather than a canvas: a labelled `nav`, a list of links, an `h1`, a live
 * `role="alert"` and a stage whose contents swap.
 *
 * "Developer tooling" is the usual reason to skip it and is not a good one: a designer using a
 * screen reader is a person this tool would otherwise exclude. The file's whole ceiling still
 * applies — see the header — so this grades semantics and nothing about how any of it looks.
 *
 * Mounted through `indexAppConfig()`, the same object the browser's page is configured from,
 * for the reason every case above gives: a fixture typed into this file would grade markup
 * nobody keeps in sync with what renders.
 *
 * Three states, because they draw different markup and only the first is reachable by default:
 * the picker, an entry OPEN on the stage, and the failure card — which exists only when
 * something went wrong and is the one piece of live-region markup in the tree.
 *
 * The open-entry state is EVERY prototype, from the real glob, not one hard-coded id. The first
 * version scanned `ZonePanel` alone, which meant a mock shipping an unlabelled control anywhere
 * else was invisible: the picker scan sees only that mock's row in the list, and this scan was
 * looking at a different file. A mock is exactly the artefact nobody writes a test for, so the
 * set has to come from the tree.
 */
describe('axe against the harness index', () => {
	it.each([
		['the picker', 'index'],
		['the failure card', 'entry=prototype:Nope'],
	])('reports no semantic violations on %s', async (_state, query) => {
		expect((await scan(query)).violations).toEqual([]);
	});

	/**
	 * Every prototype, and the entry has to have OPENED before the scan means anything: an
	 * `?entry=` that resolved to nothing leaves a failure card on the stage, which axe grades
	 * happily and which is not the markup this case names. A renamed or broken mock would
	 * otherwise pass here while being scanned not at all.
	 */
	it.each(prototypeEntries())('reports no semantic violations on $id', async ({ id }) => {
		// ENCODED, as `hrefFor` and `scripts/entryShots.mjs` both do. An id is built from a file
		// path and `&` is a legal filename character, so an unencoded one would truncate the
		// query and this case would report that a perfectly good prototype had failed to open —
		// a red gate caused by adding a legal file, not by anything being wrong with it.
		const wrapper = await openIndex(`entry=${encodeURIComponent(id)}`);

		try {
			expect(wrapper.find('.rp-harness-failure').exists(), `${id} did not open`).toBe(false);
			expect(wrapper.find('.rp-harness-stage').attributes('data-entry')).toBe(id);

			const results = await scanBody();

			expect(results.violations).toEqual([]);
		} finally {
			wrapper.unmount();
		}
	});

	/**
	 * The loop above is generated from a glob, and an `it.each` over an empty array reports as a
	 * pass. That is indistinguishable from "every mock is clean" and is exactly the state this
	 * file was in when it scanned one hard-coded id.
	 */
	it('has prototypes to scan at all', () => {
		expect(prototypeEntries().length).toBeGreaterThan(0);
	});
});
