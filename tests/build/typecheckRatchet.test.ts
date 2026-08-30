import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { REPO } from '../helpers/oxlint';
import { classify, debt, findingsByFile, posix } from '../../scripts/typecheck-baseline.mjs';

/**
 * The ratchet under `npm run typecheck:tests`, driven directly.
 *
 * `tests/**` has never been type-checked, so the compiler reports 562 errors across 114 of
 * 307 files — and 193 files are already clean, which is what makes a ratchet worth more than
 * a one-shot cleanup: a NEW test file is checked from the day it is written while the backlog
 * is cleared per-slice. The whole value rests on the gate failing in BOTH directions, and a
 * ratchet that has quietly stopped catching one of them looks exactly like a clean tree.
 *
 * Driven against `classify` rather than by spawning the gate: `vue-tsc` over this program
 * costs about 15 seconds, and `tests/build/chromium.test.ts`'s header already records what
 * synchronous multi-second bursts do to a two-core CI runner beside files that wait in TICKS.
 * The effects `scripts/typecheck-tests.mjs` keeps — spawning the compiler, printing, the exit
 * code — are wiring, and the wiring cases at the bottom are what watch those.
 */

const BASELINE = path.join(REPO, 'scripts', 'typecheck-tests-baseline.json');

/**
 * Real `vue-tsc` output, copied from a run rather than composed: two findings in one file,
 * one in another, and — the case that matters — three INDENTED continuation lines that each
 * carry a PARENTHESIS (`() =>`, `getById(...)`, `element(s)`), which is what a pattern keyed
 * on the path shape alone reads as a filename.
 *
 * The parenthesis is the whole discriminating property, and the first draft of this fixture
 * did not have it: three continuation lines of plain prose, against which a pattern loosened
 * to `^([^(]+)\(` passed all twelve cases. Measured on the real report, that looser pattern
 * counts 130 files where there are 114 — sixteen baseline entries naming paths that are not
 * files at all, each of which then fails as `missing` forever.
 */
const REPORT = [
	"tests/application/domainValidation.test.ts(28,2): error TS2322: Type 'Result<Requirement, ValidationError>' is not assignable to type 'ResultLike<Requirement>'.",
	"  Type '() => Result<never, PersistenceError>' is not assignable to type '(id: ProjectId) => Promise<Result<Loaded<Project> | null, PersistenceError>>'.",
	"  The types returned by 'getById(...)' are incompatible between these types.",
	"        Source has 2 element(s) but target allows only 1.",
	"tests/application/domainValidation.test.ts(75,42): error TS2339: Property 'value' does not exist on type 'Result<Money, ValidationError>'.",
	"tests/plugin/planEditorCommands.test.ts(118,9): error TS2339: Property 'shown' does not exist on type 'typeof Notice'.",
	'',
].join('\n');

