import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { verifyCaptureFile } from './editor-capture-files.mjs';

const root = 'docs/user-experience/renovation-planner-editor-specs/implementation/evidence/editor-visual-fidelity';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sourceStatus = () => git('status', '--porcelain', '--untracked-files=normal', '--', 'src', 'styles', 'tests', 'scripts', 'package.json', 'package-lock.json', 'vite.config.ts', 'vite.harness.config.ts', 'tsconfig.json');
assert.equal(sourceStatus(), '', 'Commit the production source and harness before final capture.');
const commit = git('rev-parse', 'HEAD'), started = Date.now(), steps = [];
const journeys = ['materials-costs-evidence', 'renovation-workflow', 'reference-plan', 'editor-visual-resilience', 'editor-visual-overview', 'editor-object', 'planning-recovery', 'modal-busy-focus', 'editor-downstream'];
// Keep previous artifacts. Only recorded, freshly generated inputs may enter the new inventory.
process.env.RP_CAPTURE_STARTED_AT = String(started);
const commands = [
	['editor-planning-check.mjs', '--design'], ['editor-renovation-check.mjs', '--design'], ['editor-reference-check.mjs'],
	['editor-visual-resilience.mjs'], ['editor-visual-overview.mjs', '--design'], ['editor-object-check.mjs'],
	['editor-recovery-check.mjs'],
	['editor-modal-busy-check.mjs'],
	['editor-downstream-check.mjs', '--design'],
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
const after = JSON.parse(await readFile(`${root}/after/capture-files.json`, 'utf8'));
assert.equal(after.source, commit); assert.equal(after.staticImages.length, 16);
for (const file of after.files) {
	await verifyCaptureFile(`${root}/after`, file, started);
	if (file.kind === 'image') images.push({ path: `after/${file.name}`, sha256: file.sha256 });
}
const comparisons = JSON.parse(await readFile(`${root}/comparisons/manifest.json`, 'utf8'));
assert.equal(comparisons.screens.length, 18);
for (const { screen, finalCapture } of comparisons.screens) {
	assert.ok(after.files.some(file => file.kind === 'image' && file.name === finalCapture), `${screen} has a current source image`);
	for (const kind of ['full', 'detail']) {
		const path = `comparisons/${screen}-${kind}.png`;
		assert.ok((await stat(`${root}/${path}`)).mtimeMs >= started, `${path} was regenerated`);
		images.push({ path, sha256: createHash('sha256').update(await readFile(`${root}/${path}`)).digest('hex') });
	}
}
await writeFile(`${root}/capture-provenance.json`, JSON.stringify({ commit, startedAt: new Date(started).toISOString(), completedAt: new Date().toISOString(), steps, images }, null, 2));
console.log(`Final visual matrix passed at ${commit}; manual comparison acceptance remains a separate review.`);
