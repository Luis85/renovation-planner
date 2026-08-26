// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import type { Selector } from 'lightningcss';
import { compoundHasClass, compoundsOf, stylesheetRules, typeOf } from '../helpers/selectors';
import { afterEach, describe, expect, it } from 'vitest';
import { entryShots } from '../../scripts/entryShots.mjs';
import { openIndex } from './indexApp';

/**
 * Which of the index's two routes draws the picker beside the stage.
 *
 * The picker is a fixed-width sidebar, and at the narrow viewport that matters most it took
 * roughly 210px of a 460px capture — so a mock laid itself out in 250px while the picture
 * claimed 460, and the author compensated by eye. `&bare` is what a capture asks for, and
 * `scripts/entryShots.mjs` puts it on every named-entry shot.
 *
 * Opt-in, and the second case is why. Hiding the picker for every `?entry=` was the obvious
 * version: it makes a directly-opened entry a dead end reachable only by editing the URL, and
 * it collides with criterion 8, which wants a failing entry to name itself IN the index rather
 * than blank the page. Seven cases in `indexPage.test.ts` navigate by clicking a row after
 * opening an entry, which is how that version was caught.
 */

afterEach(() => {
	document.body.innerHTML = '';
});

const navRows = async (query: string) => {
	const wrapper = await openIndex(query);
	try {
		return wrapper.findAll('nav li').length;
	} finally {
		wrapper.unmount();
	}
};

describe('the harness index, on which route drew it', () => {
	it('keeps the picker at ?index, which is the route for choosing', async () => {
		expect(await navRows('index')).toBeGreaterThan(0);
	});

	it('keeps it at ?entry=, since the list is how a person moves between entries', async () => {
		expect(await navRows('entry=prototype:ZonePanel')).toBeGreaterThan(0);
	});

	it('drops it at &bare, so a capture measures the screen and not the harness', async () => {
		expect(await navRows('entry=prototype:ZonePanel&bare')).toBe(0);
	});

	// The capture asks for it; nothing else does. A shot whose query lost this parameter would
	// go back to measuring the sidebar, silently and with every assertion still green.
	it('is what every named-entry capture asks for', () => {
		expect(entryShots('prototype:ZonePanel').map((shot) => shot.query.includes('&bare'))).toEqual([true, true]);
	});
});

/**
 * THE PICKER'S RULES MAY NOT REACH THE STAGE, which is `theme.css`'s second header rule and the
 * one its first cannot imply.
 *
 * `.rp-harness-index` holds BOTH the picker and `<main class="rp-harness-stage">`, so any
 * descendant selector rooted there styles whatever entry is mounted. `.rp-harness-index h2` —
 * a perfectly reasonable-looking rule naming no Obsidian class, so the first header rule passes
 * it — drew every entry's own `<h2>` in the picker's uppercase tracked type. It shipped for one
 * capture and was caught by eye, on `WorkPackages.vue`'s title.
 *
 * Nothing else here can see it. jsdom resolves no cascade, so no mounted-component assertion in
 * this suite changes; the accessibility scan grades semantics, which are untouched; and a
 * capture only shows it to somebody who happens to have an entry open at the time. So the check
 * is on the FORBIDDEN THING — the shape of the selector — per `CLAUDE.md`'s rule about category
 * invariants, and it therefore holds for rules nobody has written yet.
 *
 * **Read through `lightningcss`, the parser this project already ships with.** This file grew a
 * hand-rolled reader and review found four holes in it in four consecutive rounds — a pattern
 * anchored on the whitespace after a class, a raw comma split cutting `:is(.a, .b)` in half, a
 * combinator split that lost `>` because whitespace sat on both sides of it, and a relationship
 * nested inside a pseudo that the scanner kept whole and never looked into. Every one was the
 * same defect: a selector is a grammar and a regex is not a parser. `tests/helpers/selectors.ts`
 * carries the account and the shared reader.
 */
const PICKER_ROOT = 'rp-harness-index';

/** Every selector in a stylesheet whose text mentions the index root, at any depth. */
const indexSelectors = (css: string): Selector[] =>
	stylesheetRules(css)
		.flatMap((rule) => rule.selectors)
		.filter((selector) => compoundsOf(selector).some((compound) => compoundHasClass(compound, PICKER_ROOT)));

/**
 * Does this selector reach a DESCENDANT of `.rp-harness-index`?
 *
 * The rule, stated once: a compound carrying the root, with something after it that is not
 * reached through a child hop INTO THE PICKER. Four spellings have had to be taught to it and
 * every one is a case below — a plain descendant, a qualified root, a root inside a functional
 * pseudo, and a sibling hop off the nav.
 *
 * The nav is the only safe child. Treating every `>` as safe let `.rp-harness-index > main h2`
 * through: one child hop, then a descent into the stage. And reaching the nav is not the end of
 * the walk either — `.rp-harness-index > nav + main h2` steps sideways onto the stage beside it.
 * Only the hop DIRECTLY after the nav can escape, because anything deeper is already a
 * descendant of the nav and a sibling of a descendant shares its parent.
 */
