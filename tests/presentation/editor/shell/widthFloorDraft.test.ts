// @vitest-environment jsdom
/**
 * A DRAFT open while the leaf width crosses the floor — the lifecycle contract's row F5
 * (`docs/releases/first-beta-readiness/04-lifecycle-contract.md`), which read "zero cases cross
 * the width floor into the mode where the canvas unmounts, with a draft open".
 *
 * `responsiveShell.test.ts` already crosses that floor in every direction and already asks what
 * happens to a GESTURE (an interrupted Select drag, a polygon's placed vertices). What no case
 * asked is the two questions the contract's rules 1 and 4 turn on:
 *
 * - **Is anything WRITTEN?** Asserted at the repository, never at the component — `rig()` mounts
 *   the real editor over real in-memory repositories, so "nothing was written" is a claim about
 *   the vault rather than about which method a spy saw. `responsiveShell.test.ts` cannot make it
 *   at all: its harness dispatches through `unavailablePlanEditorCommands()`, where every write
 *   refuses and a commit would be invisible.
 * - **Does retained text still address the entity it was typed for?** The shell's asymmetry is
 *   what makes this a real question rather than a formality: the canvas slot is `v-if`'d on the
 *   layout mode (`ResponsiveEditorShell.vue`) and unmounts, while `EditorSidePanel`'s slot is
 *   `v-show`n and does not — so an Inspector draft is still there when the pane comes back, and
 *   rule 4 asks whether it is still the same requirement's.
 *
 * **What is measured here and is worth knowing before adding a case: below the floor there is no
 * door that can move the selection.** The canvas is unmounted and BOTH side panels are
 * `v-show`n false — asserted in the second case rather than assumed — so the relocation hazard
 * has to be asked on the way back UP, through a real canvas click, which is what that case does.
 *
 * The draft is an `Inspector` override field (`RequirementRow`, `useFieldCommit`) because that is
 * the Plan Editor's only free-text field inside a side panel; `use-form-commit.ts`'s consumers in
 * this tree all live in dialogs, which a width change does not touch.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { runtimeOf, settle, settleUntil as until } from '../../../helpers/editor';
import { PLAN_DTO, PROJECT_ID, actionButton, click, rig } from '../../../helpers/planEditorRig';
import { resizeTo } from '../../../helpers/layout';
import { expectOk } from '../../../helpers/domain';
import { makeAsset, makeZone } from '../../../helpers/entities';
import { createPolygon } from '../../../../src/core/geometry/Polygon';
import type { PlanId } from '../../../../src/domain/plan/PlanId';
import type { ZoneId } from '../../../../src/domain/zone/ZoneId';

/**
 * A second room beside the fixture's. World 5500..7500 x 1500..3400, which at the default camera
 * (`world = 10 x screen - 480` per axis, `planEditorRig.ts`'s own note) is screen 598..798 x
 * 198..388 — inside the 800x600 stage, and disjoint from the fixture zone's 198..488 x 198..388.
 */
const ZONE_B_POINTS = [{ x: 5500, y: 1500 }, { x: 7500, y: 1500 }, { x: 7500, y: 3400 }, { x: 5500, y: 3400 }];
const IN_ROOM_A = { x: 300, y: 300 };
const IN_ROOM_B = { x: 700, y: 300 };

let open: { unmount: () => void } | null = null;
afterEach(() => {
	open?.unmount();
	open = null;
});

type Rig = Awaited<ReturnType<typeof rig>>;

/** The rig, plus one catalogue asset and (when asked) a second room to relocate a draft onto. */
async function editorWithRooms(second: boolean): Promise<{ readonly r: Rig; readonly assetId: string }> {
	const r = await rig(async ({ assets, zones }) => {
		await assets.save(makeAsset({ name: 'Plaster', unit: 'm2', wasteFactorDefault: new Decimal('0.10') }), 'absent');
		if (second) {
			await zones.save(makeZone({
				projectId: PROJECT_ID,
				planId: PLAN_DTO.id as PlanId,
				id: 'zone-b' as ZoneId,
				name: 'Hall',
				zoneType: 'Room',
				status: 'Planned',
				geometry: expectOk(createPolygon(ZONE_B_POINTS)),
			}), 'absent');
		}
	});
	open = r.harness;
	return { r, assetId: expectOk(await r.assetsRepo.listAll()).loaded[0].entity.id };
}

