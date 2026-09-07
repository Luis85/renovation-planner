import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve as resolvePath, sep } from 'node:path';

const root = 'docs/user-experience/renovation-planner-editor-specs/implementation/evidence/editor-visual-fidelity';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sourceStatus = () => git('status', '--porcelain', '--untracked-files=normal', '--', 'src', 'styles', 'tests', 'scripts', 'package.json', 'package-lock.json', 'vite.config.ts', 'vite.harness.config.ts', 'tsconfig.json');
assert.equal(sourceStatus(), '', 'Commit the production source and harness before final capture.');
const commit = git('rev-parse', 'HEAD'), started = Date.now(), steps = [];
const journeys = ['materials-costs-evidence', 'renovation-workflow', 'reference-plan', 'editor-visual-resilience', 'editor-visual-overview', 'editor-object', 'planning-recovery', 'modal-busy-focus', 'editor-downstream'];
// Retire only this runner's generated outputs so a failed earlier capture cannot enter the inventory.
for (const directory of [...journeys.map(name => `harness-shots/${name}`), `${root}/after`, `${root}/comparisons`, `${root}/capture-provenance.json`]) {
	const target = resolvePath(directory);
	assert.ok(target.startsWith(`${resolvePath('.')}${sep}`), 'Generated output must stay inside the current worktree.');
	await rm(target, { recursive: true, force: true });
}
const commands = [
	['editor-planning-check.mjs'], ['editor-renovation-check.mjs'], ['editor-reference-check.mjs'],
	['editor-visual-resilience.mjs'], ['editor-visual-overview.mjs', '--design'], ['editor-object-check.mjs'],
	['editor-recovery-check.mjs'],
	['editor-modal-busy-check.mjs'],
	['editor-downstream-check.mjs'],
	['editor-visual-fidelity-shots.mjs', 'after'], ['editor-visual-comparisons.mjs'],
];
for (const [script, ...args] of commands) {
	const stepStarted = Date.now();
	await new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [`scripts/${script}`, ...args], { stdio: 'inherit', env: { ...process.env, BROWSER: 'none' } });
		child.once('error', reject);
		child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`)));
	});
	assert.equal(git('rev-parse', 'HEAD'), commit, 'Source revision changed during capture.');
	assert.equal(sourceStatus(), '', 'Source changed during capture.');
	steps.push({ script, args, elapsedMs: Date.now() - stepStarted });
}
for (const directory of journeys) {
	const report = `harness-shots/${directory}/report.json`;
	assert.ok((await stat(report)).mtimeMs >= started, `${report} was not regenerated in this run`);
}
const images = [];
async function inventory(directory) {
	for (const file of await readdir(directory, { withFileTypes: true })) {
		const path = `${directory}/${file.name}`;
		if (file.isDirectory()) await inventory(path);
		else if (file.name.endsWith('.png')) images.push({ path: path.slice(root.length + 1), sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
	}
}
await inventory(`${root}/after`); await inventory(`${root}/comparisons`);
await writeFile(`${root}/capture-provenance.json`, JSON.stringify({ commit, startedAt: new Date(started).toISOString(), completedAt: new Date().toISOString(), steps, images }, null, 2));
console.log(`Final visual matrix passed at ${commit}; manual comparison acceptance remains a separate review.`);
