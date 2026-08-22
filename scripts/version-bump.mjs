import { readFileSync, writeFileSync } from "node:fs";

const targetVersion = process.env.npm_package_version;

// `npm version` is what sets that variable; run any other way there is nothing to sync,
// and proceeding would corrupt both files silently: `JSON.stringify` DROPS a key whose
// value is undefined, so manifest.json would lose `version` entirely while versions.json
// gained a literal "undefined" entry — with exit code 0.
if (!targetVersion) {
	throw new Error('npm_package_version is not set. Run this via `npm version <bump>`, never directly.');
}

// Sync manifest.json with the version from `npm version`.
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "  ") + "\n");

// Record the minimum app version for this release. Obsidian reads versions.json to
// decide which release an older app may install.
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "  ") + "\n");
