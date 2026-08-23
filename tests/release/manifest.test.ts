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
	 * `engines.node` declares the OLDEST Node each supported range starts at
	 * (`^22.22.2 || ^24.15.0 || >=26.0.0`). The one thing this checks is that the FLOOR —
	 * the oldest range's start — is pinned and actually run somewhere in CI or the
	 * release, because that is the one leg nothing else ties to `package.json`: skip it
	 * and the whole point of declaring a floor (refusing an API the oldest supported
	 * runtime lacks) goes untested. It does not require the floor be the ONLY thing run —
	 * `verify`'s matrix also exercises the newer declared ranges as supplementary
	 * coverage, and a range is a range precisely because supporting it does not mean
	 * pinning one exact value.
	 *
	 * The scan reads every `node-version: "..."` value, not just ones that happen to be
	 * bare digits: a leg spelled as a range (`"24.x"`) is still a `node-version` value,
	 * and a digits-only pattern would silently stop seeing it the moment its spelling
	 * did — this project's own rule about `foo(` missing `foo<T>(`, in a different file.
	 * Only each value's leading major is compared, matching how the floor itself is read
	 * from `engines.node` below.
	 */
	it('pins the engines floor somewhere in CI and the release', () => {
		const floor = /\d+/.exec(pkg.engines.node)?.[0];
		const values = readdirSync('.github/workflows').flatMap((file) => [
			...readFileSync(`.github/workflows/${file}`, 'utf8').matchAll(/node-version: "([^"]+)"/g),
		]).map((m) => m[1]);

		// The instrument first: zero matches would "agree" about nothing.
		expect(values.length).toBeGreaterThanOrEqual(3);

		const majors = values.map((v) => /^\d+/.exec(v)?.[0]);
		expect(majors).toContain(floor);
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
