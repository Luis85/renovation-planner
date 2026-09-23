/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SaveStateIndicator from '../../../../src/presentation/editor/save-state/SaveStateIndicator.vue';
import { useSaveStateStore } from '../../../../src/presentation/editor/save-state/save-state-store';
import type * as Obsidian from 'obsidian';

/**
 * The host's language, driven per case through the `obsidian` module itself rather than through
 * the shared mock's `setLanguage` — whose docblock records that no suite calls it — so the value
 * dies with this file's own module registry and the component's real `currentLanguage`/`tr` path
 * is the one exercised.
 */
const host = vi.hoisted(() => ({ language: 'en' }));
vi.mock('obsidian', async (importOriginal) => ({
	...(await importOriginal<typeof Obsidian>()),
	getLanguage: (): string => host.language,
}));

const SAVED_AT = new Date(2026, 8, 23, 14, 5);
const MINUTE = 60_000;

/**
 * Fake time forward, then one render. Synchronous on purpose: the tick callback is synchronous, so
 * nothing here waits on a real macrotask — `advanceTimersByTimeAsync` did, and timed out once on a
 * contended machine.
 */
async function advance(ms: number): Promise<void> {
	vi.advanceTimersByTime(ms);
	await nextTick();
}

function saved(): void {
	const store = useSaveStateStore();
	store.beginSaving();
	store.resolveOk();
}

const hidden = (node: Node): boolean => node.parentElement?.closest('[aria-hidden="true"]') !== null;

/** What a screen reader has: every text node outside an `aria-hidden` subtree. */
function spoken(wrapper: VueWrapper): string {
	const walker = document.createTreeWalker(wrapper.element, NodeFilter.SHOW_TEXT);
	let text = '';
	for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
		if (!hidden(node)) text += node.textContent ?? '';
	}
	return text.trim();
}

/** What a sighted user has: the text outside the visually-hidden copy. */
function shown(wrapper: VueWrapper): string {
	const clone = wrapper.element.cloneNode(true) as HTMLElement;
	for (const copy of clone.querySelectorAll('.rp-visually-hidden')) copy.remove();
	return clone.textContent?.trim() ?? '';
}

/**
 * AD18-R19: `Saved just now`, then `Saved N min ago`, then `Saved at HH:MM` in the host's own time
 * format, on both surfaces that mount this indicator. Fake timers drive the store's `Date.now` and
 * the indicator's minute tick together, so nothing here sleeps.
 */
describe('the relative save time', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.useFakeTimers();
		vi.setSystemTime(SAVED_AT);
	});

	afterEach(() => {
		vi.useRealTimers();
		host.language = 'en';
	});

	it('stays plain Saved with no save this session, however long the leaf stays open', async () => {
		const wrapper = mount(SaveStateIndicator);
		await advance(2 * 60 * MINUTE);
		expect(wrapper.text()).toBe('Saved');
		expect(wrapper.find('.rp-visually-hidden').exists()).toBe(false);
	});

	it('reads just now, then minutes, then the clock time once an hour has passed', async () => {
		const wrapper = mount(SaveStateIndicator);
		saved();
		await wrapper.vm.$nextTick();
		expect(shown(wrapper)).toBe('Saved just now');

		await advance(MINUTE);
		expect(shown(wrapper)).toBe('Saved 1 min ago');

		await advance(58 * MINUTE);
		expect(shown(wrapper)).toBe('Saved 59 min ago');

		await advance(MINUTE);
		const clock = new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(SAVED_AT);
		expect(shown(wrapper)).toBe(`Saved at ${clock}`);
	});

	it('counts again from a newer save', async () => {
		const wrapper = mount(SaveStateIndicator);
		saved();
		await advance(5 * MINUTE);
		expect(shown(wrapper)).toBe('Saved 5 min ago');

		saved();
		await wrapper.vm.$nextTick();
		expect(shown(wrapper)).toBe('Saved just now');
	});

	/**
	 * The Plan Editor mounts this inside `StatusBar`'s `role="status"` region, so a text change
	 * here is an announcement. The relative phrase is `aria-hidden` and the accessible copy is the
	 * state word alone, so the minute tick changes nothing a screen reader is told — and the
	 * saving-to-saved transition still announces `Saved`.
	 */
	it('never changes what a screen reader is told when the minute ticks', async () => {
		const wrapper = mount(SaveStateIndicator);
		saved();
		await wrapper.vm.$nextTick();
		expect(spoken(wrapper)).toBe('Saved');

		await advance(MINUTE);
		expect(shown(wrapper)).toBe('Saved 1 min ago');
		expect(spoken(wrapper)).toBe('Saved');
	});

	/** C08: a stale canvas must never read as freshly saved, so the qualifier wins over the time. */
	it('keeps Saved · refresh needed ahead of the relative time', async () => {
		const wrapper = mount(SaveStateIndicator, { props: { stale: true } });
		saved();
		await wrapper.vm.$nextTick();
		expect(wrapper.text()).toBe('Saved · refresh needed');

		await wrapper.setProps({ stale: false });
		expect(shown(wrapper)).toBe('Saved just now');
	});

	it('uses the host language for both the phrase and the clock time', async () => {
		host.language = 'de';
		const wrapper = mount(SaveStateIndicator);
		saved();
		await wrapper.vm.$nextTick();
		expect(shown(wrapper)).toBe('Gerade gespeichert');
		expect(spoken(wrapper)).toBe('Gespeichert');

		await advance(3 * MINUTE);
		expect(shown(wrapper)).toBe('Vor 3 Min. gespeichert');

		await advance(60 * MINUTE);
		expect(shown(wrapper)).toBe('Um 14:05 gespeichert');
	});

	it('keeps just now for the whole first minute after a save that lands between ticks', async () => {
		const wrapper = mount(SaveStateIndicator);
		await advance(MINUTE / 2);
		saved();
		await nextTick();

		await advance(MINUTE - 1000);
		expect(shown(wrapper)).toBe('Saved just now');
		await advance(1000);
		expect(shown(wrapper)).toBe('Saved 1 min ago');
	});

	it('ticks for a leaf that mounts after its store already saw a save', async () => {
		saved();
		const wrapper = mount(SaveStateIndicator);
		expect(shown(wrapper)).toBe('Saved just now');
		await advance(2 * MINUTE);
		expect(shown(wrapper)).toBe('Saved 2 min ago');
	});

	it('runs no tick until a save lands, one after, and none once it unmounts', async () => {
		const wrapper = mount(SaveStateIndicator);
		expect(vi.getTimerCount()).toBe(0);
		saved();
		await nextTick();
		// A later save RESTARTS the tick rather than adding a second one. The clock has to move
		// between the two, or the stamp is unchanged and nothing restarts at all.
		await advance(1000);
		saved();
		await nextTick();
		expect(vi.getTimerCount()).toBe(1);
		wrapper.unmount();
		expect(vi.getTimerCount()).toBe(0);
	});
});
