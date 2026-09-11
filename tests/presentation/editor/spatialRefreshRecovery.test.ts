// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { defer, settle } from '../../helpers/async';
import { mountPlanEditor, runtimeOf } from '../../helpers/editor';
import { referenceWorkspace } from '../../harness/referenceWorkspace';
import { HARNESS_PLAN, harnessDeps } from '../../harness/planEditor';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { err } from '../../../src/core/result/Result';
import * as notices from '../../../src/presentation/notices/notify';

const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); vi.restoreAllMocks(); });
async function setup() {
	const rig = await renovationEditor(true); cleanups.push(() => rig.unmount());
	await rig.runtime.refreshProjection(); return rig;
}

describe('integrated spatial refresh recovery', () => {
	it('does not invalidate or query a retired leaf when a late caller requests refresh', async () => {
		const rig = await setup(), read = vi.spyOn(rig.deps.queries, 'getPlan');
		rig.unmount(); await rig.runtime.refreshProjection();
		expect(read).not.toHaveBeenCalled(); expect(rig.project.refreshing).toBe(false);
	});
	it('keeps the last valid scene and stale flag until the latest queued spatial read finishes', async () => {
		const rig = await setup(), queries = rig.deps.queries;
		vi.spyOn(queries, 'getPlan').mockResolvedValueOnce(err(injectedPersistenceError()));
		await rig.runtime.refreshProjection(); expect(rig.project.stale).toBe(true);
		const previous = rig.project.zones, geometry = expectOk(await rig.geometry.read(rig.plan.id));
		const moved = (distance: number) => ({ ...geometry.document, objects: geometry.document.objects.map(item => ({ ...item, points: item.points.map(point => ({ x: point.x + distance, y: point.y })) })) });
		const peer = expectOk(await rig.geometry.write(rig.plan.id, moved(100), geometry.version));
		const oldSnapshot = await queries.findZonesByPlan(rig.plan.id), old = defer<typeof oldSnapshot>(), latest = defer<typeof oldSnapshot>();
		const read = vi.spyOn(queries, 'findZonesByPlan').mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
		const inspector = vi.spyOn(rig.deps.commands.zoneInspector, 'execute');
		const first = rig.runtime.refreshProjection(); await settle(); expect(read).toHaveBeenCalledOnce();
		expectOk(await rig.geometry.write(rig.plan.id, moved(200), peer));
		const second = rig.runtime.refreshProjection(); old.resolve(oldSnapshot); await settle();
		expect(read).toHaveBeenCalledTimes(2); expect(rig.project.zones).toBe(previous);
		expect(rig.project.stale).toBe(true); expect(rig.project.refreshing).toBe(true); expect(inspector).not.toHaveBeenCalled();
		read.mockRestore(); latest.resolve(await queries.findZonesByPlan(rig.plan.id)); await Promise.all([first, second]);
		expect(rig.project.zones.get(rig.room.id)?.points[0].x).toBe(geometry.document.objects[0].points[0].x + 200);
		expect(rig.project.stale).toBe(false); expect(rig.project.refreshing).toBe(false); expect(inspector).toHaveBeenCalledOnce();
	});
	it.each(['resolve', 'reject'] as const)('ignores an obsolete Inspector %s and completes the queued latest refresh', async outcome => {
		const rig = await setup(), query = rig.deps.commands.zoneInspector, previous = rig.runtime.inspectorDto.value;
		const room = expectDefined(expectOk(await rig.stack.zones.getById(rig.room.id)), 'room');
		const peer = expectOk(await rig.stack.zones.save(expectOk(room.entity.withName('Intermediate name')), room.version));
		const oldSnapshot = await query.execute({ zoneId: rig.room.id }), old = defer<void>(), latest = defer<typeof oldSnapshot>();
		const read = vi.spyOn(query, 'execute').mockReturnValueOnce(old.promise.then(() => { if (outcome === 'reject') throw new Error('obsolete inspector'); return oldSnapshot; })).mockReturnValueOnce(latest.promise);
		const first = rig.runtime.refreshProjection(); await settle(); expect(read).toHaveBeenCalledOnce();
		expectOk(await rig.stack.zones.save(expectOk(peer.entity.withName('Latest name')), peer.version));
		const second = rig.runtime.refreshProjection(); old.resolve(undefined); await settle();
		expect(read).toHaveBeenCalledTimes(2); expect(rig.runtime.inspectorDto.value).toBe(previous);
		read.mockRestore(); latest.resolve(await query.execute({ zoneId: rig.room.id })); await Promise.all([first, second]);
		expect(rig.runtime.inspectorDto.value).toMatchObject({ name: 'Latest name' });
	});
	it('offers only Close for a missing plan even when the planning reader reports its absence as a failure', async () => {
		const workspace = referenceWorkspace(harnessDeps(), HARNESS_PLAN, true); await workspace.ready;
		const plan = expectDefined(expectOk(await workspace.stack.plans.getById(workspace.plan.id)), 'plan');
		expectOk(await workspace.stack.plans.delete(workspace.plan.id, plan.version));
		const rig = await mountPlanEditor({ plan: HARNESS_PLAN, queries: workspace.deps.queries, commands: workspace.deps.commands, vault: workspace.deps.vault }); cleanups.push(() => rig.unmount());
		await settle(); expect(useProjectStore(rig.pinia).status).toBe('missing'); expect(runtimeOf(rig).planning.failed.value).toBe(true);
		expect(rig.wrapper.find('[data-rp-warning="stale"]').exists()).toBe(false);
		await rig.wrapper.get('.rp-view-failure__action').trigger('click'); expect(rig.closedLeaf()).toBe(1);
	});
	it.each(['inspector', 'requirements'] as const)('reports a rejected %s refresh at the detached plan-change boundary', async source => {
		const rig = await setup(), previous = rig.runtime.inspectorDto.value, fault = new Error('read fault');
		const report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
		if (source === 'inspector') vi.spyOn(rig.deps.commands.zoneInspector, 'execute').mockRejectedValueOnce(fault);
		else vi.spyOn(rig.deps.queries, 'getRequirementsForZone').mockRejectedValueOnce(fault);
		rig.changePlan(); await settle();
		expect(report).toHaveBeenCalledExactlyOnceWith(fault, rig.deps.commands.logger, 'editor.refresh.failed');
		expect(rig.runtime.inspectorDto.value).toBe(previous); expect(rig.project.status).toBe('ready');
		rig.changePlan(); await settle(); expect(report).toHaveBeenCalledOnce(); expect(rig.project.refreshing).toBe(false);
	});
	/**
	 * `PlanEditorRoot.vue`'s own `hydrate()` — `void runtime.refreshProjection().catch(cause =>
	 * { if (root.value) notifyFault(...); })` — reads its OWN component's root ref rather than
	 * `error`/`status`, because a rejection can still arrive after this leaf has already
	 * unmounted (the plan changed again, or the leaf closed) while an earlier `refreshProjection`
	 * was still in flight: `onBeforeUnmount` only flips `active` for a NEW call, not one already
	 * awaiting. `runtime.refreshProjection` is stubbed directly, rather than one of the queries it
	 * reads, so this drives exactly that guard and nothing the query's own internal "latest wins"
	 * coalescing (`createLatestRead`) might otherwise do with a promise still pending at dispose.
	 */
	it('drops a refresh rejection that lands after the leaf that started it has already unmounted', async () => {
		const rig = await setup(), report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined), fault = new Error('read fault');
		let rejectRead!: (cause: unknown) => void;
		vi.spyOn(rig.runtime, 'refreshProjection').mockReturnValueOnce(new Promise((_resolve, reject) => { rejectRead = reject; }));
		rig.changePlan();
		rig.unmount();
		rejectRead(fault);
		await settle();
		expect(report).not.toHaveBeenCalled();
	});
});
