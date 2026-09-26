/**
 * @vitest-environment jsdom
 *
 * AD13-R1's designer half: the usage scope drawn in the Inspector's asset block, before a user
 * rewrites geometry every plan in it draws.
 *
 * **Driven through the real `DesignerInspector` rather than by mounting `DesignerUsageScope`
 * bare**, which is `assetUsageDuplicate.test.ts`'s rule on the other surface and matters more
 * here: the whole card is that a block EXISTS on a surface that had none, and a bare mount passes
 * with the block mounted nowhere. One case mounts the inspector with no context at all, which is
 * the state FIVE other suites are in — `grep -rl 'mount(DesignerInspector' tests/` prints six
 * files and this is the only one of them that provides a context — and the reason this component
 * injects rather than throwing.
 *
 * The inspector's other props are the ones `designerReferencePanels.test.ts` already spells for
 * its own bare mount; nothing here asserts on any of them.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { AssetPlanUsage } from '../../../src/application/queries/ListPlansUsingAsset';
import type { AssetDesignerContext } from '../../../src/presentation/designer/AssetDesignerContext';
import { ASSET_DESIGNER_CONTEXT } from '../../../src/presentation/designer/AssetDesignerContext';
import type { AssetDesignerQueryServices } from '../../../src/presentation/read-models/assetDesignerQueries';
import type { DispatchOutcome, DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
import DesignerInspector from '../../../src/presentation/designer/inspector/DesignerInspector.vue';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { t } from '../../../src/presentation/i18n/strings';
import { trError } from '../../../src/presentation/i18n/toUserMessage';
import { assetDesign } from '../../helpers/assetDesign';
import { emptyBackgroundVault } from '../../helpers/background';
import { installObsidianDom } from '../../helpers/dom';
import { recorder } from '../../helpers/logger';

installObsidianDom();

const DESIGN = assetDesign();

const VAULT_FAILED = {
	category: 'Persistence',
	code: 'vault.unexpected-failure',
	message: 'the vault would not answer',
} as const;

type Scope = Result<AssetPlanUsage, typeof VAULT_FAILED>;

function twoPlans(unreadable = 0): AssetPlanUsage {
	return {
		plans: [
			{ planId: createPlanId(), planName: 'Kitchen', projectId: createProjectId(), projectName: 'Flat refit', placements: 2 },
			{ planId: createPlanId(), planName: 'Utility', projectId: createProjectId(), projectName: 'Flat refit', placements: 1 },
		],
		unreadable,
	};
}

/**
 * Two plans with the SAME name in different projects — the state `PlanAssetUsage.projectName`
 * exists for, and the one a fixture is least likely to produce by accident.
 */
function twoPlansNamedAlike(): AssetPlanUsage {
	return {
		plans: [
			{ planId: createPlanId(), planName: 'Kitchen', projectId: createProjectId(), projectName: 'Flat refit', placements: 2 },
			{ planId: createPlanId(), planName: 'Kitchen', projectId: createProjectId(), projectName: 'Annexe conversion', placements: 2 },
		],
		unreadable: 0,
	};
}

/**
 * The leaf's context, with only the two members this block reads under the test's control. The
 * design query answers a fixed DTO throughout: nothing here is about the design read, and a
 * changing one would make a failing case ambiguous between the two.
 */
function context(options: { scope: Scope | 'pending'; scanned?: boolean }): AssetDesignerContext {
	const listPlansUsingAsset: AssetDesignerQueryServices['listPlansUsingAsset'] =
		options.scope === 'pending'
			? // A read that never answers, which is the in-flight state and the only honest way to
				// hold it: `assetUsageDuplicate.test.ts`'s `'pending'` door on the other surface.
				() =>
					new Promise<never>(() => {
						// Deliberately never settles.
					})
			: () => Promise.resolve(options.scope as Scope);
	return {
		assetId: DESIGN.assetId,
		queries: { getAssetDesign: () => Promise.resolve(ok(DESIGN)), listPlansUsingAsset },
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		picker: null,
		vault: emptyBackgroundVault(),
		onDesignChanged: () => () => undefined,
		onThemeChange: () => () => undefined,
		onVaultFileChanged: () => () => undefined,
		indexScanCompleted: () => options.scanned ?? true,
		closeLeaf: () => undefined,
	};
}

/** The inspector, mounted with a leaf context when one is given and with none when it is not. */
function inspector(leaf?: AssetDesignerContext): VueWrapper {
	return mount(DesignerInspector, {
		props: {
			design: DESIGN,
			setHeight: vi.fn<(height: number | null) => Promise<DispatchResult>>().mockResolvedValue(ok('wrote')),
			removeBackground: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
			editDimensions: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
			activateAnchorTool: vi.fn<() => void>(),
			logger: recorder,
			selection: null,
			// A write door nothing in this file presses: every case here is about what the usage
			// block DRAWS. `'no-write'` is what an edit that changed nothing answers, which is what
			// a chain no leaf composed honestly did.
			editShape: () => Promise.resolve(ok<DispatchOutcome>('no-write')),
			select: vi.fn<(next: DesignerSelection | null) => void>(),
			selected: [],
			lockedGraphics: new Set<string>(),
		},
		global: leaf === undefined ? {} : { provide: { [ASSET_DESIGNER_CONTEXT as symbol]: leaf } },
	});
}

