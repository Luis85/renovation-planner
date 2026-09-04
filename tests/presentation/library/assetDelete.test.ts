/**
 * @vitest-environment jsdom
 *
 * §3.5 item 4's `Delete`: the resolution it goes through, and where focus lands after it.
 *
 * **Mounted into `document.body`, for `assetLibraryKeyboard.test.ts`'s reason** — `focus()` on
 * a detached element does nothing at all, so a focus rule driven off the document is the only
 * one that can be wrong here.
 *
 * **The dialogs are driven through their own MARKUP** (`[data-rp-action]`, `.rp-dialog-candidate`)
 * rather than by calling `dialogStore.resolve` from the test. That costs nothing and buys the
 * one thing a store call cannot model: `DialogHost` restores focus to whatever opened the dialog
 * on the way out, which lands on the `Delete` button and is exactly what §3.5's focus rule has to
 * win against. A case that settled the promise directly would pass over a build whose focus
 * never survived the restore.
 *
 * **`listCatalogue` reads a LIVE array the fake command splices**, so the re-read after a
 * successful delete really loses the row. A fixed listing would leave every focus case asserting
 * against a list that still holds the deleted asset, which is a different program.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VueWrapper } from '@vue/test-utils';
import { ok, err } from '../../../src/core/result/Result';
import { createAssetId, type AssetId } from '../../../src/domain/asset/AssetId';
import type { ProjectId } from '../../../src/domain/project/ProjectId';
import type { RequirementId } from '../../../src/domain/requirement/RequirementId';
import type { CatalogueEntryDto } from '../../../src/application/queries/ListCatalogueEntries';
import type { ReferencingGroup } from '../../../src/application/queries/ListRequirementsReferencing';
import type { ReassignmentTargetDto } from '../../../src/application/queries/reassignmentTypes';
import type { DeleteAssetInput } from '../../../src/application/commands/asset/DeleteAsset';
import type { ResolvedSequence } from '../../../src/application/reference/deleteResolution';
import type { AssetLibraryQueryServices } from '../../../src/presentation/read-models/assetLibraryQueries';
import { assetDesign } from '../../helpers/assetDesign';
import { Notice } from '../../helpers/obsidian-mock';
import { activateNotices, disposeNotices } from '../../../src/presentation/notices/notify';
import { lines, resetRecorder } from '../../helpers/logger';
import { installObsidianDom } from '../../helpers/dom';
import { en } from '../../../src/presentation/i18n/locales/en';
import { settle } from '../../helpers/async';
import { anEntry, mountRoot } from '../../helpers/assetLibraryRootHarness';
import { installNarrowComposition } from './narrowComposition';

installObsidianDom();

const mounted: VueWrapper[] = [];
const installed: HTMLStyleElement[] = [];
// A notice is INERT until something activates the queue — `onload` is what does that in
// production, and a bare mount has no plugin. Activated and disposed PER TEST, for
// `inspectorFaults.test.ts`'s reason: the queue dedups on the (severity, message) pair, so a
// shared queue would fold a second identical sentence into a `(×2)` and construct no `Notice`.
beforeEach(() => {
	activateNotices();
	resetRecorder();
});
afterEach(() => {
	for (const wrapper of mounted.splice(0)) wrapper.unmount();
	for (const style of installed.splice(0)) style.remove();
	disposeNotices();
	Notice.shown.length = 0;
});

/** §7's third rung, from the shipped sheet — see `./narrowComposition.ts`. */
function narrow(): void {
	installed.push(installNarrowComposition());
}

const KITCHEN = 'project-kitchen' as ProjectId;
const REQ = 'requirement-01' as RequirementId;

const GROUP: ReferencingGroup = {
	projectId: KITCHEN,
	projectName: 'Kitchen refit',
	requirementIds: [REQ],
};

/** What a successful delete answers — the shape `runDeleteResolution` really returns. */
const SEQUENCE: ResolvedSequence = { deletedId: 'asset-gone', affectedBefore: [], affectedAfter: [] };

