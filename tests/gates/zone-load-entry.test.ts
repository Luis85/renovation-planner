/**
 * "`Zone.fromStored` is called by the zone mapper's read and by nothing else in `src/`."
 *
 * Owner ruling 34 gave loading its OWN entry into the Zone entity, which skips the one rule a
 * write is held to — that a zone outline encloses an area — so a vault written before that rule
 * still loads. That is only safe while loading is the only caller: any other `src/` caller is a
 * door that writes a zero-area Room again, which is L-23 reopened under a name that reads as
 * harmless. So the check sits at the forbidden thing, the NAME, across the whole tree.
 *
 * A test and not a lint rule, deliberately: `no-restricted-syntax` is the obvious home and the
 * wrong one here. Two flat-config blocks matching one file OVERRIDE that key rather than merging
 * it (CLAUDE.md's Gotchas), so a selector added to the general `src/` block would have to be
 * restated in every carve-out block for `src/infrastructure/` — including the one the mapper
 * itself sits in, where it must be allowed — and each restatement is a copy that can drift.
 *
 * **What it reads**: the TypeScript parse of every `.ts` and every SFC script under `src/` whose
 * text holds the name, for an identifier or a string literal spelling `fromStored` — so a
 * comment naming it is not a hit, while a destructuring (`const { fromStored } = Zone`) and a
 * bracket access (`Zone['fromStored']`) are. **What it cannot see**: a name BUILT at run time
 * (`Zone['from' + 'Stored']`) or escaped (`'from\u0053tored'`), and a file outside `src/`. It
 * fails when it reaches nothing, since an instrument that reaches nothing looks exactly like a
 * clean tree.
 *
 * **It counts FILES, not calls.** A second call inside a file already on the list — another
 * `Zone.fromStored(...)` in `zoneMapper.ts`, or one in `Zone.ts` itself — changes nothing it reads.
 *
 * **The load entry is TWO names deep, and the second is pinned the same way.** `zoneFromPersistence`
 * is itself an exported unchecked entry — it reaches `fromStored` for whoever calls it — so a new
 * caller of IT reopens the door without ever spelling `fromStored`. It has two callers: the
 * repository's load (`ObsidianZoneRepository`) and `prepareZoneGeometryVersions`, which builds an
 * entity only for its plan id, project id and version and hands the NEXT outline to
 * `withGeometry`, which checks it. A caller one hop further out — a module wrapping either of
 * those — is outside what this reads.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { namesIdentifier, parseScript, parseSource, stringsOf } from '../helpers/parsedSource';
import { REPO, repoRelative } from '../helpers/repo';

const LOADER = 'src/infrastructure/persistence/mappers/zoneMapper.ts';
/** Each unchecked name, and every `src/` file allowed to spell it, its definition included. */
const PINNED: ReadonlyArray<readonly [name: string, files: readonly string[]]> = [
	['fromStored', ['src/domain/zone/Zone.ts', LOADER]],
	['zoneFromPersistence', [
		'src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts',
		'src/infrastructure/obsidian/repositories/zoneGeometryVersions.ts',
		LOADER,
	]],
];

function sources(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return sources(path);
		return entry.name.endsWith('.ts') || entry.name.endsWith('.vue') ? [path] : [];
	});
}

const spells = (file: ReturnType<typeof parseSource>['file'], name = 'fromStored'): boolean =>
	namesIdentifier(file, name) || stringsOf(file).includes(name);

describe('the zone load entry', () => {
	it('reads what it is asked to and nothing it is not', () => {
		expect(spells(parseSource('a.ts', 'const { fromStored } = Zone;').file)).toBe(true);
		expect(spells(parseSource('b.ts', "Zone['fromStored'](props);").file)).toBe(true);
		expect(spells(parseSource('c.ts', '// Zone.fromStored is the load entry\nexport const x = 1;').file)).toBe(false);
	});

	it.each(PINNED)('%s is named only by the files pinned for it in src/', (name, allowed) => {
		const files = sources(join(REPO, 'src'));
		expect(files.length).toBeGreaterThan(100);
		// The bytes are asked first only to decide which files are worth PARSING — every one the
		// parse could count holds the name as text — so the parse still decides, and a comment
		// spelling it is still not a hit. Parsing all of `src/` measured past the 5 s case budget.
		const candidates = files.filter((path) => readFileSync(path, 'utf8').includes(name));
		const naming = candidates.filter((path) => spells(parseScript(path).file, name)).map((path) => repoRelative(path)).toSorted();
		expect(naming).toEqual(allowed.toSorted());
	});
});
