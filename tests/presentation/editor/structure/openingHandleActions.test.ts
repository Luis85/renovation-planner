import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
import { createOpeningHandleActions } from '../../../../src/presentation/editor/structure/openingHandleActions';
import { staleWriteRefusal } from '../../../../src/presentation/editor/tools/with-stale-gate';
import * as notify from '../../../../src/presentation/notices/notify';
import type { Opening, Structure, Wall } from '../../../../src/domain/spatial/Structure';
import type * as VueModule from 'vue';

// Vue's real `onBeforeUnmount` is a no-op outside a component instance (a warning, nothing
// registered), so a bare-composable test has no door to reach the `alive === false` arms
// through. Capturing the disposer here — the only override, everything else is the real module
// — is what lets those arms be driven at all, rather than left permanently at zero.
const { unmountCallbacks } = vi.hoisted(() => ({ unmountCallbacks: [] as (() => void)[] }));
vi.mock('vue', async importOriginal => ({
	...(await importOriginal<typeof VueModule>()),
	onBeforeUnmount: (fn: () => void) => { unmountCallbacks.push(fn); },
}));

const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 200 };
const door: Opening = { id: 'opening-a', kind: 'door', hostId: wall.id, offset: 800, width: 900, height: 2100, sill: 0 };
// A second, non-overlapping opening on the same host: the only way the write's own
// `openings.map(item => item.id === id ? next : item)` ever takes its OTHER branch.
const skylight: Opening = { id: 'opening-b', kind: 'window', hostId: wall.id, offset: 2500, width: 600, height: 1200, sill: 900 };
const structure: Structure = { walls: [wall], openings: [door, skylight], boundaries: [] };
const snapshot = { document: { objects: [], structure, calibration: null } } as never;

beforeEach(() => {
	setActivePinia(createPinia());
	// `previewOpening` builds its ghost from the STORE's structure, so the store has to hold one.
	useProjectStore().structure = structure;
});

function harness(overrides: Partial<Parameters<typeof createOpeningHandleActions>[1]> = {},
	read = vi.fn<() => Promise<unknown>>().mockResolvedValue({ ok: true, value: snapshot })) {
	const dispatch = vi.fn<(next: Structure) => Promise<unknown>>().mockResolvedValue({ ok: true, value: undefined });
	const preview = { value: null as Structure | null }, active = { value: false };
	const context = { planId: 'plan-a', commands: { structure: { read, command: vi.fn<() => void>() }, logger: { error: vi.fn<() => void>() } } } as never;
	const actions = createOpeningHandleActions(context, {
		active, preview,
		unavailable: () => false,
		prepareBaseline: () => ({ snapshot, recovery: null }),
		reviewedWrite: () => ({ preview: (value: Structure | null) => { preview.value = value; }, dispatch }),
		...overrides,
	} as never);
	return { actions, dispatch, preview, active, read };
}

it('reads a baseline, transforms the opening it finds there, and dispatches the result', async () => {
	const { actions, dispatch, active } = harness();
	await actions.applyOpening('opening-a', opening => ({ ...opening, offset: 1200 }));
	expect(dispatch).toHaveBeenCalledTimes(1);
	expect(dispatch.mock.calls[0][0].openings[0].offset).toBe(1200);
	expect(active.value).toBe(false);
});

it('transforms the BASELINE opening, never the one the store is showing', async () => {
	const { actions } = harness();
	const seen: Opening[] = [];
	await actions.applyOpening('opening-a', opening => { seen.push(opening); return { ...opening, offset: 0 }; });
	expect(seen[0]).toEqual(door);
});

it('dispatches nothing when the transform refuses, when the opening is gone, or when its host is', async () => {
	const refused = harness();
	await refused.actions.applyOpening('opening-a', () => null);
	expect(refused.dispatch).not.toHaveBeenCalled();
	const missing = harness();
	await missing.actions.applyOpening('opening-elsewhere', opening => opening);
	expect(missing.dispatch).not.toHaveBeenCalled();
});

it('dispatches nothing when the proposal fails opening validation', async () => {
	const { actions, dispatch } = harness();
	// Wider than its host: `openingValidationError` refuses it.
	await actions.applyOpening('opening-a', opening => ({ ...opening, width: 9000 }));
	expect(dispatch).not.toHaveBeenCalled();
});

it('dispatches nothing and clears the preview when the edit is unavailable', async () => {
	const { actions, dispatch, preview } = harness({ unavailable: () => true });
	preview.value = structure;
	await actions.applyOpening('opening-a', opening => ({ ...opening, offset: 0 }));
	expect(dispatch).not.toHaveBeenCalled();
	expect(preview.value).toBeNull();
});

it('awaits the recovery a stale baseline hands back and writes nothing', async () => {
	const recovery = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
	const { actions, dispatch } = harness({ prepareBaseline: () => ({ snapshot: null, recovery: recovery() }) });
	await actions.applyOpening('opening-a', opening => opening);
	expect(dispatch).not.toHaveBeenCalled();
	expect(recovery).toHaveBeenCalled();
});

it('releases the in-flight flag after the transform throws', async () => {
	const { actions, active } = harness();
	await expect(actions.applyOpening('opening-a', () => { throw new Error('boom'); })).resolves.toBeUndefined();
	expect(active.value).toBe(false);
});

it('reports the failure when the reviewed write itself refuses', async () => {
	const spy = vi.spyOn(notify, 'notifyOperationFailure').mockImplementation(() => {});
	const error = staleWriteRefusal();
	const dispatch = vi.fn<(next: Structure) => Promise<unknown>>().mockResolvedValue({ ok: false, error });
	const { actions } = harness({ reviewedWrite: (() => ({ preview: () => {}, dispatch })) as never });
	await actions.applyOpening('opening-a', opening => ({ ...opening, offset: 1200 }));
	expect(spy).toHaveBeenCalledWith(error);
	spy.mockRestore();
});

it('drops a read that resolves after the component unmounted', async () => {
	let resolveRead!: (value: unknown) => void;
	const read = vi.fn<() => Promise<unknown>>(() => new Promise(resolve => { resolveRead = resolve; }));
	const { actions, dispatch } = harness({}, read);
	const unmount = unmountCallbacks.at(-1) as () => void;
	const pending = actions.applyOpening('opening-a', opening => opening);
	unmount();
	resolveRead({ ok: true, value: snapshot });
	await pending;
	expect(dispatch).not.toHaveBeenCalled();
});

it('leaves state untouched for a fault that arrives after the component unmounted', async () => {
	let rejectRead!: (reason?: unknown) => void;
	const read = vi.fn<() => Promise<unknown>>(() => new Promise((_resolve, reject) => { rejectRead = reject; }));
	const { actions, active } = harness({}, read);
	const unmount = unmountCallbacks.at(-1) as () => void;
	const pending = actions.applyOpening('opening-a', opening => opening);
	unmount();
	rejectRead(new Error('boom'));
	await expect(pending).resolves.toBeUndefined();
	// The `finally` guard skips the reset once unmounted, rather than clearing state that may
	// no longer be this component's to clear.
	expect(active.value).toBe(true);
});

it('previews one changed opening against the store structure, and clears on null', () => {
	const { actions, preview } = harness();
	actions.previewOpening('opening-a', { ...door, offset: 1500 });
	expect(preview.value?.openings[0].offset).toBe(1500);
	expect(preview.value?.openings[1]).toEqual(skylight);
	actions.previewOpening(null);
	expect(preview.value).toBeNull();
});
