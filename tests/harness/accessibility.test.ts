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
 * The Renovation Project view still draws one empty mount div, so its case below reports
 * nothing — that was this project's stated adoption window ("a rule is adopted while it
 * reports nothing", CLAUDE.md), and the Plan Editor is the payoff arriving: the first
 * surface with real content in it is graded from its first commit, rather than an
 * accessibility pass arriving once twenty views already fail one.
 */
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { mountHarness } from './mount';
import { mountPlanEditor, type EditorHarness } from '../helpers/editor';
import { useDialogStore, type DialogDescriptor } from '../../src/presentation/dialogs/dialog-store';

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

	/**
	 * The Plan Editor, which unlike the project surface actually draws something: five §60
	 * regions, seven labelled layer checkboxes, two panel headings and a focusable canvas.
	 * Every one of those is a thing axe CAN grade under this file ceiling — roles,
	 * accessible names, form labels, heading order — so this is the first case here that is
	 * a real check rather than an adoption placeholder.
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
	 * A dialog is the one surface in this plugin that takes the keyboard away from
	 * everything behind it, so it is the one most worth scanning: `role="dialog"` without
	 * an accessible name, a button with no text, and a heading that skips a level are all
	 * real violations axe sees in jsdom.
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
	 * The `form` kind is deliberately not included. No caller in this codebase supplies a
	 * real `FormDescriptor.component` yet — the calibration flow's own form component is a
	 * later task in this slice — and a stand-in component invented for this file would be
	 * exactly the fixture the file header refuses: it would grade markup this suite wrote,
	 * not markup the plugin ships. `dialogHost.test.ts` already proves the fourth arm of
	 * `DialogHost`'s switch renders through the same host.
	 *
	 * What this does NOT check is stated once, here, rather than implied: `inert` is not
	 * modelled by jsdom, so "the background is genuinely unreachable" is asserted by
	 * `dialogHost.test.ts` against the ATTRIBUTE, and verified for real only in a vault.
	 */
	it.each([
		['confirm', { kind: 'confirm', title: 'Recalculate costs?', message: 'This overwrites your manual adjustments.' }],
		['delete-reference', { kind: 'delete-reference', entityLabel: 'Kitchen', references: [{ label: 'Requirements', count: 2 }] }],
		['entity-picker', { kind: 'entity-picker', title: 'Choose a replacement zone', candidates: [{ id: 'z-1', label: 'Bathroom' }] }],
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
});
