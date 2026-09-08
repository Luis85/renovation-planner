import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

export const captureSource = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
export function captureStarted() {
	const started = Number(process.env.RP_CAPTURE_STARTED_AT);
	assert.ok(Number.isFinite(started) && started > 0, 'A positive RP_CAPTURE_STARTED_AT boundary is required; use the final capture runner.');
	return started;
}
function filePath(directory, name) {
	const root = resolve(directory), path = resolve(root, name);
	assert.ok(path.startsWith(root + sep), 'capture file stays inside its output directory');
	return path;
}
export function recordScreenshots(page, directory, images) {
	const screenshot = page.screenshot.bind(page);
	page.screenshot = async options => {
		const name = options?.path ? relative(resolve(directory), resolve(options.path)) : null;
		if (name !== null) filePath(directory, name);
		const result = await screenshot(options);
		if (name !== null) images.add(name);
		return result;
	};
}
async function fileRecord(directory, name, started, kind) {
	const path = filePath(directory, name), metadata = await stat(path);
	assert.ok(metadata.isFile() && metadata.mtimeMs >= started, `${name} was generated in this run`);
	return { name, kind, modifiedAt: metadata.mtimeMs, sha256: createHash('sha256').update(await readFile(path)).digest('hex') };
}
export async function makeCaptureManifest(directory, started, images) {
	const data = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'capture-files.json'
			&& !entry.name.includes('-failed') && (await stat(filePath(directory, entry.name))).mtimeMs >= started) data.push(entry.name);
	}
	const files = await Promise.all([...images].map(name => fileRecord(directory, name, started, 'image'))
		.concat(data.map(name => fileRecord(directory, name, started, 'data'))));
	return { source: captureSource(), started, completed: Date.now(), imageSource: 'Actual successful page.screenshot calls; no PNG directory scan', files };
}
export async function verifyCaptureFile(directory, file, started) {
	assert.ok(file.modifiedAt >= started, `${file.name} source predates this run`);
	const actual = await fileRecord(directory, file.name, started, file.kind);
	assert.equal(actual.sha256, file.sha256, `${file.name} matches its recorded source bytes`);
	return actual;
}
export async function copyCaptureFiles(source, destination, prefix) {
	const started = captureStarted(), manifestPath = filePath(source, 'capture-files.json');
	assert.ok((await stat(manifestPath)).mtimeMs >= started, 'source manifest is fresh');
	const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
	assert.equal(manifest.source, captureSource(), 'source capture revision matches this revision');
	assert.ok(manifest.started >= started, 'source capture began in this run');
	assert.ok(manifest.files.some(file => file.name === 'report.json'), 'completed journey report is named');
	await mkdir(destination, { recursive: true });
	const files = [];
	for (const file of manifest.files) {
		assert.match(file.name, /^[a-z0-9][a-z0-9._-]*$/i, 'journey output has a simple file name');
		await verifyCaptureFile(source, file, started);
		await copyFile(filePath(source, file.name), filePath(destination, file.name));
		files.push({ ...file, name: `${prefix}/${file.name}` });
	}
	const manifestFile = await fileRecord(source, 'capture-files.json', started, 'data');
	await copyFile(manifestPath, filePath(destination, 'capture-files.json'));
	files.push({ ...manifestFile, name: `${prefix}/capture-files.json` });
	return files;
}
