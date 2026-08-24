/**
 * Two small Obsidian adapters: "does this vault file exist" and "tell me when the theme
 * changed". Both are the thin edge of a port, so what is checked is what they ASK Obsidian
 * — which is all a fake can honestly answer for.
 */
import { describe, expect, it } from 'vitest';
import { TFile, TFolder } from 'obsidian';
import { createVaultFileProbe } from '../../../../src/infrastructure/obsidian/vault/vaultFileProbe';
import { createThemeChangeSource } from '../../../../src/infrastructure/obsidian/workspace/themeChanges';

function vaultWith(entries: Record<string, TFile | TFolder>) {
	const asked: string[] = [];
	const vault = {
		getAbstractFileByPath(path: string) {
			asked.push(path);
			return entries[path] ?? null;
		},
	};
	return { vault, asked };
}

function fileAt(path: string): TFile {
	const file = new TFile();
	file.path = path;
	return file;
}

describe('probing for a vault file', () => {
	it('answers true for a file that is there', () => {
		const { vault } = vaultWith({ 'Plans/ground.png': fileAt('Plans/ground.png') });

		expect(createVaultFileProbe(vault as never).fileExists('Plans/ground.png')).toBe(true);
	});

	it('answers false for a path holding nothing', () => {
		const { vault } = vaultWith({});

		expect(createVaultFileProbe(vault as never).fileExists('Plans/gone.png')).toBe(false);
	});

	/**
	 * `getAbstractFileByPath` answers folders too, so a null check would call a FOLDER named
	 * `plan.pdf` a background — which is why the port asks about a file rather than about a
	 * path existing.
	 */
	it('answers false for a folder, however plausibly named', () => {
		const folder = new TFolder();
		folder.path = 'Plans/ground.pdf';
		const { vault } = vaultWith({ 'Plans/ground.pdf': folder });

		expect(createVaultFileProbe(vault as never).fileExists('Plans/ground.pdf')).toBe(false);
	});

	/**
	 * The path came from frontmatter or from a picker — both places a user can type.
	 * Obsidian's index is keyed by the normalized form, so an un-normalized lookup answers
	 * "missing" for a file that is plainly there, and only on the platform whose separators
	 * differ.
	 */
	it('normalizes the path before asking', () => {
		const { vault, asked } = vaultWith({});

		createVaultFileProbe(vault as never).fileExists('/Plans\\\\sub//ground.png/');

		expect(asked).toEqual(['Plans/sub/ground.png']);
	});
});

function fakeWorkspace() {
	const listeners = new Map<object, { name: string; listener: () => void }>();
	const workspace = {
		on(name: string, listener: () => void) {
			const reference = {};
			listeners.set(reference, { name, listener });
			return reference;
		},
		offref(reference: object) {
			listeners.delete(reference);
		},
	};
	return { workspace, listeners };
}

describe('following the theme', () => {
	it('subscribes to css-change and forwards it', () => {
		const { workspace, listeners } = fakeWorkspace();
		let fired = 0;

		createThemeChangeSource(workspace as never)(() => {
			fired += 1;
		});

		expect([...listeners.values()][0].name).toBe('css-change');
		[...listeners.values()][0].listener();
		expect(fired).toBe(1);
	});

	/**
	 * `offref` and not `off`: `off(name, callback)` compares callbacks and silently fails to
	 * detach a wrapped one, and a `css-change` listener that outlives its view re-resolves a
	 * palette onto a detached element for the rest of the session.
	 */
	it('retires the registration it made, by reference', () => {
		const { workspace, listeners } = fakeWorkspace();

		const unsubscribe = createThemeChangeSource(workspace as never)(() => undefined);
		expect(listeners.size).toBe(1);

		unsubscribe();

		expect(listeners.size).toBe(0);
	});

	it('gives each subscriber its own registration', () => {
		const { workspace, listeners } = fakeWorkspace();
		const source = createThemeChangeSource(workspace as never);

		const first = source(() => undefined);
		source(() => undefined);
		expect(listeners.size).toBe(2);

		first();

		expect(listeners.size).toBe(1);
	});
});
