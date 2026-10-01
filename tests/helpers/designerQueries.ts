import {
	unavailableAssetDesignerQueries,
	type AssetDesignerQueryServices,
} from '../../src/presentation/read-models/assetDesignerQueries';

/**
 * The usage-scope arm for a suite whose subject is the DESIGN read and not the scope — the
 * toolbar, the canvas, the background, the cross-leaf bus, every file that built
 * `{ getAssetDesign }` as an object literal before AD13-R1 gave that bundle a second member.
 *
 * **The name says what it MEANS: nobody wired this.** A suite that cares what the scope answers
 * writes its own arm; a suite reaching for this one is declaring that it does not.
 *
 * **It is production's own refusal, borrowed rather than invented.** A stub answering
 * `ok({ plans: [], unreadable: 0 })` would be a fake KINDER than the real thing at the one surface
 * whose job is to state a blast radius: every suite using it would draw *no plan places this
 * asset* over a bundle nobody composed, which is exactly the false absence
 * `DesignerUsageScope.vue`'s gate exists to refuse. Refusing says *I could not find out*, which is
 * what an unwired bundle actually knows.
 *
 * A `const` rather than a factory wrapping the whole bundle, because the call sites are literals
 * of three different shapes — one-line, multi-line and `createAssetDesignerQueries(...)` — and one
 * member added to each is a smaller edit than three wrappings. It holds nothing per call: the
 * refusal closes over no state.
 */
export const unwiredPlanUsage: AssetDesignerQueryServices['listPlansUsingAsset'] =
	unavailableAssetDesignerQueries().listPlansUsingAsset;
