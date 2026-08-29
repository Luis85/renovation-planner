/**
 * @vitest-environment jsdom
 *
 * What an Inspector override does when it is refused, and when it cannot be parsed at all.
 *
 * The second case is a shipped defect rather than a new feature: `applyQuantity` turned a
 * non-finite parse into `null`, which is the reset-to-calculated value — so typing `abc` and
 * tabbing away silently discarded the user's override and told them nothing.
 */
import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import RequirementRow from '../../../src/presentation/editor/shell/RequirementRow.vue';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';
import type { InspectorEdit } from '../../../src/presentation/editor/inspector/inspector-store';
import type { Logger } from '../../../src/application/ports/Logger';

type Commit = (edit: InspectorEdit) => Promise<Result<void, AppError>>;

/**
 * `useFieldCommit` requires a logger for the one failure it owns both halves of (a coalesced
 * continuation's own rejection). No case here reaches that path, so this is a stand-in with
 * nothing asserted on it — `useFieldCommit.test.ts` is where that door is driven.
 */
const logger: Logger = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined };

const ROW = {
	requirementId: 'r1',
	assetId: 'a1',
	assetName: 'Oak flooring',
	missingTarget: null,
	unit: 'm²',
	recalculationStatus: 'fresh',
	// `calculated` is present on both halves because `RequirementInspectorDTO` carries it — and
	// it was ABSENT here until a case first set an override, since the template reads it only
	// inside the Overridden branch. A fixture thinner than the real thing, invisible for exactly
	// as long as nothing drove the arm that needs it.
	quantity: { effective: 12, calculated: 12, override: null },
	cost: {
		effective: { amount: '100.00', currency: 'EUR' },
		calculated: { amount: '100.00', currency: 'EUR' },
		override: null,
	},
} as const;

/**
 * The same row with a quantity override actually SET — needed because Reset now asks whether
 * there is anything to clear, so `ROW` above (override `null`) is the case that must dispatch
 * NOTHING and cannot double as the case that must dispatch a clear.
 */
const OVERRIDDEN_ROW = {
	...ROW,
	quantity: { effective: 7, calculated: 12, override: 7 },
} as const;

/**
 * Asserted on the COMMAND INPUT rather than on a rendered badge — slice 10's rule. "The
 * panel re-rendered" is equally true of a row that committed something else entirely.
 */
function mountRow(commitResult: Result<void, AppError> = ok(undefined), row: typeof ROW = ROW) {
	const commit = vi.fn<Commit>(() => Promise.resolve(commitResult));
	const wrapper = mount(RequirementRow, { props: { row, commit, logger } });
	return { wrapper, commit };
}

