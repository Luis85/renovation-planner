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

/**
 * One entry whose `id` is pinned to a SINGLE member of the union rather than to the union as a
 * whole. That is what lets the map below key each entry by its own id and have the compiler say
 * so: `wall: unsupported('door', …)` reports
 * `error TS2322: Type 'EntryFor<"door">' is not assignable to type 'EntryFor<"wall">'` — measured
 * by writing that row — rather than mislabelling a menu row at runtime. It is why `unsupported`
 * below is generic in `K`: returning a plain `CreationEntry` would widen every row's `id` back to
 * the union and make each key/id pair unaskable again.
 */
type EntryFor<K extends CreationEntryId> = CreationEntry & { readonly id: K };

const NOT_YET = { kind: 'unsupported', reasonKey: 'editor.add.unsupported.not-yet' } as const;
const refuse = (id: CreationEntryId) => (): never => {
	throw new Error(`creation entry '${id}' is unsupported and must not be activated`);
};

function unsupported<K extends CreationEntryId>(id: K, group: CreationGroup): EntryFor<K> {
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
 * M02's catalogue as DATA (design spec §7.1), keyed by id and declared ONCE. Room routes to
 * the rectangular room tool (`'draw-room'`); the room itself does
 * not exist until the temporary tool banner's Finish action turns the draft into a Zone typed
 * Room (Task 8), so `activate` here only arms the tool rather than creating anything. Area
 * activates its own polygon-tool instance with a Custom Zone completion (ADR-0016). The other
 * entries remain unsupported with a reason.
 * Declaration order IS the locked group order — see `CREATION_CATALOGUE` below. The `as StringKey`
 * casts above are the one place a key is built by interpolation; `creationCatalogue.test.ts`
 * resolves every key in both locales, which is what a template string would otherwise escape.
 *
 * **The annotation is the totality check, and it replaces a cast that ASSERTED totality while
 * nothing held it.** This map used to be `Object.fromEntries(CREATION_CATALOGUE.map(…)) as
 * Record<CreationEntryId, CreationEntry>` under a docblock reading "carries exactly one entry per
 * member, so this lookup cannot miss" — `Object.fromEntries` infers `{ [k: string]:
 * CreationEntry }`, so the cast was the only thing making that sentence true, and it made it true
 * by assertion. Measured rather than argued: adding `| 'stair'` to `CreationEntryId` with no row
 * for it left `vue-tsc` completely silent about this file, `AddMenu` rendered the row, and
 * pressing it threw `TypeError: Cannot read properties of undefined (reading 'activate')` —
 * uncaught, because `Record<K, V>` index access is non-optional and `activateCreationEntry` below
 * therefore has no `undefined` arm to write. With the literal annotated, the same mutation is a
 * build failure at the opening brace below:
 *
 * ```
 * error TS2741: Property 'stair' is missing in type '{ room: {…}; … note: EntryFor<…>; }'
 * but required in type '{ readonly room: EntryFor<"room">; … readonly stair: EntryFor<…>; }'.
 * ```
 *
 * "Exactly one entry per member" is FOUR compiler rules rather than a sentence, and each was
 * measured by writing the mutation and reading `vue-tsc`: a missing member is that `TS2741`, an
 * EXTRA key is `TS2353` ("Object literal may only specify known properties, and 'stair' does not
 * exist in type …"), a duplicate key is `TS1117` ("An object literal cannot have multiple
 * properties with the same name"), and a row whose entry disagrees with its key is the `TS2322`
 * quoted at `EntryFor` above. What no type reaches: whether an entry's `group` is the right one,
 * and whether the ORDER below is the order the design spec draws — both stay cases.
 */
const ENTRIES_BY_ID: { readonly [K in CreationEntryId]: EntryFor<K> } = {
	room: {
		id: 'room',
		group: 'structure',
		labelKey: 'editor.add.room.label',
		descriptionKey: 'editor.add.room.description',
		synonymKeys: ['editor.add.room.synonyms'],
		availability: { kind: 'available' },
		activate: (runtime) => runtime.setTool('draw-room'),
	},
	wall: unsupported('wall', 'structure'),
	door: unsupported('door', 'structure'),
	window: unsupported('window', 'structure'),
	area: {
		id: 'area',
		group: 'property',
		labelKey: 'editor.add.area.label',
		descriptionKey: 'editor.add.area.description',
		synonymKeys: ['editor.add.area.synonyms'],
		availability: { kind: 'available' },
		activate: (runtime) => runtime.setTool('draw-area'),
	},
	path: unsupported('path', 'property'),
	fence: unsupported('fence', 'property'),
	item: unsupported('item', 'planning'),
	measurement: unsupported('measurement', 'planning'),
	note: unsupported('note', 'planning'),
};

/**
 * The same ten entries as a LIST, in the locked group order the Add menu renders — structure,
 * property, planning — which is the declaration order of the map above.
 *
 * `Object.values` is what preserves it, and that is a spec guarantee rather than an
 * implementation detail: ES2015's [[OwnPropertyKeys]] returns integer-index keys in ascending
 * numeric order and every other string key in CREATION order, and not one `CreationEntryId` is an
 * integer index. A member spelled `'2'` would be the one shape that reorders itself, which is why
 * the ids are words and why `creationCatalogue.test.ts` pins the whole sequence by name rather
 * than only the three groups — the compiler owns totality, and ORDER stays a case.
 */
export const CREATION_CATALOGUE: readonly CreationEntry[] = Object.values(ENTRIES_BY_ID);

/**
 * The ONE door onto a catalogue entry's `activate` (design spec §7.1, Task 10). Both the Add
 * menu's own click/keyboard activation and the no-rooms empty state's action button
 * (`PlanEditorRoot.vue`'s `onEmptyStateAction`) call this and nothing else — never
 * `entry.activate(...)` directly, and never a second, independently-decided route to the same
 * effect. An unsupported entry's own `activate` already throws (`refuse`, above), so calling
 * this with an unsupported id throws too; there is no second refusal to write here.
 *
 * The lookup cannot MISS for the reason `ENTRIES_BY_ID` states — that map's own annotation refuses
 * a union member with no row — so there is no "not found" arm, dead or live, and none to test.
 * Read that narrowly: it holds while `id` really IS a `CreationEntryId`, and a caller who reaches
 * this door through an `as CreationEntryId` cast on a foreign string is outside what any type
 * here can hold. That cast is exactly how the `TypeError` quoted above was reproduced.
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
