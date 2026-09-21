/**
 * @vitest-environment jsdom
 *
 * **The node map reproduces the fixture SVG it was transcribed from, for every fixture.**
 *
 * A harness icon is TWO files and only one of them is executable. `tests/fixtures/editor-icons/`
 * holds the pinned Lucide SVG — provenance, and what the LICENSE there covers — while
 * `editorIconNodes.ts` holds the nodes `obsidianIcons.ts`'s test-only `setIcon` actually appends.
 * Its README calls those entries "mechanically transcribed", which means BY HAND: there is no
 * generator (`grep -rn editorIconNodes scripts/` prints nothing), so the word "mechanically"
 * described an intention and nothing re-ran it.
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
 * What it does NOT check: that the pinned bytes are what Lucide serves at the revision the README
 * names. Nothing here reaches the network, so provenance stays a reviewer's job against that
 * README, exactly as it was.
 */
import { readFileSync, readdirSync } from 'node:fs';
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

/** The children a browser reads out of one fixture, in document order, attributes in source order. */
function fixtureNodes(file: string): { tag: string; attributes: Record<string, string> }[] {
	const svg = new DOMParser().parseFromString(readFileSync(`${FIXTURES}/${file}`, 'utf8'), 'image/svg+xml');
	expect(svg.querySelector('parsererror')).toBeNull();
	return [...svg.documentElement.children].map((node) => ({
		tag: node.tagName,
		attributes: Object.fromEntries([...node.attributes].map((attribute) => [attribute.name, attribute.value])),
	}));
}

const FILES = readdirSync(FIXTURES).filter((file) => file.endsWith('.svg'));
const keyOf = (file: string): string => HOST_KEYS[file.replace(/\.svg$/, '')] ?? file.replace(/\.svg$/, '');

describe('the harness icon node map', () => {
	/**
	 * An instrument that reached no fixture would report a clean directory in exactly the voice of
	 * one that checked every file, so it says out loud that it found some — and the floor is the
	 * count at the time of writing rather than `> 0`, which a glob broken down to one survivor
	 * would still satisfy.
	 */
	it('reaches the fixture directory at all', () => {
		expect(FILES.length).toBeGreaterThanOrEqual(64);
	});

	it.each(FILES)('transcribes %s into the entry the renderer reads', (file) => {
		expect(editorIconNodes[keyOf(file)]).toEqual(fixtureNodes(file));
	});

	/**
	 * And the other direction, which is the one a DELETION breaks: an entry whose SVG is gone has
	 * lost the file that licenses it, and `LICENSE` beside those fixtures is the reason that
	 * matters here rather than being mere tidiness.
	 */
	it('holds no entry without a fixture behind it', () => {
		expect(Object.keys(editorIconNodes).toSorted()).toEqual(FILES.map((file) => keyOf(file)).toSorted());
	});
});
