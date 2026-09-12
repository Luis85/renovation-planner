import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { REPO } from '../helpers/repo';
import {
	assignedTo,
	callsOf,
	constantsOf,
	descendants,
	evaluate,
	expressionsOf,
	functionNamed,
	importsOf,
	namesIdentifier,
	parseScript,
	stringsOf,
	type Literal,
	type ParsedScript,
} from '../helpers/parsedSource';

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
const PAGE = path.join(REPO, 'tests', 'harness', 'page.ts');
const INDEX_PAGE = path.join(REPO, 'tests', 'harness', 'IndexPage.vue');

const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as {
	scripts: Record<string, string>;
	devDependencies: Record<string, string>;
};

const script = parseScript(SCRIPT);
const readiness = parseScript(READINESS);
const page = parseScript(PAGE);
const indexPage = parseScript(INDEX_PAGE);
const constants = constantsOf(script);

/** One entry of the `SHOTS` table: its fields evaluated, and the identifiers each field's initializer names. */
interface Shot {
	readonly fields: Record<string, Literal>;
	readonly names: Record<string, string[]>;
}

/**
 * The script's `SHOTS` table, by shot name: every object literal in the array initializer of
 * the `SHOTS` declaration, each field evaluated through the script's top-level constants
 * (`selector: FLOOR_STATE` reads as the class it names, a template interpolating
 * `LIBRARY_SELECTED_ASSET` reads as the query it produces, a list as a list). A field whose value
 * is not a literal is left out, so an assertion about it fails on absence rather than on a stale
 * spelling. `names` keeps which constants a field was spelled THROUGH, for the pins whose point is
 * that a selector is the shared constant rather than a second copy of its text.
 */
function shotTable(): Map<string, Shot> {
	const declaration = descendants(script.file, ts.isVariableDeclaration).find((node) => ts.isIdentifier(node.name) && node.name.text === 'SHOTS');
	const table = new Map<string, Shot>();
	if (declaration?.initializer !== undefined && ts.isArrayLiteralExpression(declaration.initializer)) {
		for (const element of declaration.initializer.elements) {
			if (!ts.isObjectLiteralExpression(element)) continue;
			const fields: Record<string, Literal> = {};
			const names: Record<string, string[]> = {};
			for (const property of element.properties) {
				if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) continue;
				const value = evaluate(property.initializer, constants);
				if (value !== null) fields[property.name.text] = value;
				names[property.name.text] = descendants(property.initializer, ts.isIdentifier).map((identifier) => identifier.text);
			}
			const { name, ...rest } = fields;
			if (typeof name === 'string') table.set(name, { fields: rest, names });
		}
	}
	expect(table.size, 'the SHOTS table parsed to nothing').toBeGreaterThan(0);
	return table;
}

const shots = shotTable();

/** One shot's evaluated fields; a name the table lacks fails here rather than as a property of `undefined`. */
function shot(name: string): Record<string, Literal> {
	const found = shots.get(name);
	if (found === undefined) throw new Error(`no shot named ${name}`);
	return found.fields;
}

/** The constants a shot's field was spelled through. */
const namesIn = (name: string, field: string): string[] => shots.get(name)?.names[field] ?? [];

/** A shot's query, as the harness reads it (`page.ts`: `new URLSearchParams(window.location.search)`). */
const query = (name: string): URLSearchParams => new URLSearchParams(String(shot(name).query));

/** Every property named `name` with a string value, anywhere in the script — a shot entry written OUTSIDE `SHOTS` shows up here. */
const namedEntries = (parsed: ParsedScript): number =>
	descendants(parsed.file, ts.isPropertyAssignment).filter((property) => property.name.getText(parsed.file) === 'name' && ts.isStringLiteralLike(property.initializer)).length;

