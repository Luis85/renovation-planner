/**
 * @vitest-environment jsdom
 *
 * The four guarantees that make a dialog MODAL rather than merely visible (SDD §85):
 * focus moves in, focus cannot leave, `Escape` cancels, and focus goes back — on every
 * resolution path, not only the cancel one.
 *
 * `Tab` does not move focus natively in jsdom, which is not a limitation here: a wrapping
 * trap must move focus explicitly at both ends anyway, so what these tests drive is the
 * same code path a browser would take at the wrap.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import { mountDialogHost, type DialogHarness } from '../../helpers/dialogs';
import { t } from '../../../src/presentation/i18n/strings';

let harness: DialogHarness | null = null;

afterEach(() => {
	harness?.unmount();
	harness = null;
});

const CONFIRM = { kind: 'confirm', title: 'T', message: 'M' } as const;

function pressKey(element: Element, key: string, shiftKey = false): void {
	element.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
}

/**
 * Returns the dispatched event so a case can read `defaultPrevented` — jsdom moves no
 * focus on `mousedown` at all (it implements no browser default action for it), so
 * `defaultPrevented` is the only observable trace `onMousedown` leaves here. Whether
 * `preventDefault()` on `mousedown` actually PRESERVES focus in a real browser is
 * Chromium's guarantee, not jsdom's, and is unproven by any test in this file.
 */
function pressDown(element: Element): MouseEvent {
	const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
	element.dispatchEvent(event);
	return event;
}

describe('opening', () => {
	it('draws nothing at all while no dialog is open', () => {
		harness = mountDialogHost();

		expect(harness.wrapper.find('.rp-dialog-overlay').exists()).toBe(false);
	});

	it('renders the kind the descriptor names', async () => {
		harness = mountDialogHost();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		expect(harness.wrapper.find('.rp-dialog').attributes('role')).toBe('dialog');
		expect(harness.wrapper.find('.rp-dialog').attributes('aria-modal')).toBe('true');
		expect(harness.wrapper.find('[data-rp-action="confirm"]').exists()).toBe(true);
	});

	/**
	 * `aria-dialog-name` (the axe rule `tests/harness/accessibility.test.ts` scans for) only
	 * proves `aria-labelledby` resolves to SOME non-empty text — a `titleId` accidentally
	 * bound to a different, unrelated non-empty element would satisfy that rule and stay
	 * green. This asserts the stronger, actually-intended thing: the id `.rp-dialog` points
	 * at is the SAME id the visible `.rp-dialog-title` carries, so the accessible name really
	 * is the title a sighted user reads.
	 */
	it("labels the dialog with its own title's id, not merely with something non-empty", async () => {
		harness = mountDialogHost();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		const labelledBy = harness.wrapper.find('.rp-dialog').attributes('aria-labelledby');
		expect(labelledBy).toBeTruthy();
		expect(harness.wrapper.find('.rp-dialog-title').attributes('id')).toBe(labelledBy);
	});

	it('moves focus into the dialog', async () => {
		harness = mountDialogHost();
		harness.background.focus();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		const dialog = harness.wrapper.find('.rp-dialog').element;
		expect(dialog.contains(document.activeElement)).toBe(true);
	});

	it('makes the background inert, and releases it on close', async () => {
		harness = mountDialogHost();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		expect(harness.background.hasAttribute('inert')).toBe(true);

		harness.store.resolve('cancel');
		await nextTick();

		expect(harness.background.hasAttribute('inert')).toBe(false);
	});

	it('releases the background if the view unmounts with a dialog open', async () => {
		harness = mountDialogHost();
		const { background } = harness;
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		harness.wrapper.unmount();
		await nextTick();

		expect(background.hasAttribute('inert')).toBe(false);
	});

	/**
	 * The other three kinds are exercised elsewhere in this file; this is what proves the
	 * FOURTH — `form` — renders through the same host too, rather than falling through to
	 * a blank panel. (What actually fails a fifth kind to build is `vue-tsc` rejecting the
	 * residual union against `FormDialog`'s declared `descriptor: FormDescriptor` prop —
	 * see the template comment in `DialogHost.vue` — not anything this runtime test can
	 * exercise.)
	 */
	it('renders the form kind, the fourth arm of the switch', async () => {
		harness = mountDialogHost();
		const StubForm = defineComponent({ template: '<p>stub form</p>' });
		void harness.store.openDialog({ kind: 'form', title: 'T', component: StubForm });
		await nextTick();

		expect(harness.wrapper.find('.rp-dialog-title').text()).toBe('T');
		expect(harness.wrapper.text()).toContain('stub form');
		expect(harness.wrapper.find('[data-rp-action="cancel"]').exists()).toBe(true);
	});
});

