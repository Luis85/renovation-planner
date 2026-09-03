import { describe, expect, it } from 'vitest';
import { createRepositoryStack } from '../../../helpers/vault';
import { createEventBus, type DomainEvent } from '../../../../src/core/events/EventBus';
import type {
	ProjectIndexEntryChanged,
	ProjectIndexExclusionChanged,
	ProjectIndexExclusionChangedPayload,
} from '../../../../src/application/events/projectIndex.events';
import type { EntityId } from '../../../../src/core/identity/EntityId';
import { VaultChangeAdapter } from '../../../../src/infrastructure/persistence/index/VaultChangeAdapter';

/**
 * The index holds the notes it could NOT index, and the incremental door announces them.
 *
 * Two sources feed that collection and neither is recoverable afterwards. A note of ours with
 * no usable `id` never reaches a repository at all — `entityRefOf` classifies it `no-id` and
 * the scan drops it — and a note whose id DUPLICATES another's is dropped by the scan's own
 * last-writer-wins map, its path known only to a warning. So a vault whose asset notes are all
 * broken produced an empty catalogue and no count of anything, and drew "no assets yet" over a
 * library full of them.
 *
 * The pipeline half is the one that does not follow from the scan half: `VaultChangeAdapter`
 * processes the path that CHANGED and no other, and a `duplicate-id` exclusion is the one kind
 * whose cause lives in a different file. So the winner being deleted has to re-open the
 * question for notes nothing else will ever ask about again.
 */

const asId = (id: string): EntityId<string> => id as EntityId<string>;

/** A note planted straight into the vault, the way sync or the file explorer does. */
function plant(stack: ReturnType<typeof createRepositoryStack>, path: string, frontmatter: string): void {
	stack.vault.entries.set(path, `---\n${frontmatter}\n---\n`);
	stack.metadataCache.catchUp();
}

const assetNote = (id: string): string => `type: renovation-asset\nid: ${id}`;

/**
 * The real pipeline over a stack, with both index events recorded. Modelled on
 * `announcements.test.ts`'s own rig, and on the REAL event types rather than a hand-written
 * `{ payload: … }`: a cast between shapes with no overlap is a second derivation of a contract
 * `projectIndex.events.ts` already states.
 */
function wired(stack: ReturnType<typeof createRepositoryStack>) {
	const bus = createEventBus(() => undefined);
	const exclusions: ProjectIndexExclusionChangedPayload[] = [];
	bus.subscribe('ProjectIndexExclusionChanged', (event: DomainEvent) => {
		exclusions.push((event as ProjectIndexExclusionChanged).payload);
	});
	const announced: { id: string; type: string }[] = [];
	bus.subscribe('ProjectIndexEntryChanged', (event: DomainEvent) => {
		const { payload } = event as ProjectIndexEntryChanged;
		announced.push({ id: String(payload.entityId), type: payload.entityType });
	});
	const adapter = new VaultChangeAdapter({
		vault: stack.vault as never,
		metadataCache: stack.metadataCache as never,
		index: stack.index,
		echo: stack.echo,
		logger: stack.logger,
		events: bus,
		debounceMs: 0,
	});
	return { adapter, exclusions, announced };
}

/** The bus costs one microtask hop per delivery, and a synchronous pipeline publishes detached. */
const settled = (): Promise<void> => Promise.resolve().then(() => undefined);

/**
 * Notes sharing one id, in the order given — which is `getMarkdownFiles()` order, which is
 * the order a full rebuild reaches them in. The LAST one wins; every earlier one is excluded.
 */
function stackWithDuplicates(id: string, names: readonly string[]): ReturnType<typeof createRepositoryStack> {
	const stack = createRepositoryStack();
	for (const name of names) plant(stack, `Library/${name}`, assetNote(id));
	stack.rebuildIndex();
	return stack;
}