/**
 * Select the room under that point and give it a requirement, through the panel's own picker and
 * Assign button — the door a user has. A seeded `Requirement` would skip the assign command that
 * is what makes the override fields render at all.
 */
async function assignTo(r: Rig, at: { x: number; y: number }, assetId: string): Promise<void> {
	actionButton(r.harness, 'Select').click();
	click(r.harness.canvasEl as HTMLElement, at.x, at.y);
	await until(() => r.harness.wrapper.text().includes('Assign'), 'the assign control to appear');
	await until(() => {
		const picker = r.harness.wrapper.find('#rp-assign-asset').element as HTMLSelectElement;
		return [...picker.options].some((option) => option.value === assetId);
	}, 'the asset to be offered');
	await r.harness.wrapper.find('#rp-assign-asset').setValue(assetId);
	await settle();
	const assign = r.harness.wrapper.findAll('button').find((button) => button.text() === 'Assign');
	if (assign === undefined) throw new Error('no Assign button');
	await assign.trigger('click');
	await until(() => r.harness.wrapper.find('input[data-field="quantity"]').exists(), 'the override inputs to render');
}

/**
 * Every quantity override this zone's requirements hold, at the repository — the decimal VALUE
 * of each (`Quantity` is `{ value, unit }`), or `null` where the figure is still the calculated
 * one. This is the write boundary the two rule-1 assertions are made against.
 */
async function overridesOf(r: Rig, zoneId: string): Promise<(string | null)[]> {
	const rows = expectOk(await r.requirementsRepo.listByZone(zoneId as never));
	return rows.map((row) => row.entity.quantity.override?.value.toString() ?? null);
}

/**
 * The override input's current text, or `'(no field)'` where the field is not in the document.
 *
 * A SENTINEL rather than a throw or a `?.`, so that a build which unmounted the panel fails in
 * the `toBe` of whichever case asked — a named value against a named value — rather than as a
 * `TypeError` on an empty `DOMWrapper` several frames up. Measured: with `EditorSidePanel`'s
 * `v-show` mutated to `v-if`, the first two cases here reported
 * `Cannot call isVisible on an empty DOMWrapper` and named neither what was expected nor what
 * was found, which is indistinguishable from the harness breaking.
 */
function quantityText(r: Rig): string {
	const field = r.harness.wrapper.find('input[data-field="quantity"]');
	return field.exists() ? (field.element as HTMLInputElement).value : '(no field)';
}

/** Whether a region is drawn AND visible, as one comparable pair — same reasoning as above. */
function regionState(r: Rig, selector: string): { mounted: boolean; visible: boolean } {
	const found = r.harness.wrapper.find(selector);
	return { mounted: found.exists(), visible: found.exists() && found.isVisible() };
}

const roomShown = (r: Rig): string | undefined => r.harness.wrapper.find('.rp-room-inspector').attributes('data-rp-id');