describe('the focus trap', () => {
	it('wraps from the last focusable to the first', async () => {
		harness = mountDialogHost();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		const dialog = harness.wrapper.find('.rp-dialog').element;
		const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
		const last = buttons.at(-1);
		last?.focus();

		pressKey(dialog, 'Tab');

		expect(document.activeElement).toBe(buttons[0]);
	});

	it('wraps backwards from the first focusable to the last', async () => {
		harness = mountDialogHost();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		const dialog = harness.wrapper.find('.rp-dialog').element;
		const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
		buttons[0]?.focus();

		pressKey(dialog, 'Tab', true);

		expect(document.activeElement).toBe(buttons.at(-1));
	});

	/**
	 * The trap only overrides `Tab` AT the edges. A middle focusable exists on the
	 * `delete-reference` kind (four buttons), where a plain `Tab` should not be intercepted
	 * at all — jsdom does not move focus on `Tab` natively, so "unmoved" here is the same
	 * observable outcome browser-native tab order would also leave in place.
	 */
	it('leaves a Tab from a non-edge focusable alone', async () => {
		harness = mountDialogHost();
		void harness.store.openDialog({
			kind: 'delete-reference',
			entityLabel: 'Kitchen',
			references: [],
		});
		await nextTick();

		const dialog = harness.wrapper.find('.rp-dialog').element;
		const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
		const middle = buttons[1];
		middle?.focus();

		pressKey(dialog, 'Tab');

		expect(document.activeElement).toBe(middle);
	});
});

describe('a press that would land focus nowhere', () => {
	/**
	 * The half of the backdrop/`Escape` gap this component owns: a press on the overlay
	 * (the backdrop) or on `.rp-dialog` itself (its own padding, outside any control) is
	 * refused so it cannot blur the focused control to `<body>`. jsdom implements no
	 * browser default action for `mousedown` — no focus actually moves here either way —
	 * so `defaultPrevented` is what a jsdom test can honestly assert; that
	 * `preventDefault()` is what PRESERVES focus in a real browser is Chromium's guarantee,
	 * unproven by this test (see `pressDown`'s docblock).
	 */
	it('refuses a press on the backdrop', async () => {
		harness = mountDialogHost();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		const overlay = harness.wrapper.find('.rp-dialog-overlay').element;
		const event = pressDown(overlay);

		expect(event.defaultPrevented).toBe(true);
	});

	it("refuses a press on the panel's own padding", async () => {
		harness = mountDialogHost();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		const dialog = harness.wrapper.find('.rp-dialog').element;
		const event = pressDown(dialog);

		expect(event.defaultPrevented).toBe(true);
	});

	it('leaves a press on a focusable control alone', async () => {
		harness = mountDialogHost();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		const button = harness.wrapper.find('[data-rp-action="cancel"]').element;
		const event = pressDown(button);

		expect(event.defaultPrevented).toBe(false);
	});

	/**
	 * `closest()` is declared on `Element`, not `HTMLElement` — Obsidian's `setIcon()`
	 * renders an SVG glyph INSIDE a button, and a press landing on that glyph has an
	 * `SVGElement` as `event.target`. An `instanceof HTMLElement` guard would fail for it
	 * and fall through to `preventDefault()`, silently refusing a press on a control the
	 * user did click. No dialog kind renders an icon today, so this is reachable only by
	 * building the target by hand, the way this case does.
	 */
	it('leaves a press on an SVG glyph inside a focusable control alone', async () => {
		harness = mountDialogHost();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		const button = harness.wrapper.find('[data-rp-action="cancel"]').element;
		const glyph = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		button.appendChild(glyph);
		const event = pressDown(glyph);

		expect(event.defaultPrevented).toBe(false);
	});
});

