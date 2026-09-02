import { describe, expect, it } from 'vitest';
import { TFile as MockTFile, type MetadataCache, type TFile, type Vault } from 'obsidian';
import { VaultChangeAdapter } from '../../../../src/infrastructure/persistence/index/VaultChangeAdapter';
import { InMemoryProjectIndex } from '../../../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { EchoWindow } from '../../../../src/infrastructure/persistence/index/EchoWindow';
import { observeFrontmatter } from '../../../../src/infrastructure/obsidian/repositories/digest';
import { createEventBus, type DomainEvent } from '../../../../src/core/events/EventBus';
import type {
	GeometrySidecarChanged,
	ProjectIndexEntryChanged,
} from '../../../../src/application/events/projectIndex.events';
import type { Logger } from '../../../../src/application/ports/Logger';

/**
 * The stat-collision residue's SECOND face, which is the pipeline rather than the read.
 *
 * `frontmatterOf`'s echo fallback is bounded by the file's own `mtime:size`, and
 * `EchoWindow.observedFileStat` records what that cannot see: an external write landing
 * within the clock's granularity of ours and leaving the byte size unchanged. The read
 * consequence is pinned in `noteIo.echo.test.ts`. This is the other one, and it does NOT
 * self-correct the way the read does.
 *
 * `VaultChangeAdapter.processNote` reads through `frontmatterOf` and then asks
 * `echo.matches` of the result — so inside the window the fallback hands back exactly the
 * value that comparison is against, and the event is suppressed as this plugin's own echo.
 * A read recovers the moment Obsidian's parse queue catches up; the INDEX does not, because
 * that path's one event has already been spent and nothing re-issues it.
 *
 * The fake vault the repository suites use cannot produce this: its mtime is a monotonic
 * counter, so every write moves the stat. The readings are built by hand here for that
 * reason.
 */

const OURS = { type: 'renovation-project', id: 'p1', revision: 2, name: 'Ours' };
const PRE_WRITE = { type: 'renovation-project', id: 'p1', revision: 1, name: 'Original' };
const PATH = 'Renovation/Project.md';

const noop = (): void => undefined;
const SILENT = { debug: noop, info: noop, warn: noop, error: noop } as unknown as Logger;

function fileWithStat(mtime: number, size: number): TFile {
	const file = new MockTFile();
	file.path = PATH;
	file.name = 'Project.md';
	file.basename = 'Project';
	file.extension = 'md';
	file.stat = { mtime, size, ctime: 0 };
	return file;
}

/** The adapter, over readings a real filesystem could produce but this suite's fake cannot. */
function wired(cacheShows: Record<string, unknown>, file: TFile, recordedStat: string) {
	const echo = new EchoWindow();
	echo.markFrontmatter(PATH, OURS, { reading: observeFrontmatter(PRE_WRITE), stat: recordedStat });

	const index = new InMemoryProjectIndex();
	const bus = createEventBus(() => undefined);
	const announced: string[] = [];
	bus.subscribe('ProjectIndexEntryChanged', (event: DomainEvent) => {
		// See `announcements.test.ts`: the real event type, not a hand-written payload shape.
		announced.push(String((event as ProjectIndexEntryChanged).payload.entityId));
	});
	const adapter = new VaultChangeAdapter({
		vault: { getAbstractFileByPath: () => file } as unknown as Vault,
		metadataCache: { getFileCache: () => ({ frontmatter: cacheShows }) } as unknown as MetadataCache,
		index,
		echo,
		events: bus,
		logger: SILENT,
		debounceMs: 0,
	});
	return { adapter, announced, index };
}

describe('an external edit arriving inside the echo window', () => {
	it('is applied when the file stat says the note is no longer the one we wrote', async () => {
		// Our write recorded 7:120; the external edit moved the file to 8:131.
		const { adapter, announced } = wired(PRE_WRITE, fileWithStat(8, 131), '7:120');

		adapter.onModify(fileWithStat(8, 131));
		// The bus delivers on a microtask, so a synchronous assertion here reads an empty
		// array in BOTH worlds — which is the contrast case proving nothing at all.
		await Promise.resolve();

		expect(announced).toEqual(['p1']);
	});

	/**
	 * **The residue, pinned as behaviour.** Same scene, except the external write collided
	 * with ours on both halves of the stat. `frontmatterOf` answers our own frontmatter, and
	 * `echo.matches` is then comparing that answer against itself, so the event is dropped —
	 * and unlike the read, nothing re-issues it. A build that closes the residue fails here
	 * rather than leaving the paragraphs in `noteIo.ts` and `EchoWindow.ts` quietly stale.
	 */
	it('is suppressed as our own echo when the external write collided on the file stat', async () => {
		const { adapter, announced, index } = wired(PRE_WRITE, fileWithStat(7, 120), '7:120');

		adapter.onModify(fileWithStat(7, 120));
		await Promise.resolve();

		expect(announced).toEqual([]);
		expect(index.getPath('p1' as never)).toBeUndefined();
	});
});

