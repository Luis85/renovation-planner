import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * `npm version` runs `scripts/version-bump.mjs` with `npm_package_version` set; any other
 * invocation has nothing to sync. Without a guard, `JSON.stringify` silently DROPS
 * manifest.json's `version` key (undefined values vanish from stringified objects) and
 * versions.json gains a literal `"undefined"` entry — both release files corrupted, exit
 * code 0. Driven as a subprocess against a planted tree because the script writes to the
 * working directory on import.
 *
 * Resolved from `import.meta.url` rather than the working directory: another test file in
 * the same worker legitimately `chdir`s while it runs.
 */
const SCRIPT = fileURLToPath(new URL('../../scripts/version-bump.mjs', import.meta.url));

const planted: string[] = [];
afterEach(() => {
	for (const dir of planted.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('version-bump run outside npm version', () => {
	it('refuses instead of corrupting the release files', () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'version-bump-'));
		planted.push(dir);
		const manifest = `${JSON.stringify({ id: 'x', version: '0.1.0', minAppVersion: '1.12.0' }, null, '  ')}\n`;
		const versions = `${JSON.stringify({ '0.1.0': '1.12.0' }, null, '  ')}\n`;
		writeFileSync(path.join(dir, 'manifest.json'), manifest);
		writeFileSync(path.join(dir, 'versions.json'), versions);

		// The suite itself runs under npm, so the variable is set here; the direct
		// invocation being simulated is exactly the one where it is not. Deleted by
		// case-insensitive comparison: Windows environment lookup ignores case, and the
		// vitest worker carries the key as NPM_PACKAGE_VERSION — deleting only the
		// lowercase spelling leaves the child still seeing it there.
		const env = { ...process.env };
		for (const key of Object.keys(env)) {
			if (key.toLowerCase() === 'npm_package_version') delete env[key];
		}

		expect(() => execFileSync(process.execPath, [SCRIPT], { cwd: dir, env })).toThrow();

		// Refused BEFORE any write: both files exactly as planted.
		expect(readFileSync(path.join(dir, 'manifest.json'), 'utf8')).toBe(manifest);
		expect(readFileSync(path.join(dir, 'versions.json'), 'utf8')).toBe(versions);
	});
});
