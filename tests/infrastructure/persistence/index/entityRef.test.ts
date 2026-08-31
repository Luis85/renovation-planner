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
	 * AN ID IS A FILENAME, so it has to be one path segment.
	 *
	 * `assetSidecarPathFor` and `sidecarPathFor` both interpolate an entity's id straight into
	 * a path, so an id of `asset/custom` resolves its sidecar to `Geometry/asset/custom.rpgeo`
	 * — nested rather than a direct child. Reads and writes derive the SAME wrong path, so
	 * nothing looks broken until a library migration, whose direct-children rule leaves the
	 * file behind and the asset then reads as shapeless. Silent, because an absent sidecar is a
	 * shapeless asset rather than an error.
	 *
	 * Refused HERE rather than in the asset frontmatter schema, because a plan id is
	 * interpolated by `sidecarPathFor` in exactly the same way — fixing the kind the report
	 * named would leave the identical defect one file away. This is the one answer to "is this
	 * note ours", with a caller list the test below MEASURES rather than asserts.
	 *
	 * A path-segment rule and deliberately NOT a `<prefix>-<ULID>` regex: the hazard is the
	 * path, not the format, and a format rule would refuse ids from a prefix nobody has minted
	 * yet.
	 */
	it('answers bad-id for an id that is not a single path segment', () => {
		for (const id of ['asset/custom', 'asset\\custom', '..', '.', 'a/b/c']) {
			expect(entityRefOf({ type: 'renovation-asset', id })).toEqual({ kind: 'bad-id' });
		}
	});

	/**
	 * EVERY character a filename may not hold, not just the two that make a path NEST.
	 *
	 * The first version of this rule refused `/`, `\\`, `.` and `..` — the SEPARATOR hazard, an id
	 * escaping its folder. `fileNameFor` (paths.ts) had already written down the other half:
	 * Obsidian forbids `\\ / : * ? " < > | # ^ [ ]` and dislikes edge dots and spaces. Measured, the
	 * first rule admitted NINE of those ten characters.
	 *
	 * The one that matters is platform-split: `Geometry/asset:custom.rpgeo` is a legal path on
	 * Linux and macOS and an invalid one on Windows, so it fails for users and works for whoever
	 * wrote it. CI carries a Windows leg because paths are one of the two things that differ
	 * between platforms, and this is a path.
	 *
	 * Driven as a LOOP over the vocabulary rather than as a handful of examples, so a character
	 * dropped from the shared class fails here rather than silently.
	 */
	it('answers bad-id for every character a filename may not hold', () => {
		for (const ch of ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '#', '^', '[', ']']) {
			expect(entityRefOf({ type: 'renovation-asset', id: `asset${ch}custom` })).toEqual({
				kind: 'bad-id',
			});
		}
	});

	it('answers bad-id for an edge dot or space, which Windows and Obsidian both dislike', () => {
		for (const id of [' asset-01ABC', 'asset-01ABC ', 'asset-01ABC.', '.asset-01ABC']) {
			expect(entityRefOf({ type: 'renovation-asset', id })).toEqual({ kind: 'bad-id' });
		}
	});

	it('still answers ours for an ordinary id, so the rule refuses separators and not ids', () => {
		expect(entityRefOf({ type: 'renovation-asset', id: 'asset-01ABC' })).toEqual({
			kind: 'ours',
			type: 'renovation-asset',
			id: 'asset-01ABC',
		});
	});

	it('keeps bad-id distinct from no-id, because they are different diagnostics', () => {
		expect(entityRefOf({ type: 'renovation-plan', id: 'a/b' }).kind).not.toBe('no-id');
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
