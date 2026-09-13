import type { createRepositoryStack } from '../helpers/vault';
import type { PlanGeometrySidecar } from '../../src/application/ports/PlanGeometrySidecar';
import type { Plan } from '../../src/domain/plan/Plan';
import { withPlanSpatialElements } from '../../src/domain/plan/Plan';
import { makeZone } from '../helpers/entities';
import { expectDefined, expectOk } from '../helpers/domain';
// `../helpers/settle` and not `../helpers/editor`, for the reason `planEditor.ts` gives: this reaches a real browser.
import { settleUntil } from '../helpers/settle';

/**
 * `&item=<gesture>` over `&reference` (item modes and "Add to asset library", 2026-09-14): the one floor with renovation
 * AND asset-creation services, seeded with a room, its walls and two plain items, then driven to what a fixed shot shows.
 *
 * - `rectangle`: Add → Item, one rectangle dragged and released — the task bar and details in rectangle mode.
 * - `drag`: the same press and move with NO release, so the preview is photographed mid-drag.
 * - `promote`: the whole-metre Cabinet selected, the canvas menu's Add to asset library pressed — the New asset dialog.
 * - `saved`: the same on the vault-shaped item, saved as a building element — the placement it leaves.
 *
 * Every step is a press on the control a user reaches, as `planEditor.ts`'s own knobs are; pointers are dispatched on the
 * canvas the way its `?area` knob does.
 */
export type ItemGesture = 'rectangle' | 'drag' | 'promote' | 'saved';
const GESTURES: readonly ItemGesture[] = ['rectangle', 'drag', 'promote', 'saved'];

const CABINET_ID = 'element-harness-cabinet';
const VAULT_ITEM_ID = 'element-harness-vault-item';
const ROOM = [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }];
/** The item a live vault could not promote (`itemPromotion.e2e.test.ts`), moved beside the room with its fractions and size kept. */
const VAULT_ITEM = [
	{ x: 6725.19161977902, y: 4892.969875901805 }, { x: 16_924.95910523995, y: 4892.969875901805 },
	{ x: 16_924.95910523995, y: 12_782.043164853258 }, { x: 6725.19161977902, y: 12_782.043164853258 },
];

/** A room, its four walls, a 2 m × 1 m Cabinet clear of every wall, and the vault-shaped item. */
export async function seedItems(stack: ReturnType<typeof createRepositoryStack>, geometry: PlanGeometrySidecar, plan: Plan): Promise<void> {
	expectOk(await stack.zones.save(makeZone({ projectId: plan.projectId, planId: plan.id, name: 'Living room', geometry: { points: ROOM } }), 'absent'));
	const walls = ROOM.map((start, index) => ({ id: `wall-harness-item-${index + 1}`, start, end: ROOM[(index + 1) % ROOM.length], thickness: 150, height: 2600 }));
	const elements = [
		{ id: CABINET_ID, kind: 'object' as const, points: [{ x: 1000, y: 1000 }, { x: 3000, y: 1000 }, { x: 3000, y: 2000 }, { x: 1000, y: 2000 }] },
		{ id: VAULT_ITEM_ID, kind: 'object' as const, points: VAULT_ITEM },
	];
	const baseline = expectOk(await geometry.read(plan.id));
	expectOk(await geometry.write(plan.id, { ...baseline.document, structure: { walls, openings: [], boundaries: [], elements } }, baseline.version));
	const loaded = expectDefined(expectOk(await stack.plans.getById(plan.id)), 'harness item plan');
	expectOk(await stack.plans.save(expectOk(withPlanSpatialElements(loaded.entity, [{ id: CABINET_ID, name: 'Cabinet' }, { id: VAULT_ITEM_ID, name: 'Garden shed' }])), loaded.version));
}

/** `?item=` as a gesture, or `undefined` when absent; an unknown value is refused on the console, as `parseRoomKnob` refuses its own. */
export function parseItemKnob(raw: string | null): ItemGesture | undefined {
	if (raw === null) return undefined;
	const gesture = GESTURES.find((candidate) => candidate === raw);
	if (gesture === undefined) console.error(`the ?item knob wants one of ${GESTURES.join(', ')}; got "${raw}"`);
	return gesture;
}

