import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { t } from '../../../../src/presentation/i18n/strings';
import type { ToolId } from '../../../../src/presentation/editor/tools/editor-tool';
import {
	activateCreationEntry,
	CREATION_CATALOGUE,
	matchesQuery,
	type CreationEntry,
	type CreationEntryId,
} from '../../../../src/presentation/editor/add/creationCatalogue';

/** A `.find` that fails LOUDLY at the assertion that named the id, rather than a non-null cast. */
function entryById(id: CreationEntryId): CreationEntry {
	const entry = CREATION_CATALOGUE.find((e) => e.id === id);
	if (entry === undefined) throw new Error(`no catalogue entry for '${id}'`);
	return entry;
}

/**
 * The homeowner creation catalogue (design spec §7.1) as DATA: which of the ten entries is
 * reachable today, what each one says in both locales, and the search predicate the menu
 * filters through. No Vue, no Pinia, no Konva — pure logic, asked of the function.
 */
describe('the creation catalogue', () => {
	it('offers Room and Area, each activating its own geometry path', () => {
		const available = CREATION_CATALOGUE.filter((e) => e.availability.kind === 'available');
		expect(available.map((e) => e.id)).toEqual(['room', 'area']);
		const setTool = vi.fn<(id: ToolId | null) => void>();
		available[0].activate({ setTool });
		expect(setTool).toHaveBeenCalledWith('draw-room');
		expect(setTool).toHaveBeenCalledTimes(1);
		setTool.mockClear();
		activateCreationEntry('area', { setTool });
		expect(setTool).toHaveBeenCalledExactlyOnceWith('draw-area');
		expect(matchesQuery(entryById('area'), 'Terrasse', 'de')).toBe(true);
		expect(matchesQuery(entryById('area'), 'garden', 'en')).toBe(true);
	});

	it('every unsupported entry carries a reason and throws if activated', () => {
		for (const entry of CREATION_CATALOGUE.filter((e) => e.availability.kind === 'unsupported')) {
			expect(entry.availability).toEqual({ kind: 'unsupported', reasonKey: 'editor.add.unsupported.not-yet' });
			expect(() => entry.activate({ setTool: vi.fn<(id: ToolId | null) => void>() })).toThrow(/unsupported/);
		}
	});

	it('contains no internal vocabulary in either locale', () => {
		for (const entry of CREATION_CATALOGUE) {
			for (const language of ['en', 'de'] as const) {
				const text = [
					t(language, entry.labelKey),
					t(language, entry.descriptionKey),
					...entry.synonymKeys.map((k) => t(language, k)),
				].join(' ');
				expect(text).not.toMatch(/zone|polygon|vertex|scene|calibrat/i);
			}
		}
	});

	it('search matches a synonym', () => {
		const room = entryById('room');
		expect(matchesQuery(room, 'KITCH', 'en')).toBe(true);
		expect(matchesQuery(room, 'fence', 'en')).toBe(false);
	});

	it('search matches a label with no query at all', () => {
		const room = entryById('room');
		expect(matchesQuery(room, '', 'en')).toBe(true);
		expect(matchesQuery(room, '   ', 'en')).toBe(true);
	});

	it('groups appear in the locked order: structure, property, planning', () => {
		const groups = [...new Set(CREATION_CATALOGUE.map((e) => e.group))];
		expect(groups).toEqual(['structure', 'property', 'planning']);
	});

	/**
	 * ORDER is the half of the catalogue's contract the compiler does NOT own, and it needs its
	 * own case for two reasons the group case above cannot cover.
	 *
	 * `CREATION_CATALOGUE` is `Object.values(ENTRIES_BY_ID)` since the totality fix, so the list
	 * is DERIVED from a map and its order is the map's declaration order — a property of
	 * `[[OwnPropertyKeys]]`, not of anything a type checks. And the group case passes with `room`
	 * and `wall` swapped, or with any two entries of one group exchanged, because it reads the
	 * groups as a set of first appearances.
	 *
	 * What it does NOT prove is one entry per union member — that is `ENTRIES_BY_ID`'s own
	 * annotation and the four compiler errors its docblock quotes. This is a sequence, so it
	 * would go red for a dropped or reordered row and CANNOT go red for a member the union grew
	 * and the map never gained: such a build does not run at all.
	 */
	it('lists every entry once, in the exact order the Add menu renders', () => {
		expect(CREATION_CATALOGUE.map((e) => e.id)).toEqual([
			'room',
			'wall',
			'door',
			'window',
			'area',
			'path',
			'fence',
			'item',
			'measurement',
			'note',
		]);
	});

	it('activateCreationEntry is the one door: Room reaches setTool("draw-room") exactly once', () => {
		const setTool = vi.fn<(id: ToolId | null) => void>();
		activateCreationEntry('room', { setTool });
		expect(setTool).toHaveBeenCalledTimes(1);
		expect(setTool).toHaveBeenCalledWith('draw-room');
		expect(() => activateCreationEntry('wall', { setTool })).toThrow(/unsupported/);
	});
});

/**
 * "One door" is a claim about EVERY caller, and a catalogue test cannot see a second one
 * hiding in a Vue file — which is exactly what happened: a review round found `AddMenu.vue`
 * calling `entry.activate(runtime)` directly while this file's own docblock on
 * `activateCreationEntry` asserted "never `entry.activate(...)` directly" as settled fact. This
 * reads BOTH callers' SOURCE TEXT instead — the same instrument `entityRef.test.ts` uses for a
 * caller list — so it is blind exactly where that instrument says it is: it cannot tell a
 * comment from code, and a call reached through a re-export or an alias would not match either
 * literal below. What each case proves is narrow and cheap: the file names
 * `activateCreationEntry(` at all, and no direct `entry.activate(`/`.activate(runtime` call sits
 * anywhere in it — so neither caller can grow a second, undocumented route to the catalogue's
 * `activate` without one of these failing.
 */
describe('activateCreationEntry is the one door onto the catalogue, not entry.activate(...) directly', () => {
	it("PlanEditorRoot.vue's empty-state action calls activateCreationEntry('room' and never setTool('draw- directly", () => {
		const source = readFileSync('src/presentation/editor/PlanEditorRoot.vue', 'utf8');
		expect(source).toContain("activateCreationEntry('room'");
		expect(source).not.toMatch(/setTool\('draw-/);
	});

	it("AddMenu.vue's activation calls activateCreationEntry( and never entry.activate( or .activate(runtime directly", () => {
		const source = readFileSync('src/presentation/editor/add/AddMenu.vue', 'utf8');
		expect(source).toContain('activateCreationEntry(');
		expect(source).not.toMatch(/entry\.activate\(/);
		expect(source).not.toMatch(/\.activate\(runtime/);
	});
});
