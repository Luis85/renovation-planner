/**
 * @vitest-environment jsdom
 *
 * Task B3a: the designer's runtime, and the refresh nobody else performs.
 *
 * Without this, every write in this increment is invisible until the leaf is reopened — a
 * command writes the note or the sidecar, answers a `Result`, and nothing re-reads. Each case
 * below is a rule this repository has already paid for once:
 *
 * - a THROWN fault is not "nothing happened", so the read-back runs on a rejection too;
 * - a store two things hydrate needs a request ticket, or the slower earlier read wins and a
 *   just-written change vanishes with no error anywhere;
 * - a change reaches every leaf showing that subject, and the subscription that delivers it is
 *   released when the leaf closes, or the root's bus keeps a dead leaf's store alive and
 *   queries the vault from it forever;
 * - every dispatch is ultimately bound to a click handler that discards its promise.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, onMounted } from 'vue';
import { err, ok, type Result } from '../../../src/core/result/Result';
import { createEventBus } from '../../../src/core/events/EventBus';
import { createAssetDesignChangeSource } from '../../../src/application/events/assetDesignChangeSource';
import { assetDesignChanged } from '../../../src/domain/asset/Asset.events';
import { projectIndexRebuilt } from '../../../src/application/events/projectIndex.events';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import type { AssetDesignDto, AssetDesignError } from '../../../src/application/queries/GetAssetDesign';
import type { UndoableCommand } from '../../../src/presentation/editor/tools/undoable-command';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import {
	ASSET_DESIGNER_CONTEXT,
	type AssetDesignerContext,
} from '../../../src/presentation/designer/AssetDesignerContext';
import { provideDesignerRuntime, useDesignerRuntime, type DesignerRuntime } from '../../../src/presentation/designer/runtime';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { assetDesign } from '../../helpers/assetDesign';
import { installObsidianDom } from '../../helpers/dom';
import { emptyBackgroundVault } from '../../helpers/background';
import { installCanvas } from '../../helpers/canvas';
import { installResizeObserver } from '../../helpers/layout';
import { lines, recorder, resetRecorder } from '../../helpers/logger';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { Notice } from '../../helpers/obsidian-mock';

installObsidianDom();
/**
 * The two designer leaves below are REAL views since Task B4, so each mounts a Konva stage:
 * jsdom implements no 2D context and no `ResizeObserver`, and `EditorSurface` constructs the
 * second unconditionally at mount.
 */
installCanvas();
installResizeObserver();

const THE_ASSET = createAssetId();

/** A design distinguishable from the fixture's default, so a re-read is visible. */
const WITH_SHAPE = assetDesign({ assetId: THE_ASSET, height: 900 });
const AFTER_WRITE = assetDesign({ assetId: THE_ASSET, height: 1200 });

const VAULT_FAILED: AssetDesignError = {
	category: 'Persistence',
	code: 'vault.unexpected-failure',
	message: 'the vault could not be read',
};
const NOT_FOUND: AssetDesignError = {
	category: 'Reference',
	code: 'asset.not-found',
	message: `Asset ${THE_ASSET} not found.`,
};

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
	let settleWith!: (value: T) => void;
	const promise = new Promise<T>((resolve) => {
		settleWith = resolve;
	});
	return { promise, resolve: settleWith };
}

/** A command that reports what it did without touching a vault — the door under test is above it. */
function command(overrides: Partial<UndoableCommand> = {}): UndoableCommand {
	return {
		execute: () => Promise.resolve(ok<'wrote'>('wrote')),
		undo: () => Promise.resolve(ok<'wrote'>('wrote')),
		...overrides,
	};
}

interface Harness {
	readonly runtime: DesignerRuntime;
	readonly reads: string[];
	readonly unmount: () => void;
}

/**
 * The runtime in a component of its own rather than through `AssetDesignerRoot`: this file is
 * about the dispatcher and the store, and mounting the whole shell would make every assertion
 * here depend on what that shell happens to draw.
 */
