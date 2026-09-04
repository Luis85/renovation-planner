import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { entityRefOf } from '../../../../src/infrastructure/persistence/index/buildProjectIndexEntries';
import { toPosix } from '../../../helpers/posix';

describe('entityRefOf', () => {
	it('answers the declared type and id for a note of ours', () => {
		expect(entityRefOf({ type: 'renovation-zone', id: 'z1' })).toEqual({
			kind: 'ours',
			type: 'renovation-zone',
			id: 'z1',
		});
	});

	it('answers not-ours for empty frontmatter', () => {
		expect(entityRefOf({})).toEqual({ kind: 'not-ours' });
	});

	it('answers not-ours for a type this plugin does not own', () => {
		expect(entityRefOf({ type: 'daily-note', id: 'x' })).toEqual({ kind: 'not-ours' });
	});

	it('answers not-ours for a non-string type', () => {
		expect(entityRefOf({ type: 7, id: 'x' })).toEqual({ kind: 'not-ours' });
	});

	it('distinguishes ours-but-idless from not-ours, because only one is a diagnostic', () => {
		expect(entityRefOf({ type: 'renovation-plan' })).toEqual({ kind: 'no-id', type: 'renovation-plan' });
		expect(entityRefOf({ type: 'renovation-plan', id: '' })).toEqual({ kind: 'no-id', type: 'renovation-plan' });
		expect(entityRefOf({ type: 'renovation-plan', id: 42 })).toEqual({ kind: 'no-id', type: 'renovation-plan' });
	});

	it('carries the entity type on a note of ours with no usable id', () => {
		const ref = entityRefOf({ type: 'renovation-asset' });
		expect(ref).toEqual({ kind: 'no-id', type: 'renovation-asset' });
	});

	it('still refuses a note whose type is not ours, before asking about the id', () => {
		expect(entityRefOf({ type: 'something-else' })).toEqual({ kind: 'not-ours' });
		expect(entityRefOf({})).toEqual({ kind: 'not-ours' });
	});

	/**
	 * AN AWKWARD ID IS STILL OURS — the regression this case exists to keep closed.
	 *
	 * Two earlier attempts refused an id that cannot be a filename HERE, so a project, zone or
	 * requirement whose hand-written id held a `:` or a `#` stopped being indexed and became
	 * unopenable. That traded lost access for a bad write, which is the wrong direction: every
	 * one of those hazards is a WRITE hazard, and none of them stops a note being read.
	 *
	 * The rule now lives at `AssetGeometryStore.pathFor`, the one site that derives a path, so
	 * the note stays indexed and openable while no sidecar is ever written for it — which
	 * leaves nothing for a library migration to orphan, the concern that started all of this.
	 *
	 * More reachable than it looks: the spec records that the only way a vault has an Asset
	 * today is a hand-written note, so hand-written ids are the normal case rather than an
	 * exotic one.
	 */
	it('indexes a note whose id could not be a filename, because reading is not writing', () => {
		for (const id of ['asset:custom', 'asset/custom', 'CON', ' asset ', 'a#b']) {
			expect(entityRefOf({ type: 'renovation-asset', id })).toEqual({
				kind: 'ours',
				type: 'renovation-asset',
				id,
			});
		}
	});
});

/**
 * The claim is "one function answers this, and exactly two callers ask it". A docblock
 * saying so is worth nothing without the measurement, so the measurement is the test.
 *
 * The instrument's blind spot, stated rather than implied: this reads source TEXT, so a
 * call reached through a re-export under another name is invisible to it. Nothing
 * re-exports this module today.
 */
function sourceFilesUnder(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return sourceFilesUnder(path);
		return path.endsWith('.ts') || path.endsWith('.vue') ? [path] : [];
	});
}

function modulesNaming(needle: string): string[] {
	return sourceFilesUnder('src')
		.filter((path) => readFileSync(path, 'utf8').includes(needle))
		.map((path) => toPosix(path))
		.toSorted();
}

