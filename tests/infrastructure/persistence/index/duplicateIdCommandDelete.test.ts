/**
 * §5.1a's promotion rule at the doors a user reaches from INSIDE the plugin.
 *
 * Every promotion case in `excludedNotes.test.ts` drives `VaultChangeAdapter` directly —
 * `onDelete`, `onCreate`, `onModify` — which are the out-of-band doors. A duplicate winner
 * removed by a repository reaches the index by a different route: the repository mutates it
 * itself (SDD §42), so promotion has to be a property of the INDEX rather than of the pipeline,
 * and until it was the surviving note stayed unindexed until the next full rebuild.
 *
 * **The first case is the one that can tell those two owners apart, and it is the only one
 * here that can.** Both orderings the brief named are covered — the vault event landing during
 * `trashFile` and the event never landing at all — but a case that wires the pipeline passes
 * whether promotion lives in the index or back in the adapter, because the adapter's
 * `applyRemove` is on the path either way. Only a repository delete over a stack with NO
 * ADAPTER AT ALL asserts the ownership this task exists to move. Measured: with `promote`
 * deleted from `ReconcilingProjectIndex.remove` and `promoteContender` restored to
 * `VaultChangeAdapter.applyRemove`, that case fails at its assertion and every other case in
 * this file and in `excludedNotes.test.ts` stays green.
 *
 * Asserted against what a full `rebuildIndex()` produces rather than against a hard-coded path,
 * because §5.1a's determinism rule is exactly that the incremental door and the reload must not
 * disagree about which note IS the asset — and a comparison alone would pass over two builds
 * that both lose the asset, so the rebuilt state is pinned too.
 */