interface Options {
	readonly entries: readonly CatalogueEntryDto[];
	readonly referents?: readonly ReferencingGroup[];
	readonly targets?: readonly ReassignmentTargetDto[];
	/** Refuse the delete with this code rather than performing it. */
	readonly refuseWith?: string;
	/**
	 * THROW out of the referent read rather than refusing — SDD §65's other half, which a
	 * `Result` cannot carry and which the detached binding would otherwise swallow whole.
	 *
	 * Applied from the SECOND call onward, never the first, and that is the fixture modelling
	 * the real thing rather than a convenience: `AssetSelectionStore.select` runs this same
	 * door on selection, so a fixture that threw for every call would fault the PANEL's read
	 * too — which reaches `Delete` before this flow does, leaves `canDelete` false, and tests a
	 * gesture no user could have made. Faulting the flow's own read is the case.
	 */
	readonly faultWith?: Error;
	/** Refuse only the FIRST dispatch with this code — slice 10's stale-read path. */
	readonly refuseFirstWith?: string;
	/**
	 * Referents that appear only once the first dispatch has been refused — the vault moving
	 * under the user, which is the whole subject of the zero branch's re-read.
	 */
	readonly appearAfterRefusal?: readonly ReferencingGroup[];
}

/**
 * The mounted surface plus the two things a case asserts on: what the command was asked, and
 * what the search field is.
 */
async function library(options: Options) {
	const live = [...options.entries];
	const dispatched: DeleteAssetInput[] = [];
	let referents = options.referents ?? [];
	let reads = 0;
	const queries: AssetLibraryQueryServices = {
		listCatalogue: () => Promise.resolve(ok({ entries: [...live], unreadable: [] })),
		listOutlines: (assetIds) =>
			Promise.resolve(new Map(assetIds.map((assetId) => [assetId, { kind: 'none' as const }]))),
		getDesign: (assetId) => Promise.resolve(ok(assetDesign({ assetId }))),
		listReferencing: vi.fn<AssetLibraryQueryServices['listReferencing']>(() => {
			reads += 1;
			if (options.faultWith !== undefined && reads > 1) return Promise.reject(options.faultWith);
			return Promise.resolve(ok(referents));
		}),
		listOverridingProjects: () => Promise.resolve(ok([])),
		listReassignmentTargets: () => Promise.resolve(ok(options.targets ?? [])),
	};
	const deleteAsset = {
		execute: (input: DeleteAssetInput) => {
			dispatched.push(input);
			const code =
				dispatched.length === 1 ? (options.refuseFirstWith ?? options.refuseWith) : options.refuseWith;
			if (code !== undefined) {
				if (options.appearAfterRefusal !== undefined) referents = options.appearAfterRefusal;
				return Promise.resolve(err({ category: 'Reference' as const, code, message: 'refused' }));
			}
			const at = live.findIndex((entry) => entry.assetId === input.assetId);
			if (at !== -1) live.splice(at, 1);
			referents = [];
			return Promise.resolve(ok(SEQUENCE));
		},
	};
	const root = await mountRoot({ queries, commands: { deleteAsset }, attach: true });
	mounted.push(root);
	return {
		root,
		dispatched,
		listReferencing: queries.listReferencing,
		search: root.get('.rp-al-search__input').element as HTMLElement,
		async select(assetId: AssetId): Promise<void> {
			await root.get(`[data-asset-id="${assetId}"]`).trigger('click');
			await settle();
		},
		async pressDelete(): Promise<void> {
			await root.get('.rp-al-action--delete').trigger('click');
			await settle();
		},
		/**
		 * A press that does NOT let the gesture finish — `trigger` awaits Vue's own scheduler
		 * and nothing else, so the handler is left suspended at its first `await`. That window
		 * is the whole subject of the re-entrancy cases: it is where a real second click lands,
		 * and where the background is not yet `inert` because no dialog has opened.
		 */
		pressDeleteWithoutWaiting(): Promise<void> {
			return root.get('.rp-al-action--delete').trigger('click');
		},
	};
}

