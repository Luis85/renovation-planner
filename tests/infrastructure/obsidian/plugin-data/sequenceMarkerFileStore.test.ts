import { describe, expect, it, vi } from 'vitest';
import { SEQUENCE_MARKER_SCHEMA_VERSION } from '../../../../src/application/reference/deleteResolution';
import { SequenceMarkerFileStore, type TextFileAdapter } from '../../../../src/infrastructure/obsidian/plugin-data/SequenceMarkerFileStore';
import type { SequenceMarker } from '../../../../src/application/reference/deleteResolution';
import { expectErr, expectOk } from '../../../helpers/domain';
import { recorder as logger } from '../../../helpers/logger';

/**
 * The plugin-local durability of an outstanding sequence marker: ONE json file beside
 * `data.json`, rewritten per mutation (markers are rare and tiny), with the discard rule
 * the task spec fixes — a marker a newer version cannot read is dropped WITH a diagnostic,
 * never migrated and never answered as present.
 */

function fakeAdapter(files: Map<string, string>): TextFileAdapter {
	return {
		exists: (path) => Promise.resolve(files.has(path)),
		read: (path) => {
			const text = files.get(path);
			if (text === undefined) return Promise.reject(new Error(`no file ${path}`));
			return Promise.resolve(text);
		},
		write: (path, data) => {
			files.set(path, data);
			return Promise.resolve();
		},
		remove: (path) => {
			files.delete(path);
			return Promise.resolve();
		},
	};
}

function marker(entityId: string): SequenceMarker {
	return {
		schemaVersion: SEQUENCE_MARKER_SCHEMA_VERSION,
		kind: 'delete-resolution',
		entityKind: 'zone',
		entityId,
		entitySnapshot: { entity: { id: entityId }, version: { revision: 3, observed: 'o' } } as never,
		entityDeleted: false,
		affectedBefore: [],
		progress: [],
	};
}

const PATH = '.obsidian/plugins/renovation-planner/sequence-markers.json';

describe('SequenceMarkerFileStore', () => {
	it('writes, lists, reads and clears through one plugin-local file', async () => {
		const files = new Map<string, string>();
		const store = new SequenceMarkerFileStore(fakeAdapter(files), PATH, logger);

		expect(expectOk(await store.read('zone-x'))).toBeNull();

		expectOk(await store.write(marker('zone-x')));
		expectOk(await store.write(marker('asset-y')));
		expect(files.get(PATH)).toContain('"schemaVersion":1');
		expect(expectOk(await store.list()).map((m) => m.entityId).toSorted()).toEqual(['asset-y', 'zone-x']);

		expectOk(await store.clear('zone-x'));
		expect(expectOk(await store.list()).map((m) => m.entityId)).toEqual(['asset-y']);
	});

	it('answers null for a missing file rather than an error', async () => {
		const store = new SequenceMarkerFileStore(fakeAdapter(new Map()), PATH, logger);
		expect(expectOk(await store.read('zone-x'))).toBeNull();
		expect(expectOk(await store.list())).toEqual([]);
	});

	it('refuses a file that is not valid JSON instead of answering empty', async () => {
		const files = new Map<string, string>([[PATH, '{not json']]);
		const store = new SequenceMarkerFileStore(fakeAdapter(files), PATH, logger);
		expect(expectErr(await store.read('zone-x')).code).toBe('sequence.marker-unreadable');
	});

	it('discards a marker at an unknown schemaVersion with a diagnostic naming the entity', async () => {
		const stale = { ...marker('zone-old'), schemaVersion: 99 };
		const files = new Map<string, string>([
			[PATH, JSON.stringify({ schemaVersion: 99, markers: { 'zone-old': stale } })],
		]);
		const spy = vi.spyOn(logger, 'error');
		const store = new SequenceMarkerFileStore(fakeAdapter(files), PATH, logger);

		expect(expectOk(await store.read('zone-old'))).toBeNull();
		expect(spy).toHaveBeenCalledWith('sequence.marker.discarded', expect.objectContaining({ entityId: 'zone-old' }));
		spy.mockRestore();
	});

	it('refuses an envelope whose shape is unreadable instead of guessing', async () => {
		const files = new Map<string, string>([[PATH, JSON.stringify({ markers: 'not a map' })]]);
		const store = new SequenceMarkerFileStore(fakeAdapter(files), PATH, logger);
		const error = expectErr(await store.list());
		expect(error.code).toBe('sequence.marker-unreadable');
	});

	it('a failed envelope read fails write and clear too — no mutation on an unreadable base', async () => {
		const files = new Map<string, string>([[PATH, '{not json']]);
		const store = new SequenceMarkerFileStore(fakeAdapter(files), PATH, logger);
		expect(expectErr(await store.write(marker('zone-x'))).code).toBe('sequence.marker-unreadable');
		expect(expectErr(await store.clear('zone-x')).code).toBe('sequence.marker-unreadable');
	});

	it('surfaces a failing file write instead of pretending the marker landed', async () => {
		const files = new Map<string, string>();
		const adapter = fakeAdapter(files);
		let writesFail = true;
		adapter.write = (path, data) => {
			if (writesFail) return Promise.reject(new Error('disk full'));
			files.set(path, data);
			return Promise.resolve();
		};
		const store = new SequenceMarkerFileStore(adapter, PATH, logger);
		expect(expectErr(await store.write(marker('zone-x'))).code).toBe('sequence.marker-write-failed');

		writesFail = false;
		expectOk(await store.write(marker('zone-x')));
	});
});
