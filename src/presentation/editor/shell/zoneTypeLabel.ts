import type { StringKey } from '../../i18n/locales/en';

const LABELS: Readonly<Record<string, StringKey>> = {
	object: 'editor.add.item.label',
	path: 'editor.add.path.label',
	fence: 'editor.add.fence.label',
	measurement: 'editor.add.measurement.label',
	Wall: 'editor.add.wall.label',
	Opening: 'editor.add.opening.label',
	Room: 'editor.zone-type.Room',
	Garden: 'editor.zone-type.Garden',
	Terrace: 'editor.zone-type.Terrace',
	Driveway: 'editor.zone-type.Driveway',
	Roof: 'editor.zone-type.Roof',
	ConstructionArea: 'editor.zone-type.ConstructionArea',
	Custom: 'editor.zone-type.Custom',
};

export function zoneTypeLabel(zoneType: string): StringKey {
	return LABELS[zoneType] ?? 'editor.zone-type.Custom';
}
