/**
 * Height (Task A7) — the one asset scalar that does NOT live in the geometry sidecar.
 *
 * Driven through the REAL `ObsidianAssetRepository` over the in-memory vault rather than
 * through `InMemoryAssetRepository`, because what these cases are about is the NOTE. "A
 * plugin-less reader sees it" is a claim about bytes on disk, and an in-memory repository
 * answers whatever it was handed — it would certify a height that never reached a
 * frontmatter key, never went through `assetToPersistence`, and never survived
 * `writeOwnedFrontmatter`'s merge. The same argument `setAssetFootprint.test.ts` makes for
 * driving the real sidecar, one boundary over.
 *
 * The five geometry commands share `updateAssetShape`; this one shares nothing with them —
 * it writes the note through `AssetRepository.save` and `Asset.withChanges`. So every
 * guarantee that path holds for them (validate, report a no-write, condition the write,
 * announce once) is asked here again from scratch rather than inherited.
 */
import { describe, expect, it } from 'vitest';
import { SetAssetHeightCommand } from '../../../../src/application/commands/asset/SetAssetHeight';
import { createEventBus, type EventBus } from '../../../../src/core/events/EventBus';
import type { AssetId } from '../../../../src/domain/asset/AssetId';
import type { AssetDesignChanged } from '../../../../src/domain/asset/Asset.events';
import { registerOnAssetUpdated } from '../../../../src/application/event-handlers/requirement/onAssetUpdated';
import { createRepositoryStack, parseFrontmatter, serializeFrontmatter } from '../../../helpers/vault';
import { makeAsset, makeZone } from '../../../helpers/entities';
import { expectErr, expectOk } from '../../../helpers/domain';
import { requirementFixture, TEN_SQUARE_METERS } from '../../../helpers/slice10';

/**
 * The events a SUBSCRIBER heard, on the real bus. `RecordingEventBus.subscribe` discards
 * its handler, so a case built on it asserts an empty list in both worlds — the rule the
 * attribute suite states beside its own version of this helper.
 */
function heardOn(bus: EventBus, type: 'AssetDesignChanged' | 'AssetUpdated'): AssetId[] {
	const heard: AssetId[] = [];
	bus.subscribe(type, (event) => {
		heard.push((event as AssetDesignChanged).payload.assetId);
	});
	return heard;
}

/**
 * The command is constructed HERE, once, for the reason Task A5a paid for: a command built
 * beside a case is a command a mutation run silently leaves un-mutated.
 */
async function seeded(height: number | null = null) {
	const stack = createRepositoryStack();
	const events = createEventBus();
	const written = expectOk(await stack.assets.save(makeAsset({ height }), 'absent'));
	const assetId = written.entity.id;
	const path = stack.index.getPath(assetId) ?? '';

	return {
		stack,
		events,
		assetId,
		path,
		version: written.version,
		height: new SetAssetHeightCommand(stack.assets, events),
		designChanges: heardOn(events, 'AssetDesignChanged'),
		catalogueChanges: heardOn(events, 'AssetUpdated'),
		/** What a reader with no plugin would find in the note's frontmatter. */
		noteFrontmatter(): Record<string, unknown> {
			return parseFrontmatter(stack.vault.entries.get(path) ?? '').frontmatter;
		},
		async stored() {
			return expectOk(await stack.assets.getById(assetId));
		},
		/** A hand edit no schema would accept, so the next read of this note FAILS. */
		corrupt(): void {
			const { frontmatter, body } = parseFrontmatter(stack.vault.entries.get(path) ?? '');
			stack.vault.entries.set(path, serializeFrontmatter({ ...frontmatter, category: 'not-a-category' }) + body);
			stack.metadataCache.catchUp();
		},
	};
}