describe('a draft open while the width crosses the floor', () => {
	/**
	 * Rules 1 and 4 for the surviving half of the shell. The draft is uncommitted — `useFieldCommit`
	 * dispatches on blur or Enter and never on a keystroke — so the whole round trip must write
	 * nothing, and the text must still be the SAME requirement's when the pane comes back.
	 *
	 * The final blur is what makes the identity claim behavioural rather than a DOM observation:
	 * a build that retained the string while re-binding the field to something else would show
	 * `7` here exactly as this one does, and differ only in where the commit lands.
	 */
	it('keeps an uncommitted override draft on its own requirement across the floor and back, writing nothing', async () => {
		const { r, assetId } = await editorWithRooms(false);
		await assignTo(r, IN_ROOM_A, assetId);
		const typed = r.harness.wrapper.find('input[data-field="quantity"]');
		await typed.setValue('7');
		await settle();
		expect(await overridesOf(r, 'zone-a')).toEqual([null]);

		resizeTo(r.harness.rootEl, 320, 800);
		await settle();

		// The draft FIRST, then the asymmetry it rests on — order chosen so that a build which
		// unmounted the panel reddens on the claim this case is named for rather than on its
		// premise. Both are held by one mechanism (`EditorSidePanel`'s slot is `v-show`n), so one
		// mutation moves both; which one it names is what this ordering decides.
		expect(quantityText(r)).toBe('7');
		expect(roomShown(r)).toBe('zone-a');
		expect(r.harness.wrapper.find('.rp-plan-canvas').exists()).toBe(false);
		expect(regionState(r, '.rp-editor-inspector')).toEqual({ mounted: true, visible: false });
		expect(await overridesOf(r, 'zone-a')).toEqual([null]);

		resizeTo(r.harness.rootEl, 1280, 800);
		await settle();

		expect(r.harness.wrapper.find('.rp-plan-canvas').exists()).toBe(true);
		// The SAME input node, not merely an identical value: a re-created field showing `7`
		// would mean the draft had been re-seeded from somewhere, which is a different program.
		expect(r.harness.wrapper.find('input[data-field="quantity"]').element).toBe(typed.element);
		expect(quantityText(r)).toBe('7');
		expect(await overridesOf(r, 'zone-a')).toEqual([null]);

		await r.harness.wrapper.find('input[data-field="quantity"]').trigger('blur');
		await until(async () => (await overridesOf(r, 'zone-a'))[0] !== null, 'the committed override to land');
		expect(await overridesOf(r, 'zone-a')).toEqual(['7']);
	});

	/**
	 * Rule 4's relocation half: *retained text stays with the entity it was typed for, or is
	 * discarded — relocating is not an acceptable answer.*
	 *
	 * **What decides it is NOT the row `:key`**, which is where the first version of this
	 * docblock put it — measured rather than reasoned: with `RoomInspector`'s
	 * `:key="row.requirementId"` mutated to the `v-for` index, all three cases here stayed green.
	 * `inspector-store.ts`'s `hydrateFrom` assigns `requirements.value = []` BEFORE it awaits
	 * either query, so every `RequirementRow` — and with it every `useFieldCommit` draft — is
	 * destroyed the moment the selection changes, whatever the key is. A probe reading the DOM
	 * tick by tick across the click found zero rows on every tick until the new zone's read
	 * settled.
	 *
	 * That line was written for a different rule (its own comment: a blank moment is a truer
	 * answer than the previous zone's rows), so **rule 4 is satisfied here as a side effect of a
	 * staleness fix**, which is exactly the kind of guarantee that disappears silently when the
	 * mechanism under it is revisited. Hence this case. The mutation it is watched red against is
	 * the smallest statement of the forbidden behaviour rather than a removal of either: with
	 * `useFieldCommit`'s `drafted` ref hoisted to module scope — one draft shared by every field —
	 * this case reports `expected '7' to be ''` and its two siblings stay green.
	 *
	 * The width round trip is what makes this F5's case rather than a plain selection test: it is
	 * the interval in which the user cannot see, correct or abandon the draft, and it ends with
	 * the canvas returning as the first door that can move the selection at all.
	 */
	it('discards the draft rather than relocating it when the selection moves to another room after the width returns', async () => {
		const { r, assetId } = await editorWithRooms(true);
		await assignTo(r, IN_ROOM_B, assetId);
		await assignTo(r, IN_ROOM_A, assetId);
		expect(roomShown(r)).toBe('zone-a');
		const typed = r.harness.wrapper.find('input[data-field="quantity"]');
		await typed.setValue('7');
		await settle();

		resizeTo(r.harness.rootEl, 320, 800);
		await settle();

		// Why the relocation is asked on the way back up and not here: at this width nothing the
		// user can reach moves the selection. The canvas is unmounted and both panels are hidden,
		// so the layer list and the Inspector's own rows are `display: none`.
		expect(r.harness.wrapper.find('.rp-plan-canvas').exists()).toBe(false);
		expect(regionState(r, '.rp-editor-layers')).toEqual({ mounted: true, visible: false });
		expect(regionState(r, '.rp-editor-inspector')).toEqual({ mounted: true, visible: false });

		resizeTo(r.harness.rootEl, 1280, 800);
		await settle();
		click(r.harness.canvasEl as HTMLElement, IN_ROOM_B.x, IN_ROOM_B.y);
		await until(() => roomShown(r) === 'zone-b', 'the second room to be selected');
		await until(() => r.harness.wrapper.find('input[data-field="quantity"]').exists(), 'its override inputs');

		// Discarded, which rule 4 blesses — not carried onto the room it was never typed for.
		expect(quantityText(r)).toBe('');
		expect(r.harness.wrapper.find('input[data-field="quantity"]').element).not.toBe(typed.element);

		// And a blur here — the gesture that WOULD dispatch — writes to neither room, because a
		// field with no draft of its own has nothing to commit.
		await r.harness.wrapper.find('input[data-field="quantity"]').trigger('blur');
		await settle();
		expect(await overridesOf(r, 'zone-b')).toEqual([null]);
		expect(await overridesOf(r, 'zone-a')).toEqual([null]);

		// Nor is it waiting back on the room it was typed for: discarding is the whole answer.
		click(r.harness.canvasEl as HTMLElement, IN_ROOM_A.x, IN_ROOM_A.y);
		await until(() => roomShown(r) === 'zone-a', 'the first room again');
		expect(quantityText(r)).toBe('');
	});

	/**
	 * Rule 1 for the half of the shell that DOES unmount. `responsiveShell.test.ts` already pins
	 * that the placed vertices survive and that only an interrupted press is abandoned; what it
	 * cannot ask is whether the release of the canvas's pointer gesture wrote anything, because
	 * its harness refuses every write. Here the zone repository is the instrument.
	 *
	 * Three vertices is a polygon that could be closed and has not been — the state where a
	 * component disappearing is most tempting to treat as a completion, and where rule 1 says a
	 * half-finished shape is DISCARDED rather than committed.
	 */
	it('writes no partial room when a part-drawn polygon loses its canvas below the floor', async () => {
		const { r } = await editorWithRooms(false);
		const runtime = runtimeOf(r.harness);
		const planId = PLAN_DTO.id as PlanId;
		const roomsBefore = expectOk(await r.zonesRepo.listByPlan(planId)).loaded.length;
		runtime.setTool('draw-polygon');
		click(r.harness.canvasEl as HTMLElement, 600, 500);
		click(r.harness.canvasEl as HTMLElement, 650, 520);
		click(r.harness.canvasEl as HTMLElement, 640, 560);
		await settle();
		expect(runtime.renderState.polygonSketch?.vertices).toHaveLength(3);

		resizeTo(r.harness.rootEl, 320, 800);
		await settle();

		expect(r.harness.wrapper.find('.rp-plan-canvas').exists()).toBe(false);
		expect(expectOk(await r.zonesRepo.listByPlan(planId)).loaded).toHaveLength(roomsBefore);

		resizeTo(r.harness.rootEl, 1280, 800);
		await settle();

		expect(expectOk(await r.zonesRepo.listByPlan(planId)).loaded).toHaveLength(roomsBefore);
		// Still the user's to finish or abandon: the draft outlived the unmount without becoming
		// a room, which is both halves of what rule 1 asks for here.
		expect(runtime.activeToolId.value).toBe('draw-polygon');
		expect(runtime.renderState.polygonSketch?.vertices).toHaveLength(3);
	});
});
