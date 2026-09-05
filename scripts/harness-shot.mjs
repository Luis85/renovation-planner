import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { overflowFinding, shellMetrics } from './captureMeasures.mjs';
import {
	describeFailure,
	entryHasDrawn,
	readFailureKind,
	reportIfNoLongerDrawn,
	UNKNOWN_ENTRY,
	waitUntilReady,
} from './captureReadiness.mjs';
import { resolveChromiumExecutable } from './chromium.mjs';
import { resolveShots } from './entryShots.mjs';

/**
 * Headless capture of the browser harness — either the fixed surfaces (the project view's list
 * state in its dark scheme, light scheme and `?phone`; its detail state wide, at a sidebar's
 * width and scrolled to its price section at both; the Plan Editor's dark and light schemes, a
 * zone selected, the Add menu open, the shell at a sidebar's width and the below-supported shell
 * at 320px; the asset designer's dark and light schemes plus its own sidebar width (Task B10);
 * the asset library at three of §7's widths, resting and with an asset selected (Task 17); and
 * the harness index at rest in both schemes, focused, focused on the current row, and showing
 * its failure card) — or, given an entry id, one named prototype or component in both schemes —
 * for a look nobody has to open a browser for.
 *
 * **The header used to open with a COUNT, and it said fifteen over seventeen shots** — the two
 * `project-detail-prices` captures landed without it, and the test below carried the same
 * fifteen in its own name and in a list that omitted the same two. Neither is a number now:
 * a total in prose is a fact about the array at the moment somebody last read it, and this one
 * had been wrong for an increment with nothing able to notice. The list above is deliberately
 * unnumbered for the same reason, and it grew again at this merge. This is how a real layout defect was found earlier in this plan (the view
 * collapsing to 39px of a 700px pane): nothing in the suite could see it because jsdom draws
 * nothing, and a screenshot is the only artifact that shows it. The asset designer's sidebar-
 * width shot is the same shape found a second time, in this same task: an AD-HOC capture at
 * this width, taken once and never watched again, is what found the toolbar overflow this
 * script's own SHOTS array now watches permanently.
 *
 * What this is NOT: a test. It draws; it asserts no appearance, and there is no baseline
 * to diff against — the same reason `npm run harness` itself is outside `npm run check`.
 * It is deliberately absent from `npm run check` and from CI for that reason. It exits
 * non-zero on a page error or an uncaught console error, which is a narrower claim than
 * "the page looks right" — only that it did not fall over while being looked at.
 *
 * `playwright-core` and not `playwright`: the latter downloads browsers on `npm install`,
 * which this project's install must not do on a machine with no browser. So the browser has
 * to already be on disk, and finding it is `resolveChromiumExecutable` in `chromium.mjs` —
 * which asks playwright-core where it is rather than working it out, for reasons that
 * comment gives at length. It sits in its own file because `concept-shots.mjs` needs the
 * same answer, and two copies of it is the shape of the defect its history describes.
 */

const OUT_DIR = 'harness-shots';
const VIEWPORT = { width: 1280, height: 800 };
// Each surface's own mount point, which is what "the view has drawn" means here — not
// merely that the page loaded. Per shot rather than one constant, because each surface
// draws different elements and a shot that waited for the WRONG one would time
// out on a page that had rendered perfectly.
const PROJECT_VIEW = '.renovation-planner-view';
const ASSET_DESIGNER_VIEW = '.renovation-asset-designer-view';
// The harness's own picker. Present from the first paint and with nothing async under it — the
// index at `?index` opens no entry — so unlike the surfaces above there is no "has it really
// drawn" question to answer here beyond the element existing.
const HARNESS_INDEX = '.rp-harness-index';
// The Plan Editor's own HYDRATED resting state (R14, closing "Three plan-editor captures can
// complete before their intended state appears"): drawn only once project hydration has
// resolved and nothing is selected. The Plan Editor's bare view wrapper attaches before that
// hydration lands, so waiting on it alone could complete with the intended contents still
// loading — this is what proves the dark/light shots show the floor rather than a loading
// frame. There is deliberately no `PLAN_EDITOR_VIEW` constant any more: every Plan Editor shot
// now waits on a selector that proves its OWN state, and a wrapper-only wait is exactly the
// defect this rule exists to refuse — see the SHOTS entries below for what each one waits on.
const FLOOR_STATE = '.rp-floor-inspector';
// The Konva stage's own mount point, named here because the narrow shot waits on it ALONGSIDE
// the constrained-layout rail rather than on the wrapper both surround — the canvas alone
// attaches before the reflow that produces the rail has actually happened.
const PLAN_CANVAS = '.rp-plan-canvas';

const ASSET_LIBRARY_VIEW = '.renovation-asset-library';

/**
 * The asset the four selected shots open on — `tests/harness/assetLibrary.ts`'s one DESIGNED
 * seed, so §3.5's Shape section draws a footprint, a clearance and a spec sheet rather than
 * three "nothing yet" lines. Named once here because four shots share it and a fifth would
 * otherwise be a fifth place to keep in step.
 */
const LIBRARY_SELECTED_ASSET = 'base-cabinet-600';

/**
 * The viewport for one shot: `VIEWPORT`, with `width` overriding its one field when a shot
 * carries one.
 *
 * Height is deliberately NOT a second knob. What a narrow capture answers is how the layout
 * WRAPS, and the page scrolls, so a shorter viewport would only crop the answer.
 *
 * A named function rather than a ternary inside `captureOne`, and that is a gate talking rather
 * than taste: `captureOne` runs at module scope behind a browser, so no test covers it, and one
 * more branch took its CRAP score to exactly the threshold `npm run analyze` fails at. Lifting
 * the decision out is the honest fix — the branch is about viewport policy and not about
 * capturing, and out here it can be read on its own.
 */
const viewportFor = (width) => (width === undefined ? VIEWPORT : { ...VIEWPORT, width });

/** How many Tab presses to spend looking for `focus`, before giving up and saying so. */
const FOCUS_TAB_LIMIT = 12;

