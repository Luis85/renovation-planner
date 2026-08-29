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

type Commit = (edit: InspectorEdit) => Promise<Result<void, AppError>>;

const ROW = {
	requirementId: 'r1',
	assetId: 'a1',
	assetName: 'Oak flooring',
	missingTarget: null,
	unit: 'm²',
	recalculationStatus: 'fresh',
	quantity: { effective: 12, override: null },
	cost: { effective: { amount: '100.00', currency: 'EUR' }, override: null },
} as const;

/**
 * Asserted on the COMMAND INPUT rather than on a rendered badge — slice 10's rule. "The
 * panel re-rendered" is equally true of a row that committed something else entirely.
 */
function mountRow(commitResult: Result<void, AppError> = ok(undefined)) {
	const commit = vi.fn<Commit>(() => Promise.resolve(commitResult));
	const wrapper = mount(RequirementRow, { props: { row: ROW, commit } });
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
		const wrapper = mount(RequirementRow, { props: { row: ROW, commit } });
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
		const wrapper = mount(RequirementRow, { props: { row: ROW, commit } });

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
		const wrapper = mount(RequirementRow, { props: { row: ROW, commit } });

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
		const wrapper = mount(RequirementRow, { props: { row: ROW, commit } });
		const input = wrapper.get('input[data-field="quantity"]');
		await input.setValue('12');
		await input.trigger('blur');
		await input.trigger('blur');
		await input.trigger('keydown', { key: 'Escape' });
		await input.setValue('99');

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
		const wrapper = mount(RequirementRow, { props: { row: ROW, commit } });
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

	it('still offers an explicit reset to calculated', async () => {
		// `Escape` inside the editor is spoken for by tool-gesture cancellation, so the way
		// back to "calculated" stays a visible control rather than a key.
		const { wrapper, commit } = mountRow();

		await wrapper.get('.rp-requirement-reset-quantity').trigger('click');
		await flushPromises();

		expect(commit).toHaveBeenCalledWith({
			kind: 'quantity-override',
			requirementId: 'r1',
			quantity: null,
		});
	});
});
