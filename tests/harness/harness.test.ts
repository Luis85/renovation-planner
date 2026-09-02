/**
 * @vitest-environment jsdom
 *
 * The check that keeps the harness alive. `npm run harness` is deliberately outside
 * `npm run check` — it draws and asserts nothing — so without this the page rots
 * silently: the bundle still builds, and the mount throws in a browser nobody opened.
 *
 * It asserts the FRAME and the plumbing, never appearance. Appearance is a live vault's
 * answer.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { transform } from 'lightningcss';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountHarness } from '../harness/mount';
import { mountPlanEditorHarness } from '../harness/planEditor';
import { mountAssetDesignerHarness } from '../harness/assetDesigner';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver } from '../helpers/layout';
import { installEditorEnvironment, settle as flushAsync } from '../helpers/editor';
import { applyWantedScheme, drawSchemeToggle } from '../harness/theme';
import { isPlantedProbe } from '../helpers/plantedProbe';

/**
 * JavaScript's own line-continuation removal, applied before any source pattern is matched.
 * Module scope because it captures nothing (oxlint `consistent-function-scoping`), and named
 * rather than inlined because the stylesheet walk below is not the only question that would
 * be wrong to ask of un-normalised source.
 */
const withoutContinuations = (text: string): string => text.replace(/\\\r?\n/g, '');

/**
 * Pulled from the real file rather than retyped, so this test agrees with `chrome.css`
 * itself and not with a copy of it — a retyped selector only proves the test agrees with
 * itself. Comments are stripped first: the file's own header comment has no `{`, but
 * relying on that would make the extraction correct by accident.
 */
function chromeHeaderSelector(): string {
	const withoutComments = readFileSync('styles/chrome.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
	return withoutComments.slice(0, withoutComments.indexOf('{')).trim();
}

/**
 * `theme.css`'s two growth rules are POSITIONAL on purpose (see the file's own comment
 * above them): neither names `.workspace-leaf-content` or `.view-content`, so this can't
 * pull one selector out by name the way `chromeHeaderSelector` does. Instead it discovers
 * every rule rooted at `.rp-harness-leaf` whose body actually grants flex growth
 * (`flex: 1`) — today that's the container's rule and the content pane's — without
 * retyping either selector. Which one is "the content pane's" is for the test to prove by
 * matching it against the real mounted `contentEl`, not for this function to assert.
 */
function harnessGrowthSelectors(): string[] {
	const withoutComments = readFileSync('tests/harness/theme.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
	const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)];

	return rules.filter(([, selector, body]) => selector.includes('.rp-harness-leaf') && body.includes('flex: 1')).map(([, selector]) => selector.trim());
}

/** Module scope because it captures nothing per-call; `unicorn/consistent-function-scoping`. */
const readText = (file: string): string => readFileSync(file, 'utf8');

/**
 * Parses one stylesheet with `lightningcss` and reports every `@import` URL it declares — the
 * cascade's own view of the sheet, not a pattern matched against its text. See the case that
 * uses it for why: `/@import/` is case-sensitive and misses `@IMPORT`, and `/@import/i` would
 * then match one inside a comment.
 *
 * `errorRecovery: true` because `tests/harness/obsidian.css` — vendored, "kept whole" from a
 * real Obsidian install — cannot otherwise be parsed at all: its preserved upstream prose
 * names a CSS custom property as `--page-*\/--scale-factor`, and that substring is a literal
 * asterisk-slash, which closes a CSS block comment in ANY conformant parser, browsers
 * included, wherever it appears. Without recovery `lightningcss` throws trying to parse what
 * follows as CSS.
 * `errorRecovery` skips the malformed rule and keeps visiting the rest of the file rather than
 * aborting — measured, it turns that throw into a clean `imports = []` for this file, and it
 * changes nothing for every other sheet here, which already parse cleanly. Guarding the
 * vendored sheet this way, rather than excluding it from the scan, means an `@import` added to
 * it tomorrow is still caught — an excluded file is an unguarded file.
 */
const importsIn = (file: string): string[] => {
	const found: string[] = [];
	transform({
		filename: file,
		code: readFileSync(file),
		minify: false,
		errorRecovery: true,
		visitor: { Rule: { import: (rule) => (found.push(rule.value.url), []) } },
	});
	return found;
};

