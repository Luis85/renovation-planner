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
import type { StringKey } from '../../../../src/presentation/i18n/locales/en';
import { useAssetDesignStore } from '../../../../src/presentation/designer/stores/assetDesignStore';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
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

			expect(buttons(rig)).toEqual([['overall-width', '1000 mm'], ['overall-depth', '600 mm']]);
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
			expect(buttons(rig)).toContainEqual(['detail-detail-1-offset-left', '100 mm']);

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
	 * **The half of the `RoomDimensionLabels` pattern that keeps the canvas usable.** The overall
	 * pair anchors on the middles of the footprint's top and left edges — exactly the outline a user
	 * traces against — and its buttons carry `pointer-events: auto`. Under a drawing tool a press
	 * there would land on the button in the target phase, the slot wrapper's `@pointerdown.stop`
	 * would keep the bubbled event off the canvas, the vertex would never be taken, and the release
	 * would open an edit form over the drawing.
	 *
	 * AD18-R11 settled whether the slot PERMITS a control. It did not license a control sitting over
	 * a gesture. No gate in this repository can see the defect — jsdom lays nothing out — so this
	 * drives the tool id and asserts the overlay, which is the reachable half of the claim.
	 */
	it.each([
		['designer.toolbar.trace-footprint'],
		['designer.toolbar.draw-rect'],
		['designer.toolbar.set-anchor'],
	] as const)('withdraws every figure while %s is the active tool', async (label: StringKey) => {
		const rig = await designer();
		try {
			expect(buttons(rig)).not.toEqual([]);

			rig.toolbarButton(t('en', label)).click();
			await settle();

			expect(buttons(rig)).toEqual([]);
		} finally {
			rig.unmount();
		}
	});

	/** And Select puts them back, which is what makes the gate a gate rather than a switch-off. */
	it('draws them under Select, and under the camera the designer opens with', async () => {
		const rig = await designer();
		try {
			expect(buttons(rig).map(([name]) => name)).toEqual(['overall-width', 'overall-depth']);

			rig.toolbarButton(t('en', 'designer.toolbar.trace-footprint')).click();
			await settle();
			rig.toolbarButton(t('en', 'designer.toolbar.select')).click();
			await settle();

			expect(buttons(rig).map(([name]) => name)).toEqual(['overall-width', 'overall-depth']);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **The open field grows INTO the canvas.** `.rp-plan-canvas` is `overflow: hidden` and
	 * `DesignerCanvas` fits an opened asset with a 48 px margin, so the overall pair's anchors sit
	 * near the top and left edges; the first version lifted every form a full height above its
	 * anchor unconditionally and both were clipped on open, at the camera this surface chooses for
	 * itself.
	 *
	 * The assertion is on the TRANSFORM rather than on a rendered box, because jsdom measures
	 * nothing — but the transform is the whole of the decision, and `0` on an axis means the box
	 * starts at the anchor and runs away from the near edge.
	 */
	it('grows an open field away from the nearer canvas edge, and centres a button on its mark', async () => {
		const rig = await designer();
		try {
			const anchor = (name: string): string => (button(rig, name).parentElement as HTMLElement).style.transform;
			expect(anchor('overall-width')).toBe('translate(-50%, -50%)');

			await openField(rig, 'overall-width');

			// (48, 18) on an 800 x 600 stage is the top-left quadrant, so the field runs down-right.
			const field = rig.wrapper.get('.rp-designer-dimension__form').element.parentElement as HTMLElement;
			expect(field.style.transform).toBe('translate(0, 0)');
		} finally {
			rig.unmount();
		}
	});

	/**
	 * The other quadrant, which is the half a single camera cannot reach: panned so the same anchor
	 * lands past both midpoints of the stage, the field has to run UP and LEFT instead. Without both
	 * arms driven, a `placement` that answered one direction for every anchor would pass.
	 */
	it('grows an open field up and left when its mark sits in the far quadrant', async () => {
		const rig = await designer();
		try {
			// screen = (world - pan) * zoom, so this puts (0, -300) at (500, 470) on an 800 x 600 stage.
			useEditorStore(rig.pinia).viewport = { pan: { x: -5000, y: -5000 }, zoom: 0.1 };
			await settle();

			await openField(rig, 'overall-width');

			const field = rig.wrapper.get('.rp-designer-dimension__form').element.parentElement as HTMLElement;
			expect(field.style.transform).toBe('translate(-100%, -100%)');
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **The arm `open`'s own comment describes**, driven rather than disclosed: a write landing in
	 * the very tick the field is drawn withdraws the figure, so there is no input left to focus.
	 * Reproduced by mutating the store synchronously after the press, which is the same tick
	 * `open()` is waiting out — the one way this overlay's DOM changes without a gesture.
	 */
	it('focuses nothing when the figure is withdrawn in the tick its field was drawn', async () => {
		const rig = await designer();
		try {
			const store = useAssetDesignStore(rig.pinia);
			button(rig, 'overall-width').click();
			store.design = store.design === null ? null : { ...store.design, dimensionsUnscaled: true };
			await settle();

			expect(rig.wrapper.findAll('.rp-designer-dimension__form')).toHaveLength(0);
			expect(document.activeElement).toBe(document.body);
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
			expect(buttons(rig)).toContainEqual(['overall-width', '1000 mm']);

			useAssetDesignStore(rig.pinia).setPreview({ ...editableShape(), footprint: expectOk(footprintFromDimensions(2400, 1600)) });
			await settle();

			expect(buttons(rig)).toContainEqual(['overall-width', '2400 mm']);
			expect(buttons(rig)).toContainEqual(['overall-depth', '1600 mm']);
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

			expect(buttons(rig)).toContainEqual(['overall-width', '2000 mm']);
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

			expect(buttons(rig)).toContainEqual(['detail-detail-1-offset-left', '250 mm']);
			expect(buttons(rig)).toContainEqual(['detail-detail-1-width', '400 mm']);
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
			expect(buttons(rig)).toContainEqual(['overall-depth', '600 mm']);
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
			expect(buttons(rig)).toContainEqual(['overall-width', '1000 mm']);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **A figure withdrawn while its field is open takes the field with it**, and there is no
	 * submission left to refuse — which is why `submit` no longer carries a guard for one. The form
	 * renders only inside the `v-for` entry of a currently measured figure, so a submit event cannot
	 * arrive after the figure has gone.
	 */
	it('takes the open field away with the figure it belonged to', async () => {
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

	/**
	 * **And the DRAFT goes with it.** A figure can leave `figures` with no gesture of this overlay's
	 * — here a deselect — and the `v-for` unmounts the form with no hand-off. Before the watch, the
	 * draft survived: re-selecting the part drew the field open again, unfocused, still holding the
	 * text that was typed and the refusal that was showing.
	 *
	 * Driven with a REFUSAL on screen as well as text, because the two are cleared by the same line
	 * and a fix that cleared only one would leave a stale alert over a fresh field.
	 */
	it('clears a draft whose figure was withdrawn, so re-selecting opens a button and not a stale field', async () => {
		const rig = await designer();
		try {
			const store = useAssetDesignStore(rig.pinia);
			store.select({ kind: 'detail', id: 'detail-1' });
			await settle();
			await openField(rig, 'detail-detail-1-width');
			await type(rig, 'wide');
			await submit(rig);
			expect(rig.wrapper.findAll('.rp-designer-dimension__error')).toHaveLength(1);

			store.select(null);
			await settle();
			store.select({ kind: 'detail', id: 'detail-1' });
			await settle();

			expect(rig.wrapper.findAll('.rp-designer-dimension__form')).toHaveLength(0);
			expect(rig.wrapper.findAll('.rp-designer-dimension__error')).toHaveLength(0);
			expect(buttons(rig)).toContainEqual(['detail-detail-1-width', '400 mm']);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **C03, through the whole mounted stack**: typing the value a figure already shows dispatches
	 * nothing at all. The `no-write` still closes the field, because from the user's side pressing
	 * Apply on an unchanged number is done either way.
	 *
	 * Asserted at the SAVE INDICATOR rather than by spying: the rig writes to a real vault through
	 * the real command, so a write that happened would be a write the surface reports. The version
	 * is read from the store, which is what a revision moves.
	 */
	it('writes nothing when the value typed is the one already shown', async () => {
		const rig = await designer();
		try {
			const store = useAssetDesignStore(rig.pinia);
			const before = store.design?.geometryVersion.revision;
			await openField(rig, 'overall-width');
			await type(rig, '1000');

			await submit(rig);

			expect(store.design?.geometryVersion.revision).toBe(before);
			expect(rig.wrapper.findAll('.rp-designer-dimension__form')).toHaveLength(0);
			expect(buttons(rig)).toContainEqual(['overall-width', '1000 mm']);
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