/**
 * Put the keyboard on the element a shot names, so a `:focus-visible` ring is IN THE PICTURE.
 *
 * `page.keyboard.press('Tab')` and not `page.focus()`, which is the whole difficulty and the
 * reason this exists rather than being one line at the call site. `:focus-visible` is a
 * heuristic, not a state: Chromium matches it after a KEYBOARD interaction and withholds it for
 * programmatic focus on a link, so `page.focus()` would leave the element focused, the ring
 * undrawn, and the screenshot indistinguishable from the resting one — a capture that looks like
 * it covers the state while covering nothing, which is worse than not taking it.
 *
 * Tabbing until the selector matches rather than a fixed count, because a fixed count encodes
 * today's DOM order and breaks silently the day an element is added above the target. THROWS on
 * running out: `captureOne`'s catch turns that into a named error and a non-zero exit, so a
 * target that stopped being reachable by keyboard — which is itself the defect this shot exists
 * to watch — is reported rather than photographed as a blank.
 *
 * A no-op for a shot that carries no `focus`, which is MOST of them. This sentence said "every
 * shot but one" over two — a count written when there was one and not re-read when the second
 * arrived, which is the class this file's own header count was corrected for in the same commit
 * that found this. No number here and NO CENSUS COMMAND either, deliberately twice over: what a
 * reader needs is that the field is OPTIONAL, and a grep quoted inside the very file it counts
 * matches its own quoting line — measured, `grep -c "focus: "` went from 2 to 3 the moment this
 * paragraph named it. `tests/build/harness-shot.test.ts` is what actually holds the field on the
 * shots that carry it; a sentence here cannot.
 *
 * Out here rather than as a branch inside `captureOne` for the reason `viewportFor` gives above:
 * that function runs behind a browser where no test reaches it, and one more branch took its CRAP
 * score to exactly the threshold `npm run analyze` fails at.
 */
/**
 * Bring the region a shot is ABOUT into the picture, when it lives below a scrolling body.
 *
 * The project detail state's price section is such a region: it sits under 26 plan rows inside
 * `.rp-project-detail__body`, which is the pane's one scroller, so a resting capture of that
 * surface photographs plans and nothing else. That was measured rather than predicted — the
 * first capture taken after the section landed showed 26 plan rows and no prices at all.
 *
 * `scrollIntoView` rather than a Tab walk, which is what `focusForShot` above does and is the
 * wrong instrument here: reaching the first price input by keyboard costs one press per plan
 * row, so a fixture that grew by a plan would silently start photographing the wrong thing at
 * `FOCUS_TAB_LIMIT`. It is also a different QUESTION — that function is for a `:focus-visible`
 * ring, and this shot is about layout at rest.
 *
 * A no-op for a shot that carries no `scrollTo`, which is MOST of them. This sentence said
 * "every shot but one" and was already wrong over two when Task 17 added the third
 * (`asset-library-actions`) — the same stale-count class as the `focus` docblock above and as
 * this file's own header, all three corrected together rather than one at a time. No number, for
 * the reason stated there.
 *
 * Out here rather than as a branch inside `captureOne` for the reason `viewportFor` gives: that
 * function runs behind a browser and no test covers it.
 */
async function scrollForShot(page, scrollTo) {
	if (scrollTo === undefined) return;
	const found = await page.evaluate((sel) => {
		const el = document.querySelector(sel);
		if (el === null) return false;
		el.scrollIntoView({ block: 'start' });
		return true;
	}, scrollTo);
	if (!found) throw new Error(`nothing matching ${scrollTo} was on the page to scroll to`);
}

async function focusForShot(page, focus) {
	if (focus === undefined) return;

	for (let press = 0; press < FOCUS_TAB_LIMIT; press += 1) {
		await page.keyboard.press('Tab');
		if (await page.evaluate((sel) => document.activeElement?.matches(sel) ?? false, focus)) return;
	}

	throw new Error(`nothing matching ${focus} took focus within ${FOCUS_TAB_LIMIT} tab presses`);
}

/**
 * The unsupported shell's own horizontal-overflow question (R13), pushed onto the shared
 * errors list rather than thrown: a sideways scroll is reported the same way a page error is,
 * so `captureAll` keeps taking the rest of the run's shots instead of stopping at the first one
 * that scrolls.
 *
 * `shellMetrics` reads in the page, `overflowFinding` judges in Node — see
 * `scripts/captureMeasures.mjs` for why the split, and why the page-side half is
 * self-contained.
 *
 * A no-op for a shot with no `measure`, which is every shot but one today, and out here rather
 * than as a branch inside `captureOne` for the reason `viewportFor` and `focusForShot` above
 * already give: that function runs behind a browser where no test reaches it, and one more
 * branch there is what pushes its CRAP score over the threshold `npm run analyze` fails at.
 */
async function measureForShot(page, name, measure, errors) {
	if (measure === undefined) return;

	const finding = overflowFinding(name, await page.evaluate(shellMetrics, measure));
	if (finding !== null) errors.push(finding);
}

