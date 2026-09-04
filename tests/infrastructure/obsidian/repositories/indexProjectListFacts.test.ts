/**
 * `IndexProjectListFacts` — the two facts the Renovation Planner Home commissions for a
 * project ROW (§8): how many plans it holds, and when it was last worked on.
 *
 * Driven against the REAL `InMemoryProjectIndex` rather than a hand-written double, the way
 * `listProjectsOverlaps.test.ts` drives the real one for `IndexLibraryOverlaps`: the whole
 * question here is what the index actually holds, and a double would be a fake thinner than
 * the thing the class reads through.
 *
 * The vault side is a one-method stand-in for `FactsVault`, and it hands back the mock's own
 * `TFile` CLASS rather than a `{ stat }` shape — every sibling in `infrastructure/` narrows
 * with `instanceof TFile`, so a plain object would make this class the only one whose fake
 * cannot answer the narrowing its production code performs.
 */
import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { IndexProjectListFacts } from '../../../../src/infrastructure/obsidian/repositories/IndexProjectListFacts';
import { InMemoryProjectIndex } from '../../../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import type { ProjectIndexEntry } from '../../../../src/application/ports/ProjectIndex';
import type { EntityId } from '../../../../src/core/identity/EntityId';
import type { ProjectId } from '../../../../src/domain/project/ProjectId';

const P1 = 'project-1' as ProjectId;
const P2 = 'project-2' as ProjectId;

/**
 * A project note carries no `project:` frontmatter key — `projectFrontmatter.ts` declares
 * none and `buildProjectIndexEntries` reads `frontmatter['project']` — so a project's OWN
 * entry has `projectId: undefined`. Measured, not assumed. An implementation grouping on
 * `projectId` alone would therefore never see a project's `Project.md`, which is the one note
 * whose mtime a project with no plans has.
 *
 * The asset entry carries no `projectId` either, and for a different reason: design slice 19
 * took the project id off the Asset entirely. It is what makes an entry belonging to NO
 * project an ordinary member of this index rather than a hypothetical.
 */
const ENTRIES: readonly ProjectIndexEntry[] = [
	{ id: P1 as unknown as EntityId<string>, type: 'renovation-project', path: 'R/One/Project.md' },
	{
		id: 'plan-a' as EntityId<string>,
		type: 'renovation-plan',
		path: 'R/One/Plan/a.md',
		projectId: P1,
		geometrySidecarPath: 'R/One/Geometry/plan-a.rpgeo',
	},
	{ id: 'plan-b' as EntityId<string>, type: 'renovation-plan', path: 'R/One/Plan/b.md', projectId: P1 },
	{ id: 'zone-a' as EntityId<string>, type: 'renovation-zone', path: 'R/One/Zone/a.md', projectId: P1 },
	{ id: 'asset-a' as EntityId<string>, type: 'renovation-asset', path: 'Library/Asset/a.md' },
	{ id: P2 as unknown as EntityId<string>, type: 'renovation-project', path: 'R/Two/Project.md' },
];

const MTIMES: Readonly<Record<string, number>> = {
	'R/One/Project.md': 1_000,
	'R/One/Plan/a.md': 2_000,
	'R/One/Plan/b.md': 3_000,
	// The most recent note in project One is a ZONE — not its Project.md and not a plan.
	'R/One/Zone/a.md': 9_000,
	// Newer than anything project One owns, and owned by no project at all: an entry with no
	// owner must not be attributed to whichever project is being answered for.
	'Library/Asset/a.md': 99_000,
	'R/Two/Project.md': 5_000,
};

function fileAt(path: string, mtime: number): TFile {
	const file = new TFile();
	file.path = path;
	// `ctime` is not optional on Obsidian's own `FileStats`, and leaving it out was caught by
	// the compiler rather than by a reader — a fake thinner than the real thing, in the file
	// asserting it is not one. A file that has been modified reports `ctime <= mtime`, so the
	// creation time is stamped behind the modification the fixture is about.
	file.stat = { ctime: mtime, mtime, size: 0 };
	return file;
}

function vaultOver(paths: Readonly<Record<string, number>>): { getAbstractFileByPath: (path: string) => TFile | null } {
	return {
		getAbstractFileByPath: (path) => {
			const mtime = paths[path];
			return mtime === undefined ? null : fileAt(path, mtime);
		},
	};
}

function indexOver(entries: readonly ProjectIndexEntry[]): InMemoryProjectIndex {
	const index = new InMemoryProjectIndex();
	// The second argument is this branch's exclusions collection (Task 2), which `main` had
	// no caller for when it wrote this helper. Empty: none of these fixtures is an excluded
	// note, and passing `[]` states that rather than leaving the parameter to a default that
	// would hide a fixture which grew one.
	index.rebuild(entries, []);
	return index;
}

function facts(paths: Readonly<Record<string, number>> = MTIMES): IndexProjectListFacts {
	return new IndexProjectListFacts(indexOver(ENTRIES), vaultOver(paths));
}

const iso = (mtime: number): string => new Date(mtime).toISOString();

