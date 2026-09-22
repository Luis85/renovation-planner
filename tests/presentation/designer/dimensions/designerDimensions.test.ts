/**
 * @vitest-environment jsdom
 *
 * The designer's dimensions on canvas as a mounted surface — where they draw, where they refuse to,
 * what a press on one does and what typing into it writes (asset designer snapping spec 2026-09-15,
 * §0's increment 2; AD18-R11). The arithmetic is `dimensionFigures.test.ts`'s, beside this.
 *
 * **Driven through `designerRig`, the REAL wiring**, not a bare mount: C12 asks that tests exercise
 * actual command wiring rather than component existence, and the half of this card that is new —
 * a control in the overlay slot that dispatches — is precisely the half a stubbed `editShape` would
 * not check. A bare mount is not available anyway: this component injects the runtime, whose
 * `InjectionKey` its module deliberately does not export.
 *
 * **What this file cannot reach, said before any case implies otherwise.** jsdom computes no
 * layout, so nothing here measures a rendered pixel, whether a label occludes the drawing, whether
 * two labels collide at a small part, or whether any of it is legible at a 460 px leaf. Those are
 * browser measurements and are in
 * `docs/tasks/asset-designer-expansion/reports/W19-A-dimensions-on-canvas.md`. What it CAN reach is
 * what a rule DECLARES (through lightningcss, since jsdom resolves no stylesheet either) and what
 * the template writes into an element's own `style` attribute.
 *
 * The camera every case reasons at is `DEFAULT_VIEWPORT` (`camera: 'default'`) — zoom 0.1, pan
 * (-480, -480) — so `screen = (world + 480) / 10`. `editableShape()`'s footprint is 1000 x 600
 * centred on the origin, so its top edge's middle, (0, -300), lands at (48, 18).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { t } from '../../../../src/presentation/i18n/strings';
import { useAssetDesignStore } from '../../../../src/presentation/designer/stores/assetDesignStore';
import { footprintFromDimensions } from '../../../../src/domain/asset/AssetShape';
import { editableShape } from '../../../helpers/assetShapes';
import { expectOk } from '../../../helpers/domain';
import { designerRig, type DesignerRig } from '../../../helpers/designerRig';
import { settle } from '../../../helpers/editor';
import { propertyOf, show, stylesheetRules, type StyleRule } from '../../../helpers/selectors';

/** The rig every case starts from: the real designer over a shape with a footprint, two details and a clearance. */
const designer = (options: Parameters<typeof designerRig>[0] = {}): Promise<DesignerRig> =>
	designerRig({ shape: editableShape(), camera: 'default', ...options });

/** Every dimension button the overlay draws, as `[name, text]` pairs in DOM order. */
function buttons(rig: DesignerRig): [string, string][] {
	return rig.wrapper.findAll('.rp-designer-dimensions .rp-designer-dimension__value').map((button) => {
		const element = button.element as HTMLElement;
		return [element.dataset['rpDimension'] ?? '', element.textContent?.trim() ?? ''];
	});
}

/** One button by figure name, thrown for rather than read off an `undefined`. */
const button = (rig: DesignerRig, name: string): HTMLButtonElement =>
	rig.wrapper.get(`.rp-designer-dimensions [data-rp-dimension="${name}"]`).element as HTMLButtonElement;

/** Open a figure's field and hand back its input, having let the focus tick run. */
async function openField(rig: DesignerRig, name: string): Promise<HTMLInputElement> {
	button(rig, name).click();
	await settle();
	return rig.wrapper.get('.rp-designer-dimension__form input').element as HTMLInputElement;
}

/** Type into the open field the way a user does, so `v-model` sees it. */
async function type(rig: DesignerRig, text: string): Promise<void> {
	await rig.wrapper.get('.rp-designer-dimension__form input').setValue(text);
}

const submit = async (rig: DesignerRig): Promise<void> => {
	await rig.wrapper.get('.rp-designer-dimension__form').trigger('submit');
	await settle();
};

const partial = (file: string): StyleRule[] => stylesheetRules(readFileSync(`styles/${file}`, 'utf8'));

/** How this parser reads one declaration, so no case spells lightningcss's own AST by hand. */
function reference(property: string, value: string): unknown {
	const [rule] = stylesheetRules(`.reference { ${property}: ${value}; }`);
	const declaration = rule?.declarations[0];
	if (declaration === undefined) throw new Error(`no declaration parsed from: ${property}: ${value}`);
	return declaration.value;
}

