import type { StringKey } from '../../i18n/locales/en';
import { t } from '../../i18n/strings';
import type { EditorRuntime } from '../runtime';

export type CreationEntryId =
	| 'room'
	| 'wall'
	| 'door'
	| 'window'
	| 'area'
	| 'path'
	| 'fence'
	| 'item'
	| 'measurement'
	| 'note';
export type CreationGroup = 'structure' | 'property' | 'planning';

export interface CreationEntry {
	readonly id: CreationEntryId;
	readonly group: CreationGroup;
	readonly labelKey: StringKey;
	readonly descriptionKey: StringKey;
	readonly synonymKeys: readonly StringKey[];
	readonly availability: { readonly kind: 'available' } | { readonly kind: 'unsupported'; readonly reasonKey: StringKey };
	/** Only called for an available entry; an unsupported one THROWS so a menu that called it fails a test loudly. */
	readonly activate: (runtime: Pick<EditorRuntime, 'setTool'>) => void;
}

const NOT_YET = { kind: 'unsupported', reasonKey: 'editor.add.unsupported.not-yet' } as const;
const refuse = (id: CreationEntryId) => (): never => {
	throw new Error(`creation entry '${id}' is unsupported and must not be activated`);
};

function unsupported(id: CreationEntryId, group: CreationGroup): CreationEntry {
	return {
		id,
		group,
		labelKey: `editor.add.${id}.label` as StringKey,
		descriptionKey: `editor.add.${id}.description` as StringKey,
		synonymKeys: [],
		availability: NOT_YET,
		activate: refuse(id),
	};
}

/**
 * M02's catalogue as DATA (design spec §7.1). Room is the one available entry and routes to the
 * existing draw tool, which already creates a Zone typed Room; everything else is unsupported
 * with a reason, so the menu can explain rather than offer a dead control. Order IS the locked
 * group order. The `as StringKey` casts above are the one place a key is built by interpolation;
 * `creationCatalogue.test.ts` resolves every key in both locales, which is what a template
 * string would otherwise escape.
 */
export const CREATION_CATALOGUE: readonly CreationEntry[] = [
	{
		id: 'room',
		group: 'structure',
		labelKey: 'editor.add.room.label',
		descriptionKey: 'editor.add.room.description',
		synonymKeys: ['editor.add.room.synonyms'],
		availability: { kind: 'available' },
		activate: (runtime) => runtime.setTool('draw-polygon'),
	},
	unsupported('wall', 'structure'),
	unsupported('door', 'structure'),
	unsupported('window', 'structure'),
	unsupported('area', 'property'),
	unsupported('path', 'property'),
	unsupported('fence', 'property'),
	unsupported('item', 'planning'),
	unsupported('measurement', 'planning'),
	unsupported('note', 'planning'),
];

/**
 * Label, description or any synonym contains the (case-folded) query — the whole of the Add
 * menu's search. `language` is a plain `string` rather than a `Language` type: `strings.ts`
 * exports none, and `t` itself takes `language: string`, so this stays what it already is
 * rather than inventing a type nothing else in the plugin declares.
 */
export function matchesQuery(entry: CreationEntry, query: string, language: string): boolean {
	const needle = query.trim().toLocaleLowerCase();
	if (needle === '') return true;
	const haystack = [entry.labelKey, entry.descriptionKey, ...entry.synonymKeys].map((key) =>
		t(language, key).toLocaleLowerCase(),
	);
	return haystack.some((text) => text.includes(needle));
}
