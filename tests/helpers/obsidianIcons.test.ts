/**
 * @vitest-environment jsdom
 *
 * **The test-only `setIcon` MARKS a name it cannot draw, and that mark is the one positive
 * statement eight other cases quietly depend on.**
 *
 * `tests/fixtures/editor-icons/README.md` states the rule this fake exists to keep: an unknown
 * request is recorded with `data-icon-missing` and never answered with a different icon. Every
 * other assertion about it anywhere in `tests/**` is a NEGATIVE — `toBeUndefined()`,
 * `exists()).toBe(false)`, `toEqual([])` — because what those surfaces want to say is that they
 * ask for nothing the harness lacks.
 *
 * A wall of negatives has a failure mode a wall of positives does not: delete the line that WRITES
 * the attribute and every one of them still passes. That is not hypothetical. Until wave 13 landed
 * the fixtures for `circle`, `squircle` and `anchor`, `designerIconToolbar.test.ts` pinned those
 * three as a non-empty set and was the tree's only positive producer; emptying it \u2014 correctly,
 * since the glyphs now draw \u2014 took the last one with it, and deleting
 * `parent.dataset.iconMissing = canonicalName` from `obsidianIcons.ts` left ten test files and
 * 197 cases green. This file is that guard, put back on the producing side where a wave that
 * legitimately empties a consumer cannot carry it off again.
 *
 * **It is CLAUDE.md's fake rule one layer down.** A fake must not be kinder than the real thing;
 * here the thing at risk was not the fake's strictness but the instrument that reports it, which
 * fails in the quietest available direction \u2014 silently, into green.
 *
 * Sited beside `obsidianIcons.ts` rather than inside `editorIconNodes.test.ts`, which is the other
 * file that could have carried it: the claim is about what the RENDERER does with a name the map
 * does not answer, and the next person to touch that line opens the file named after it.
 */
import { describe, expect, it } from 'vitest';
import { editorIconNodes } from './editorIconNodes';
import { setIcon } from './obsidianIcons';

/** Whatever `setIcon` built, in the shape `editorIconNodes` holds \u2014 so the two can be compared directly. */
const rendered = (host: HTMLElement): { tag: string; attributes: Record<string, string> }[] =>
	[...(host.querySelector('svg')?.children ?? [])].map((node) => ({
		tag: node.tagName,
		attributes: Object.fromEntries([...node.attributes].map((attribute) => [attribute.name, attribute.value])),
	}));

describe('the harness setIcon', () => {
	/**
	 * Both halves of the README's rule in one case, because either alone passes against a fake that
	 * breaks the other: a renderer that marked the name AND drew a substitute would satisfy the
	 * first assertion, and one that drew nothing and said nothing would satisfy the second.
	 */
	it('marks a name the map does not answer, and draws nothing in its place', () => {
		const host = document.createElement('span');

		setIcon(host, 'not-a-pinned-fixture');

		expect(host.dataset.iconMissing).toBe('not-a-pinned-fixture');
		expect(host.querySelector('svg')).toBeNull();
	});

	/**
	 * The same element, deliberately: `HostIcon` calls `setIcon` again on a span it has already
	 * used, so a mark left behind would make a drawn glyph report itself as missing forever after.
	 * That pins `delete parent.dataset.iconMissing`, the producer's other half, which a case using
	 * a fresh element could not see.
	 *
	 * What it renders is compared against the map rather than against a transcribed literal, so
	 * this says "the renderer replays the entry" and nothing about whether the entry is right \u2014
	 * `editorIconNodes.test.ts` owns that, against the SVG. The two together are the whole chain
	 * from the pinned file to the DOM, and neither alone is.
	 */
	it('clears the mark and replays the entry for a name the map does answer', () => {
		const host = document.createElement('span');
		setIcon(host, 'not-a-pinned-fixture');

		setIcon(host, 'circle');

		expect(host.dataset.iconMissing).toBeUndefined();
		expect(rendered(host)).toEqual(editorIconNodes['circle']);
	});
});
