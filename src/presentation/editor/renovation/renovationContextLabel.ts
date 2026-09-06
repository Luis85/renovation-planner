import { computed } from 'vue';
import type { SpatialLink } from '../../../domain/renovation/SharedLinks';
import { useProjectStore } from '../../stores/ProjectStore';
import { structureRecords } from '../structure/structureRecords';
import { tr } from '../../i18n/strings';

export function useRenovationContextLabel(): (link: SpatialLink) => string {
	const project = useProjectStore();
	const names = computed(() => new Map([...project.zones.values(), ...structureRecords(project.structure, project.plan?.id ?? '')].map(item => [item.id, item.name])));
	return link => {
		const room = names.value.get(link.roomId) ?? tr('editor.selection.unknown');
		const target = names.value.get(link.targetId) ?? tr('editor.selection.unknown');
		return link.roomId === link.targetId ? room : `${room} · ${target}`;
	};
}
