/**
 * The bundle's entry point. Everything real is in `mount.ts`, `planEditor.ts`,
 * `assetDesigner.ts` and `IndexPage.vue`, each of which a test can drive.
 *
 * `?view=plan-editor` opens the Plan Editor instead of the project surface, `?view=asset-designer`
 * (Task B10) opens the asset designer the same way, `?project=<id>` opens the Renovation Project
 * view's DETAIL state on a seeded project of that id rather than its list, and `?index` (or an
 * `?entry=`) opens the harness index. A query parameter rather than a second page, for the same
 * reason `?theme` and `?phone` are ones: a headless screenshot needs a URL and nothing to click.
 */
import { createApp } from 'vue';
import VueKonva from 'vue-konva';
import { mountHarness } from './mount';
import { mountPlanEditorHarness } from './planEditor';
import { mountAssetDesignerHarness } from './assetDesigner';
import { seedFixture, harnessEditorContext } from './fixture';
import { PLAN_EDITOR_CONTEXT } from '../../src/presentation/editor/PlanEditorContext';
import { componentEntries, prototypeEntries, registerEntries, registrableComponents } from './entries';
import IndexPage from './IndexPage.vue';
import { installObsidianDom } from '../helpers/dom';
import { applyPlatform, applyWantedScheme, drawSchemeToggle } from './theme';

// Before the mount: `is-phone` is a body class that a toolbar's own fit measurement can
// see, and applying it afterwards would leave that measurement made against the other
// layout.
applyPlatform(window.location.search);

const params = new URLSearchParams(window.location.search);

/**
 * The index is OPT-IN, and that is a decision rather than an accident.
 *
 * `?view=plan-editor` keeps the Plan Editor and everything else keeps the project view,
 * because `scripts/harness-shot.mjs`'s FIVE fixed shots address the project surface with no
 * `view` parameter at all — `''`, `?theme=light`, `?phone`, and design slice 21's
 * `?project=project-1` at both widths. Making a bare URL mean "index" would break all five, and
 * the test in Task 6 that asserts the fixed shots still exist would keep passing while the
 * captures timed out.
 *
 * This sentence said THREE and named the first three until slice 21 added the other two — a
 * count that goes stale in the direction of a WEAKER argument, which is the quiet kind. Found
 * while acting on a review finding about its neighbours rather than by any gate: nothing reads
 * a prose enumeration against the list it describes.
 *
 * The PBI leaves "does the index displace the current root" open. This answers it: it does
 * not, because displacing it costs a working workflow to save one query parameter.
 */
const wantsIndex = params.has('index') || params.has('entry');
const wantsPlanEditor = params.get('view') === 'plan-editor';
const wantsAssetDesigner = params.get('view') === 'asset-designer';
/**
 * The Plan Editor's own two knobs (Task 21): `?select=<zoneId>` selects and frames a seeded
 * zone once the editor is ready, `?add` opens the Add menu once it is ready. Both are read
 * here, beside `wantsPlanEditor`, and handed to `mountPlanEditorHarness` below rather than
 * read a second time there — one parse of the URL, like every other knob on this page.
 */
const selectZoneId = params.get('select');
const wantsAddMenu = params.has('add');

let view: unknown = null;

