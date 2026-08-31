import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Driving the real oxlint, for the checks that are ABOUT the lint gate rather than about
 * a rule. Two tests need it and a third would duplicate the spawn, which `npm run analyze`
 * is right to notice.
 *
 * Resolved from `import.meta.url` rather than the working directory: another test file in
 * the same worker legitimately `chdir`s while it runs.
 */
export const REPO = fileURLToPath(new URL('../..', import.meta.url));

// The oxlint package's bin is a plain ES module, so it runs under `process.execPath` on
// both CI platforms. `node_modules/.bin/oxlint` is a shell shim on Windows, which
// execFileSync cannot spawn without a shell.
const OXLINT = path.join(REPO, 'node_modules', 'oxlint', 'bin', 'oxlint');

// Posix separators on both platforms: oxlint reports Windows paths with backslashes, and
// every caller compares against paths built from repository-relative literals.
const posix = (file: string) => file.replaceAll(path.sep, '/');

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
		.map((line) => posix(line.trim()))
		.filter(Boolean);

/** What oxlint reports for one file, empty when it reports nothing. */
export const lintOne = (file: string): string => run(['--no-ignore', '--format=agent', file]).trim();
