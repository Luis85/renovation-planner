/**
 * Mount the REAL view outside Obsidian, for looking at rather than for asserting on.
 *
 * Everything here is shared with the test suite — the `obsidian` module mock, the fake
 * workspace, the construction order a view needs. The only thing this module adds is a
 * mount that does not depend on vitest, so the same view can be served to a browser
 * (`npm run harness`). It draws; it checks nothing. jsdom remains the substitute for
 * Obsidian in tests, and a real vault remains the only place appearance is verified.
 *
 * `makeView()` is called with no `deps` argument ON THE BARE PATH, which is what keeps this
 * file compiling unchanged now that design slice 14 gave the constructor a second parameter.
 * What that default IS moved in design slice 16, and both halves of the sentence that used to
 * sit here moved with it.
 *
 * `?project=<id>` (design slice 21) is the one path that does pass one, and it passes the same
 * default with two changes: a seeded project under the id the URL named, and that id as
 * `projectId`, which is what makes this the DETAIL state rather than the list. It exists
 * because the harness index cannot photograph that state at all — `IndexPage.vue` mounts a
 * component bare, and `ProjectDetail` requires three props and reads `project.name`
 * immediately, so the picture would be the index's own failure card. The two rules most worth
 * looking at are properties of the component's PLACE in `.renovation-planner-view`
 * (`.rp-project-detail`'s `flex: 1`, `.rp-plan-list`'s scroll), which a bare mount has no pane
 * for.
 *
 * It is no longer a fixed `ok({ projects: [], unreadable: 0 })`: `makeRenovationProjectView.ts`
 * builds a real `InMemoryProjectRepository` with a `ListProjects` reading it and a
 * `CreateProjectCommand` writing it — see that file's own docblock for why a refusing stand-in
 * would have been the wrong fake here. The repository starts EMPTY, so the page still opens on
 * the "no renovation projects yet" empty state; the difference is that its button now works.
 *
 * And the populated surface is no longer "nothing else to draw until a later slice": slice 16
 * built `ProjectList.vue`, so creating a project through that button replaces the empty state
 * with a real list of rows, in the same session, with no reload. That is the whole reason to
 * open this page rather than read the empty state's markup — and the reason the list's own
 * header layout, its focus ring and its long-name truncation were all found by photographing
 * this surface rather than by any gate.
 */
import type { RenovationProjectView } from '../../src/presentation/views/RenovationProjectView';
import { Plan } from '../../src/domain/plan/Plan';
import { Project } from '../../src/domain/project/Project';
import type { PlanId } from '../../src/domain/plan/PlanId';
import type { ProjectId } from '../../src/domain/project/ProjectId';
import { installObsidianDom } from '../helpers/dom';
import { defaultRenovationProjectDeps, makeView, type SeedRepositories } from '../helpers/makeRenovationProjectView';
import type { RenovationProjectDeps } from '../../src/presentation/views/RenovationProjectContext';
import { expectOk } from '../helpers/domain';

/**
 * The plans one seeded project holds, and the COUNT is the part that was measured rather than
 * picked.
 *
 * The rule most worth looking at here is that `.rp-plan-list` scrolls under a pinned `Plans`
 * header (`styles/project-detail.css`), and a list that FITS its pane cannot show it: the
 * first version of this fixture held twelve, and at an 800px leaf the `ul`'s scroll height
 * equalled its client height exactly — 360 against 360 — so deleting the whole `flex: 1;
 * min-height: 0; overflow-y: auto` block changed nothing a capture could see. Twenty-six is
 * past the ~22 that fit, so the list genuinely overflows and the rule has something to do.
 *
 * The long one is the ellipsis case `.rp-plan-list__name` states, and it is the row a 460px
 * capture — an Obsidian sidebar leaf's real width — actually exercises.
 */
const HARNESS_PLAN_NAMES = [
	'Ground floor',
	'First floor',
	'Second floor',
	'Loft conversion',
	'Basement tanking',
	'Rear extension',
	'Side return',
	'Garage conversion',
	'Garden studio',
	'Roof and gutters',
	'Bathroom, first floor',
	'Bathroom, ground floor',
	'Utility and boot room',
	'Kitchen, phase one',
	'Kitchen, phase two',
	'Hallway and stairs',
	'Front elevation',
	'Rear elevation',
	'Drainage and soakaway',
	'Driveway and parking',
	'Boundary wall',
	'Bin and bike store',
	'Electrical first fix',
	'Electrical second fix',
	'Heating and hot water',
	'South elevation, render and window replacement, phase two',
];

/**
 * A seed step's `Result`, unwrapped loudly — and "loudly" means an UNHANDLED REJECTION, which
 * is worth stating precisely because the first two sentences written here claimed otherwise.
 *
 * They said this "reads the settled value rather than awaiting" and the call site said the
 * error was "THROWN rather than `void`ed". Both are false of a `void promise.then(…)`: the
 * promise IS `void`ed, and a `.then` callback is a microtask, so the throw happens after
 * `mountHarness` has returned and mounted. There is no synchronous stop to be had here — a
 * promise cannot be read synchronously however fast it settles, and a real `await` would make
 * `mountHarness` async for every caller.
 *
 * What actually carries the loudness is the CAPTURE tool rather than this function:
 * `scripts/harness-shot.mjs` registers `page.on('pageerror')` and records console errors, and
 * Chromium reports an unhandled rejection through both, so a failed seed fails the capture
 * rather than photographing the list. Under `npm run harness` it is a console line beneath a
 * page that quietly draws the list — the residue, named rather than implied, because the
 * sentence that used to sit here read as a guarantee this module gave on its own.
 *
 * Found by the whole-branch review.
 */
