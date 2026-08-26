// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
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
 * The prelude sweep is `harness.test.ts`'s own `harnessGrowthSelectors` pattern: comments
 * stripped, then every `selector { body }` pair. It sees the file as text rather than as a
 * cascade, which is enough here because the property being checked IS textual.
 */
const indexSelectors = (css: string): string[] =>
	[...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{[^{}]*\}/g)]
		.flatMap(([, prelude]) => prelude.split(','))
		.map((selector) => selector.trim())
		.filter((selector) => selector.includes('.rp-harness-index'));

/**
 * A descendant of `.rp-harness-index` that is not reached through `>`.
 *
 * `\\s+(?![>{])` is the whole test: a child combinator is spelled with `>`, a rule's own body
 * opens with `{`, and anything else after whitespace is a descendant. `:not(.rp-harness-index)`
 * — which `theme.css` really does contain — has no whitespace after the class and so is not a
 * match, which is the case that makes a blunter pattern wrong.
 */
const REACHES_THE_STAGE = /\.rp-harness-index\s+(?![>{])/;

describe('the picker stylesheet, on what its selectors can reach', () => {
	it('roots every index rule at a direct-child nav, so no rule reaches a mounted entry', () => {
		const offenders = indexSelectors(readFileSync('tests/harness/theme.css', 'utf8')).filter((selector) =>
			REACHES_THE_STAGE.test(selector),
		);

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
	])('reports %s', (_case, css) => {
		expect(indexSelectors(css).filter((selector) => REACHES_THE_STAGE.test(selector))).toHaveLength(1);
	});

	/**
	 * And says nothing about the three legitimate shapes, so the pattern is not simply refusing
	 * every mention of the class: the root rule itself, a scoped child, and the `:not()` this
	 * file's growth chain actually uses.
	 */
	it.each([
		['the root rule', '.rp-harness-index { display: flex; }'],
		['a scoped child', '.rp-harness-index > nav li a { color: red; }'],
		['an exclusion', '.rp-harness-leaf > div:not(.rp-harness-index) { flex: 1; }'],
	])('says nothing about %s', (_case, css) => {
		expect(indexSelectors(css).filter((selector) => REACHES_THE_STAGE.test(selector))).toEqual([]);
	});
});
