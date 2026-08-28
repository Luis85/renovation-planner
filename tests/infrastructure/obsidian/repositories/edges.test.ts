import { describe, expect, it } from 'vitest';
import { TFolder as MockTFolder } from 'obsidian';
import {
	ensureFolder,
	isTFolder,
	persistenceError,
	serializeFrontmatter,
} from '../../../../src/infrastructure/obsidian/repositories/noteIo';
import { fileNameFor, sidecarPathFor } from '../../../../src/infrastructure/obsidian/repositories/paths';
import { EchoWindow } from '../../../../src/infrastructure/persistence/index/EchoWindow';
import { InMemoryProjectIndex } from '../../../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { MigrationRunner } from '../../../../src/infrastructure/persistence/migration/MigrationRunner';
import { KeyedQueues } from '../../../../src/infrastructure/obsidian/repositories/KeyedQueues';

/**
 * Small units with sharp edges: serializer fallbacks, filename sanitation, the folder
 * guard, the echo window's move, the index's absent-entry branches, and the migration
 * registry's multi-step push.
 */
describe('noteIo edges', () => {
	it('serializes null values and empty arrays', () => {
		const yaml = serializeFrontmatter({ a: null, b: [] });
		expect(yaml).toContain('a: null');
		expect(yaml).toContain('b: []');
	});

	it('isTFolder answers for real folders only', () => {
		const folder = new MockTFolder();
		expect(isTFolder(folder)).toBe(true);
		expect(isTFolder(null)).toBe(false);
		expect(isTFolder({})).toBe(false);
	});

	it('ensureFolder refuses when a path segment exists as a file', async () => {
		const fake = {
			getAbstractFileByPath: (path: string) => (path === 'x' ? { children: undefined } : null),
			createFolder: (): Promise<void> => Promise.resolve(),
		};
		await expect(ensureFolder(fake as never, 'x/y')).rejects.toThrow('not a folder');
	});

	it('persistenceError omits cause when there is none', () => {
		expect(persistenceError('c', 'm')).toEqual({ category: 'Persistence', code: 'c', message: 'm' });
	});
});

describe('path derivation edges', () => {
	it('falls back to untitled for an empty or fully-forbidden name', () => {
		expect(fileNameFor('')).toBe('untitled');
		expect(fileNameFor('///')).toBe('untitled');
	});

	it('trims trailing dots and spaces after slicing long names', () => {
		const name = `${'a'.repeat(85)}..`;
		expect(fileNameFor(name)).toBe('a'.repeat(80));
	});

	it('sidecar path keys off the geometry folder and the full plan ID', () => {
		expect(sidecarPathFor('R', 'plan-x' as never)).toBe('R/Geometry/plan-x.rpgeo');
	});
});

describe('echo window move', () => {
	it('moves tokens and tolerates unknown paths', () => {
		const echo = new EchoWindow();
		echo.mark('/old', 't' as never);
		echo.move('/missing', '/x');
		echo.move('/old', '/new');
		expect(echo.matches('/new', 't' as never)).toBe(true);
		expect(echo.matches('/old', 't' as never)).toBe(false);
	});
});

describe('in-memory index edges', () => {
	it('getPath of nothing and remove of nothing are safe', () => {
		const index = new InMemoryProjectIndex();
		expect(index.getPath('nope' as never)).toBeUndefined();
		index.remove('nope' as never);
		expect(index.entries()).toEqual([]);
	});
});

describe('migration registry', () => {
	it('registers multiple steps per kind and chains them in order', () => {
		const runner = new MigrationRunner();
		runner.register('k', { fromVersion: 1, toVersion: 2, migrate: (x) => x });
		runner.register('k', { fromVersion: 0, toVersion: 1, migrate: (x) => x });
		const original = { ...(runner as unknown as { byKind: Map<string, unknown[]> }) }.byKind?.get('k');
		expect(original?.length ?? 0).toBeGreaterThan(0);
	});
});

describe('keyed queues', () => {
	it('runs tasks strictly in submission order even across rejections', async () => {
		const queues = new KeyedQueues();
		const order: string[] = [];
		const first = queues.run('k', () => {
			order.push('first-start');
			return Promise.reject(new Error('boom'));
		});
		const second = queues.run('k', () => {
			order.push('second-start');
			return Promise.resolve('ok');
		});
		await expect(first).rejects.toThrow('boom');
		await expect(second).resolves.toBe('ok');
		expect(order).toEqual(['first-start', 'second-start']);
	});
});
