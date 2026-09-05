/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SaveStateIndicator from '../../../../src/presentation/editor/save-state/SaveStateIndicator.vue';
import { useSaveStateStore } from '../../../../src/presentation/editor/save-state/save-state-store';
import { SAVE_STATE_KEYS, type SaveState } from '../../../../src/presentation/editor/save-state/save-state';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';

describe('the save-state indicator', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('renders the resting state as words, not as a colour or an icon alone', () => {
		expect(mount(SaveStateIndicator).text()).toBe('Saved');
	});

	it('follows the store into saving', async () => {
		const wrapper = mount(SaveStateIndicator);
		useSaveStateStore().beginSaving();
		await wrapper.vm.$nextTick();
		expect(wrapper.text()).toBe('Saving');
	});

	it('follows the store into a save error', async () => {
		const wrapper = mount(SaveStateIndicator);
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		await wrapper.vm.$nextTick();
		expect(wrapper.text()).toBe('Save error');
	});
});

/**
 * SDD companion §2.5: "Saved · refresh needed" is DERIVED from `state === 'saved'` plus
 * `ProjectStore.stale`, never a fifth `SaveState` member — the write really did land, and
 * `stale` is the qualifier on top of it. A save error over a stale store still reads "Save
 * error": the qualifier applies to `saved` alone, never to any other state.
 */
describe('the derived Saved · refresh needed label', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('reads Saved · refresh needed when saved AND the project store is stale, with its own mark class', async () => {
		const wrapper = mount(SaveStateIndicator);
		useProjectStore().stale = true;
		await wrapper.vm.$nextTick();
		expect(wrapper.text()).toBe('Saved · refresh needed');
		expect(wrapper.find('.rp-save-state-saved-refresh-needed').exists()).toBe(true);
	});

	it('does not say refresh needed over a save error', async () => {
		const wrapper = mount(SaveStateIndicator);
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		useProjectStore().stale = true;
		await wrapper.vm.$nextTick();
		expect(wrapper.text()).toBe('Save error');
		expect(wrapper.find('.rp-save-state-saved-refresh-needed').exists()).toBe(false);
	});
});

/**
 * `docs/components/Save-state indicator.md`: "**A mark and a word.** Both, always, never one."
 * The component shipped the word alone for a slice, with a colour on two states — which
 * satisfies SDD §85's "status not colour-only" rule, since a word is not a colour, and misses
 * the component contract, which is stricter and says why.
 */
describe('the mark the component spec requires beside the word', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	/**
	 * The mark carries no text, so the word stays the WHOLE accessible name — which is what
	 * lets the three cases above go on asserting an exact `.text()`, and is why the mark is
	 * `aria-hidden` rather than labelled.
	 */
	// Each driver is annotated `: void`. Without it the second and third infer from a call on
	// the store whose own type this table is inside, and TypeScript gives up with an implicit
	// `any` return — which would then have let a driver return anything at all.
	it.each([
		['saved', 'Saved', (store: ReturnType<typeof useSaveStateStore>): void => void store],
		['saving', 'Saving', (store: ReturnType<typeof useSaveStateStore>): void => store.beginSaving()],
		['save-error', 'Save error', (store: ReturnType<typeof useSaveStateStore>): void => {
			store.beginSaving();
			store.resolveErr();
		}],
	] as const)('draws a mark AND the word in %s', async (state, word, drive) => {
		const wrapper = mount(SaveStateIndicator);
		drive(useSaveStateStore());
		await wrapper.vm.$nextTick();

		const mark = wrapper.find('.rp-save-state-mark');
		expect(mark.exists()).toBe(true);
		expect(mark.attributes('aria-hidden')).toBe('true');
		expect(mark.text()).toBe('');
		// Both channels, which is the whole claim — a mark with the word missing would be the
		// coloured dot the spec names, and the word alone is what shipped.
		expect(wrapper.text()).toBe(word);
		expect(wrapper.find(`.rp-save-state-${state}`).exists()).toBe(true);
	});
});

/**
 * **The one hole `editor-status.css`'s own header says nothing here can catch**, closed for
 * the mark. jsdom resolves no CSS, so a selector one word short of what the template emits
 * simply never matches and every test still passes — which is exactly what happened once, at
 * `rp-save-state-error` against a template emitting `rp-save-state-save-error`.
 *
 * The selectors below are BUILT from the same `rp-save-state-${state}` expression the
 * component interpolates, never transcribed, so a renamed state breaks this rather than
 * quietly rendering the base mark. `Record<SaveState, …>` makes a fifth state a compile
 * error rather than a silently unchecked one.
 */
describe('every save state has a mark rule the template can actually reach', () => {
	const css = readFileSync('styles/editor-status.css', 'utf8');

	/**
	 * `saved` is deliberately `null`: the base `.rp-save-state-mark` IS the settled disc the
	 * spec asks for, so it needs no override. Recorded as a decision rather than omitted from
	 * the list, because an absent key and a deliberate one look identical in a loop.
	 */
	const MARK_RULE: Readonly<Record<SaveState | 'saved-refresh-needed', 'base' | 'own'>> = {
		saved: 'base',
		saving: 'own',
		'unsaved-changes': 'own',
		'save-error': 'own',
		'saved-refresh-needed': 'own',
	};

	it('declares the base mark the word sits beside', () => {
		expect(css).toContain('.rp-save-state-mark {');
	});

	it.each(
		(Object.keys(MARK_RULE) as (SaveState | 'saved-refresh-needed')[]).filter(
			(state) => MARK_RULE[state] === 'own',
		),
	)('declares a distinct mark for %s', (state) => {
		expect(css).toContain(`.rp-save-state-${state} .rp-save-state-mark`);
	});

	// The list above is the states PLUS the derived label, not a copy of either: the type's
	// own keys drive it.
	it('covers every state the type declares', () => {
		expect(Object.keys(MARK_RULE).toSorted()).toEqual(
			[...Object.keys(SAVE_STATE_KEYS), 'saved-refresh-needed'].toSorted(),
		);
	});

	/**
	 * The saving mark is the Design System's *Loading* row — a MOVING indicator — so it is the
	 * first animation in this stylesheet and the first thing in it that owes a reduced-motion
	 * answer.
	 */
	it('animates the saving mark, and stops it under reduced motion', () => {
		expect(css).toContain('animation: rp-save-state-spin');
		expect(css).toContain('@keyframes rp-save-state-spin');
		expect(css).toContain('@media (prefers-reduced-motion: reduce)');
	});
});