describe('IndexProjectListFacts', () => {
	it('counts only plan entries, and only that project’s', () => {
		const answer = facts().factsFor([P1, P2]);

		expect(answer.get(P1)?.planCount).toBe(2);
		expect(answer.get(P2)?.planCount).toBe(0);
	});

	it('takes lastWorked from the most recent note of ANY type the project owns', () => {
		const answer = facts().factsFor([P1]);

		expect(answer.get(P1)?.lastWorked).toBe(iso(9_000));
	});

	it('includes the project’s own note, whose entry carries no projectId', () => {
		// P2 owns nothing but its Project.md. Grouping on `projectId` alone answers null here.
		const answer = facts().factsFor([P2]);

		expect(answer.get(P2)?.lastWorked).toBe(iso(5_000));
	});

	/**
	 * An entry belonging to no project belongs to no ROW either. The asset's mtime is the
	 * newest in the whole fixture, so an implementation attributing an ownerless entry to the
	 * project it happened to be answering for would date every row from the last time anybody
	 * edited the shared library.
	 *
	 * **What this case actually holds, measured rather than claimed.** The `owner === undefined`
	 * arm is where an ownerless entry leaves the loop, and no mutation of `ownerOf` alone
	 * reddens this: `entry.projectId ?? entry.id` answers `asset-a`, which is not a wanted id,
	 * so the `wanted.has` guard catches it one line later either way. Its job is that the
	 * `undefined` arm is EXERCISED at all — the asset entry is the only member of the fixture
	 * that reaches it — plus the pin above, which a future owner-derivation could break.
	 */
	it('ignores an entry that names no project and is not one', () => {
		const answer = facts().factsFor([P1]);

		expect(answer.get(P1)?.lastWorked).toBe(iso(9_000));
	});

	/**
	 * A calibration writes the geometry sidecar and touches no note at all — `Plan.calibration`
	 * lives in the `.rpgeo` and never in the frontmatter, so the plan note's revision does not
	 * move. An afternoon spent calibrating is exactly the afternoon `lastWorked` exists to
	 * report, so the sidecar is stat'd beside the note it belongs to.
	 */
	it('takes lastWorked from a geometry sidecar newer than every note', () => {
		const withSidecar = { ...MTIMES, 'R/One/Geometry/plan-a.rpgeo': 12_000 };

		const answer = new IndexProjectListFacts(indexOver(ENTRIES), vaultOver(withSidecar)).factsFor([P1]);

		expect(answer.get(P1)?.lastWorked).toBe(iso(12_000));
	});

	/**
	 * **Behaviour created by a MERGE, which is why it is pinned here rather than left to the
	 * rule it follows.** The per-project price override arrived on one branch and this port on
	 * another; neither chose the interaction, and no case on either side could have covered it.
	 * An asset-price note carries a required `project:` key and sits under the project's own
	 * folder, so `ownerOf` resolves it exactly as it resolves a zone and its mtime folds into
	 * that project's `lastWorked`.
	 *
	 * That is CONSISTENT with `projectOrder.ts`'s stated rule — "`lastWorked` moves on every
	 * write to any owned note" — and is therefore not a defect. It is pinned because the field
	 * is user-visible twice over (the Home surface's ordering key and the Continue row's date),
	 * so a future change to `ownerOf` that stopped attributing price notes would be a silent
	 * change to what "last worked on" means, with nothing in front of it.
	 *
	 * Its mtime is the newest thing P1 owns, so the assertion cannot pass on the zone at 9,000
	 * the way a lower one would — this fails against an implementation that skips the type.
	 */
	it('folds an asset-price note into the owning project’s lastWorked', () => {
		const priced: readonly ProjectIndexEntry[] = [
			...ENTRIES,
			{
				id: 'price-a' as EntityId<string>,
				type: 'renovation-asset-price',
				path: 'R/One/Prices/price-a.md',
				projectId: P1,
			},
		];
		const withPrice = { ...MTIMES, 'R/One/Prices/price-a.md': 14_000 };

		const answer = new IndexProjectListFacts(indexOver(priced), vaultOver(withPrice)).factsFor([P1, P2]);

		expect(answer.get(P1)?.lastWorked).toBe(iso(14_000));
		// It is not a PLAN, so the count it feeds is unchanged — the same entry reaching both
		// tallies would be the other way this could go wrong.
		expect(answer.get(P1)?.planCount).toBe(2);
		// And it belongs to ONE project: a price note owned by P1 must not date P2's row.
		expect(answer.get(P2)?.lastWorked).toBe(iso(5_000));
	});

	it('answers an entry for every id asked about, including one the index cannot place', () => {
		const answer = facts().factsFor([P1, 'project-gone' as ProjectId]);

		// Never `undefined` at a `.get`: the caller maps a required DTO field off this, and an
		// absent entry and a zero count read identically at the site that renders them.
		expect(answer.get('project-gone')).toEqual({ planCount: 0, lastWorked: null });
	});

	it('reads lastWorked as null when the vault has no file at an indexed path', () => {
		// An index entry whose file is gone is not a reason to refuse the whole row: the
		// project still has a name, a status and a currency to draw.
		const answer = facts({ 'R/One/Plan/a.md': 2_000 }).factsFor([P1]);

		expect(answer.get(P1)).toEqual({ planCount: 2, lastWorked: iso(2_000) });
	});

	it('answers null for a project whose every indexed path the vault cannot place', () => {
		const answer = facts({}).factsFor([P2]);

		expect(answer.get(P2)).toEqual({ planCount: 0, lastWorked: null });
	});

	it('walks the index once regardless of how many projects are asked about', () => {
		let walks = 0;
		const index = indexOver(ENTRIES);
		const counting = Object.assign(Object.create(index) as InMemoryProjectIndex, {
			entries: () => {
				walks += 1;
				return index.entries();
			},
		});

		new IndexProjectListFacts(counting, vaultOver(MTIMES)).factsFor([P1, P2]);

		// The whole reason this is a BATCH port rather than a per-row lookup. A per-project
		// walk passes every case above and is quadratic on a vault with many projects.
		expect(walks).toBe(1);
	});
});
