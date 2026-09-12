import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO } from '../helpers/repo';
import { noSsrSfc, ssrSfcRefusal } from '../../scripts/vitest-no-ssr-sfc.mjs';

/**
 * "No node-environment test reaches a `.vue` file" — `scripts/vitest-no-ssr-sfc.mjs` is the
 * check, at the transform, and this file proves it two ways. The hook's rule is driven directly,
 * and then the REAL pipeline is driven: a child vitest over `fixtures/sfcEnvironment/`, whose
 * node spec must fail with the plugin's text and whose jsdom spec, importing the same SFC, must
 * pass. Without the second half the first proves only that a function refuses what it is told
 * to; the measurement the plugin rests on (`options.ssr` is what discriminates the two) is one
 * an upstream release could move, and the child run is what would notice.
 */
describe('the SSR-SFC refusal', () => {
	const SFC = 'C:/repo/src/presentation/views/Thing.vue';

	it('names the .vue file compiled under SSR, with the query stripped from a sub-request', () => {
		expect(ssrSfcRefusal(SFC, true)).toContain(`${SFC} was compiled in SSR shape`);
		expect(ssrSfcRefusal(`${SFC}?vue&type=script&setup=true&lang.ts`, true)).toContain(`${SFC} was compiled in SSR shape`);
	});

	it('passes a client transform of the same file, and any non-.vue module either way', () => {
		expect(ssrSfcRefusal(SFC, false)).toBeNull();
		expect(ssrSfcRefusal(SFC, undefined)).toBeNull();
		expect(ssrSfcRefusal('C:/repo/src/core/x.ts', true)).toBeNull();
		expect(ssrSfcRefusal('C:/repo/src/core/x.ts?vue', true)).toBeNull();
	});

	it('is what the plugin throws from its transform hook, and nothing else', () => {
		const plugin = noSsrSfc();
		const transform = plugin.transform as (code: string, id: string, options?: { ssr?: boolean }) => unknown;

		expect(plugin.enforce).toBe('pre');
		expect(() => transform('', SFC, { ssr: true })).toThrow('was compiled in SSR shape');
		expect(transform('', SFC, { ssr: false })).toBeNull();
	});
});

/**
 * ONE child process, read back by every case — the shape `contractDiscriminates.test.ts` already
 * takes and states why. The JSON reporter writes to a file the parent parses with `JSON.parse`,
 * so the assertions are over vitest's own result objects rather than over its console text.
 *
 * Spawned in `beforeAll` rather than at module load, so a child that dies before writing its
 * report fails with its exit code, signal and stderr in the message instead of an `ENOENT` or a
 * `JSON.parse` error pointing nowhere, and so the temp directory is removed in `afterAll` on
 * failure too. `CHILD_RUN_MS` is a measurement: the child run — a cold Vite transform of the
 * plugin, the Vue plugin and one SFC over two specs — took 2.4 s alone on this machine on
 * 2026-09-12 (`tests 2.42s` in vitest's own summary); the budget is far wider than that because
 * a whole nested vitest is exactly the shape `test-environments.test.ts` has measured at 128 s
 * under the full gate against 56 s alone, and a red about the machine is what it refuses.
 */
interface ChildReport {
	testResults: { name: string; status: string; message: string }[];
}

const CHILD_RUN_MS = 45_000;
let out: string;
let child: ReturnType<typeof spawnSync>;
let report: ChildReport;

beforeAll(() => {
	out = mkdtempSync(join(tmpdir(), 'rp-no-ssr-sfc-'));
	const reportFile = join(out, 'report.json');
	child = spawnSync(
		process.execPath,
		[
			'node_modules/vitest/vitest.mjs',
			'run',
			'--config',
			'tests/build/fixtures/sfcEnvironment/vitest.sfcEnvironment.config.ts',
			'--reporter=json',
			`--outputFile=${reportFile}`,
		],
		{ cwd: REPO, encoding: 'utf8', timeout: CHILD_RUN_MS },
	);
	try {
		report = JSON.parse(readFileSync(reportFile, 'utf8')) as ChildReport;
	} catch (cause) {
		throw new Error(
			`the child vitest left no readable report (exit ${String(child.status)}, signal ${String(child.signal)}, ${String(cause)}):
${String(child.stderr)}`,
		);
	}
}, CHILD_RUN_MS + 5_000);

afterAll(() => {
	rmSync(out, { recursive: true, force: true });
});

const resultFor = (fixture: string) => report.testResults.find((file) => file.name.endsWith(fixture));

describe('under the real pipeline', () => {
	it('collected both fixtures, so the run was not empty', () => {
		expect(report.testResults.map((file) => file.name.split('/').pop())).toEqual(
			expect.arrayContaining(['nodeImportsSfc.fixture.ts', 'jsdomImportsSfc.fixture.ts']),
		);
	});

	it('fails the node-environment spec with the refusal naming the SFC', () => {
		expect(child.status).not.toBe(0);
		expect(resultFor('nodeImportsSfc.fixture.ts')?.status).toBe('failed');
		expect(resultFor('nodeImportsSfc.fixture.ts')?.message).toContain('sfcEnvironment/Probe.vue was compiled in SSR shape');
	});

	it('passes the jsdom spec importing the same SFC', () => {
		expect(resultFor('jsdomImportsSfc.fixture.ts')?.status).toBe('passed');
	});
});
