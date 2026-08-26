import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from '../helpers/oxlint';

/**
 * THE criterion the whole feature is for. Promotion must add a `<script setup>` and move the
 * file — never redraw the markup. If a template cannot cross that boundary unchanged, the
 * rewrite this replaces has only moved somewhere else.
 *
 * The two sides are INDEPENDENT files. An earlier version composed the promoted side by
 * interpolating the mock's own template, which made the comparison a string against itself:
 * it could not fail, and would have stayed green while a real promotion redrew everything.
 *
 * A consequence worth stating, because the first independent pair failed on it: **nothing
 * explanatory may live inside a `<template>` block in this tree.** The comparison is
 * byte-for-byte, so a comment in the mock and not in the promoted file fails the test — and
 * copying it across would carry a note about mocks into shipped code. Commentary goes above
 * the template in a mock and in the script block of a promoted component.
 *
 * And no comment may SPELL the opening template tag: this function finds the block by regex,
 * so a comment naming it makes the extraction start mid-comment and the two files can never
 * match. Writing the plan this came from hit exactly that.
 *
 * **What iterating on the design costs, said here because this test is what forces it.** The two
 * templates being byte-identical is also a CLONE, and fallow reports it; `.fallowrc.json`'s
 * `duplicates.ignoredClones` silences that one reviewed pair by a content digest. So editing the
 * mock's template means editing the promoted fixture's to match (this test) and pasting a new
 * digest into `.fallowrc.json` (`npm run analyze`, which prints it). An opaque hash in the design
 * iteration loop is a real cost of holding this criterion by an independent pair; it is named in
 * all three places rather than being discovered on a red `npm run analyze`.
 */
const MOCK = path.join(REPO, 'src', 'prototypes', 'ZoneSummary.vue');
const PROMOTED = path.join(REPO, 'tests', 'fixtures', 'promotion', 'ZoneSummary.promoted.vue');

/**
 * The `<template>` block, with its delimiters, or null when there is none.
 *
 * Greedy on purpose: a real SFC can nest a bare `<template v-if="…">` grouping tag INSIDE
 * its one top-level block, and that inner tag's own `</template>` closes before the real
 * one does — a non-greedy match would stop there and silently truncate the block. Greedy
 * matches to the LAST `</template>` in the file instead, which is correct for exactly one
 * top-level block and wrong only if a file had a second one — invalid Vue (an SFC has one
 * template root), so a widened match here would mean the file was already broken. `<template
 * lang=…>` is the case that fails LOUDLY instead: this regex only matches the bare tag, so a
 * `lang` attribute returns null and the caller's own labelled assertion catches it.
 */
function templateBlock(sfc: string): string | null {
	const match = sfc.match(/<template>[\s\S]*<\/template>/);

	return match ? match[0] : null;
}

/**
 * `sfc` with every HTML comment (`<!-- … -->`) removed — the same move this branch already
 * made for the harness's own comment-stripping scan of a forbidden CODE shape, and for the
 * same reason: "is template-only" is a claim about the markup, not about prose explaining
 * the markup, and a substring scan over the whole file cannot tell those apart. Without this,
 * a mock's own commentary is refused the plain word `<script>` — the mock this file guards
 * once dodged that by writing "script-setup" hyphenated, which is a comment obeying the test
 * instead of the test checking the real invariant.
 */
function withoutCommentary(sfc: string): string {
	return sfc.replace(/<!--[\s\S]*?-->/g, '');
}

describe('promoting a mock', () => {
	it('leaves the template byte-identical', () => {
		const mock = templateBlock(readFileSync(MOCK, 'utf8'));
		const promoted = templateBlock(readFileSync(PROMOTED, 'utf8'));

		expect(mock, 'the mock has no <template> block').not.toBeNull();
		expect(promoted, 'the promoted fixture has no <template> block').not.toBeNull();
		expect(promoted).toBe(mock);
	});

	it('is template-only before promotion', () => {
		expect(withoutCommentary(readFileSync(MOCK, 'utf8'))).not.toContain('<script');
	});

	it('gains a script block on promotion, which is what promotion IS', () => {
		expect(readFileSync(PROMOTED, 'utf8')).toContain('<script setup lang="ts">');
	});
});
