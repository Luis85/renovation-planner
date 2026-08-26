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

const beats = (a: readonly [number, number, number], b: readonly [number, number, number]): boolean =>
	a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];

/**
 * Split a selector list on its TOP-LEVEL commas only.
 *
 * `:is(.a, .b)` carries a comma that separates nothing at the outer level, and splitting on it
 * cuts one selector into `:is(.a` and `.b)` — two fragments whose specificities are both wrong
 * and neither of which is a selector. Used for a rule's prelude and for the argument of a
 * functional pseudo-class, which is the same problem twice.
 */
const splitTopLevel = (list: string): string[] => {
	const parts: string[] = [];
	let depth = 0;
	let current = '';

	for (const char of list) {
		if (char === '(') depth += 1;
		else if (char === ')') depth -= 1;

		if (char === ',' && depth === 0) {
			parts.push(current);
			current = '';
		} else current += char;
	}

	parts.push(current);
	return parts.map((part) => part.trim()).filter(Boolean);
};

const moreSpecific = (a: [number, number, number], b: [number, number, number]): [number, number, number] =>
	beats(a, b) ? a : b;

/**
 * A selector's (id, class, type) specificity.
 *
 * `:not(...)`/`:is(...)`/`:has(...)` contribute their ARGUMENT's specificity and nothing of their
 * own, which is the whole reason Obsidian's rule scores (0,1,1) rather than (0,0,1) — get that
 * wrong and this file computes the wrong threshold for every case at once. An ordinary
 * pseudo-class (`:hover`, `:disabled`) counts as a class and a pseudo-ELEMENT (`::after`) counts
 * as a type.
 *
 * **A selector LIST inside one of them contributes its MOST SPECIFIC argument, never the sum**
 * (CSS Selectors 4). This summed them, which is a FALSE PASS rather than a false alarm:
 * `:is(.rp-editor-tool-active, .other)` scored (0,2,0) and cleared the threshold while its real
 * specificity is (0,1,0) and it loses to Obsidian's rule. A gate that over-counts lets exactly
 * the rules it exists to catch through.
 *
 * Resolved INNERMOST-FIRST in a loop rather than in one pass, so a nested `:is(.a:not(.b))` is
 * scored rather than skipped: the argument pattern cannot match nested parentheses, and a single
 * `String.replace` never re-scans what it just rewrote.
 *
 * Deliberately not a full CSS parser: it answers for the selector shapes this repository writes,
 * and `describe('the instrument')` below drives it against the ones that matter — including the
 * three it would be easiest to get wrong.
 */