const reachesTheStage = (selector: Selector): boolean => {
	const compounds = compoundsOf(selector);
	const at = compounds.findIndex((compound) => compoundHasClass(compound, PICKER_ROOT));

	if (at === -1) return false;

	// The WHOLE relationship can live inside a functional pseudo — `:is(.rp-harness-index > main
	// h2)` — where the compound carrying the root is also the last one, and every question below
	// would read it as a root with nothing after it. Its arguments are asked the same question.
	const nested = compounds[at].components
		.flatMap((component) => (component.type === 'pseudo-class' && 'selectors' in component ? component.selectors : []))
		.some((argument) => reachesTheStage(argument));

	if (nested) return true;
	if (at === compounds.length - 1) return false;
	if (compounds[at].after !== 'child') return true;
	if (typeOf(compounds[at + 1]) !== 'nav') return true;

	return compounds[at + 1].after === 'next-sibling' || compounds[at + 1].after === 'later-sibling';
};

/** A selector rendered back to text, so a failure names something a reader can grep for. */
const show = (selector: Selector): string =>
	selector
		.map((component) => {
			if (component.type === 'class') return `.${component.name}`;
			if (component.type === 'type') return component.name;
			if (component.type === 'combinator') return component.value === 'descendant' ? ' ' : ` ${component.value} `;
			if (component.type === 'pseudo-class') return `:${component.kind}`;

			return '';
		})
		.join('');

describe('the picker stylesheet, on what its selectors can reach', () => {
	it('roots every index rule at a direct-child nav, so no rule reaches a mounted entry', () => {
		const offenders = indexSelectors(readFileSync('tests/harness/theme.css', 'utf8'))
			.filter((selector) => reachesTheStage(selector))
			.map((selector) => show(selector));

		expect(offenders).toEqual([]);
	});

	/**
	 * The instrument, proved to bite before its green result is trusted — the same bargain
	 * `accessibility.test.ts` makes with its unlabelled `<img>`. Both spellings of the defect are
	 * driven: the one that actually shipped, and a deeper one that a check looking only at the
	 * next token would miss.
	 */
	it.each([
		['the rule that shipped', '.rp-harness-index h2 { text-transform: uppercase; }'],
		['a deeper descendant', '.rp-harness-index section p em { color: red; }'],
		// The two a pattern anchored on "whitespace right after the class" lets through. Neither
		// exists today; the check is written to the shape so that adding one cannot open the hole.
		['a qualified root', '.rp-harness-index.theme-dark h2 { color: red; }'],
		['a root inside a functional pseudo', ':is(.rp-harness-index) h2 { color: red; }'],
		// The SELECTOR-LIST form, which the single-argument case above does not exercise: its
		// comma is what a raw prelude split cuts the selector in half on.
		['a root inside a selector list', ':is(.rp-harness-index, .other) h2 { color: red; }'],
		// One `>` and then a descent into the STAGE. The child combinator is not the guarantee —
		// which child it names is.
		['a descent through the stage element', '.rp-harness-index > main h2 { color: red; }'],
		['a descent through the stage class', '.rp-harness-index > .rp-harness-stage h2 { color: red; }'],
		// Reaches the picker, then steps sideways onto the stage beside it.
		['a sibling hop off the picker', '.rp-harness-index > nav + main h2 { color: red; }'],
		['a general sibling hop off the picker', '.rp-harness-index > nav ~ main h2 { color: red; }'],
		// The whole relationship nested inside the pseudo, where the compound scan sees one token.
		['a relationship nested in a pseudo', ':is(.rp-harness-index > main h2) { color: red; }'],
		['a descendant nested in a pseudo', ':is(.rp-harness-index h2) { color: red; }'],
	])('reports %s', (_case, css) => {
		expect(indexSelectors(css).filter((selector) => reachesTheStage(selector))).toHaveLength(1);
	});

	/**
	 * And says nothing about the three legitimate shapes, so the pattern is not simply refusing
	 * every mention of the class: the root rule itself, a scoped child, and the `:not()` this
	 * file's growth chain actually uses.
	 */
	it.each([
		['the root rule', '.rp-harness-index { display: flex; }'],
		['a scoped child', '.rp-harness-index > nav li a { color: red; }'],
		// A sibling DEEPER than the nav stays inside it, so it is not a leak.
		['a sibling inside the picker', '.rp-harness-index > nav li + li { color: red; }'],
		// A safe relationship nested in a pseudo must stay silent too, or the recursion is just
		// a blanket refusal of every pseudo that mentions the root.
		['a safe relationship nested in a pseudo', ':is(.rp-harness-index > nav li) { color: red; }'],
		['an exclusion', '.rp-harness-leaf > div:not(.rp-harness-index) { flex: 1; }'],
	])('says nothing about %s', (_case, css) => {
		expect(indexSelectors(css).filter((selector) => reachesTheStage(selector))).toEqual([]);
	});
});