describe('Escape', () => {
	it('resolves a confirm dialog as a cancellation', async () => {
		harness = mountDialogHost();
		const pending = harness.store.openDialog(CONFIRM);
		await nextTick();

		pressKey(harness.wrapper.find('.rp-dialog').element, 'Escape');

		await expect(pending).resolves.toBe('cancel');
	});

	it('resolves a delete-reference dialog in ITS cancel shape, not a bare string', async () => {
		harness = mountDialogHost();
		const pending = harness.store.openDialog({
			kind: 'delete-reference',
			entityLabel: 'Kitchen',
			references: [{ label: 'Requirements', count: 2 }],
		});
		await nextTick();

		pressKey(harness.wrapper.find('.rp-dialog').element, 'Escape');

		await expect(pending).resolves.toEqual({ action: 'cancel' });
	});

	/**
	 * The listener is on the DIALOG, not the document. Two Plan Editor leaves may each have
	 * a dialog open, and one `Escape` must close the focused one only — a document-level
	 * listener per host would close both, which is the defect this asserts against.
	 *
	 * This is also the shape of the RESIDUAL gap `DialogHost.vue`'s header now names rather
	 * than hides: dispatching `Escape` directly at an element outside `.rp-dialog` (as this
	 * test does) is the same thing that happens for real once focus has actually left the
	 * panel — which `onMousedown` prevents for a press on the backdrop or the panel's own
	 * padding, but cannot prevent for a click into Obsidian's own chrome. This case is not
	 * proving that gap closed; it is proving this component's own listener placement is
	 * correct given that the gap exists elsewhere.
	 */
	it('leaves a keydown outside the dialog alone', async () => {
		harness = mountDialogHost();
		const pending = harness.store.openDialog(CONFIRM);
		await nextTick();
		let settled = false;
		void pending.then(() => {
			settled = true;
			return undefined;
		});

		pressKey(harness.background, 'Escape');
		await nextTick();

		expect(settled).toBe(false);
	});

	/**
	 * Two `keydown`s can land before Vue's next render flush removes `.rp-dialog` from the
	 * DOM — a held key auto-repeating, or two events dispatched in the same synchronous
	 * turn. The first `Escape` already cleared `store.current` by the time the second
	 * fires on the still-mounted element; without `onKeydown`'s `descriptor === null`
	 * guard, the second event would read `.kind` off a `null` descriptor and throw inside
	 * the compiled listener. Traced against this exact `@vue/runtime-core`: with no
	 * `app.config.warnHandler`/`errorHandler` configured (neither is, here), Vue's
	 * `logError` reports the throw through `console.warn` and then RE-THROWS — jsdom's
	 * event dispatch swallows that re-throw rather than propagating it to `pressKey`'s
	 * caller, so `pending` still resolves correctly either way (the first `Escape` already
	 * settled it). The `console.warn` spy is what the guard actually owns; asserting on
	 * `pending` alone would pass with the guard deleted.
	 */
	it('ignores a second Escape fired before the DOM has caught up with the first', async () => {
		harness = mountDialogHost();
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const pending = harness.store.openDialog(CONFIRM);
		await nextTick();

		const dialog = harness.wrapper.find('.rp-dialog').element;
		pressKey(dialog, 'Escape');
		pressKey(dialog, 'Escape');

		await expect(pending).resolves.toBe('cancel');
		expect(consoleWarn).not.toHaveBeenCalled();
		consoleWarn.mockRestore();
	});

	it('leaves a key that is neither Escape nor Tab alone', async () => {
		harness = mountDialogHost();
		const pending = harness.store.openDialog(CONFIRM);
		await nextTick();
		let settled = false;
		void pending.then(() => {
			settled = true;
			return undefined;
		});

		pressKey(harness.wrapper.find('.rp-dialog').element, 'a');
		await nextTick();

		expect(settled).toBe(false);
	});
});

describe('focus restoration', () => {
	/**
	 * Every resolution path, not just cancel. A dialog that restores focus only when
	 * dismissed strands a keyboard user on the confirm path — the one they took on purpose.
	 */
	it.each([
		['the confirm button', '[data-rp-action="confirm"]'],
		['the cancel button', '[data-rp-action="cancel"]'],
	])('returns focus to the pre-open element after %s', async (_name, selector) => {
		harness = mountDialogHost();
		harness.background.focus();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		await harness.wrapper.find(selector).trigger('click');
		await nextTick();

		expect(document.activeElement).toBe(harness.background);
	});

	it('returns focus after Escape too', async () => {
		harness = mountDialogHost();
		harness.background.focus();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		pressKey(harness.wrapper.find('.rp-dialog').element, 'Escape');
		await nextTick();

		expect(document.activeElement).toBe(harness.background);
	});
});

describe('sequential dialogs', () => {
	/**
	 * The Reassign branch's shape: the first dialog resolves and clears `current` before the
	 * second opens. Never nested — the stacking guard would throw, which is the assertion.
	 */
	it('lets a caller open a second dialog the moment the first resolves', async () => {
		harness = mountDialogHost();
		const first = harness.store.openDialog({
			kind: 'delete-reference',
			entityLabel: 'Kitchen',
			references: [],
		});
		await nextTick();

		await harness.wrapper.find('[data-rp-action="reassign"]').trigger('click');
		await expect(first).resolves.toEqual({ action: 'reassign' });

		const second = harness.store.openDialog({
			kind: 'entity-picker',
			title: t('en', 'dialog.cancel'),
			candidates: [{ id: 'z-1', label: 'Bathroom' }],
		});
		await nextTick();

		expect(harness.wrapper.findAll('.rp-dialog')).toHaveLength(1);
		expect(harness.wrapper.find('.rp-dialog-candidate').exists()).toBe(true);

		harness.store.resolve('cancel');
		await expect(second).resolves.toBe('cancel');
	});
});