function shelf(category: string, names: readonly string[]): readonly CatalogueEntryDto[] {
	return names.map((name) => anEntry({ assetId: createAssetId(), category, name }));
}

const active = (): Element | null => document.activeElement;

async function open(root: VueWrapper, category: string): Promise<void> {
	const label = category === 'material' ? 'Material' : 'Furniture';
	const head = root.findAll('button.rp-al-shelf__head').find((el) => el.text().includes(label));
	await head?.trigger('click');
	await settle();
}

describe("§3.5's Delete and the resolution behind it", () => {
	/**
	 * §3.5: *"the Used in section the user is already looking at is literally the read that flow
	 * performs"*. Asserted as *no SECOND query* rather than as *one call*, which is the honest
	 * reading: the panel's own selection read is one call and the flow's is another, both through
	 * `listReferencing`. What the spec forbids is a second DOOR — a query of the flow's own that
	 * could answer differently about the same asset — and the count above one is what would say
	 * the panel and the dialog had been told different things.
	 */
	it('resolves referents through the Used in read rather than a second one', async () => {
		const entries = shelf('material', ['Alder plank']);
		const lib = await library({ entries, referents: [GROUP] });
		await lib.select(entries[0]?.assetId as AssetId);
		await lib.pressDelete();

		expect(lib.root.get('.rp-dialog-reference-row').text()).toContain('Kitchen refit');
		await lib.root.get('[data-rp-action="remove-references"]').trigger('click');
		await settle();

		expect(lib.dispatched).toEqual([
			{
				assetId: entries[0]?.assetId,
				resolution: 'remove-references',
				resolvedReferents: [REQ],
			},
		]);
		// Every referent read on this surface went through the one door the panel already holds.
		expect(vi.mocked(lib.listReferencing).mock.calls.map(([id]) => id)).toEqual([
			entries[0]?.assetId,
			entries[0]?.assetId,
		]);
	});

	/**
	 * Slice 10's rule, verbatim: a zero count dispatches the ABSENT-resolution form rather than a
	 * `delete-anyway` the user was never offered. Asserted on the command INPUT and never on
	 * "no dialog opened", because a caller sending `delete-anyway` straight through opens no
	 * dialog either.
	 */
	it('dispatches the absent-resolution form when the count is zero', async () => {
		const entries = shelf('material', ['Alder plank']);
		const lib = await library({ entries, referents: [] });
		await lib.select(entries[0]?.assetId as AssetId);
		await lib.pressDelete();

		expect(lib.dispatched).toEqual([{ assetId: entries[0]?.assetId }]);
		expect(Object.keys(lib.dispatched[0] ?? {})).toEqual(['assetId']);
	});

	/**
	 * The zero branch's other half: the command refuses because a referent appeared between the
	 * read and the dispatch, so the flow re-reads and asks after all rather than treating the
	 * stale zero as consent.
	 */
	it('asks after all when the command refuses a zero-referent delete as stale', async () => {
		const entries = shelf('material', ['Alder plank']);
		const lib = await library({
			entries,
			referents: [],
			refuseFirstWith: 'reference.referents-exist',
			appearAfterRefusal: [GROUP],
		});
		await lib.select(entries[0]?.assetId as AssetId);
		// The read answered zero, so the bare form goes out first; the command refuses it as
		// stale, the flow re-reads, and only then is the user asked.
		await lib.pressDelete();
		await lib.root.get('[data-rp-action="delete-anyway"]').trigger('click');
		await settle();

		expect(lib.dispatched.map((input) => input.resolution)).toEqual([undefined, 'delete-anyway']);
	});

	/** The reassign branch, and the one door `AssetLibraryQueryServices` had no member for. */
	it('reassigns to a target the picker offered', async () => {
		const entries = shelf('material', ['Alder plank', 'Birch plank']);
		const other = entries[1]?.assetId as AssetId;
		const lib = await library({
			entries,
			referents: [GROUP],
			targets: [{ id: other, label: 'Birch plank' }],
		});
		await lib.select(entries[0]?.assetId as AssetId);
		await lib.pressDelete();
		await lib.root.get('[data-rp-action="reassign"]').trigger('click');
		await settle();
		await lib.root.get('.rp-dialog-candidate').trigger('click');
		await settle();

		expect(lib.dispatched).toEqual([
			{
				assetId: entries[0]?.assetId,
				resolution: 'reassign',
				reassignTo: other,
				resolvedReferents: [REQ],
			},
		]);
	});

	/**
	 * A vault with one area-kind asset has nothing to reassign to, so the picker is REPORTED
	 * rather than opened — a dialog whose only action is Cancel is a dead end presented as a
	 * choice. Its code is the library's own: the zone flow's names a project, and an asset's
	 * alternatives are bounded by the vault.
	 */
	it('reports its own no-target refusal rather than opening an empty picker', async () => {
		const entries = shelf('material', ['Alder plank']);
		const lib = await library({ entries, referents: [GROUP], targets: [] });
		await lib.select(entries[0]?.assetId as AssetId);
		await lib.pressDelete();
		await lib.root.get('[data-rp-action="reassign"]').trigger('click');
		await settle();

		expect(lib.root.find('.rp-dialog-candidates').exists()).toBe(false);
		expect(lib.dispatched).toEqual([]);
		// The library's OWN sentence, not the zone flow's — asserted on the text rather than on
		// the code, because the code is only worth minting if a user reads a different sentence
		// for it. The zone one names a project; this one names the vault.
		expect(Notice.shown.join(' ')).toContain(en['reference.no-reassignment-asset']);
		// The asset is still there: a reported refusal is not a deletion.
		expect(lib.root.find(`[data-asset-id="${entries[0]?.assetId ?? ''}"]`).exists()).toBe(true);
	});

	/** Cancel is neither a success nor a failure: nothing is dispatched and nothing is deselected. */
	it('leaves the asset selected when the user cancels the resolution', async () => {
		const entries = shelf('material', ['Alder plank']);
		const lib = await library({ entries, referents: [GROUP] });
		await lib.select(entries[0]?.assetId as AssetId);
		await lib.pressDelete();
		await lib.root.get('[data-rp-action="cancel"]').trigger('click');
		await settle();

		expect(lib.dispatched).toEqual([]);
		expect(lib.root.attributes('data-selected-asset-id')).toBe(entries[0]?.assetId);
	});
});