const SHOTS = [
	{ name: 'dark', query: '', selector: PROJECT_VIEW },
	{ name: 'light', query: '?theme=light', selector: PROJECT_VIEW },
	{ name: 'phone', query: '?phone', selector: PROJECT_VIEW },
	// THE HOME SURFACE, POPULATED (Task 12). The three shots above photograph the EMPTY state —
	// the bare harness root's world is empty by construction — so until this knob existed, the
	// launcher's rows, its filter line, its `Completed` group, its Continue row and its foot line
	// had never been rendered by anything at all. jsdom lays nothing out, so spacing, wrapping,
	// overflow, hit size and the lifecycle strip's legibility are measurements no gate here
	// performs and a capture is the only instrument.
	//
	// `?projects=30` is §9's stress case: past what fits a pane, so the ordering and the scroll
	// have something to do, and wide enough a spread of statuses that the strip shows real stages
	// side by side rather than ten copies of one. `tests/harness/mount.ts` carries what the
	// fixture holds and why each field is in it.
	//
	// TWO WIDE SHOTS, one per scheme, where `project-detail-narrow` deliberately takes only one:
	// that trade rests on nothing about the surface changing with the palette, and it does not
	// survive here. The lifecycle tick strip is `--text-normal` against `--text-faint` and it is
	// DROPPED at narrow, so it exists ONLY in a wide shot — and whether a reached cell can be
	// told from an unreached one is exactly a contrast question. A single default-scheme wide
	// shot would never photograph the strip in light at all.
	{ name: 'home-stress', query: '?projects=30', selector: PROJECT_VIEW },
	{ name: 'home-stress-light', query: '?projects=30&theme=light', selector: PROJECT_VIEW },
	// THE WIDE ROW IN GERMAN, which is the INPUT to `project-list.css`'s container-query
	// threshold and was in no fixed shot until a review round asked how anyone would re-derive
	// that number. The measurement is the widest trailing group at 1280 — 270px in German
	// (`Bestandsdokumentation`) against 199px in English — and every other Home shot is either
	// English or narrow, where the strip is dropped and the group is a different width. So the
	// one state the threshold is computed from was reachable only by an ad-hoc URL.
	//
	// This script's own header records why that is not good enough: an ad-hoc capture "taken
	// once and never watched again" is exactly what the asset designer's sidebar shot exists to
	// replace. A status label retranslated longer moves this threshold and nothing else here
	// would show it.
	{ name: 'home-stress-de', query: '?projects=30&theme=light&lang=de', selector: PROJECT_VIEW },
	// THE WHOLE SURFACE IN ONE FRAME, and this is the fifth Home shot rather than the four the
	// plan named — added because reading the first four against §5's regions showed that TWO of
	// them were in no picture at all. Thirty rows are taller than an 800px viewport, so the
	// `Completed` disclosure and the foot line (region 7 — the key legend and `New asset`) sit
	// below the fold in every one of the shots above, and the no-match shot has no `Completed`
	// group to show. A region no capture contains is a region nobody looks at, which is the
	// whole failure this script exists against.
	//
	// TEN is the count that fits: `HOME_PROJECTS`' first ten walk the lifecycle exactly once
	// each, so both terminal stages are present and the disclosure draws, and the foot lands at
	// y≈465 of 800 — measured. LIGHT because what this shot is FOR is two regions made entirely
	// of muted and faint text, which is a contrast question, and light is the scheme that
	// breaches first.
	{ name: 'home-whole', query: '?projects=10&theme=light', selector: PROJECT_VIEW },
	// 460 is an Obsidian sidebar leaf's real width and the one this surface's whole narrow
	// composition is a container query on: the row wraps to two lines, the strip goes, and the
	// status and the facts share the second line. LIGHT and single-scheme, which is
	// `project-detail-narrow`'s own trade taken for its own reason — what this shot is FOR is
	// wrapping and the two-line row, none of which moves with the palette, and light is the
	// scheme a contrast regression breaches first.
	//
	// **IN GERMAN, and that is the whole point of the shot rather than a flourish.** The width at
	// which a one-line row stops holding name, facts and status is decided by the longest status
	// word, and `Bestandsaufnahme` is 16 characters against `Survey`'s 6 — so a threshold
	// measured in English is measured against the easy case. `styles/project-list.css`'s
	// container query cites this capture for its number.
	{ name: 'home-stress-narrow', query: '?projects=30&theme=light&lang=de', selector: PROJECT_VIEW, width: 460 },
	// FILTERED TO NOTHING, at 460 — §3's signature interaction, and the state a capture could not
	// reach at all until `?q=` existed: `harness-shot` navigates and screenshots and types
	// nothing, so without a URL-seeded query both narrow shots would sit at an empty query
	// forever and the create action would never be on screen to be looked at.
	//
	// The query is ONE UNBROKEN TOKEN, and "unbroken" means NO HYPHENS — which the first version
	// of this shot got wrong, in exactly the way the plan warned it could be got wrong. It
	// seeded `Dachgeschossausbau-Wintergarten-Sanierungsplanung`, and a hyphen-minus is a
	// UAX #14 break opportunity: ordinary wrapping has two of them, so the line broke after
	// `Wintergarten-` where normal line breaking puts it anyway. MEASURED rather than reasoned —
	// deleting `overflow-wrap: anywhere` from `project-list.css` and re-running this shot
	// produced a BYTE-IDENTICAL PNG (same md5), so the capture certified a declaration it never
	// exercised while reading as though it had.
	//
	// `project-list.css` states the precondition in its own words: "normal wrapping breaks at
	// OPPORTUNITIES, and one long unspaced token has none". A query with a break opportunity in
	// it photographs the easy case. This one has none, so the only thing that can break it is
	// the declaration under test.
	{
		name: 'home-no-match-narrow',
		query: '?projects=30&theme=light&q=Dachgeschossausbauwintergartensanierungsplanungsbesprechung',
		selector: PROJECT_VIEW,
		width: 460,
	},
	// THE FILTER FIELD WITH THE CARET IN IT, and this shot exists because nothing else here can
	// see the one thing it photographs. Task D made the filter a bordered WRAPPER around a
	// chrome-less input, which moves the focus ring from the input to `:focus-within` on that
	// wrapper — and the ring is the half of that change with no other instrument: jsdom resolves
	// no CSS, so `projectFilterStyles.test.ts` can assert the sheet DECLARES the rule and can
	// never see whether the ring is drawn, is drawn twice, or is clipped by the border it sits
	// outside of. This repository has already shipped exactly that defect once, on the harness
	// index's own entry links, and the remedy it built then was a `focus`-selector shot.
	//
	// LIGHT, because that is the scheme `--interactive-accent` measures worst against (3.43:1
	// there and 4.00:1 dark, both over WCAG 1.4.11's 3:1 floor for a non-text indicator), so a
	// regression breaches here first — the same trade `index-focus` takes for the same reason.
	//
	// A RESTING shot cannot substitute: nothing is focused in a headless page until something
	// presses Tab, which is what `focusForShot` does and why it does it that way — setting focus
	// programmatically does not satisfy `:focus-visible`, and while THIS ring hangs off
	// `:focus-within` rather than `:focus-visible`, the input's own suppressed host ring is
	// `:focus-visible` and is half of what this picture is for.
	{ name: 'home-filter-focus', query: '?projects=10&theme=light', selector: PROJECT_VIEW, focus: '.rp-project-filter__input' },
	// The project view's DETAIL state (design slice 21), which the harness index cannot
	// photograph: it mounts a component bare, and `ProjectDetail` requires three props and
	// reads `project.name` immediately, so the picture would be the index's own failure card.
	// `?project=<id>` seeds a project of that id and opens the view on it — see
	// `tests/harness/mount.ts` for what the fixture holds and why twelve plans were not enough.
	//
	// A FIXED shot rather than a `--width` invocation, and that is a fact about this script
	// rather than a preference: `resolveShots` reads a positional argument as a harness-index
	// ENTRY id, and refuses `--width` with no entry beside it because "the fixed shots carry
	// their own". Every other shot with a query string lives here for the same reason.
	{ name: 'project-detail', query: '?project=project-1', selector: PROJECT_VIEW },
	// The project's own PRICE SECTION, which no resting shot of this surface can reach: it sits
	// below 26 plan rows inside `.rp-project-detail__body`, the pane's one scroller, so
	// `project-detail` above photographs plans and nothing else. Measured, not predicted — that
	// is exactly what the first capture after the section landed showed.
	//
	// A THIRD shot rather than a smaller plan fixture, because both regions are worth looking at
	// and shrinking one to fit the other in one frame would stop the plan list demonstrating the
	// body's scroll at all. `scrollTo` is what makes it a picture of the section rather than of
	// the page's top.
	{
		name: 'project-detail-prices',
		query: '?project=project-1&section=prices',
		selector: PROJECT_VIEW,
		scrollTo: '.rp-asset-price-header',
	},
	// 460 is the width an Obsidian sidebar leaf actually has, and the one that has already
	// hidden a layout defect the default 1280 could not show — the header's three items on one
	// row, with the name ellipsing rather than pushing its neighbours off, are decided there and
	// nowhere else.
	//
	// AND IT IS THE LIGHT ONE, so two shots hold both palettes rather than three shots holding
	// one twice — the same trade the four index shots make, and made the same way: by
	// measurement. The only element on this surface with a colour of its own is the status
	// label, `--text-muted` on `--background-primary`, which measures 6.69:1 in light against
	// 8.13:1 in dark, so light is the scheme a regression toward 1.4.3's 4.5:1 floor would
	// breach first. Width and scheme are independent here — nothing about the wrapping changes
	// with the palette — so confounding them costs nothing that a separate shot would buy.
	{
		name: 'project-detail-narrow',
		query: '?project=project-1&theme=light',
		selector: PROJECT_VIEW,
		width: 460,
	},
	// The price section AT 460, which neither of the two shots above reaches: the narrow one is
	// about the header and rests at the top of the pane, and the price shot is 1280 wide. This is
	// where the row's wrapping is decided — it is a wrapping flex row whose field block takes a
	// fixed 14rem basis, so 460 is the width at which the input and its button either drop to
	// their own line or crush the asset's name, and no gate in this repository can measure
	// either. LIGHT, for the same reason `project-detail-narrow` is: the muted text these rows
	// are mostly made of measures tighter against 1.4.3's floor there.
	{
		name: 'project-detail-prices-narrow',
		query: '?project=project-1&section=prices&theme=light',
		selector: PROJECT_VIEW,
		width: 460,
		scrollTo: '.rp-asset-price-header',
	},
	// The Plan Editor in both schemes: it is the first surface with real content, and the
	// only place the layered Konva scene can be looked at outside a vault. No phone shot —
	// SDD §61 scopes the MVP to desktop, and a canvas editor is the least mobile of the
	// surfaces; add one when §61 changes.
	//
	// `selector: FLOOR_STATE` rather than the bare view wrapper (R14, 2026-09-04): the wrapper
	// attaches before asynchronous project hydration establishes the ready floor state, so a
	// wait on it alone could complete while the intended contents were still loading — a
	// successful capture of the wrong state, the most dangerous failure this instrument can
	// produce. `.rp-floor-inspector` draws only once hydration is ready and nothing is
	// selected, which is exactly the resting state these two shots exist to show.
	{ name: 'plan-editor-dark', query: '?view=plan-editor', selector: FLOOR_STATE },
	{ name: 'plan-editor-light', query: '?view=plan-editor&theme=light', selector: FLOOR_STATE },
	// Task 21's three: the ROOM state (a zone selected, so the Room Inspector is on screen —
	// the `?select=` knob drives the real click `RoomSummaryList` renders, through
	// `runtime.selectAndFrame`), the Add menu open (the `?add` knob, same shape), and the
	// shell at a sidebar's width. Each waits on the element its own knob produces rather than
	// on the bare view wrapper, which is on screen the whole time either knob is still working —
	// a selector that could not tell "mounted" from "the knob actually landed" would let a
	// broken knob exit 0 with a picture of the resting editor under a new name.
	{
		name: 'plan-editor-selected',
		query: '?view=plan-editor&select=harness-kitchen&theme=light',
		selector: '.rp-room-inspector',
	},
	{ name: 'plan-editor-add-menu', query: '?view=plan-editor&add&theme=light', selector: '.rp-add-menu' },
	// Task 14's two: the ROOM TASK under way at both widths, reached through `?room=<w>x<d>`,
	// which presses Add, the catalogue's Room item and then both length fields — the numeric
	// route of design spec §3, so the picture shows a placed rectangle nobody dragged.
	//
	// The two wait on DIFFERENT elements because the two widths can show different things. At
	// full width the form is a column of the shell, so the wait is the sentence the numeric
	// route itself writes — `:not(:empty)` because `.rp-new-room__settled` is a live region
	// present from the first render (a `role="status"` attributed on a container that APPEARS
	// announces nothing) and carries text only once both sides are committed, which is exactly
	// "the knob landed" rather than "the form mounted". At 460px that form is inside a drawer
	// the knob opens to type in and closes behind itself, so none of it is on screen and the
	// banner's Finish is what is left.
	//
	// **The BARE `.rp-task-banner__finish` was not a wait at all, and it shipped as one.** That
	// button attaches the moment `activateCreationEntry('room', …)` arms `draw-room` — step 2
	// of `enterRoomTaskOnceReady`, BEFORE it presses the rail's Details button, types either
	// side or closes the drawer — and the knob is fire-and-forget, so nothing sequenced the two:
	// this shot could photograph an unsized draft, or the drawer covering the very banner it
	// exists to show. Exactly the "mounted vs. the knob actually landed" hazard the paragraph
	// above states for its siblings, in the one shot that did not apply it.
	//
	// `[aria-disabled="false"]` is the discriminating form, and it is the same fact the wide
	// shot waits on read through the one surface a closed drawer leaves on screen:
	// `TemporaryToolBanner.vue` binds that attribute to `!runtime.canCreateRoom`, which is
	// `RoomDraftStore.valid` — a placed rect, a non-empty name, no field refusal — so it reads
	// `"false"` only once both sides have committed. Vue renders the boolean as the STRING
	// `"true"`/`"false"` for an `aria-` attribute rather than dropping it, which that
	// component's own header states and `tests/presentation/editor/shell/temporaryToolBanner.
	// test.ts` asserts against a real mount.
	//
	// It proves the DRAWER is closed too, which nothing else reachable here can: `waitUntilReady`
	// waits for `attached` and has no way to spell an absence. From the width commit to the
	// drawer's close click the knob runs with NO `await`, so both reactive writes land in one
	// Vue flush — the attribute cannot flip in a DOM that still holds the drawer.
	//
	// What it costs is named rather than hidden: this wait depends on a binding in a component
	// no capture owns. If that binding changes, the shot TIMES OUT — a reported error and a
	// non-zero exit — rather than photographing the wrong state, which is the loud direction of
	// the two and the reason a dependency is acceptable here at all.
	{
		name: 'plan-editor-add-room',
		query: '?view=plan-editor&room=4200x3800&theme=light',
		selector: '.rp-new-room__settled:not(:empty)',
	},
	{
		name: 'plan-editor-add-room-narrow',
		query: '?view=plan-editor&room=4200x3800&theme=light',
		selector: '.rp-task-banner__finish[aria-disabled="false"]',
		width: 460,
	},
	// Task 14's third and fourth: the trust path's own stale-projection warning (design spec
	// §2.3/§2.4), reached through `?stale` — which drives a REAL zero-referent zone deletion
	// through the Inspector's own Delete button and lets its own post-write read-back fail, so
	// `ProjectStore.stale` becomes true the same way a real vault fault would set it. `&select=`
	// is applied AFTER that write lands (`tests/harness/planEditor.ts`'s own
	// `driveStaleKnobOnceReady`), so the picture shows the persistent warning strip's Retry and
	// Open source note buttons beside the SEEDED Kitchen selected and its own Delete visibly
	// paused — `runtime.writesBlocked` reads `projectStore.stale`, so every write control on the
	// canvas dims once the knob has landed, Delete included.
	//
	// The selector waits on the STALE ROW's own button rather than on the strip's container
	// (`.rp-warning-strip`, present from the first render per that component's own header): a
	// wait on the container would certify the strip MOUNTED, not that the knob's write actually
	// landed — the same "arming versus landing" hazard `plan-editor-add-room-narrow`'s own
	// comment states for its `[aria-disabled="false"]` wait, met a second time here.
	{
		name: 'plan-editor-stale',
		query: '?view=plan-editor&select=harness-kitchen&stale&theme=light',
		selector: '[data-rp-warning="stale"] button',
	},
	{
		name: 'plan-editor-stale-narrow',
		query: '?view=plan-editor&select=harness-kitchen&stale',
		selector: '[data-rp-warning="stale"] button',
		width: 460,
	},
	// A LIST rather than one selector (R14, 2026-09-04): the canvas alone attaches before the
	// constrained-layout reflow has actually happened, so a wait on it could complete with the
	// Layers/Details rail not yet on screen — the same wrong-state shape as `plan-editor-dark`'s
	// own fix above, for this shot's own extra claim. `waitUntilReady` takes `string | string[]`
	// for a fixed shot now, and waits on every member.
	{
		name: 'plan-editor-narrow',
		query: '?view=plan-editor&theme=light',
		selector: [PLAN_CANVAS, '.rp-editor-shell[data-layout="constrained"] .rp-panel-rail'],
		width: 460,
	},
	// The UNSUPPORTED layout at 320 px — the one width the 460 shot cannot show — and the one
	// capture that MEASURES rather than only draws: M16 refuses a horizontal scrollbar here, and
	// jsdom lays nothing out, so `measure` reads the shell's scrollWidth against its clientWidth
	// in the real browser and fails the run on a sideways scroll (R13, 2026-09-04).
	{
		name: 'plan-editor-unsupported',
		query: '?view=plan-editor&theme=light',
		selector: '.rp-editor-shell[data-layout="unsupported"] .rp-unsupported-width',
		width: 320,
		measure: '.rp-editor-shell',
	},
	// The asset designer (Task B10, ADR-0015) in both schemes — the plugin's third workspace
	// view, and the first look at it against a real theme rather than jsdom's semantics-only
	// scan. `mountAssetDesignerHarness` seeds no shape and no background, so this photographs the
	// `noBackground` empty state over the toolbar, canvas and inspector shell — the same surface
	// `accessibility.test.ts`'s designer case scans, through the same mount function.
	{ name: 'asset-designer-dark', query: '?view=asset-designer', selector: ASSET_DESIGNER_VIEW },
	{ name: 'asset-designer-light', query: '?view=asset-designer&theme=light', selector: ASSET_DESIGNER_VIEW },
	// AND AT A SIDEBAR LEAF'S WIDTH, added after an ad-hoc capture at this width — never
	// committed, never watched again — found the toolbar's seven tool buttons plus Undo/Redo
	// silently overflowing `nowrap`: "Set anchor" truncated to "Set f", Calibrate pushed off the
	// pane, neither reachable, with no affordance that anything was missing. `styles/designer.css`
	// now wraps that row; this shot is what keeps the regression from going back to being ad-hoc
	// and unwatched. DARK rather than light, and deliberately for no measured reason: unlike
	// `project-detail-narrow` above, which picked light because a contrast measurement favoured
	// it, wrapping is not a colour question — nothing here behaves differently by scheme, so
	// there is nothing to measure and dark is simply this file's own default.
	{ name: 'asset-designer-narrow', query: '?view=asset-designer', selector: ASSET_DESIGNER_VIEW, width: 460 },
	// THE ASSET LIBRARY (Task 17), and this is the surface with the largest gap between what was
	// built and what has ever been looked at: sixteen tasks shipped the shelves, the rows, the
	// marks, the inspector, the stylesheet, the keyboard and the narrow composition, and every
	// rendering question any of them raised was deferred to a capture nobody could take.
	//
	// SEVEN shots and not two, which is a deviation from this task's own brief and is argued from
	// §7 rather than from appetite: that section specifies a ladder with THREE rungs (a 280px
	// rail at and above 45rem, 240px between 35 and 45, and one pane below 35), and the middle
	// rung has already shipped MISSING once — reported by a review bot, with that partial's own
	// comment recording why nothing saw it: "no capture had been taken between the two widths
	// that were". A ladder photographed at one width is a ladder with two untested rungs.
	//
	//   - Rest, BOTH schemes at 1280: the shelves, the rows' five slots, §5.1a's repair strip and
	//     the resting inspector rail. The whole palette of this surface is here and nowhere else.
	//   - Selected at 1280, LIGHT: §3.5's inspector in full — four sections, the editable field
	//     grid, the `Used in` list and the three actions. Light because the one control on this
	//     surface with a colour argument is the destructive `Delete`, whose border is
	//     `--text-error`: the pair already measured for that variable in this file (the index's
	//     failure card) puts it at 3.89:1 in light against 4.27:1 in dark, so light is the scheme
	//     a regression toward a contrast floor breaches first.
	//   - Selected at 700, LIGHT: §7's MIDDLE rung, the 240px rail, which no picture has ever
	//     held. Same scheme as the shot above so the only difference between the two is the width.
	//   - Rest at 460, DARK: the row at an Obsidian sidebar leaf's real width, where §7 says the
	//     supplier slot goes first and the waste slot second. Dark for `asset-designer-narrow`'s
	//     own stated reason — wrapping is not a colour question, so there is nothing to measure
	//     and dark is this file's default.
	//   - Selected at 460, LIGHT: §7's THIRD rung, the one composition in this plugin where a rail
	//     stops being a rail. `.rp-al-body` is hidden, the inspector takes the pane and
	//     `‹ Back to library` appears — three rules that have never drawn together anywhere,
	//     stood in for until now by a unit test that strips the `@container` wrapper off the
	//     shipped selector, which is a stand-in and not evidence the query fires.
	{ name: 'asset-library-dark', query: '?view=asset-library', selector: ASSET_LIBRARY_VIEW },
	{ name: 'asset-library-light', query: '?view=asset-library&theme=light', selector: ASSET_LIBRARY_VIEW },
	{
		name: 'asset-library-selected',
		query: `?view=asset-library&theme=light&asset=${LIBRARY_SELECTED_ASSET}`,
		selector: ASSET_LIBRARY_VIEW,
	},
	{
		name: 'asset-library-middle',
		query: `?view=asset-library&theme=light&asset=${LIBRARY_SELECTED_ASSET}`,
		selector: ASSET_LIBRARY_VIEW,
		width: 700,
	},
	// AND THE ACTIONS ROW, which no RESTING capture of this surface reaches: the rail is its own
	// scroller, and with §3.5's four sections above it the row sits below the fold at 1280 × 800 —
	// seen, not predicted, in the first capture taken after this shot's siblings. Seen with the
	// provisioned Chromium named through `RP_CHROMIUM_EXECUTABLE` rather than the pinned
	// revision, which is the caveat every capture-derived sentence on this branch carries and
	// which this one did not; below-the-fold is unlikely to differ between builds, and the
	// sentence says which build it was read on either way. `Delete` is the reason it is worth a shot of its own: it is this surface's one
	// destructive control, its treatment was reasoned from SPECIFICITY alone
	// (`.rp-al-inspector .rp-al-action--delete` at (0,2,0) against Obsidian's own
	// `button:not(.clickable-icon)` at (0,1,1)), and this repository has already shipped exactly
	// that reasoning being wrong once, when a danger button rendered plain white.
	{
		name: 'asset-library-actions',
		query: `?view=asset-library&theme=light&asset=${LIBRARY_SELECTED_ASSET}`,
		selector: ASSET_LIBRARY_VIEW,
		scrollTo: '.rp-al-actions',
	},
	{ name: 'asset-library-narrow', query: '?view=asset-library', selector: ASSET_LIBRARY_VIEW, width: 460 },
	{
		name: 'asset-library-narrow-selected',
		query: `?view=asset-library&theme=light&asset=${LIBRARY_SELECTED_ASSET}`,
		selector: ASSET_LIBRARY_VIEW,
		width: 460,
	},
	// The harness's own index — the one surface here this command could not photograph. That is
	// not a gap worth leaving in a tool whose whole argument is that a capture read by eye
	// reaches defects no gate can: the index's own chrome went unlooked-at while it accumulated
	// a focus ring nothing drew, rows under the 24px target minimum, a contrast failure in one
	// scheme only, and a `role="alert"` card styled by no rule at all — with `npm run check`
	// green throughout, because every one of those is invisible to a suite with no layout engine.
	//
	// FOUR shots and not two, because a STATE nothing navigates to is a state no picture holds.
	// The first version of this took the two resting shots alone and claimed all four defects as
	// the reason; `?index` renders neither the focus ring (nothing has been tabbed to) nor the
	// failure card (nothing has failed), so deleting either rule would have left both PNGs
	// identical. Two of the four were being watched by a comment rather than by a camera.
	//
	// Which scheme each state is taken in is the scheme its own defect was worst in, so the run
	// stays four shots rather than eight:
	//   - Rest, BOTH: the contrast failure existed only in light, and the picker's whole palette
	//     is what these two are for.
	//   - Focus, LIGHT: the ring is `--interactive-accent` on the nav's `--background-secondary`,
	//     which measures 3.46:1 in dark and 3.17:1 in LIGHT — so light is the tighter of the two
	//     against 1.4.11's 3:1 floor, and it is the scheme a regression would breach first. This
	//     said dark, on the reasoning that a dark background is harder to separate a colour from.
	//     That is a plausible sentence and it is not a measurement; the numbers were already in
	//     `styles/editor.css` and disagreed with it. Re-measured in a real Chromium against the
	//     vendored sheet to confirm, since the recorded pair was taken on the editor's surfaces
	//     rather than on this one.
	//   - Failure, LIGHT: `--text-error` measured 3.89:1 there against 4.27:1 in dark, which is
	//     why that card's colour ended up decided by the light scheme.
	{ name: 'index-dark', query: '?index', selector: HARNESS_INDEX },
	{ name: 'index-light', query: '?index&theme=light', selector: HARNESS_INDEX },
	// `focus` is what makes this shot differ from `index-dark` at all — see `focusForShot` for
	// why it is reached with a Tab press rather than set programmatically.
	{ name: 'index-focus', query: '?index&theme=light', selector: HARNESS_INDEX, focus: `${HARNESS_INDEX} > nav li a` },
	// AND THE SAME RING ON THE CURRENT ROW, which is a different pairing rather than the same shot
	// with one entry open. `outline-offset` is negative, so the ring's neighbour is whatever the ROW
	// is painted in — `--nav-item-background-active` here, the sidebar in the shot above — and the
	// accent that cleared 3:1 against the sidebar measured 2.72:1 against this one. `?index` opens no
	// entry, so no row is ever current there and that pairing had no capture at all.
	//
	// The focus selector names `[aria-current='page']`, so the Tab walk stops on the OPEN row rather
	// than the first one; without it this shot would photograph the pairing already covered.
	{
		name: 'index-focus-current',
		query: '?entry=prototype:WorkPackages&theme=light',
		selector: HARNESS_INDEX,
		focus: `${HARNESS_INDEX} > nav li a[aria-current='page']`,
	},
	// An id no entry can have, so the index draws its failure card. Deliberately WITHOUT an
	// `entry` field: that field means "wait for this entry to draw and report if it did not",
	// which is the opposite of what this shot wants. With none, the wait is on the card's own
	// selector and the run stays green — the failure being photographed is the subject here, not
	// a fault in the run.
	{ name: 'index-failure', query: '?entry=no-such-entry&theme=light', selector: '.rp-harness-failure' },
];

