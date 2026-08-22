import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The release invariants that a wrong value breaks at the one moment there is no cheap
 * retry. Every one of them is a rule stated in `docs/setup/publishing.md`; this is the
 * check under it, so the sentence there is not the only thing holding it.
 */

const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));

const manifest = read('manifest.json');
const pkg = read('package.json');
const versions = read('versions.json');

describe('the release files agree', () => {
	// `npm version` runs scripts/version-bump.mjs, which writes the other two. A drift
	// here means the bump was done by hand, and the release workflow rejects a tag that
	// does not equal manifest.version exactly.
	it('states one version in package.json and manifest.json', () => {
		expect(manifest.version).toBe(pkg.version);
	});

	it('records this version in versions.json against its minAppVersion', () => {
		expect(versions[manifest.version]).toBe(manifest.minAppVersion);
	});

	// The plugin id is the folder Obsidian installs into and the key the community list
	// is addressed by. Keeping it equal to the npm name means one name to change.
	it('uses the package name as the plugin id', () => {
		expect(manifest.id).toBe(pkg.name);
	});

	/**
	 * The devDependency is pinned to the FLOOR exactly — not to npm's newest and not to a
	 * range over the floor — so the compiler refuses an API `minAppVersion` does not
	 * promise. The typings are additive within a minor line and carry `@since` tags, so
	 * exactness is what buys the guarantee. Raise the two together or not at all.
	 */
	it('pins the obsidian typings to minAppVersion exactly', () => {
		expect(pkg.devDependencies.obsidian).toBe(manifest.minAppVersion);
	});
});

describe('the toolchain agrees', () => {
	/**
	 * Every workflow's `node-version` is the `engines` floor, deliberately: CI verifies
	 * against the OLDEST Node the project claims to support, not the newest available.
	 * The literals live in three separate YAML steps that nothing else ties to
	 * package.json — this is what ties them, so raising the floor cannot miss one.
	 */
	it('runs CI and the release on the engines floor', () => {
		const floor = /\d+/.exec(pkg.engines.node)?.[0];
		const pins = readdirSync('.github/workflows').flatMap((file) => [
			...readFileSync(`.github/workflows/${file}`, 'utf8').matchAll(/node-version: "(\d+)"/g),
		]);

		// The instrument first: zero matches would "agree" about nothing.
		expect(pins.length).toBeGreaterThanOrEqual(3);
		expect(new Set(pins.map((m) => m[1]))).toEqual(new Set([floor]));
	});
});

describe('the manifest meets the marketplace rules', () => {
	// Reviewed by hand on submission; checked here so a later edit cannot quietly break
	// what a reviewer already accepted.
	it('has no special characters in the description', () => {
		expect(manifest.description).toMatch(/^[A-Za-z0-9 ,.'()-]+$/);
	});

	it('keeps the description within the 250-character limit', () => {
		expect(manifest.description.length).toBeLessThanOrEqual(250);
	});

	// "Obsidian" in the name or id is refused, and so is a name ending in "Plugin".
	it('does not name the app or itself a plugin', () => {
		expect(`${manifest.id} ${manifest.name}`.toLowerCase()).not.toContain('obsidian');
		expect(manifest.name.toLowerCase()).not.toMatch(/plugin$/);
	});
});