import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { createRepositoryStack, type RepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';
import { VaultChangeAdapter } from '../../../../src/infrastructure/persistence/index/VaultChangeAdapter';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { DeleteAssetCommand } from '../../../../src/application/commands/asset/DeleteAsset';
import { RecalculateRequirementCommand } from '../../../../src/application/commands/requirement/RecalculateRequirement';
import { InMemoryAssetPriceOverrideRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { assetSidecarPathFor } from '../../../../src/infrastructure/obsidian/repositories/paths';
import { shapeFromDimensions } from '../../../../src/domain/asset/AssetShape';

const settled = (): Promise<void> => Promise.resolve().then(() => undefined);

/**
 * An asset saved through its repository, then COPIED at a second path — Obsidian's own
 * `Duplicate file`, which §5.1a names as the likeliest producer of a collision in a real vault.
 * The copy is planted second, so a rebuild's last-writer-wins makes it the winner and the saved
 * note the `duplicate-id` loser. The copy is byte-identical, so the winner's version is the
 * saved note's.
 *
 * No pipeline is wired here. `withPipeline` adds one where a case wants the race.
 */
async function collidingVault() {
	const stack: RepositoryStack = createRepositoryStack();
	const saved = expectOk(await stack.assets.save(makeAsset(), 'absent'));
	const assetId = saved.entity.id;
	const originalPath = stack.index.getPath(assetId) ?? '';
	const copyPath = `${stack.libraryFolder}/Tile 1.md`;
	stack.vault.entries.set(copyPath, stack.vault.entries.get(originalPath) ?? '');
	stack.metadataCache.catchUp();
	stack.rebuildIndex();

	return { stack, assetId, version: saved.version, originalPath, copyPath };
}

/**
 * The real pipeline over the same stack, with the fake vault taught to raise the two events
 * Obsidian raises — the rig `assetDeleteCompensation.test.ts` established, for the same reason:
 * a hand-written `index.remove(...)` would encode one reader's idea of the delete arm.
 *
 * **Which of the two settings does what, read off `VaultChangeAdapter` rather than inferred from
 * the behaviour.** `onDelete` calls `processPath` directly and never reads `debounceMs` — the
 * only reader is `enqueue`, which `onCreate`, `onModify` and both arms of `onRename` go through
 * (`grep -n "debounceMs"` on that file prints its declaration and two lines, both inside
 * `enqueue`) — so a delete is
 * synchronous whatever the debounce says. What puts the delete INSIDE `trashFile`'s own await is
 * the `vault.delete` override below, which raises the event after removing the file and before
 * the awaited call returns; that is the ordering which used to undo the promotion it had just
 * made. `debounceMs: 0` earns its place on the CREATE half instead, and for a blunter reason
 * than "sooner": it keeps `enqueue` — the only reader, reached by `onCreate` and `onModify` — on
 * its SYNCHRONOUS branch, and the other branch calls `window.setTimeout`. This file's
 * environment has no `window` — `vitest.config.ts` sets `environment: 'node'` and nothing here
 * opts out; `branches.test.ts` stubs one to reach that branch at all. Measured with `debounceMs: 500`: the restore's `vault.create` in the rollback
 * case raises `onCreate`, `enqueue` throws on the absent `window`, the throw leaves the override
 * and `restoreNoteText` reports failure — `asset.delete-compensation-failed` in the log, and the
 * case fails with the loser still holding the id.
 *
 * **Two earlier drafts of this paragraph got the arrow wrong in two different directions**, which
 * is why it is this long. The first gave the delete ordering to `debounceMs: 0`; the setting and
 * the behaviour were both real and the arrow between them was invented, and reading `onDelete` —
 * where `debounceMs` does not appear at all — is the only thing that could have caught it. The
 * second corrected the attribution and then guessed at the CONSEQUENCE, saying the create merely
 * "sits on a timer nothing flushes", which is what `enqueue` says and not what happens here.
 * A sentence attributing a behaviour to a cause is checked by reading the cause; a sentence
 * saying what would happen WITHOUT the cause is checked by taking it away and running it.
 */
function withPipeline(stack: RepositoryStack): void {
	const adapter = new VaultChangeAdapter({
		vault: stack.vault as never,
		metadataCache: stack.metadataCache as never,
		index: stack.index,
		echo: stack.echo,
		events: stack.events,
		logger: stack.logger,
		debounceMs: 0,
	});
	type Deleted = Parameters<typeof stack.vault.delete>[0];
	const removeFile = stack.vault.delete.bind(stack.vault);
	stack.vault.delete = async (file: Deleted): Promise<void> => {
		await removeFile(file);
		if (file instanceof TFile) adapter.onDelete(file);
	};
	const createFile = stack.vault.create.bind(stack.vault);
	stack.vault.create = async (path: string, data: string): Promise<TFile> => {
		const created = await createFile(path, data);
		adapter.onCreate(created);
		return created;
	};
}

/** `DeleteAssetCommand` over the stack's own repositories — the whole cascade, not a stub. */
function commandOver(stack: RepositoryStack): DeleteAssetCommand {
	const events = createEventBus(() => undefined);
	const overrides = new InMemoryAssetPriceOverrideRepository();
	return new DeleteAssetCommand({
		assets: stack.assets,
		requirements: stack.requirements,
		recalculate: new RecalculateRequirementCommand({
			requirements: stack.requirements,
			zones: stack.zones,
			assets: stack.assets,
			events,
			projects: stack.projects,
			overrides,
		}),
		events,
		locks: new ReferenceLocks(),
		logger: stack.logger,
		overrides,
	});
}

/** What the incremental doors left, beside what a full rescan of the same vault produces. */
function againstRebuild(stack: RepositoryStack, assetId: Parameters<typeof stack.index.getPath>[0]) {
	const incremental = { path: stack.index.getPath(assetId), exclusions: [...stack.index.listExclusions()] };
	stack.rebuildIndex();
	return { incremental, rebuilt: { path: stack.index.getPath(assetId), exclusions: [...stack.index.listExclusions()] } };
}

describe('a duplicate-id delete the pipeline never hears about', () => {
	/**
	 * **The ownership case.** No adapter exists, so no vault event is raised and nothing but
	 * `ProjectIndex.remove` can promote. It is the brief's ordering #2 — the event arriving after
	 * the removal, or never — and it is the asymmetry the `upsert` half of this seam already had
	 * through the rollback case below while the `remove` half had none.
	 */
	it('promotes through the repository alone, with no vault-change pipeline in the tree', async () => {
		const { stack, assetId, version, originalPath, copyPath } = await collidingVault();
		expect(stack.index.getPath(assetId)).toBe(copyPath);

		expectOk(await stack.assets.delete(assetId, version));

		const { incremental, rebuilt } = againstRebuild(stack, assetId);
		expect(incremental).toEqual(rebuilt);
		expect(rebuilt).toEqual({ path: originalPath, exclusions: [] });
	});
});

describe('a duplicate-id delete driven by a command', () => {
	/**
	 * The brief's ordering #1: `trashFile` is awaited, this rig's `vault.delete` override raises
	 * the delete event inside that await, and the promotion it makes used to be undone by the
	 * `index.remove(id)` that follows.
	 * `forgetTrashedNote` is what closes it — the entry goes only while the id still names the
	 * path this delete trashed.
	 */
	it('promotes the surviving claimant the next rebuild would pick', async () => {
		const { stack, assetId, originalPath, copyPath } = await collidingVault();
		withPipeline(stack);
		expect(stack.index.getPath(assetId)).toBe(copyPath);

		expectOk(await commandOver(stack).execute({ assetId }));
		await settled();

		const { incremental, rebuilt } = againstRebuild(stack, assetId);
		// Both halves: the two doors agree, AND what they agree on is the surviving note.
		expect(incremental).toEqual(rebuilt);
		expect(rebuilt).toEqual({ path: originalPath, exclusions: [] });
	});

	/**
	 * **INVERTED, deliberately: this pins the LOSS the promotion decision accepts.**
	 *
	 * §5.1a's promotion rule and the cascade are keyed by the same ID, and the duplicate loser
	 * shares it — so an asset's geometry sidecar (and, by the identical key, its price overrides
	 * and its requirement links) is destroyed by a delete the survivor then inherits nothing
	 * from. Promotion does not cause that and withholding it would not prevent it: the next full
	 * rebuild promotes the survivor regardless, so declining would hide it rather than protect
	 * it. Closing it properly means REFUSING to delete an asset whose id has contenders, which is
	 * a rule in `DeleteAssetCommand` and needs the loser to be nameable on a surface first.
	 *
	 * So this case asserts today's lossy behaviour on purpose. **A future fix should turn it
	 * red**, and its author should read this note rather than restore the assertion.
	 */
	it('leaves the promoted survivor with no geometry, which is the accepted loss', async () => {
		const { stack, assetId, originalPath } = await collidingVault();
		const sidecarPath = assetSidecarPathFor(stack.libraryFolder, assetId);
		const sidecar = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
		expectOk(await sidecar.write(assetId, { calibration: null, shape: expectOk(shapeFromDimensions(1200, 800)) }));
		withPipeline(stack);

		expectOk(await commandOver(stack).execute({ assetId }));
		await settled();

		// Promoted — and holding nothing the deleted note's id used to own. Asserted on the SHAPE
		// as well as on the file, because an absent asset sidecar reads as a SHAPELESS asset
		// rather than as an error, so the read alone cannot tell "destroyed" from "never designed"
		// and the file alone cannot say what the user sees.
		expect(stack.index.getPath(assetId)).toBe(originalPath);
		expect(stack.vault.entries.has(sidecarPath)).toBe(false);
		expect(expectOk(await sidecar.read(assetId)).document.shape).toBeNull();
	});
});

describe("a duplicate winner's delete that refuses after the trash", () => {
	/**
	 * The ROLLBACK door, and the same seam: the compensation puts the winner's entry back through
	 * the index, and the entry it displaces is the loser the vault's own delete event had just
	 * promoted. Through the raw port that loser left the entries and gained no descriptor — in
	 * NEITHER collection, so the repair strip could not even name the file.
	 */
	it('demotes the promoted loser back to a duplicate-id descriptor', async () => {
		const { stack, assetId, version, originalPath, copyPath } = await collidingVault();
		const sidecarPath = assetSidecarPathFor(stack.libraryFolder, assetId);
		const sidecar = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
		expectOk(await sidecar.write(assetId, { calibration: null, shape: expectOk(shapeFromDimensions(1200, 800)) }));
		withPipeline(stack);
		stack.vault.failures.add(`delete:${sidecarPath}`);

		expect(expectErr(await stack.assets.delete(assetId, version)).code).toBe('asset.delete-failed');
		await settled();

		// The winner is back, so the loser is a loser again — and says so.
		expect(stack.index.getPath(assetId)).toBe(copyPath);
		expect(stack.index.listExclusions()).toEqual([
			{ path: originalPath, entityType: 'renovation-asset', reason: 'duplicate-id' },
		]);
	});
});