/**
 * SDD §65's FAULT half at a DETACHED door, and the re-entrancy the same window admits.
 *
 * The binding is `@delete="(id) => void onDelete(id)"`, so the promise is discarded and Vue's
 * own error handling never sees a rejection: without the handler's own `try`/`catch` a thrown
 * fault on the destructive gesture reaches neither channel. Both are asserted TOGETHER in the
 * first case, because "a notice appeared" is equally true of a build that printed and logged
 * nothing, and a log line alone is equally true of one that told the user nothing.
 */
describe("§3.5's Delete at a detached door", () => {
	it('maps, logs and announces a THROWN fault rather than discarding it', async () => {
		const entries = shelf('material', ['Alder plank']);
		const lib = await library({ entries, faultWith: new Error('the vault exploded') });
		await lib.select(entries[0]?.assetId as AssetId);
		await lib.pressDelete();

		expect(lines.map((line) => line.event)).toContain('library.deleteAsset.faulted');
		// The MAPPED sentence, never the cause's own text — `NOTICE_TEXT_BAN`'s rule holding at
		// the one door that had no guard at all until now.
		expect(Notice.shown.join(' ')).toContain(en['vault.unexpected-failure']);
		expect(Notice.shown.join(' ')).not.toContain('the vault exploded');
	});

	/**
	 * A referenced asset: the first press awaits the usage read before it opens anything, so a
	 * second press inside that window finds no dialog to be behind and no `inert` background.
	 * Ungated it reaches `openDialog` twice and `DialogStackingError` is thrown into a promise
	 * nothing holds.
	 */
	it('drops a second press that lands while the first is still reading', async () => {
		const entries = shelf('material', ['Alder plank']);
		const lib = await library({ entries, referents: [GROUP] });
		await lib.select(entries[0]?.assetId as AssetId);

		await lib.pressDeleteWithoutWaiting();
		await lib.pressDeleteWithoutWaiting();
		await settle();

		expect(lib.root.findAll('.rp-dialog-references')).toHaveLength(1);
		expect(lines.map((line) => line.event)).not.toContain('library.deleteAsset.faulted');
	});

	/**
	 * And the referent-FREE asset, which is the worse of the two because no dialog opens at all:
	 * ungated, both presses dispatch, and the second reports *"no longer there"* about a
	 * deletion that had just succeeded. Asserted on the DISPATCH count, because the toast count
	 * cannot discriminate — slice 13's queue folds an identical message into a `(×N)` suffix.
	 */
	it('dispatches once when a referent-free delete is pressed twice', async () => {
		const entries = shelf('material', ['Alder plank']);
		const lib = await library({ entries, referents: [] });
		await lib.select(entries[0]?.assetId as AssetId);

		await lib.pressDeleteWithoutWaiting();
		await lib.pressDeleteWithoutWaiting();
		await settle();

		expect(lib.dispatched).toHaveLength(1);
	});

	/** The guard RELEASES: a second deletion in the same session is an ordinary gesture. */
	it('releases the guard so a later deletion still runs', async () => {
		const entries = shelf('material', ['Alder plank', 'Birch plank']);
		const lib = await library({ entries, referents: [] });
		await lib.select(entries[0]?.assetId as AssetId);
		await lib.pressDelete();
		await lib.select(entries[1]?.assetId as AssetId);
		await lib.pressDelete();

		expect(lib.dispatched.map((input) => input.assetId)).toEqual([
			entries[0]?.assetId,
			entries[1]?.assetId,
		]);
	});
});

