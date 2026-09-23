import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { REPO } from '../helpers/repo';
import { assignedTo, callsOf, descendants, expressionsOf, functionNamed, importsOf, namesIdentifier, parseScript, stringsOf } from '../helpers/parsedSource';
import {
	CHROMIUM_FILES,
	INDEX_PAGE,
	PAGE,
	RESOLVER,
	indexPage,
	namedEntries,
	page,
	pkg,
	readiness,
	script,
	selectorsAnywhere,
	shot,
	shots,
} from '../helpers/harnessShotFixtures';

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
 *
 * **Every pin over that script is a PARSED read** (`tests/helpers/parsedSource.ts`): the `SHOTS`
 * table by shot name with its fields evaluated through the script's own constants, a call and
 * its arguments, an import, an identifier. `SHOTS` is not exported and the script captures at
 * module scope, so importing it is not an option; the parser is the next authority. The
 * `toMatch(/name: 'x'[^}]*width: 460/)` pins this replaced read the text, and every one of them
 * had a way to be wrong that a node cannot: a `[^}]*` class stopped at the first brace of a
 * template interpolation (measured, the asset-library case failed on exactly that), a `//` line
 * above an entry fell inside the previous entry's slice, and a comment quoting a field satisfied
 * a positive pin — which is why two functions here stripped comments with a regex before the
 * regex that pinned. Reading the tree, a comment is not a node and a property is a property
 * wherever the line breaks.
 *
 * **The parsed fixtures (both scripts, `page.ts`, `IndexPage.vue`, the `SHOTS` reader) live in
 * `tests/helpers/harnessShotFixtures.ts` now, shared with `harnessShotItemMode.test.ts`** — the
 * item-mode and Add-to-asset-library shots this file's own line budget could not hold beside
 * everything else once that group arrived. The both-directions census below stays HERE, whole,
 * because it counts the whole `SHOTS` table rather than one group of it.
 */