describe('RequirementRow', () => {
	it('reports an unparseable quantity instead of silently resetting to calculated', async () => {
		const { wrapper, commit } = mountRow();

		const input = wrapper.get('input[data-field="quantity"]');
		await input.setValue('abc');
		await input.trigger('blur');

		// The shipped defect: this used to commit `quantity: null`, which IS "reset to
		// calculated" — the user's override discarded, with nothing said.
		expect(commit).not.toHaveBeenCalled();
		expect(wrapper.get('.rp-field-error__message').text()).not.toBe('');
		expect(input.attributes('aria-invalid')).toBe('true');
	});

	it('lets a quantity be typed one character at a time, leading decimal point included', async () => {
		// A KEYSTROKE-BY-KEYSTROKE stream, not `setValue`, and that is the whole case: the
		// draft was a parsed `number` rendered back through `:value`, so a keystroke whose text
		// does not survive `String(Number(text))` had the field rewritten under the user.
		//
		// MEASURED, because the shape is narrower than it first looks: `14.` and `1.50` survive,
		// since the parsed draft does not change on that keystroke and Vue's computed caching
		// then patches nothing. What does not survive is any prefix that parses to `NaN` —
		// `.5` renders as `NaN5`, `1e3` as `NaN3`, `abc` as `NaNbc`. A leading decimal point is
		// ordinary input, so this is not an edge case: `.5` cannot be entered at all today, and
		// the field answers with copy nobody wrote.
		const { wrapper, commit } = mountRow();
		const input = wrapper.get('input[data-field="quantity"]');
		const element = input.element as HTMLInputElement;

		// Appended rather than assigned, because that is what a browser does to the value the
		// field already holds — an assignment per step would hide exactly the rewrite at issue.
		for (const key of ['.', '5']) {
			element.value += key;
			await input.trigger('input');
		}

		expect(element.value).toBe('.5');

		await input.trigger('blur');
		await flushPromises();

		expect(commit).toHaveBeenCalledWith({
			kind: 'quantity-override',
			requirementId: 'r1',
			quantity: 0.5,
		});
	});

	it('leaves an unparseable quantity on screen as the user typed it', async () => {
		// The same rewrite at its most visible: the field showed `NaN` — copy nobody wrote —
		// while its own error message was already saying the value cannot be read.
		const { wrapper } = mountRow();
		const input = wrapper.get('input[data-field="quantity"]');
		const element = input.element as HTMLInputElement;

		element.value = 'abc';
		await input.trigger('input');

		expect(element.value).toBe('abc');
	});

	it('commits the parsed figure exactly once for a value it can read', async () => {
		const { wrapper, commit } = mountRow();

		const input = wrapper.get('input[data-field="quantity"]');
		await input.setValue('14.5');
		await input.trigger('blur');
		await flushPromises();

		expect(commit).toHaveBeenCalledTimes(1);
		expect(commit).toHaveBeenCalledWith({
			kind: 'quantity-override',
			requirementId: 'r1',
			quantity: 14.5,
		});
	});

	it('retires the parse message as soon as the user corrects the value, committing nothing', async () => {
		const { wrapper, commit } = mountRow();
		const input = wrapper.get('input[data-field="quantity"]');
		await input.setValue('abc');
		await input.trigger('blur');

		await input.setValue('14.5');

		expect(wrapper.find('.rp-field-error__message').exists()).toBe(false);
		// A keystroke never dispatches (slice 6): nothing until the next blur.
		expect(commit).not.toHaveBeenCalled();
	});

	it('keeps a refused value in the field with its message under it', async () => {
		const refusal: AppError = {
			category: 'Validation',
			code: 'requirement.negative-quantity',
			message: 'developer english',
		};
		const { wrapper, commit } = mountRow(err(refusal));

		const input = wrapper.get('input[data-field="quantity"]');
		await input.setValue('-5');
		await input.trigger('blur');
		await flushPromises();

		expect(commit).toHaveBeenCalledTimes(1);
		// Kept, not reverted: the fix is one keystroke away from what is already on screen.
		expect((input.element as HTMLInputElement).value).toBe('-5');
		expect(input.attributes('aria-invalid')).toBe('true');
	});

	it('clears a refused draft and its message when reset succeeds', async () => {
		// Reset used to bypass the composable, which holds the rejected draft and the error —
		// so the old value went on winning the computed draft with its stale message under it,
		// on a row that had just been reset.
		const refusal: AppError = {
			category: 'Validation',
			code: 'requirement.negative-quantity',
			message: 'developer english',
		};
		let result: Result<void, AppError> = err(refusal);
		const commit = vi.fn<Commit>(() => Promise.resolve(result));
		const wrapper = mount(RequirementRow, { props: { row: ROW, commit, logger } });
		const input = wrapper.get('input[data-field="quantity"]');
		await input.setValue('-5');
		await input.trigger('blur');
		await flushPromises();
		result = ok(undefined);

		await wrapper.get('.rp-requirement-reset-quantity').trigger('click');
		await flushPromises();

		expect(wrapper.find('.rp-field-error__message').exists()).toBe(false);
		expect((input.element as HTMLInputElement).value).not.toBe('-5');
	});

	it('reports an unparseable COST instead of throwing out of the handler', async () => {
		// `moneyOf` throws on a malformed literal, unlike `Number`, which yields NaN. Typing
		// text into the cost field must not take the click handler's promise down with it.
		const commit = vi.fn<Commit>(() => Promise.resolve(ok(undefined)));
		const wrapper = mount(RequirementRow, { props: { row: ROW, commit, logger } });

		const input = wrapper.get('input[data-field="cost"]');
		await input.setValue('abc');
		await expect(input.trigger('blur')).resolves.not.toThrow();
		await flushPromises();

		expect(commit).not.toHaveBeenCalled();
		expect(wrapper.get('.rp-field-error__message').text()).not.toBe('');
	});

	it('runs the unconvertible-draft guard inside onCommit, not at the call site', async () => {
		// The rule lives in `useFieldCommit.validate`. If it moved back out to each control,
		// this passes only for whichever control the author remembered — which is how three
		// findings of one shape arrived on the sibling slice.
		const commit = vi.fn<Commit>(() => Promise.resolve(ok(undefined)));
		const wrapper = mount(RequirementRow, { props: { row: ROW, commit, logger } });

		for (const field of ['quantity', 'cost']) {
			const input = wrapper.get(`input[data-field="${field}"]`);
			await input.setValue('abc');
			await input.trigger('blur');
		}
		await flushPromises();

		expect(commit).not.toHaveBeenCalled();
		expect(wrapper.findAll('.rp-field-error__message')).toHaveLength(2);
	});

	it('does not dispatch keystrokes typed after an Escape that cancelled a queued commit', async () => {
		// blur (write starts) -> blur again (queues a recommit) -> Escape -> type more.
		// The settling write must not carry the new text: the user never committed it, and
		// cancelled the gesture that would have.
		let resolveCommit: ((result: Result<void, AppError>) => void) | null = null;
		const commit = vi.fn<Commit>(
			() => new Promise<Result<void, AppError>>((resolve) => {
				resolveCommit = resolve;
			}),
		);
		const wrapper = mount(RequirementRow, { props: { row: ROW, commit, logger } });
		const input = wrapper.get('input[data-field="quantity"]');
		await input.setValue('12');
		await input.trigger('blur');
		await input.trigger('blur');
		await input.trigger('keydown', { key: 'Escape' });
		await input.setValue('99');

		// Non-null BEFORE calling it: an `?.` here would make a broken capture (`commit`
		// never actually invoked, so `resolveCommit` stays `null`) a silent no-op rather
		// than a failing assertion — the settling write would never resolve, but the case
		// would still pass on `commit` having been called exactly once for the wrong reason.
		expect(resolveCommit).not.toBeNull();
		resolveCommit?.(ok(undefined));
		await flushPromises();

		expect(commit).toHaveBeenCalledTimes(1);
	});

	it('discards a rejected draft on Escape without dispatching', async () => {
		// The spec keeps Escape-to-revert real in the Inspector, which is not inside a dialog.
		// The canvas's tool-cancel handler is a SIBLING and never sees a keydown that starts in
		// this input, so nothing else can provide this.
		const refusal: AppError = {
			category: 'Validation',
			code: 'requirement.negative-quantity',
			message: 'developer english',
		};
		const commit = vi.fn<Commit>(() => Promise.resolve(err(refusal)));
		const wrapper = mount(RequirementRow, { props: { row: ROW, commit, logger } });
		const input = wrapper.get('input[data-field="quantity"]');
		await input.setValue('-5');
		await input.trigger('blur');
		await flushPromises();
		expect(commit).toHaveBeenCalledTimes(1);

		await input.trigger('keydown', { key: 'Escape' });

		expect(wrapper.find('.rp-field-error__message').exists()).toBe(false);
		expect((input.element as HTMLInputElement).value).not.toBe('-5');
		// Discarded, never committed — which is what separates it from Reset below.
		expect(commit).toHaveBeenCalledTimes(1);
	});

	it.each([
		['quantity', { kind: 'quantity-override', requirementId: 'r1', quantity: 7 }],
		['cost', { kind: 'cost-override', requirementId: 'r1' }],
	])('commits the %s override on Enter, which the contract names beside blur', async (fieldName, edit) => {
		// "A field commits on blur/enter" is stated in five places — `useFieldCommit`'s own
		// docblock, its `onCommit` member comment, and three lines of the slice's task document —
		// and the word Enter appeared nowhere in `src/` or `tests/` at all. Only blur and Escape
		// were ever bound, so the draft stayed visible and unsaved with the input still focused,
		// and this slice removing the Apply buttons left no other way to commit without leaving
		// the field.
		const { wrapper, commit } = mountRow();
		const input = wrapper.get(`input[data-field="${fieldName}"]`);
		await input.setValue(fieldName === 'quantity' ? '7' : '12.50');

		await input.trigger('keydown.enter');
		await flushPromises();

		expect(commit).toHaveBeenCalledTimes(1);
		expect(commit.mock.calls[0][0]).toMatchObject(edit);
	});

	it.each([['quantity'], ['cost']])(
		'does not commit a dirty %s draft on the way to its own Reset button',
		(fieldName) => {
			// A browser fires `mousedown` on the button, which blurs the focused input, BEFORE the
			// `click` that runs the reset. So one Reset gesture on a dirty field became two writes
			// and two undo entries — the first persisting the very value the user was discarding,
			// which is then what Undo restores.
			//
			// `preventDefault` on `mousedown` preserves the current focus and cancels nothing else,
			// so the click still fires and the reset still runs; `DialogHost.onMousedown` uses the
			// same mechanism for the same reason. jsdom moves no focus on mousedown and so fires no
			// blur, which means `defaultPrevented` is the only honest thing to assert here — the
			// two-write sequence itself is only visible in a real browser.
			const { wrapper } = mountRow();
			const button = wrapper.get(`.rp-requirement-reset-${fieldName}`);

			const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
			button.element.dispatchEvent(event);

			expect(event.defaultPrevented).toBe(true);
		},
	);

	it('still offers an explicit reset to calculated', async () => {
		// `Escape` inside the editor is spoken for by tool-gesture cancellation, so the way
		// back to "calculated" stays a visible control rather than a key.
		//
		// Mounted on the OVERRIDDEN row, and that is the correction rather than a detail: this
		// case used to mount `ROW`, whose `quantity.override` is `null`, so what it certified
		// was a Reset dispatching a clear against a row with nothing to clear. It passed on the
		// defect the case below now names.
		const { wrapper, commit } = mountRow(ok(undefined), OVERRIDDEN_ROW);

		await wrapper.get('.rp-requirement-reset-quantity').trigger('click');
		await flushPromises();

		expect(commit).toHaveBeenCalledWith({
			kind: 'quantity-override',
			requirementId: 'r1',
			quantity: null,
		});
	});

	it('sends nothing when Reset is pressed on a field that holds no override', async () => {
		// `useFieldCommit`'s "nothing to commit" guard tests for a CLEAN field, and `reset`
		// mints a draft with `onInput('')` before any round could reach it — so that guard is
		// unreachable from this path by construction and the row has to ask the question
		// itself. Without it, clearing an override that was never set was a real command: a
		// vault write, a revision bump and an undo entry for no visible change.
		const { wrapper, commit } = mountRow();

		await wrapper.get('.rp-requirement-reset-quantity').trigger('click');
		await wrapper.get('.rp-requirement-reset-cost').trigger('click');
		await flushPromises();

		expect(commit).not.toHaveBeenCalled();
	});

	it('discards a typed draft on Reset when there is no override to clear', async () => {
		// The other half of the same branch, and the reason it is `onCancel` rather than an
		// early `return`: the gesture still MEANS something on a dirty field — put the input
		// back to the calculated figure it is showing beside — it just has nothing to persist.
		const { wrapper, commit } = mountRow();

		const input = wrapper.get('input[data-field="quantity"]');
		await input.setValue('9');
		await wrapper.get('.rp-requirement-reset-quantity').trigger('click');
		await flushPromises();

		expect(commit).not.toHaveBeenCalled();
		expect((input.element as HTMLInputElement).value).toBe('');
	});
});
