import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from '../helpers/oxlint';

/**
 * The headless capture script's wiring — the shape `lint-edited.test.ts` checks for the
 * edit-loop hook, applied to `scripts/harness-shot.mjs`: an npm script names a file that
 * exists, and the devDependency the file needs is declared, and declared as the browserless
 * package rather than the one that downloads a browser on every `npm install`.
 *
 * What this deliberately does NOT do: launch a browser, start the harness's dev server, or
 * assert anything about a screenshot. `scripts/harness-shot.mjs` draws; there is no
 * baseline to diff a PNG against, and driving Playwright here would trade this suite's
 * speed for a check `npm run harness-shot`, run by hand, already gives a developer directly.
 */

const PACKAGE_JSON = path.join(REPO, 'package.json');
const SCRIPT = path.join(REPO, 'scripts', 'harness-shot.mjs');
// Where the browser resolution actually lives, since `concept-shots.mjs` needs the same
// answer and two copies of it is the shape of the defect the block below describes.
const RESOLVER = path.join(REPO, 'scripts', 'chromium.mjs');
// Every file that can name a Chromium. The literal ban applies to all of them, not only to
// the one that happens to own the resolver today — a re-mirrored layout is just as wrong in
// a caller as in the callee.
const CHROMIUM_FILES = [RESOLVER, SCRIPT, path.join(REPO, 'scripts', 'concept-shots.mjs')];

const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as {
	scripts: Record<string, string>;
	devDependencies: Record<string, string>;
};

