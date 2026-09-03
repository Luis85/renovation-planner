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
import { Decimal } from 'decimal.js';
import { err, ok } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { RequirementInspectorDTO } from '../../../src/application/queries/GetRequirementsForZone';
import type { RequirementId } from '../../../src/domain/requirement/RequirementId';
import { of as moneyOf, type Money } from '../../../src/core/money/Money';
import type { InspectorEdit } from '../../../src/presentation/editor/inspector/inspector-store';
import type { Logger } from '../../../src/application/ports/Logger';

/**
 * `RequirementRow`'s `commit` prop, spelled from its own declaration. It read
 * `Result<void, AppError>` — the shape `UndoableCommand` and every dispatcher stopped having
 * when design slice 13 made `DispatchOutcome` required, precisely so that a success carries
 * whether the vault was touched.
 */
type Commit = (edit: InspectorEdit) => Promise<DispatchResult>;

/** Every commit in this file stands for a real override write. */
const wrote: DispatchResult = ok('wrote');

/**
 * `useFieldCommit` requires a logger for the one failure it owns both halves of (a coalesced
 * continuation's own rejection). No case here reaches that path, so this is a stand-in with
 * nothing asserted on it — `useFieldCommit.test.ts` is where that door is driven.
 */
const logger: Logger = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined };

/**
 * The row every case mounts, ANNOTATED as the DTO the component's prop declares.
 *
 * Three things the annotation caught, each of which had been rendering happily. `unit` was
 * `'m²'`, a symbol `MeasurementUnit` does not contain — the real values are `'m2'` and its
 * siblings, and the template prints this string beside the quantity, so the fixture was
 * showing a unit the read model never produces. `recalculationStatus` was `'fresh'`, outside
 * the `'current' | 'stale'` union: the template asks `=== 'stale'`, so an invented third value
 * behaved like `'current'` by accident rather than by decision. And `wasteFactor` — a required
 * member — was simply absent, the same fake-too-thin miss the comment below already records
 * for `calculated`, one field along.
 *
 * The three quantity figures and both money values are `Decimal` and `Money`, not `number` and
 * an object literal: the template calls `.toString()` on them, which a number satisfies, and
 * `Money` is BRANDED, so nothing but `of()` can produce one.
 */
const ROW: RequirementInspectorDTO = {
	requirementId: 'r1' as RequirementId,
	assetId: 'a1',
	assetName: 'Oak flooring',
	missingTarget: null,
	unit: 'm2',
	wasteFactor: new Decimal('0.10'),
	recalculationStatus: 'current',
	// `calculated` is present on both halves because `RequirementInspectorDTO` carries it — and
	// it was ABSENT here until a case first set an override, since the template reads it only
	// inside the Overridden branch. A fixture thinner than the real thing, invisible for exactly
	// as long as nothing drove the arm that needs it.
	quantity: { effective: new Decimal(12), calculated: new Decimal(12), override: null },
	cost: {
		effective: moneyOf('100.00', 'EUR'),
		calculated: moneyOf('100.00', 'EUR'),
		override: null,
	},
	// All three figures AGREE, so every existing case in this file goes on describing the
	// unoverridden, fresh row it was written for — a fixture that quietly acquires an
	// override changes what twelve unrelated assertions are about.
	unitCost: {
		catalogue: moneyOf('100.00', 'EUR'),
		projectOverride: null,
		effective: moneyOf('100.00', 'EUR'),
	},
};

/**
 * The same row with a quantity override actually SET — needed because Reset now asks whether
 * there is anything to clear, so `ROW` above (override `null`) is the case that must dispatch
 * NOTHING and cannot double as the case that must dispatch a clear.
 */
const OVERRIDDEN_ROW: RequirementInspectorDTO = {
	...ROW,
	quantity: { effective: new Decimal(7), calculated: new Decimal(12), override: new Decimal(7) },
};

/**
 * Asserted on the COMMAND INPUT rather than on a rendered badge — slice 10's rule. "The
 * panel re-rendered" is equally true of a row that committed something else entirely.
 */