/** Every `.css` file directly in `dir` (excluding `skip`) that itself `@import`s another. */
const sheetsImporting = (dir: string, skip: string[] = []): string[] =>
	readdirSync(dir)
		.filter((name) => name.endsWith('.css') && !skip.includes(name))
		.filter((name) => importsIn(path.join(dir, name)).length > 0)
		.map((name) => path.posix.join(path.basename(dir), name));

beforeEach(() => {
	document.body.innerHTML = '';
	document.body.className = '';
	document.head.innerHTML = '';
});

describe('the browser harness', () => {
	it('mounts the real view inside a leaf frame', () => {
		const { leafEl, view } = mountHarness(document.body);

		expect(leafEl.classList.contains('rp-harness-leaf')).toBe(true);
		expect(view.containerEl.parentElement).toBe(leafEl);
		// The view's own first draw ran: what a browser shows is the view, not the frame.
		expect(view.contentEl.querySelector('.renovation-planner-view')).not.toBeNull();
	});

	/**
	 * `styles/chrome.css` hides Obsidian's view header by matching
	 * `.workspace-leaf-content[data-type="…"] .view-header`. The harness's mounted DOM has
	 * to satisfy that selector itself for the rule to be lookable-at in the tool built for
	 * looking — matched against the selector read from the file, not a copy of it.
	 */
	it('gives the mounted DOM what styles/chrome.css selects', () => {
		const { view } = mountHarness(document.body);

		const header = view.containerEl.querySelector('.view-header');

		expect(header).not.toBeNull();
		expect(header?.matches(chromeHeaderSelector())).toBe(true);
	});

	/**
	 * `styles/view.css` gives the mount point `height: 100%`, which only resolves because
	 * `theme.css` grows `contentEl` to fill the leaf — and that growth rule is POSITIONAL
	 * (`.rp-harness-leaf > div > div:last-child`, not a name), so it depends on
	 * `obsidian-mock.ts` keeping `contentEl` as the last child it appends to `containerEl`.
	 * If a future child landed after it, this selector would stop matching `contentEl`
	 * silently — nothing else in `npm run check` looks at rendered layout — so this asserts
	 * the coupling directly, against the selectors `theme.css` actually declares rather than
	 * a copy of them.
	 */
	it('gives the mounted contentEl the growth rule theme.css declares for it', () => {
		const { view } = mountHarness(document.body);

		const matching = harnessGrowthSelectors().filter((selector) => view.contentEl.matches(selector));

		expect(matching.length).toBeGreaterThan(0);
	});

	/**
	 * The `?project=` knob (design slice 21), which is the only way this harness reaches the
	 * view's DETAIL state at all — the index cannot mount `ProjectDetail` usefully, since it
	 * renders an entry bare and that component requires three props and reads `project.name`
	 * immediately.
	 *
	 * Driven here rather than left to `npm run harness-shot` alone, because the two shots that
	 * use it are outside `npm run check`: a seed that stopped seeding, or a `projectId` that
	 * stopped being passed, would leave both captures photographing the LIST state — the
	 * selector they wait on (`.renovation-planner-view`) matches either one, so the run would
	 * write two PNGs and exit 0.
	 *
	 * `flushPromises` and not a tick count: `onOpen` mounts synchronously and the store's read
	 * settles afterwards, so a fixed number of turns is a fact about today's call chain.
	 *
	 * **What this does NOT drive is `page.ts`'s `params.get('project')`** — it calls
	 * `mountHarness` with the id directly, so the one line that turns a URL into that argument
	 * is exercised by nothing here. A build that stopped reading the parameter would keep this
	 * case green and photograph the list twice. Stated rather than closed: `page.ts` mounts at
	 * module scope, so driving it means importing a module for its side effects under a
	 * rewritten `location`, which is a test harness of its own rather than a case. Reported by
	 * this task's reviewer.
	 */
	it('opens the detail state on a seeded project when given one, plans and all', async () => {
		const { view } = mountHarness(document.body, 'project-1');

		await flushPromises();

		const detail = view.contentEl.querySelector('.rp-project-detail');

		expect(detail).not.toBeNull();
		expect(detail?.querySelector('.rp-project-detail__name')?.textContent?.trim()).toBe(
			'Maple Street, ground floor refit',
		);
		// Enough rows that `.rp-plan-list`'s own scrolling is a thing a capture can show. A
		// list that fits its pane looks identical with the rule deleted.
		expect(detail?.querySelectorAll('.rp-plan-list__row').length).toBeGreaterThan(8);
	});

	/**
	 * The other half, and the half a wrong default would break silently: with no parameter the
	 * bare harness root still takes `makeView()`'s untouched default, which is the EMPTY project
	 * list — the state `makeRenovationProjectView.ts`'s docblock says that root exists to show,
	 * and the one the three fixed project-view shots photograph.
	 */
	it('still opens the list state when no project is named', async () => {
		const { view } = mountHarness(document.body);

		await flushPromises();

		expect(view.contentEl.querySelector('.rp-project-detail')).toBeNull();
		expect(view.contentEl.querySelector('.rp-empty-state')).not.toBeNull();
	});

	it('empties the root, so a second mount does not stack', () => {
		mountHarness(document.body);
		mountHarness(document.body);

		expect(document.body.querySelectorAll('.rp-harness-leaf')).toHaveLength(1);
	});

	// The mount installs Obsidian's DOM extensions, which a browser has none of. If this
	// regressed, every render call would throw on the real page and nothing else here would
	// notice — the suite installs them in every other file itself.
	it('installs the Obsidian DOM extensions the render code calls', () => {
		mountHarness(document.body);

		expect(typeof document.body.createDiv).toBe('function');
		expect(typeof document.body.empty).toBe('function');
	});

	it('switches the scheme classes Obsidian defines its palette under', () => {
		mountHarness(document.body);
		drawSchemeToggle();

		expect(document.body.classList.contains('theme-dark')).toBe(true);

		const toggle = document.body.querySelector<HTMLElement>('.rp-harness-scheme');
		toggle?.click();

		expect(document.body.classList.contains('theme-light')).toBe(true);
		expect(document.body.classList.contains('theme-dark')).toBe(false);
	});

	/**
	 * The scheme is the CONTENT's and the toggle is the harness's own furniture, which is why
	 * they are two functions.
	 *
	 * A `&bare` capture asks for a picture of the screen — `scripts/entryShots.mjs` puts that
	 * parameter on every named entry — and the toggle is positioned fixed over the bottom-right
	 * of the viewport, so every "chromeless" PNG this branch produced had a dashed
	 * `Harness: dark` button sitting on the prototype. Including the ones that were captured and
	 * LOOKED AT: it appears in the corner of each and was read as part of the page.
	 *
	 * Only the split is driven here. Which of the two `page.ts` calls is a source pin in
	 * `tests/build/harness-shot.test.ts`, because that module mounts at import.
	 */
	it.each([
		['/', 'theme-dark'],
		['/?theme=light', 'theme-light'],
	])('applies the scheme %s asks for, without drawing the harness furniture', (url, expected) => {
		// The URL is SET rather than assumed: the case above clicks the toggle, which writes the
		// scheme back to the URL, so a case reading the default here would be asserting about
		// whatever ran before it. Driving both values also makes this about reading the URL
		// rather than about one hard-coded outcome.
		window.history.replaceState({}, '', url);
		mountHarness(document.body);
		applyWantedScheme();

		expect(document.body.classList.contains(expected)).toBe(true);
		expect(document.body.querySelector('.rp-harness-scheme')).toBeNull();
	});

	/**
	 * The one-sheet claim, which is the entire reason prototypes moved out of
	 * `docs/user-experience/concepts/`. A mock drawn against a second sheet is approved
	 * against something that will not ship, and the page offering one is all it would take.
	 *
	 * Asserted on the page rather than on a rendered screen: there is no rendering engine
	 * here, and what CAN be checked — that the page links exactly the three sheets it means
	 * to, and that `concept.css` is not among them — is the thing that would actually go
	 * wrong.
	 *
	 * PARSED, not pattern-matched. This file already runs in jsdom (`@vitest-environment`
	 * at the top), so `DOMParser` is right there, and HTML has more spellings of one link
	 * than a regex written by hand keeps up with: attribute order is free, attribute values
	 * may be UNQUOTED (`<link rel=stylesheet href=…/concept.css>` is valid HTML a browser
	 * loads), tag and attribute names are case-insensitive, and `rel` is a space-separated
	 * token list. Two hand-written patterns here were each defeated by the next spelling
	 * somebody thought of. The parser knows all of them, and it is the same argument
	 * `CLAUDE.md` already makes for checking colours on lightningcss's parsed tree rather
	 * than on source text.
	 *
	 * `[rel~=stylesheet i]` is that knowledge spelled out: `~=` matches one token of the
	 * list, `i` makes it case-insensitive. The `<link rel="icon">` this page carries is
	 * excluded by it, which is checked below rather than assumed.
	 *
	 * `style` joins the selector because a `<style>` element is a second way this page can
	 * introduce CSS, and an `@import` inside one is a way in that no other guard here sees:
	 * the module scan reads `.ts`/`.vue`, the sheet scan reads the harness's own `.css`
	 * files, and neither is this HTML. The expected list is therefore the whole CSS-bearing
	 * set of the page, not its links — which is why a `<style>` appears in it as `<style>`
	 * and fails the equality rather than being silently uncounted.
	 */
	it('offers prototypes exactly one plugin stylesheet and no proposal sheet', () => {
		const html = readFileSync('tests/harness/index.html', 'utf8');

		const page = new DOMParser().parseFromString(html, 'text/html');
		// EVERY node that can introduce CSS, not only the links: a `<style>` element in this
		// page is another way in, and `<style>@import '…/concept.css';</style>` is a way in
		// that no later guard sees either — they scan module sources and the harness's own
		// `.css` files, neither of which is this HTML. Asked as one category so the set is
		// what is asserted, rather than a list of the spellings somebody thought of.
		const sheets = [...page.querySelectorAll('link[rel~=stylesheet i], style')].map((node) =>
			node.tagName === 'STYLE' ? '<style>' : (node.getAttribute('href') ?? ''),
		);

		expect(sheets).toEqual(['./obsidian.css', './theme.css', '/styles.css']);
		expect(sheets.some((href) => href.includes('concept'))).toBe(false);
	});

	/**
	 * The same claim over every other route THESE CHECKS cover. A sheet reaches this page as a
	 * `<link>` in `index.html`, through Vite's module graph — a `.css` import anywhere in what
	 * the page can load, or an SFC `<style>` block — or as a `<link>` a TEMPLATE renders into
	 * the body, which no build step and no import is involved in at all. The case above can see
	 * only the first. This one refuses those three routes reaching a fourth sheet through
	 * anything the page can reach — not every conceivable route a stylesheet could take. A Vite
	 * plugin's `transformIndexHtml` injecting a `<link>` would be a seventh route none of these
	 * checks see; none exists in this repository today (grepped), so nothing here reaches for
	 * one, but the claim is scoped to what is actually checked rather than to "nothing ever."
	 *
	 * The scanned set is what the page can reach, not the files that exist today: `page.ts`
	 * imports the harness modules, those import `src/` AND `tests/helpers/`, and Task 4's
	 * index globs `src/prototypes/**` and `src/presentation/**` — so a sheet imported by a
	 * component three levels down, or by a DOM helper, is loaded exactly as surely as one
	 * imported here. Scanning all three trees closes the transitive route without building
	 * anything: if no file in any of them imports a stylesheet, nothing reachable through
	 * them does.
	 *
	 * The three spellings are checked over different sets, and the asymmetry is deliberate:
	 *
	 * - A `<style>` block is checked in `tests/harness/` ONLY, because `eslint.config.mjs`
	 *   already refuses one anywhere under `src/` (`vue/no-restricted-block`, over
	 *   `VUE_FILES` = `['**\/src/**\/*.vue']`) while a `.vue` under `tests/` matches no
	 *   ESLint block at all — measured. Scanning `src/` for it here would duplicate a live
	 *   rule AND report `ViewRoot.vue`, whose comment spells the tag it is promising never
	 *   to use. A text scan cannot tell a comment from a block; the linter can, and does.
	 * - A `.css` IMPORT is checked over both, because no rule refuses one in either.
	 * - A `<link rel="stylesheet">` IN A TEMPLATE is checked over both as well, and it is the
	 *   spelling that needs no build step and no import at all: a browser honours a
	 *   stylesheet link in the body, so a mock carrying one loads the proposal sheet while
	 *   the import scan, the `<style>` scan and the `index.html` scan all stay green. Matched
	 *   as `<link … stylesheet` rather than by attribute order, for the reason the case above
	 *   already gives — and narrow enough that the prose in this repository that merely says
	 *   "stylesheet" does not trip it. Measured: no hit in 169 files.
	 *
	 * The import pattern matches the SPECIFIER POSITION — a quoted string preceded by `from`,
	 * by `import`, or by `import(` — rather than the bare substring `.css`. Both halves of
	 * that are load-bearing:
	 *
	 * Not the bare substring, because prose naming `concept.css` is how this repository
	 * explains itself, and a guard that fires on its own explanation gets deleted rather
	 * than obeyed.
	 *
	 * And not `import` alone, because `import classes from './panel.module.css'` — Vite's
	 * ordinary CSS-modules form — puts the specifier after `from`, and a pattern anchored
	 * on the quote following `import` misses it while looking thorough. Measured on six
	 * spellings: side-effect, default binding, named binding, dynamic, a re-export, and a
	 * BACKTICK-quoted dynamic import — `` import(`./x.css`) `` is valid, statically
	 * analysable Vite syntax the first five checks did not cover, since the delimiter class
	 * named only `'"` and not `` ` ``. Planted and watched failing before this was widened
	 * (a template-literal specifier in `page.ts` reaches production and was invisible to
	 * both this scan AND the rendered-document check in `indexRealEntries.test.ts`, which mounts
	 * `IndexPage` directly and never executes `page.ts` at all — this source scan remains
	 * the only check in this file that can see a `page.ts`-specific IMPORT at all, `page.ts`
	 * itself running below included: Vitest's default `css: false` stubs a real `.css`
	 * import into an empty module rather than loading it, so executing the module graph
	 * proves nothing about an import no matter how faithfully it runs — measured, not
	 * assumed, by planting one and watching the execution check below stay green through
	 * it while this one caught it; see that check's own comment for what running the
	 * module graph closes instead).
	 *
	 * The widening touches only the DELIMITER class (`['"`` ` ``]`, both ends of the match);
	 * the inner exclusion class stays `[^'"]` — backtick deliberately left out of it — so a
	 * literal backtick inside a single- or double-quoted specifier, legal on every POSIX
	 * filesystem (`import './weird`.css'`), still matches exactly as it did before this
	 * widening, while `` import(`./x.css`) `` now matches too, delimiters included. Measured
	 * both directions: sharing one class between the delimiters and the interior — the
	 * shape this file carried between the six-spellings widening and this paragraph — passes
	 * the backtick-quoted case but loses that POSIX-legal one; splitting the two classes, as
	 * written now, keeps both.
	 *
	 * **What this still does not cover, stated rather than left implicit.** A specifier held
	 * in a VARIABLE — `import(cssPath)` — is not a literal quoted string at all, so no regex
	 * on this pattern's shape can see it; that is a limit of pattern-matching itself, and a
	 * further refinement of this character class does not remove it. A COMPUTED specifier
	 * built from a template literal is not automatically in that category, though — measured:
	 * `` import(`./${name}.css`) `` still matches, because the pattern only requires `.css`
	 * text to appear before the closing delimiter, and that text survives the `${…}`
	 * interpolation sitting in front of it. What actually defeats the pattern is the
	 * specifier carrying no literal `.css` text at the import site at all, which is what
	 * `import(cssPath)` is an example of and a template literal ending in `.css` is not.
	 *
	 * `sources()` below excludes exactly the `*.test.ts` suffix, and only that suffix — a
	 * `.test-d.ts` or `.test.tsx` under one of these trees would still be walked. Harmless
	 * today (measured: neither exists under `src/`, `tests/harness/` or `tests/helpers/`).
	 *
	 * The exclusion is not a nicety: without it, this test fails against ITSELF and against
	 * `cssVars.test.ts` — measured, not assumed. This file's own planted-proof documentation
	 * literally contains `import '…/concept.css';`, matching `sheetImport`, and
	 * `<link rel="stylesheet" href="…/concept.css" />`, matching `sheetLink`; `cssVars.test.ts`
	 * separately defines `const LINK = /<link rel="stylesheet" href="([^"]+)" \/>/g;`, whose
	 * own literal text matches `sheetLink` too. Neither file loads a stylesheet — one documents
	 * this guard, the other extracts hrefs with a regex of its own — but both would report a
	 * false hit if scanned, which is exactly the class of guard-fires-on-its-own-explanation
	 * defect named above for the bare-substring case.
	 */
	it('loads no stylesheet through anything the harness can reach', () => {
		// A specifier may not contain a BARE newline, and may contain an escaped one.
		//
		// The bare-newline exclusion is what stops the class spanning prose. Measured twice, both
		// times on comments: "Split from `onKey`" paired with a backticked `canvas.css`
		// twenty-one lines below it and matched across the gap, and the second instance was
		// written by an author who had just recorded the first. The failure message says "loads
		// no stylesheet", which points nowhere near a comment, so each false positive costs a
		// debugging cycle rather than a glance.
		//
		// Line continuations are REMOVED BEFORE MATCHING rather than spelled into the pattern,
		// which is the transformation JavaScript's own parser performs: a specifier holding
		// ``./styles\<newline>/index.css`` really does load a stylesheet, so the source newline
		// must not defend against the match. Verified in node rather than reasoned about.
		//
		// **This replaced a `(?:[^'"\n]|\\\n)*` alternative that handled continuations in the
		// PRECEDING repetition only, so `'./styles.cs\<newline>s'` — a continuation inside the
		// EXTENSION — evaluated to `./styles.css` and matched nothing.** The assertion below is
		// `toEqual({ importers: [] })`, so an under-matching pattern is a SILENT PASS: the
		// stylesheet stays reachable and the walk reports a clean tree. That is this
		// repository's own assert-an-absence defect, in the instrument rather than in a case.
		//
		// Normalising also closed a gap nobody reported: `\\\n` does not match `\\\r\n`, so a
		// CRLF continuation defeated the old pattern too. Three rounds narrowed this regex one
		// reported case at a time; doing what the parser does closes the class, and the third
		// round is what says a pattern was the wrong instrument rather than a wrong pattern.
		const sheetImport = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"`][^'"\r\n]*\.css['"`]/;
		const sheetLink = /<link[^>]*\bstylesheet\b/i;
		// Every extension Vite will load as a module, not the two this repository happens to
		// hold today: `tsconfig.json` sets `allowJs`, so a `.js` or `.mjs` helper is as
		// reachable as any other and its CSS import would load the same sheet. Matches
		// `eslint.config.mjs`'s own `SRC_EXTENSIONS` — the repository's other answer to the
		// same question — nine spellings rather than a list restated by eye; the two disagreed
		// on `.mts`/`.cts` until this widening (measured: neither exists under `src/`, `tests/`
		// or `scripts/` today, so nothing was actually missed yet, but `moduleResolution:
		// "bundler"` and `allowJs` mean Vite compiles both, so a future helper written in
		// either would have had its stylesheet import go unscanned).
		const MODULE = /\.(?:ts|tsx|mts|cts|js|mjs|cjs|jsx|vue)$/;
		// `isPlantedProbe` because `tests/build/lint-edited.test.ts` writes real `.vue` files
		// into `tests/harness/` and removes them, in a worker running beside this one. Without
		// it this walk lists a probe and then READS it, and the read loses the race: measured,
		// `ENOENT … lint-edited-probe-1.vue`, on a tree with no source change at all. Excluded
		// in the walk rather than at either use below, for the reason its sibling walker in
		// `lint-scope.test.ts` gives — a probe is not a module of this page under any question
		// asked of this list.
		const sources = (dir: string): string[] =>
			readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
				const full = path.join(dir, entry.name);
				if (entry.isDirectory()) return sources(full);
				if (isPlantedProbe(full)) return [];
				return MODULE.test(entry.name) && !entry.name.endsWith('.test.ts') ? [full] : [];
			});

		const reachable = [
			...sources('src'),
			...sources('tests/harness'),
			// `tests/helpers/` too: `mount.ts` and `planEditor.ts` are RUNTIME modules of this
			// page and they import from there, so a stylesheet imported by a helper reaches the
			// page exactly as surely as one imported here.
			...sources('tests/helpers'),
		];

		const importers = reachable.filter((file) =>
			sheetImport.test(withoutContinuations(readText(file))),
		);
		const linkers = reachable.filter((file) => sheetLink.test(readText(file)));
		const styleBlocks = sources('tests/harness').filter((file) =>
			/<style[\s>]/.test(readText(file)),
		);

		expect({ importers, linkers, styleBlocks }).toEqual({ importers: [], linkers: [], styleBlocks: [] });
	});

	/**
	 * Round 8's item 5 — the route no source pattern can ever see, at any width: a stylesheet
	 * inserted PROGRAMMATICALLY (`document.createElement('link'); el.rel = 'stylesheet'; …;
	 * document.head.appendChild(el)`) is not distinguishable from any other `createElement`
	 * call without running the code, so widening the regex above is not an available fix —
	 * only running it and looking at the result is. The rendered-document check in
	 * `indexRealEntries.test.ts` already does that for what an ENTRY renders, but it mounts
	 * `IndexPage` directly and never executes `page.ts` — the harness page's actual entry
	 * point, and the one place with a route this specific: `applyPlatform` and
	 * `drawSchemeToggle` run from there and from nowhere a test mounts. (The component
	 * registry no longer belongs on that list: `indexApp.ts` gives every mounted test of the
	 * index the same registry `page.ts` installs, which is what made a prototype composing a
	 * real component testable at all.)
	 *
	 * So this executes `page.ts` itself. Its top-level code runs once per module instance, at
	 * import time, branching on `window.location.search` — `vi.resetModules()` plus a fresh
	 * dynamic `import` re-runs it for this test rather than reusing whatever a previous test
	 * left behind, and `?index` takes the branch that mounts the real `IndexPage` against the
	 * real glob, the same path `npm run harness` serves.
	 *
	 * **Proven to catch something, not merely to run**: a `document.createElement('link')`
	 * stylesheet planted at `page.ts`'s top level was watched failing here (`CSS NODES` went
	 * from 0 to 1) before being removed again — recorded in the round 8 report rather than
	 * left in the tree, for the reason `tests/harness/harness.test.ts`'s other planted proofs
	 * already give.
	 *
	 * **What this still does not close.** `?index` alone renders "Pick an entry." — no entry
	 * mounts — so a stylesheet a specific ENTRY inserts programmatically is still the
	 * `indexRealEntries.test.ts` check's job, not this one's; this closes `page.ts`'s OWN
	 * route, the one no other check executes at all.
	 */
	it('adds no stylesheet to the document when page.ts itself runs', async () => {
		installEditorEnvironment();
		window.history.replaceState({}, '', '/?index');
		vi.resetModules();

		await import('../harness/page');
		await flushAsync();

		expect(document.querySelectorAll('link[rel~=stylesheet i], style').length).toBe(0);
	});

	/**
	 * A stylesheet can import a stylesheet, and that is a fourth route. `@import
	 * '../../docs/user-experience/concepts/concept.css';` added to `tests/harness/theme.css`
	 * loads the proposal sheet: the HTML still has its three links, no module imports a
	 * `.css`, no template renders a `<link>`, and every list above stays empty. The walker
	 * excludes `.css` files entirely, so it cannot see it.
	 *
	 * BOTH linked harness sheets are scanned — `theme.css` and, with `errorRecovery` (see
	 * `importsIn`), the vendored `obsidian.css` too — and neither has any legitimate use for
	 * `@import`: they are standalone files the page links directly. So the rule is simply
	 * that they carry none.
	 */
	it('lets no stylesheet the page loads pull in another', () => {
		// PARSED, for the same reason the page check is parsed rather than pattern-matched.
		// `@IMPORT` is valid CSS and a browser honours it; `/@import/` does not match it, and
		// `/@import/i` would then match one inside a comment. `lightningcss` answers both at
		// once — it is already a devDependency, already used by the stylesheet gate, and the
		// visitor sees exactly what the cascade would.
		const imported = [
			...sheetsImporting('tests/harness'),
			// `styles/` too, minus `index.css`. The assembler validates index.css's OWN lines
			// against `@import "./<partial>.css";` — but it then concatenates each partial's
			// body UNCHANGED (`scripts/styles-assemble.mjs`, the `parts` map: line count and
			// hard-coded colours are checked, nothing else), so an `@import` inside a partial
			// survives into the shipped sheet and into the page. Verified in the source, after
			// an earlier version of this comment claimed the assembler owned the question and
			// was wrong.
			...sheetsImporting('styles', ['index.css']),
		];

		expect(imported).toEqual([]);
	});

	// `applyPlatform` is deliberately NOT asserted here: the property that matters —
	// that it works BEFORE the extensions are installed — is not reachable from this
	// file, because a case above has already installed them on the shared prototype.
	// `platform.test.ts` holds the strictly stronger version of that check.
});