function harness(options: {
	readonly answers?: () => Promise<Result<AssetDesignDto, AssetDesignError>>;
	readonly onDesignChanged?: AssetDesignerContext['onDesignChanged'];
	readonly indexScanCompleted?: () => boolean;
} = {}): Harness {
	const reads: string[] = [];
	const context: AssetDesignerContext = {
		assetId: THE_ASSET,
		queries: {
			getAssetDesign: (assetId) => {
				reads.push(assetId);
				return options.answers?.() ?? Promise.resolve(ok(WITH_SHAPE));
			},
		},
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		// This file is about the dispatcher and the store, not the picker — `null` here is
		// simply "unused by this suite's cases", never a claim about production.
		picker: null,
		vault: emptyBackgroundVault(),
		onDesignChanged: options.onDesignChanged ?? (() => () => undefined),
		indexScanCompleted: options.indexScanCompleted ?? ((): boolean => true),
	};

	let captured!: DesignerRuntime;
	const wrapper = mount(
		defineComponent({
			setup() {
				const runtime = provideDesignerRuntime(context);
				captured = runtime;
				// The mount read, exactly where `AssetDesignerRoot` performs it — a harness that
				// skipped it would leave every case below asserting against an `idle` store and
				// certify a runtime nothing had ever asked to load anything.
				onMounted(() => {
					void runtime.hydrate();
				});
				return () => h('div');
			},
		}),
		{ global: { plugins: [createPinia()], provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context } } },
	);
	return { runtime: captured, reads, unmount: () => wrapper.unmount() };
}

/**
 * A notice is INERT until something activates the queue — `onload` is what does that in
 * production, so a suite asserting on `Notice.shown` has to stand where the plugin stands. Per
 * TEST, and for a second reason: the queue DEDUPS, so two cases raising the identical sentence
 * would fold into one `(×2)` and construct no second `Notice` at all.
 */
beforeEach(() => {
	activateNotices();
});

afterEach(() => {
	resetRecorder();
	vi.restoreAllMocks();
});

