import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { toPosix } from './posix';
import { REPO } from './repo';

/**
 * Driving the real oxlint, for the checks that are ABOUT the lint gate rather than about
 * a rule. Two tests need it and a third would duplicate the spawn, which `npm run analyze`
 * is right to notice.
 */

// The oxlint package's bin is a plain ES module, so it runs under `process.execPath` on
// both CI platforms. `node_modules/.bin/oxlint` is a shell shim on Windows, which
// execFileSync cannot spawn without a shell.
const OXLINT = path.join(REPO, 'node_modules', 'oxlint', 'bin', 'oxlint');

const run = (args: string[]) => {
	try {
		return execFileSync(process.execPath, [OXLINT, ...args], { cwd: REPO, encoding: 'utf8' });
	} catch (error) {
		// A run with findings exits non-zero, which is the ordinary case here rather than a
		// failure. The findings are on stdout either way.
		return String((error as { stdout?: string }).stdout ?? '');
	}
};

/** Which files oxlint would lint — its own resolution, not a re-implementation of it. */
export const lintedFiles = (): string[] =>
	run(['--debug=files'])
		.split('\n')
		.map((line) => toPosix(line.trim()))
		.filter(Boolean);

/** What oxlint reports for one file, empty when it reports nothing. */
export const lintOne = (file: string): string => run(['--no-ignore', '--format=agent', file]).trim();