describe('SetAssetHeight', () => {
	it('round-trips a height through the note, so a plugin-less reader sees it', async () => {
		const { height, assetId, stored, noteFrontmatter } = await seeded();

		expect(expectOk(await height.execute({ assetId, height: 900 }))).toBe('wrote');

		expect(noteFrontmatter()['height']).toBe(900);
		expect((await stored())?.entity.height).toBe(900);
	});

	/**
	 * THREE decimals, not two. `594.005` is not representable in binary floating point, so a
	 * write that went through a formatter, a decimal string or a two-place rounding would
	 * come back a different number — while `99.99` survives every one of those and proves
	 * nothing. Height is a plain YAML number rather than an ADR-010 decimal string (it is not
	 * money and nothing computes with it), which is exactly why the round trip is worth
	 * pinning at a value that can lose.
	 */
	it('keeps a three-decimal height exactly, rather than through a formatter', async () => {
		const { height, assetId, stored, noteFrontmatter } = await seeded();

		await height.execute({ assetId, height: 594.005 });

		expect(noteFrontmatter()['height']).toBe(594.005);
		expect((await stored())?.entity.height).toBe(594.005);
	});

	it('clears a height given null', async () => {
		const { height, assetId, stored, noteFrontmatter } = await seeded();
		expect(expectOk(await height.execute({ assetId, height: 900 }))).toBe('wrote');

		expect(expectOk(await height.execute({ assetId, height: null }))).toBe('wrote');

		expect(noteFrontmatter()['height']).toBeNull();
		expect((await stored())?.entity.height).toBeNull();
	});

	it('refuses a negative height, and writes nothing', async () => {
		const { height, assetId, stored, version } = await seeded();

		expect(expectErr(await height.execute({ assetId, height: -10 })).code).toBe('asset.negative-height');

		expect((await stored())?.version.revision).toBe(version.revision);
	});

	/**
	 * NOT covered by the sign guard, and the loss it prevents is SILENT. `z.number()` refuses
	 * a non-finite value, so `AssetFrontmatterSchemaV1`'s `.catch(null)` turns one into `null`
	 * on the way back in — and `serializeFrontmatter` writes `Infinity`, which is not a YAML
	 * number. Without this guard the command reports `'wrote'`, the note carries a word, and
	 * the height is gone at the next read with nothing having refused anything.
	 *
	 * Its own code rather than `negative-height`, because NaN is not a negative number — the
	 * distinction `footprintFromDimensions` already makes for its own two questions.
	 */
	it.each([Number.POSITIVE_INFINITY, Number.NaN])('refuses a non-finite height (%s)', async (value) => {
		const { height, assetId, stored, version } = await seeded();

		expect(expectErr(await height.execute({ assetId, height: value })).code).toBe('asset.invalid-height');

		expect((await stored())?.version.revision).toBe(version.revision);
	});

	/**
	 * `ok` is not evidence that anything was written. Re-submitting the height an asset
	 * already carries has to SAY so, or the save indicator clears a `save-error` a real
	 * persistence failure left, over a write that never happened.
	 */
	it('reports a no-write for the height the asset already carries, and does not bump the revision', async () => {
		const { height, assetId, stored, version, designChanges } = await seeded(900);

		expect(expectOk(await height.execute({ assetId, height: 900 }))).toBe('no-write');

		expect((await stored())?.version.revision).toBe(version.revision);
		expect(designChanges).toEqual([]);
	});

	it('reports a no-write for clearing a height the asset does not have', async () => {
		const { height, assetId, stored, version } = await seeded();

		expect(expectOk(await height.execute({ assetId, height: null }))).toBe('no-write');

		expect((await stored())?.version.revision).toBe(version.revision);
	});

	it('announces the design change so a peer designer leaf re-reads', async () => {
		const { height, assetId, designChanges } = await seeded();

		await height.execute({ assetId, height: 900 });

		expect(designChanges).toEqual([assetId]);
	});

	it('leaves every catalogue field it does not own alone', async () => {
		const { height, assetId, stored } = await seeded();
		const before = await stored();

		await height.execute({ assetId, height: 900 });

		const after = await stored();
		expect(after?.entity.name).toBe(before?.entity.name);
		expect(after?.entity.unitCost).toEqual(before?.entity.unitCost);
		expect(after?.entity.wasteFactorDefault.toString()).toBe(before?.entity.wasteFactorDefault.toString());
		expect(after?.entity.unit).toBe(before?.entity.unit);
	});

	it('refuses an asset that is not there rather than creating one', async () => {
		const { height } = await seeded();
		const stack = createRepositoryStack();
		const absent = expectOk(await stack.assets.save(makeAsset(), 'absent')).entity.id;

		expect(expectErr(await height.execute({ assetId: absent, height: 900 })).code).toBe('asset.not-found');
	});

	/**
	 * A read that FAULTS is not an asset that is absent, and collapsing the two would tell a
	 * user "that asset is gone" about a note whose bytes are sitting right there — the
	 * relabel this repository has already paid for twice.
	 */
	it('surfaces a failed read rather than reporting the asset missing', async () => {
		const { height, assetId, corrupt } = await seeded();
		corrupt();

		expect(expectErr(await height.execute({ assetId, height: 900 })).code).toBe('asset.entity-invalid');
	});

	/**
	 * The version this command's own read returned is the weakest honest condition; an
	 * `expected` a caller supplies is a stronger one, and an undo needs it. A stale one
	 * refuses rather than overwriting whatever landed since.
	 */
	it('conditions the write on a supplied expected version', async () => {
		const { height, assetId, version, stored } = await seeded();
		expect(expectOk(await height.execute({ assetId, height: 900 }))).toBe('wrote');

		const error = expectErr(await height.execute({ assetId, height: 1200, expected: version }));

		expect(error.code).toBe('asset.revision-conflict');
		expect((await stored())?.entity.height).toBe(900);
	});
});

