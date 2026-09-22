/**
 * @vitest-environment jsdom
 *
 * The way OUT of the designer's stale notice — ruling AD18-R13, contract C08's *"a retry after
 * an uncertain write must reconcile before repeating it"*.
 *
 * The notice says the canvas may be out of date and, until this card, offered nothing to do
 * about it: it cleared only when something else in the vault happened to provoke a successful
 * re-read. A hydrate IS the reconcile C08 asks for — it re-reads and, on success, retires the
 * warning, which `assetDesignStore` calls *"the ONE event that retires a stale-data warning"* —
 * so the control is a re-read and can never replay a write, because the handler takes no
 * command.
 *
 * **The load-bearing case is the one where the retry's own read FAILS.** The control takes
 * `runtime.refresh` (keep-previous) and not `runtime.hydrate` (blank-on-failure), and the two
 * are one word apart at the call site. A press wired to the wrong one passes the success case
 * below and destroys the user's canvas on the failing one: `AssetDesignStore.fail` blanks the
 * design, and the failure panel replaces a surface the vault's own copy of which is still
 * perfectly drawable. That is the outcome AD18-R13 reasons against — the retry is a door out,
 * never a way to lose the canvas — and step 7 of `docs/tests/cases/Recover an asset design
 * rather than lose it.md` already names the failure panel in that state as the defect.
 *
 * **Why the control is a SIBLING of `.rp-designer-notice` rather than a child of it**, which is
 * measured rather than preferred: three cases in three other files
 * (`assetDesignerRoot.test.ts`, `designerResponsiveShell.test.ts`,
 * `designerSaveStateStale.test.ts`) read that element's whole text as EQUAL to the sentence, and
 * `designerBackground.test.ts` maps every element wearing the class to its text. The class means
 * "a message" across the suite, and a control inside one of them would make it mean two things.
 * The cost is stated where the markup is.
 */
import { describe, expect, it } from 'vitest';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { Pinia } from 'pinia';
import AssetDesignerRoot from '../../../src/presentation/designer/AssetDesignerRoot.vue';
import { ASSET_DESIGNER_CONTEXT, type AssetDesignerContext } from '../../../src/presentation/designer/AssetDesignerContext';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { AssetDesignDto, AssetDesignError } from '../../../src/application/queries/GetAssetDesign';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { recorder } from '../../helpers/logger';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { emptyBackgroundVault } from '../../helpers/background';
import { installCanvas } from '../../helpers/canvas';
import { installResizeObserver } from '../../helpers/layout';
import { unwiredPlanUsage } from '../../helpers/designerQueries';

/** The canvas region holds a real Konva stage, and jsdom has neither a 2D context nor a `ResizeObserver`. */
installCanvas();
installResizeObserver();

const ASSET_ID = 'asset-01JABC';
const VAULT_FAILED: AssetDesignError = { category: 'Persistence', code: 'vault.unexpected-failure', message: 'the vault could not be read' };

type Answer = () => Promise<Result<AssetDesignDto, AssetDesignError>>;

/** Module scope because it captures nothing per-call; `unicorn/consistent-function-scoping`. */
const readsFine: Answer = () => Promise.resolve(ok(assetDesign()));

interface Rig {
	readonly wrapper: VueWrapper;
	readonly pinia: Pinia;
	/** Every read this leaf's own runtime issued — the mount's, and one per retry. */
	readonly reads: number[];
	/** What the NEXT read through the context answers; the mount's has already happened. */
	answerWith: (answer: Answer) => void;
}

async function rig(): Promise<Rig> {
	const reads: number[] = [];
	let answer: Answer = readsFine;
	const ctx: AssetDesignerContext = {
		assetId: ASSET_ID,
		queries: {
			getAssetDesign: () => {
				reads.push(reads.length + 1);
				return answer();
			},
			listPlansUsingAsset: unwiredPlanUsage,
		},
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		picker: null,
		vault: emptyBackgroundVault(),
		onDesignChanged: () => () => undefined,
		onThemeChange: () => () => undefined,
		onVaultFileChanged: () => () => undefined,
		indexScanCompleted: () => true,
		closeLeaf: () => undefined,
	};
	const pinia = createPinia();
	const wrapper = mount(AssetDesignerRoot, {
		global: { plugins: [pinia, VueKonva], provide: { [ASSET_DESIGNER_CONTEXT as symbol]: ctx } },
	});
	await flushPromises();
	return {
		wrapper,
		pinia,
		reads,
		answerWith: (next: Answer) => {
			answer = next;
		},
	};
}

