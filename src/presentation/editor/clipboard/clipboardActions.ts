import { computed, inject, provide, type InjectionKey } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { EntityId } from '../../../core/identity/EntityId';
import { createEntityId } from '../../../core/identity/generateId';
import type { PlanId } from '../../../domain/plan/PlanId';
import { captureClipboard, type SpatialClipboard } from '../../../domain/spatial/clipboard';
import { PasteCommand } from '../../../application/commands/spatial/PasteCommand';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorStore } from '../../stores/EditorStore';
import { notifyFault } from '../../notices/notify';
import { reportDispatchFailure } from '../report-failure';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { stageCentreWorld } from '../viewport/Viewport';
import { createZoneHistory } from '../add/createZoneHistory';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';

type ClipboardRuntime = Pick<EditorRuntime, 'dispatcher' | 'writesBlocked' | 'structureTask' | 'structureActions' | 'elementActions' | 'rotationActions' | 'groupActions'>;

/** Copy and Paste for ONE leaf, over the clipboard every leaf shares (design spec §6). */
function createClipboardActions(context: PlanEditorContext, runtime: ClipboardRuntime) {
	const project = useProjectStore(), editor = useEditorStore(), selection = useSelectionStore(), session = useRenovationSession();
	const copied = computed(() => captureClipboard({
		rooms: [...project.zones.values()].map(zone => ({ key: zone.id, name: zone.name, zoneType: zone.zoneType, points: zone.points, bulges: zone.bulges })),
		structure: project.structure, names: project.plan?.spatialElements ?? [], groups: project.groups,
	}, selection.selectedIds));
	/**
	 * Everything a paste needs, or `null` whenever one would be refused — Review and a stale floor included — or would
	 * strand an element, structure, rotation or group edit already reading its baseline, whose save would then refuse
	 * as stale. `rotationActions.active` and `groupActions.active` fold in their OWN wall/group in-flight reads
	 * already (see each one's declaration), so this reads no more than what `EditorRuntime` already exposes.
	 */
	const ready = computed(() => {
		const clipboard = context.clipboard.value, { renovation, groups } = context.commands;
		const editing = runtime.structureActions.active.value || runtime.elementActions.active.value || runtime.rotationActions.active.value || runtime.groupActions.active.value;
		return clipboard && renovation && groups && !runtime.writesBlocked.value && !editing && session.perspective !== 'review' ? { clipboard, renovation, groups } : null;
	});
	function copy(): boolean {
		// Plain data, never the store's reactive proxies: the clipboard outlives this leaf.
		if (copied.value) context.clipboard.value = JSON.parse(JSON.stringify(copied.value)) as SpatialClipboard;
		return copied.value !== null;
	}
	async function paste(target: Point = editor.pointerWorld ?? stageCentreWorld(editor.stageSize, editor.viewport)): Promise<void> {
		const value = ready.value;
		if (!value) return;
		const ledger = runtime.structureTask.ledger;
		const command = new PasteCommand({ createRoom: input => createZoneHistory(context, ledger, input), renovation: value.renovation, groups: value.groups, ledger, mintId: prefix => createEntityId(prefix) },
			{ planId: context.planId as PlanId, clipboard: value.clipboard, target });
		try {
			const result = await runtime.dispatcher.run(command);
			// `select` focuses the first id whenever the old focus is not among the new ones, which pasted ids never are.
			if (result.ok) selection.select(command.pastedIds.map(id => id as EntityId<string>));
			else reportDispatchFailure(result.error);
		} catch (cause) { notifyFault(cause, context.commands.logger, 'editor.clipboard.paste-failed'); }
	}
	return { canCopy: computed(() => copied.value !== null), canPaste: computed(() => ready.value !== null), hasClipboard: computed(() => context.clipboard.value !== null), copy, paste };
}

export type ClipboardActions = ReturnType<typeof createClipboardActions>;
const KEY: InjectionKey<ClipboardActions> = Symbol('renovation-planner:editor-clipboard');

/** Provided by `PlanEditorRoot` rather than added to `EditorRuntime`, whose file is at its line budget. */
export function provideClipboardActions(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'dispatcher' | 'writesBlocked' | 'structureTask' | 'structureActions' | 'elementActions' | 'rotationActions' | 'groupActions'>): ClipboardActions {
	const actions = createClipboardActions(context, runtime);
	provide(KEY, actions);
	return actions;
}

/** `null` outside a mounted editor: the context menu mounted on its own has no clipboard to offer. */
export function useClipboardActions(): ClipboardActions | null {
	return inject(KEY, null);
}