describe('the read-back after a dispatch', () => {
	/**
	 * The whole reason this task exists: a command that wrote is invisible until something
	 * re-reads. Asserted on what the STORE holds rather than on a call count, because a build
	 * that re-read and threw the answer away would pass the count.
	 */
	it('re-reads the design after a successful dispatch, so the canvas shows what was written', async () => {
		let answer = WITH_SHAPE;
		const { runtime } = harness({ answers: () => Promise.resolve(ok(answer)) });
		await flushPromises();

		await runtime.dispatcher.run(
			command({
				execute: () => {
					answer = AFTER_WRITE;
					return Promise.resolve(ok<'wrote'>('wrote'));
				},
			}),
		);

		expect(useAssetDesignStore().design?.height).toBe(1200);
	});

	/**
	 * SDD §65 reserves throws for technical faults, and a write may well have landed before
	 * one — a repository's own post-write bookkeeping runs after the bytes are on disk. So the
	 * read-back runs on the rejection path too, and the fault still propagates unchanged.
	 */
	it('re-reads after a REJECTED dispatch too, because a write may have landed before the fault', async () => {
		const { runtime, reads } = harness();
		await flushPromises();
		reads.length = 0;

		await expect(
			runtime.dispatcher.run(command({ execute: () => Promise.reject(new Error('vault exploded')) })),
		).rejects.toThrow('vault exploded');

		expect(reads).toEqual([THE_ASSET]);
	});

	/**
	 * A REFUSAL wrote nothing, so there is nothing to read back. The contrast with the case
	 * above is what makes either mean anything: a decorator that re-read unconditionally passes
	 * the rejection case and costs a vault read per refused gesture.
	 */
	it('does not re-read after a refusal, which wrote nothing', async () => {
		const { runtime, reads } = harness();
		await flushPromises();
		reads.length = 0;

		await runtime.dispatcher.run(command({ execute: () => Promise.resolve(err(VAULT_FAILED)) }));

		expect(reads).toEqual([]);
	});

	/**
	 * A failed read-back must not blank a canvas over a write that SUCCEEDED — that replaces
	 * "possibly stale" with definitely nothing. The design stays, and `stale` is what says so.
	 */
	it('keeps the previous design when the read-back fails, and marks it stale', async () => {
		let answers: () => Promise<Result<AssetDesignDto, AssetDesignError>> = () => Promise.resolve(ok(WITH_SHAPE));
		const { runtime } = harness({ answers: () => answers() });
		await flushPromises();

		answers = () => Promise.resolve(err(VAULT_FAILED));
		await runtime.dispatcher.run(command());

		const store = useAssetDesignStore();
		expect(store.design?.height).toBe(900);
		expect(store.status).toBe('ready');
		expect(store.stale).toBe(true);
	});

	/**
	 * The save-state tracking sits OUTSIDE the refresh decorator, so `Saved` never appears while
	 * the surface still shows the pre-command state. Asserted as an ORDERING — what the store
	 * held at the moment the indicator settled — because both decorators run either way and a
	 * build that nested them the other way passes every other case in this file.
	 */
	it('settles the save indicator only once the re-read has landed', async () => {
		let answer = WITH_SHAPE;
		const { runtime } = harness({ answers: () => Promise.resolve(ok(answer)) });
		await flushPromises();
		const store = useAssetDesignStore();
		const saveState = useSaveStateStore();
		let heightWhenSaved: number | null = null;
		const settled = vi.spyOn(saveState, 'resolveOk').mockImplementation(() => {
			heightWhenSaved = store.design?.height ?? null;
		});

		await runtime.dispatcher.run(
			command({
				execute: () => {
					answer = AFTER_WRITE;
					return Promise.resolve(ok<'wrote'>('wrote'));
				},
			}),
		);

		expect(settled).toHaveBeenCalledTimes(1);
		expect(heightWhenSaved).toBe(1200);
	});

	/**
	 * The reactive mirror of `CommandHistory`'s flags. A dispatch that bypassed the wrapped
	 * dispatcher would leave both frozen at their mount values with nothing erroring.
	 */
	it('mirrors the undo and redo flags as the history moves', async () => {
		const { runtime } = harness();
		await flushPromises();
		expect(runtime.canUndo.value).toBe(false);

		await runtime.dispatcher.run(command());
		expect(runtime.canUndo.value).toBe(true);
		expect(runtime.canRedo.value).toBe(false);

		await runtime.dispatcher.undo();
		expect(runtime.canUndo.value).toBe(false);
		expect(runtime.canRedo.value).toBe(true);
	});
});

describe('a refresh a PEER leaf provoked', () => {
	/**
	 * A cross-leaf refresh has content on screen to keep, exactly as the post-command read-back
	 * does — whether WE made the write or a peer leaf did is not a difference the user's canvas
	 * can tell. The subscription took `hydrate`, whose failure arm BLANKS the design, so a
	 * transient read failure after a peer's edit replaced a valid canvas with the failure panel.
	 *
	 * BOTH halves are asserted. "The design is still on screen" alone passes against a build
	 * that keeps it and never raises the warning, which would be a canvas quietly drawing the
	 * pre-edit design as though it were current.
	 *
	 * The opposite over-correction — every failure made survivable — is held by
	 * 'fails once the scan has run, even though the same read missed before it' above, whose
	 * leaf is not `'ready'` and therefore still falls through to `fail`. Not restated here: a
	 * second case asserting what that one already asserts discriminates nothing.
	 */
	it('keeps the design on screen when a peer-provoked re-read fails, and marks it stale', async () => {
		const bus = createEventBus(() => undefined);
		let answers: () => Promise<Result<AssetDesignDto, AssetDesignError>> = () => Promise.resolve(ok(WITH_SHAPE));
		harness({
			answers: () => answers(),
			onDesignChanged: (listener) => createAssetDesignChangeSource(bus)(THE_ASSET, listener),
		});
		await flushPromises();
		expect(useAssetDesignStore().status).toBe('ready');

		answers = () => Promise.resolve(err(VAULT_FAILED));
		await bus.publish(assetDesignChanged({ assetId: THE_ASSET }));
		await flushPromises();

		const store = useAssetDesignStore();
		expect(store.design?.height).toBe(900);
		expect(store.status).toBe('ready');
		expect(store.stale).toBe(true);
	});

	/**
	 * And keep-previous covers a read that FAILED, never one that ANSWERED. Its whole argument
	 * is that blanking replaces "possibly stale" with definitely nothing over data the vault
	 * HAS — and an authoritative `asset.not-found` is exactly the case where the vault does not
	 * have it. A design left on screen there is a canvas the user goes on drawing on while every
	 * write refuses.
	 *
	 * The pairing with the case above is the point: neither alone discriminates. A build that
	 * blanks on every failure passes this one, and a build that keeps on every failure passes
	 * that one.
	 */
	it('fails rather than keeping the design of an asset the vault no longer has', async () => {
		const bus = createEventBus(() => undefined);
		let answers: () => Promise<Result<AssetDesignDto, AssetDesignError>> = () => Promise.resolve(ok(WITH_SHAPE));
		harness({
			answers: () => answers(),
			onDesignChanged: (listener) => createAssetDesignChangeSource(bus)(THE_ASSET, listener),
		});
		await flushPromises();

		answers = () => Promise.resolve(err(NOT_FOUND));
		await bus.publish(assetDesignChanged({ assetId: THE_ASSET }));
		await flushPromises();

		const store = useAssetDesignStore();
		expect(store.status).toBe('failed');
		expect(store.design).toBeNull();
	});
});

