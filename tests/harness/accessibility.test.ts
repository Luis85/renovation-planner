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
 *    a visible focus indicator, or hit-target size, because all three need real layout
 *    and jsdom computes none — `getBoundingClientRect` answers all zeroes here regardless
 *    of markup. `color-contrast` and `color-contrast-enhanced` never resolve to a pass or
 *    a violation in this environment, they land in axe's `incomplete` bucket on every
 *    run; `target-size` finds zero elements to evaluate at all because every element
 *    measures 0×0. All three are disabled below (`LAYOUT_DEPENDENT_RULES`) so this file
 *    does not depend on an `incomplete` result it can never act on. axe has no rule at
 *    all for a visible focus indicator, so nothing here checks that either. A live vault
 *    (`npm run test-build`) remains the only place appearance, contrast, focus
 *    visibility and hit-target size are verified.
 *
 * 2. SCOPE. This check runs against `contentEl` — the plugin's own subtree — rather than
 *    the whole `document`, because jsdom's bare test document has no `<title>`, no
 *    `lang`, and none of the landmarks a real Obsidian window supplies around a view, and
 *    scanning the whole document would fail on those instead of on anything this plugin
 *    controls. The cost, also measured rather than assumed: axe's PAGE-LEVEL rules —
 *    `duplicate-id`, `landmark-one-main` and the other `landmark-*` rules, `region`,
 *    `document-title`, `html-has-lang`, `bypass`/`skip-link` — report in NONE of
 *    `violations`, `incomplete` or even `inapplicable` when the run is scoped to an
 *    element instead of the document, no matter which other rules are enabled or
 *    disabled. Two ids sharing a value inside `contentEl` today would not be caught by
 *    this file. Element-level rules are unaffected by that scoping and do fire correctly
 *    on a subtree — confirmed directly below for `image-alt`, and true the same way for
 *    `button-name`, `label`, `link-name`, `heading-order` and the `aria-*` rules.
 *
 * Put together: this file verifies roles, accessible names, form labels, heading order
 * and ARIA attribute validity on the plugin's own drawn content. It does not verify
 * contrast, focus visibility, hit-target size, or page-wide structural rules like
 * duplicate ids or landmark uniqueness. The word "accessibility" in this filename should
 * be read no wider than that.
 *
 * The view today draws one empty mount div, so the real-view check below reports nothing
 * — that is this project's own stated adoption window ("a rule is adopted while it
 * reports nothing", CLAUDE.md): the payoff is that the first surface actually drawn into
 * that div meets this from its first commit, instead of an accessibility pass arriving
 * once twenty views already don't.
 */
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { mountHarness } from './mount';

/**
 * See the header: all three need real layout, which jsdom does not compute, so left
 * enabled they report `incomplete` rather than a usable pass or violation. Disabled here
 * rather than filtered out of the result afterward, so the rule set this file actually
 * asserts against matches the rule set the header claims — a filter written once and
 * forgotten is exactly the kind of drift `CLAUDE.md`'s "write the guarantee to the check"
 * warns about.
 */
const LAYOUT_DEPENDENT_RULES = ['color-contrast', 'color-contrast-enhanced', 'target-size'];

const runOptions: Parameters<typeof axe.run>[1] = {
	rules: Object.fromEntries(LAYOUT_DEPENDENT_RULES.map((id) => [id, { enabled: false }])),
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

		// Scoped to `contentEl`, not the whole mounted leaf: `containerEl` also carries
		// Obsidian's own `.view-header` chrome (see `tests/helpers/obsidian-mock.ts`),
		// which this plugin does not draw and is not this check's to grade. `contentEl` is
		// exactly the element `onOpen` empties and draws into — the SDD §12 mount point a
		// future Vue app lands in unchanged.
		const results = await axe.run(view.contentEl, runOptions);

		expect(results.violations).toEqual([]);
	});
});
