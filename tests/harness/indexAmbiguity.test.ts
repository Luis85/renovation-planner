// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import type { HarnessEntry } from './entries';
import type * as EntriesModule from './entries';
import { indexAppConfig } from './indexApp';

/**
 * A label two entries of the same kind claim, and what the LIST says about it.
 *
 * `registrableComponents` has always had an answer: `<ThatName />` has no deterministic
 * resolution, so the label is registered for nobody and returned in `ambiguous`. The index went
 * on drawing two rows with the same name and the same kind, distinguishable only by an `href`
 * nobody reads — so the picker looked like two ordinary entries while composing either one into
 * a prototype failed with no explanation. That disagreement is what these cases close.
 *
 * The entries are FAKE because the real tree has no such pair — `entries.ts` says so, measured
 * — and a latent defect can only be driven by planting the state that triggers it. Everything
 * else is real: the mock spreads over the actual module, so `registrableComponents` is the one
 * the page calls in a browser rather than a stand-in that would agree with whatever this file
 * expected.
 */
const state = vi.hoisted(() => ({ prototypes: [] as HarnessEntry[], components: [] as HarnessEntry[] }));

vi.mock('./entries', async () => ({
	...(await vi.importActual<typeof EntriesModule>('./entries')),
	prototypeEntries: () => state.prototypes,
	componentEntries: () => state.components,
}));

// After the mock, so the page discovers the planted lists. `vi.mock` is hoisted above it.
const { default: IndexPage } = await import('./IndexPage.vue');

const entry = (id: string, kind: HarnessEntry['kind']): HarnessEntry => ({
	id,
	label: id.split(/[:/]/).pop() ?? id,
	kind,
	component: () => Promise.resolve({ default: { template: '<p>x</p>' } }),
});

/**
 * The list as three separate readings rather than one `li.text()` per row. `text()` concatenates
 * a row's children with nothing between them — `ZonePanelprototype` — because the DOM genuinely
 * has no separator there and the spacing is a stylesheet's job (`theme.css`). Asserting on that
 * joined string would make these cases depend on a rendering detail they are not about, and
 * would go red the day a separator is added to the markup.
 */
const rows = () => {
	const wrapper = mount(IndexPage, { global: indexAppConfig() });

	return {
		wrapper,
		labels: wrapper.findAll('nav li a').map((link) => link.text()),
		kinds: wrapper.findAll('nav li > span:first-of-type').map((span) => span.text()),
		markers: wrapper.findAll('nav li .rp-harness-ambiguous').map((span) => span.text()),
	};
};

describe('the index list, on a label that resolves to nothing', () => {
	it('says so on both rows, and says why', () => {
		state.components = [entry('component:editor/ZoneList', 'component'), entry('component:panels/ZoneList', 'component')];
		state.prototypes = [];

		const { wrapper, labels, markers } = rows();

		// BOTH rows, because neither is the one that wins — that is the decision being surfaced.
		expect(labels).toEqual(['ZoneList', 'ZoneList']);
		expect(markers).toEqual([
			'shares this name — no prototype can compose it',
			'shares this name — no prototype can compose it',
		]);

		wrapper.unmount();
	});

	/**
	 * The other half of `registrableComponents`' decision, and the reason this case exists at
	 * all: a MOCK sharing a label with a component is not ambiguous — the prototype takes the
	 * tag deterministically, which is the whole point of writing one. Marking that pair would
	 * report the headline workflow as a defect.
	 */
	it('says nothing when a mock deliberately shadows a component of the same name', () => {
		state.components = [entry('component:editor/StatusBar', 'component')];
		state.prototypes = [entry('prototype:StatusBar', 'prototype')];

		const { wrapper, labels, kinds, markers } = rows();

		expect(labels).toEqual(['StatusBar', 'StatusBar']);
		expect(kinds).toEqual(['prototype', 'component']);
		expect(markers).toEqual([]);

		wrapper.unmount();
	});

	it('says nothing about ordinary entries', () => {
		state.components = [entry('component:editor/StatusBar', 'component')];
		state.prototypes = [entry('prototype:ZonePanel', 'prototype')];

		const { wrapper, labels, markers } = rows();

		expect(labels).toEqual(['ZonePanel', 'StatusBar']);
		expect(markers).toEqual([]);

		wrapper.unmount();
	});
});
