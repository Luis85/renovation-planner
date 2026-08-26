import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * NO RULE THIS PROJECT WRITES FOR A `<button>` MAY LOSE TO OBSIDIAN'S OWN BUTTON RULE.
 *
 * `button:not(.clickable-icon)` in `tests/harness/obsidian.css` sets `background-color`, `color`
 * and `box-shadow` at specificity **(0,1,1)** — `:not()` contributes its argument's specificity,
 * so one element plus one class beats a bare class at (0,1,0), and source order is never even
 * consulted. A rule that loses does not warn, does not fail a build, and looks correct in the
 * stylesheet: the only symptom is a colour nobody chose, in a vault.
 *
 * **It has bitten three times, which is why this is a category check rather than a fourth
 * fixture.** `.rp-dialog-button-danger` rendered plain white where it asked for red (design
 * slice 15, fixed there and nowhere else). `.rp-editor-tool-active` lost both its declarations,
 * so the ACTIVE TOOL rendered identically to the inactive ones — `aria-pressed` was bound, so a
 * screen reader was told what the screen would not say. `.rp-editor-inspector-delete`, a
 * destructive action whose whole visual argument is `--text-error`, rendered as an ordinary grey
 * button with only its border surviving (Obsidian's rule sets no border, so that one declaration
 * was never contested). `.rp-dialog-candidate` and the harness's own `.rp-harness-scheme` were
 * found by the same sweep.
 *
 * `CLAUDE.md`: a category invariant is checked at the FORBIDDEN THING, not by listing the places
 * — so this reads the selectors themselves and holds for rules nobody has written yet.
 *
 * **What it proves and what it does not.** It compares SPECIFICITY, which is the mechanism that
 * actually decides this, and it is exact about the two ends: the classes come from every
 * `<button>` in `src/presentation/`, and the rules from every sheet that ships plus the
 * harness's own. It says nothing about the COLOUR a browser finally paints — that needs `var()`
 * resolved, which no gate here does (`tests/presentation/dialogs/dangerButtonSpecificity.test.ts`
 * takes the one worked example as far as jsdom's cascade can, and a real Chromium took all five
 * the rest of the way once, by hand).
 */

/** What Obsidian's `button:not(.clickable-icon)` scores, and therefore what a rule must beat. */
const OBSIDIAN_BUTTON = [0, 1, 1] as const;

/** The properties that rule actually sets. A rule touching none of them is not in this contest. */
const CONTESTED = ['background-color', 'color', 'box-shadow'];

/**
 * Rules deliberately left to lose, by name and with the reason — the shape `.oxlintrc.json` uses
 * for a rule that does not fit, so a reviewer sees the exemption rather than a silent gap.
 *
 * `.rp-dialog-button` asks for `--interactive-normal` and `--text-normal`, the very values
 * Obsidian's rule applies anyway, so losing changes nothing on screen — and staying at (0,1,0)
 * is what lets a themed vault's own button appearance win here undisturbed. `styles/dialogs.css`
 * carries the same reasoning at the rule itself.
 */
const DEFERS_TO_THE_HOST = ['.rp-dialog-button'];

/**
 * A selector's (id, class, type) specificity.
 *
 * `:not(...)`/`:is(...)`/`:has(...)` contribute their ARGUMENT's specificity and nothing of their
 * own, which is the whole reason Obsidian's rule scores (0,1,1) rather than (0,0,1) — get that
 * wrong and this file computes the wrong threshold for every case at once. So the arguments are
 * scored recursively and the wrapper itself is dropped, while an ordinary pseudo-class
 * (`:hover`, `:disabled`) counts as a class and a pseudo-ELEMENT (`::after`) counts as a type.
 *
 * Deliberately not a full CSS parser: it answers for the selector shapes this repository writes,
 * and `describe('the instrument')` below drives it against the ones that matter — including the
 * two it would be easiest to get wrong.
 */