describe('two reads in flight at once', () => {
	/**
	 * The plan's own case: a store two things hydrate needs a request ticket, or the slower
	 * EARLIER read lands on top of the faster later one and a just-written change vanishes with
	 * no error anywhere.
	 */
	it('keeps the LATEST read when two hydrations overlap', async () => {
		const slow = deferred<Result<AssetDesignDto, AssetDesignError>>();
		const fast = deferred<Result<AssetDesignDto, AssetDesignError>>();
		// Queued only after the MOUNT read has taken the default answer, so the two deferreds
		// really are the two overlapping reads this case is about.
		const queue: Promise<Result<AssetDesignDto, AssetDesignError>>[] = [];
		const { runtime } = harness({ answers: () => queue.shift() ?? Promise.resolve(ok(WITH_SHAPE)) });
		await flushPromises();
		queue.push(slow.promise, fast.promise);

		const first = runtime.hydrate();
		const second = runtime.hydrate();
		fast.resolve(ok(AFTER_WRITE));
		slow.resolve(ok(WITH_SHAPE));
		await Promise.all([first, second]);

		expect(useAssetDesignStore().design?.height).toBe(1200);
	});

	/**
	 * The same race, reached the way a USER reaches it: the failure state's retry button stays
	 * mounted while its read is in flight, so two presses issue two reads. This is the caller
	 * the plan's own sketch does not exercise.
	 *
	 * **The FAILURE arm needs the ticket as much as the success arm**, which is the half a
	 * naive guard misses: a superseded read that REFUSES must not write `error` either, or a
	 * stale failure clears a design that is valid and puts the failure panel back over it.
	 */
	it('lets a superseded read neither replace a newer design nor fail over it', async () => {
		const slowFailure = deferred<Result<AssetDesignDto, AssetDesignError>>();
		const fastSuccess = deferred<Result<AssetDesignDto, AssetDesignError>>();
		const queue: Promise<Result<AssetDesignDto, AssetDesignError>>[] = [];
		const { runtime } = harness({ answers: () => queue.shift() ?? Promise.resolve(ok(WITH_SHAPE)) });
		await flushPromises();
		queue.push(slowFailure.promise, fastSuccess.promise);

		const first = runtime.hydrate();
		const second = runtime.hydrate();
		fastSuccess.resolve(ok(AFTER_WRITE));
		slowFailure.resolve(err(VAULT_FAILED));
		await Promise.all([first, second]);

		const store = useAssetDesignStore();
		expect(store.design?.height).toBe(1200);
		expect(store.status).toBe('ready');
		expect(store.error).toBeNull();
	});
});

