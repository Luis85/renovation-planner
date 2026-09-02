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
		expect(entityRefOf({ type: 'renovation-plan' })).toEqual({ kind: 'no-id' });
		expect(entityRefOf({ type: 'renovation-plan', id: '' })).toEqual({ kind: 'no-id' });
		expect(entityRefOf({ type: 'renovation-plan', id: 42 })).toEqual({ kind: 'no-id' });
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
	 */
	it('is called by exactly two modules in src/, and they are the scan and the pipeline', () => {
		expect(modulesNaming('entityRefOf(')).toEqual([
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
	it('is called by exactly two modules in src/, and they are the scan and the pipeline', () => {
		expect(modulesNaming('sidecarMappingFor(')).toEqual([
			'src/infrastructure/persistence/index/VaultChangeAdapter.ts',
			'src/infrastructure/persistence/index/buildProjectIndexEntries.ts',
		]);
	});
});
