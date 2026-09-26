/**
 * @vitest-environment jsdom
 *
 * **The node map reproduces the fixture SVG it was transcribed from, for every fixture.**
 *
 * A harness icon is TWO files and only one of them is executable. `tests/fixtures/editor-icons/`
 * holds the pinned Lucide SVG — provenance, and what the LICENSE there covers — while
 * `editorIconNodes.ts` holds the nodes `obsidianIcons.ts`'s test-only `setIcon` actually appends.
 * Its README calls those entries "mechanically transcribed". There is no generator under
 * `scripts/` — `grep -rn editorIconNodes scripts/` prints nothing — and that command is scoped to
 * `scripts/`, so it cannot see the METHOD: repository-wide, one hand-off plan
 * (`docs/superpowers/plans/2026-09-10-editor-copy-paste.md`) carries a throwaway `node -e` recipe
 * that pulls the nodes out with a REGEX over the SVG text and tells the reader to paste what it
 * printed. So "mechanically" named something real rather than only an intention. What the word
 * did NOT name is anything that re-runs — a recipe pasted once is a transcription by hand from the
 * next edit onwards, and the regex it used is the very instrument this repository bans for
 * reading source text.
 *
 * Two failures it can see and nothing else could. An SVG added with no map entry renders NOTHING
 * while looking, in a directory listing, exactly like a fixture that works — the shape wave 13
 * arrived in, where three `.svg` files alone left three buttons still empty. And an entry whose
 * `d` lost a character draws a subtly wrong glyph that every existing case passes, because every
 * existing case reads the icon NAME.
 *
 * **It parses rather than greps.** `DOMParser` is the same instrument `obsidianIcons.ts` uses for
 * a registered custom icon, so what this compares is the children a browser reads out of the
 * file, at whatever indentation or attribute spacing the upstream file happens to carry.
 *
 * **Three things it does NOT check, named because each reads as covered.** That the pinned bytes
 * are what Lucide serves at the revision the README names — nothing here reaches the network, so
 * provenance stays a reviewer's job against that README, exactly as it was. Attribute ORDER:
 * `toEqual` compares plain objects by key SET, so a map entry that lists the same attributes in
 * another order passes. That is harmless, because SVG attribute order is semantically inert and
 * `setIcon` replays them through `setAttribute` either way — but the property is unchecked and the
 * word "mechanical" should not be read as covering it. And DEPTH: the comparison is one level,
 * `svg.documentElement.children`, because that is exactly what `setIcon` rebuilds — a tag plus its
 * attributes, appending no children of its own. A fixture carrying a nested `<g>` would compare
 * equal here while rendering as an empty group. All 64 fixtures are flat today, so this is latent
 * rather than live, and the day it stops being latent is the day `setIcon` needs the recursion
 * first.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import { editorIconNodes } from './editorIconNodes';

const FIXTURES = 'tests/fixtures/editor-icons';

/**
 * The one fixture whose map key is not its filename, named rather than normalized away.
 *
 * The README records why: Obsidian 1.13.7's canonical key for upstream `grid-2x2.svg` is
 * `grid-2x-2`, so the map uses the HOST key while the file keeps its upstream name. A general
 * normalizer over hyphens would swallow that and silently accept any future misspelling with it;
 * a one-entry table fails loudly the day a second rename arrives, which is when somebody should
 * be reading this comment.
 */
const HOST_KEYS: Readonly<Record<string, string>> = { 'grid-2x2': 'grid-2x-2' };

/** The children a browser reads out of one fixture, in document order. Attribute order is not compared — see the header. */
function fixtureNodes(file: string): { tag: string; attributes: Record<string, string> }[] {
	const svg = new DOMParser().parseFromString(readFileSync(`${FIXTURES}/${file}`, 'utf8'), 'image/svg+xml');
	expect(svg.querySelector('parsererror')).toBeNull();
	return [...svg.documentElement.children].map((node) => ({
		tag: node.tagName,
		attributes: Object.fromEntries([...node.attributes].map((attribute) => [attribute.name, attribute.value])),
	}));
}

const FILES = readdirSync(FIXTURES).filter((file) => file.endsWith('.svg'));
const keyOf = (file: string): string => HOST_KEYS[basename(file, '.svg')] ?? basename(file, '.svg');

describe('the harness icon node map', () => {
	it.each(FILES)('transcribes %s into the entry the renderer reads', (file) => {
		expect(editorIconNodes[keyOf(file)]).toEqual(fixtureNodes(file));
	});

	/**
	 * The other direction, which is the one a DELETION breaks: an entry whose SVG is gone has lost
	 * the file that licenses it, and `LICENSE` beside those fixtures is why that matters here
	 * rather than it being mere tidiness.
	 *
	 * **It is also what refuses an instrument that reached nothing**, which is why no separate
	 * floor case sits above it. A glob narrowed to a handful of files — or to none — leaves the
	 * `it.each` above quietly checking fewer entries and saying so in the voice of a clean tree,
	 * and fails HERE, loudly, naming every key whose file went missing. A `FILES.length >= 64`
	 * floor beside it would add only a hand-maintained number nobody revisits.
	 */
	it('holds no entry without a fixture behind it', () => {
		expect(Object.keys(editorIconNodes).toSorted()).toEqual(FILES.map((file) => keyOf(file)).toSorted());
	});
});
