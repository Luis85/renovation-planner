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
 * slice 14 gave it a real empty state (a headline and body, no button on this entry), so its
 * case below now grades that markup rather than an empty subtree — proven by an assertion
 * that `.rp-empty-state` is actually in the scanned DOM, not merely by the absence of
 * violations, which a scan of nothing would also report. The Plan Editor's case was the
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
import { installObsidianDom } from '../helpers/dom';
import { makeView } from '../helpers/makeRenovationProjectView';
import { err } from '../../src/core/result/Result';
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

		// Scoped to `contentEl`, not the whole mounted leaf: `containerEl` also carries
		// Obsidian's own `.view-header` chrome (see `tests/helpers/obsidian-mock.ts`),
		// which this plugin does not draw and is not this check's to grade. `contentEl` is
		// exactly the element `onOpen` empties and draws into — the SDD §12 mount point a
		// future Vue app lands in unchanged.
		const results = await axe.run(view.contentEl, runOptions);

		// The `.rp-empty-state` assertion is load-bearing, not decorative: `results.violations`
		// is `[]` on a scan of nothing at all, exactly as it is on a scan of a real, compliant
		// empty state — the two are indistinguishable without this line. Asserted on the DOM
		// this scan actually ran against, so a future regression that reintroduces the timing
		// gap above fails HERE rather than passing vacuously again.
		expect(view.contentEl.querySelector('.rp-empty-state')).not.toBeNull();
		expect(results.violations).toEqual([]);
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
			queries: {
				listProjects: () =>
					Promise.resolve(
						err({ category: 'Persistence', code: 'settings.unrecovered', message: 'no' }),
					),
			},
		});
		document.body.appendChild(view.containerEl);
		await view.onOpen();
		// Same reason as the case above: `hydrate` settles a tick after the synchronous mount, so
		// without this the scan runs against Vue's `<!--v-if-->` placeholders and grades nothing.
		await flushPromises();

		const results = await axe.run(view.contentEl, runOptions);

		expect(view.contentEl.querySelector('.rp-view-message')).not.toBeNull();
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
	 * what the caller supplies. No caller in this codebase supplies a real
	 * `FormDescriptor.component` yet (the calibration flow's own form component is a later
	 * task in this slice), so a stub is the only way to exercise this kind's container at
	 * all before then.
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
