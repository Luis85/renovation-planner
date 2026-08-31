// @vitest-environment jsdom
// jsdom: the plugin shell touches the DOM through the module mock, exactly as
// tests/plugin/persistence-wiring.test.ts does.
import { beforeEach, describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
// Mock-only surface, imported BY NAME. `Notice` carries members
// the real `obsidian` module does not declare (`shown`, `constructed`, `opened`, `choose`), so reaching them through the
// `'obsidian'` specifier type-checks against a surface that has no such thing. The
// vitest alias points that specifier at this very file, so this is the SAME class and
// the same statics — proven, not assumed — and the import now says which surface it
// wants. `TFile` stays on the `obsidian` specifier above: it is a REAL member of that
// module, and this file uses it only as the class the rename handler's guard tests
// against, which is exactly the surface `obsidian` declares.
import { Notice } from '../helpers/obsidian-mock';
import { Decimal } from 'decimal.js';
import { loadedPlugin } from '../helpers/plugin';
import { createRepositoryStack } from '../helpers/vault';
import { expectOk } from '../helpers/domain';
import { of as moneyOf } from '../../src/core/money/Money';
import {
	makeAsset,
	makePlan,
	makeProject,
	makeRequirement,
	makeZone,
	squareAt,
} from '../helpers/entities';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { activateNotices } from '../../src/presentation/notices/notify';
import { installObsidianDom } from '../helpers/dom';

// The notice host builds its markup with Obsidian's own `createSpan`/`createEl` globals.
installObsidianDom();

/**
 * The composed slice-10 cascade: the subscriptions `composeSlice10` registers at
 * composition time must reach the composed root's OWN event bus, and their recalculate
 * hand-off must run the real command against the real repositories. A geometry edit and
 * an asset edit published on the bus therefore end with recalculated figures on disk —
 * asserted here through the same vault the plugin reads.
 */

async function seededStack() {
	const stack = createRepositoryStack();
	const project = expectOk(await stack.projects.save(makeProject(), 'absent'));
	const plan = expectOk(await stack.plans.save(makePlan({ projectId: project.entity.id }), 'absent'));
	const zoneGeometry = expectOk(
		makeZone({ projectId: project.entity.id, planId: plan.entity.id }).withGeometry({
			points: squareAt().points,
		}),
	);
	const zone = expectOk(await stack.zones.save(zoneGeometry, 'absent'));
	const asset = expectOk(
		await stack.assets.save(
			makeAsset({
				projectId: project.entity.id,
				wasteFactorDefault: new Decimal('0.10'),
			}),
			'absent',
		),
	);
	// Figures recorded against a DIFFERENT area than the zone's real one, so the final
	// assertion can tell a recalculation from a no-op.
	const requirement = expectOk(
		await stack.requirements.save(
			makeRequirement({
				projectId: project.entity.id,
				assetId: asset.entity.id,
				origin: { kind: 'zone', zoneId: zone.entity.id },
			}),
			'absent',
		),
	);
	stack.metadataCache.catchUp();
	return { stack, project, plan, zone, asset, requirement };
}

/**
 * A notice is INERT until something activates the queue — `onload` is what does that in
 * production, so a suite asserting on `Notice.shown` has to stand where the plugin stands.
 * Per TEST, and for a second reason: the queue DEDUPS, so two cases raising the identical
 * sentence would fold into one `(×2)` and construct no second `Notice` at all.
 */
beforeEach(() => {
	activateNotices();
});

describe('slice-10 cascade wiring', () => {
	it('a ZoneGeometryChanged event cascades to a recalculated requirement', async () => {
		const { stack, project, plan, zone, requirement } = await seededStack();

		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();
		expect(plugin.root.persistence?.index.getPath(requirement.entity.id)).toBeDefined();

		await plugin.root.eventBus.publish({
			type: 'ZoneGeometryChanged',
			payload: {
				zoneId: zone.entity.id,
				planId: plan.entity.id,
				projectId: project.entity.id,
			},
		} as never);

		// The cascade wrote through the PLUGIN's repositories, which hold the plugin's own
		// `EchoWindow`; this stack has a different one, so it can only see the write once
		// Obsidian's parse queue has caught up. That is a fact about two roots over one vault
		// rather than about the cascade — in a session there is one echo — and the assertion
		// below is about what ended up in the vault, which is exactly the settled state.
		stack.metadataCache.catchUp();
		const recalculated = expectOk(await stack.requirements.getById(requirement.entity.id));
		expect(recalculated?.entity.recalculationStatus).toBe('current');
		// squareAt() is 10 mm × 10 mm = 0.0001 m²; × 1.10 waste — not the fixture's 10 m².
		expect(recalculated?.entity.quantity.calculated.value.toFixed(5)).toBe('0.00011');

		await plugin.onunload();
	});

	it('an AssetUpdated event reaches the same cascade through the composed handler', async () => {
		const { stack, project, asset, requirement } = await seededStack();

		// A price edit that has not announced itself yet: after it lands, the link no
		// longer matches what its figures were computed FROM, so the cascade must
		// recalculate for real rather than skip.
		const storedAsset = expectOk(await stack.assets.getById(asset.entity.id));
		const repriced = expectOk(
			storedAsset.entity.withChanges({ unitCost: moneyOf('50.00', 'EUR') }),
		);
		expectOk(await stack.assets.save(repriced, storedAsset.version));
		stack.metadataCache.catchUp();

		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();

		await plugin.root.eventBus.publish({
			type: 'AssetUpdated',
			payload: { assetId: asset.entity.id, projectId: project.entity.id },
		} as never);

		// The cascade wrote through the PLUGIN's repositories, which hold the plugin's own
		// `EchoWindow`; this stack has a different one, so it can only see the write once
		// Obsidian's parse queue has caught up. That is a fact about two roots over one vault
		// rather than about the cascade — in a session there is one echo — and the assertion
		// below is about what ended up in the vault, which is exactly the settled state.
		stack.metadataCache.catchUp();
		const recalculated = expectOk(await stack.requirements.getById(requirement.entity.id));
		expect(recalculated?.entity.recalculationStatus).toBe('current');
		// 0.00011 m2 x 50.00 EUR per m2, rounded to the minor unit.
		expect(recalculated?.entity.estimatedCost.calculated.amount).toBe('0.01');
		void project;

		await plugin.onunload();
	});

	/**
	 * The cascade runs in the background, so a failure inside it reaches nobody unless it is
	 * announced — and the one write whose failure this covers is the durable marker that
	 * would otherwise let a wrong figure be presented as current. `CascadeDeps.notify` is
	 * optional for the suite's benefit, so nothing but this test can tell a composition that
	 * passes it from one that leaves it undefined and logs into the void.
	 */
	it('a failed stale marker inside the cascade reaches the user as a notice', async () => {
		const { stack, project, plan, zone, requirement } = await seededStack();
		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();

		const before = Notice.shown.length;
		// The PLUGIN's own repository, not the fixture's: the two write to one vault through
		// separate instances, and patching the fixture's would leave the cascade's own write
		// working perfectly.
		const composed = plugin.root.persistence?.requirements;
		if (composed === undefined) throw new Error('expected a composed requirement repository');
		composed.markStale = () =>
			Promise.resolve({
				ok: false,
				error: { category: 'Persistence', code: 'test.injected', message: 'no' },
			}) as ReturnType<typeof composed.markStale>;

		await plugin.root.eventBus.publish({
			type: 'ZoneGeometryChanged',
			payload: { zoneId: zone.entity.id, planId: plan.entity.id, projectId: project.entity.id },
		} as never);

		expect(Notice.shown.length).toBe(before + 1);
		expect(Notice.shown.at(-1)).toContain('out of date');
		void requirement;

		await plugin.onunload();
	});

	/**
	 * The TRUE arm of `if (file instanceof TFile)` in the registered rename handler — a
	 * renamed NOTE must reach `VaultChangeAdapter.onRename` and move the index entry to its
	 * new path. This case used to read `plan.id` where `stack.plans.save` resolves to
	 * `{ entity, version }`, so `plan.id` was `undefined`, `index.getPath(undefined)` was
	 * `undefined`, and `stack.vault.getAbstractFileByPath(undefined)` answered `null` —
	 * `null instanceof TFile` is `false`, so this "positive" case was silently exercising the
	 * handler's FALSE arm (already covered by `persistence-wiring.test.ts`'s "tolerate events
	 * that are not notes") while its own assertion (`undefined === undefined`) stayed green
	 * throughout. Fixed to `plan.entity.id`, and strengthened: the OLD assertion — the index
	 * still answering the SAME path — would have stayed true even under a guard inverted to
	 * always skip a real TFile, since a skipped rename simply leaves the existing mapping
	 * alone. Asserting the entry followed the file to a genuinely NEW path is what a skipped
	 * guard cannot produce.
	 */
	it('forwards a renamed note to the change adapter and moves its index entry', async () => {
		const stack = createRepositoryStack();
		const project = expectOk(await stack.projects.save(makeProject(), 'absent'));
		const plan = expectOk(await stack.plans.save(makePlan({ projectId: project.entity.id }), 'absent'));
		stack.metadataCache.catchUp();

		const { plugin, workspace, vaultHandlers } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();

		const oldPath = plugin.root.persistence?.index.getPath(plan.entity.id) as string;
		const movedFile = stack.vault.getAbstractFileByPath(oldPath) as InstanceType<typeof TFile>;
		expect(movedFile).toBeInstanceOf(TFile);
		const newPath = 'Renovation/Renamed Plan.md';
		// Obsidian moves the FILE, bytes included — the handler is only handed the file at its
		// new path, so the vault has to answer at that path too, or the reprocessing `onRename`
		// itself triggers (via `enqueue`) would find nothing there and remove the very entry it
		// just moved.
		stack.vault.entries.set(newPath, stack.vault.entries.get(oldPath) as string);
		stack.vault.entries.delete(oldPath);
		movedFile.path = newPath;

		const rename = vaultHandlers[3];
		expect(rename).toBeInstanceOf(Function);
		rename(movedFile, oldPath);
		plugin.root.persistence?.changeAdapter.flush();

		expect(plugin.root.persistence?.index.getPath(plan.entity.id)).toBe(newPath);

		await plugin.onunload();
	});

	it('unloading a session whose settings were unrecovered is a no-op that disposes nothing', async () => {
		const stack = createRepositoryStack();
		const before = [...stack.vault.entries.keys()];
		const { plugin } = await loadedPlugin(null, new Error('unreadable'), true);
		await plugin.onunload();

		// No persistence was ever composed, so unloading must not have written anything.
		expect([...stack.vault.entries.keys()]).toEqual(before);
	});
});