/**
 * The same residue at the SIDECAR door, which asks the identical question of an identical
 * reading — `EchoWindow.wroteFile` against the file's own `mtime:size` — and cannot be
 * driven from the repository suites for the same reason: their fake vault's mtime is a
 * monotonic counter, so every write there moves the stat and the collision is unreachable.
 *
 * That door has no `frontmatterOf` to fall back on and no cache in the question at all: a
 * `.rpgeo` is JSON in a file and digesting one means READING it, which this pipeline is
 * synchronous precisely to avoid. So `mtime:size` is not a bound on a fallback here, it IS
 * the whole test — which makes these three cases the complete account of what the sidecar
 * echo check can and cannot tell apart.
 */

const PLAN_ID = 'plan-1';
const SIDECAR = `Renovation/Geometry/${PLAN_ID}.rpgeo`;
const PLAN_NOTE = 'Renovation/Kitchen/Plans/Ground floor.md';

function sidecarFile(mtime: number, size: number): TFile {
	const file = new MockTFile();
	file.path = SIDECAR;
	file.name = `${PLAN_ID}.rpgeo`;
	file.basename = PLAN_ID;
	file.extension = 'rpgeo';
	file.stat = { mtime, size, ctime: 0 };
	return file;
}

/**
 * A vault holding one indexed plan and its sidecar, with `recordedStat` standing for what
 * the geometry store observed after its own last write — `undefined` for a path this plugin
 * marked without a reading.
 */
function wiredSidecar(file: TFile, ...writes: (string | undefined)[]) {
	const echo = new EchoWindow();
	// One `mark` per write this plugin made, in order — a rest parameter because the last
	// case below is about what a SECOND write does to the first one's reading.
	for (const recordedStat of writes) echo.mark(SIDECAR, 'what-this-plugin-wrote' as never, recordedStat);

	const index = new InMemoryProjectIndex();
	index.upsert({
		id: PLAN_ID as never,
		type: 'renovation-plan',
		path: PLAN_NOTE,
		geometrySidecarPath: SIDECAR,
	});
	const bus = createEventBus(() => undefined);
	const sidecars: string[] = [];
	bus.subscribe('GeometrySidecarChanged', (event: DomainEvent) => {
		sidecars.push(String((event as GeometrySidecarChanged).payload.entityId));
	});
	const adapter = new VaultChangeAdapter({
		vault: {
			getAbstractFileByPath: (path: string) => (path === SIDECAR ? file : null),
		} as unknown as Vault,
		metadataCache: { getFileCache: () => null } as unknown as MetadataCache,
		index,
		echo,
		events: bus,
		logger: SILENT,
		debounceMs: 0,
	});
	return { adapter, sidecars };
}

describe('an external edit to a sidecar this plugin has written', () => {
	it('is announced when the file stat says it is no longer the one we wrote', async () => {
		// Our write recorded 7:120; the external edit moved the file to 8:131. This is the
		// hand-built twin of the fake-vault case in `announcements.test.ts`, and it is here so
		// the residue below has a contrast built out of the same readings.
		const { adapter, sidecars } = wiredSidecar(sidecarFile(8, 131), '7:120');

		adapter.onModify(sidecarFile(8, 131));
		await Promise.resolve();

		expect(sidecars).toEqual([PLAN_ID]);
	});

	/** **The residue, pinned as behaviour** — the same one `observedFileStat` records. */
	it('is taken for our own echo when the external write collided on the file stat', async () => {
		const { adapter, sidecars } = wiredSidecar(sidecarFile(7, 120), '7:120');

		adapter.onModify(sidecarFile(7, 120));
		await Promise.resolve();

		expect(sidecars).toEqual([]);
	});

	/**
	 * **The absent-stat decision, and it fails in the direction that costs a re-read.** A path
	 * this plugin marked without a reading — a writer whose file lookup came back empty — is
	 * one it cannot vouch for, so the change is announced rather than swallowed. Over-answering
	 * "not ours" costs the leaf one redundant re-read of geometry it already has;
	 * over-answering "ours" is the permanent silence this whole guard was narrowed to end.
	 */
	it('is announced for a path this plugin marked without a stat at all', async () => {
		const { adapter, sidecars } = wiredSidecar(sidecarFile(7, 120), undefined);

		adapter.onModify(sidecarFile(7, 120));
		await Promise.resolve();

		expect(sidecars).toEqual([PLAN_ID]);
	});

	/**
	 * **A write that could not take a reading WITHDRAWS the previous one rather than leaving
	 * it standing**, which is the arm nothing else here reaches: every writer in `src/` passes
	 * `fileStatAt`, so the two-write sequence where the second lookup comes back empty has no
	 * producer in any other case. Measured — making `mark` keep the earlier stat instead of
	 * clearing it passed all 776 cases in `tests/infrastructure/`.
	 *
	 * It matters beyond this door: `observedFileStat` is what bounds `frontmatterOf`'s echo
	 * fallback for NOTES, and a reading kept past the write it describes is exactly the
	 * "vouches for bytes that are not ours" defect that guard exists to refuse.
	 */
	it('is announced when a later write of ours could take no reading at all', async () => {
		const { adapter, sidecars } = wiredSidecar(sidecarFile(7, 120), '7:120', undefined);

		adapter.onModify(sidecarFile(7, 120));
		await Promise.resolve();

		expect(sidecars).toEqual([PLAN_ID]);
	});
});