/**
 * The state the notice draws: a re-read that failed over content that is real and still on
 * screen. Driven at the store through the keep-previous door, exactly as
 * `assetDesignerRoot.test.ts`'s own stale case drives it, because the alternative — provoking it
 * through a real command — would make every assertion here depend on the write path too.
 */
async function goStale(pinia: Pinia): Promise<void> {
	await useAssetDesignStore(pinia).hydrate(
		{ getAssetDesign: () => Promise.resolve(err(VAULT_FAILED)), listPlansUsingAsset: unwiredPlanUsage },
		ASSET_ID,
		{ indexScanCompleted: true, keepPreviousOnFailure: true },
	);
	await nextTick();
}

const retryButton = (wrapper: VueWrapper) => wrapper.find('button[data-rp-action="retry"]');
/**
 * Every notice the shell draws, by text, and a LIST rather than `find('.rp-designer-notice')`
 * for the reason `designerSaveStateStale.test.ts` already records: this fixture's default
 * background reference names a file no vault here holds, so a background notice wears the same
 * class and outlives the stale one. A bare `find` answered it and turned "the stale notice is
 * gone" into an assertion about template order.
 */
const notices = (wrapper: VueWrapper): string[] => wrapper.findAll('.rp-designer-notice').map((notice) => notice.text());

describe('the stale notice’s way out', () => {
	it('offers a retry that re-reads, and a read that succeeds retires the notice with it', async () => {
		const { wrapper, pinia, reads, answerWith } = await rig();
		await goStale(pinia);
		expect(notices(wrapper)).toContain(t('en', 'designer.refresh-failed'));
		const before = reads.length;
		answerWith(readsFine);

		await retryButton(wrapper).trigger('click');
		await flushPromises();
		await nextTick();

		expect(reads.length).toBe(before + 1);
		expect(notices(wrapper)).not.toContain(t('en', 'designer.refresh-failed'));
		expect(retryButton(wrapper).exists()).toBe(false);
		// The canvas was never taken away on the way through.
		expect(useAssetDesignStore(pinia).design).not.toBeNull();
	});

	it('keeps the canvas and says the read failed AGAIN when the retry’s own read fails', async () => {
		const { wrapper, pinia, answerWith } = await rig();
		await goStale(pinia);
		answerWith(() => Promise.resolve(err(VAULT_FAILED)));

		await retryButton(wrapper).trigger('click');
		await flushPromises();
		await nextTick();

		// All four halves: the notice is still there, it no longer claims this is the first
		// failure, the design is still drawn, and the failure panel — which is what a retry
		// wired to `runtime.hydrate` would put here — is not.
		expect(notices(wrapper)).toContain(t('en', 'designer.refresh-failed.again'));
		expect(notices(wrapper)).not.toContain(t('en', 'designer.refresh-failed'));
		expect(retryButton(wrapper).exists()).toBe(true);
		// Released rather than left busy: the control is pressable again, which is the other arm
		// of the same attribute the in-flight case asserts as `'true'`.
		expect(retryButton(wrapper).attributes('aria-disabled')).toBeUndefined();
		expect(useAssetDesignStore(pinia).design).not.toBeNull();
		expect(wrapper.find('.rp-view-failure').exists()).toBe(false);
	});

	it('withholds a second read while the first is still in flight, and says so on the control', async () => {
		const { wrapper, pinia, reads, answerWith } = await rig();
		await goStale(pinia);
		const before = reads.length;
		let release!: () => void;
		answerWith(
			() =>
				new Promise<Result<AssetDesignDto, AssetDesignError>>((resolve) => {
					release = () => resolve(ok(assetDesign()));
				}),
		);

		await retryButton(wrapper).trigger('click');
		await nextTick();
		// `aria-disabled` and not `:disabled` — this repository's spelling for a control that is
		// busy rather than absent — so the click still arrives and the HANDLER is what withholds
		// the read. A build that only dimmed the button would issue the second read here.
		expect(retryButton(wrapper).attributes('aria-disabled')).toBe('true');
		await retryButton(wrapper).trigger('click');
		await flushPromises();

		expect(reads.length).toBe(before + 1);

		release();
		await flushPromises();
		await nextTick();
		expect(notices(wrapper)).not.toContain(t('en', 'designer.refresh-failed'));
		expect(retryButton(wrapper).exists()).toBe(false);
	});
});