async function press(root: HTMLElement, selector: string, waitingFor: string): Promise<void> {
	await settleUntil(() => root.querySelector(selector) !== null, `the ?item knob's ${waitingFor}`);
	root.querySelector<HTMLElement>(selector)?.click();
}

function pointer(canvas: HTMLElement, type: string, x: number, y: number): void {
	const box = canvas.getBoundingClientRect();
	canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: box.left + box.width * x, clientY: box.top + box.height * y }));
}

/** Add → Item, the drawer the entry opens at a sidebar's width closed again, then a press and a move — and a release unless `held`. */
async function drawRectangle(root: HTMLElement, held: boolean): Promise<void> {
	await press(root, 'button[data-rp-action="add"]', 'Add button');
	await press(root, '.rp-add-menu [data-rp-entry="item"]', 'Item entry');
	// The shape switch unlocks once the element baseline has loaded; a press before that is refused by the tool.
	await settleUntil(() => root.querySelector('.rp-task-banner [data-rp-object-shape="free"][aria-disabled="false"]') !== null, "the ?item knob's item baseline");
	root.querySelector<HTMLElement>('.rp-editor-shell[data-layout="constrained"] .rp-inspector-drawer__close')?.click();
	const canvas = root.querySelector<HTMLElement>('.rp-plan-canvas') as HTMLElement;
	// The canvas's upper right: clear of the seeded room and items at both widths, and of the task bar docked at the foot.
	pointer(canvas, 'pointerdown', 0.6, 0.12);
	pointer(canvas, 'pointermove', 0.88, 0.35);
	if (!held) pointer(canvas, 'pointerup', 0.88, 0.35);
}

/** Selects an item through its Layers row, then opens the canvas menu from the keyboard and presses Add to asset library. */
async function openNewAsset(root: HTMLElement, id: string): Promise<void> {
	const row = `.rp-structure-list__row[data-rp-id="${id}"]`, rail = '[data-rp-rail="layers"]';
	// The row, and the layout decided: a full shell, or the constrained one whose rail holds the Layers panel.
	await settleUntil(() => root.querySelector(row) !== null && root.querySelector(`.rp-editor-shell[data-layout="full"], ${rail}`) !== null, `the ?item knob's Layers row for ${id}`);
	const constrained = root.querySelector(rail) !== null;
	root.querySelector<HTMLElement>(rail)?.click();
	const section = root.querySelector<HTMLDetailsElement>('details[data-rp-section="elements"]');
	if (section?.open === false) section.querySelector<HTMLElement>('summary')?.click();
	root.querySelector<HTMLElement>(row)?.click();
	// The overlay's close button renders only once the rail's press has flushed, so it is waited for, not assumed.
	if (constrained) await press(root, '.rp-overlay-panel__close', 'Layers overlay close');
	await settleUntil(() => root.querySelector(`${row}[aria-pressed="true"]`) !== null, `the ?item knob's selection of ${id}`);
	const canvas = root.querySelector<HTMLElement>('.rp-plan-canvas') as HTMLElement;
	canvas.focus();
	canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true }));
	await press(root, '[data-rp-context-action="add-to-library"]', 'Add to asset library entry');
	await settleUntil(() => root.querySelector('.rp-new-asset__outline') !== null, "the ?item knob's New asset dialog");
}

function fill(root: HTMLElement, field: string, value: string): void {
	const input = root.querySelector<HTMLInputElement | HTMLSelectElement>(`.rp-dialog-form [data-field="${field}"]`) as HTMLInputElement;
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	input.dispatchEvent(new Event('change', { bubbles: true }));
}

export async function driveItemKnob(root: HTMLElement, gesture: ItemGesture): Promise<void> {
	if (gesture === 'rectangle' || gesture === 'drag') return drawRectangle(root, gesture === 'drag');
	if (gesture === 'promote') return openNewAsset(root, CABINET_ID);
	await openNewAsset(root, VAULT_ITEM_ID);
	fill(root, 'category', 'building-element');
	fill(root, 'unitCostAmount', '1');
	root.querySelector<HTMLFormElement>('.rp-dialog-form')?.requestSubmit();
}
