/**
 * Whether the plugin's own `data.json` is on disk.
 *
 * This exists because of a defect found in a real vault and reproducible nowhere else:
 * Obsidian's `loadData()` catches a `JSON.parse` failure ITSELF, logs
 * `failed to read JSON …` on its own side, and RESOLVES EMPTY rather than rejecting. So
 * "loadData came back with nothing" is two opposite outcomes wearing one shape — a fresh
 * install, and a file Obsidian could not read — and the file's existence is the only thing
 * that tells them apart.
 *
 * A READ, and the only one in this slice. It touches no note: the path is the plugin's own
 * folder inside the config directory, which is plugin-local operational data rather than
 * any part of the vault's Markdown record.
 */
import { describe, expect, it } from 'vitest';
import { createPluginDataProbe } from '../../../../src/infrastructure/obsidian/settings/pluginDataFile';

const fakeApp = (exists: boolean | Error, configDir = '.obsidian') => {
	const asked: string[] = [];

	const app = {
		vault: {
			configDir,
			adapter: {
				exists: (path: string): Promise<boolean> => {
					asked.push(path);
					return exists instanceof Error ? Promise.reject(exists) : Promise.resolve(exists);
				},
			},
		},
	};

	return { app: app as never, asked };
};

describe('the plugin data file probe', () => {
	it('answers true when the adapter says the file is there', async () => {
		const { app } = fakeApp(true);

		await expect(createPluginDataProbe(app, 'renovation-planner').dataFileExists()).resolves.toBe(true);
	});

	it('answers false when it is not', async () => {
		const { app } = fakeApp(false);

		await expect(createPluginDataProbe(app, 'renovation-planner').dataFileExists()).resolves.toBe(false);
	});

	/**
	 * The path is built from the vault's OWN `configDir` rather than a hard-coded
	 * `.obsidian`: a vault can be opened with a different config directory, and a probe that
	 * assumed the default would answer about a folder the plugin is not installed in —
	 * which reads as "no file", which is the fresh-install answer, which is exactly the
	 * wrong one.
	 */
	it('asks about the plugin folder inside the vault config directory', async () => {
		const { app, asked } = fakeApp(true, '.obsidian');

		await createPluginDataProbe(app, 'renovation-planner').dataFileExists();

		expect(asked).toEqual(['.obsidian/plugins/renovation-planner/data.json']);
	});

	it('follows a non-default config directory', async () => {
		const { app, asked } = fakeApp(true, '.config/obsidian');

		await createPluginDataProbe(app, 'renovation-planner').dataFileExists();

		expect(asked).toEqual(['.config/obsidian/plugins/renovation-planner/data.json']);
	});

	// Marketplace rule and a correctness one: a path handed to the adapter is normalized
	// first, so a config directory with a trailing slash cannot produce a path the adapter
	// answers about differently.
	it('normalizes a doubled separator out of the path it asks about', async () => {
		const { app, asked } = fakeApp(true, '.obsidian/');

		await createPluginDataProbe(app, 'renovation-planner').dataFileExists();

		expect(asked).toEqual(['.obsidian/plugins/renovation-planner/data.json']);
	});

	/**
	 * Windows separators, driven explicitly — and this case is why, rather than being
	 * thoroughness: the first version of the `normalizePath` fake in
	 * `tests/helpers/obsidian-mock.ts` matched forward slashes ONLY, and every test here
	 * passed against it because none of the fixtures contained a backslash. A fake that is
	 * kinder than the real API turns a Windows-only defect into a green suite, and Windows
	 * is one of this repository's four CI legs.
	 */
	it('turns Windows separators into forward slashes', async () => {
		const { app, asked } = fakeApp(true, String.raw`.obsidian\nested`);

		await createPluginDataProbe(app, 'renovation-planner').dataFileExists();

		expect(asked).toEqual(['.obsidian/nested/plugins/renovation-planner/data.json']);
	});

	/**
	 * Rejections are NOT swallowed here. The caller's own `catch` treats a probe failure as
	 * unrecovered, which is the conservative direction: if the vault cannot answer whether
	 * the file exists, refusing to write over it is the safe answer, and a probe that
	 * returned `false` on an error would have answered "fresh install" instead.
	 */
	it('lets an adapter failure through rather than answering false', async () => {
		const failure = new Error('EACCES');
		const { app } = fakeApp(failure);

		await expect(createPluginDataProbe(app, 'renovation-planner').dataFileExists()).rejects.toBe(failure);
	});
});
