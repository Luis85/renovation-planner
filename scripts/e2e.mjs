import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile } from "node:fs/promises";

/**
 * Build the plugin, stage it as an installed plugin folder, and run `tests/e2e/` against a
 * real Obsidian. Separate from `npm run check` on purpose: it downloads Obsidian on first use
 * and needs a graphical session (CI supplies a virtual display).
 */
const run = (command, args) => {
	const { status } = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
	if (status !== 0) process.exit(status ?? 1);
};

run("npx", ["vite", "build"]);
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const pluginDir = `node_modules/.cache/e2e/${manifest.id}`;
await mkdir(pluginDir, { recursive: true });
await Promise.all([
	copyFile("dist/main.js", `${pluginDir}/main.js`),
	copyFile("dist/styles.css", `${pluginDir}/styles.css`),
	copyFile("manifest.json", `${pluginDir}/manifest.json`),
]);
run("npx", ["vitest", "run", "--config", "tests/e2e/vitest.config.mts", ...process.argv.slice(2)]);