describe('entityRefOf callers', () => {
	/**
	 * The needle carries the `(`, for the reason the sibling claim below spells out and had
	 * already measured — a bare name matches a DOCBLOCK, and a docblock is not a caller.
	 *
	 * This one was bare until `paths.ts`'s `FORBIDDEN_IN_FILENAME` docblock named `entityRefOf`
	 * as one of its two consumers, at which point the filter reported three modules and the
	 * case failed for a cross-reference. The hazard was written down one `describe` below,
	 * for the other needle, and not applied here — which is this repository's own recurring
	 * shape: a rule stated in a comment is a rule some neighbour is not following.
	 *
	 * Same blind spot as its sibling, said rather than implied: a comment writing the name with
	 * an empty argument list would read as a call.
	 *
	 * **THREE modules, and the third is the point of the list rather than a dilution of it.**
	 * The scan and the pipeline are the two doors that ASK a note what it is; the reconciling
	 * index is the door that re-asks the notes an exclusion descriptor names, because a
	 * descriptor records what was true when it was made and a vault edited while Obsidian was
	 * closed can have left a contender declaring another id. Two of the three ask about the file
	 * that changed; this one asks about files nothing changed. A FOURTH module answering "is
	 * this note ours" is what the case still refuses.
	 */
	it('is called by exactly three modules in src/: the scan, the pipeline and the reconciling index', () => {
		expect(modulesNaming('entityRefOf(')).toEqual([
			'src/infrastructure/persistence/index/ReconcilingProjectIndex.ts',
			'src/infrastructure/persistence/index/VaultChangeAdapter.ts',
			'src/infrastructure/persistence/index/buildProjectIndexEntries.ts',
		]);
	});
});

/**
 * The same claim one level down, and it had none of the same measurement: `CLAUDE.md`
 * elevates "one rule with two doors is two rules unless one function holds it" to a rule,
 * while the sidecar half of it rested on prose alone. The defect this refuses is the one
 * slice 18's review actually found and fixed — `processSidecar` adjudicating a duplicate
 * `.rpgeo` by a hand-spelled rule of its own, so the two doors answered differently — and
 * that shape is invisible to every other gate, because a second adjudication is correct
 * code that nothing imports wrongly.
 *
 * The needle carries the `(` and `entityRefOf`'s does not, which is a MEASURED difference
 * rather than a stylistic one: `paths.ts`'s own header names `sidecarMappingFor` in prose,
 * so a bare-name filter reports three modules and pins a docblock as if it were a caller.
 * The blind spot that buys, said rather than implied: a future comment writing the name with
 * an empty argument list would read as a call here. `sidecarPathFor`'s neighbouring "exactly
 * two callers" claim is deliberately NOT folded in — its defining module is not one of its
 * callers, so it would need an exclusion this instrument does not have.
 */
describe('sidecarMappingFor callers', () => {
	/**
	 * The pipeline's own spelling of this question moved to `sidecarMapping.ts` when a SECOND
	 * incremental door grew: promotion asks it too, and promotion now belongs to the index
	 * rather than to the adapter. So the two callers are the scan and one shared incremental
	 * answer, which is a narrower claim than "the scan and the pipeline" and the true one —
	 * `incrementalSidecarMapping` is what the pipeline reaches, and its own caller list is the
	 * case below.
	 */
	it('is called by exactly two modules in src/: the scan and the incremental answer', () => {
		expect(modulesNaming('sidecarMappingFor(')).toEqual([
			'src/infrastructure/persistence/index/buildProjectIndexEntries.ts',
			'src/infrastructure/persistence/index/sidecarMapping.ts',
		]);
	});

	/**
	 * The claim `sidecarMappingFor`'s used to make, one level up: the two incremental doors that
	 * offer a `.rpgeo` to an entry give it the same answer, because they call one function. A
	 * `.rpgeo` arriving is `VaultChangeAdapter.processSidecar`'s; a note being promoted into the
	 * index is `promotedSidecarMapping`'s, which lives beside it in the same module and is the
	 * second name this list would otherwise have to carry.
	 */
	it('has exactly two modules asking the incremental answer', () => {
		expect(modulesNaming('incrementalSidecarMapping(')).toEqual([
			'src/infrastructure/persistence/index/VaultChangeAdapter.ts',
			'src/infrastructure/persistence/index/sidecarMapping.ts',
		]);
	});
});