describe('a leaf restored before the index scan has run', () => {
	/**
	 * Obsidian restores its leaves BEFORE `onLayoutReady`, and the vault scan runs from it — so
	 * the read at mount resolves the asset id against an EMPTY index and `GetAssetDesign`
	 * refuses with `asset.not-found`. Calling that authoritative would put a failure screen over
	 * an asset whose note is sitting on disk.
	 */
	it('holds its loading line rather than calling a pre-scan miss a failure', async () => {
		harness({ answers: () => Promise.resolve(err(NOT_FOUND)), indexScanCompleted: () => false });
		await flushPromises();

		const store = useAssetDesignStore();
		expect(store.status).toBe('loading');
		expect(store.error).toBeNull();
	});

	/**
	 * And it recovers, which is the other half: the two together are the SEQUENCE. Fixing only
	 * the hold leaves a leaf that never draws; fixing only the recovery leaves a false failure
	 * screen flashing on every restore.
	 */
	it('draws the design once the rebuild lands', async () => {
		const bus = createEventBus(() => undefined);
		let scanned = false;
		harness({
			answers: () => Promise.resolve(scanned ? ok(WITH_SHAPE) : err(NOT_FOUND)),
			indexScanCompleted: () => scanned,
			onDesignChanged: (listener) => createAssetDesignChangeSource(bus)(THE_ASSET, listener),
		});
		await flushPromises();
		expect(useAssetDesignStore().design).toBeNull();

		scanned = true;
		await bus.publish(projectIndexRebuilt());
		await flushPromises();

		expect(useAssetDesignStore().design?.height).toBe(900);
	});

	/**
	 * A miss AFTER the scan is authoritative and must still fail — otherwise the hold above is a
	 * leaf that loads forever on an asset somebody deleted, and no test could tell the two
	 * builds apart.
	 */
	it('still fails on a miss once the scan has run', async () => {
		harness({ answers: () => Promise.resolve(err(NOT_FOUND)), indexScanCompleted: () => true });
		await flushPromises();

		expect(useAssetDesignStore().status).toBe('failed');
	});

	/**
	 * The hold EXPIRES, which is what makes `indexScanCompleted` a question asked per read
	 * rather than a value captured at mount. A leaf restored onto an asset somebody deleted
	 * while Obsidian was closed misses before the scan and misses after it, and only the second
	 * miss is authoritative — a runtime holding a snapshotted `false` would decline both and
	 * load forever, with the rebuild it is waiting for having already arrived.
	 */
	it('fails once the scan has run, even though the same read missed before it', async () => {
		const bus = createEventBus(() => undefined);
		let scanned = false;
		harness({
			answers: () => Promise.resolve(err(NOT_FOUND)),
			indexScanCompleted: () => scanned,
			onDesignChanged: (listener) => createAssetDesignChangeSource(bus)(THE_ASSET, listener),
		});
		await flushPromises();
		expect(useAssetDesignStore().status).toBe('loading');

		scanned = true;
		await bus.publish(projectIndexRebuilt());
		await flushPromises();

		expect(useAssetDesignStore().status).toBe('failed');
	});

	/**
	 * The hold is narrowed to the ONE refusal an empty index can produce. A vault that could not
	 * be READ is a genuine failure whenever it happens, and holding the loading line over it
	 * would hide a real fault behind a spinner until the scan runs.
	 */
	it('does not hold the line for a vault failure, which the scan says nothing about', async () => {
		harness({ answers: () => Promise.resolve(err(VAULT_FAILED)), indexScanCompleted: () => false });
		await flushPromises();

		expect(useAssetDesignStore().status).toBe('failed');
	});
});

