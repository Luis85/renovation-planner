// @vitest-environment jsdom
/**
 * AD18 Task 8, take.md step 14's D clause: "clicking the plan places an `Oven`, not whatever the
 * Add menu last used" — the hand-off must OVERRIDE an asset the Add menu's picker had already
 * armed, and nothing drives that contrast today. `editorArrivalAssetHandoff.test.ts` (owned by
 * a different task this round) only ever calls `navigate` against a fresh draft; it never arms
 * the Add menu FIRST. Driven through the same real doors that file uses —
 * `assetPlacementTask.choose` for the Add menu's own picker, and `useEditorArrival`'s
 * `navigateToRecord` for the hand-off — over the real `assetPlacementTask` and the real
 * asset-shape query, so what is asserted is the same `arm`/`startDraft` path production takes
 * (`assetPlacementTask.ts`'s `startDraft` `Object.assign`s the whole draft, which is the
 * mechanism this test pins rather than assumes).
 */
import { afterEach, expect, it } from 'vitest';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { settle } from '../../helpers/editor';
import type { ProjectOrigin } from '../../../src/application/navigation/ProjectDestination';

type Rig = Awaited<ReturnType<typeof assetPlacementRig>>;
const mounted: Rig[] = [];
afterEach(() => {
	for (const rig of mounted.splice(0)) rig.unmount();
});

async function setup() {
	const rig = await assetPlacementRig();
	mounted.push(rig);
	const navigate = (rig.wrapper.vm as unknown as { navigateToRecord(origin: ProjectOrigin): Promise<boolean> })
		.navigateToRecord;
	return { ...rig, navigate };
}

/** The Add menu's own picker, exactly as `assetPlacement.e2e.test.ts`'s `choose` helper drives it. */
async function chooseFromAddMenu(rig: Awaited<ReturnType<typeof setup>>, id: string, name: string): Promise<void> {
	const choosing = rig.runtime.elementTask.assets.choose([{ id, name }]);
	await settle();
	rig.dialogs.resolve({ id });
	await choosing;
	await settle();
}

it('replaces an asset the Add menu already armed with the one the hand-off names', async () => {
	const rig = await setup();
	const radiator = await rig.saveAsset('Radiator');
	const sofa = await rig.saveAsset('Sofa');

	await chooseFromAddMenu(rig, radiator.id, radiator.name);
	expect(rig.runtime.activeToolId.value).toBe('place-asset');
	expect(rig.runtime.elementTask.assets.draft.assetId).toBe(radiator.id);

	expect(await rig.navigate({ planId: rig.plan.id, assetId: sofa.id })).toBe(true);
	await settle();

	expect(rig.runtime.activeToolId.value).toBe('place-asset');
	expect(rig.runtime.elementTask.assets.draft).toMatchObject({ assetId: sofa.id, name: 'Sofa' });
});
