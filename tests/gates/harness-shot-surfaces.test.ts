import { describe, expect, it } from 'vitest';
import { callsOf, importsOf } from '../helpers/parsedSource';
import { constants, isIdCharacter, namesIn, planEditorQuery, query, script, shot } from '../helpers/harnessShotFixtures';

/**
 * The asset library, plan editor, project and index shots, each pinned on what makes it different
 * from a sibling. Split out of `harness-shot.test.ts` — which still holds the whole table in both
 * directions and the capture script's wiring — when that file reached its 450-line test budget;
 * both read the one parsed table in `tests/helpers/harnessShotFixtures.ts`.
 */
describe('the per-surface harness shots', () => {
	/**
	 * THE SEVEN ASSET LIBRARY SHOTS, each pinned on the ONE field that makes it different from a
	 * sibling — the convention `project-detail-narrow` and `asset-designer-narrow` already state,
	 * applied to a surface that arrived with seven shots and no pins at all.
	 *
	 * What each pin is FOR, because "pin the fields" is not an argument:
	 *
	 * - **`&asset=` on the selected shots.** Every one of them waits on
	 *   `.renovation-asset-library`, which the RESTING pane satisfies just as well — so a dropped
	 *   parameter photographs the shelves under a name promising the inspector, once per shot, and
	 *   exits 0. `tests/harness/assetLibraryPage.test.ts` closes that hazard for the jsdom mount
	 *   and could not close it for the shots.
	 * - **`width` on the ones that carry one.** 460 is §7's third rung and 700 its middle one;
	 *   without the field each becomes a byte-identical duplicate of a 1280 shot under a second
	 *   name. The middle rung has already shipped MISSING once with nothing to notice.
	 * - **`scrollTo` on `asset-library-actions`.** That shot exists because the Actions row sits
	 *   below the fold in the 280px rail; without the field it is a second copy of
	 *   `asset-library-selected`, and `Delete` — this surface's one destructive control — goes
	 *   back to being photographed by nothing.
	 * - **`theme=light` on the selected shots.** Chosen by MEASUREMENT rather than taste:
	 *   the one control here with a colour argument is `Delete`, whose border is `--text-error`,
	 *   and this script's own recorded pair for that variable puts it at 3.89:1 light against
	 *   4.27:1 dark. A scheme chosen by measurement and recorded only in prose is a scheme that
	 *   silently flips back — the sentence the index shots' own scheme case already makes.
	 *
	 * The asset those shots open on is `LIBRARY_SELECTED_ASSET`, named once in the script so
	 * another selected shot cannot introduce a second spelling: each query is checked against the
	 * constant's VALUE, and each is checked to have been spelled THROUGH it.
	 */
	it('pins what makes each asset library shot different from its siblings', () => {
		const asset = constants.get('LIBRARY_SELECTED_ASSET');

		expect(typeof asset).toBe('string');
		// Non-empty AND every character an id character: `every` over an empty string is true.
		expect(String(asset).length, 'LIBRARY_SELECTED_ASSET is empty').toBeGreaterThan(0);
		expect([...String(asset)].every((character) => isIdCharacter(character)), 'LIBRARY_SELECTED_ASSET is not an id').toBe(true);

		// The shots that open on a selection: the route AND the measured scheme — reported as the
		// names that fail each check, so a failure says which shot.
		const selected = ['asset-library-selected', 'asset-library-middle', 'asset-library-actions', 'asset-library-narrow-selected', 'asset-library-phone'];

		expect(selected.filter((name) => query(name).get('asset') !== asset)).toEqual([]);
		expect(selected.filter((name) => !namesIn(name, 'query').includes('LIBRARY_SELECTED_ASSET'))).toEqual([]);
		expect(selected.filter((name) => query(name).get('theme') !== 'light')).toEqual([]);

		// The widths of §7's ladder plus the phone's, and the two resting shots that hold the palette.
		expect(shot('asset-library-middle').width).toBe(700);
		expect([shot('asset-library-narrow').width, shot('asset-library-narrow-selected').width, shot('asset-library-phone').width]).toEqual([460, 460, 360]);
		expect(shot('asset-library-dark').query).toBe('?view=asset-library');
		expect(query('asset-library-light').get('theme')).toBe('light');

		// The one shot whose subject is below the fold.
		expect(shot('asset-library-actions').scrollTo).toBe('.rp-al-actions');

		// L-43's phone shot, also in `selected` and the widths above: the phone knob, the Actions
		// row, and a wait only the read-only library satisfies.
		expect([query('asset-library-phone').has('phone'), shot('asset-library-phone').scrollTo, shot('asset-library-phone').selector]).toEqual([true, '.rp-al-actions', '.renovation-asset-library [data-rp-notice="mobile-read-only"]']);
	});

	/**
	 * R14: `plan-editor-dark` and `plan-editor-light` used to wait on `PLAN_EDITOR_VIEW` alone,
	 * which attaches before asynchronous project hydration establishes the ready floor state —
	 * so both could complete while the intended contents were still loading. `plan-editor-narrow`
	 * waited on the same wrapper and could photograph a 460px shell with no proof the constrained
	 * layout's rail had actually appeared. All three now name a selector that only exists once
	 * the state each shot is FOR has landed; a mutation back to `PLAN_EDITOR_VIEW` fails here.
	 * The two resting shots are checked to spell it through `FLOOR_STATE`, the one constant, and
	 * that constant to be the floor inspector.
	 */
	it('waits for the hydrated floor state on the resting plan-editor shots, and for the rail as well on the narrow one', () => {
		expect(constants.get('FLOOR_STATE')).toBe('.rp-floor-inspector');
		for (const name of ['plan-editor-dark', 'plan-editor-light']) {
			expect(shot(name).selector).toBe('.rp-floor-inspector');
			expect(namesIn(name, 'selector')).toEqual(['FLOOR_STATE']);
		}
		expect(shot('plan-editor-narrow').selector).toEqual(['.rp-plan-canvas', '.rp-editor-shell[data-layout="constrained"] .rp-panel-rail']);
		expect(namesIn('plan-editor-narrow', 'selector')).toEqual(['PLAN_CANVAS']);
	});

	/**
	 * Detail-plan polish (2026-09-11): the five shots the `?detail` and `?locked=` knobs exist
	 * for, pinned the same way Task 21's and Task 14's own shots below are — a selector that
	 * cannot tell "mounted" from "the knob actually landed" would let a broken knob exit 0 with
	 * a picture of the resting editor under one of these five names. Each assertion checks BOTH
	 * halves: the query carries the knob (`&detail` or `&locked=`), and the selector is one that
	 * exists only once that knob's own state has landed — the guide explainer for the two wide
	 * detail shots, `DETAIL_ANCESTRY_CRUMB` for the narrow one (the Inspector carrying the guide
	 * explainer is hidden at 460px — see that constant's own comment), and a PRESSED lock toggle
	 * for the two locked shots (present, unpressed, on every row regardless of the knob —
	 * ADR-0027 — so only the pressed state proves the knob actually locked one).
	 */
	it('takes the detail-plan and locked-zone shots through their own knobs, waiting on what only a landed knob produces', () => {
		const lockPressed = '.rp-floor-inspector .rp-editor-inspector-lock[aria-pressed="true"]';

		expect(shot('plan-editor-detail')).toEqual({ query: '?view=plan-editor&detail&theme=light', selector: '.rp-floor-inspector__guide' });
		expect(shot('plan-editor-detail-dark')).toEqual({ query: '?view=plan-editor&detail', selector: '.rp-floor-inspector__guide' });
		expect(shot('plan-editor-detail-narrow-de')).toEqual({
			query: '?view=plan-editor&detail&theme=light&lang=de',
			selector: ['.rp-plan-canvas', '.rp-editor-shell[data-layout="constrained"] .rp-panel-rail', String(constants.get('DETAIL_ANCESTRY_CRUMB'))],
			width: 460,
		});
		expect(namesIn('plan-editor-detail-narrow-de', 'selector')).toEqual(['PLAN_CANVAS', 'DETAIL_ANCESTRY_CRUMB']);
		expect(shot('plan-editor-locked')).toEqual({ query: '?view=plan-editor&locked=harness-terrace,harness-garden&theme=light', selector: lockPressed });
		expect(shot('plan-editor-locked-dark')).toEqual({ query: '?view=plan-editor&locked=harness-terrace,harness-garden', selector: lockPressed });
	});

	/**
	 * Property-tree polish (2026-09-12): the four shots the `?tree` knob exists for, pinned the
	 * same way. The selector is a LEVEL-3 treeitem, which only the knob's four-plan hierarchy
	 * produces (the resting harness answers no hierarchy and draws the open plan alone), and the
	 * two 460px shots want it inside `.rp-overlay-panel` — the tree is hidden behind the rail's
	 * Layers button there, and only the knob's own press puts it on screen.
	 */
	it('takes the property-tree shots through the ?tree knob, waiting on a third level the knob alone produces', () => {
		const tree = '[role="tree"] [aria-level="3"]';

		expect(shot('plan-editor-tree-dark')).toEqual({ query: '?view=plan-editor&tree', selector: tree });
		expect(shot('plan-editor-tree-light')).toEqual({ query: '?view=plan-editor&tree&theme=light', selector: tree });
		expect(shot('plan-editor-tree-narrow')).toEqual({ query: '?view=plan-editor&tree', selector: `.rp-overlay-panel ${tree}`, width: 460 });
		expect(shot('plan-editor-tree-narrow-light')).toEqual({ query: '?view=plan-editor&tree&theme=light', selector: `.rp-overlay-panel ${tree}`, width: 460 });
	});

	/**
	 * BP-04's three outline shots (slice A2), pinned the way every knob-driven family above is
	 * rather than by the name census alone. Two properties neither the census nor a name can
	 * see. `outline=1` is what CHOOSES a corner — a bare `?outline` opens the dialog and
	 * highlights nothing, so losing the `=1` photographs an unchosen list under a name
	 * promising action 3's highlight. And `width` is the whole reason the third row exists: it
	 * is BP-04's own test case 12, "constrained-layout focus", and 460 is an Obsidian sidebar
	 * leaf's real width.
	 *
	 * **Measured rather than argued**: with `width` dropped, the narrow row is a byte-identical
	 * duplicate of the wide one under a second name, and the whole gate directory
	 * stayed green. That is the same silent wrong-picture outcome the detail-state
	 * case below names, and this family shipped with nothing holding it.
	 */
	it('takes the three outline shots through the ?outline knob, and the narrow one at a sidebar width', () => {
		for (const name of ['plan-editor-outline', 'plan-editor-outline-dark', 'plan-editor-outline-narrow']) {
			expect(planEditorQuery(name).get('outline')).toBe('1');
			expect(planEditorQuery(name).get('select')).toBe('harness-terrace');
			// A PRESSED row button, which only the choosing half of the knob produces — the
			// list itself is on screen the moment the dialog opens.
			expect(shot(name).selector).toBe('[data-rp-corner="choose"][aria-pressed="true"]');
		}
		expect(planEditorQuery('plan-editor-outline-dark').has('theme')).toBe(false);
		expect(shot('plan-editor-outline').width).toBeUndefined();
		expect(shot('plan-editor-outline-dark').width).toBeUndefined();
		expect(shot('plan-editor-outline-narrow').width).toBe(460);
	});

	/**
	 * R13: the one width the 460px capture cannot show, and the one shot that MEASURES rather
	 * than only draws — jsdom lays nothing out, so `measure` reads the real shell's scrollWidth
	 * against its clientWidth in a browser through the importable `overflowFinding`/`shellMetrics`
	 * pair, rather than a claim only a source-text pin could hold.
	 */
	it('measures the unsupported shell for horizontal overflow at 320 px, through the importable overflowFinding', () => {
		expect(shot('plan-editor-unsupported')).toMatchObject({
			width: 320,
			selector: '.rp-editor-shell[data-layout="unsupported"] .rp-unsupported-width',
			measure: '.rp-editor-shell',
		});
		expect(importsOf(script)).toContain('./captureMeasures.mjs');
	});

	/**
	 * Task 21's three Plan Editor shots, pinned the same way `project-detail-narrow` and
	 * `asset-designer-narrow` are: the property that makes each shot differ from
	 * `plan-editor-light` is not merely that its name exists, but that it is reached through
	 * the knob that actually produces the picture. Losing `&select=`/`&add` off either of the
	 * first two would silently photograph the resting editor under a new name and exit 0;
	 * losing `width: 460` off the third would silently photograph the same wide layout twice.
	 */
	it('takes the selected-zone and Add-menu shots through the knobs that reach them, and the narrow shot at a sidebar width', () => {
		expect(planEditorQuery('plan-editor-selected').get('select')).toBe('harness-kitchen');
		expect(shot('plan-editor-selected').selector).toBe('.rp-room-inspector');
		// R-S12-6's row, and all three of its properties are load-bearing. `width` is the whole
		// reason it exists — without it the row is a byte-identical duplicate of the wide one
		// under a second name, the defect session 11 had to pin the outline family's width
		// against. `details` is what puts the Inspector on SCREEN at that width; `select` alone
		// leaves the region attached and `display: none`. And the selector is scoped inside
		// `.rp-inspector-drawer` because a bare `.rp-room-inspector` is satisfied by that hidden
		// region and would exit 0 on a picture of the canvas.
		expect(planEditorQuery('plan-editor-selected-narrow').get('select')).toBe('harness-kitchen');
		expect(planEditorQuery('plan-editor-selected-narrow').has('details')).toBe(true);
		expect(shot('plan-editor-selected-narrow').width).toBe(460);
		expect(shot('plan-editor-selected-narrow').selector).toBe('.rp-inspector-drawer [data-rp-action="edit-outline"]');
		expect(planEditorQuery('plan-editor-add-menu').has('add')).toBe(true);
		expect(shot('plan-editor-add-menu').selector).toBe('.rp-add-menu');
		expect(shot('plan-editor-narrow').width).toBe(460);
		// The rail as well as the canvas (R14) — see 'waits for the hydrated floor state…' above
		// for why a bare `PLAN_EDITOR_VIEW` wait is exactly the defect being refused here.
		expect(shot('plan-editor-narrow').selector).toEqual(['.rp-plan-canvas', '.rp-editor-shell[data-layout="constrained"] .rp-panel-rail']);
	});

	it.each(['structural', 'drafting'])('takes the %s shots through their own knob, one of them at a sidebar width', knob => {
		for (const name of [`plan-editor-${knob}`, `plan-editor-${knob}-dark`, `plan-editor-${knob}-narrow`]) expect(planEditorQuery(name).has(knob)).toBe(true);
		expect(planEditorQuery(`plan-editor-${knob}-dark`).has('theme')).toBe(false);
		expect(shot(`plan-editor-${knob}-narrow`).width).toBe(460);
	});

	/**
	 * Task 14's two ROOM shots, pinned the same way the three above them are: what makes each
	 * one differ from `plan-editor-add-menu` is not that its name exists but that `?room=` is
	 * on the query — the knob that walks Add → Room → the two length fields. Lose that
	 * parameter and both shots photograph the resting editor under new names and exit 0.
	 *
	 * Their SELECTORS differ from each other and that is the pinned property rather than a
	 * detail: at full width the form is a column of the shell, so the wait is the settled
	 * sentence the numeric route writes — `:not(:empty)` because `.rp-new-room__settled` is in
	 * the DOM from the first render (a live region attributed on a container that APPEARS
	 * announces nothing) and holds text only once both sides are committed. At 460 px the same
	 * form lives in a drawer the knob closes behind itself, so nothing of it is on screen and
	 * the banner's Finish is what is left to wait on.
	 *
	 * **The narrow one is pinned WITH its attribute, and the bare class is what this refuses.**
	 * `.rp-task-banner__finish` alone attaches the moment the knob arms `draw-room` — three
	 * steps before it types a side or closes the drawer — so it certified the ARMING and not
	 * the landing: the same "mounted vs. the knob actually landed" hazard the sibling case
	 * above states, shipped inside the shot that states it. `[aria-disabled="false"]` is
	 * `RoomDraftStore.valid` read through the one surface a closed drawer leaves on screen, and
	 * dropping the attribute here is what puts the vacuous wait back.
	 *
	 * A SOURCE pin, so it holds only what `harness-shot.mjs` asks for. That the attribute really
	 * reads `"false"` once the draft is valid is
	 * `tests/presentation/editor/shell/temporaryToolBanner.test.ts`'s, against a real mount; that
	 * the knob reaches that state is `tests/harness/planEditor.ts`'s; and that the PICTURE is
	 * right is a capture read by eye, which nothing in this suite can do.
	 */
	it('takes the room task at both widths, through the ?room knob, waiting on what each width can show', () => {
		expect(planEditorQuery('plan-editor-add-room').get('room')).toBe('4200x3800');
		expect(shot('plan-editor-add-room').selector).toBe('.rp-new-room__settled:not(:empty)');
		expect(planEditorQuery('plan-editor-add-room-narrow').get('room')).toBe('4200x3800');
		expect(shot('plan-editor-add-room-narrow').selector).toBe('.rp-task-banner__finish[aria-disabled="false"]');
		expect(shot('plan-editor-add-room-narrow').width).toBe(460);
	});

	/**
	 * The detail state's two shots, and what makes them two rather than one: the NARROW one
	 * carries its own `width`, which is the only reason it photographs anything the wide one
	 * does not — 460 is an Obsidian sidebar leaf's real width, where the header's wrapping row
	 * and a plan name's ellipsis are decided. Lose the field and the run writes two PNGs of the
	 * same picture under two names and exits 0, which is the silent wrong-picture outcome every
	 * refusal in `resolveShots` exists to prevent.
	 *
	 * `?project=` is pinned beside it because that parameter is what reaches the detail state at
	 * all: without it `tests/harness/mount.ts` mounts the LIST, the selector still matches, and
	 * both shots would quietly photograph the surface the three above them already cover.
	 */
	it('takes the detail state at two widths, and reaches it through the parameter that opens it', () => {
		expect(query('project-detail').has('project')).toBe(true);
		expect(query('project-detail-narrow').has('project')).toBe(true);
		expect(shot('project-detail-narrow').width).toBe(460);
		// The narrow one is also the LIGHT one, which is what makes two shots cover both
		// palettes — measured, not preferred: the status label is the only element on this
		// surface with a colour of its own, and it measures 6.69:1 in light against 8.13:1 in
		// dark. Pinned for the same reason the index shots pin theirs: a scheme chosen by
		// measurement and recorded only in prose is a scheme that silently flips back.
		expect(query('project-detail-narrow').get('theme')).toBe('light');
		// `&plans=0` is the only thing that makes the START variant's shot different from the wide
		// one above it: both wait on `.renovation-planner-view`, which the 26-plan fixture
		// satisfies just as well, so a dropped parameter photographs the active layout under a
		// name promising the new-project one and exits 0.
		expect(query('project-detail-new').has('project')).toBe(true);
		expect(query('project-detail-new').get('plans')).toBe('0');
	});

	/**
	 * **P03's three, and `&recovery` is the whole of what makes any of them different.** All three
	 * wait on `.renovation-planner-view`, which the ordinary detail state satisfies just as well,
	 * so a dropped parameter photographs the surface `project-detail` already covers — three more
	 * times, under names promising the recovery screen, at exit 0.
	 *
	 * `&plans=2` is pinned with it: the picture is the warning strip and the recovery heading
	 * ABOVE the remaining plans, and the fixture's default 26 rows push both out of the frame the
	 * way they push the price section out of `project-detail`'s.
	 *
	 * The scheme split is pinned because the strip is the one region on this surface with a colour
	 * of its own — `--text-warning` plus a `color-mix` tint of the pane's own background, which
	 * the two palettes resolve differently — so neither picture predicts the other; and the width
	 * on the third, which is a sidebar leaf's real width and where the strip's icon-and-text row
	 * either wraps or does not.
	 */
	it('takes the recovery screen through the parameter that reaches it, in both schemes and at a leaf width', () => {
		const three = ['project-detail-recovery', 'project-detail-recovery-light', 'project-detail-recovery-narrow'];
		const reaching = three.filter((name) => query(name).has('project') && query(name).get('plans') === '2' && query(name).has('recovery'));

		expect(reaching).toEqual(three);
		expect(query('project-detail-recovery').get('theme')).toBeNull();
		expect(query('project-detail-recovery-light').get('theme')).toBe('light');
		expect(shot('project-detail-recovery-narrow').width).toBe(460);
	});

	/**
	 * L-40's two, and `&section=schedule` is what makes them different from the detail state's
	 * pair: without it `page.ts` opens `details`, which draws its own diagnostics button under the
	 * same `&plans-unreadable=`. So the selector is pinned with it — scoped to `.rp-project-work`,
	 * the schedule section's own class, since `.rp-project-detail` is on both surfaces.
	 */
	it('takes the schedule section through the parameter that opens it, waiting on its own button', () => {
		const two = ['project-schedule-unreadable', 'project-schedule-unreadable-narrow'];
		const reaching = two.filter((name) => query(name).get('section') === 'schedule' && query(name).get('plans-unreadable') === '2');

		expect(reaching).toEqual(two);
		for (const name of two) expect(shot(name).selector).toBe('.rp-project-work [data-rp-action="open-diagnostics"]');
		expect(shot('project-schedule-unreadable-narrow').width).toBe(460);
	});

	/**
	 * The index shots are the ones that photograph the HARNESS rather than the plugin, and they
	 * are the reason this command can be pointed at its own chrome. Asserted separately from the
	 * list above because the property that matters is not that the names exist but that they ask
	 * for the picker: `?index` is what `tests/harness/page.ts` routes to `IndexPage`, and a shot
	 * that lost the parameter would silently photograph the project surface again and still pass
	 * the name check.
	 */
	it('points the index shots at the route that draws the picker', () => {
		expect(shot('index-dark').query).toBe('?index');
		expect(shot('index-light').query).toBe('?index&theme=light');
	});

	/**
	 * A STATE nothing navigates to is a state no picture holds, which is what the first version
	 * of the index shots got wrong: they took the resting picker twice and named four defects as
	 * the reason, while `?index` renders neither a focus ring (nothing has been tabbed to) nor a
	 * failure card (nothing has failed). Deleting either rule left both PNGs identical.
	 *
	 * So the two states each need their own SETUP, and this pins that the setup is still there:
	 * a `focus` selector on one shot, and a query naming an id no entry can have on the other.
	 * Parsed assertions because `SHOTS` runs at module scope behind a browser — the same bargain
	 * every case in this block makes — and the behaviour under them is `focusForShot`'s, which the
	 * case "reaches the focus target with the keyboard rather than programmatically" asserts.
	 */
	it('gives the focus ring and the failure card a shot that actually renders them', () => {
		expect(shot('index-focus').focus).toBeDefined();
		expect(query('index-failure').get('entry')).toBe('no-such-entry');
	});

	/**
	 * EACH STATE IS PHOTOGRAPHED IN THE SCHEME ITS OWN CONTRAST IS WORST IN, which is the whole
	 * reason the run is four index shots and not eight. So the scheme is part of what these shots
	 * ARE, and it was a comment rather than a check until it was wrong: `index-focus` was taken in
	 * dark, on the plausible-sounding reasoning that a dark background is harder to separate a
	 * colour from. The ring is `--interactive-accent` on the nav's `--background-secondary`, which
	 * measures 3.46:1 in dark and 3.17:1 in light — so a light-only regression toward 1.4.11's 3:1
	 * floor was in the one state no capture held, and the numbers contradicting the comment were
	 * already recorded in `styles/editor.css`.
	 *
	 * A parsed assertion, like its siblings above, and it pins the SCHEME only. That a given
	 * scheme is the weaker one is a browser measurement no gate here can make — jsdom resolves no
	 * `var()` to a colour — so what this can hold is that the choice was made deliberately and has
	 * not silently flipped back.
	 */
	it('takes each index state in the scheme its own contrast is weakest in', () => {
		expect(query('index-focus').get('theme')).toBe('light');
		expect(query('index-failure').get('theme')).toBe('light');
	});

	/**
	 * `page.focus()` would leave the element focused and the ring UNDRAWN — `:focus-visible` is a
	 * keyboard heuristic, so a programmatic focus produces a screenshot identical to the resting
	 * one. That is the failure mode this whole addition exists to avoid, and it is invisible in
	 * the PNG, so it is pinned here instead. Asked of the CALLS, so `focusForShot`'s own comment
	 * may name `page.focus(` to say why it is refused — the raw-text version of this assertion
	 * failed on the sentence explaining the rule it was checking.
	 */
	it('reaches the focus target with the keyboard rather than programmatically', () => {
		expect(callsOf(script.file, script, 'page.keyboard.press').map((call) => call.args)).toContainEqual(["'Tab'"]);
		expect(callsOf(script.file, script, 'page.focus')).toEqual([]);
	});
});
