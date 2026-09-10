import { computed } from 'vue';
import { useEditorRuntime } from '../runtime';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { useDirectActionContext } from '../selection/directActionContext';
import { inRenovationScope } from '../renovation/renovationSummary';
import { orderEvidenceByDate } from './evidenceOrder';

/** Existing details reuse the retained evidence projection and its native Photos route. */
export function useExistingPhotos() {
	const runtime = useEditorRuntime(), workspace = useWorkspaceStore();
	const { target, session } = useDirectActionContext();
	return computed(() => {
		if (session.perspective !== 'renovate' || session.mode !== 'existing'
			|| !target.value?.visible || !workspace.layerVisibility.annotation
			|| runtime.activeToolId.value !== 'select' || runtime.renderState.rotationDegrees !== null) return [];
		return orderEvidenceByDate((runtime.planning.baseline.value?.plan.entity.renovation?.depth?.evidence ?? [])
			.filter(item => item.type === 'photo' && inRenovationScope(item, session.roomId, session.targetId)));
	});
}