describe('the full scan records the notes it could not index', () => {
	it('records a note of ours with no id as an exclusion carrying its own type', () => {
		const stack = createRepositoryStack();
		plant(stack, 'Library/broken.md', 'type: renovation-asset');

		stack.rebuildIndex();

		expect(stack.index.listExclusions()).toEqual([
			{ path: 'Library/broken.md', entityType: 'renovation-asset', reason: 'no-id' },
		]);
	});

	/**
	 * The index is ONE global id namespace and `collectNotes` keys its map by `ref.id` with no
	 * type in the key, so a project note and an asset note declaring one id really do collide.
	 * Taking the winner's type would file the excluded asset under whatever displaced it: an
	 * asset displaced by a project would vanish from the library's own repair list, and a
	 * project displaced by an asset would appear in it.
	 */
	it("gives a duplicate-id loser its OWN type, never the winner's", () => {
		const stack = createRepositoryStack();
		plant(stack, 'Renovation/A/Project.md', 'type: renovation-project\nid: shared-01');
		plant(stack, 'Library/tile.md', assetNote('shared-01'));

		stack.rebuildIndex();

		const excluded = stack.index.listExclusions();
		expect(excluded).toHaveLength(1);
		expect(excluded[0]).toEqual({
			path: 'Renovation/A/Project.md',
			entityType: 'renovation-project',
			reason: 'duplicate-id',
		});
		// Stated as the RELATIONSHIP too, because the assertion above is equally true of a build
		// that happens to agree by accident: whichever note won, the descriptor names the other.
		const winner = stack.index.entries().find((entry) => entry.id === asId('shared-01'));
		expect(winner?.path).toBe('Library/tile.md');
		expect(excluded[0]?.entityType).not.toBe(winner?.type);
	});

	/**
	 * A rebuild replaces BOTH collections. Without that, a collision the user has resolved is
	 * reported for the life of the session — and the reload that was supposed to be the repair
	 * would be the one thing that could not clear it.
	 */
	it('a rebuild forgets a descriptor the vault no longer justifies', () => {
		const stack = stackWithDuplicates('tile-01', ['one.md', 'two.md']);
		expect(stack.index.listExclusions()).toHaveLength(1);

		stack.vault.entries.delete('Library/one.md');
		stack.rebuildIndex();

		expect(stack.index.listExclusions()).toEqual([]);
	});
});