const scope = (wrapper: VueWrapper): string => wrapper.find('.rp-designer-usage-scope').text();

describe('the designer’s usage scope', () => {
	/**
	 * The ready state: the heading and the plans under it. BOTH halves in one case because they
	 * are one disclosure — an unlabelled list of names under an asset's own name states nothing,
	 * and a heading over nothing names a blast radius without a radius.
	 *
	 * The heading is the library panel's own string rather than a designer-only one, which is the
	 * component header's measured reason and the standing integration change request.
	 */
	it('names the plans that place this asset, under a heading that says what they are', async () => {
		const wrapper = inspector(context({ scope: ok(twoPlans()) }));
		await flushPromises();

		expect(wrapper.find('.rp-designer-usage-title').text()).toBe(t('en', 'view.asset-library.used-in-plans'));
		expect(wrapper.findAll('.rp-designer-usage-plans li').map((row) => row.text())).toEqual([
			t('en', 'view.asset-library.used-in-plans.plan', { name: 'Kitchen', project: 'Flat refit', count: '2' }),
			t('en', 'view.asset-library.used-in-plans.plan', { name: 'Utility', project: 'Flat refit', count: '1' }),
		]);
	});

	/**
	 * **The row names its PROJECT, and the assertion is on the LITERAL text rather than through
	 * `t`.** Two plans can share a name — the catalogue is vault-level, so one definition is
	 * placeable from plans in different projects — and until `PlanAssetUsage` carried a project
	 * name these drew as one line of text twice, separable only by the `:key` and the
	 * `data-plan-id`, neither of which a user sees.
	 *
	 * Spelled out rather than round-tripped through `t`, because round-tripping cannot see the
	 * defect this case exists for: `t` leaves an unmatched hole standing, so a fixture that
	 * omitted `projectName` renders `Kitchen ({project})` on BOTH sides and the assertion agrees
	 * with itself. Measured on this branch — the sibling case above passed, unchanged, against a
	 * component already supplying `project` from a fixture that had no such field.
	 */
	it('names the project on every row, so two plans sharing a name are two different lines', async () => {
		const wrapper = inspector(context({ scope: ok(twoPlansNamedAlike()) }));
		await flushPromises();

		const rows = wrapper.findAll('.rp-designer-usage-plans li').map((row) => row.text());
		expect(rows).toEqual([
			'Kitchen (Flat refit) — 2 placement(s)',
			'Kitchen (Annexe conversion) — 2 placement(s)',
		]);
		expect(new Set(rows).size).toBe(rows.length);
	});

	/**
	 * The empty scope. It is a real answer — this definition is placed nowhere — and the panel has
	 * to say so rather than drawing an empty list, which reads as a block that failed to load.
	 */
	it('says no plan places this asset when the scope is genuinely empty', async () => {
		const wrapper = inspector(context({ scope: ok({ plans: [], unreadable: 0 }) }));
		await flushPromises();

		expect(scope(wrapper)).toContain(t('en', 'view.asset-library.used-in-plans.none'));
		expect(wrapper.find('.rp-designer-usage-plans').exists()).toBe(false);
	});

	/**
	 * The ADDITIVE fourth state: a list that is real and INCOMPLETE. Both halves, because folding
	 * it into either neighbour is the defect — a build that drew only the notice loses the plans it
	 * did read, and one that drew only the plans understates the blast radius of the very edit this
	 * block is consulted about (C08's *a failed read is not "asset missing"*, at the one surface
	 * whose whole job is to state one).
	 */
	it('keeps the plans it read and says the list may be incomplete', async () => {
		const wrapper = inspector(context({ scope: ok(twoPlans(3)) }));
		await flushPromises();

		expect(wrapper.findAll('.rp-designer-usage-plans li')).toHaveLength(2);
		expect(wrapper.find('[data-usage-incomplete="true"]').text()).toBe(
			t('en', 'view.asset-library.used-in-plans.unreadable', { count: '3' }),
		);
	});

	/** In flight: a line saying so, and no scope drawn over a read that has not answered. */
	it('draws a loading line while the read is out', () => {
		const wrapper = inspector(context({ scope: 'pending' }));

		expect(scope(wrapper)).toContain(t('en', 'view.asset-library.used-in-plans.loading'));
		expect(scope(wrapper)).not.toContain(t('en', 'view.asset-library.used-in-plans.none'));
	});

	/**
	 * A refusal is *unknown*, never *none* — the distinction between a safe edit and a blind one.
	 *
	 * The sentence is the REFUSAL'S OWN, through `trError`, and not the section's generic line:
	 * a vault that faulted and a build with no settings say different things, which is the same
	 * rule the project view's `.rp-view-message` follows. The generic line is what the GATE case
	 * below draws, because there no error was raised — a contrast a single assertion would lose.
	 */
	it('says the scope is unknown when the read refuses, in the refusal’s own words', async () => {
		const wrapper = inspector(context({ scope: err(VAULT_FAILED) }));
		await flushPromises();

		expect(scope(wrapper)).toContain(trError(VAULT_FAILED));
		expect(scope(wrapper)).not.toContain(t('en', 'view.asset-library.used-in-plans.none'));
	});

	/**
	 * **The GATE** (AD13-R1, and `AssetUsageScope.vue`'s named exposure: *"the next caller of this
	 * query reintroduces the defect silently"*). Both repositories `ListPlansUsingAsset` walks
	 * enumerate `index.getIdsByType` and answer `ok` over an empty index, so before the initial
	 * scan a successful-looking read is a lie. This case hands it a query that WOULD answer two
	 * plans and requires the panel to say *unknown* and never dispatch — an ungated build draws
	 * whatever the index happens to hold, which before the scan is nothing.
	 *
	 * Both halves: a build that drew the refusal sentence and dispatched anyway is still reading a
	 * vault it has been told not to trust, and a fault below that read would then be logged for a
	 * question nobody asked.
	 */
	it('does not read at all before the index scan has run, and says the scope is unknown', async () => {
		const asked: string[] = [];
		const leaf = context({ scope: ok(twoPlans()), scanned: false });
		const wrapper = inspector({
			...leaf,
			queries: {
				...leaf.queries,
				listPlansUsingAsset: (assetId) => {
					asked.push(assetId);
					return Promise.resolve(ok(twoPlans()));
				},
			},
		});
		await flushPromises();

		expect(asked).toEqual([]);
		expect(scope(wrapper)).toContain(t('en', 'view.asset-library.used-in-plans.failed'));
	});

	/** The id that reaches the query is this LEAF's, not whichever one the query defaulted to. */
	it('asks about the asset this leaf is designing', async () => {
		const asked: string[] = [];
		const leaf = context({ scope: ok(twoPlans()) });
		inspector({
			...leaf,
			queries: {
				...leaf.queries,
				listPlansUsingAsset: (assetId) => {
					asked.push(assetId);
					return Promise.resolve(ok(twoPlans()));
				},
			},
		});
		await flushPromises();

		expect(asked).toEqual([DESIGN.assetId]);
	});

	/**
	 * **No control**, asserted as a category at the block rather than by naming the two kinds that
	 * were considered. A plan row that looked clickable and did nothing, or a retry that re-runs a
	 * read nothing recomposed, is the dead control this expansion has shipped three times.
	 */
	it('draws no control of any kind', async () => {
		const wrapper = inspector(context({ scope: ok(twoPlans()) }));
		await flushPromises();

		const block = wrapper.find('.rp-designer-usage-scope');
		expect(block.findAll('button, a, input, select, textarea, [role="button"]')).toEqual([]);
	});

	/**
	 * The two cases for the injection. Absence of a context MEANS this component is not inside a
	 * designer leaf — the state five suites in this directory mount the inspector in — so it draws
	 * nothing rather than throwing, and rather than a refusal sentence that would assert a real
	 * read had failed.
	 *
	 * The second half is what keeps that from becoming a disclosure nobody notices going missing:
	 * given a context, the block IS in the real inspector. A `DesignerUsageScope` created and
	 * mounted nowhere passes the first case perfectly.
	 */
	it('draws nothing when the inspector is mounted outside a leaf, and draws when it is not', async () => {
		expect(inspector().find('.rp-designer-usage-scope').exists()).toBe(false);

		const wrapper = inspector(context({ scope: ok(twoPlans()) }));
		await flushPromises();

		expect(wrapper.find('.rp-designer-usage-scope').exists()).toBe(true);
	});

	/**
	 * **AD18-R1's own condition, pinned rather than argued.** That ruling moved the asset's NAME
	 * out of this panel and into the header, and required whoever moved it to check that this block
	 * still reads as being about the asset without the name directly above it. It does, because the
	 * `Asset` `<h3>` is what sits there now and this block's own `<h4>Used in plans</h4>` reads as a
	 * subsection of that heading. That argument is about the TEMPLATE, and until this case nothing
	 * asserted it: the day somebody slips a block between the two, the reading the ruling asked for
	 * is gone and every gate stays green.
	 *
	 * `previousElementSibling` rather than an index into the children, because Vue renders each of
	 * the Inspector's comments as a DOM node and that lookup skips them — and because a position is
	 * correct only until the next insertion above it, which is the failure this case exists for.
	 */
	it('sits directly under the asset heading, with no block between them (AD18-R1)', async () => {
		const wrapper = inspector(context({ scope: ok(twoPlans()) }));
		await flushPromises();

		const previous = wrapper.find('.rp-designer-usage-scope').element.previousElementSibling;

		expect(previous?.tagName).toBe('H3');
		expect(previous?.textContent?.trim()).toBe(t('en', 'designer.inspector.asset'));
	});
});