const isIdCharacter = (character: string): boolean => (character >= 'a' && character <= 'z') || (character >= '0' && character <= '9') || character === '-';

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
	 * it — `tests/build/entryDrawn.test.ts` is where what it decides is now settled, in both
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
		// The bare stage class must not be used as a wait target on its own.
		expect([...shots.values()].filter(({ fields }) => fields.selector === '.rp-harness-stage')).toEqual([]);

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
			'asset-designer-light',
			'asset-designer-narrow',
			'asset-library-actions',
			'asset-library-dark',
			'asset-library-light',
			'asset-library-middle',
			'asset-library-narrow',
			'asset-library-narrow-selected',
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
			'plan-editor-dark',
			'plan-editor-detail',
			'plan-editor-detail-dark',
			'plan-editor-detail-narrow-de',
			'plan-editor-light',
			'plan-editor-locked',
			'plan-editor-locked-dark',
			'plan-editor-multiple',
			'plan-editor-multiple-dark',
			'plan-editor-multiple-narrow',
			'plan-editor-narrow',
			'plan-editor-narrow-de',
			'plan-editor-panels-collapsed',
			'plan-editor-panels-collapsed-dark',
			'plan-editor-selected',
			'plan-editor-selected-dark',
			'plan-editor-stale',
			'plan-editor-stale-narrow',
			'plan-editor-tree-dark',
			'plan-editor-tree-light',
			'plan-editor-tree-narrow',
			'plan-editor-tree-narrow-light',
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
		]);

		// The whole FILE, not the table — see the header. A shot entry written outside `SHOTS`
		// is invisible to the table above and fails here instead.
		expect(namedEntries(script)).toBe(declared.length);
	});

	/**
	 * THE SEVEN ASSET LIBRARY SHOTS, each pinned on the ONE field that makes it different from a
	 * sibling — the convention `project-detail-narrow` and `asset-designer-narrow` already state
	 * two cases below, applied to a surface that arrived with seven shots and no pins at all.
	 *
	 * What each pin is FOR, because "pin the fields" is not an argument:
	 *
	 * - **`&asset=` on the four selected shots.** Every one of them waits on
	 *   `.renovation-asset-library`, which the RESTING pane satisfies just as well — so a dropped
	 *   parameter photographs the shelves under a name promising the inspector, four times, and
	 *   exits 0. `tests/harness/assetLibraryPage.test.ts` closes that hazard for the jsdom mount
	 *   and could not close it for the shots.
	 * - **`width` on the three that carry one.** 460 is §7's third rung and 700 its middle one;
	 *   without the field each becomes a byte-identical duplicate of a 1280 shot under a second
	 *   name. The middle rung has already shipped MISSING once with nothing to notice.
	 * - **`scrollTo` on `asset-library-actions`.** That shot exists because the Actions row sits
	 *   below the fold in the 280px rail; without the field it is a second copy of
	 *   `asset-library-selected`, and `Delete` — this surface's one destructive control — goes
	 *   back to being photographed by nothing.
	 * - **`theme=light` on the four selected shots.** Chosen by MEASUREMENT rather than taste:
	 *   the one control here with a colour argument is `Delete`, whose border is `--text-error`,
	 *   and this script's own recorded pair for that variable puts it at 3.89:1 light against
	 *   4.27:1 dark. A scheme chosen by measurement and recorded only in prose is a scheme that
	 *   silently flips back — the sentence the index shots' own scheme case already makes.
	 *
	 * The asset those four open on is `LIBRARY_SELECTED_ASSET`, named once in the script so a
	 * fifth selected shot cannot introduce a second spelling: each query is checked against the
	 * constant's VALUE, and each is checked to have been spelled THROUGH it.
	 */
	it('pins what makes each asset library shot different from its siblings', () => {
		const asset = constants.get('LIBRARY_SELECTED_ASSET');

		expect(typeof asset).toBe('string');
		expect([...String(asset)].every((character) => isIdCharacter(character)), 'LIBRARY_SELECTED_ASSET is not an id').toBe(true);

		// The four that open on a selection: the route AND the measured scheme — reported as the
		// names that fail each check, so a failure says which shot.
		const selected = ['asset-library-selected', 'asset-library-middle', 'asset-library-actions', 'asset-library-narrow-selected'];

		expect(selected.filter((name) => query(name).get('asset') !== asset)).toEqual([]);
		expect(selected.filter((name) => !namesIn(name, 'query').includes('LIBRARY_SELECTED_ASSET'))).toEqual([]);
		expect(selected.filter((name) => query(name).get('theme') !== 'light')).toEqual([]);

		// The three widths of §7's ladder, and the two resting shots that hold the palette.
		expect(shot('asset-library-middle').width).toBe(700);
		expect(shot('asset-library-narrow').width).toBe(460);
		expect(shot('asset-library-narrow-selected').width).toBe(460);
		expect(shot('asset-library-dark').query).toBe('?view=asset-library');
		expect(query('asset-library-light').get('theme')).toBe('light');

		// The one shot whose subject is below the fold.
		expect(shot('asset-library-actions').scrollTo).toBe('.rp-al-actions');
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
	 * `asset-designer-narrow` are above: the property that makes each shot differ from
	 * `plan-editor-light` is not merely that its name exists, but that it is reached through
	 * the knob that actually produces the picture. Losing `&select=`/`&add` off either of the
	 * first two would silently photograph the resting editor under a new name and exit 0;
	 * losing `width: 460` off the third would silently photograph the same wide layout twice.
	 */
	it('takes the selected-zone and Add-menu shots through the knobs that reach them, and the narrow shot at a sidebar width', () => {
		expect(query('plan-editor-selected').get('select')).toBe('harness-kitchen');
		expect(shot('plan-editor-selected').selector).toBe('.rp-room-inspector');
		expect(query('plan-editor-add-menu').has('add')).toBe(true);
		expect(shot('plan-editor-add-menu').selector).toBe('.rp-add-menu');
		expect(shot('plan-editor-narrow').width).toBe(460);
		// The rail as well as the canvas (R14) — see 'waits for the hydrated floor state…' above
		// for why a bare `PLAN_EDITOR_VIEW` wait is exactly the defect being refused here.
		expect(shot('plan-editor-narrow').selector).toEqual(['.rp-plan-canvas', '.rp-editor-shell[data-layout="constrained"] .rp-panel-rail']);
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
		expect(query('plan-editor-add-room').get('room')).toBe('4200x3800');
		expect(shot('plan-editor-add-room').selector).toBe('.rp-new-room__settled:not(:empty)');
		expect(query('plan-editor-add-room-narrow').get('room')).toBe('4200x3800');
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
	 * The asset designer's sidebar-width shot (Task B10's own toolbar-overflow fix) — pinned the
	 * same way `project-detail-narrow` is above, so a width or route dropped from either shot
	 * fails HERE rather than being noticed only by re-running the ad-hoc capture that found the
	 * defect in the first place. `width: 460` is the property that makes this shot different from
	 * `asset-designer-dark`; losing it would silently photograph the same wide layout twice under
	 * two names, which is the exact failure `resolveShots` refuses for a blank entry argument
	 * elsewhere in this file.
	 */
	it('takes the asset designer at a sidebar width, through the route that opens it', () => {
		expect(shot('asset-designer-narrow')).toMatchObject({ query: '?view=asset-designer', width: 460 });
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
	 * every case in this block makes — and the behaviour under them is `focusForShot`'s, which is
	 * asserted directly below.
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