if (wantsIndex) {
	/**
	 * The shim, on this branch too.
	 *
	 * `mountHarness` and `mountPlanEditorHarness` install Obsidian's DOM prototype extensions
	 * and this branch calls neither — but `drawSchemeToggle()` below runs on EVERY branch and
	 * uses `document.body.createEl`. Without this the index mounts and then throws, which
	 * `harness-shot` records as a page error and exits non-zero on: a capture that looks
	 * broken while the entry rendered perfectly.
	 *
	 * `applyPlatform` in `theme.ts` carries the same rule, with the sentence that explains why
	 * no test catches it: every jsdom file installs these at module top, so the shimmed
	 * spelling passes the suite and throws on the real page.
	 */
	installObsidianDom();
	document.body.empty();

	const root = document.body.createDiv('rp-harness-leaf');
	/**
	 * Pinia AND VueKonva, because the production mount installs both.
	 * `src/presentation/views/PlanEditorView.ts` calls `app.use(VueKonva)` where it mounts, and without it
	 * here every canvas component — `PlanCanvas`, `ZoneLayer`, `ZoneShape` — leaves `VStage`,
	 * `VLayer` and `VLine` unresolved.
	 *
	 * That failure is SILENT in the worst way: Vue reports an unresolved component as a
	 * warning, not an error, and the entry's outer element still satisfies the screenshot
	 * selector. `harness-shot` would exit 0 with a PNG of a missing canvas — the exact shape
	 * of failure this whole feature is built to make impossible.
	 */
	const app = createApp(IndexPage).use(seedFixture()).use(VueKonva);

	/**
	 * The third thing the production mount does, and the one with no `use()` to make it
	 * obvious. `PlanEditorView` calls `app.provide(PLAN_EDITOR_CONTEXT, …)`; without it every
	 * component reading `usePlanEditorContext()` throws, and the index would show the named
	 * failure for precisely the components a designer most wants to see.
	 */
	app.provide(PLAN_EDITOR_CONTEXT, harnessEditorContext());

	/**
	 * Every real component, registered globally and lazily.
	 *
	 * Without this a template-only prototype cannot use one: `<StatusBar />` resolves through a
	 * local import or the app registry, and a file with no `<script setup>` has no imports. The
	 * prototype would render an unresolved custom element — silently, since Vue only warns —
	 * and "compose mocks beside real components" would not work at all, which is the feature.
	 *
	 * `defineAsyncComponent` keeps the glob lazy: registering twelve components eagerly would
	 * mount the presentation layer to draw a list of links.
	 */
	// BOTH kinds. A top-level prototype composes the mocks written beside it, and a
	// template-only mock cannot import a sibling any more than it can import a component —
	// registering only the real ones leaves `<MockToolbar />` unresolved, which is half the
	// main flow. One registry across both is also what lets a mock TAKE the tag of the
	// component it stands in for, which is the workflow rather than a collision to refuse.
	const { byTag, ambiguous, shadowed } = registrableComponents([
		...componentEntries(),
		...prototypeEntries(),
	]);

	// One shared function with `indexApp.ts`, which is what makes the refusal below reachable
	// from a test at all — see `registerEntries` for what it refuses and why the alternative is
	// a wrong screenshot at exit 0.
	const refused = registerEntries(app, byTag);

	if (refused.length > 0) {
		console.error(`harness entries not registered, the tag is a plugin's: ${refused.join(', ')}`);
	}

	// The workflow, not a warning: a mock named after a component takes its tag.
	if (shadowed.length > 0) console.info(`mocks standing in for components: ${shadowed.join(', ')}`);

	// Two of one kind: registered for nobody rather than for whichever won a race. The
	// unresolved tag that follows is NOT left as a console warning — `IndexPage.vue` catches
	// Vue's resolution warning and turns it into a named entry failure, because a warning is
	// invisible to `harness-shot` and it would photograph the gap and exit 0.
	if (ambiguous.length > 0) console.warn(`ambiguous component tags, not registered: ${ambiguous.join(', ')}`);

	app.mount(root);
} else {
	/**
	 * `params.get('project')` is `null` when the parameter is absent, which is exactly the
	 * value `mountHarness` reads as "the list" — the same sentinel `RenovationProjectDeps.
	 * projectId` uses, so no translation happens here and a bare root keeps taking the
	 * untouched default.
	 */
	view = wantsPlanEditor
		? mountPlanEditorHarness(document.body, { select: selectZoneId ?? undefined, add: wantsAddMenu }).view
		: wantsAssetDesigner
			? mountAssetDesignerHarness(document.body).view
			: mountHarness(document.body, params.get('project')).view;
}

// After the mount: the toggle is the harness's own furniture and is appended to the body,
// which `mountHarness` empties.
//
// `&bare` asks for a picture of the SCREEN, and `scripts/entryShots.mjs` puts it on every named
// capture — so the furniture is skipped there while the scheme, which is the content's and not
// the harness's, is still applied. Without the split every "chromeless" PNG carried a dashed
// `Harness: dark` button fixed over its bottom-right corner, including the ones this branch
// captured and looked at.
if (new URLSearchParams(window.location.search).has('bare')) applyWantedScheme();
else drawSchemeToggle();

/**
 * The view, for a throwaway probe pasted into a console — does the scroll position survive
 * a redraw, does hovering force layout. Without this hook each of those means editing this
 * file. Nothing in the harness or the suite reads it: it exists so that the thing thrown
 * away afterwards is a paste rather than a commit.
 *
 * `null` on the index branch, which mounts a Vue app rather than an Obsidian view — there is
 * no `ItemView` to hand out.
 */
(window as unknown as Record<string, unknown>).__rp = { view };
