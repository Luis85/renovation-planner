import { describe, expect, it } from 'vitest';
import {
	isCompleted,
	nameCollator,
	orderProjects,
} from '../../../src/presentation/views/projectOrder';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

function project(over: Partial<ProjectSummaryDto>): ProjectSummaryDto {
	return {
		id: over.name ?? 'x',
		name: 'x',
		status: 'IDEA',
		currency: 'EUR',
		libraryOverlap: false,
		planCount: 0,
		lastWorked: null,
		...over,
	};
}

const collator = nameCollator('en');

describe('orderProjects', () => {
	it('puts the most recently worked project first', () => {
		const ordered = orderProjects(
			[
				project({ name: 'Older', lastWorked: '2026-01-01T00:00:00.000Z' }),
				project({ name: 'Newer', lastWorked: '2026-08-01T00:00:00.000Z' }),
			],
			collator,
			new Map(),
		);

		expect(ordered.map((p) => p.name)).toEqual(['Newer', 'Older']);
	});

	it('falls back to name ascending on a tie', () => {
		const same = '2026-08-01T00:00:00.000Z';
		const ordered = orderProjects(
			[project({ name: 'Bathroom', lastWorked: same }), project({ name: 'Attic', lastWorked: same })],
			collator,
			new Map(),
		);

		expect(ordered.map((p) => p.name)).toEqual(['Attic', 'Bathroom']);
	});

	it('sorts a null lastWorked to the tail, by name', () => {
		// A project the vault could answer for no note of is not "worked on at the epoch" and
		// must not lead the list; it is simply undated.
		const ordered = orderProjects(
			[
				project({ name: 'Zed', lastWorked: null }),
				project({ name: 'Attic', lastWorked: null }),
				project({ name: 'Dated', lastWorked: '2020-01-01T00:00:00.000Z' }),
			],
			collator,
			new Map(),
		);

		expect(ordered.map((p) => p.name)).toEqual(['Dated', 'Attic', 'Zed']);
	});

	it('is stable, so a re-hydrate never reshuffles equal rows', () => {
		const equal = [project({ name: 'Same', id: 'a' }), project({ name: 'Same', id: 'b' })];

		// A FRESH map per call here: this case is about the comparator's stability, not about the
		// per-mount freeze, and sharing one would make the second call trivially agree with the
		// first for the wrong reason.
		expect(orderProjects(equal, collator, new Map()).map((p) => p.id)).toEqual(['a', 'b']);
		expect(
			orderProjects(orderProjects(equal, collator, new Map()), collator, new Map()).map((p) => p.id),
		).toEqual(['a', 'b']);
	});

	it('does not mutate its input', () => {
		// The store hands it `projects.value`, a readonly array by declaration and a live Pinia
		// ref underneath. An in-place `.sort()` would reorder the store from a computed.
		const input = [project({ name: 'B' }), project({ name: 'A' })];
		orderProjects(input, collator, new Map());

		expect(input.map((p) => p.name)).toEqual(['B', 'A']);
	});

	/**
	 * The task's own constraint, and the case the brief's own suite does not carry: a SHARED
	 * `sortKeys` map — the shape a mounted `ProjectList` actually holds across a re-hydrate —
	 * must freeze the order even when the underlying `lastWorked` on an already-seen project
	 * moves. Without the freeze, a second call with fresh DTOs (a hydrate) would re-sort
	 * around the newly-arrived date and reshuffle a row under the user's cursor for a write
	 * that changed no name and no count.
	 */
	it('freezes the order across a shared sortKeys map even when lastWorked moves', () => {
		const sortKeys = new Map<string, string | null>();
		const first = orderProjects(
			[
				project({ id: 'a', name: 'Attic', lastWorked: '2020-01-01T00:00:00.000Z' }),
				project({ id: 'b', name: 'Bathroom', lastWorked: '2026-08-01T00:00:00.000Z' }),
			],
			collator,
			sortKeys,
		);
		expect(first.map((p) => p.id)).toEqual(['b', 'a']);

		// Same two projects, same map — but Attic was just worked on and would now sort FIRST
		// on its live `lastWorked`. The frozen key it captured on the first call must win.
		const second = orderProjects(
			[
				project({ id: 'a', name: 'Attic', lastWorked: '2026-09-01T00:00:00.000Z' }),
				project({ id: 'b', name: 'Bathroom', lastWorked: '2026-08-01T00:00:00.000Z' }),
			],
			collator,
			sortKeys,
		);
		expect(second.map((p) => p.id)).toEqual(['b', 'a']);
	});

	it('collates by the given language’s rules', () => {
		const ordered = orderProjects(
			[project({ name: 'Zimmer' }), project({ name: 'Ähre' })],
			nameCollator('de'),
			new Map(),
		);

		// Base sensitivity: `Ä` collates with `A`, so it leads. A raw `<` comparison on the
		// code units puts every accented name after `Z`.
		expect(ordered.map((p) => p.name)).toEqual(['Ähre', 'Zimmer']);
	});
});

describe('isCompleted', () => {
	it('names exactly the two terminal stages', () => {
		expect(isCompleted(project({ status: 'COMPLETE' }))).toBe(true);
		expect(isCompleted(project({ status: 'AS_BUILT' }))).toBe(true);
		expect(isCompleted(project({ status: 'INSPECTION' }))).toBe(false);
		// A status this build cannot place is not completed — it is unknown, and an unknown
		// project hidden in a collapsed group is a project the user cannot find.
		expect(isCompleted(project({ status: 'PLANNING' }))).toBe(false);
	});
});