function specificityOf(selector: string): [number, number, number] {
	let rest = selector;
	let ids = 0;
	let classes = 0;
	let types = 0;

	// Functional pseudo-classes first: score the argument, then remove the whole construct so the
	// scan below never sees the inner selector twice.
	rest = rest.replace(/:(?:not|is|has|where)\(([^()]*)\)/g, (_match, inner: string) => {
		if (!_match.startsWith(':where')) {
			const [i, c, t] = specificityOf(inner);
			ids += i;
			classes += c;
			types += t;
		}
		return ' ';
	});

	// Pseudo-ELEMENTS are removed before anything else counts, and that ordering is the fix for a
	// defect this file's own instrument cases caught: `::after` ends in `:after`, so a
	// pseudo-CLASS pattern guarded only by "the next character is not a colon" matched its SECOND
	// colon and scored it as a class as well as an element. Taking them out first leaves no
	// second colon for anything to match.
	types += (rest.match(/::[\w-]+/g) ?? []).length;
	rest = rest.replace(/::[\w-]+/g, ' ');

	ids += (rest.match(/#[\w-]+/g) ?? []).length;
	// A class, an attribute selector, or a plain pseudo-class.
	classes += (rest.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g) ?? []).length;
	// A type selector: a bare name not preceded by `.`, `#`, `:` or `-`.
	types += (rest.match(/(?<![.#:\w-])[a-zA-Z][\w-]*/g) ?? []).length;

	return [ids, classes, types];
}

const beats = (a: readonly [number, number, number], b: readonly [number, number, number]): boolean =>
	a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];

/** Module scope because it captures nothing per-call; `unicorn/consistent-function-scoping`. */
const vueFilesUnder = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? vueFilesUnder(`${dir}/${entry.name}`)
			: entry.name.endsWith('.vue')
				? [`${dir}/${entry.name}`]
				: [],
	);

/** Every `rp-*` class this project puts on a `<button>`, from the templates rather than a list. */
function buttonClasses(): Set<string> {
	const found = new Set<string>();

	for (const file of vueFilesUnder('src/presentation')) {
		// The OPENING TAG only, so a class on a sibling element inside the button's own markup is
		// not collected as if the button wore it. Both `class="…"` and `:class="{ x: … }"` live in
		// there, and `rp-editor-tool-active` arrives only through the second.
		for (const [tag] of readFileSync(file, 'utf8').matchAll(/<button\b[^>]*>/g)) {
			for (const [cls] of tag.matchAll(/\brp-[\w-]+/g)) found.add(`.${cls}`);
		}
	}

	return found;
}

/** Every sheet that can style one: the ones that ship, plus the harness's own chrome. */
const sheets = [
	...readdirSync('styles')
		.filter((file) => file.endsWith('.css') && file !== 'index.css')
		.map((file) => `styles/${file}`),
	'tests/harness/theme.css',
];

/** Each rule as `[selector, declarations]`, comments stripped so prose cannot be read as CSS. */
const rulesIn = (css: string): Array<[string, string]> =>
	[...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [
		selector.trim(),
		body,
	]);

/**
 * Does this selector's SUBJECT — its last compound, the element the rule actually styles — carry
 * the class? An ancestor mention does not count: `.rp-dialog-button .icon` styles the icon.
 */
const subjectCarries = (selector: string, cls: string): boolean => {
	const subject = selector.split(/\s+|>|\+|~/).filter(Boolean).pop() ?? '';

	return subject.includes(cls);
};

describe('the instrument', () => {
	it.each([
		['button:not(.clickable-icon)', [0, 1, 1]],
		['.rp-dialog-button', [0, 1, 0]],
		['.rp-dialog .rp-dialog-button-danger', [0, 2, 0]],
		['.rp-harness-scheme.rp-harness-scheme', [0, 2, 0]],
		['.rp-editor-toolbar .rp-editor-tool-button:disabled', [0, 3, 0]],
		['#id div.a::after', [1, 1, 2]],
	])('scores %s', (selector, expected) => {
		expect(specificityOf(selector)).toEqual(expected);
	});

	// The two the threshold itself depends on. Score `:not()` as if it were free and Obsidian's
	// rule reads (0,0,1), which every bare class would then beat — this file would pass while
	// every rule it guards lost in the browser.
	it('gives :not() its argument, which is the whole reason the threshold is (0,1,1)', () => {
		expect(specificityOf('button:not(.clickable-icon)')).toEqual([...OBSIDIAN_BUTTON]);
		expect(beats(specificityOf('.rp-dialog-button'), OBSIDIAN_BUTTON)).toBe(false);
		expect(beats(specificityOf('.rp-dialog .rp-dialog-button-danger'), OBSIDIAN_BUTTON)).toBe(true);
	});

	// `:where()` is the exception in the same family — specificity ZERO, argument included.
	it('gives :where() nothing', () => {
		expect(specificityOf(':where(.a, .b) .c')).toEqual([0, 1, 0]);
	});

	it('reads the classes off real buttons, and finds the ones only a :class binding carries', () => {
		const classes = buttonClasses();

		expect(classes.size).toBeGreaterThan(3);
		expect(classes).toContain('.rp-editor-tool-active');
		expect(classes).toContain('.rp-dialog-button-danger');
	});

	it('scans sheets that exist and hold rules', () => {
		expect(sheets.length).toBeGreaterThan(3);
		expect(rulesIn(readFileSync('styles/editor.css', 'utf8')).length).toBeGreaterThan(5);
	});
});

describe('every button rule against Obsidian\'s own', () => {
	it('outranks button:not(.clickable-icon) wherever it sets a property that rule also sets', () => {
		const classes = buttonClasses();
		const losing: string[] = [];

		for (const sheet of sheets) {
			for (const [prelude, body] of rulesIn(readFileSync(sheet, 'utf8'))) {
				if (!CONTESTED.some((property) => new RegExp(`(^|[;{\\s])${property}\\s*:`).test(body))) continue;

				for (const selector of prelude.split(',').map((part) => part.trim())) {
					const cls = [...classes].find((candidate) => subjectCarries(selector, candidate));

					if (cls === undefined || DEFERS_TO_THE_HOST.includes(cls)) continue;
					if (!beats(specificityOf(selector), OBSIDIAN_BUTTON)) losing.push(`${sheet}: ${selector}`);
				}
			}
		}

		expect(losing).toEqual([]);
	});

	/**
	 * FLATTENING A BUTTON TAKES ITS FOCUS RING WITH IT, and this is the check for that.
	 *
	 * A rule that beats (0,1,1) on `box-shadow` also beats Obsidian's `button:focus-visible`,
	 * which is where a button's ring comes from — and Obsidian's global `:focus { outline: none }`
	 * has already taken the outline, so nothing is left. Measured on a focused toolbar button
	 * after the specificity fix and before this one: `outline: none`, `box-shadow: none`, both
	 * schemes. The same pull request that fixed exactly this defect on the index's entry links
	 * reintroduced it on four other controls, by fixing something else. It was caught by review,
	 * not by any gate here — jsdom resolves no `:focus-visible`, and a capture only shows it if
	 * something happens to be focused when the shutter opens.
	 *
	 * So the rule is stated where it can be enforced: a subject that suppresses `box-shadow` must
	 * have a `:focus-visible` rule of its own. It does not check what that rule DRAWS — that is a
	 * contrast question no gate here can answer (`--interactive-accent` was chosen over Obsidian's
	 * own ring token by measuring both in a browser; the numbers are in `styles/editor.css`).
	 */
	it('gives every flattened button a focus-visible rule, since suppressing the shadow removes the ring', () => {
		const classes = buttonClasses();
		const flattened = new Map<string, string>();
		const ringed = new Set<string>();

		for (const sheet of sheets) {
			for (const [prelude, body] of rulesIn(readFileSync(sheet, 'utf8'))) {
				for (const selector of prelude.split(',').map((part) => part.trim())) {
					const cls = [...classes].find((candidate) => subjectCarries(selector, candidate));

					if (cls === undefined) continue;
					if (selector.includes(':focus-visible')) ringed.add(cls);
					// The base rule only — a `:hover` or `:disabled` variant suppressing the shadow
					// says nothing about the resting state a ring is drawn on.
					else if (/box-shadow\s*:\s*none/.test(body)) flattened.set(cls, `${sheet}: ${selector}`);
				}
			}
		}

		expect([...flattened].filter(([cls]) => !ringed.has(cls)).map(([, where]) => where)).toEqual([]);
		// The set must not be empty, or this passes by scanning nothing — the same trap
		// `accessibility.test.ts` names for an `it.each` over an empty array.
		expect(flattened.size).toBeGreaterThan(2);
	});

	/**
	 * The check above is a negative, and a negative that has never fired is not known to fire.
	 * This drives the exact spelling every one of the five real defects had — a bare class on a
	 * button, setting a contested property — through the same predicate.
	 */
	it('reports a bare class that sets one of the contested properties', () => {
		const bare = '.rp-editor-tool-active';

		expect(buttonClasses()).toContain(bare);
		expect(beats(specificityOf(bare), OBSIDIAN_BUTTON)).toBe(false);
	});
});
