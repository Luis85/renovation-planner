/**
 * @vitest-environment jsdom
 *
 * W18-C: contract C08's "Saved must not imply that a stale canvas is current", asked of the
 * designer's own header.
 *
 * The defect this file was written against: `SaveStateIndicator` derives its
 * "Saved · refresh needed" qualifier from `ProjectStore.stale` and `usePlanningReadState`, and
 * `grep -rn "useProjectStore\|usePlanningReadState" src/presentation/designer/` prints nothing —
 * the designer mounts its own Pinia, so both sat at their defaults forever and the qualifier was
 * UNREACHABLE on this surface. Meanwhile `assetDesignStore.stale` drew a refresh-failed strip a
 * few pixels below a header that still read `Saved`.
 *
 * **Both surfaces are asserted together, in one case, deliberately.** The Plan Editor's own
 * `stalePath.e2e.test.ts` does the same under the comment "The two surfaces that say so, in the
 * two places a user looks", and that is the pairing this file inherits rather than invents: the
 * label is the standing answer to "is my work safe", the strip is the announced explanation of
 * what went wrong and it lives in a `role="status"` region the header has none of. A case
 * asserting either alone stays green on the day the other stops agreeing with it, which is
 * exactly the state this file was written to end.
 *
 * Driven through the REAL peer-refresh door rather than by assigning `stale` on the store: the
 * claim is about what a user sees after a read-back failed, and a store poked directly would
 * pass against a root that never wires the two together.
 */
import { describe, expect, it } from 'vitest';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import { flushPromises, mount } from '@vue/test-utils';
import { err, ok, type Result } from '../../../src/core/result/Result';
import { createEventBus } from '../../../src/core/events/EventBus';
import { createAssetDesignChangeSource } from '../../../src/application/events/assetDesignChangeSource';
import { assetDesignChanged } from '../../../src/domain/asset/Asset.events';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import type { AssetDesignDto, AssetDesignError } from '../../../src/application/queries/GetAssetDesign';
import AssetDesignerRoot from '../../../src/presentation/designer/AssetDesignerRoot.vue';
import {
	ASSET_DESIGNER_CONTEXT,
	type AssetDesignerContext,
} from '../../../src/presentation/designer/AssetDesignerContext';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign, VAULT_FAILED } from '../../helpers/assetDesign';
import { emptyBackgroundVault } from '../../helpers/background';
import { installCanvas } from '../../helpers/canvas';
import { installObsidianDom } from '../../helpers/dom';
import { installResizeObserver } from '../../helpers/layout';
import { recorder } from '../../helpers/logger';
import { unwiredPlanUsage } from '../../helpers/designerQueries';
import { settle } from '../../helpers/async';

installObsidianDom();
/** The root mounts a real Konva stage and an `EditorSurface`; jsdom supplies neither. */
installCanvas();
installResizeObserver();

const THE_ASSET = createAssetId();
const THE_DESIGN = assetDesign({ assetId: THE_ASSET, height: 900 });

interface Rig {
	readonly wrapper: ReturnType<typeof mount>;
	/** Publish a peer's change, so the leaf re-reads with whatever `answers` currently says. */
	readonly peerChanged: () => Promise<void>;
	/** Swap what the next read answers. */
	readonly answer: (next: () => Promise<Result<AssetDesignDto, AssetDesignError>>) => void;
	/**
	 * Every notice the shell is drawing, by text. Read as a LIST rather than through
	 * `find('.rp-designer-notice')`: this fixture's default background reference names a file no
	 * vault here holds, so a background notice shares that class and a bare `find` answers
	 * whichever of them template order puts first.
	 */
	readonly notices: () => string[];
}

async function rig(): Promise<Rig> {
	const bus = createEventBus(() => undefined);
	let answers: () => Promise<Result<AssetDesignDto, AssetDesignError>> = () => Promise.resolve(ok(THE_DESIGN));
	const context: AssetDesignerContext = {
		assetId: THE_ASSET,
		queries: { getAssetDesign: () => answers(), listPlansUsingAsset: unwiredPlanUsage },
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		picker: null,
		vault: emptyBackgroundVault(),
		onDesignChanged: (listener) => createAssetDesignChangeSource(bus)(THE_ASSET, listener),
		onThemeChange: () => () => undefined,
		onVaultFileChanged: () => () => undefined,
		indexScanCompleted: () => true,
		closeLeaf: () => undefined,
	};
	const wrapper = mount(AssetDesignerRoot, {
		global: { plugins: [createPinia(), VueKonva], provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context } },
	});
	await flushPromises();
	return {
		wrapper,
		notices: () => wrapper.findAll('.rp-designer-notice').map((notice) => notice.text()),
		answer: (next) => {
			answers = next;
		},
		// The subscription DETACHES its refresh (`void refresh()` in `runtime.ts`), so there is no
		// promise to await and a macrotask turn is what drains it.
		peerChanged: async () => {
			await bus.publish(assetDesignChanged({ assetId: THE_ASSET }));
			await settle();
			await flushPromises();
		},
	};
}

describe('the designer header over a canvas it cannot confirm', () => {
	it('qualifies Saved rather than claiming the canvas is current, beside the strip that says why', async () => {
		const { wrapper, answer, peerChanged, notices } = await rig();
		expect(wrapper.find('.rp-save-state-label').text()).toBe(t('en', 'save-state.saved'));

		answer(() => Promise.resolve(err(VAULT_FAILED)));
		await peerChanged();

		const store = useAssetDesignStore();
		expect(store.status).toBe('ready');
		expect(store.stale).toBe(true);
		expect(notices()).toContain(t('en', 'designer.refresh-failed'));
		expect(wrapper.find('.rp-save-state-label').text()).toBe(t('en', 'save-state.saved-refresh-needed'));
	});

	/**
	 * The qualifier RETIRES with the strip, on the one event `assetDesignStore` names as retiring
	 * it — a read that landed. Without this, a header pinned to "refresh needed" forever passes the
	 * case above and is a different lie about the same fact.
	 */
	it('drops the qualifier again once a re-read lands', async () => {
		const { wrapper, answer, peerChanged, notices } = await rig();
		answer(() => Promise.resolve(err(VAULT_FAILED)));
		await peerChanged();
		expect(wrapper.find('.rp-save-state-label').text()).toBe(t('en', 'save-state.saved-refresh-needed'));

		answer(() => Promise.resolve(ok(THE_DESIGN)));
		await peerChanged();

		expect(useAssetDesignStore().stale).toBe(false);
		expect(notices()).not.toContain(t('en', 'designer.refresh-failed'));
		expect(wrapper.find('.rp-save-state-label').text()).toBe(t('en', 'save-state.saved'));
	});
});
