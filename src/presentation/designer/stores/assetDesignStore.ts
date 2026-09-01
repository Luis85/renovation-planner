import { defineStore } from 'pinia';
import { ref } from 'vue';
import { isErr } from '../../../core/result/Result';
import type { AssetDesignDto, AssetDesignError } from '../../../application/queries/GetAssetDesign';
import type { AssetDesignerQueryServices } from '../../read-models/assetDesignerQueries';

/**
 * How far this designer leaf got loading its asset.
 *
 * There is no `'missing'` here and its absence is a decision rather than an omission:
 * `GetAssetDesign` refuses an absent asset with a coded `ReferenceError` instead of answering
 * `ok(null)`, so an asset that is gone arrives as a failure and nothing downstream could tell
 * the two apart afterwards. `ProjectStore` keeps them separate because its queries do.
 */
type AssetDesignStoreStatus = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * The refusal an EMPTY project index produces, and the only one this store declines to believe
 * before the vault scan has run.
 *
 * Spelled here rather than imported, the way `presentation/`'s field-error maps spell the codes
 * they route: the raise site is `assetNotFound` in `domain/asset/Asset.errors.ts`, and a
 * presentation module keying on a code is this system's normal shape. Narrow on purpose — a
 * vault that could not be READ is a genuine failure whenever it happens, and holding the
 * loading line over it would hide a real fault behind a spinner.
 */
const MISSING_ASSET_CODE = 'asset.not-found';

/**
 * The asset designer's working copy of one asset's design (SDD §14), and never a write path:
 * nothing here calls a repository, and everything in it is rebuildable by re-running the one
 * query (ADR-005).
 *
 * One store per leaf — each designer view mounts its own Pinia — which is what lets two
 * designers on two assets, or two split panes on one, hold their own reads.
 */
export const useAssetDesignStore = defineStore('assetDesign', () => {
	const design = ref<AssetDesignDto | null>(null);
	const error = ref<AssetDesignError | null>(null);
	const status = ref<AssetDesignStoreStatus>('idle');
	/**
	 * Is what the canvas is drawing older than the vault?
	 *
	 * A SEPARATE fact from `error`, which `ProjectStore` records three review findings' worth of
	 * reasons for: `error` answers "why is there nothing to show" and is set beside a blanked
	 * design, while this answers "the content on screen is real but may be out of date". Set
	 * where a read fails with content still drawn, cleared by the one event that makes the
	 * canvas current again — a read that SUCCEEDED — and by `fail`, where the content is gone
	 * with it.
	 */
	const stale = ref(false);

	/**
	 * The ticket every `hydrate` call takes before its first await, so a slower earlier read
	 * cannot land on top of a faster later one.
	 *
	 * There are THREE concurrent callers, not two: the post-command read-back, the cross-leaf
	 * subscription, and the failure state's retry button — which stays mounted while its own
	 * read is in flight, so two presses issue two reads and the user is the one producing the
	 * race. `ProjectStore` and `InspectorStore` both carry this mechanism, and the defect
	 * without it is the same in all three: the last assignment wins whether or not it is the
	 * freshest, and a just-written change disappears with no error anywhere.
	 */
	let latestHydration = 0;

	/**
	 * A failed read leaves NO stale design behind. Keeping one would draw a canvas that looks
	 * current beside an error saying it is not, which is the worse of the two wrong answers.
	 */
	function fail(cause: AssetDesignError): void {
		design.value = null;
		error.value = cause;
		status.value = 'failed';
		// Nothing is on screen to BE stale: this path blanks the design and the failure state
		// replaces the canvas.
		stale.value = false;
	}

	/**
	 * THE hydration routine. One, with three callers, rather than one per site.
	 *
	 * It takes its query services as an argument rather than closing over them for
	 * `ProjectStore.hydrate`'s reason: a store that captured its dependencies at definition time
	 * could not be re-pointed, and each designer leaf has its own Pinia holding its own asset.
	 *
	 * **Every arm past the await is guarded by the ticket, the FAILURE arms included.** A guard
	 * on the success path alone passes a naive race test and leaves the reported defect
	 * standing: a superseded read that refuses would blank a valid design and put the failure
	 * panel back over it.
	 */
	async function hydrate(
		queries: AssetDesignerQueryServices,
		assetId: string,
		/**
		 * Written INLINE rather than as a named `HydrateDesignOptions`, which was its first
		 * shape: the only caller is the designer's runtime, so an exported interface is an
		 * `unused-exports` finding and an unexported one is a `private-type-leak` through this
		 * store's own returned type. Both were measured by `npm run analyze` rather than
		 * guessed at.
		 *
		 * Both members are REQUIRED, and `indexScanCompleted` particularly so: an optional one
		 * defaulting either way is a decision made by whoever forgets to pass it. Defaulted
		 * `true` it reinstates the false failure screen on every restored leaf; defaulted
		 * `false` it makes a genuinely deleted asset load forever.
		 */
		options: {
			/**
			 * Has the initial index scan RUN — zero entries included — rather than "has it found
			 * anything". `RenovationProjectDeps.indexScanCompleted` carries the longer form of
			 * why "populated" is the wrong question: a vault whose last asset note was deleted
			 * while Obsidian was closed completes a scan that finds nothing, and a leaf waiting
			 * to be populated waits forever.
			 */
			readonly indexScanCompleted: boolean;
			/**
			 * A post-command read-back keeps what is on screen when it fails; a first load or a
			 * retry has nothing to keep. `ProjectStore.hydrate` draws the same split for the same
			 * reason: a refresh runs over a write that already landed, so blanking would replace
			 * "possibly stale" with definitely nothing over data the vault has.
			 */
			readonly keepPreviousOnFailure?: boolean;
		},
	): Promise<void> {
		const request = ++latestHydration;
		const superseded = (): boolean => request !== latestHydration;

		// A RE-hydration does not blank the canvas: the root draws its loading line on a null
		// design, so dropping to `loading` here would flash it on every committed command and on
		// every peer leaf's edit. Only a first load, or one after a failure, has nothing to keep
		// showing.
		if (status.value !== 'ready') status.value = 'loading';
		// Cleared for the read that is about to happen; `stale` deliberately is NOT. A read that
		// has STARTED has established nothing, and the canvas is still drawing exactly what it
		// was drawing a moment ago, so withdrawing that warning here would be an assurance
		// nothing had earned for the whole duration of the read.
		error.value = null;

		const found = await queries.getAssetDesign(assetId);
		if (superseded()) return;

		if (isErr(found)) {
			// Not authoritative until the scan has run: Obsidian restores its leaves BEFORE
			// `onLayoutReady`, and the scan runs from it — so this read resolved the asset id
			// against an EMPTY index and was answered a legitimate miss about a note sitting on
			// disk. The loading line is held instead, and `createAssetDesignChangeSource`'s
			// `ProjectIndexRebuilt` arm is what re-reads once the scan lands. Both halves, or the
			// leaf either flashes a failure it retracts or never draws at all.
			if (found.error.code === MISSING_ASSET_CODE && !options.indexScanCompleted) return;
			if (options.keepPreviousOnFailure === true && status.value === 'ready') {
				error.value = found.error;
				// Real content is still on screen and the vault has moved past it.
				stale.value = true;
				return;
			}
			fail(found.error);
			return;
		}

		design.value = found.value;
		status.value = 'ready';
		// The ONE event that retires a stale-data warning: what is on screen came back from the
		// vault just now. Every hydration path ends here on success, whatever its options.
		stale.value = false;
	}

	return { design, error, status, stale, hydrate };
});