describe('the headless harness capture script', () => {
	it('is wired as an npm script pointing at a file that exists', () => {
		const command = pkg.scripts['harness-shot'];

		expect(command).toBeDefined();

		// `node scripts/harness-shot.mjs` — resolved against the repository root the same
		// way every script here resolves its own paths, not against this test file's
		// location.
		const [runtime, named] = command.trim().split(' ');

		expect(runtime).toBe('node');
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
		const resolver = parseScript(RESOLVER);

		expect(callsOf(resolver.file, resolver, 'chromium.executablePath')).not.toHaveLength(0);
	});

	it('resolves the browser through that one shared module rather than resolving its own', () => {
		expect(importsOf(script)).toContain('./chromium.mjs');
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
	 * This is now a WIRING check, not a behavioural one — what the argument actually does
	 * (selects `entryShots(entry)`, builds the `?entry=` URL, falls back to the fixed shots
	 * with no argument) is asserted by calling `resolveShots` and `entryShots` directly in
	 * `entryShots.test.ts`, which can see the real behaviour. Reading `harness-shot.mjs`'s
	 * source could only ever confirm it still SAYS the right thing; mutating
	 * `process.argv[2]` to `process.argv[3]` inside `resolveShots` left every case that used
	 * to live here green, which is exactly why that logic moved into an importable module.
	 */
	it('reads the entry argument through the importable resolveShots, not by hard-coding argv itself', () => {
		expect(importsOf(script)).toContain('./entryShots.mjs');
		// `process.env` is the third argument, and it is part of the wiring rather than an
		// incidental: `resolveShots` refuses `npm run harness-shot X --width=460` — the spelling
		// npm claims as its own config and never passes through — by reading `npm_config_width`
		// from it. Dropped here, that command would go back to capturing at the default width
		// and exiting 0.
		expect(callsOf(script.file, script, 'resolveShots').map((call) => call.args)).toEqual([['process.argv', 'SHOTS', 'process.env']]);
	});

	/**
	 * The post-screenshot re-check, wired the same way `entryShots`/`resolveShots` are: this
	 * file's own review found the re-check shipped with NO check of any kind — ten source-text
	 * pins covered the rest of this script and this call had none, because
	 * `reportIfNoLongerDrawn` used to be defined at this file's own module scope, which cannot
	 * be imported and called without launching a browser. It now lives in
	 * `scripts/captureReadiness.mjs` for exactly that reason, and `captureReadiness.test.ts`
	 * drives the real function with a fake `page` — what this checks is only that the capture
	 * still calls it, on the real screenshot path, with the real readiness predicate, AFTER the
	 * screenshot: an ORDER between two calls, which is why each is located rather than merely found.
	 */
	it('re-checks readiness after the screenshot through the importable reportIfNoLongerDrawn', () => {
		expect(importsOf(script)).toContain('./captureReadiness.mjs');
		const [screenshot] = callsOf(script.file, script, 'page.screenshot');
		const [recheck] = callsOf(script.file, script, 'reportIfNoLongerDrawn');

		expect(screenshot).toBeDefined();
		expect(recheck?.args).toEqual(['page', 'entry', 'name', 'errors', 'entryHasDrawn']);
		expect(recheck?.at).toBeGreaterThan(screenshot.at);
	});

	/**
	 * The race, and the skip — both wiring pins, because `captureAll` and the wait's call site
	 * live in a module that runs a real capture the moment it is imported. What each of them
	 * DECIDES is driven directly in `captureReadiness.test.ts`, against the real functions with a
	 * fake `page`; this is only that the capture still reaches them.
	 */
	it('races the failure card and does not attempt a second scheme for an entry the index lacks', () => {
		expect(callsOf(script.file, script, 'waitUntilReady').map((call) => call.args)).toEqual([['page', 'selector', 'entry', 'entryHasDrawn']]);
		expect(expressionsOf(script.file, script)).toContain('kind === UNKNOWN_ENTRY');
		// The wait is the imported one, not a local that shadows it — the defect this replaces
		// was a local `waitUntilReady` awaiting the readiness predicate alone.
		expect(functionNamed(script, 'waitUntilReady')).toBeUndefined();
		expect(descendants(script.file, ts.isVariableDeclaration).some((node) => node.name.getText(script.file) === 'waitUntilReady')).toBe(false);
	});

	/**
	 * The assertion that stops a green run from lying. Waiting on `.rp-harness-stage` alone
	 * would photograph the placeholder — a successful, empty PNG, which the actor this
	 * feature exists for cannot tell from a real one.
	 *
	 * The predicate ITSELF moved to `captureReadiness.mjs`, where a test can import and drive
	 * it — `tests/gates/entryDrawn.test.ts` is where what it decides is now settled, in both
	 * directions, against a real DOM. It moved because a review found it wrong: a stage
	 * holding only Vue's `<!--v-if-->` placeholder passed the old `childNodes.length > 0`,
	 * which is the empty PNG at exit 0 this whole pin exists to refuse. A source scan could
	 * never have caught that, and had recorded the function as having nothing to prove.
	 *
	 * What stays HERE is the wiring: the readiness question is asked in the page, with the id
	 * compared as a STRING against `dataset.entry` and never interpolated into a CSS attribute
	 * selector, because an id is built from a file path and a `"` is a legal filename character
	 * on POSIX. The two forbidden shapes — a selector built from an entry id, and the
	 * element-only readiness check this file replaced (`firstElementChild`) — are asked of the
	 * STRINGS and IDENTIFIERS of both files, since the predicate moved and the capture that calls
	 * it stayed; a comment is neither, so prose may spell either shape to explain the rule (this
	 * file's own review once found `[data-entry=` reintroduced in a plan document's copy of this
	 * very docblock, and the text scan of the day fired on it).
	 */
	it('waits for the entry to have rendered, not merely for the stage to exist', () => {
		expect(expressionsOf(readiness.file, readiness)).toContain('stage.dataset.entry');
		// The POLL lives in `captureReadiness.mjs` — still asked through `waitForFunction` rather
		// than through a selector — and the capture reaches the predicate at all.
		expect(callsOf(readiness.file, readiness, 'page.waitForFunction').map((call) => call.args)).toContainEqual(['hasDrawn', 'entry']);
		expect(namesIdentifier(script.file, 'entryHasDrawn')).toBe(true);
		// The bare stage class must not be used as a wait target on its own — anywhere in the
		// script, not only inside `SHOTS`: a second table would be as wrong as the first.
		expect(selectorsAnywhere().filter((value) => value === '.rp-harness-stage' || (Array.isArray(value) && value.includes('.rp-harness-stage')))).toEqual([]);

		const scanned = [
			['harness-shot.mjs', script],
			['captureReadiness.mjs', readiness],
		] as const;

		// Reported as the NAMES that offend rather than as two assertions per file: with two files
		// scanned the first question on a failure is which one.
		expect(scanned.filter(([, parsed]) => namesIdentifier(parsed.file, 'firstElementChild')).map(([name]) => name)).toEqual([]);
		expect(scanned.filter(([, parsed]) => stringsOf(parsed.file).some((text) => text.includes('[data-entry='))).map(([name]) => name)).toEqual([]);
	});

	/**
	 * WHICH of the two scheme functions each route calls — a parsed pin, because `page.ts` runs
	 * its mount the moment it is imported. What the two functions DO is driven in
	 * `tests/harness/harness.test.ts`.
	 *
	 * `&bare` means "a picture of the screen", and the toggle is fixed over the viewport's
	 * bottom-right corner, so a capture that drew it photographed harness furniture on top of
	 * the prototype. The scheme still has to be applied on that route: it is what `?theme=light`
	 * asks for, and dropping the whole call would have made every light capture dark.
	 */
	it('skips the harness furniture on a bare capture, and still applies the scheme', () => {
		expect(callsOf(page.file, page, 'has').map((call) => call.args)).toContainEqual(["'bare'"]);
		expect(callsOf(page.file, page, 'applyWantedScheme')).not.toHaveLength(0);
		expect(callsOf(page.file, page, 'drawSchemeToggle')).not.toHaveLength(0);
	});

	/**
	 * The index app must install everything the production mount does, or a canvas component
	 * renders nothing while every gate stays green — Vue warns rather than throws on an
	 * unresolved component, and the outer element still satisfies the shot selector.
	 */
	it('installs VueKonva on the index app, as the production mount does', () => {
		const pageText = readFileSync(PAGE, 'utf8');
		const production = readFileSync(
			path.join(REPO, 'src', 'presentation', 'views', 'PlanEditorView.ts'),
			'utf8',
		);

		// Read from production rather than hard-coded: if the plugin ever installs something
		// else, this asks the question again instead of pinning today's answer.
		expect(production).toContain('app.use(VueKonva)');
		expect(pageText).toContain('.use(VueKonva)');
	});

	/**
	 * The production mount does THREE things — Pinia, VueKonva and `provide(PLAN_EDITOR_CONTEXT)`.
	 * The third has no `use()` to make it visible in a diff, which is why it was the one
	 * missed, and why it gets its own assertion rather than being folded into the one above.
	 *
	 * `page.ts` does a FOURTH that production does not, and it is pinned by the case below this
	 * one — added after "two of three named" turned out to be how the missing one stayed
	 * invisible.
	 */
	it('provides PLAN_EDITOR_CONTEXT on the index app, as the production mount does', () => {
		const pageText = readFileSync(PAGE, 'utf8');
		const production = readFileSync(
			path.join(REPO, 'src', 'presentation', 'views', 'PlanEditorView.ts'),
			'utf8',
		);

		expect(production).toContain('app.provide(PLAN_EDITOR_CONTEXT');
		expect(pageText).toContain('provide(PLAN_EDITOR_CONTEXT');
	});

	/**
	 * `page.ts`'s FOURTH step, and the one with no production twin to read it from — production
	 * mounts one known view, while the index mounts whatever the tree holds, so the global
	 * component registry is the index's own. Two of the three steps above were pinned by name
	 * for forty-three review rounds and this one was pinned by nothing, which is exactly how a
	 * mirror of `page.ts` came to be missing it: `indexPage.test.ts`'s `openIndex` claimed to
	 * mirror this file and installed three of four, so the feature's headline workflow — a
	 * template-only mock resolving `<StatusBar />`, which it cannot import — was exercised by no
	 * test, and the next prototype that composed anything turned `npm run check` red against
	 * correct work.
	 *
	 * So this pins BOTH ends: `page.ts` registers what `registrableComponents` returns, and
	 * `indexApp.ts` — the config every mounted test of the index now takes — calls the same
	 * function over the same two entry kinds. A source scan rather than a behavioural check
	 * because `page.ts` runs its mount at module scope; what the registry DOES once installed is
	 * held behaviourally by `tests/harness/indexRealEntries.test.ts`.
	 *
	 * The registration LOOP is no longer in either file: both call `registerEntries` in
	 * `entries.ts`, which is what makes its refusal of a tag a plugin already holds reachable
	 * from a test at all (`entries.test.ts`, against a real app with VueKonva installed). So the
	 * pin follows it — the two files are checked for the shared call, and the one place
	 * `defineAsyncComponent` now lives is checked for it.
	 */
	it('registers every discovered component and mock on the index app, and mirrors that in tests', () => {
		const pageText = readFileSync(PAGE, 'utf8');
		const testConfig = readFileSync(path.join(REPO, 'tests', 'harness', 'indexApp.ts'), 'utf8');

		for (const source of [pageText, testConfig]) {
			expect(source).toContain('registrableComponents([');
			expect(source).toContain('...componentEntries()');
			expect(source).toContain('...prototypeEntries()');
			expect(source).toContain('registerEntries(app, byTag)');
		}

		// The async wrapper, in the one module that now applies it — resolving components here
		// instead would settle a mounted subtree a tick earlier than the browser does.
		expect(readFileSync(path.join(REPO, 'tests', 'harness', 'entries.ts'), 'utf8')).toContain(
			'defineAsyncComponent(',
		);
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
		const branch = descendants(page.file, ts.isIfStatement).find((node) => node.expression.getText(page.file) === 'wantsIndex')?.thenStatement;

		expect(branch, 'page.ts has no `if (wantsIndex)` branch').toBeDefined();
		const [install] = callsOf(branch ?? page.file, page, 'installObsidianDom');
		const uses = ['empty', 'createDiv', 'createEl'].flatMap((extension) => callsOf(branch ?? page.file, page, extension));
		const firstUse = Math.min(...uses.map((call) => call.at));

		expect(install, 'the index branch never installs the shim').toBeDefined();
		// Written to avoid a CONDITIONAL expect (oxlint's `vitest/no-conditional-expect`, which
		// `npm run check` fails on with zero tolerance), and `linterOptions.noInlineConfig` rules
		// out a suppression. Same claim either way — if no extension use is found in the branch,
		// the ordering holds vacuously (`Math.min()` of nothing is `Infinity`).
		expect((install?.at ?? Infinity) < firstUse, 'the shim installs before the first Obsidian DOM extension use').toBe(true);
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
	 * Asserted on the parsed script for the reason this file's header gives, and the assertion
	 * is the NEGATIVE one, because that is where the defect was: `open()` may clear `renderedId`
	 * and must never set it to an id. `<Suspense>` is what sets it, on `@resolve`. Every
	 * assignment's RIGHT-HAND SIDE is collected and then required to be `null` — the first
	 * version was a negative-lookahead regex that matched `renderedId.value = null` after
	 * backtracking, and went red against a correct file. Measured both ways against the
	 * committed file: this form passes as it stands, goes red when a `renderedId.value =
	 * entry.id` is injected into `open()`, and goes red when the clear is deleted entirely.
	 */
	it('marks the stage ready from Suspense, never from the entry loader', () => {
		const open = functionNamed(indexPage, 'open');

		expect(open, 'IndexPage.vue declares no open()').toBeDefined();
		const assigned = assignedTo(open ?? indexPage.file, indexPage, 'renderedId.value');

		expect(assigned, 'open() never clears renderedId').not.toHaveLength(0);
		expect([...new Set(assigned)], 'open() marks the stage ready before nested components load').toEqual([
			'null',
		]);
		const template = readFileSync(INDEX_PAGE, 'utf8');

		expect(template).toContain('<Suspense');
		expect(template).toContain('@resolve="settle()"');
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
		const index = readFileSync(INDEX_PAGE, 'utf8');

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
		const open = functionNamed(indexPage, 'open') ?? indexPage.file;
		const mine = descendants(open, ts.isVariableDeclaration).find((node) => node.name.getText(indexPage.file) === 'mine');

		expect(mine?.initializer?.getText(indexPage.file)).toBe('++generation.value');
		// Both arms: a stale RESOLVE must not draw, and a stale REJECT must not overwrite a
		// good entry's screen with the abandoned one's error.
		const guards = descendants(open, ts.isIfStatement).filter(
			(node) => node.expression.getText(indexPage.file) === 'mine !== generation.value' && ts.isReturnStatement(node.thenStatement),
		);

		expect(guards).toHaveLength(2);
	});

	/**
	 * The other half of the same race, and it is NOT covered by the generation guards: those
	 * protect `entry.component()`'s await, while `<Suspense>` settles on its own schedule. Entry
	 * A can be on screen with a descendant still pending when a click moves `pendingId` to B;
	 * A's descendant then resolves and, without this, the stage advertises `data-entry="B"` over
	 * A's content — a capture of the wrong component under the requested name.
	 */
	it('unmounts the previous entry before awaiting, and settles only for what is mounted', () => {
		const open = functionNamed(indexPage, 'open') ?? indexPage.file;
		// The clear happens BEFORE the await, or the stale subtree stays mounted through it.
		const clear = descendants(open, ts.isBinaryExpression).find((node) => node.getText(indexPage.file) === 'openComponent.value = null');
		const load = descendants(open, ts.isAwaitExpression).find((node) => node.getText(indexPage.file) === 'await entry.component()');

		expect(clear).toBeDefined();
		expect(load).toBeDefined();
		expect(clear?.getStart(indexPage.file)).toBeLessThan(load?.getStart(indexPage.file) ?? -1);

		const settle = functionNamed(indexPage, 'settle') ?? indexPage.file;

		expect(expressionsOf(settle, indexPage)).toContain('mountedGeneration !== generation.value');
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
	 * with `&`/`#` in it always did. The positive pins the construction and the negative is
	 * unchanged — a raw `` `?entry=${ `` interpolation is the one thing refused either way.
	 *
	 * Asked of `hrefFor`'s own body: the comment on it explains the defect by SPELLING the
	 * forbidden interpolation, which is why the first version, over the whole file's text, was
	 * red against correct code. The narrower claim is stated rather than hidden: this covers the
	 * one function that builds the link. A second link built elsewhere by interpolation is not
	 * seen here.
	 */
	it('builds index links with URLSearchParams rather than interpolating the id', () => {
		const hrefFor = functionNamed(indexPage, 'hrefFor');

		expect(hrefFor, 'IndexPage.vue declares no hrefFor()').toBeDefined();
		const body = hrefFor ?? indexPage.file;

		expect(expressionsOf(body, indexPage)).toContain('new URLSearchParams(window.location.search)');
		expect(callsOf(body, indexPage, 'params.set').map((call) => call.args)).toContainEqual(["'entry'", 'entry.id']);
		expect(stringsOf(body).filter((text) => text.includes('?entry=')), 'a raw ?entry= interpolation is back').toEqual([]);
	});

	/**
	 * Ids carry `:` and `/`; Windows filenames cannot. One of the four `npm run check` legs is
	 * Windows, so an unsanitised PNG name is a leg-specific failure nobody would reproduce
	 * locally on Linux or macOS.
	 *
	 * The sanitising itself moved to `scripts/entryShots.mjs` and is asserted BEHAVIOURALLY
	 * there (`entryShots.test.ts`, driving real ids including `:` and `/` through the actual
	 * function). What is left to check from this side is only that `harness-shot.mjs` still
	 * gets its shots from that module rather than sanitising anything itself.
	 */
	it('sanitises the entry id for the PNG filename through entryShots, not by re-deriving it here', () => {
		expect(importsOf(script)).toContain('./entryShots.mjs');
		expect(namesIdentifier(script.file, 'createHash')).toBe(false);
	});

	/**
	 * **NO NUMBER IN THE NAME, BOTH DIRECTIONS, AND TWO INSTRUMENTS.** Every clause of that was
	 * paid for separately, and the last two came from opposite sides of one merge.
	 *
	 * This case was *the fifteen fixed shots* against seventeen entries on one branch and
	 * *the eighteen* against twenty on the other; each was internally consistent, because a
	 * hand-written list cannot notice a name that was never in it. Both branches independently
	 * replaced it with a DERIVATION from the `SHOTS` source, and neither branch's derived list
	 * described the merged array: each had appended to a different part of it, so
	 * `harness-shot.mjs` merged cleanly while the assertion about it conflicted. The list below
	 * was re-derived from the array at each merge, not resolved from either side.
	 *
	 * **It has happened a THIRD time, which is what makes it the shape rather than an
	 * incident.** The Add Room branch appended `plan-editor-add-room` and its narrow sibling to
	 * the plan-editor run of the array while `main` appended the asset-library and Home shots
	 * elsewhere in it, so `harness-shot.mjs` merged cleanly again and this assertion conflicted
	 * again — the same two-branches-two-regions collision the paragraph above describes, one
	 * merge later. Re-derived rather than resolved, for the third time. No count is quoted here
	 * for that reason: the case's own name carries none, the assertion below is a derivation,
	 * and `grep -c "name: '" scripts/harness-shot.mjs` is what answers the question at the
	 * moment somebody asks it.
	 *
	 * **Why a set comparison and not a loop.** `for (name of […]) expect(…).toContain(…)`
	 * proves *at least these*, so a shot added to `SHOTS` and not listed here stays green —
	 * which is exactly how `project-detail-prices` landed unpinned. Measured rather than argued:
	 * appending `{ name: 'zzz-unlisted', query: '?index', selector: HARNESS_INDEX }` to `SHOTS`
	 * left this file entirely green under the `toContain` form and reddens here.
	 *
	 * **Why a WHOLE-FILE count beside it**, which asks a question the table cannot: the table
	 * sees only inside `SHOTS`, so an entry written outside that array — a second array, or one
	 * moved out — is invisible to it. Both are parsed reads, so a `name: '…'` written inside a
	 * docblock — including one INSIDE that array — cannot join either census; an instrument
	 * that starts counting prose is the shape this block has paid for twice.
	 */
	it('defines exactly the fixed shots this file lists, in both directions', () => {
		const declared = [...shots.keys()];

		expect(declared.toSorted()).toEqual([
			'asset-designer-dark',
			'asset-designer-draw-circle',
			'asset-designer-draw-rect',
			'asset-designer-draw-rect-light',
			'asset-designer-draw-trace-detail',
			'asset-designer-grid',
			'asset-designer-grid-light',
			'asset-designer-light',
			'asset-designer-narrow',
			'asset-designer-pending',
			'asset-designer-pending-anchor-light',
			'asset-designer-preset-curved-table',
			'asset-designer-preset-sofa',
			'asset-designer-preset-toilet',
			'asset-designer-preset-tree',
			'asset-designer-select-anchor',
			'asset-designer-select-anchor-light',
			'asset-designer-select-bend',
			'asset-designer-select-bend-dark',
			'asset-designer-select-clearance',
			'asset-designer-select-clearance-light',
			'asset-designer-select-facing',
			'asset-designer-select-facing-light',
			'asset-designer-select-footprint',
			'asset-designer-select-footprint-light',
			'asset-designer-select-narrow',
			'asset-designer-select-narrow-de',
			'asset-designer-select-points',
			'asset-designer-select-points-light',
			'asset-designer-select-transform',
			'asset-designer-select-transform-light',
			'asset-designer-select-transform-unframed',
			'asset-designer-view-menu-narrow',
			'asset-library-actions',
			'asset-library-dark',
			'asset-library-light',
			'asset-library-middle',
			'asset-library-narrow',
			'asset-library-narrow-selected',
			'asset-library-phone',
			'asset-library-selected',
			'dark',
			'home-filter-focus',
			'home-narrow-360',
			'home-no-match-narrow',
			'home-stress',
			'home-stress-de',
			'home-stress-light',
			'home-stress-narrow',
			'home-whole',
			'index-dark',
			'index-failure',
			'index-focus',
			'index-focus-current',
			'index-light',
			'light',
			'phone',
			'plan-editor-add-menu',
			'plan-editor-add-room',
			'plan-editor-add-room-narrow',
			'plan-editor-area-constrained-de',
			'plan-editor-area-dark',
			'plan-editor-area-light',
			'plan-editor-assets',
			'plan-editor-assets-dark',
			'plan-editor-assets-narrow',
			'plan-editor-canvas-floor',
			'plan-editor-colors',
			'plan-editor-colors-dark',
			'plan-editor-colors-narrow',
			'plan-editor-dark',
			'plan-editor-detail',
			'plan-editor-detail-dark',
			'plan-editor-detail-narrow-de',
			'plan-editor-drafting',
			'plan-editor-drafting-dark',
			'plan-editor-drafting-narrow',
			'plan-editor-item-drag', 'plan-editor-item-drag-dark',
			'plan-editor-item-promote', 'plan-editor-item-promote-dark', 'plan-editor-item-promote-narrow',
			'plan-editor-item-rectangle', 'plan-editor-item-rectangle-dark', 'plan-editor-item-rectangle-narrow',
			'plan-editor-item-saved',
			'plan-editor-light',
			'plan-editor-locked',
			'plan-editor-locked-dark',
			'plan-editor-multiple',
			'plan-editor-multiple-dark',
			'plan-editor-multiple-narrow',
			'plan-editor-narrow',
			'plan-editor-narrow-de',
			'plan-editor-outline',
			'plan-editor-outline-dark',
			'plan-editor-outline-narrow',
			'plan-editor-panels-collapsed',
			'plan-editor-panels-collapsed-dark',
			'plan-editor-selected',
			'plan-editor-selected-dark',
			'plan-editor-selected-narrow',
			'plan-editor-stale',
			'plan-editor-stale-narrow',
			'plan-editor-structural',
			'plan-editor-structural-dark',
			'plan-editor-structural-narrow',
			'plan-editor-tree-dark',
			'plan-editor-tree-light',
			'plan-editor-tree-narrow',
			'plan-editor-tree-narrow-light',
			'plan-editor-unreadable',
			'plan-editor-unreadable-narrow',
			'plan-editor-unsupported',
			'project-detail',
			'project-detail-narrow',
			'project-detail-narrow-360',
			'project-detail-new',
			'project-detail-prices',
			'project-detail-prices-narrow',
			'project-detail-prices-narrow-360',
			'project-detail-recovery',
			'project-detail-recovery-light',
			'project-detail-recovery-narrow',
			'project-detail-unreadable',
			'project-detail-unreadable-narrow',
			'project-schedule-unreadable',
			'project-schedule-unreadable-narrow',
		]);

		// The whole FILE, not the table — see the header. A shot entry written outside `SHOTS`
		// is invisible to the table above and fails here instead.
		expect(namedEntries(script)).toBe(declared.length);
	});

	/**
	 * The fixed shots address the project surface with NO `view` parameter, so
	 * `tests/harness/page.ts` must keep routing a bare URL there. Asserted from this side
	 * because the previous test passes whether or not those URLs still reach anything — a
	 * shot list that exists and times out is the failure it cannot see.
	 */
	it('keeps the three project-view shots on URLs that do not request the index', () => {
		expect(shot('dark').query).toBe('');
		expect(shot('light').query).toBe('?theme=light');
		expect(shot('phone').query).toBe('?phone');

		// The index is opt-in. If this ever becomes `!params.has('view')`, all three fixed
		// shots start timing out with nothing else to report it.
		expect(callsOf(page.file, page, 'has').map((call) => call.args)).toContainEqual(["'index'"]);
	});
});