/** One capture: navigate, wait for the real view to mount, screenshot, MEASURE it when the shot
 * asks to be (R13), report any page or console error back onto the shared list rather than
 * throwing — one bad shot should not cost the rest of the run its PNGs.
 *
 * Returns the page's own CLASSIFICATION of the failure it recorded (`readFailureKind`), or
 * `undefined` on a clean capture: `captureAll` reads it to decide whether the SECOND colour
 * scheme of the same entry is worth attempting at all. The kind rather than the reason, because
 * the reason is prose an entry's own error can imitate — see `readFailureKind`. The reason is
 * still pushed here rather than returned: the errors list is what the exit code is built from,
 * and a caller that forgot to push would turn a failure into a green run. */
async function captureOne(browser, baseUrl, { name, query, selector, entry, width, focus, scrollTo, measure }, errors) {
	const page = await browser.newPage({ viewport: viewportFor(width) });

	page.on('pageerror', (error) => errors.push(`[${name}] page error: ${error.message}`));
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(`[${name}] console error: ${msg.text()}`);
	});
	// `console.warn` is deliberately NOT recorded here. `IndexPage.vue`'s `warnHandler` sends
	// EVERY Vue warning there unconditionally (attributed or not, late or not) — it is the one
	// channel a warning always reaches, on top of whatever else it does — so treating it as a
	// failure signal would fail a shot on a warning that never touched the entry on stage at
	// all, which is the false positive `warnHandler`'s own header goes out of its way to avoid
	// (`console.error` is its channel for that; see "Not dropped" there). The late-clear window
	// this file exists to close is closed by re-asking `entryHasDrawn` after the screenshot
	// (`reportIfNoLongerDrawn`), which reads the one thing that actually failed rather than a
	// channel carrying both real defects and noise.

	try {
		// 'load', not 'networkidle': Vite's dev server keeps an HMR websocket open, which
		// networkidle waits forever for.
		await page.goto(`${baseUrl}/${query}`, { waitUntil: 'load' });
		// `entryHasDrawn` is passed in rather than imported over there: `captureReadiness.mjs`
		// only ever hands it to `page.waitForFunction`, so it stays free of DOM-shaped code and a
		// fake `page` can drive the race with no browser. Same bargain `reportIfNoLongerDrawn`
		// already makes below.
		await waitUntilReady(page, selector, entry, entryHasDrawn);
		// After the wait, never before it: tabbing into a page that has not drawn its list yet
		// walks whatever tab order exists at that moment, which is not the one being pictured.
		// BEFORE the focus walk: tabbing changes the scroll position itself, so scrolling after it
		// would undo the one thing that shot asked for. No shot uses both today; the ordering is
		// stated rather than left to whichever one does first.
		await scrollForShot(page, scrollTo);
		await focusForShot(page, focus);

		const file = path.join(OUT_DIR, `${name}.png`);

		await page.screenshot({ path: file, fullPage: true });
		await measureForShot(page, name, measure, errors);
		await reportIfNoLongerDrawn(page, entry, name, errors, entryHasDrawn);

		console.log(`wrote ${file}`);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		const described = await describeFailure(page, entry, reason);

		errors.push(`[${name}] ${described}`);
		return (await readFailureKind(page, entry)) ?? undefined;
	} finally {
		await page.close();
	}

	return undefined;
}