/**
 * The epic's "interpreted by nothing", made checkable — with the recalculation cascade
 * REGISTERED, so a build announcing `AssetUpdated` instead really would drive it.
 *
 * Read what it discriminates narrowly. It catches the event choice (the `AssetUpdated`
 * assertion) and it would catch a command that reached a Requirement. It does NOT
 * discriminate the cascade running from the cascade not running today, because
 * `assetMatchesCalculatedFrom` compares price and unit — neither of which a height moves —
 * so `AssetUpdated` would list the requirements, skip every one and write nothing. It is
 * weak evidence today and strong evidence the day somebody makes a height an input.
 */
describe('a height is read by nothing that calculates', () => {
	it('changes no requirement figure, no requirement revision, and reaches no catalogue subscriber', async () => {
		const fixture = await requirementFixture();
		const events = fixture.events;
		const catalogueChanges = heardOn(events, 'AssetUpdated');
		const zone = expectOk(
			await fixture.zones.save(
				expectOk(
					makeZone({ projectId: fixture.project.entity.id, planId: fixture.plan.entity.id })
						.withGeometry({ points: TEN_SQUARE_METERS }),
				),
				'absent',
			),
		);
		const asset = expectOk(await fixture.assets.save(makeAsset(), 'absent'));
		registerOnAssetUpdated(events, {
			requirements: fixture.requirements,
			assets: fixture.assets,
			// The fixture's OWN override repository, not a fresh one: the price-override
			// increment made this a required member, and the cascade resolves
			// `override ?? asset.unitCost` through it — a second instance here would be a
			// handler pricing against a world the fixture's own commands never wrote to.
			overrides: fixture.overrides,
			events,
			logger: { debug() {}, info() {}, warn() {}, error() {} },
			recalculate: (input) => fixture.recalculate.execute({ requirementId: input.requirementId as never }),
		});
		const assigned = expectOk(
			await fixture.assign.execute({ zoneId: zone.entity.id, assetId: asset.entity.id }),
		);
		const before = expectOk(await fixture.requirements.getById(assigned.requirement.id));

		const command = new SetAssetHeightCommand(fixture.assets, events);
		expect(expectOk(await command.execute({ assetId: asset.entity.id, height: 900 }))).toBe('wrote');

		const after = expectOk(await fixture.requirements.getById(assigned.requirement.id));
		expect(after?.entity.quantity.calculated.value.toString())
			.toBe(before?.entity.quantity.calculated.value.toString());
		expect(after?.entity.estimatedCost.calculated.amount).toBe(before?.entity.estimatedCost.calculated.amount);
		expect(after?.version.revision).toBe(before?.version.revision);
		expect(catalogueChanges).toEqual([]);
	});
});
