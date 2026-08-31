import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from '../helpers/repo';

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
// The wait, the post-screenshot re-check and the failure-card reader, split out of SCRIPT so a
// test can call them (`captureReadiness.test.ts`) — see that file's header.
const READINESS = path.join(REPO, 'scripts', 'captureReadiness.mjs');
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

/** `source` with every `/* … *\/` block comment removed — see the one call site below for why
 * a scan for a forbidden CODE shape needs this rather than reading raw text. */
function withoutCommentary(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

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
	 * This is now a WIRING check, not a behavioural one — what the argument actually does
	 * (selects `entryShots(entry)`, builds the `?entry=` URL, falls back to the fixed shots
	 * with no argument) is asserted by calling `resolveShots` and `entryShots` directly in
	 * `entryShots.test.ts`, which can see the real behaviour. Reading `harness-shot.mjs`'s
	 * source text could only ever confirm it still SAYS the right thing; mutating
	 * `process.argv[2]` to `process.argv[3]` inside `resolveShots` left every case that used
	 * to live here green, which is exactly why that logic moved into an importable module.
	 */
	it('reads the entry argument through the importable resolveShots, not by hard-coding argv itself', () => {
		// STRIPPED, like every negative scan in this file. A wiring pin over raw text is
		// satisfied by a COMMENT carrying the call — including a comment that says the call was
		// removed — which is the exact inversion of what a pin is for. The two pins here read
		// raw source until this round while the negatives below them already read stripped;
		// having both spellings in one file is how the asymmetry survived review.
		const source = withoutCommentary(readFileSync(SCRIPT, 'utf8'));

		expect(source).toContain("from './entryShots.mjs'");
		// `process.env` is the third argument, and it is part of the wiring rather than an
		// incidental: `resolveShots` refuses `npm run harness-shot X --width=460` — the spelling
		// npm claims as its own config and never passes through — by reading `npm_config_width`
		// from it. Dropped here, that command would go back to capturing at the default width
		// and exiting 0.
		expect(source).toContain('resolveShots(process.argv, SHOTS, process.env)');
	});

	/**
	 * The post-screenshot re-check, wired the same way `entryShots`/`resolveShots` are: this
	 * file's own review found the re-check shipped with NO check of any kind — ten source-text
	 * pins covered the rest of this script and this call had none, because
	 * `reportIfNoLongerDrawn` used to be defined at this file's own module scope, which cannot
	 * be imported and called without launching a browser. It now lives in
	 * `scripts/captureReadiness.mjs` for exactly that reason, and `captureReadiness.test.ts`
	 * drives the real function with a fake `page` — what this checks is only that the capture
	 * still calls it, on the real screenshot path, with the real readiness predicate.
	 */
	it('re-checks readiness after the screenshot through the importable reportIfNoLongerDrawn', () => {
		// Stripped, for the reason the case above gives: this one asserts an ORDER between two
		// calls, and a block comment mentioning either would move an index and could satisfy the
		// comparison with one of the calls gone.
		const source = withoutCommentary(readFileSync(SCRIPT, 'utf8'));

		expect(source).toContain("from './captureReadiness.mjs'");
		expect(source).toContain('await page.screenshot(');
		expect(source.indexOf('reportIfNoLongerDrawn(page, entry, name, errors, entryHasDrawn)')).toBeGreaterThan(
			source.indexOf('await page.screenshot('),
		);
	});

	/**
	 * The race, and the skip — both wiring pins, because `captureAll` and the wait's call site
	 * live in a module that runs a real capture the moment it is imported. What each of them
	 * DECIDES is driven directly in `captureReadiness.test.ts`, against the real functions with a
	 * fake `page`; this is only that the capture still reaches them.
	 *
	 * Stripped source, like every other scan here.
	 */
	it('races the failure card and does not attempt a second scheme for an entry the index lacks', () => {
		const source = withoutCommentary(readFileSync(SCRIPT, 'utf8'));

		expect(source).toContain('waitUntilReady(page, selector, entry, entryHasDrawn)');
		expect(source).toContain('kind === UNKNOWN_ENTRY');
		// The wait is the imported one, not a local that shadows it — the defect this replaces
		// was a local `waitUntilReady` awaiting the readiness predicate alone.
		expect(source).not.toMatch(/function\s+waitUntilReady/);
	});

	/**
	 * The assertion that stops a green run from lying. Waiting on `.rp-harness-stage` alone
	 * would photograph the placeholder — a successful, empty PNG, which the actor this
	 * feature exists for cannot tell from a real one.
	 */
	it('waits for the entry to have rendered, not merely for the stage to exist', () => {
		// Stripped, like every other scan in this file — including the POSITIVE pins below. A
		// positive pin over raw source passes when a COMMENT carries the text and the code does
		// not, which is the same vacuity the negative scans strip to avoid; the direction of the
		// assertion does not change the hazard.
		const source = withoutCommentary(readFileSync(SCRIPT, 'utf8'));

		// The predicate ITSELF moved to `captureReadiness.mjs`, where a test can import and drive
		// it — `tests/build/entryDrawn.test.ts` is where what it decides is now settled, in both
		// directions, against a real DOM. It moved because a review found it wrong: a stage
		// holding only Vue's `<!--v-if-->` placeholder passed the old `childNodes.length > 0`,
		// which is the empty PNG at exit 0 this whole pin exists to refuse. A source scan could
		// never have caught that, and had recorded the function as having nothing to prove.
		//
		// What stays HERE is the wiring: the readiness question is asked in the page, with the id
		// compared as a STRING against `dataset.entry` and never interpolated into a CSS
		// attribute selector, because an id is built from a file path and a `"` is a legal
		// filename character on POSIX.
		expect(readFileSync(READINESS, 'utf8')).toContain('stage.dataset.entry');
		// The POLL moved to `captureReadiness.mjs` when the wait became a race against the
		// failure card — the predicate still lives here, and is still asked through
		// `waitForFunction` rather than through a selector. Read from the file that now holds the
		// call, because a pin that keeps naming the old home passes only until someone deletes
		// the call it can no longer see.
		expect(readFileSync(READINESS, 'utf8')).toContain('waitForFunction(hasDrawn, entry)');
		// The capture reaches the predicate at all, which is the half a source scan can still
		// answer for a module nothing may import.
		expect(source).toContain('entryHasDrawn');
		// The bare stage class must not be used as a wait target on its own.
		expect(source).not.toMatch(/selector:\s*['"`]\.rp-harness-stage['"`]/);
		// Two scans of the same class, both over the CODE only, with block comments stripped
		// first (`withoutCommentary`, below): no attribute selector may be built out of an
		// entry id, and the element-only readiness check this file replaced (`firstElementChild`)
		// may not return. The bare substring scan this replaced fires on prose that EXPLAINS the
		// rule as readily as on code that BREAKS it: this file's own review found the
		// `[data-entry=` substring reintroduced not in this script but in the plan document's
		// copy of this very JSDoc block, in a parenthetical added to say the earlier version had
		// been reworded away from it (`docs/superpowers/plans/2026-08-25-harness-prototyping.md`,
		// fixed in the same round this comment was added) — and a second-round review found the
		// sibling `firstElementChild` scan one line above still reading raw text, the same class
		// of gap one line apart. `tests/harness/harness.test.ts` solves the equivalent problem
		// for its own scan by excluding whole FILES whose text documents the pattern; that does
		// not transfer here because the explanation and the code it explains live in the SAME
		// file, so excluding the file would blind the check to the code it exists to watch.
		// Stripping only what documents the rule — its comments — keeps the check on the actual
		// danger (a selector built from an id, an element-only readiness check) while leaving
		// prose free to say anything, including either forbidden shape, without tripping it. Now
		// that both scans read stripped text, `harness-shot.mjs`'s own comment names
		// `firstElementChild` directly rather than working around it — the phrasing contortion
		// existed only because this scan used to read raw source.
		//
		// The narrower claim this leaves standing, stated rather than hidden: `withoutCommentary`
		// strips only `/* … */` block comments. A `//` LINE comment carrying either forbidden
		// substring would still slip through, and this file's own `//` lines are not proof
		// otherwise — `//` is the dominant explanatory form in both files scanned here, not an
		// unused one; the true claim is only that none of those lines currently CARRIES either
		// substring. (Written without a count: an earlier version said 32, and the number went
		// stale the moment the predicate moved between the two files.) Widening the strip to line comments
		// was considered and rejected rather than left as a caveat by omission: a naive
		// `/\/\/.*$/gm` strip would also eat the real code on `startHarnessServer`'s
		// `` return { server, baseUrl: `http://127.0.0.1:${address.port}` }; `` line, since its
		// `//` sits inside a URL literal rather than starting a comment — silently truncating a
		// line this exact check needs to see, which is a worse defect than the caveat it would
		// remove. A correct line-comment strip needs a tokenizer aware of string boundaries; that
		// is a bigger tool than one scan in one test file justifies today.
		// BOTH files, because the predicate moved: the forbidden shapes are a selector built from
		// an entry id and an element-only readiness check, and the code that could grow either
		// now lives in `captureReadiness.mjs` while the capture that calls it stays here. Scanning
		// only this one would leave the check watching the file the danger left.
		const scanned = [
			['harness-shot.mjs', withoutCommentary(source)],
			['captureReadiness.mjs', withoutCommentary(readFileSync(READINESS, 'utf8'))],
		] as const;

		// Reported as the NAMES that offend rather than as two assertions per file: a bare
		// `not.toContain` failure says only that some string was present somewhere, and with two
		// files scanned the first question is which one. (`expect(value, message)` would say it
		// too, and oxlint's `vitest/valid-expect` refuses that form on a negated matcher.)
		expect(scanned.filter(([, text]) => text.includes('firstElementChild')).map(([name]) => name)).toEqual([]);
		expect(scanned.filter(([, text]) => /\[data-entry=/.test(text)).map(([name]) => name)).toEqual([]);

		// `withoutCommentary` must not be kinder than intended — stripping the comments and
		// leaving no code behind would make every scan above vacuously pass. A known code
		// substring has to survive the strip in EACH file: one anchor covering both would leave
		// the other free to be emptied to nothing and still pass.
		expect(scanned[0][1]).toContain('entryHasDrawn');
		expect(scanned[1][1]).toContain('stage.dataset.entry');
	});

	/**
	 * WHICH of the two scheme functions each route calls — a source pin, because `page.ts` runs
	 * its mount the moment it is imported. What the two functions DO is driven in
	 * `tests/harness/harness.test.ts`.
	 *
	 * `&bare` means "a picture of the screen", and the toggle is fixed over the viewport's
	 * bottom-right corner, so a capture that drew it photographed harness furniture on top of
	 * the prototype. The scheme still has to be applied on that route: it is what `?theme=light`
	 * asks for, and dropping the whole call would have made every light capture dark.
	 */
	it('skips the harness furniture on a bare capture, and still applies the scheme', () => {
		const source = withoutCommentary(readFileSync(path.join(REPO, 'tests', 'harness', 'page.ts'), 'utf8'));

		expect(source).toContain("has('bare')");
		expect(source).toContain('applyWantedScheme()');
		expect(source).toContain('drawSchemeToggle()');
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
	 *
	 * `page.ts` does a FOURTH that production does not, and it is pinned by the case below this
	 * one — added after "two of three named" turned out to be how the missing one stayed
	 * invisible.
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
		const page = readFileSync(path.join(REPO, 'tests', 'harness', 'page.ts'), 'utf8');
		const testConfig = readFileSync(path.join(REPO, 'tests', 'harness', 'indexApp.ts'), 'utf8');

		for (const source of [page, testConfig]) {
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
	 *
	 * The sanitising itself moved to `scripts/entryShots.mjs` and is asserted BEHAVIOURALLY
	 * there (`entryShots.test.ts`, driving real ids including `:` and `/` through the actual
	 * function). What is left to check from this side is only that `harness-shot.mjs` still
	 * gets its shots from that module rather than sanitising anything itself.
	 */
	it('sanitises the entry id for the PNG filename through entryShots, not by re-deriving it here', () => {
		const source = readFileSync(SCRIPT, 'utf8');

		expect(source).toContain("from './entryShots.mjs'");
		expect(source).not.toContain('createHash');
	});

	it('still defines the ten fixed shots, so an argumentless run is unchanged', () => {
		const source = readFileSync(SCRIPT, 'utf8');

		for (const name of [
			'dark',
			'light',
			'phone',
			'plan-editor-dark',
			'plan-editor-light',
			'index-dark',
			'index-light',
			'index-focus',
			'index-focus-current',
			'index-failure',
		]) {
			expect(source).toContain(`name: '${name}'`);
		}
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
		const source = readFileSync(SCRIPT, 'utf8');

		for (const query of ["query: '?index'", "query: '?index&theme=light'"]) {
			expect(source).toContain(query);
		}
	});

	/**
	 * A STATE nothing navigates to is a state no picture holds, which is what the first version
	 * of the index shots got wrong: they took the resting picker twice and named four defects as
	 * the reason, while `?index` renders neither a focus ring (nothing has been tabbed to) nor a
	 * failure card (nothing has failed). Deleting either rule left both PNGs identical.
	 *
	 * So the two states each need their own SETUP, and this pins that the setup is still there:
	 * a `focus` selector on one shot, and a query naming an id no entry can have on the other.
	 * Source-text assertions because `SHOTS` runs at module scope behind a browser — the same
	 * bargain every case in this block makes — and the behaviour under them is `focusForShot`'s,
	 * which is asserted directly below.
	 */
	it('gives the focus ring and the failure card a shot that actually renders them', () => {
		const source = readFileSync(SCRIPT, 'utf8');

		expect(source).toContain("name: 'index-focus'");
		expect(source).toMatch(/name: 'index-focus'[^}]*focus:/);
		expect(source).toContain("name: 'index-failure'");
		expect(source).toMatch(/name: 'index-failure'[^}]*query: '\?entry=no-such-entry/);
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
	 * A source-text assertion, like its siblings above, and it pins the SCHEME only. That a given
	 * scheme is the weaker one is a browser measurement no gate here can make — jsdom resolves no
	 * `var()` to a colour — so what this can hold is that the choice was made deliberately and has
	 * not silently flipped back.
	 */
	it('takes each index state in the scheme its own contrast is weakest in', () => {
		const source = readFileSync(SCRIPT, 'utf8');

		expect(source).toMatch(/name: 'index-focus'[^}]*theme=light/);
		expect(source).toMatch(/name: 'index-failure'[^}]*theme=light/);
	});

	/**
	 * `page.focus()` would leave the element focused and the ring UNDRAWN — `:focus-visible` is a
	 * keyboard heuristic, so a programmatic focus produces a screenshot identical to the resting
	 * one. That is the failure mode this whole addition exists to avoid, and it is invisible in
	 * the PNG, so it is pinned here instead.
	 */
	it('reaches the focus target with the keyboard rather than programmatically', () => {
		// STRIPPED, like every negative scan in this file — and this one proves the convention
		// rather than merely following it: `focusForShot`'s own comment NAMES `page.focus(` to say
		// why it is refused, so the raw-text version of this assertion failed on the sentence
		// explaining the rule it was checking.
		const source = withoutCommentary(readFileSync(SCRIPT, 'utf8'));

		expect(source).toContain("keyboard.press('Tab')");
		expect(source).not.toContain('page.focus(');
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
