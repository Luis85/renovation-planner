import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile } from "node:fs/promises";

/**
 * Build the plugin, stage it as an installed plugin folder, and run `tests/e2e/` against a
 * real Obsidian. Separate from `npm run check` on purpose: it downloads Obsidian on first use
 * and needs a graphical session (CI supplies a virtual display).
 *
 * Each tool is run as `node <its entry>` rather than through `npx` with a shell: on Windows a
 * shell spawn re-joins the arguments unquoted, so `-- -t "host settings"` reached vitest as
 * two words and matched nothing.
 */
const node = (entry, args) => {
	const { status } = spawnSync(process.execPath, [entry, ...args], { stdio: "inherit" });
	if (status !== 0) process.exit(status ?? 1);
};

node("node_modules/vite/bin/vite.js", ["build"]);

// The three files Obsidian loads by name, staged from where each lives — the same table
// `scripts/test-build.mjs` installs into this repository's own vault.
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const pluginDir = `node_modules/.cache/e2e/${manifest.id}`;
await mkdir(pluginDir, { recursive: true });
await Promise.all([
	copyFile("dist/main.js", `${pluginDir}/main.js`),
	copyFile("dist/styles.css", `${pluginDir}/styles.css`),
	copyFile("manifest.json", `${pluginDir}/manifest.json`),
]);

node("node_modules/vitest/vitest.mjs", ["run", "--config", "tests/e2e/vitest.config.mts", ...process.argv.slice(2)]);