/** Every value `property` takes in the rules whose selector list is exactly `selector`. */
function declared(rules: readonly StyleRule[], selector: string, property: string): unknown[] {
	const [parsed] = stylesheetRules(`${selector} { color: inherit; }`);
	const wanted = (parsed?.selectors ?? []).map((one) => show(one)).join(', ');
	if (wanted === '') throw new Error(`no selector parsed from: ${selector}`);
	return rules
		.filter((rule) => rule.condition === '' && rule.selectors.map((one) => show(one)).join(', ') === wanted)
		.flatMap((rule) => rule.declarations.filter((entry) => propertyOf(entry) === property).map((entry) => entry.value));
}

describe('what the designer’s dimensions draw', () => {
	/**
	 * The wiring nothing else mounts: the labels have to be INSIDE `EditorSurface`'s overlay slot,
	 * not merely somewhere in the tree, because that is what resolves their `position: absolute`
	 * against the canvas region and what puts them where AD18-R11 measured the pointer question.
	 */
	it('mounts in the canvas overlay and measures the footprint with nothing selected', async () => {
		const rig = await designer();
		try {
			const overlay = rig.canvasEl.querySelector('.rp-plan-overlay');
			const drawn = rig.wrapper.get('.rp-designer-dimensions').element;
			expect(overlay?.contains(drawn)).toBe(true);

			expect(buttons(rig)).toEqual([['overall-width', '1000'], ['overall-depth', '600']]);
			// (0, -300) at this camera is (48, 18); the label is centred on it by the stylesheet.
			expect(button(rig, 'overall-width').parentElement?.style.left).toBe('48px');
			expect(button(rig, 'overall-width').parentElement?.style.top).toBe('18px');
		} finally {
			rig.unmount();
		}
	});

	/** A button reading `1000` alone says nothing about what it measures, so each carries its own name. */
	it('names every button by what it measures, its value and its unit', async () => {
		const rig = await designer();
		try {
			expect(button(rig, 'overall-width').getAttribute('aria-label'))
				.toBe(t('en', 'designer.dimension.value', { name: t('en', 'designer.dimension.overall-width'), value: '1000' }));
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **Selection-driven, per the spec's own decision table**, through the real store rather than a
	 * prop: selecting a detail adds its size and its four offsets, and clearing puts it back.
	 */
	it('adds the selected part’s size and offsets, and drops them when the selection clears', async () => {
		const rig = await designer();
		try {
			useAssetDesignStore(rig.pinia).select({ kind: 'detail', id: 'detail-1' });
			await settle();
			expect(buttons(rig).map(([name]) => name)).toContain('detail-detail-1-offset-left');
			expect(buttons(rig)).toContainEqual(['detail-detail-1-offset-left', '100']);

			useAssetDesignStore(rig.pinia).select(null);
			await settle();

			expect(buttons(rig).map(([name]) => name)).toEqual(['overall-width', 'overall-depth']);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **The `All dimensions` row is the toggle §0 asks for**, and it is LEAF-LOCAL per AD18-R12 — a
	 * plain `ref` on the runtime, so this drives the real checkbox and asserts the overlay rather
	 * than the ref. `data-rp-view` is how the menu's rows are addressed, as `designerViewMenu.test.ts`
	 * addresses the three above it.
	 */
	it('widens to every part when the View menu’s All dimensions is ticked', async () => {
		const rig = await designer();
		try {
			await rig.wrapper.get('.rp-designer-tools [data-rp-view="all-dimensions"]').setValue(true);

			const names = buttons(rig).map(([name]) => name);
			expect(names).toContain('detail-detail-1-offset-left');
			expect(names).toContain('clearance-offset-bottom');
			// `detail-2` is PENDING, so it is withheld in this mode exactly as it is when selected.
			expect(names.some((name) => name.startsWith('detail-detail-2-'))).toBe(false);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **Updated live from the drag PREVIEW**, which is the spec's own wording and the binding
	 * AD18-R11 carries forward from the ruler card — that card was sent back for reading the
	 * committed shape instead. `DesignerCanvas`'s `shape` is `preview ?? design.shape` and every
	 * figure here follows it, so the number beside a part travels with the part rather than waiting
	 * for the release.
	 */
	it('follows the gesture’s preview rather than the committed shape', async () => {
		const rig = await designer();
		try {
			expect(buttons(rig)).toContainEqual(['overall-width', '1000']);

			useAssetDesignStore(rig.pinia).setPreview({ ...editableShape(), footprint: expectOk(footprintFromDimensions(2400, 1600)) });
			await settle();

			expect(buttons(rig)).toContainEqual(['overall-width', '2400']);
			expect(buttons(rig)).toContainEqual(['overall-depth', '1600']);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **No numbers on an unscaled design.** A footprint traced before the asset had a scale carries
	 * placeholder pixels; a millimetre reading over it would put a unit on a number that is not a
	 * measurement, which is the rule the status row's grid step and the rulers already follow. This
	 * is the design-wide half — `dimensionsUnscaled`, the DTO's own flag — where the per-part half
	 * is `dimensionFigures.test.ts`'s.
	 */
	it('draws nothing at all over an unscaled design', async () => {
		const rig = await designer({ shape: editableShape({ footprintOrigin: 'traced', footprintPending: true }) });
		try {
			expect(useAssetDesignStore(rig.pinia).design?.dimensionsUnscaled).toBe(true);
			expect(rig.wrapper.findAll('.rp-designer-dimension__value')).toHaveLength(0);
		} finally {
			rig.unmount();
		}
	});

	/** And nothing over an asset nobody has drawn on: there is no footprint to measure anything against. */
	it('draws nothing for a design with no shape', async () => {
		const rig = await designer({ shape: null });
		try {
			expect(rig.wrapper.findAll('.rp-designer-dimension__value')).toHaveLength(0);
		} finally {
			rig.unmount();
		}
	});
});

describe('the inline field a dimension opens', () => {
	/**
	 * The spec's *"each value a button opening an inline field"*, which is the half AD18-R11 had to
	 * settle a mechanism for: a real `<button>` swapped for a real `<form>` with a focused
	 * `<input inputmode="decimal">`, in the same overlay slot whose wrapper was believed to forbid
	 * exactly this. It does not — the `.stop` modifiers are bubble-phase.
	 */
	it('swaps the button for a focused field, and puts the current value in it', async () => {
		const rig = await designer();
		try {
			const input = await openField(rig, 'overall-width');

			expect(input.value).toBe('1000');
			expect(input.getAttribute('inputmode')).toBe('decimal');
			expect(document.activeElement).toBe(input);
			// One field at a time, and the button it replaced is gone rather than merely hidden.
			expect(rig.wrapper.findAll('.rp-designer-dimension__form')).toHaveLength(1);
			expect(rig.wrapper.find('[data-rp-dimension="overall-width"]').exists()).toBe(false);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **The real write, through the real `editShape`** — which is what C12 means by exercising the
	 * command wiring: the figure's own pure edit reaches `SetAssetShape` on the leaf's one write
	 * chain, and the number the overlay then draws is what the vault read back.
	 */
	it('writes the typed size through the real command and redraws what landed', async () => {
		const rig = await designer();
		try {
			await openField(rig, 'overall-width');
			await type(rig, '2000');

			await submit(rig);

			expect(buttons(rig)).toContainEqual(['overall-width', '2000']);
			expect(rig.wrapper.findAll('.rp-designer-dimension__form')).toHaveLength(0);
		} finally {
			rig.unmount();
		}
	});

	/** An offset writes the same way, which is the family that MOVES a part rather than resizing it. */
	it('writes a typed offset by moving the part, leaving its size alone', async () => {
		const rig = await designer();
		try {
			useAssetDesignStore(rig.pinia).select({ kind: 'detail', id: 'detail-1' });
			await settle();
			await openField(rig, 'detail-detail-1-offset-left');
			await type(rig, '250');

			await submit(rig);

			expect(buttons(rig)).toContainEqual(['detail-detail-1-offset-left', '250']);
			expect(buttons(rig)).toContainEqual(['detail-detail-1-width', '400']);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **Closing hands focus back to the button that opened the field.** A browser drops focus to
	 * `<body>` when the focused control unmounts, and every way out of this field unmounts it — so
	 * without this the next Tab restarts from the top of the pane. `RoomDimensionLabels` carries the
	 * same hand-off on the plan side.
	 *
	 * Escape and Cancel are asserted as one case because they are one function: the difference
	 * between them is which listener calls it, and both are driven.
	 */
	it.each([
		['escape', async (rig: DesignerRig) => { await rig.wrapper.get('.rp-designer-dimension__form').trigger('keydown', { key: 'Escape' }); }],
		['cancel', async (rig: DesignerRig) => { await rig.wrapper.findAll('.rp-designer-dimension__actions button')[1]?.trigger('click'); }],
	])('closes on %s and gives focus back to its button', async (_how: string, close: (rig: DesignerRig) => Promise<void>) => {
		const rig = await designer();
		try {
			await openField(rig, 'overall-depth');

			await close(rig);
			await settle();

			expect(rig.wrapper.findAll('.rp-designer-dimension__form')).toHaveLength(0);
			expect(document.activeElement).toBe(button(rig, 'overall-depth'));
			// Nothing was written: the value is the one the design still has.
			expect(buttons(rig)).toContainEqual(['overall-depth', '600']);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * A text field can hold what the geometry cannot use, and C12 asks that a control which cannot
	 * do what is asked says why. The field STAYS OPEN so the user can correct what they typed rather
	 * than re-opening it and typing it again.
	 */
	it.each([[''], ['   '], ['wide']])('refuses %o without writing, and keeps the field open', async (text: string) => {
		const rig = await designer();
		try {
			await openField(rig, 'overall-width');
			await type(rig, text);

			await submit(rig);

			expect(rig.wrapper.get('.rp-designer-dimension__error').text()).toBe(t('en', 'designer.dimension.unavailable'));
			expect(rig.wrapper.findAll('.rp-designer-dimension__form')).toHaveLength(1);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * A refusal the DOMAIN answers is a different sentence from the one above and reaches the field
	 * through `trError`, never as a raw message: `footprintFromDimensions` refuses a non-positive
	 * dimension, so a typed zero is refused by the rule that owns what a footprint is rather than by
	 * anything this overlay knows. The field stays open for the same reason.
	 */
	it('shows a refused write’s own mapped message', async () => {
		const rig = await designer();
		try {
			await openField(rig, 'overall-width');
			await type(rig, '0');

			await submit(rig);

			const shown = rig.wrapper.get('.rp-designer-dimension__error').text();
			expect(shown).not.toBe('');
			expect(shown).not.toBe(t('en', 'designer.dimension.unavailable'));
			expect(rig.wrapper.findAll('.rp-designer-dimension__form')).toHaveLength(1);
			// Nothing landed: closing the field puts the button back reading what it read before.
			await rig.wrapper.get('.rp-designer-dimension__form').trigger('keydown', { key: 'Escape' });
			await settle();
			expect(buttons(rig)).toContainEqual(['overall-width', '1000']);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **A figure can be withdrawn while its field is open** — the design goes unscaled, or the part
	 * is deleted by a peer — and a submission then has nothing to write. It is refused rather than
	 * written past, which is the arm `editing` exists for.
	 */
	it('refuses a submission whose figure is no longer measured', async () => {
		const rig = await designer();
		try {
			await openField(rig, 'overall-width');
			const store = useAssetDesignStore(rig.pinia);
			store.design = store.design === null ? null : { ...store.design, dimensionsUnscaled: true };
			await settle();

			expect(rig.wrapper.findAll('.rp-designer-dimension__form')).toHaveLength(0);
			expect(rig.wrapper.findAll('.rp-designer-dimension__value')).toHaveLength(0);
		} finally {
			rig.unmount();
		}
	});
});

describe('the dimensions’ stylesheet', () => {
	/**
	 * **The pair AD18-R11 turns on, and it is a PAIR rather than one declaration.** `none` on the
	 * container is what lets the canvas go on receiving a press through the gaps BETWEEN the labels;
	 * `auto` on the controls is what makes them pressable at all. Either one alone is a different
	 * surface: without `none` the whole overlay eats every gesture the canvas needs, and without
	 * `auto` the buttons are decoration.
	 *
	 * Declared, not rendered: jsdom resolves no stylesheet, so this reads the partial through
	 * lightningcss. Whether a label is legible or occludes the drawing is a browser measurement and
	 * is in the card's report.
	 */
	it('takes no pointer on the container and gives it back to the controls', () => {
		const rules = partial('designer-dimensions.css');

		expect(declared(rules, '.rp-designer-dimensions', 'pointer-events')).toEqual([reference('pointer-events', 'none')]);
		expect(declared(rules, '.rp-designer-dimension__value, .rp-designer-dimension__form', 'pointer-events'))
			.toEqual([reference('pointer-events', 'auto')]);
	});

	/** And it takes the canvas no LAYOUT, which is the property AD18-R10's floor rests on for the rulers. */
	it('takes no layout from the canvas', () => {
		const rules = partial('designer-dimensions.css');

		expect(declared(rules, '.rp-designer-dimensions', 'position')).toEqual([reference('position', 'absolute')]);
		expect(declared(rules, '.rp-designer-dimension', 'position')).toEqual([reference('position', 'absolute')]);
	});
});