/** Boot the harness's own dev server (`vite.harness.config.ts`) on a free port, the JS API
 * rather than spawning the CLI: `server: { open: false }` here overrides the config's own
 * `canOpenBrowser` unconditionally, so this never hits the `xdg-open ENOENT` the config's
 * comment describes for a display-less container — headless capture is exactly that case
 * on every platform, not only Linux.
 *
 * `host: '127.0.0.1'` is set explicitly rather than left to Vite's own default, which can
 * resolve `localhost` to `::1` first on a machine with IPv6-first resolution — the address
 * this function reports would then be a real, listening server that every `page.goto()`
 * below is refused by, since `chromiumBinaryIn`'s browser and this URL would be talking to
 * two different interfaces. Binding the host is simpler than reading `address.address` back
 * and bracket-quoting it for an IPv6 literal, and it means the reported port is always on
 * the same loopback interface the returned `baseUrl` names.
 *
 * Every exit out of this function past `createServer` succeeding closes the server it
 * opened — `server.listen()` throwing, or the port check below throwing, would otherwise
 * leave Vite's dev server listening with nothing left that can ever call `server.close()`,
 * which is a hang indistinguishable from `chromium.launch()` failing the same way (see
 * `run` below): the process never exits. */
async function startHarnessServer() {
	const server = await createServer({
		configFile: path.resolve('vite.harness.config.ts'),
		server: { open: false, port: 0, host: '127.0.0.1' },
	});

	try {
		await server.listen();
		const address = server.httpServer?.address();

		if (!address || typeof address === 'string') throw new Error('the harness dev server did not report a port');

		return { server, baseUrl: `http://127.0.0.1:${address.port}` };
	} catch (error) {
		await server.close();
		throw error;
	}
}

