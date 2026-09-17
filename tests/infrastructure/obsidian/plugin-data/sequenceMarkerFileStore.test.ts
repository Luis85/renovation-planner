import { describe, expect, it, vi } from 'vitest';
import { SEQUENCE_MARKER_SCHEMA_VERSION } from '../../../../src/application/reference/deleteResolution';
import { SequenceMarkerFileStore, type TextFileAdapter } from '../../../../src/infrastructure/obsidian/plugin-data/SequenceMarkerFileStore';
import type { SequenceMarker } from '../../../../src/application/reference/deleteResolution';
import { expectErr, expectOk } from '../../../helpers/domain';
import { recorder as logger } from '../../../helpers/logger';

/**
 * The plugin-local durability of an outstanding sequence marker: ONE json file beside
 * `data.json`, rewritten per mutation (markers are rare and tiny), and the rule BP-02
 * slice 3 corrected — a marker this build cannot read is reported through the listing's
 * UNREADABLE half and preserved verbatim in the file, never migrated, never discarded and
 * never answered as an absence.
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
		expect(expectOk(await store.list()).markers.map((m) => m.entityId).toSorted()).toEqual(['asset-y', 'zone-x']);

		expectOk(await store.clear('zone-x'));
		expect(expectOk(await store.list()).markers.map((m) => m.entityId)).toEqual(['asset-y']);
	});

	it('answers null for a missing file rather than an error', async () => {
		const store = new SequenceMarkerFileStore(fakeAdapter(new Map()), PATH, logger);
		expect(expectOk(await store.read('zone-x'))).toBeNull();
		expect(expectOk(await store.list())).toEqual({ markers: [], unreadable: [] });
	});

	it('refuses a file that is not valid JSON instead of answering empty', async () => {
		const files = new Map<string, string>([[PATH, '{not json']]);
		const store = new SequenceMarkerFileStore(fakeAdapter(files), PATH, logger);
		expect(expectErr(await store.read('zone-x')).code).toBe('sequence.marker-unreadable');
	});

	it('refuses an envelope whose shape is unreadable instead of guessing', async () => {
		const files = new Map<string, string>([[PATH, JSON.stringify({ markers: 'not a map' })]]);
		const store = new SequenceMarkerFileStore(fakeAdapter(files), PATH, logger);
		const error = expectErr(await store.list());
		expect(error.code).toBe('sequence.marker-unreadable');
	});

	/**
	 * `null` is valid JSON and is the one value a property read cannot be attempted on, so the
	 * envelope's `markers` lookup ran ahead of the `raw === null` test and threw a TypeError out
	 * of a door whose whole contract is a coded refusal. Four bytes in a file the user can edit.
	 */
	it('refuses a file whose whole body is null instead of throwing', async () => {
		const files = new Map<string, string>([[PATH, 'null']]);
		const store = new SequenceMarkerFileStore(fakeAdapter(files), PATH, logger);
		expect(expectErr(await store.list()).code).toBe('sequence.marker-unreadable');
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

/**
 * BP-02 slice 3. The old rule dropped an entry this build could not read from the returned
 * map and then rewrote the file without it on the next mutation — so a vault sitting
 * mid-rollback presented as a vault with nothing outstanding (SDD §87 rule 8) and the very
 * next marker operation destroyed the evidence a newer build would have needed (rule 7
 * failing open). Every case below is about the ENTRY level; the whole-ENVELOPE refusal
 * above is a different level and is unchanged.
 */
describe('SequenceMarkerFileStore and an entry this build cannot read', () => {
	const FUTURE = { ...marker('zone-future'), schemaVersion: 99 };

	function seeded(entries: Record<string, unknown>): { files: Map<string, string>; store: SequenceMarkerFileStore } {
		const files = new Map<string, string>([
			[PATH, JSON.stringify({ schemaVersion: SEQUENCE_MARKER_SCHEMA_VERSION, markers: entries })],
		]);
		return { files, store: new SequenceMarkerFileStore(fakeAdapter(files), PATH, logger) };
	}

	it('reports it in the unreadable half with the version found, beside the readable ones', async () => {
		const { store } = seeded({ 'zone-future': FUTURE, 'zone-ok': marker('zone-ok') });

		const listing = expectOk(await store.list());

		expect(listing.markers.map((m) => m.entityId)).toEqual(['zone-ok']);
		expect(listing.unreadable).toEqual([{ entityId: 'zone-future', foundSchemaVersion: 99 }]);
	});

	it('logs it from list() and from no other door, so a preserved entry is not a line per operation', async () => {
		const { store } = seeded({ 'zone-future': FUTURE });
		const spy = vi.spyOn(logger, 'error');

		expectErr(await store.read('zone-future'));
		expectOk(await store.write(marker('zone-ok')));
		expectOk(await store.clear('zone-ok'));
		expect(spy).not.toHaveBeenCalled();

		expectOk(await store.list());
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenCalledWith('sequence.marker.unreadable', {
			entityId: 'zone-future',
			foundSchemaVersion: 99,
		});
		spy.mockRestore();
	});

	it('keeps it in the FILE when an unrelated marker is written', async () => {
		const { files, store } = seeded({ 'zone-future': FUTURE });

		expectOk(await store.write(marker('zone-ok')));

		// The written text, not a later `list()`: a store that held the entry in memory and
		// dropped it from disk would pass the weaker assertion and still lose the evidence.
		const written = JSON.parse(files.get(PATH) ?? '') as { markers: Record<string, unknown> };
		expect(written.markers['zone-future']).toEqual(FUTURE);
		expect(Object.keys(written.markers).toSorted()).toEqual(['zone-future', 'zone-ok']);
	});

	it('keeps it in the FILE when an unrelated marker is cleared', async () => {
		const { files, store } = seeded({ 'zone-future': FUTURE, 'zone-ok': marker('zone-ok') });

		expectOk(await store.clear('zone-ok'));

		const written = JSON.parse(files.get(PATH) ?? '') as { markers: Record<string, unknown> };
		expect(written.markers).toEqual({ 'zone-future': FUTURE });
	});

	/**
	 * The collision, and the one case the first version of this slice got wrong: `write()` used
	 * to file the recognised marker into the validated half and leave the raw one in the
	 * unreadable half, and `writeEnvelope`'s spread then let the recognised one win — so a
	 * delete of the very entity whose outstanding record this build cannot read destroyed that
	 * record silently, with no log and no refusal. It is reachable: `runDeleteResolution` opens
	 * every sequence with `markers.write(marker)` keyed on the entity being deleted.
	 */
	it('refuses write() for that same id rather than superseding the record it cannot read', async () => {
		const { files, store } = seeded({ 'zone-future': FUTURE });
		const before = files.get(PATH);

		const refusal = expectErr(await store.write(marker('zone-future')));

		expect(refusal.code).toBe('sequence.marker-write-blocked');
		// The bytes, not a later `list()`: the whole defect was a rewrite nobody could see.
		expect(files.get(PATH)).toBe(before);
		expect(expectOk(await store.list()).unreadable).toEqual([
			{ entityId: 'zone-future', foundSchemaVersion: 99 },
		]);
	});

	it('refuses read() for it rather than manufacturing an absence', async () => {
		const { store } = seeded({ 'zone-future': FUTURE });
		expect(expectErr(await store.read('zone-future')).code).toBe('sequence.marker-unreadable');
	});

	it('clear() removes it — an explicit clear is an intentional gesture', async () => {
		const { files, store } = seeded({ 'zone-future': FUTURE });

		expectOk(await store.clear('zone-future'));

		expect(expectOk(await store.list()).unreadable).toEqual([]);
		const written = JSON.parse(files.get(PATH) ?? '') as { markers: Record<string, unknown> };
		expect(written.markers).toEqual({});
	});

	it('treats a recognised version with a non-array progress as unreadable, not as readable', async () => {
		const { store } = seeded({ 'zone-bent': { ...marker('zone-bent'), progress: 'not an array' } });

		const listing = expectOk(await store.list());

		expect(listing.markers).toEqual([]);
		expect(listing.unreadable).toEqual([
			{ entityId: 'zone-bent', foundSchemaVersion: SEQUENCE_MARKER_SCHEMA_VERSION },
		]);
	});

	/**
	 * `null` and a bare number are what a hand-edited file produces, and the property read the
	 * validation performs is exactly what a `null` entry cannot take — the same four-byte
	 * defect the ENVELOPE guard above already carries, one level down.
	 */
	it('treats a null or primitive entry as unreadable instead of throwing out of a coded door', async () => {
		const { store } = seeded({ 'zone-null': null, 'zone-number': 5 });

		const listing = expectOk(await store.list());

		expect(listing.markers).toEqual([]);
		expect(listing.unreadable).toEqual([
			{ entityId: 'zone-null', foundSchemaVersion: undefined },
			{ entityId: 'zone-number', foundSchemaVersion: undefined },
		]);
	});
});