function mountRow(commitResult: DispatchResult = wrote, row: RequirementInspectorDTO = ROW) {
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
		let result: DispatchResult = err(refusal);
		const commit = vi.fn<Commit>(() => Promise.resolve(result));
		const wrapper = mount(RequirementRow, { props: { row: ROW, commit, logger } });
		const input = wrapper.get('input[data-field="quantity"]');
		await input.setValue('-5');
		await input.trigger('blur');
		await flushPromises();
		result = wrote;

		await wrapper.get('.rp-requirement-reset-quantity').trigger('click');
		await flushPromises();

		expect(wrapper.find('.rp-field-error__message').exists()).toBe(false);
		expect((input.element as HTMLInputElement).value).not.toBe('-5');
	});

	it('reports an unparseable COST instead of throwing out of the handler', async () => {
		// `moneyOf` throws on a malformed literal, unlike `Number`, which yields NaN. Typing
		// text into the cost field must not take the click handler's promise down with it.
		const commit = vi.fn<Commit>(() => Promise.resolve(wrote));
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
		const commit = vi.fn<Commit>(() => Promise.resolve(wrote));
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
		// `!` rather than `| null`: `new Promise`'s executor runs synchronously, so this is
		// assigned the first time `commit` is called. Typed nullable, the compiler must assume
		// the executor never ran — which is what made the call below "not callable" — and the
		// null CHECK the comment beneath is about would then be checking a value TypeScript
		// believes can only be null.
		let resolveCommit: ((result: DispatchResult) => void) | undefined;
		const commit = vi.fn<Commit>(
			() => new Promise<DispatchResult>((resolve) => {
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
		resolveCommit?.(wrote);
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
		const { wrapper, commit } = mountRow(wrote, OVERRIDDEN_ROW);

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

/**
 * §89's "beside what it replaced", at the INPUT level: the shared library's unit price, this
 * project's own, and the one the row's figures were actually DERIVED from.
 *
 * Task 8 added `RequirementInspectorDTO.unitCost` and populated it, and nothing rendered it —
 * an unread DTO field fails no gate, which is why the group existed for a whole task as a
 * promise in a document. These cases are what turn it into a check.
 *
 * The three figures are read off `[data-price]` rather than off the rendered text of the whole
 * `<dl>`: `100.00` appears in the cost block too, so a text assertion over the row would be
 * green against a build that rendered nothing new at all.
 */
function unitCostRow(unitCost: RequirementInspectorDTO['unitCost']): RequirementInspectorDTO {
	return { ...ROW, unitCost };
}

/** Every unit-cost figure the row drew, keyed by which of the three it is. */
function prices(wrapper: ReturnType<typeof mountRow>['wrapper']): Record<string, string> {
	return Object.fromEntries(
		wrapper.findAll('[data-price]').map((cell) => [cell.attributes('data-price') ?? '', cell.text()]),
	);
}

/**
 * The figure `slot` drew, compared against what `Money` itself prints for it — amount AND
 * currency, since one of these cases deliberately mixes two.
 *
 * Built from the same `Money` the fixture holds rather than from the literal that made it:
 * `of('26.00', 'EUR').amount` is `'26'`, so a hand-written `'26.00'` would be asserting a
 * formatting decision this row does not make. `toContain` rather than `toBe` because the in-force
 * mark, when there is one, is inside the same cell — which `markedInForce` asserts separately.
 */
function expectFigure(
	wrapper: ReturnType<typeof mountRow>['wrapper'],
	slot: string,
	money: Money,
): void {
	// The key first, so a build that drew no such figure names the slot it is missing rather
	// than reporting an `undefined` receiver.
	expect(Object.keys(prices(wrapper))).toContain(slot);
	expect(prices(wrapper)[slot]).toContain(`${money.amount} ${money.currency}`);
}

/** Which figures carry the in-force mark. Exactly one, or none — never two. */
function markedInForce(wrapper: ReturnType<typeof mountRow>['wrapper']): string[] {
	return wrapper
		.findAll('[data-price]')
		.filter((cell) => cell.find('.rp-editor-requirement-in-force').exists())
		.map((cell) => cell.attributes('data-price') ?? '');
}

describe('RequirementRow unit cost', () => {
	it('shows the library price beside this project price, marking the one in force', () => {
		const catalogue = moneyOf('24.00', 'EUR');
		const projectOverride = moneyOf('19.50', 'GBP');
		const { wrapper } = mountRow(wrote, unitCostRow({ catalogue, projectOverride, effective: projectOverride }));

		expectFigure(wrapper, 'library', catalogue);
		expectFigure(wrapper, 'project', projectOverride);
		// The override is the current resolution, so it — and only it — is in force.
		expect(markedInForce(wrapper)).toEqual(['project']);
	});

	it('shows the library price alone when the project has no override AND nothing is stale', () => {
		// BOTH conditions. `ROW` has all three figures agreeing, so there is one number to show,
		// nothing to compare it against, and therefore no label saying which of one figure is in
		// force — a mark on a lone figure is a dangling label.
		const { wrapper } = mountRow();

		expect(Object.keys(prices(wrapper))).toEqual(['library']);
		expect(markedInForce(wrapper)).toEqual([]);
	});

	/**
	 * The no-override STALE row. `projectOverride` is null, the library price has moved, and the
	 * recalculation that would have caught up failed — so `effective` is still the old
	 * `calculatedFrom.unitCost`. Rendering the current library price ALONE would hide the price
	 * the displayed calculated cost was actually derived from, on a row simultaneously marked
	 * stale: the surface contradicting its own status field, which is exactly what Task 8's
	 * `effective` docblock says this group exists to prevent.
	 */
	it('shows the provenance beside the library price when they differ and there is no override', () => {
		const catalogue = moneyOf('26.00', 'EUR');
		const effective = moneyOf('24.00', 'EUR');
		const { wrapper } = mountRow(wrote, unitCostRow({ catalogue, projectOverride: null, effective }));

		expectFigure(wrapper, 'library', catalogue);
		expectFigure(wrapper, 'derived', effective);
		expect(prices(wrapper)['project']).toBeUndefined();
		// No override, so the library price IS the current resolution and carries the mark; the
		// provenance row is labelled as what the figures were computed from. Two labels, never
		// one mark twice.
		expect(markedInForce(wrapper)).toEqual(['library']);
	});

	/** §85: never colour alone. The in-force marker is a word, so a screen reader reads it. */
	it('marks the figure in force with something a screen reader reads', () => {
		const { wrapper } = mountRow(wrote, unitCostRow({
			catalogue: moneyOf('24.00', 'EUR'),
			projectOverride: moneyOf('19.50', 'GBP'),
			effective: moneyOf('19.50', 'GBP'),
		}));

		expect(wrapper.get('.rp-editor-requirement-in-force').text().trim()).not.toBe('');
	});

	/**
	 * The case every other one here is blind to, because they all use different numbers: a
	 * project whose own price happens to equal the library's. An equality-based mark marks BOTH
	 * rows and the surface claims two figures are the one in force; precedence marks the project
	 * row and only that one.
	 */
	it('marks the project row alone when the override equals the library price', () => {
		const { wrapper } = mountRow(wrote, unitCostRow({
			catalogue: moneyOf('24.00', 'GBP'),
			projectOverride: moneyOf('24.00', 'GBP'),
			effective: moneyOf('24.00', 'GBP'),
		}));

		expect(Object.keys(prices(wrapper))).toEqual(['library', 'project']);
		expect(markedInForce(wrapper)).toEqual(['project']);
	});

	/**
	 * Decision 6's "three numbers in the worst case", and the only shape that needs all three: a
	 * project price that moved out of band under a failed recalculation.
	 */
	it('shows all three when the override moved and the recalculation did not catch up', () => {
		const catalogue = moneyOf('26.00', 'EUR');
		const projectOverride = moneyOf('21.00', 'GBP');
		const effective = moneyOf('19.50', 'GBP');
		const { wrapper } = mountRow(wrote, unitCostRow({ catalogue, projectOverride, effective }));

		expectFigure(wrapper, 'library', catalogue);
		expectFigure(wrapper, 'project', projectOverride);
		expectFigure(wrapper, 'derived', effective);
		expect(markedInForce(wrapper)).toEqual(['project']);
	});

	/**
	 * The asset is gone, so there is no catalogue price to compare against — Task 8 sets the
	 * whole group to `null` rather than inventing a zero, and the row must not render an empty
	 * comparison for it.
	 */
	it('renders no unit-cost block when the asset is missing', () => {
		const { wrapper } = mountRow(wrote, { ...ROW, missingTarget: 'asset', assetName: null, unitCost: null });

		expect(wrapper.findAll('[data-price]')).toHaveLength(0);
	});
});