/** Why this shot is not being attempted, or `undefined` to attempt it. Its own function so
 * `captureAll` stays one decision per line — fallow's complexity budget reads the loop, and a
 * capture loop is the wrong place to spend it. */
function skipReason({ name, entry }, missing) {
	if (entry === undefined || !missing.has(entry)) return undefined;

	return `[${name}] not attempted: the index has no entry named ${entry}`;
}

/** Whether a shot's failure means the ENTRY is missing rather than that it drew badly — the
 * only failure whose answer the other colour scheme cannot change. `undefined` is a clean
 * capture, which is never a reason to skip anything. */
const isMissingEntry = ({ entry }, kind) => entry !== undefined && kind === UNKNOWN_ENTRY;

/** Every shot in the list — every fixed shot for a bare run, two for a named entry — and the
 * errors any of them raised, collected rather than thrown, so one bad shot does not cost the rest of
 * the run its PNGs.
 *
 * An entry the index says it does not HAVE is not attempted twice. The two shots of one entry
 * differ only by `?theme`, and a mistyped id fails identically in both schemes — so the second
 * one is a page load, a race and a `describeFailure` read spent to be told the same sentence.
 * It is still REPORTED, with the reason: silently writing one PNG where two were promised, and
 * saying nothing about the second, is the shape of quiet this whole script is against. Only
 * "no such entry" qualifies, and it is the PAGE that says so (`readFailureKind` reads
 * `data-failure`, not the message); an entry that exists and drew badly is attempted in both
 * schemes, because a defect can be scheme-specific and looking is the point. */
