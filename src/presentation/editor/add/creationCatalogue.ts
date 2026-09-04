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
 * rectangular room tool (`'draw-room'`); the room itself does not exist until the temporary tool
 * banner's Finish action turns the draft into a Zone typed Room (Task 8), so `activate` here only
 * arms the tool rather than creating anything. Everything else is unsupported with a reason, so
 * the menu can explain rather than offer a dead control. Order IS the locked group order. The
 * `as StringKey` casts above are the one place a key is built by interpolation;
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
		activate: (runtime) => runtime.setTool('draw-room'),
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
 * `CreationEntryId` is closed and `CREATION_CATALOGUE` carries exactly one entry per member, so
 * this lookup cannot miss — there is no "not found" arm to write, dead or live, and therefore
 * none to test. Built once at module load rather than re-scanned on every call.
 */
const ENTRIES_BY_ID: Record<CreationEntryId, CreationEntry> = Object.fromEntries(
	CREATION_CATALOGUE.map((entry) => [entry.id, entry]),
) as Record<CreationEntryId, CreationEntry>;

/**
 * The ONE door onto a catalogue entry's `activate` (design spec §7.1, Task 10). Both the Add
 * menu's own click/keyboard activation and the no-rooms empty state's action button
 * (`PlanEditorRoot.vue`'s `onEmptyStateAction`) call this and nothing else — never
 * `entry.activate(...)` directly, and never a second, independently-decided route to the same
 * effect. An unsupported entry's own `activate` already throws (`refuse`, above), so calling
 * this with an unsupported id throws too; there is no second refusal to write here.
 */
export function activateCreationEntry(id: CreationEntryId, runtime: Pick<EditorRuntime, 'setTool'>): void {
	ENTRIES_BY_ID[id].activate(runtime);
}

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