function specificityOf(selector: string): [number, number, number] {
	let rest = selector;
	let ids = 0;
	let classes = 0;
	let types = 0;
	const functional = /:(not|is|has|where)\(([^()]*)\)/;

	// A bound rather than `while (true)`: a malformed selector must not hang the suite. Twenty is
	// far past any nesting depth a stylesheet here would write.
	for (let guard = 0; guard < 20; guard += 1) {
		const match = functional.exec(rest);

		if (match === null) break;
		if (match[1] !== 'where') {
			const [i, c, t] = splitTopLevel(match[2])
				.map((argument) => specificityOf(argument))
				.reduce((best, one) => moreSpecific(best, one), [0, 0, 0]);

			ids += i;
			classes += c;
			types += t;
		}

		rest = `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`;
	}

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
function buttonClasses(): Set<string> {
	const found = new Set<string>();
	const add = (text: string) => {
		for (const [cls] of text.matchAll(/\brp-[\w-]+/g)) found.add(`.${cls}`);
	};

	for (const file of filesUnder('src/presentation', '.vue')) {
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
 * The class tokens on a selector's SUBJECT — its last compound, the element the rule actually
 * styles. An ancestor mention does not count: `.rp-dialog-button .icon` styles the icon.
 *
 * WHOLE TOKENS, which is one of two corrections this needed. It was `subject.includes(cls)`, a
 * substring test, and `.rp-dialog-button` is a PREFIX of `.rp-dialog-button-danger` — so a danger
 * rule matched the base class first, inherited its `DEFERS_TO_THE_HOST` exemption, and was
 * skipped. Measured: reverting `.rp-dialog .rp-dialog-button-danger` to the bare selector that
 * caused the original defect left this file green. The one rule this whole check was written for
 * was the one rule it could not see. The other correction is below.
 */
/**
 * Split on top-level combinators only — descendant, `>`, `+`, `~` — ignoring any inside
 * parentheses. `:is(.a > .b)` carries a `>` that separates nothing at the outer level, the same
 * way `:is(.a, .b)` carries a comma that does not.
 */
const splitCombinators = (selector: string): string[] => {
	const parts: string[] = [];
	let depth = 0;
	let current = '';

	for (const char of selector) {
		if (char === '(') depth += 1;
		else if (char === ')') depth -= 1;

		if (depth === 0 && /[\s>+~]/.test(char)) {
			if (current !== '') parts.push(current);
			current = '';
		} else current += char;
	}

	if (current !== '') parts.push(current);
	return parts;
};

/**
 * The class tokens on a selector's SUBJECT — its last compound, the element the rule actually
 * styles. An ancestor mention does not count: `.rp-dialog-button .icon` styles the icon.
 *
 * Tokens INSIDE a functional pseudo-class count, because they select the subject just as a bare
 * class does: `:is(.rp-editor-tool-active, .other)` styles the active tool. Reading only bare
 * tokens made that rule match no button class at all, so the gate skipped it entirely rather
 * than scoring it — a rule invisible to the check is a worse outcome than one scored wrongly,
 * because no threshold change can ever rescue it.
 */
const subjectClasses = (selector: string): string[] => {
	const subject = splitCombinators(selector).pop() ?? '';

	return [...subject.matchAll(/\.[\w-]+/g)].map(([token]) => token);
};

/** The button classes a selector's subject wears, as exact tokens. */
const buttonClassesOn = (selector: string, classes: Set<string>): string[] =>
	subjectClasses(selector).filter((token) => classes.has(token));

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

	/**
	 * A selector LIST inside `:is()`/`:not()`/`:has()` contributes its MOST SPECIFIC argument,
	 * never the sum (CSS Selectors 4). Summing them is a FALSE PASS, which is the direction that
	 * matters: Codex's example `:is(.rp-editor-tool-active, .other)` scored (0,2,0) and cleared
	 * the threshold while its real specificity is (0,1,0) and it loses to Obsidian's rule.
	 */
	it.each([
		[':is(.a, .b.c)', [0, 2, 0]],
		[':is(.rp-editor-tool-active, .other)', [0, 1, 0]],
		[':not(.a, .b.c)', [0, 2, 0]],
	])('takes the most specific argument of %s, not their sum', (selector, expected) => {
		expect(specificityOf(selector)).toEqual(expected);
	});

	// The argument pattern cannot match nested parentheses, and one `String.replace` pass never
	// re-scans what it rewrote — so an inner pseudo has to be resolved before the outer one.
	it('scores a nested functional pseudo rather than skipping it', () => {
		expect(specificityOf(':is(.a:not(.b))')).toEqual([0, 2, 0]);
	});

	/**
	 * The comma inside `:is(.a, .b)` separates nothing at the outer level. Splitting on it cuts
	 * one selector into two fragments, both scored wrongly and neither of them a selector —
	 * which is how the false pass above reached the gate in the first place.
	 */
	it('splits a prelude only on its top-level commas', () => {
		expect(splitTopLevel(':is(.a, .b), .c')).toEqual([':is(.a, .b)', '.c']);
		expect(splitTopLevel('.a, .b')).toEqual(['.a', '.b']);
	});

	it('reads the classes off real buttons, and finds the ones only a :class binding carries', () => {
		const classes = buttonClasses();

		expect(classes.size).toBeGreaterThan(3);
		expect(classes).toContain('.rp-editor-tool-active');
		expect(classes).toContain('.rp-dialog-button-danger');
	});

	/**
	 * The imperative half. `.rp-harness-scheme` exists only as a `createEl('button', { cls })` in
	 * `tests/harness/theme.ts`, and a scan of Vue templates alone left every rule governing it
	 * unchecked while its sheet sat in `sheets` looking covered.
	 */
	it('finds a button created through createEl, not only one written as a tag', () => {
		expect(buttonClasses()).toContain('.rp-harness-scheme');
	});

	/**
	 * WHOLE TOKENS. `.rp-dialog-button` is a prefix of `.rp-dialog-button-danger`, and a substring
	 * test handed the danger rule the base class's `DEFERS_TO_THE_HOST` exemption — so the one
	 * rule this check was written for was the one rule it skipped.
	 */
	it('does not read a longer class as the shorter one it starts with', () => {
		const classes = new Set(['.rp-dialog-button', '.rp-dialog-button-danger']);

		expect(buttonClassesOn('.rp-dialog .rp-dialog-button-danger', classes)).toEqual(['.rp-dialog-button-danger']);
		expect(buttonClassesOn('.rp-dialog .rp-dialog-button', classes)).toEqual(['.rp-dialog-button']);
	});

	it('reads only the subject, never an ancestor', () => {
		expect(buttonClassesOn('.rp-dialog-button .icon', new Set(['.rp-dialog-button']))).toEqual([]);
	});

	/**
	 * A class inside a functional pseudo still selects the subject, so the rule is still a button
	 * rule. Reading bare tokens only made `:is(.rp-editor-tool-active, .other)` match no button
	 * class at all — the gate SKIPPED it rather than scoring it, which no threshold change could
	 * ever have rescued.
	 */
	it('sees a subject class inside a functional pseudo', () => {
		const classes = new Set(['.rp-editor-tool-active']);

		expect(buttonClassesOn(':is(.rp-editor-tool-active, .other)', classes)).toEqual(['.rp-editor-tool-active']);
	});

	// A combinator inside parentheses separates nothing at the outer level, so the subject of
	// `:is(.a > .b)` is the whole pseudo rather than `.b)`.
	it('splits on top-level combinators only', () => {
		expect(splitCombinators('.rp-dialog :is(.a > .b)')).toEqual(['.rp-dialog', ':is(.a > .b)']);
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

				for (const selector of splitTopLevel(prelude)) {
					const onSubject = buttonClassesOn(selector, classes);

					if (onSubject.length === 0) continue;
					// EVERY token must be a deferring one for the rule to be exempt. A subject wearing
					// both `.rp-dialog-button` and `.rp-dialog-button-danger` is governed by the
					// stricter of the two, which is the case the substring bug got backwards.
					if (onSubject.every((token) => DEFERS_TO_THE_HOST.includes(token))) continue;
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
				for (const selector of splitTopLevel(prelude)) {
					for (const cls of buttonClassesOn(selector, classes)) {
						if (selector.includes(':focus-visible')) ringed.add(cls);
						// The base rule only — a `:hover` or `:disabled` variant suppressing the shadow
						// says nothing about the resting state a ring is drawn on.
						else if (/box-shadow\s*:\s*none/.test(body)) flattened.set(cls, `${sheet}: ${selector}`);
					}
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
