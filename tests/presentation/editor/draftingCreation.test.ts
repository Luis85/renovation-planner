// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { pointerAt } from '../../helpers/tool-context';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import type { ElementToolId } from '../../../src/presentation/editor/elements/elementDraft';
import type { Point } from '../../../src/core/geometry/Point';

type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const mounted: Rig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

async function mount(): Promise<Rig> { const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle(); return rig; }
async function use(rig: Rig, tool: ElementToolId): Promise<void> {
	rig.runtime.setTool(tool);
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, `${tool} baseline`);
}
const saved = (rig: Rig, count: number) => settleUntil(() => (rig.project.structure.elements?.length ?? 0) === count, `${count} saved`);
const nameOf = (rig: Rig, id: string) => rig.project.plan?.spatialElements?.find(item => item.id === id)?.name;
function add(rig: Rig, ...points: Point[]): void { for (const point of points) rig.runtime.elementTask.addPoint(point); }
const stored = (rig: Rig) => ({ elements: rig.project.structure.elements ?? [], metadata: rig.project.plan?.spatialElements ?? [] });
/** Creation is one history step: `runtime.undo()` leaves exactly what was stored before it, `runtime.redo()` exactly what it saved. */
async function undoRedo(rig: Rig, before: ReturnType<typeof stored>): Promise<void> {
	const created = stored(rig);
	await rig.runtime.undo(); await settle();
	expect(stored(rig)).toEqual(before);
	await rig.runtime.redo(); await settle();
	expect(stored(rig)).toEqual(created);
}

it('saves a stepped section line of every clicked point on Finish as S-01 looking the default way, as schema 12, and names the next one S-02', async () => {
	const rig = await mount(); await use(rig, 'draw-section');
	expect(rig.runtime.elementTask.draft.name).toBe('S-01');
	const points = [{ x: 0, y: 2000 }, { x: 5000, y: 2000 }, { x: 5000, y: 6000 }, { x: 9000, y: 6000 }];
	add(rig, ...points);
	await settle();
	expect(rig.project.structure.elements ?? []).toHaveLength(0);
	await rig.runtime.elementTask.finish(); await saved(rig, 1);
	const section = expectDefined(rig.project.structure.elements?.[0], 'section');
	expect(section).toMatchObject({ kind: 'section', flipped: false, points });
	expect(nameOf(rig, section.id)).toBe('S-01');
	expect(rig.runtime.activeToolId.value).toBe('select');
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBe(12);
	await use(rig, 'draw-section');
	expect(rig.runtime.elementTask.draft.name).toBe('S-02');
});

it('saves a view marker on its second point as A-01', async () => {
	const rig = await mount(); await use(rig, 'place-view');
	const before = stored(rig);
	add(rig, { x: -1500, y: 1000 }, { x: -800, y: 1000 });
	await saved(rig, 1);
	const view = expectDefined(rig.project.structure.elements?.[0], 'view');
	expect(view).toMatchObject({ kind: 'view', points: [{ x: -1500, y: 1000 }, { x: -800, y: 1000 }] });
	expect(nameOf(rig, view.id)).toBe('A-01');
	await undoRedo(rig, before);
});

it('saves a grid point at once, stays on, and names each next one', async () => {
	const rig = await mount(); await use(rig, 'place-grid');
	add(rig, { x: 6000, y: 0 }); await saved(rig, 1);
	expect(rig.runtime.activeToolId.value).toBe('place-grid');
	await settleUntil(() => !rig.runtime.elementTask.draft.loading && rig.runtime.elementTask.draft.name === '2', 'next grid point');
	add(rig, { x: 6000, y: 4000 }); await saved(rig, 2);
	expect(rig.project.structure.elements?.map(item => nameOf(rig, item.id))).toEqual(['1', '2']);
	expect(rig.project.structure.elements?.[1].points).toEqual([{ x: 6000, y: 4000 }]);
});

it('places a text point without saving, moves it on a further point, and saves it once it has words', async () => {
	const rig = await mount(); await use(rig, 'place-text');
	const task = rig.runtime.elementTask;
	expect(task.draft.name).toBe('');
	add(rig, { x: 1000, y: 1000 }, { x: 1500, y: 1200 });
	expect(task.draft.points).toEqual([{ x: 1500, y: 1200 }]);
	expect(task.canFinish.value).toBe(false);
	await task.finish(); await settle();
	expect(rig.project.structure.elements ?? []).toHaveLength(0);
	const before = stored(rig);
	task.draft.name = 'Wintergarten';
	await task.finish(); await saved(rig, 1);
	expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'text', points: [{ x: 1500, y: 1200 }] });
	await undoRedo(rig, before);
});

it('ends a dimension chain\'s points on Finish, steps back on Undo point, and saves it where its line is clicked', async () => {
	const rig = await mount(); await use(rig, 'draw-dimension');
	const task = rig.runtime.elementTask;
	expect(task.draft.name).toBe('Dimension chain');
	add(rig, { x: 0, y: 0 }, { x: 1190, y: 0 }, { x: 4560, y: 0 });
	await task.finish(); await settle();
	expect(task.draft.dimensionPhase).toBe('offset');
	expect(rig.project.structure.elements ?? []).toHaveLength(0);
	task.undoPoint();
	expect(task.draft.dimensionPhase).toBe('points');
	expect(task.draft.points).toHaveLength(3);
	await task.finish(); await settle();
	add(rig, { x: 2000, y: -499.6 });
	await saved(rig, 1);
	expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'dimension', offset: -500, points: [{ x: 0, y: 0 }, { x: 1190, y: 0 }, { x: 4560, y: 0 }] });
});