describe('the headless harness capture script', () => {
	it('is wired as an npm script pointing at a file that exists', () => {
		const command = pkg.scripts['harness-shot'];

		expect(command).toBeDefined();

		// `node scripts/harness-shot.mjs` — resolved against the repository root the same
		// way every script here resolves its own paths, not against this test file's
		// location.
		const named = command.replace(/^node\s+/, '').trim();

		expect(existsSync(path.join(REPO, named))).toBe(true);
	});

	it('declares playwright-core, not the full playwright package that downloads browsers on install', () => {
		expect(pkg.devDependencies['playwright-core']).toBeDefined();
		expect(pkg.devDependencies.playwright).toBeUndefined();
	});

	it('is absent from npm run check — it draws and asserts no appearance, so there is nothing for the gate to verify', () => {
		expect(pkg.scripts.check).not.toContain('harness-shot');
	});

	/*
	 * Where the browser comes from. This one is a real defect caught late: the script used to
	 * BUILD the executable's path itself, mirroring Playwright's per-platform layout —
	 * `chrome-win/chrome.exe`, `chrome-linux/chrome`, `chrome-mac/Chromium.app/…`. Playwright
	 * moved to Chrome-for-Testing builds and renamed every one of those directories, so the
	 * mirrored table was wrong on four of its five platforms and `npm run harness-shot` failed
	 * on this repository's own Windows leg with "No Chromium build found".
	 *
	 * The layout is Playwright's to know, so it is asked rather than mirrored. These two check
	 * that, and they are deliberately machine-independent: asserting the RESOLVED path would
	 * need a Chromium installed, and CI has none — this script is outside `npm run check` for
	 * exactly that reason. So the invariant checked is the one that caused the defect: no
	 * browser-layout literal is written down in any of these files at all.
	 *
	 * The resolution itself now lives in `scripts/chromium.mjs`, one file two capture scripts
	 * import, because the alternative was a second copy of it in `concept-shots.mjs` — and a
	 * copy that can disagree is precisely the failure the mirrored table already caused once.
	 */
	it('asks playwright-core for the executable path instead of constructing one', () => {
		expect(readFileSync(RESOLVER, 'utf8')).toContain('chromium.executablePath()');
	});

	it('resolves the browser through that one shared module rather than resolving its own', () => {
		expect(readFileSync(SCRIPT, 'utf8')).toContain("from './chromium.mjs'");
	});

	it('writes down no per-platform browser layout of its own, in any file that names a browser', () => {
		// Every directory name Playwright's own EXECUTABLE_PATHS table has used for a
		// chromium build, current and superseded. A literal from either era in any of these
		// files means the layout is being mirrored again.
		const layouts = [
			'chrome-win',
			'chrome-linux',
			'chrome-mac',
			'chrome.exe',
			'Chromium.app',
			'Google Chrome for Testing',
			'chrome-headless-shell',
		];

		const offenders = CHROMIUM_FILES.flatMap((file) => {
			const source = readFileSync(file, 'utf8');

			return layouts.filter((name) => source.includes(name)).map((name) => `${path.basename(file)}: ${name}`);
		});

		expect(offenders).toEqual([]);
	});

	/**
	 * The agent's eye. `docs/actors/Coding agent.md` states the constraint this serves: the
	 * actor has no browser, so a screen reachable only by clicking a row in an index cannot
	 * be captured, scripted or diffed — and every layout judgement is deferred to a human.
	 *
	 * Asserted on the SOURCE rather than by running a capture, for the reason this file's
	 * header already gives: driving Playwright here would trade the suite's speed for a
	 * check `npm run harness-shot` gives a developer directly. What is checked is that the
	 * argument is read and turned into the `?entry=` URL the index answers.
	 */
	it('captures a named entry, using the index URL that entry is reachable at', () => {
		const source = readFileSync(SCRIPT, 'utf8');

		// The argument is read from argv rather than hard-coded.
		expect(source).toMatch(/process\.argv/);
		// And becomes the query the index reads (`IndexPage.vue`).
		expect(source).toContain('?entry=');
	});

	/**
	 * The PNG name is derived from a file path, and a legal path must not produce an illegal
	 * filename. Two ways it can, and both are the same criterion-4 failure — an entry the
	 * index opens and the capture cannot write:
	 *
	 * - Two different ids flattening onto one name, so the second capture silently
	 *   overwrites the first. The digest is what refuses that.
	 * - One id flattening onto a name too long for the filesystem — `ENAMETOOLONG` from
	 *   `page.screenshot()`. The cap is what refuses that, and it is safe only BECAUSE the
	 *   digest holds the identity: truncating a part that no longer has to be unique costs
	 *   nothing.
	 *
	 * Asserted on the source, like every case in this file, because `harness-shot.mjs` runs
	 * its capture at module scope and cannot be imported to be called. That is a real limit
	 * of these assertions and it is stated rather than papered over: what they check is that
	 * the script still SAYS this, not that a 300-character id was captured.
	 */
	it('keeps the PNG name unique and short enough to exist', () => {
		const source = readFileSync(SCRIPT, 'utf8');

		// Identity: a short hash of the REAL id, not of the flattened one.
		expect(source).toContain("createHash('sha1').update(entry)");
		// Length: the human-readable half is capped, since the digest is what makes it unique.
		expect(source).toMatch(/\.slice\(0,\s*60\)/);
	});

	/**
	 * The assertion that stops a green run from lying. Waiting on `.rp-harness-stage` alone
	 * would photograph the placeholder — a successful, empty PNG, which the actor this
	 * feature exists for cannot tell from a real one.
	 */
	it('waits for the entry to have rendered, not merely for the stage to exist', () => {
		const source = readFileSync(SCRIPT, 'utf8');

		// The readiness question is asked in the page: the id is compared as a STRING against
		// `dataset.entry`, never interpolated into a CSS attribute selector, because an id is
		// built from a file path and a `"` is a legal filename character on POSIX.
		expect(source).toContain('stage.dataset.entry === id');
		expect(source).toContain('waitForFunction(entryHasDrawn');
		// The stage must not be empty either — but by NODE, not by element: a template whose
		// root is text renders no element, and an element check would refuse a capture of an
		// entry the index drew correctly.
		expect(source).toContain('stage.childNodes.length > 0');
		expect(source).not.toContain('firstElementChild');
		// The bare stage class must not be used as a wait target on its own, and no attribute
		// selector may be built out of an entry id.
		expect(source).not.toMatch(/selector:\s*['"`]\.rp-harness-stage['"`]/);
		expect(source).not.toMatch(/\[data-entry=/);
	});

	/**
	 * The index app must install everything the production mount does, or a canvas component
	 * renders nothing while every gate stays green — Vue warns rather than throws on an
	 * unresolved component, and the outer element still satisfies the shot selector.
	 */
	it('installs VueKonva on the index app, as the production mount does', () => {
		const page = readFileSync(path.join(REPO, 'tests', 'harness', 'page.ts'), 'utf8');
		const production = readFileSync(
			path.join(REPO, 'src', 'presentation', 'views', 'PlanEditorView.ts'),
			'utf8',
		);

		// Read from production rather than hard-coded: if the plugin ever installs something
		// else, this asks the question again instead of pinning today's answer.
		expect(production).toContain('app.use(VueKonva)');
		expect(page).toContain('.use(VueKonva)');
	});

	/**
	 * The production mount does THREE things — Pinia, VueKonva and `provide(PLAN_EDITOR_CONTEXT)`.
	 * The third has no `use()` to make it visible in a diff, which is why it was the one
	 * missed, and why it gets its own assertion rather than being folded into the one above.
	 */
	it('provides PLAN_EDITOR_CONTEXT on the index app, as the production mount does', () => {
		const page = readFileSync(path.join(REPO, 'tests', 'harness', 'page.ts'), 'utf8');
		const production = readFileSync(
			path.join(REPO, 'src', 'presentation', 'views', 'PlanEditorView.ts'),
			'utf8',
		);

		expect(production).toContain('app.provide(PLAN_EDITOR_CONTEXT');
		expect(page).toContain('provide(PLAN_EDITOR_CONTEXT');
	});

	/**
	 * The index branch runs BEFORE any mount, so Obsidian's DOM prototype extensions do not
	 * exist until it installs them itself — and it MUST, because `drawSchemeToggle()` runs on
	 * every branch and calls `document.body.createEl`.
	 *
	 * The assertion is ORDER, not spelling: the shim call has to come before the first use of
	 * an extension. Asserting "no extension calls here" was the earlier version and it was
	 * wrong twice over — it forbade the working implementation, and it would have passed a
	 * branch that used standard DOM and then let `drawSchemeToggle()` throw anyway.
	 *
	 * `tests/harness/theme.ts:44-47` carries the same rule for `applyPlatform` and names why
	 * no runtime test catches it: every jsdom file installs the extensions at module top, so
	 * the shimmed spelling passes the suite and throws on the real page.
	 */
	it('installs the Obsidian DOM shim before the index branch uses any extension', () => {
		const page = readFileSync(path.join(REPO, 'tests', 'harness', 'page.ts'), 'utf8');
		const branch = page.slice(page.indexOf('if (wantsIndex)'), page.indexOf('} else {'));

		const install = branch.indexOf('installObsidianDom()');
		const firstUse = branch.search(/\.empty\(\)|\.createDiv\(|\.createEl\(/);

		expect(install, 'the index branch never installs the shim').toBeGreaterThanOrEqual(0);
		// Written to avoid a CONDITIONAL expect (oxlint's `vitest/no-conditional-expect`, which
		// `npm run check` fails on with zero tolerance): the brief's literal
		// `if (firstUse >= 0) expect(install).toBeLessThan(firstUse);` is refused by that rule,
		// and `linterOptions.noInlineConfig` rules out a suppression. Same claim either way — if
		// no extension use is found in the branch, the ordering holds vacuously.
		const shimInstallsFirst = firstUse < 0 || install < firstUse;

		expect(shimInstallsFirst, 'the shim installs before the first Obsidian DOM extension use').toBe(true);
	});

	/**
	 * Readiness must mean the WHOLE subtree, not the outer module.
	 *
	 * Every component is registered as a `defineAsyncComponent`, so a prototype composing
	 * `<StatusBar />` starts loading it only after the outer module renders. Marking the stage
	 * ready when the outer loader resolves satisfies this file's own `> *` selector while every
	 * nested component is still a placeholder — a half-drawn screen captured and exited 0 on,
	 * which is the same defect as the "Pick an entry." capture, one level in.
	 *
	 * Asserted on the source for the reason this file's header gives, and the assertion is the
	 * NEGATIVE one, because that is where the defect was: `open()` may clear `renderedId` and
	 * must never set it to an id. `<Suspense>` is what sets it, on `@resolve`.
	 */
	it('marks the stage ready from Suspense, never from the entry loader', () => {
		const index = readFileSync(path.join(REPO, 'tests', 'harness', 'IndexPage.vue'), 'utf8');
		// The function body ONLY. Sliced to its own closing brace rather than to the next
		// declaration, so that moving a neighbour cannot quietly widen what this reads.
		const start = index.indexOf('async function open');
		const open = index.slice(start, index.indexOf('\n}', start) + 2);

		// Every assignment's RIGHT-HAND SIDE, collected and then required to be `null` — rather
		// than a negative lookahead, which is how the first version of this was WRONG.
		//
		// It read `expect(open).not.toMatch(/renderedId\.value\s*=\s*(?!null)/)`, and that regex
		// MATCHES `renderedId.value = null`: the engine backtracks `\s*` to zero width, the
		// lookahead then sees `" nul"` rather than `"null"`, and succeeds. With `.not.toMatch`
		// around it, the case therefore went RED against a correct file — Task 6 failed on
		// arrival rather than letting a defect through, which is the less dangerous direction and
		// still made the task unrunnable.
		//
		// Measured, both ways, against the committed file: the repaired form passes on the file as
		// it stands, goes red when an `renderedId.value = entry.id` is injected into `open()`, and
		// goes red when the clear is deleted entirely. Enumerating what is assigned has no
		// backtracking trap and names the offending right-hand side when it fails.
		const assigned = [...open.matchAll(/renderedId\.value\s*=\s*([^;\n]+)/g)].map((m) => m[1].trim());

		expect(assigned, 'open() never runs').not.toHaveLength(0);
		expect([...new Set(assigned)], 'open() marks the stage ready before nested components load').toEqual([
			'null',
		]);
		expect(index).toContain('<Suspense');
		expect(index).toContain('@resolve="settle()"');
	});

	/**
	 * A tag that resolves to nothing, and a required prop nobody passed, are Vue's most
	 * invisible failures: a warning, a wrong element in the DOM, and a `<Suspense>` that
	 * resolves perfectly happily. `harness-shot` records console ERRORS and page errors, so
	 * without this the capture succeeds with a hole in it. Both are reachable from the plan's
	 * own tree — two entries of one kind sharing a label, and `EmptyLayer.vue`'s three required
	 * props against a bare `<component :is>`.
	 */
	it('turns an unresolved tag or a missing required prop into a named entry failure', () => {
		const index = readFileSync(path.join(REPO, 'tests', 'harness', 'IndexPage.vue'), 'utf8');

		expect(index).toContain('config.warnHandler');
		// The message ITSELF, with no fragment match in front of it. Pinning the two warning
		// strings is what this assertion used to do, and it was wrong twice over: it went stale
		// the moment the classification was inverted, and while it stood it described the
		// allowlist that let `Invalid prop: type check failed` through. What must be true is
		// that nothing filters — see `renderDefects` in `IndexPage.vue`.
		expect(index).toContain('renderDefects.push(message)');
		// Behaviour, not text, is held by `tests/harness/indexPage.test.ts`, which drives a real
		// missing prop, a real wrong prop and a real unresolved tag through the mounted page.
		// This case exists for the one thing that file cannot say: that the collection is
		// unconditional at the point it is written.
	});

	/**
	 * Two clicks in quick succession leave two `open()` awaits in flight. Without a generation
	 * guard the LAST import to settle wins regardless of which entry the designer chose, so the
	 * stage can draw A while `data-entry` says B — a capture of the wrong component, reported
	 * as a success under the requested name, which is worse than an empty one.
	 */
	it('ignores a stale entry load', () => {
		const index = readFileSync(path.join(REPO, 'tests', 'harness', 'IndexPage.vue'), 'utf8');
		const start = index.indexOf('async function open');
		const open = index.slice(start, index.indexOf('\n}', start) + 2);

		expect(open).toContain('const mine = ++generation');
		// Both arms: a stale RESOLVE must not draw, and a stale REJECT must not overwrite a
		// good entry's screen with the abandoned one's error.
		expect(open.match(/if \(mine !== generation\.value\) return;/g) ?? []).toHaveLength(2);
	});

	/**
	 * The other half of the same race, and it is NOT covered by the generation guards: those
	 * protect `entry.component()`'s await, while `<Suspense>` settles on its own schedule. Entry
	 * A can be on screen with a descendant still pending when a click moves `pendingId` to B;
	 * A's descendant then resolves and, without this, the stage advertises `data-entry="B"` over
	 * A's content — a capture of the wrong component under the requested name.
	 */
	it('unmounts the previous entry before awaiting, and settles only for what is mounted', () => {
		const index = readFileSync(path.join(REPO, 'tests', 'harness', 'IndexPage.vue'), 'utf8');
		const start = index.indexOf('async function open');
		const open = index.slice(start, index.indexOf('\n}', start) + 2);

		// The clear happens BEFORE the await, or the stale subtree stays mounted through it.
		expect(open.indexOf('openComponent.value = null')).toBeGreaterThanOrEqual(0);
		expect(open.indexOf('openComponent.value = null')).toBeLessThan(open.indexOf('await entry.component()'));

		const settleStart = index.indexOf('function settle');
		const settle = index.slice(settleStart, index.indexOf('\n}', settleStart) + 2);

		expect(settle).toContain('mountedGeneration !== generation.value');
	});

	/**
	 * The index's own links have to survive a round trip through the URL, because that is the
	 * path an agent uses: it never clicks, it opens `?entry=` directly. `&` and `#` are legal
	 * in a filename and an id carries the path, so an interpolated link means something other
	 * than the id it names — and the in-page click masks it by passing the object instead.
	 *
	 * **Updated in fix round 6 (Finding F), and the string this pins changed shape.** `hrefFor`
	 * used to build a link from the id ALONE (`new URLSearchParams({ entry: entry.id })`),
	 * which dropped `?theme`/`?phone` — real harness knobs `theme.ts` reads — off every link
	 * and off the address bar `open()` now writes with it (Finding B's `history.replaceState`,
	 * same round). It now clones the CURRENT `window.location.search`, deletes the `index`
	 * routing key and sets `entry`, so a designer's variant survives a click same as an id
	 * with `&`/`#` in it always did. The two assertions below moved with it: the positive pins
	 * the new construction (`URLSearchParams(window.location.search)` plus `.set('entry', …)`)
	 * rather than the old literal object-argument spelling, and the negative is unchanged —
	 * a raw `` `?entry=${ `` interpolation is still the one thing refused either way.
	 */
	it('builds index links with URLSearchParams rather than interpolating the id', () => {
		const index = readFileSync(path.join(REPO, 'tests', 'harness', 'IndexPage.vue'), 'utf8');
		// `hrefFor`'s BODY, sliced the way the case above slices `open()`. Reading the whole file
		// is what the first version did, and it could not work: the comment on `hrefFor` explains
		// the defect by SPELLING the forbidden interpolation, so the negative matched the
		// explanation and the guard was red against correct code. A comment naming a forbidden
		// spelling is not the forbidden spelling.
		//
		// The narrower claim is stated rather than hidden: this covers the one function that
		// builds the link. A second link built elsewhere by interpolation is not seen here.
		const start = index.indexOf('function hrefFor');
		const hrefFor = index.slice(start, index.indexOf('\n}', start) + 2);

		expect(hrefFor).toContain('new URLSearchParams(window.location.search)');
		expect(hrefFor).toContain("params.set('entry', entry.id)");
		expect(hrefFor, 'a raw ?entry= interpolation is back').not.toContain('`?entry=${');
	});

	/**
	 * Ids carry `:` and `/`; Windows filenames cannot. One of the four `npm run check` legs is
	 * Windows, so an unsanitised PNG name is a leg-specific failure nobody would reproduce
	 * locally on Linux or macOS.
	 */
	it('sanitises the entry id for the PNG filename without sanitising the URL', () => {
		const source = readFileSync(SCRIPT, 'utf8');

		expect(source).toMatch(/replace\(\/\[\^a-zA-Z0-9\]\+\/g/);
		expect(source).toContain('encodeURIComponent(entry)');
		// Sanitising alone collapses `a-b/C` and `a/b-C` onto one filename, so the hash is
		// what actually keeps two captures from overwriting each other.
		expect(source).toContain('createHash');
	});

	it('still defines the five fixed shots, so an argumentless run is unchanged', () => {
		const source = readFileSync(SCRIPT, 'utf8');

		for (const name of ['dark', 'light', 'phone', 'plan-editor-dark', 'plan-editor-light']) {
			expect(source).toContain(`name: '${name}'`);
		}
	});

	/**
	 * The fixed shots address the project surface with NO `view` parameter, so
	 * `tests/harness/page.ts` must keep routing a bare URL there. Asserted from this side
	 * because the previous test passes whether or not those URLs still reach anything — a
	 * shot list that exists and times out is the failure it cannot see.
	 */
	it('keeps the three project-view shots on URLs that do not request the index', () => {
		const source = readFileSync(SCRIPT, 'utf8');

		for (const query of ["query: ''", "query: '?theme=light'", "query: '?phone'"]) {
			expect(source).toContain(query);
		}

		const page = readFileSync(path.join(REPO, 'tests', 'harness', 'page.ts'), 'utf8');

		// The index is opt-in. If this ever becomes `!params.has('view')`, all three fixed
		// shots start timing out with nothing else to report it.
		expect(page).toContain("params.has('index')");
	});
});
