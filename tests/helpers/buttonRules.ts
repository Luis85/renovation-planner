import { readFileSync, readdirSync } from 'node:fs';
import type { Selector, SelectorComponent } from 'lightningcss';
import { compoundsOf, subjectClasses } from './selectors';

/**
 * Which elements in this project are BUTTONS, and what a selector says about one.
 *
 * Shared because two checks ask about the same set from opposite directions —
 * `buttonSpecificity` asks whether a rule outranks Obsidian's own, `buttonFocusRing` whether a
 * rule that flattens one gives its focus indicator back — and a widening applied to one and not
 * the other has already been a defect twice. Both read the same answer now.
 */

/** Module scope because it captures nothing per-call; `unicorn/consistent-function-scoping`. */
const filesUnder = (dir: string, ext: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? filesUnder(`${dir}/${entry.name}`, ext)
			: entry.name.endsWith(ext)
				? [`${dir}/${entry.name}`]
				: [],
	);

/**
 * How far past a `createEl('button'` call to look for its `cls`. Bounded rather than brace-matched
 * on purpose: the option object nests (`attr: { … }`), so `[^}]*` stops at the wrong brace, and a
 * real parser is far more than this needs. The limit is a stated one — a `cls` further away than
 * this, or built from a variable rather than a literal, is not seen, and the instrument case below
 * pins the one call that exists rather than trusting the window.
 */
const CREATE_WINDOW = 300;

/**
 * Every `rp-*` class this project puts on a `<button>`, from the SOURCE rather than a list — and
 * from both ways a button is made here, which is the correction this function needed.
 *
 * It read Vue templates only, so `.rp-harness-scheme` — created in `tests/harness/theme.ts` with
 * `createEl('button', { cls: … })` — was in no class set, and every rule governing it went
 * unchecked by both cases below while `theme.css` sat in `sheets` looking covered. Measured:
 * reverting its doubled selector to the bare class AND deleting its focus ring left this file
 * green. A scan that names one authoring style silently exempts the other.
 */
export function buttonClasses(): Set<string> {
	const found = new Set<string>();
	const add = (text: string) => {
		for (const [cls] of text.matchAll(/\brp-[\w-]+/g)) found.add(`.${cls}`);
	};

	// `src/prototypes` as well as `src/presentation`. A mock is never shipped, but the sheet that
	// styles it IS — `styles/work-packages.css` is a real partial — and the harness is where that
	// mock is LOOKED AT, which is the whole point of drawing it. Omitting the tree left
	// `.rp-wp-new` undiscovered while its rule lost the cascade, so the screen's primary action
	// was being judged as a plain grey button.
	for (const file of ['src/presentation', 'src/prototypes'].flatMap((dir) => filesUnder(dir, '.vue'))) {
		// The OPENING TAG only, so a class on a sibling element inside the button's own markup is
		// not collected as if the button wore it. Both `class="…"` and `:class="{ x: … }"` live in
		// there, and `rp-editor-tool-active` arrives only through the second.
		for (const [tag] of readFileSync(file, 'utf8').matchAll(/<button\b[^>]*>/g)) add(tag);
	}

	// Obsidian's own DOM helper, which is how anything outside a Vue tree makes an element here.
	// `tests/harness` as well as `src`, because the harness's chrome is styled by a sheet this
	// file scans and is therefore this file's business.
	for (const dir of ['src', 'tests/harness']) {
		for (const file of filesUnder(dir, '.ts')) {
			const source = readFileSync(file, 'utf8');

			for (const match of source.matchAll(/createEl\(\s*['"]button['"]/g)) {
				const cls = /\bcls:\s*['"]([^'"]+)['"]/.exec(source.slice(match.index, match.index + CREATE_WINDOW));

				if (cls !== null) add(cls[1]);
			}
		}
	}

	return found;
}

/** Every sheet that can style one: the ones that ship, plus the harness's own chrome. */
export const sheets = [
	...readdirSync('styles')
		.filter((file) => file.endsWith('.css') && file !== 'index.css')
		.map((file) => `styles/${file}`),
	'tests/harness/theme.css',
];

/** The button classes a selector's subject wears, as exact names with the leading dot. */
export const buttonClassesOn = (selector: Selector, classes: Set<string>): string[] =>
	subjectClasses(selector)
		.map((name) => `.${name}`)
		.filter((name) => classes.has(name));

/**
 * Does this rule style a BUTTON at all?
 *
 * A known class on the subject is the ordinary case. The other one is a bare `button` type
 * selector — `button:not(.rp-dialog-button)`, `.rp-editor-toolbar button` — which targets buttons
 * without naming any of this project's classes and so was outside the sweep entirely.
 *
 * That gap survived a review finding about the same selector. The finding was that `:not()`'s
 * contents were read as classes the subject WEARS, which exempted the rule; fixing that stopped
 * the exemption and left the rule matching no class at all, so it went from wrongly exempt to
 * silently out of scope — a quieter version of the same miss. Found by re-running every historical
 * hole against the rewritten reader rather than by the unit cases, which is the argument for
 * keeping that sweep.
 */
export const targetsAButton = (selector: Selector, classes: Set<string>): boolean =>
	buttonClassesOn(selector, classes).length > 0 ||
	compoundsOf(selector).at(-1)?.components.some((component) => component.type === 'type' && component.name === 'button') ===
		true;

/** A branch's subject — the components after its last combinator, the element the rule styles. */
export const subjectOf = (branch: Selector): SelectorComponent[] =>
	branch.slice(branch.map((component) => component.type).lastIndexOf('combinator') + 1);