describe("§3.5's post-deletion focus rule", () => {
	/**
	 * The MIDDLE row, which is the case a build that always focuses the first surviving row
	 * passes anyway — hence its sibling below, which deletes the LAST and asserts a different
	 * target. Neither case alone can tell the rule from that build.
	 */
	it('moves focus to the row now occupying the deleted row index', async () => {
		const entries = shelf('material', ['Alder plank', 'Birch plank', 'Cedar plank']);
		const lib = await library({ entries, referents: [] });
		await open(lib.root, 'material');
		await lib.select(entries[1]?.assetId as AssetId);
		await lib.pressDelete();

		expect((active() as HTMLElement | null)?.dataset['assetId']).toBe(entries[2]?.assetId);
	});

	it('moves focus to the previous surviving row when the deleted one was last', async () => {
		const entries = shelf('material', ['Alder plank', 'Birch plank', 'Cedar plank']);
		const lib = await library({ entries, referents: [] });
		await open(lib.root, 'material');
		await lib.select(entries[2]?.assetId as AssetId);
		await lib.pressDelete();

		expect((active() as HTMLElement | null)?.dataset['assetId']).toBe(entries[1]?.assetId);
	});

	/**
	 * §6.1 replaces every shelf with one flat *Results* list while a search runs, so the rule has
	 * to be about the list the row was actually drawn into. Same deleted-index-then-previous
	 * chain, different list — and it is one code path rather than two, because both lists are the
	 * same `.rp-al-rows` element.
	 */
	it('applies the same rule inside the flat Results list while a search is running', async () => {
		const entries = shelf('material', ['Alder plank', 'Birch plank', 'Cedar plank']);
		const lib = await library({ entries, referents: [] });
		await lib.root.get('.rp-al-search__input').setValue('plank');
		await settle();
		// The MIDDLE row, for the reason the shelf cases split into two: deleting the first
		// leaves "the row at the deleted index" and "the first surviving row" the same answer,
		// so that spelling cannot tell the rule from a build that always focuses the first.
		await lib.select(entries[1]?.assetId as AssetId);
		await lib.pressDelete();

		expect((active() as HTMLElement | null)?.dataset['assetId']).toBe(entries[2]?.assetId);
	});

	/**
	 * §3.5: the search field is *"every remaining case rather than a rare one"* — here the list
	 * the deleted row was in has emptied, so there is neither a row at the index nor one before
	 * it.
	 */
	it('moves focus to the search field when the list empties', async () => {
		// A second CATEGORY, so the catalogue is not empty and §4's `noAssets` state does not
		// replace the shelves region wholesale — the case is about a shelf that has emptied,
		// not about a library that has.
		const entries = [...shelf('material', ['Alder plank']), ...shelf('furniture', ['Sofa'])];
		const lib = await library({ entries, referents: [] });
		await open(lib.root, 'material');
		await lib.select(entries[0]?.assetId as AssetId);
		await lib.pressDelete();

		expect(active()).toBe(lib.search);
	});

	/**
	 * §3.5 REMOVED the shelf heading from this chain because it could never receive focus in the
	 * one case that reaches it: the heading is a candidate only once the deleted asset was the
	 * shelf's last row, and precisely then §3.2 renders the shelf as a non-interactive `<h3>`.
	 *
	 * Asserted as *the heading is present and is not the focused thing*, because the weaker
	 * spelling — that focus is on the search field — is equally true of a build that tried the
	 * heading and failed silently, which is the defect the removal was about.
	 */
	it('never moves focus to a shelf heading', async () => {
		const entries = [...shelf('material', ['Alder plank']), ...shelf('furniture', ['Sofa'])];
		const lib = await library({ entries, referents: [] });
		await open(lib.root, 'material');
		await lib.select(entries[0]?.assetId as AssetId);
		await lib.pressDelete();

		const heading = lib.root.find('.rp-al-shelf__static--empty');
		expect(heading.exists()).toBe(true);
		expect(active()).not.toBe(heading.element);
		expect(active()).toBe(lib.search);
	});

	/**
	 * A neighbour inside a shelf the user has since COLLAPSED is in the DOM and not on screen,
	 * and `focus()` on it does nothing at all — the stranding `focusWithin` already guards for
	 * at the other end of §6.2's handoff. A selection outlives its shelf being open, so this is
	 * reachable by ordinary use: pick a row, shut the shelf, delete.
	 */
	it('falls back rather than focusing a neighbour inside a collapsed shelf', async () => {
		const entries = [...shelf('material', ['Alder plank', 'Birch plank']), ...shelf('furniture', ['Sofa'])];
		const lib = await library({ entries, referents: [] });
		await open(lib.root, 'material');
		await lib.select(entries[0]?.assetId as AssetId);
		await open(lib.root, 'material');
		await lib.pressDelete();

		expect(lib.root.find(`[data-asset-id="${entries[1]?.assetId ?? ''}"]`).exists()).toBe(true);
		expect(active()).toBe(lib.search);
	});

	/**
	 * The POLICY half of the case above, and the reason it is a second assertion rather than a
	 * second reading of the first: `onBack` answers this same situation by REVEALING the shelf,
	 * under a docblock about exactly that stranding, and `onDelete` does not. Both are legal
	 * under §3.5 — the search field is *"every remaining case"* — so the divergence is a decision
	 * somebody made, and a decision nobody pins reads as an oversight from whichever side is read
	 * second. The argument is in both functions' docblocks; this is what makes a build that
	 * started revealing fail an assertion about the EXPANSION rather than only one about the
	 * caret, which would read as a focus regression instead of as the policy change it is.
	 */
	it('leaves a collapsed shelf collapsed rather than revealing it as Back does', async () => {
		const entries = [...shelf('material', ['Alder plank', 'Birch plank']), ...shelf('furniture', ['Sofa'])];
		const lib = await library({ entries, referents: [] });
		await open(lib.root, 'material');
		await lib.select(entries[0]?.assetId as AssetId);
		await open(lib.root, 'material');
		const before = lib.root.attributes('data-expanded-categories');
		await lib.pressDelete();

		expect(lib.root.attributes('data-expanded-categories')).toBe(before);
		expect(before).not.toContain('material');
	});

	/**
	 * §7's narrow composition hides `.rp-al-body` while something is SELECTED, so the withdrawal
	 * has to happen before the destination is looked for — a focus computed with the selection
	 * still standing finds every candidate row not laid out and falls through to the search
	 * field, in exactly the layout §6.2's handoff exists to serve.
	 *
	 * Asserted here rather than left to the wide cases because they cannot see it: with the
	 * shelves laid out beside the rail, the ordering makes no difference at all.
	 */
	it('withdraws before it looks, so the neighbour is reachable in the narrow composition', async () => {
		narrow();
		const entries = shelf('material', ['Alder plank', 'Birch plank']);
		const lib = await library({ entries, referents: [] });
		await open(lib.root, 'material');
		await lib.select(entries[0]?.assetId as AssetId);
		await lib.pressDelete();

		expect((active() as HTMLElement | null)?.dataset['assetId']).toBe(entries[1]?.assetId);
	});

	/**
	 * A REFUSED delete moves nothing: the asset is still there, the panel still has it selected,
	 * and stealing focus off whatever the user is on would be the fix arriving where there is
	 * nothing to fix.
	 */
	it('leaves focus alone when the delete refuses', async () => {
		const entries = shelf('material', ['Alder plank', 'Birch plank']);
		const lib = await library({ entries, referents: [], refuseWith: 'reference.referents-exist' });
		await open(lib.root, 'material');
		await lib.select(entries[0]?.assetId as AssetId);
		const deleteButton = lib.root.get('.rp-al-action--delete').element as HTMLElement;
		deleteButton.focus();
		await lib.pressDelete();

		expect(active()).toBe(deleteButton);
		expect(lib.root.attributes('data-selected-asset-id')).toBe(entries[0]?.assetId);
	});

	/**
	 * The inspector withdraws to its resting state — §3.5's *"a deletion is a `back()` that
	 * cannot return to its row"* — so the panel stops naming an asset that is gone.
	 */
	it('withdraws the inspector to its resting state', async () => {
		const entries = shelf('material', ['Alder plank', 'Birch plank']);
		const lib = await library({ entries, referents: [] });
		await open(lib.root, 'material');
		await lib.select(entries[0]?.assetId as AssetId);
		await lib.pressDelete();

		expect(lib.root.get('.rp-al-inspector').attributes('data-inspector-state')).toBe('resting');
		expect(lib.root.attributes('data-selected-asset-id')).toBe('');
	});

	/**
	 * An UNDECLARED category's shelf exists only because an asset sits in it, so deleting the
	 * last one removes the shelf outright and the captured list is disconnected from the
	 * document. The fallback is the search field, and this is the case that proves the staleness
	 * is representable rather than silent — a build holding the element and not testing
	 * `isConnected` reads an index off a detached list and focuses nothing at all.
	 */
	it('falls back to the search field when the shelf itself is gone', async () => {
		const entries = [
			...shelf('material', ['Alder plank']),
			anEntry({ assetId: createAssetId(), category: 'bespoke', name: 'One-off' }),
		];
		const lib = await library({ entries, referents: [] });
		const bespoke = lib.root
			.findAll('button.rp-al-shelf__head')
			.find((el) => el.text().includes('bespoke'));
		await bespoke?.trigger('click');
		await settle();
		await lib.select(entries[1]?.assetId as AssetId);
		await lib.pressDelete();

		expect(lib.root.findAll('button.rp-al-shelf__head').some((el) => el.text().includes('bespoke')))
			.toBe(false);
		expect(active()).toBe(lib.search);
	});
});
