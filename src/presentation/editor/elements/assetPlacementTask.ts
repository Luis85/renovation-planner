import { computed } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import { createEntityId } from '../../../core/identity/generateId';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import { withPlacementSize } from '../../../domain/spatial/assetPlacement';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import type { AssetShapeAnswer } from '../../read-models/assetShapes';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import { notifyFault, notifyOperationFailure, notifyWarning } from '../../notices/notify';
import { useDialogStore } from '../../dialogs/dialog-store';
import { useProjectStore } from '../../stores/ProjectStore';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useSaveStateStore } from '../save-state/save-state-store';
import { useSelectionStore } from '../selection/selection-store';
import { recordDraftFailure } from '../tools/with-stale-gate';
import { AssetPlacementTool } from './AssetPlacementTool';
import { createAssetPlacementDraft } from './assetPlacementDraft';
import { elementInput } from './elementInput';

const REFUSALS: Readonly<Record<Exclude<AssetShapeAnswer['kind'], 'placeable'>, StringKey>> = {
	'no-shape': 'editor.asset.no-shape', unscaled: 'editor.asset.unscaled', missing: 'editor.asset.unreadable', unreadable: 'editor.asset.unreadable',
};

export function createAssetPlacementTask(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'toolManager' | 'dispatcher' | 'writesBlocked' | 'refreshProjection' | 'setTool'> & { ledger: WriteLedger }) {
	const project = useProjectStore(), selection = useSelectionStore(), dialogs = useDialogStore(), save = useSaveStateStore();
	const draft = createAssetPlacementDraft();
	const blocked = computed(() => draft.busy || runtime.writesBlocked.value || save.state === 'saving');

	/** The shape behind an id: an asset that cannot be drawn is refused here with its reason, before any tool starts. */
	async function resolvePlaceable(assetId: string): Promise<Extract<AssetShapeAnswer, { kind: 'placeable' }> | null> {
		if (!context.queries.assetShapes) return null;
		const answer = (await context.queries.assetShapes([assetId])).get(assetId);
		if (answer?.kind === 'placeable') return answer;
		notifyWarning(tr(REFUSALS[answer?.kind ?? 'unreadable']));
		return null;
	}

	/** The picker, then that same shape. */
	async function pickPlaceable(title: string, options: readonly { readonly id: string; readonly name: string }[]): Promise<{ id: string; answer: Extract<AssetShapeAnswer, { kind: 'placeable' }> } | null> {
		if (dialogs.current !== null || !context.queries.assetShapes) return null;
		const picked = await dialogs.openDialog({ kind: 'entity-picker', title, candidates: options.map(option => ({ id: option.id, label: option.name })) });
		if (picked === 'cancel') return null;
		const answer = await resolvePlaceable(picked.id);
		return answer ? { id: picked.id, answer } : null;
	}

	/** One armed tool from one resolved shape — the tail `choose` and `arm` share, so a hand-off cannot start a differently-shaped draft. */
	function startDraft(assetId: string, answer: Extract<AssetShapeAnswer, { kind: 'placeable' }>): void {
		Object.assign(draft, { assetId, name: answer.name, shape: answer.shape, preview: null, error: null, conflict: false, text: { x: '', y: '' } });
		runtime.setTool('place-asset');
	}

	/**
	 * One reversible write through the leaf's dispatcher, from a fresh baseline: a second placement must not reuse the first one's version.
	 * `onFault` is the door a thrown fault takes; a caller announcing every failure in a sentence of its own passes `faultError`, which only maps and logs.
	 */
	async function write(element: NamedSpatialElement, onFault: typeof notifyFault = notifyFault): Promise<boolean> {
		const services = context.commands.renovation;
		if (blocked.value || !services) return false;
		draft.busy = true;
		try {
			const baseline = await services.read(context.planId as PlanId);
			if (!baseline.ok) { draft.error = baseline.error; return false; }
			const result = await runtime.dispatcher.run(services.command(baseline.value, elementInput(baseline.value, element), runtime.ledger));
			if (result.ok) { draft.error = null; return true; }
			await recordDraftFailure(draft, result.error, () => runtime.refreshProjection());
			return false;
		} catch (cause) { onFault(cause, context.commands.logger, 'editor.asset.write-failed'); return false; }
		finally { draft.busy = false; }
	}

	async function choose(options: readonly { readonly id: string; readonly name: string }[]): Promise<void> {
		const picked = await pickPlaceable(tr('editor.asset.pick-title'), options);
		if (picked) startDraft(picked.id, picked.answer);
	}

	/**
	 * `choose` for an asset chosen somewhere ELSE — the designer's "Use in plan", arriving as
	 * `ProjectOrigin.assetId` through `useEditorArrival`. Same resolution, same refusals, same
	 * draft; no picker, because the question the picker asks has already been answered.
	 *
	 * It answers whether the tool is armed, which `choose` has no caller that needs. The arrival
	 * carries that verdict back to `PlanEditorView.setState` — and only ONE of that method's two
	 * arms reads it: the already-mounted one, `parsed.planId === this.mountedPlanId && this.root`,
	 * which turns a `false` into `ViewStateResult.history = false`. A hand-off that MOUNTS the
	 * editor for the first time falls past that condition, and its verdict reaches nothing at all.
	 *
	 * `blocked` is deliberately NOT consulted, which is `choose`'s behaviour and not a new
	 * decision: arming a tool writes nothing, and `write` below is what refuses while a save or a
	 * paused projection is in flight.
	 *
	 * It answers `false` SILENTLY on one state: a leaf whose `queries.assetShapes` is unbound,
	 * which is the unrecovered-settings session and in which no placement of any kind is possible.
	 * Every other refusal carries its reason, through the same `REFUSALS` map the picker uses.
	 *
	 * **`available` below is not that same condition and the two must not be read as one.** It is
	 * the CONJUNCTION `commands.renovation !== undefined && queries.assetShapes !== undefined`,
	 * and `arm` consults only the second conjunct — so a leaf with shapes bound and `renovation`
	 * unbound arms a tool whose `write` then refuses silently. **No guard is written for that**,
	 * because the pair cannot diverge in the composition root and an unreachable guard costs a
	 * branch it can never pay back (CLAUDE.md's coverage rule). Read from `planEditorDeps.ts`
	 * rather than assumed: ONE `root.persistence` ternary decides both, handing
	 * `unavailablePlanEditorQueries()` — which declares no `assetShapes` — on the absent arm, and
	 * on the present arm spreading `planningEditorServices(root, …)`, whose own first line returns
	 * `{}` on exactly `!root.persistence` and otherwise always binds `renovation`. A caller that
	 * composes the two independently (a test rig) can produce the divergence; nothing in `src/`
	 * can, and this sentence is the record of the check rather than a promise.
	 */
	async function arm(assetId: string): Promise<boolean> {
		const answer = await resolvePlaceable(assetId);
		if (!answer) return false;
		startDraft(assetId, answer);
		return true;
	}

	async function place(points: readonly [Point, Point]): Promise<void> {
		if (!draft.shape) return;
		const id = createEntityId('element');
		if (await write({ id, kind: 'asset', assetId: draft.assetId, points, name: draft.name })) selection.select([id]);
	}

	/** Repoint one placement at another asset under its own name. No task form is open to show a refusal, so it is reported here. */
	async function replace(elementId: string, options: readonly { readonly id: string; readonly name: string }[]): Promise<void> {
		const current = project.structure.elements?.find(item => item.id === elementId);
		if (current?.kind !== 'asset' || blocked.value) return;
		const picked = await pickPlaceable(tr('editor.asset.replace-title'), options);
		const name = project.plan?.spatialElements?.find(item => item.id === elementId)?.name;
		if (!picked || !name) return;
		draft.error = null; draft.conflict = false;
		// A different asset starts at its own library size (plan editor transform box design, Geometry).
		if (!(await write(withPlacementSize({ ...current, assetId: picked.id, name }, undefined))) && draft.error) notifyOperationFailure(draft.error);
	}

	runtime.toolManager.register(new AssetPlacementTool({ draft, walls: () => project.structure.walls, blocked: () => blocked.value, place: points => { void place(points); } }));
	return { draft, blocked, choose, arm, place, replace, pickPlaceable, write, available: context.commands.renovation !== undefined && context.queries.assetShapes !== undefined };
}
