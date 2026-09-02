/**
 * Three small Obsidian adapters: "does this vault file exist", "tell me when the theme changed"
 * and "tell me when a vault file changed". Each is the thin edge of a port, so what is checked
 * is what they ASK Obsidian — which is all a fake can honestly answer for.
 */
import { describe, expect, it } from 'vitest';
import { TFile, TFolder } from 'obsidian';
import { createVaultFileProbe } from '../../../../src/infrastructure/obsidian/vault/vaultFileProbe';
import { createThemeChangeSource } from '../../../../src/infrastructure/obsidian/workspace/themeChanges';
import { createVaultFileChangeSource } from '../../../../src/infrastructure/obsidian/vault/vaultFileChanges';

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

/**
 * A vault that records what was registered and can fire it, which is the whole of what this
 * adapter can be asked about: it does not decide what a background is and it does not filter.
 */
function eventVault() {
	const registered = new Map<object, { name: string; callback: (...args: never[]) => void }>();
	return {
		registered,
		vault: {
			on(name: string, callback: (...args: never[]) => void): object {
				const reference = {};
				registered.set(reference, { name, callback });
				return reference;
			},
			offref(reference: object): void {
				registered.delete(reference);
			},
		},
		fire(name: string, ...args: readonly unknown[]): void {
			for (const entry of registered.values()) {
				if (entry.name === name) entry.callback(...(args as never[]));
			}
		},
	};
}

describe('subscribing to vault file changes', () => {
	/**
	 * All FOUR, asserted by exact set rather than by count so that one dropping out is as visible
	 * as one joining. `create` is load-bearing: a reference that was dangling becomes live the
	 * moment a file appears at its path, and refusing to notice that leaves a `missing` status
	 * nothing retracts.
	 */
	it('registers for create, modify, delete and rename', () => {
		const { registered, vault } = eventVault();

		createVaultFileChangeSource(vault as never)(() => undefined);

		expect([...registered.values()].map((entry) => entry.name).toSorted()).toEqual([
			'create',
			'delete',
			'modify',
			'rename',
		]);
	});

	it('reports the path of a file that changed', () => {
		const { vault, fire } = eventVault();
		const paths: string[] = [];
		createVaultFileChangeSource(vault as never)((path) => paths.push(path));

		fire('modify', fileAt('Specs/oven.png'));
		fire('delete', fileAt('Specs/gone.png'));

		expect(paths).toEqual(['Specs/oven.png', 'Specs/gone.png']);
	});

	/**
	 * BOTH paths, and that is the case a rename would otherwise get wrong in the direction that
	 * matters: a reference names the OLD path, and Obsidian rewrites markdown links on a rename
	 * while a frontmatter string is not one. So the surface drawing the old path is the one that
	 * has to hear, and the new path is reported too because it may be a path some OTHER subject
	 * has been referencing all along.
	 */
	it('reports both paths for a rename', () => {
		const { vault, fire } = eventVault();
		const paths: string[] = [];
		createVaultFileChangeSource(vault as never)((path) => paths.push(path));

		fire('rename', fileAt('Specs/new.png'), 'Specs/old.png');

		expect(paths).toEqual(['Specs/old.png', 'Specs/new.png']);
	});

	/**
	 * A FOLDER has no bytes to draw, and `getAbstractFileByPath`'s own case above is the same
	 * narrowing asked at the other door. Obsidian hands `TAbstractFile` to every one of these.
	 */
	it('says nothing about a folder', () => {
		const { vault, fire } = eventVault();
		const paths: string[] = [];
		createVaultFileChangeSource(vault as never)((path) => paths.push(path));
		const folder = new TFolder();
		folder.path = 'Specs';

		fire('modify', folder);
		fire('rename', folder, 'Sheets');

		expect(paths).toEqual([]);
	});

	/**
	 * All four released together. `offref` and not `off`, for `createThemeChangeSource`'s reason —
	 * and a PARTIAL release is a listener that outlives its view, which is why this asserts the
	 * map is empty rather than that it shrank.
	 */
	it('releases every registration on unsubscribe', () => {
		const { registered, vault } = eventVault();
		const unsubscribe = createVaultFileChangeSource(vault as never)(() => undefined);
		expect(registered.size).toBe(4);

		unsubscribe();

		expect(registered.size).toBe(0);
	});
});