describe('the incremental door maintains the exclusions', () => {
	it('announces an exclusion change through its own event', async () => {
		const stack = createRepositoryStack();
		const { adapter, exclusions, announced } = wired(stack);
		plant(stack, 'Library/broken.md', 'type: renovation-asset');

		adapter.onCreate({ path: 'Library/broken.md' } as never);
		await settled();

		expect(exclusions).toEqual([{ path: 'Library/broken.md', entityType: 'renovation-asset' }]);
		// And NOT through the entry event, which is the reason this is a third event at all:
		// `ProjectIndexEntryChangedPayload` requires an `entityId`, and this note has none.
		expect(announced).toEqual([]);
		expect(stack.index.listExclusions()).toEqual([
			{ path: 'Library/broken.md', entityType: 'renovation-asset', reason: 'no-id' },
		]);
	});

	it('drops the descriptor when the broken note is deleted', async () => {
		const stack = createRepositoryStack();
		plant(stack, 'Library/broken.md', 'type: renovation-asset');
		stack.rebuildIndex();
		const { adapter, exclusions } = wired(stack);

		stack.vault.entries.delete('Library/broken.md');
		adapter.onDelete({ path: 'Library/broken.md' } as never);
		await settled();

		expect(stack.index.listExclusions()).toEqual([]);
		expect(exclusions).toEqual([{ path: 'Library/broken.md', entityType: 'renovation-asset' }]);
	});

	/**
	 * The other way a `no-id` note stops being one: not by gaining an id, but by ceasing to be
	 * ours at all — a `type` corrected away, retyped by hand, or overwritten by sync. It reaches
	 * the door through the `!== 'ours'` arm, where there is no entry to remove and the ONLY
	 * thing to do is forget the descriptor. Without that, a repair surface goes on naming a file
	 * this plugin has no further claim on, until the next full rebuild.
	 */
	it('drops the descriptor when the note stops being one of ours', async () => {
		const stack = createRepositoryStack();
		plant(stack, 'Library/broken.md', 'type: renovation-asset');
		stack.rebuildIndex();
		expect(stack.index.listExclusions()).toHaveLength(1);
		const { adapter, exclusions, announced } = wired(stack);

		plant(stack, 'Library/broken.md', 'type: something-else\nid: tile-01');
		adapter.onModify({ path: 'Library/broken.md' } as never);
		await settled();

		expect(stack.index.listExclusions()).toEqual([]);
		expect(exclusions).toEqual([{ path: 'Library/broken.md', entityType: 'renovation-asset' }]);
		// Nothing joined the index either — the note is not ours, so it is neither an entry nor
		// an exclusion, which is the one state a foreign note is supposed to be in.
		expect(stack.index.entries()).toEqual([]);
		expect(announced).toEqual([]);
	});

	it('drops the descriptor when the note gains the id it was missing', async () => {
		const stack = createRepositoryStack();
		plant(stack, 'Library/broken.md', 'type: renovation-asset');
		stack.rebuildIndex();
		const { adapter, exclusions, announced } = wired(stack);

		plant(stack, 'Library/broken.md', assetNote('tile-01'));
		adapter.onModify({ path: 'Library/broken.md' } as never);
		await settled();

		expect(stack.index.listExclusions()).toEqual([]);
		expect(stack.index.getPath(asId('tile-01'))).toBe('Library/broken.md');
		expect(exclusions).toEqual([{ path: 'Library/broken.md', entityType: 'renovation-asset' }]);
		expect(announced).toEqual([{ id: 'tile-01', type: 'renovation-asset' }]);
	});

	/**
	 * **The echo record a deleted EXCLUDED note leaves behind.** `collectNotes` marks the echo of
	 * every note it reads and a `duplicate-id` loser is marked on the way in, then displaced — so
	 * it leaves a record with no index entry to carry it out on deletion. Restore the file with
	 * the same bytes and `echo.matches` answers TRUE, so the door returns before re-excluding it
	 * and the collision is absent from the repair list until a full rebuild, suppressed as this
	 * plugin's own write.
	 *
	 * The recreated note WINS, which is last-writer-wins doing what it always does: what the
	 * assertion is about is that the collision is visible at all.
	 */
	it('re-excludes a deleted duplicate that comes back with the same bytes', async () => {
		const stack = stackWithDuplicates('tile-01', ['one.md', 'two.md']);
		const loser = 'Library/one.md';
		const text = stack.vault.entries.get(loser) ?? '';
		expect(stack.index.listExclusions()).toHaveLength(1);
		const { adapter } = wired(stack);

		stack.vault.entries.delete(loser);
		adapter.onDelete({ path: loser } as never);
		await settled();
		expect(stack.index.listExclusions()).toEqual([]);

		stack.vault.entries.set(loser, text);
		stack.metadataCache.catchUp();
		adapter.onCreate({ path: loser } as never);
		await settled();

		// The collision is REPORTED again rather than silently absent. The returning note takes
		// the id, so it is the note it displaced that now carries the descriptor.
		expect(stack.index.getPath(asId('tile-01'))).toBe(loser);
		expect(stack.index.listExclusions()).toEqual([
			{ path: 'Library/two.md', entityType: 'renovation-asset', reason: 'duplicate-id' },
		]);
	});

	/**
	 * A descriptor is keyed by path, so a no-id note whose TYPE is edited replaces it — and a
	 * subscriber filtering `ProjectIndexExclusionChanged` on `entityType` hears only the arriving
	 * type. The asset library never learns that its broken note left, and keeps a repair row for
	 * a note that has become somebody else's problem. This is `applyUpsert`'s retype rule on the
	 * exclusion collection.
	 */
	it('announces both types when a retyped exclusion replaces one of another type', async () => {
		const stack = createRepositoryStack();
		plant(stack, 'Library/broken.md', 'type: renovation-asset');
		stack.rebuildIndex();
		const { adapter, exclusions } = wired(stack);

		plant(stack, 'Library/broken.md', 'type: renovation-project');
		adapter.onModify({ path: 'Library/broken.md' } as never);
		await settled();

		expect(exclusions).toEqual([
			{ path: 'Library/broken.md', entityType: 'renovation-asset' },
			{ path: 'Library/broken.md', entityType: 'renovation-project' },
		]);
		expect(stack.index.listExclusions()).toEqual([
			{ path: 'Library/broken.md', entityType: 'renovation-project', reason: 'no-id' },
		]);
	});

	/**
	 * The other half of that pair, and the one that says the fix is a comparison rather than an
	 * unconditional second announcement: an ordinary edit to a broken note re-states the same
	 * descriptor, and a subscriber must hear about that once.
	 */
	it("announces once when an edit leaves the excluded note's type alone", async () => {
		const stack = createRepositoryStack();
		plant(stack, 'Library/broken.md', 'type: renovation-asset');
		stack.rebuildIndex();
		const { adapter, exclusions } = wired(stack);

		plant(stack, 'Library/broken.md', 'type: renovation-asset\nname: Renamed by hand');
		adapter.onModify({ path: 'Library/broken.md' } as never);
		await settled();

		expect(exclusions).toEqual([{ path: 'Library/broken.md', entityType: 'renovation-asset' }]);
	});

	/**
	 * `applyUpsert` is keyed by id, so the arrival simply REPLACES the entry — and without the
	 * demotion the displaced path is in neither `entries()` nor `listExclusions()`. It has not
	 * been reported as broken and it is not in the catalogue: gone from every surface at once,
	 * which is worse than being classified wrongly, because a repair list cannot name the file.
	 */
	it('demotes the displaced winner in the same step as the arrival takes its id', async () => {
		const stack = createRepositoryStack();
		plant(stack, 'Library/one.md', assetNote('tile-01'));
		stack.rebuildIndex();
		const { adapter, exclusions } = wired(stack);

		plant(stack, 'Library/two.md', assetNote('tile-01'));
		adapter.onCreate({ path: 'Library/two.md' } as never);
		await settled();

		expect(stack.index.getPath(asId('tile-01'))).toBe('Library/two.md');
		expect(stack.index.listExclusions()).toEqual([
			{ path: 'Library/one.md', entityType: 'renovation-asset', reason: 'duplicate-id' },
		]);
		expect(exclusions).toEqual([{ path: 'Library/one.md', entityType: 'renovation-asset' }]);
	});

	/**
	 * The demoted descriptor carries the DISPLACED entry's own type, which the arriving note's
	 * type cannot supply: one global id namespace, so the two are not the same kind of thing.
	 */
	it("demotes across entity types, with the displaced note's own type", async () => {
		const stack = createRepositoryStack();
		plant(stack, 'Renovation/A/Project.md', 'type: renovation-project\nid: shared-01');
		stack.rebuildIndex();
		const { adapter } = wired(stack);

		plant(stack, 'Library/tile.md', assetNote('shared-01'));
		adapter.onCreate({ path: 'Library/tile.md' } as never);
		await settled();

		expect(stack.index.listExclusions()).toEqual([
			{ path: 'Renovation/A/Project.md', entityType: 'renovation-project', reason: 'duplicate-id' },
		]);
	});

	/**
	 * The move the demotion must not cry wolf on: a sync that relocates a note without a
	 * `rename` event arrives as a create at the new path while the index still points at the
	 * old one, which is indistinguishable from a duplicate until you ask whether a file is
	 * still sitting there. A descriptor here would name a path that does not exist.
	 */
	it('does not demote a path whose file has gone', async () => {
		const stack = createRepositoryStack();
		plant(stack, 'Library/one.md', assetNote('tile-01'));
		stack.rebuildIndex();
		const { adapter, exclusions } = wired(stack);

		stack.vault.entries.delete('Library/one.md');
		plant(stack, 'Library/moved.md', assetNote('tile-01'));
		adapter.onCreate({ path: 'Library/moved.md' } as never);
		await settled();

		expect(stack.index.getPath(asId('tile-01'))).toBe('Library/moved.md');
		expect(stack.index.listExclusions()).toEqual([]);
		expect(exclusions).toEqual([]);
	});

	it('promotes the sole surviving contender when the winner is deleted', async () => {
		const stack = stackWithDuplicates('tile-01', ['one.md', 'two.md']);
		const winner = stack.index.getPath(asId('tile-01')) ?? '';
		expect(winner).toBe('Library/two.md');
		const { adapter, exclusions, announced } = wired(stack);

		stack.vault.entries.delete(winner);
		adapter.onDelete({ path: winner } as never);
		await settled();

		// The loser is now the only claimant of that id, so it IS the asset.
		expect(stack.index.getPath(asId('tile-01'))).toBe('Library/one.md');
		expect(stack.index.listExclusions()).toEqual([]);
		expect(exclusions).toEqual([{ path: 'Library/one.md', entityType: 'renovation-asset' }]);
		// The removal and the promotion are both entry changes, in that order.
		expect(announced).toEqual([
			{ id: 'tile-01', type: 'renovation-asset' },
			{ id: 'tile-01', type: 'renovation-asset' },
		]);
	});

	/**
	 * **The case a sole-survivor rule fails.** Three notes share an id; deleting the winner
	 * leaves TWO contenders, so "promote when exactly one remains" promotes neither and the id
	 * leaves every surface — worse than the collision it was resolving, and a state the full
	 * scan cannot produce, since `collectNotes` is last-writer-wins and always ends with one
	 * winner however many notes collide.
	 */
	it('promotes one of two remaining contenders, rather than none', async () => {
		const stack = stackWithDuplicates('tile-01', ['one.md', 'two.md', 'three.md']);
		const winner = stack.index.getPath(asId('tile-01')) ?? '';
		expect(stack.index.listExclusions()).toHaveLength(2);
		const { adapter } = wired(stack);

		stack.vault.entries.delete(winner);
		adapter.onDelete({ path: winner } as never);
		await settled();

		expect(stack.index.getPath(asId('tile-01'))).toBeDefined();
		expect(stack.index.listExclusions()).toHaveLength(1);
	});

	/**
	 * An incremental promotion and the next reload must name the SAME file, or which note IS
	 * the asset changes silently when Obsidian restarts. The scan's answer is last-writer-wins
	 * over the vault's own enumeration order, so that is the answer this copies rather than
	 * inventing a second one.
	 */
	it('promotes the contender a full rebuild would pick', async () => {
		const stack = stackWithDuplicates('tile-01', ['one.md', 'two.md', 'three.md']);
		const winner = stack.index.getPath(asId('tile-01')) ?? '';
		const { adapter } = wired(stack);

		stack.vault.entries.delete(winner);
		adapter.onDelete({ path: winner } as never);
		await settled();
		const promoted = stack.index.getPath(asId('tile-01'));
		expect(promoted).toBe('Library/two.md');

		stack.rebuildIndex();

		expect(stack.index.getPath(asId('tile-01'))).toBe(promoted);
		expect(stack.index.listExclusions()).toEqual([
			{ path: 'Library/one.md', entityType: 'renovation-asset', reason: 'duplicate-id' },
		]);
	});

	/**
	 * The re-evaluation is bounded by the ID, not by "some exclusion exists": a second,
	 * unrelated collision elsewhere in the vault is not a contender for this one, and promoting
	 * one of ITS notes would hand an id to a note that never claimed it.
	 */
	it('promotes only a contender for the id that was vacated', async () => {
		const stack = createRepositoryStack();
		for (const [name, id] of [['a1.md', 'tile-01'], ['a2.md', 'tile-01'], ['b1.md', 'tile-02'], ['b2.md', 'tile-02']] as const) {
			plant(stack, `Library/${name}`, assetNote(id));
		}
		stack.rebuildIndex();
		const { adapter } = wired(stack);

		stack.vault.entries.delete('Library/a2.md');
		adapter.onDelete({ path: 'Library/a2.md' } as never);
		await settled();

		expect(stack.index.getPath(asId('tile-01'))).toBe('Library/a1.md');
		expect(stack.index.getPath(asId('tile-02'))).toBe('Library/b2.md');
		expect(stack.index.listExclusions()).toEqual([
			{ path: 'Library/b1.md', entityType: 'renovation-asset', reason: 'duplicate-id' },
		]);
	});

	/**
	 * **The promoted entry's sidecar is RESOLVED, never inherited from what it replaces.**
	 * `joinSidecars` joins by BASENAME to whatever entry holds the id, so a rebuild gives the
	 * promoted plan its `.rpgeo` whatever the vacated entry carried — and the vacated entry here
	 * is a REQUIREMENT, which has no sidecar at all. Inheriting its `undefined` left every zone
	 * read on that plan answering `plan-geometry.path-unresolved` until the next full rebuild.
	 *
	 * Asserted against `rebuildIndex()` rather than against the literal path, because
	 * agreement-with-the-rebuild is the property, not the string.
	 */
	it("resolves the promoted entry's sidecar rather than inheriting the vacated one", async () => {
		const stack = createRepositoryStack();
		plant(stack, 'Renovation/Kitchen/Project.md', 'type: renovation-project\nid: proj-01');
		plant(stack, 'Renovation/Kitchen/Plans/Ground.md', 'type: renovation-plan\nid: pl-01\nproject: proj-01');
		// A requirement note colliding with the plan's id, planted LAST so last-writer-wins hands
		// it the entry and excludes the plan.
		plant(stack, 'Renovation/Kitchen/Requirements/Tiles.md', 'type: renovation-requirement\nid: pl-01\nproject: proj-01');
		stack.vault.entries.set('Renovation/Kitchen/Geometry/pl-01.rpgeo', '{}');
		// A second sidecar naming something else, so the join has a file to decline as well as one
		// to accept.
		stack.vault.entries.set('Renovation/Kitchen/Geometry/pl-99.rpgeo', '{}');
		stack.rebuildIndex();
		const vacated = stack.index.getPath(asId('pl-01'));
		expect(vacated).toBe('Renovation/Kitchen/Requirements/Tiles.md');
		expect(stack.index.getGeometrySidecarPath(asId('pl-01'))).toBeUndefined();
		const { adapter } = wired(stack);

		stack.vault.entries.delete(vacated ?? '');
		adapter.onDelete({ path: vacated ?? '' } as never);
		await settled();

		expect(stack.index.getPath(asId('pl-01'))).toBe('Renovation/Kitchen/Plans/Ground.md');
		const promoted = stack.index.getGeometrySidecarPath(asId('pl-01'));
		expect(promoted).toBe('Renovation/Kitchen/Geometry/pl-01.rpgeo');

		stack.rebuildIndex();

		expect(stack.index.getGeometrySidecarPath(asId('pl-01'))).toBe(promoted);
	});

	/**
	 * The mirror image, and the quieter of the two: promoting a note that has NO sidecar out from
	 * behind one that had. Inheriting handed a requirement entry a `.rpgeo` mapping that a rebuild
	 * refuses to give it — `joinSidecars` skips any entry that is not a plan or an asset, with a
	 * `sidecar-skipped` diagnostic — so the index held a fact its own rebuild would erase.
	 */
	it('gives a promoted entry no sidecar when its kind has none', async () => {
		const stack = createRepositoryStack();
		plant(stack, 'Renovation/Kitchen/Project.md', 'type: renovation-project\nid: proj-01');
		plant(stack, 'Renovation/Kitchen/Requirements/Tiles.md', 'type: renovation-requirement\nid: pl-01\nproject: proj-01');
		// The plan is planted LAST this time, so it holds the entry and the requirement is excluded.
		plant(stack, 'Renovation/Kitchen/Plans/Ground.md', 'type: renovation-plan\nid: pl-01\nproject: proj-01');
		stack.vault.entries.set('Renovation/Kitchen/Geometry/pl-01.rpgeo', '{}');
		stack.rebuildIndex();
		expect(stack.index.getGeometrySidecarPath(asId('pl-01'))).toBe('Renovation/Kitchen/Geometry/pl-01.rpgeo');
		const { adapter } = wired(stack);

		stack.vault.entries.delete('Renovation/Kitchen/Plans/Ground.md');
		adapter.onDelete({ path: 'Renovation/Kitchen/Plans/Ground.md' } as never);
		await settled();

		expect(stack.index.getPath(asId('pl-01'))).toBe('Renovation/Kitchen/Requirements/Tiles.md');
		expect(stack.index.getGeometrySidecarPath(asId('pl-01'))).toBeUndefined();

		stack.rebuildIndex();

		expect(stack.index.getGeometrySidecarPath(asId('pl-01'))).toBeUndefined();
	});

	/**
	 * A descriptor records what was true when it was made, and a vault edited while Obsidian
	 * was closed can have left the loser declaring nothing of ours at all — no event names it,
	 * so the promotion walk is the first thing to look. Trusting the descriptor would index a
	 * note that is no longer one of ours under an id it no longer declares.
	 */
	it('does not promote a contender that has stopped being one of our notes', async () => {
		const stack = stackWithDuplicates('tile-01', ['one.md', 'two.md']);
		const winner = stack.index.getPath(asId('tile-01')) ?? '';
		const { adapter } = wired(stack);

		plant(stack, 'Library/one.md', 'type: something-else\nid: tile-01');
		stack.vault.entries.delete(winner);
		adapter.onDelete({ path: winner } as never);
		await settled();

		expect(stack.index.getPath(asId('tile-01'))).toBeUndefined();
		// And the descriptor SURVIVES, which is a residue pinned rather than described: the walk
		// only inspects, so nothing here drops a descriptor whose note has stopped being a
		// contender, and no event will ever name that file again. The next full rebuild clears
		// it — the same bound every other index fact lives under. A build that starts cleaning
		// up during the walk fails here rather than leaving this paragraph quietly stale.
		expect(stack.index.listExclusions()).toEqual([
			{ path: 'Library/one.md', entityType: 'renovation-asset', reason: 'duplicate-id' },
		]);
	});
});