async function captureAll(browser, baseUrl, shots) {
	const errors = [];
	const missing = new Set();

	for (const shot of shots) {
		const skipped = skipReason(shot, missing);

		if (skipped !== undefined) {
			errors.push(skipped);
			continue;
		}

		const failure = await captureOne(browser, baseUrl, shot, errors);

		if (isMissingEntry(shot, failure)) missing.add(shot.entry);
	}

	return errors;
}

/** What every failed capture is told to the terminal, and the exit code that makes it
 * mean something: this process is meant to be checked by its status, not only read. */
function reportErrors(errors) {
	if (errors.length === 0) return;

	console.error('\nharness-shot found page errors:\n');
	for (const line of errors) console.error(` - ${line}`);
	process.exitCode = 1;
}

async function run() {
	const executablePath = resolveChromiumExecutable();

	// `node scripts/harness-shot.mjs prototype:ZoneSummary` — one entry, both schemes. The
	// argument is the entry's qualified id (`entries.ts`), not its basename: the index shows
	// the label, but the URL and this command both take the id, since a mock and the real
	// component it stands in for share a basename and need to stay reachable as two entries.
	// With no argument, every fixed surface, exactly as before. `resolveShots` is what
	// actually reads `argv[2]` — lifted out of this line so a test can drive it directly
	// rather than reading this file's source text to check which index it uses.
	const shots = resolveShots(process.argv, SHOTS, process.env);

	mkdirSync(OUT_DIR, { recursive: true });

	const { server, baseUrl } = await startHarnessServer();

	// `chromium.launch()` is INSIDE this try, not before it: a browser present on disk but
	// unlaunchable (a missing shared library, an incompatible cached revision) rejects this
	// call, and if that rejection happened above a try whose `finally` is what closes the
	// dev server, the server would be left listening forever with nothing left to close it
	// — Node never exits, and `npm run harness-shot` hangs instead of failing. Every path
	// out of this function past `startHarnessServer` succeeding now closes the server.
	try {
		const browser = await chromium.launch({ executablePath, headless: true });

		try {
			reportErrors(await captureAll(browser, baseUrl, shots));
		} finally {
			await browser.close();
		}
	} finally {
		await server.close();
	}
}

try {
	await run();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
