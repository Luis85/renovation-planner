import { expect } from 'vitest';
import type { Expected, Loaded } from '../../src/application/ports/versioning';

export type SaveResult<T> = { ok: true; value: Loaded<T> } | { ok: false; error: unknown };

export interface Upsertable<T> {
	save(entity: T, expected: Expected): Promise<SaveResult<T>>;
}

/**
 * `save` is an ID-keyed UPSERT, not insert-only (see ZoneRepository): slice 8's undo of
 * a delete restores by writing the captured snapshot back through save() under its
 * original ID — a restore that minted a new ID would not be an undo. Asserted ONCE here,
 * identically for every entity port, rather than re-written per contract suite.
 */
export async function assertSaveUpsertsById<T extends { readonly id: string; readonly name: string }>(args: {
	repository: Upsertable<T>;
	entity: T;
	read(): Promise<T | null>;
	replacementName: string;
}): Promise<Loaded<T>> {
	const first = await args.repository.save(args.entity, 'absent');
	expect(first.ok).toBe(true);
	if (!first.ok) {
		throw new Error('initial save failed');
	}
	const second = await args.repository.save({ ...args.entity, name: args.replacementName }, first.value.version);
	expect(second.ok).toBe(true);
	if (!second.ok) {
		throw new Error('replacement save failed');
	}
	expect(second.value.version.revision).toBeGreaterThanOrEqual(2);
	const reread = await args.read();
	expect(reread?.name).toBe(args.replacementName);
	return second.value;
}

/** The whole upsert term as one shared walk; the revision claim stays with each suite's test. */
export async function expectIdKeyedUpsert<
	R extends Upsertable<T> & {
		getById(id: T['id']): Promise<{ ok: true; value: Loaded<T> | null } | { ok: false; error: unknown }>;
	},
	T extends { readonly id: string; readonly name: string },
>(args: { repository: R; entity: T; replacementName: string }): Promise<Loaded<T>> {
	const written = await assertSaveUpsertsById({
		repository: args.repository,
		entity: args.entity,
		read: async () => {
			const found = await args.repository.getById(args.entity.id);
			return found.ok ? (found.value?.entity ?? null) : null;
		},
		replacementName: args.replacementName,
	});
	return written;
}