it('saves a dimension chain at the offset its preview draws when Finish is pressed with the pointer over the canvas', async () => {
	const rig = await mount(); await use(rig, 'draw-dimension');
	const task = rig.runtime.elementTask;
	add(rig, { x: 0, y: 0 }, { x: 4000, y: 0 });
	await task.finish(); await settle();
	task.draft.cursor = { x: 2000, y: -700.4 };
	await task.finish(); await saved(rig, 1);
	expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'dimension', offset: -700 });
});

it('saves a hatched area and a boundary line on Finish, and refuses a hatch outline that crosses itself', async () => {
	const rig = await mount(); await use(rig, 'draw-hatch');
	const task = rig.runtime.elementTask;
	add(rig, { x: 0, y: 5000 }, { x: 3000, y: 7000 }, { x: 3000, y: 5000 }, { x: 0, y: 7000 });
	await task.finish(); await settle();
	expect(rig.project.structure.elements ?? []).toHaveLength(0);
	const empty = stored(rig);
	task.setPoints([{ x: 0, y: 5000 }, { x: 3000, y: 5000 }, { x: 3000, y: 7000 }, { x: 0, y: 7000 }]);
	await task.finish(); await saved(rig, 1);
	expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'hatch' });
	await undoRedo(rig, empty);
	await use(rig, 'draw-boundary');
	const hatched = stored(rig);
	add(rig, { x: -2000, y: -1000 }, { x: 2000, y: -1200 }, { x: 6000, y: -1500 });
	await task.finish(); await saved(rig, 2);
	expect(rig.project.structure.elements?.[1]).toMatchObject({ kind: 'boundary', points: [{ x: -2000, y: -1000 }, { x: 2000, y: -1200 }, { x: 6000, y: -1500 }] });
	await undoRedo(rig, hatched);
});

function click(rig: Rig, x: number, y: number): void { rig.runtime.toolManager.pointerDown(pointerAt(x, y)); rig.runtime.toolManager.pointerUp(pointerAt(x, y)); }
const type = (rig: Rig, field: string, value: string) => rig.wrapper.get(`.rp-element-task input[name="${field}"]`).setValue(value);
/** The most each kind drafts without saving: a view's second point and a grid point typed but not added, a text's words before Finish, a hatch's dragged rectangle and a boundary's two points before Finish. */
const DRAFTS: [string, ElementToolId, (rig: Rig) => void | Promise<void>][] = [
	['view', 'place-view', async rig => { click(rig, -1500, 1000); await type(rig, 'element-x', '-0,8'); await type(rig, 'element-y', '1'); }],
	['hatch', 'draw-hatch', rig => { const tools = rig.runtime.toolManager; tools.pointerDown(pointerAt(500, 5000)); tools.pointerMove(pointerAt(3000, 7000)); tools.pointerUp(pointerAt(3000, 7000)); }],
	['text', 'place-text', async rig => { click(rig, 1500, 1200); await settle(); await type(rig, 'element-name', 'Wintergarten'); }],
	['boundary', 'draw-boundary', rig => { click(rig, -2000, -1000); click(rig, 2000, -1200); }],
	['grid', 'place-grid', async rig => { await type(rig, 'element-x', '6'); await type(rig, 'element-y', '0'); }],
];

// One param per kind, so a Hatch failure cannot hide a Boundary one. Door: the task bar's Cancel, which leaves the task in one gesture (`createCancelActiveTask`).
it.each(DRAFTS)('cancels a drafted %s from the task bar without writing, and returns to Select with nothing drafted', async (_kind, tool, draft) => {
	const rig = await mount(), task = rig.runtime.elementTask;
	const vault = [...rig.stack.vault.entries], before = stored(rig);
	await use(rig, tool); await draft(rig); await settle();
	expect(rig.runtime.toolManager.activeToolHasDraft()).toBe(true);
	await rig.wrapper.get('.rp-task-banner__cancel').trigger('click');
	await settleUntil(() => useSaveStateStore(rig.pinia).state !== 'saving', `${tool} cancelled`); await settle();
	expect([...rig.stack.vault.entries]).toEqual(vault);
	expect(stored(rig)).toEqual(before);
	expect(rig.runtime.activeToolId.value).toBe('select');
	expect({ points: task.draft.points, text: task.draft.text, name: task.draft.name }).toEqual({ points: [], text: { x: '', y: '' }, name: '' });
});

it('starts a tool at a point from outside its pointer, and not when another tool took over meanwhile', async () => {
	const rig = await mount();
	await rig.runtime.elementTask.startAt('place-grid', { x: 250, y: 750 });
	await saved(rig, 1);
	expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'grid', points: [{ x: 250, y: 750 }] });
	const starting = rig.runtime.elementTask.startAt('draw-section', { x: 0, y: 0 });
	rig.runtime.setTool('select');
	await starting; await settle();
	expect(rig.runtime.elementTask.draft.points).toEqual([]);
});

it('starts every tool at a point from outside its pointer', async () => {
	const rig = await mount();
	const tools: ElementToolId[] = ['draw-dimension', 'draw-section', 'place-view', 'draw-hatch', 'place-text', 'draw-boundary'];
	for (const tool of tools) {
		const point = { x: 3000, y: 3000 };
		await rig.runtime.elementTask.startAt(tool, point);
		await settle();
		expect(rig.runtime.elementTask.draft.points).toEqual([point]);
		expect(rig.project.structure.elements ?? []).toHaveLength(0);
		rig.runtime.setTool('select');
	}
});
