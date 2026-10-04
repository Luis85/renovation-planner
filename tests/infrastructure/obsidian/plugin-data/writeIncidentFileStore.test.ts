import { describe, expect, it } from 'vitest';
import {
	UNREADABLE_WRITE_INCIDENT_CODE,
	WRITE_INCIDENT_SCHEMA_VERSION,
	type WriteIncident,
} from '../../../../src/application/incidents/WriteIncident';
import type { TextFileAdapter } from '../../../../src/infrastructure/obsidian/plugin-data/SequenceMarkerFileStore';
import { WriteIncidentFileStore } from '../../../../src/infrastructure/obsidian/plugin-data/WriteIncidentFileStore';
import { expectErr, expectOk } from '../../../helpers/domain';

/**
 * ADR-0034's durable record: one plugin-local JSON file, a SIBLING of
 * `sequence-markers.json`, a LIST rather than a map, and — the case that differs from that
 * sibling — a record this build cannot read stays OPEN rather than being discarded.
 */

function fakeAdapter(files: Map<string, string>, failWrite = false): TextFileAdapter {
	return {
		exists: (path) => Promise.resolve(files.has(path)),
		read: (path) => {
			const text = files.get(path);
			if (text === undefined) return Promise.reject(new Error(`no file ${path}`));
			return Promise.resolve(text);
		},
		write: (path, data) => {
			if (failWrite) return Promise.reject(new Error('disk full'));
			files.set(path, data);
			return Promise.resolve();
		},
		remove: (path) => {
			files.delete(path);
			return Promise.resolve();
		},
	};
}

function incident(id: string): WriteIncident {
	return {
		schemaVersion: WRITE_INCIDENT_SCHEMA_VERSION,
		incidentId: id,
		raisedAt: '2026-09-16T00:00:00.000Z',
		code: 'zone.sidecar-write-uncompensated',
		category: 'Persistence',
		affected: [{ entityKind: 'zone', entityId: 'zone-1' }],
	};
}

const PATH = '.obsidian/plugins/renovation-planner/write-incidents.json';

describe('WriteIncidentFileStore', () => {
	it('appends and lists through one plugin-local file', async () => {
		const files = new Map<string, string>();
		const store = new WriteIncidentFileStore(fakeAdapter(files), PATH);

		expectOk(await store.add(incident('incident-a')));
		expectOk(await store.add(incident('incident-b')));

		expect(files.get(PATH)).toContain('"schemaVersion":1');
		expect(expectOk(await store.list()).map((i) => i.incidentId)).toEqual(['incident-a', 'incident-b']);
	});

	it('records two incidents naming the SAME entity, which is why records are a list', async () => {
		const files = new Map<string, string>();
		const store = new WriteIncidentFileStore(fakeAdapter(files), PATH);

		expectOk(await store.add(incident('incident-a')));
		expectOk(await store.add(incident('incident-b')));

		const listed = expectOk(await store.list());
		expect(listed.map((i) => i.affected[0]?.entityId)).toEqual(['zone-1', 'zone-1']);
	});

	it('reads a missing file as no incidents', async () => {
		const store = new WriteIncidentFileStore(fakeAdapter(new Map()), PATH);
		expect(expectOk(await store.list())).toEqual([]);
	});

	it.each([
		['not JSON at all', '{oops'],
		// `null` is valid JSON, so the four-byte body reaches the property read the guard protects.
		['a literal null body', 'null'],
		['an envelope with no incidents array', '{"schemaVersion":1}'],
		['an incidents field that is not an array', '{"schemaVersion":1,"incidents":{}}'],
	])('refuses %s rather than answering empty', async (_name, body) => {
		const files = new Map([[PATH, body]]);
		const store = new WriteIncidentFileStore(fakeAdapter(files), PATH);
		expect(expectErr(await store.list()).code).toBe('write-incident.file-unreadable');
	});

	/**
	 * The case that differs from `SequenceMarkerFileStore`, which DISCARDS an unrecognised
	 * schema version with a log line and answers as if the record were not there. Watched red
	 * against an implementation copied naively from that sibling: the discard version returned
	 * `[]` here, so an incidents file written by a newer build read as an all-clear — precisely
	 * the manufactured all-clear ADR-0034 exists to prevent.
	 */
	it('keeps a record this build cannot read OPEN rather than discarding it', async () => {
		const files = new Map([
			[PATH, JSON.stringify({ schemaVersion: 2, incidents: [{ schemaVersion: 2, incidentId: 'from-the-future', raisedAt: 'later', shape: 'unknown' }] })],
		]);
		const store = new WriteIncidentFileStore(fakeAdapter(files), PATH);

		const listed = expectOk(await store.list());
		expect(listed).toHaveLength(1);
		expect(listed[0]?.code).toBe(UNREADABLE_WRITE_INCIDENT_CODE);
		expect(listed[0]?.incidentId).toBe('from-the-future');
		expect(listed[0]?.schemaVersion).toBe(2);
		expect(listed[0]?.affected).toEqual([]);
	});

	/**
	 * The case Fix 3 closes: a v1-stamped record — the CURRENT schema version, so the
	 * unrecognised-version case above does not cover it — missing `raisedAt`, `code` or
	 * `category`. Before the fix `asIncident` checked only `schemaVersion`, `incidentId` and
	 * `affected`, so a record like this came back RECOGNISED with `undefined` sitting where
	 * the type declares a string — invisible until something reads one of the three, which
	 * the diagnostics reader ADR-0034 requires will do. Watched red: reverting the three added
	 * `typeof` checks in `asIncident` makes this assert `code === UNREADABLE_WRITE_INCIDENT_CODE`
	 * against a listed record whose `code` is actually `undefined`.
	 */
	it('treats a v1 record missing raisedAt, code or category as unreadable, not recognised', async () => {
		const files = new Map([
			[PATH, JSON.stringify({ schemaVersion: 1, incidents: [{ schemaVersion: 1, incidentId: 'incident-a', affected: [] }] })],
		]);
		const store = new WriteIncidentFileStore(fakeAdapter(files), PATH);

		const listed = expectOk(await store.list());
		expect(listed).toHaveLength(1);
		expect(listed[0]?.code).toBe(UNREADABLE_WRITE_INCIDENT_CODE);
		expect(listed[0]?.category).toBe('Persistence');
		expect(listed[0]?.incidentId).toBe('incident-a');
	});

	it('rewrites an unreadable record VERBATIM rather than migrating it', async () => {
		const foreign = { schemaVersion: 2, incidentId: 'from-the-future', shape: 'unknown' };
		const files = new Map([[PATH, JSON.stringify({ schemaVersion: 2, incidents: [foreign] })]]);
		const store = new WriteIncidentFileStore(fakeAdapter(files), PATH);

		expectOk(await store.add(incident('incident-a')));

		const written = JSON.parse(files.get(PATH) ?? '') as { incidents: unknown[] };
		expect(written.incidents[0]).toEqual(foreign);
		expect(expectOk(await store.list())).toHaveLength(2);
	});

	it('surfaces a failing adapter write as a coded refusal', async () => {
		const store = new WriteIncidentFileStore(fakeAdapter(new Map(), true), PATH);
		expect(expectErr(await store.add(incident('incident-a'))).code).toBe('write-incident.write-failed');
	});
});
