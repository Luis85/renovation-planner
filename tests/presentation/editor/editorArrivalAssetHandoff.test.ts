// @vitest-environment jsdom
/**
 * AD13's hand-off, received: an arrival whose `ProjectOrigin` carries an `assetId` arms the Plan
 * Editor's placement tool with that asset instead of selecting a return record.
 *
 * Driven through the real `navigateToRecord` the host view calls — `useEditorArrival`'s own door,
 * exposed by `PlanEditorRoot` — against the real `assetPlacementTask` and the real asset-shape
 * query, so what is asserted is the same path `PlanEditorView.setState` takes. `editorArrival.ts`
 * is the file under test; `editorArrival.test.ts` beside this one owns the record arms it must not
 * disturb.
 */
import { afterEach, expect, it, vi } from 'vitest';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { settle } from '../../helpers/editor';
import type { ProjectOrigin } from '../../../src/application/navigation/ProjectDestination';
import { t } from '../../../src/presentation/i18n/strings';
import * as notices from '../../../src/presentation/notices/notify';

type Rig = Awaited<ReturnType<typeof assetPlacementRig>>;
const mounted: Rig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });

async function setup() {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const navigate = (rig.wrapper.vm as unknown as { navigateToRecord(origin: ProjectOrigin): Promise<boolean> }).navigateToRecord;
	return { ...rig, navigate };
}

it('arms the placement tool with the asset the origin names, and warns about no return record', async () => {
	const rig = await setup();
	const radiator = await rig.saveAsset('Radiator');
	const warn = vi.spyOn(notices, 'notifyWarning').mockImplementation(() => undefined);

	expect(await rig.navigate({ planId: rig.plan.id, assetId: radiator.id })).toBe(true); await settle();

	expect(rig.runtime.activeToolId.value).toBe('place-asset');
	expect(rig.runtime.elementTask.assets.draft).toMatchObject({ assetId: radiator.id, name: 'Radiator', error: null, conflict: false });
	expect(rig.runtime.elementTask.assets.draft.shape).not.toBeNull();
	expect(warn).not.toHaveBeenCalled();
});

/**
 * The claim `reveal`'s own docblock makes about ORDER, asked of the one origin that can tell the
 * two arms apart. A record id beside the asset id must not select the record: the asset arm runs
 * first and returns, so nothing below it executes.
 */
it('prefers the asset over a record id in the same origin, selecting nothing', async () => {
	const rig = await setup();
	const radiator = await rig.saveAsset('Radiator');
	rig.selection.clear(); await settle();

	expect(await rig.navigate({ planId: rig.plan.id, assetId: radiator.id, roomId: rig.room.id })).toBe(true); await settle();

	expect(rig.runtime.activeToolId.value).toBe('place-asset');
	expect(rig.selection.selectedIds).toEqual([]);
});

/**
 * The refusals are `assetPlacementTask`'s own `REFUSALS` map, reached through the same
 * `resolvePlaceable` the Add menu's picker reaches it through — so an asset that went undesignable
 * between the designer's predicate and this arrival is refused here in the placement flow's words,
 * not in `schedule.return-missing`'s.
 */
it.each([
	['an asset with no shape saved', async (rig: Awaited<ReturnType<typeof setup>>) => (await rig.saveAsset('Bare', false)).id, 'editor.asset.no-shape'],
	['an asset id no catalogue answers for', () => Promise.resolve('asset-01NOTHERE'), 'editor.asset.unreadable'],
] as const)('refuses %s in the placement flow\'s own words and arms nothing', async (_name, assetIdOf, key) => {
	const rig = await setup();
	const assetId = await assetIdOf(rig);
	const warn = vi.spyOn(notices, 'notifyWarning').mockImplementation(() => undefined);

	expect(await rig.navigate({ planId: rig.plan.id, assetId })).toBe(false); await settle();

	expect(warn).toHaveBeenCalledExactlyOnceWith(t('en', key));
	expect(rig.runtime.activeToolId.value).not.toBe('place-asset');
	expect(rig.runtime.elementTask.assets.draft.assetId).toBe('');
});

/**
 * `resolvePlaceable`'s unbound-query arm, and `arm` is the only way into it: `pickPlaceable`
 * refuses on the same condition BEFORE it calls `resolvePlaceable`, so the Add menu's picker can
 * never reach it. What it models is the unrecovered-settings session — `planEditorDeps` hands
 * that leaf `unavailablePlanEditorQueries()`, which declares no `assetShapes` at all — and the
 * observable is SILENCE: no notice, because there is no answer to name a reason from.
 *
 * Removed from the LIVE queries object rather than composed absent, and that is a fact about the
 * rig rather than a trick: `mountPlanEditor` assigns `options.queries` into the context by
 * reference, and `resolvePlaceable` reads `context.queries.assetShapes` per call. The object is a
 * fresh literal per `referenceWorkspace()`, so nothing here outlives this case.
 */
it('refuses silently when the leaf has no asset-shape query at all', async () => {
	const rig = await setup();
	const radiator = await rig.saveAsset('Radiator');
	const warn = vi.spyOn(notices, 'notifyWarning').mockImplementation(() => undefined);
	delete (rig.deps.queries as { assetShapes?: unknown }).assetShapes;

	expect(await rig.navigate({ planId: rig.plan.id, assetId: radiator.id })).toBe(false); await settle();

	expect(warn).not.toHaveBeenCalled();
	expect(rig.runtime.activeToolId.value).not.toBe('place-asset');
	expect(rig.runtime.elementTask.assets.draft.assetId).toBe('');
});