/**
 * The Plan Editor half of the page — `npm run harness` with `?view=plan-editor`. Same job
 * as the block above and the same limit: this asserts the FRAME and the plumbing, never
 * appearance, because a browser is where the layered scene is actually looked at.
 *
 * The canvas backing and the resize observer are installed because a real Konva stage is
 * constructed here; a browser has both natively, and jsdom has neither.
 */
describe('the browser harness, plan editor', () => {
	it('mounts the real plan editor inside the same leaf frame', () => {
		installCanvas();
		installResizeObserver();

		const { leafEl, view } = mountPlanEditorHarness(document.body);

		expect(leafEl.classList.contains('rp-harness-leaf')).toBe(true);
		expect(view.containerEl.parentElement).toBe(leafEl);
		// Its own first draw ran: the mount point the stylesheet keys off is there.
		expect(view.contentEl.querySelector('.renovation-plan-editor-view')).not.toBeNull();
	});

	/**
	 * The scheme toggle has to reach the CANVAS, not just the DOM chrome. A Konva shape
	 * cannot read a CSS variable, so the editor re-resolves its palette on a theme event —
	 * and without the toggle firing one, switching scheme here would relight the panels and
	 * leave the zones drawn in the other theme.
	 */
	it('fires a theme event the editor can re-resolve its palette on', () => {
		installCanvas();
		installResizeObserver();
		mountPlanEditorHarness(document.body);
		drawSchemeToggle();
		let fired = 0;
		window.addEventListener('rp-harness-theme', () => {
			fired += 1;
		});

		document.body.querySelector<HTMLElement>('.rp-harness-scheme')?.click();

		expect(fired).toBe(1);
	});
});

