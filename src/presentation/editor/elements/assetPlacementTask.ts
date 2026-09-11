import { computed } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import { createEntityId } from '../../../core/identity/generateId';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';
import type { AssetShapeAnswer } from '../../read-models/assetShapes';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import { notifyFault, notifyWarning } from '../../notices/notify';
import { useDialogStore } from '../../dialogs/dialog-store';
import { useProjectStore } from '../../stores/ProjectStore';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useSaveStateStore } from '../save-state/save-state-store';
import { useSelectionStore } from '../selection/selection-store';
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

	/** The picker, then the shape: an asset that cannot be drawn is refused here with its reason, before any tool starts. */
	async function pickPlaceable(title: string, options: readonly { readonly id: string; readonly name: string }[]): Promise<{ id: string; answer: Extract<AssetShapeAnswer, { kind: 'placeable' }> } | null> {
		if (dialogs.current !== null || !context.queries.assetShapes) return null;
		const picked = await dialogs.openDialog({ kind: 'entity-picker', title, candidates: options.map(option => ({ id: option.id, label: option.name })) });
		if (picked === 'cancel') return null;
		const answer = (await context.queries.assetShapes([picked.id])).get(picked.id);
		if (answer?.kind === 'placeable') return { id: picked.id, answer };
		notifyWarning(tr(REFUSALS[answer?.kind ?? 'unreadable']));
		return null;
	}

	/** One reversible write through the leaf's dispatcher, from a fresh baseline: a second placement must not reuse the first one's version. */
	async function write(element: NamedSpatialElement): Promise<boolean> {
		const services = context.commands.renovation;
		if (blocked.value || !services) return false;
		draft.busy = true;
		try {
			const baseline = await services.read(context.planId as PlanId);
			if (!baseline.ok) { draft.error = baseline.error; return false; }
			const result = await runtime.dispatcher.run(services.command(baseline.value, elementInput(baseline.value, element), runtime.ledger));
			if (result.ok) { draft.error = null; return true; }
			draft.error = result.error;
			if (WRITE_BOUNDARY_CODES.some(code => result.error.code.endsWith(code))) await runtime.refreshProjection();
			return false;
		} catch (cause) { notifyFault(cause, context.commands.logger, 'editor.asset.write-failed'); return false; }
		finally { draft.busy = false; }
	}

	async function choose(options: readonly { readonly id: string; readonly name: string }[]): Promise<void> {
		const picked = await pickPlaceable(tr('editor.asset.pick-title'), options);
		if (!picked) return;
		Object.assign(draft, { assetId: picked.id, name: picked.answer.name, shape: picked.answer.shape, preview: null, error: null, text: { x: '', y: '' } });
		runtime.setTool('place-asset');
	}

	async function place(points: readonly [Point, Point]): Promise<void> {
		if (!draft.shape) return;
		const id = createEntityId('element');
		if (await write({ id, kind: 'asset', assetId: draft.assetId, points, name: draft.name })) selection.select([id]);
	}

	runtime.toolManager.register(new AssetPlacementTool({ draft, walls: () => project.structure.walls, blocked: () => blocked.value, place: points => { void place(points); } }));
	return { draft, blocked, choose, place, pickPlaceable, write, available: context.commands.renovation !== undefined && context.queries.assetShapes !== undefined };
}