const expectSeeded = (saved: Promise<{ ok: boolean }>): void => {
	void saved.then((result) => {
		if (!result.ok) throw new Error('the harness fixture failed to seed; the capture would photograph the list');

		return result;
	});
};

/**
 * One project under the id a URL named, with a plan each from the list above.
 *
 * The id is CAST rather than minted: `createProjectId()` answers a fresh ULID, and a URL
 * cannot name one of those. That is exactly what `EntityId`'s brand exists to stop, and the
 * exception is bounded to this file — a harness fixture is the one place an id is a thing a
 * person types. `buildProjectIndexEntries` asserts a note's raw frontmatter into the same
 * brand after checking only that it is non-empty, so this is not even the loosest instance in
 * the tree; CLAUDE.md records that one.
 *
 * `expectOk` on both constructors: a fixture that silently drew nothing because a name failed
 * validation is a picture of the loading state with no error anywhere, which is the quiet this
 * whole capture tool exists against.
 */
const seedProject = (projectId: string) => ({ projects, plans }: SeedRepositories): void => {
	const id = projectId as ProjectId;
	const project = expectOk(
		Project.create({ id, name: 'Maple Street, ground floor refit', status: 'EXECUTION' }),
	);

	// Checked rather than discarded, and the reason is what this fixture is for: a failed save
	// leaves an empty world, both captures then photograph the LIST, and they wait on
	// `.renovation-planner-view`, which the list satisfies — so `npm run harness-shot` would
	// write two PNGs of the wrong state and exit 0. `expectSeeded`'s docblock says by what
	// mechanism that is made loud, and it is not this file's.
	expectSeeded(projects.save(project, 'absent'));

	HARNESS_PLAN_NAMES.forEach((name, index) => {
		const plan = expectOk(Plan.create({ id: `plan-${index + 1}` as PlanId, projectId: id, name }));

		expectSeeded(plans.save(plan, 'absent'));
	});
};

/**
 * The seeded default, plus the one member this page can honestly answer that the shared
 * default cannot: `navigate`.
 *
 * `defaultRenovationProjectDeps` leaves it inert because it has no workspace to navigate in,
 * and it says so. This page HAS the view, so Back and a project row both do here what they do
 * in a vault — a `setState` round trip through the view's own state machine, which is the
 * mechanism rather than an imitation of it. A harness whose only way out of the detail state
 * is the URL bar is a tool for looking at one screen, and the pair is what a person actually
 * wants to check.
 *
 * The view is reached through a THUNK because it does not exist yet: `makeView` takes these
 * deps as its argument. Called only from a click, long after the constructor has returned.
 */
const harnessDetailDeps = (projectId: string, view: () => RenovationProjectView): RenovationProjectDeps => ({
	...defaultRenovationProjectDeps(seedProject(projectId)),
	// `''` is the LIST, which is the sentinel `RenovationProjectView.getState` writes and
	// `projectIdFrom` parses back — not a value this page invents.
	navigate: (id) => {
		void view().setState({ projectId: id ?? '' }, { history: true });
	},
});

export interface MountedHarness {
	/** The workspace leaf the app would give the view. */
	leafEl: HTMLElement;
	/** The view itself, for a probe pasted into a console. */
	view: RenovationProjectView;
}

export function mountHarness(root: HTMLElement, projectId?: string | null): MountedHarness {
	// Obsidian's DOM prototype extensions (`createEl`, `createDiv`, `empty`, `setText`,
	// `addClass`). The view calls them and a browser has none of them, so this is what
	// makes the same code run on a plain page. Installed first, because everything below
	// uses it.
	installObsidianDom();
	root.empty();

	// Real nesting on purpose. `containerEl` is what the app hands a view and `contentEl` is
	// the pane inside it, so a view that empties the wrong one is as visible here as in the
	// suite — and the leaf frame, together with the rules `tests/harness/theme.css` keys off
	// it, is what supplies the height Obsidian's own pane would.
	const leafEl = root.createDiv('rp-harness-leaf');
	// NO ARGUMENT on the bare path, deliberately: the docblock in
	// `makeRenovationProjectView.ts` says why the untouched default is what the harness root
	// takes, and the empty state is what that root exists to show. `?project=` is the opt-in.
	// ANNOTATED, and the annotation is load-bearing rather than style: `harnessDetailDeps`
	// closes over `view` to reach `setState`, so the initializer references the very binding it
	// initialises and inference goes circular (`TS7022`/`TS7024`, which `npm run
	// typecheck:tests` reports for this file since it is not on the baseline). The closure is
	// only ever CALLED from a click, long after this line has returned.
	const view: RenovationProjectView =
		projectId === undefined || projectId === null
			? makeView()
			: makeView(harnessDetailDeps(projectId, () => view));
	leafEl.appendChild(view.containerEl);
	// The view's own first draw. `void` rather than awaited: this function is called from a
	// page entry that cannot await, and `onOpen` does its work synchronously before the
	// promise it returns.
	void view.onOpen();
	// The DETAIL state is reached the way Obsidian reaches it — through `setState`, after
	// `onOpen`, which is one of the two orderings the view is built to survive. NOT by passing
	// `projectId` in `deps`: `RenovationProjectView.mount` writes its own field over that
	// member on every mount, so a bundle naming a project would be silently ignored and this
	// page would draw the list while claiming to draw a project.
	if (projectId !== undefined && projectId !== null) void view.setState({ projectId }, { history: false });

	return { leafEl, view };
}