/**
 * The asset designer half of the page — `npm run harness` with `?view=asset-designer` (Task
 * B10). Same job as the block above and the same limit: this asserts the FRAME and the
 * plumbing, never appearance — a browser is where the shell is actually looked at.
 *
 * The canvas backing and the resize observer are installed for the identical reason: a real
 * Konva stage is constructed inside `DesignerCanvas`, which a browser has natively and jsdom
 * has neither of. There is no theme-event case to mirror the Plan Editor's: `DesignerCanvas.vue`
 * 's own docblock records that `AssetDesignerDeps` carries no theme subscription, so this
 * surface has nothing to fire yet.
 */
describe('the browser harness, asset designer', () => {
	it('mounts the real asset designer inside the same leaf frame', async () => {
		installCanvas();
		installResizeObserver();

		const { leafEl, view } = mountAssetDesignerHarness(document.body);
		// The designer's own hydration settles a tick after the synchronous mount, same as
		// every other view this file and `accessibility.test.ts` mount.
		await flushPromises();

		expect(leafEl.classList.contains('rp-harness-leaf')).toBe(true);
		expect(view.containerEl.parentElement).toBe(leafEl);
		// Its own first draw ran: the mount point the stylesheet keys off is there.
		expect(view.contentEl.querySelector('.renovation-asset-designer-view')).not.toBeNull();
	});
});
