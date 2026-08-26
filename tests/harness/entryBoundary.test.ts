// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openIndex } from './indexApp';

/**
 * The one invariant `IndexPage.vue`'s warning channel rests on, which was asserted in several
 * paragraphs of comment and by nothing else.
 *
 * Vue allows exactly one `warnHandler` per app, so a warning cannot be routed to the entry that
 * raised it by any per-mount hook. `EntryBoundary` publishes `warningOwner` instead — sound
 * while exactly one boundary is alive, which the template arranges and nothing checked. A second
 * entry pane would put two boundaries in the tree, the second would publish over the first, and
 * warnings A raised would go out under B's name with no error anywhere.
 *
 * **The scope of that state was measured while writing this file, and it is not what the
 * comments used to say.** A `<script setup>` block's top-level bindings run inside `setup()`, so
 * `warningOwner` and the boundary counter are per mounted `IndexPage`, not per module. Two
 * indexes therefore hold two independent channels — which is correct rather than accidental,
 * since `warnHandler` is installed per app and two indexes are two apps. The first version of
 * this file assumed the opposite and asserted that a second mounted index trips the counter; it
 * does not, and the case below pins that it does not.
 *
 * Which leaves the real invariant as a TEMPLATE one, so it is checked at the template. The
 * counter in `IndexPage.vue` stays as the defence for what a source scan cannot describe — a
 * `v-for`, a second `<Suspense>` branch, a boundary moved into a child — and reports through
 * `console.error`, the channel `scripts/harness-shot.mjs` exits non-zero on.
 */

const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

afterEach(() => {
	errors.mockClear();
	document.body.innerHTML = '';
});

const source = readFileSync('tests/harness/IndexPage.vue', 'utf8');
const template = source.slice(source.indexOf('<template>'));

describe('the entry boundary', () => {
	/**
	 * The forbidden thing is a second `<EntryBoundary` in the template, so that is where the
	 * check goes — not a list of the paths someone thought of. The opening tag rather than the
	 * component name: the name appears in `defineComponent` and throughout the comments, and
	 * counting those would make this case about prose.
	 */
	it('is mounted from exactly one place in the template', () => {
		expect([...template.matchAll(/<EntryBoundary[\s>]/g)]).toHaveLength(1);
	});

	// The instrument, before trusting the count of one: a slice that missed the template would
	// find zero matches and the case above would be asserting about an empty string.
	it('is measured against a template that was actually found', () => {
		expect(template).toContain('<Suspense');
		expect(template.length).toBeGreaterThan(200);
	});

	it('says nothing while one index holds the only one', async () => {
		const only = await openIndex('entry=prototype:ZonePanel');

		expect(errors.mock.calls).toEqual([]);

		only.unmount();
	});

	/**
	 * Two mounted indexes are two apps, two `warnHandler`s and two counters, so this is NOT the
	 * defect the counter exists for and must not report as one. Pinned because the obvious
	 * reading of "module state" says otherwise, and that reading is what the comments in
	 * `IndexPage.vue` used to carry.
	 */
	it('treats a second mounted index as its own page, not as a second boundary', async () => {
		const first = await openIndex('entry=prototype:ZonePanel');
		const second = await openIndex('entry=prototype:ZonePanel');

		expect(first.find('.rp-zone-summary').exists(), 'the first index closed instead of staying open').toBe(true);
		expect(second.find('.rp-zone-summary').exists()).toBe(true);
		expect(errors.mock.calls).toEqual([]);

		first.unmount();
		second.unmount();
	});
});
