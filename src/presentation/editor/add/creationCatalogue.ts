import type { StringKey } from '../../i18n/locales/en';
import { t } from '../../i18n/strings';
import type { EditorRuntime } from '../runtime';
import type { ToolId } from '../tools/editor-tool';

export type CreationEntryId = 'room' | 'wall' | 'door' | 'window' | 'opening' | 'area' | 'path' | 'fence' | 'item' | 'measurement' | 'note' | 'stair' | 'arrow';
export type CreationGroup = 'structure' | 'property' | 'planning';
export type CreationRuntime = Pick<EditorRuntime, 'setTool'> & { readonly createNote?: () => void };
export interface CreationEntry {
	readonly id: CreationEntryId;
	readonly group: CreationGroup;
	readonly icon: string;
	readonly labelKey: StringKey;
	readonly descriptionKey: StringKey;
	readonly synonymKeys: readonly StringKey[];
	readonly availability: { readonly kind: 'available' };
	readonly activate: (runtime: CreationRuntime) => void;
}
type EntryFor<K extends CreationEntryId> = CreationEntry & { readonly id: K };
const CREATION_ICONS: Readonly<Record<CreationEntryId, string>> = {
	room: 'square-dashed', wall: 'brick-wall', door: 'door-open', window: 'panels-top-left', opening: 'rectangle-horizontal',
	area: 'land-plot', path: 'route', fence: 'fence', item: 'armchair', measurement: 'ruler', note: 'sticky-note',
	stair: 'rp-stairs', arrow: 'arrow-up-right',
};

/** Every catalogue route is implemented; the menu explains missing capabilities in its current view. */
function toolEntry<K extends CreationEntryId>(id: K, group: CreationGroup, tool: ToolId, synonymKeys: readonly StringKey[] = []): EntryFor<K> {
	return { id, group, icon: CREATION_ICONS[id], labelKey: `editor.add.${id}.label`, descriptionKey: `editor.add.${id}.description`, synonymKeys,
		availability: { kind: 'available' }, activate: runtime => runtime.setTool(tool) };
}
/** The mapped type requires every ID exactly once and prevents a row from naming another ID. */
const ENTRIES_BY_ID: { readonly [K in CreationEntryId]: EntryFor<K> } = {
	room: toolEntry('room', 'structure', 'draw-room', ['editor.add.room.synonyms']),
	wall: toolEntry('wall', 'structure', 'draw-wall'),
	door: toolEntry('door', 'structure', 'place-door'),
	window: toolEntry('window', 'structure', 'place-window'),
	opening: toolEntry('opening', 'structure', 'place-opening'),
	stair: toolEntry('stair', 'structure', 'place-stair'),
	area: toolEntry('area', 'property', 'draw-area', ['editor.add.area.synonyms']),
	path: toolEntry('path', 'property', 'draw-path'),
	fence: toolEntry('fence', 'property', 'draw-fence'),
	item: toolEntry('item', 'planning', 'place-object'),
	measurement: toolEntry('measurement', 'planning', 'measure'),
	arrow: toolEntry('arrow', 'planning', 'draw-arrow'),
	note: {
		id: 'note', group: 'planning', icon: CREATION_ICONS.note, labelKey: 'editor.add.note.label', descriptionKey: 'editor.add.note.description', synonymKeys: [],
		availability: { kind: 'available' },
		activate: runtime => { if (!runtime.createNote) throw new Error('Note requires its planning form capability'); runtime.createNote(); },
	},
};
/** Non-integer keys preserve declaration order: structure, property, planning. */
export const CREATION_CATALOGUE: readonly CreationEntry[] = Object.values(ENTRIES_BY_ID);
/** All UI callers use this doorway; activation only starts the existing task/form. */
export function activateCreationEntry(id: CreationEntryId, runtime: CreationRuntime): void { ENTRIES_BY_ID[id].activate(runtime); }

export function matchesQuery(entry: CreationEntry, query: string, language: string): boolean {
	const needle = query.trim().toLocaleLowerCase();
	if (needle === '') return true;
	const haystack = [entry.labelKey, entry.descriptionKey, ...entry.synonymKeys].map((key) =>
		t(language, key).toLocaleLowerCase(),
	);
	return haystack.some((text) => text.includes(needle));
}