describe('findingsByFile', () => {
	const grouped = findingsByFile(REPORT);

	it('reads one entry per file, not one per printed line', () => {
		expect([...grouped.keys()]).toEqual([
			'tests/application/domainValidation.test.ts',
			'tests/plugin/planEditorCommands.test.ts',
		]);
		expect(debt(grouped)).toBe(3);
	});

	it('does not mistake an indented continuation line for a second file', () => {
		// The discriminating half: a pattern keyed on the path shape alone passes the case
		// above and invents two files here, which on the real report is a baseline naming
		// sixteen paths that do not exist.
		expect([...grouped.keys()].filter((file) => !file.startsWith('tests/'))).toEqual([]);
	});

	it('normalises a Windows path so one baseline serves both CI platforms', () => {
		// `npm run check` rides a Windows leg. Without this the same tree reports every file
		// as a regression AND every entry as stale, with nothing changed in it.
		expect(posix('tests\\core\\geometry\\operations.test.ts')).toBe('tests/core/geometry/operations.test.ts');
		expect([...findingsByFile(REPORT.replace(/\//g, '\\')).keys()]).toContain(
			'tests/application/domainValidation.test.ts',
		);
	});
});

/** Every path exists — the state the three lists are about is the FINDINGS, not the disk. */
const all = () => true;

describe('classify', () => {
	const grouped = findingsByFile(REPORT);

	it('permits a baselined file and refuses one that is not on the list', () => {
		const { regressions } = classify({
			grouped,
			baseline: ['tests/application/domainValidation.test.ts'],
			exists: all,
		});

		expect(regressions).toEqual(['tests/plugin/planEditorCommands.test.ts']);
	});

	it('reports a baseline entry that has become clean, which is what makes it a ratchet', () => {
		// Drop this arm and the gate still refuses every regression — green, useful, and no
		// longer a ratchet, because a cleaned file's carve-out stays on the list for good.
		const { cleaned } = classify({
			grouped,
			baseline: [...grouped.keys(), 'tests/core/geometry/operations.test.ts'],
			exists: all,
		});

		expect(cleaned).toEqual(['tests/core/geometry/operations.test.ts']);
	});

	it('reports a baseline entry naming a file that no longer exists', () => {
		const { missing } = classify({
			grouped,
			baseline: [...grouped.keys(), 'tests/renamed/away.test.ts'],
			exists: (file: string) => file !== 'tests/renamed/away.test.ts',
		});

		expect(missing).toEqual(['tests/renamed/away.test.ts']);
	});

	it('reports a vanished entry as missing only, never also as cleaned', () => {
		// A deleted file has no findings, so a `cleaned` arm that did not ask `exists` would
		// name it twice and tell the author to do two contradictory things about it.
		const { cleaned, missing } = classify({
			grouped,
			baseline: ['tests/renamed/away.test.ts'],
			exists: () => false,
		});

		expect(missing).toEqual(['tests/renamed/away.test.ts']);
		expect(cleaned).toEqual([]);
	});

	it('passes a tree whose findings are exactly the baseline', () => {
		const verdict = classify({ grouped, baseline: [...grouped.keys()], exists: all });

		expect(verdict).toEqual({ regressions: [], cleaned: [], missing: [] });
	});
});

describe('the committed baseline', () => {
	const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).files as string[];

	it('names only test files that exist', () => {
		expect(baseline.length).toBeGreaterThan(0);
		expect(baseline.filter((file) => !file.startsWith('tests/'))).toEqual([]);
		expect(baseline.filter((file) => !existsSync(path.join(REPO, file)))).toEqual([]);
	});

	it('is sorted and free of duplicates, so shrinking it is a one-line diff', () => {
		expect(baseline).toEqual([...new Set(baseline)].toSorted());
	});
});

describe('the gate wiring', () => {
	const packageJson = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8'));

	it('is reachable as an npm script pointing at a file that exists', () => {
		// The script only runs because `package.json` names it; a rename leaves that pointing
		// at nothing and the gate silently stops being a gate.
		expect(packageJson.scripts['typecheck:tests']).toBe('node scripts/typecheck-tests.mjs');
		expect(existsSync(path.join(REPO, 'scripts', 'typecheck-tests.mjs'))).toBe(true);
	});

	it('checks tests/ against the real obsidian types, with no mock path mapping', () => {
		// THE load-bearing decision, pinned because the obvious way to clear the 118 errors
		// that come from it is to add the mapping — which gives `src/` the mock too, since a
		// compiler has one resolution per program. Measured: 77 new errors in `src/`, because
		// the mock exports 13 members and the real module's surface has `Vault`, `Workspace`,
		// `MetadataCache`, `FileManager`, `App` and `TAbstractFile` among many others.
		//
		// Asked of the EFFECTIVE options rather than the child's own JSON. `readConfigFile`
		// parses one file and does not apply `extends`, so a mapping added to `tsconfig.json`
		// — which this config extends — would reach the test program while an assertion on
		// the raw child stayed green. Measured, not reasoned: with `paths` planted in the
		// parent, the first version of this case passed all twelve.
		const config = ts.readConfigFile(path.join(REPO, 'tsconfig.tests.json'), ts.sys.readFile);

		expect(config.error, 'tsconfig.tests.json did not parse').toBeUndefined();

		const parsed = ts.parseJsonConfigFileContent(
			config.config,
			ts.sys,
			REPO,
			undefined,
			'tsconfig.tests.json',
			undefined,
			// What `vue-tsc` adds; without it a `.vue` glob resolves to nothing at all, which
			// would read as "no files out of scope" rather than as a broken instrument.
			[{ extension: '.vue', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred }],
		);

		expect(parsed.errors, 'tsconfig.tests.json did not resolve').toEqual([]);
		expect(parsed.options.paths).toBeUndefined();
		expect(config.config.include).toEqual(['tests/**/*.ts', 'tests/**/*.vue']);
		// The instrument before the measurement: a resolution that reached no test files
		// would make the assertion above vacuous and green.
		expect(parsed.fileNames.some((file) => file.includes('tests/'))).toBe(true);
	});
});