describe('a fault on a dispatch bound to a click', () => {
	/**
	 * Every dispatch here is ultimately bound to a click handler, and a Vue click handler
	 * discards the promise it is handed — so without a last stop a fault is an unhandled
	 * rejection reaching nobody and the button silently stops working.
	 *
	 * BOTH representations, because that is what SDD §66 asks for and what a mapped fault owes:
	 * the raw cause LOGGED under this door's own event name, and the mapped sentence shown.
	 */
	it('reports a fault on undo, on both channels, rather than rejecting into nobody', async () => {
		const { runtime } = harness();
		await flushPromises();
		await runtime.dispatcher.run(command({ undo: () => Promise.reject(new Error('vault exploded')) }));
		const before = Notice.shown.length;

		await expect(runtime.undo()).resolves.toBeUndefined();

		expect(lines.filter((line) => line.event === 'designer.dispatch.faulted')).toHaveLength(1);
		expect(Notice.shown).toHaveLength(before + 1);
		// The raw exception text never reaches the user; the mapped sentence does, and the cause
		// is in the log line above.
		expect(Notice.shown.at(-1)).not.toContain('vault exploded');
	});

	/**
	 * `CommandHistory` deliberately leaves a REFUSED undo on its stack rather than popping it,
	 * so without this the button stays enabled, does nothing, and says nothing about why.
	 */
	it('reports a resolved refusal on undo, which no stack movement announces', async () => {
		const { runtime } = harness();
		await flushPromises();
		await runtime.dispatcher.run(command({ undo: () => Promise.resolve(err(NOT_FOUND)) }));
		const before = Notice.shown.length;

		await runtime.undo();

		expect(Notice.shown).toHaveLength(before + 1);
		// A REFUSAL is not a fault: nothing is logged under the fault door's event name, which is
		// what keeps a log line able to say which of the two happened.
		expect(lines.filter((line) => line.event === 'designer.dispatch.faulted')).toEqual([]);
	});

	/**
	 * And a refusal the SAVE INDICATOR is already carrying does NOT also raise a toast — slice
	 * 17's rule, inherited here by dispatching through the same `reportDispatchFailure`. One
	 * failure through two widgets that can drift apart is the reconciliation that slice's
	 * Definition of Done forbids by name, and `withSaveStateTracking` is what already has this
	 * one: `vault.unexpected-failure` is a write-boundary code, so the badge says it.
	 */
	it('leaves a write-boundary refusal to the indicator rather than toasting it twice', async () => {
		const { runtime } = harness();
		await flushPromises();
		await runtime.dispatcher.run(command({ undo: () => Promise.resolve(err(VAULT_FAILED)) }));
		const before = Notice.shown.length;

		await runtime.undo();

		expect(Notice.shown).toHaveLength(before);
		expect(useSaveStateStore().state).toBe('save-error');
	});

	/**
	 * And a SUCCESSFUL redo says nothing at all, which is the contrast that makes the case above
	 * mean something: a door that notified unconditionally would pass it.
	 */
	it('says nothing when a redo succeeds', async () => {
		const { runtime } = harness();
		await flushPromises();
		await runtime.dispatcher.run(command());
		await runtime.dispatcher.undo();
		const before = Notice.shown.length;

		await runtime.redo();

		expect(Notice.shown).toHaveLength(before);
	});
});

describe('reaching the runtime from a region', () => {
	/**
	 * Mirrors `useAssetDesignerContext`'s and `useEditorRuntime`'s guard: a toolbar or inspector
	 * mounted outside the designer's own tree has no dispatcher, and answering `undefined` would
	 * leave it drawing controls that quietly do nothing.
	 */
	it('throws rather than handing a region a runtime that is not there', () => {
		expect(() => useDesignerRuntime()).toThrow(/DesignerRuntime/);
	});

	/**
	 * And a region INSIDE the tree gets the leaf's own object — the same one, not a second
	 * history beside it, which is what "one wrapped dispatcher per leaf" means in practice.
	 */
	it('hands a child the very runtime the root provided', () => {
		const context: AssetDesignerContext = {
			assetId: THE_ASSET,
			queries: { getAssetDesign: () => Promise.resolve(ok(WITH_SHAPE)) },
			commands: unavailableAssetDesignerCommands(),
			logger: recorder,
			picker: null,
			vault: emptyBackgroundVault(),
			onDesignChanged: () => () => undefined,
			indexScanCompleted: () => true,
		};
		let provided!: DesignerRuntime;
		let injected!: DesignerRuntime;
		const child = defineComponent({
			setup() {
				injected = useDesignerRuntime();
				return () => h('span');
			},
		});

		mount(
			defineComponent({
				setup() {
					provided = provideDesignerRuntime(context);
					return () => h(child);
				},
			}),
			{ global: { plugins: [createPinia()], provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context } } },
		);

		expect(injected).toBe(provided);
	});
});
