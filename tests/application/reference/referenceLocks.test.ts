import { describe, expect, it, vi } from 'vitest';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';

/**
 * The lock hierarchy's own rules, checked at the lock rather than by driving the commands
 * that exist today — so they hold for sequences not yet written.
 */
describe('ReferenceLocks', () => {
	it('acquires and releases both levels', async () => {
		const locks = new ReferenceLocks();
		const release = await locks.acquire(['zone-a'], ['requirement-1']);
		expect(locks.isHeld(1, 'zone-a')).toBe(true);
		expect(locks.isHeld(2, 'requirement-1')).toBe(true);
		release();
		expect(locks.isHeld(1, 'zone-a')).toBe(false);
		expect(locks.isHeld(2, 'requirement-1')).toBe(false);
	});

	it('serializes two acquirers of the same level-1 id', async () => {
		const locks = new ReferenceLocks();
		const order: string[] = [];
		const first = (async () => {
			const releaseFirst = await locks.acquire(['zone-a'], []);
			order.push('first');
			releaseFirst();
		})();
		const second = (async () => {
			const release = await locks.acquire(['zone-a'], []);
			order.push('second');
			release();
		})();
		await Promise.all([first, second]);
		expect(order).toEqual(['first', 'second']);
	});

	it('a session may acquire level 1 then level 2 in two calls — the delete resolution shape', async () => {
		const locks = new ReferenceLocks();
		const session = locks.beginSession();
		await session.acquire(['asset-a'], []);
		await session.acquire([], ['requirement-1']);
		expect(locks.isHeld(1, 'asset-a')).toBe(true);
		expect(locks.isHeld(2, 'requirement-1')).toBe(true);
		session.release();
	});

	it('raises on a second acquisition within a level from a holder', async () => {
		const locks = new ReferenceLocks();
		const session = locks.beginSession();
		await session.acquire(['zone-a'], []);
		await expect(session.acquire(['zone-b'], [])).rejects.toThrow(/second level-1/);
		session.release();

		const session2 = locks.beginSession();
		await session2.acquire([], ['requirement-1']);
		await expect(session2.acquire([], ['requirement-2'])).rejects.toThrow(/second level-2/);
		session2.release();
	});

	it('raises on any level-1 request from a level-2 holder', async () => {
		const locks = new ReferenceLocks();
		const session = locks.beginSession();
		await session.acquire([], ['requirement-1']);
		await expect(session.acquire(['zone-a'], [])).rejects.toThrow(/hierarchy/);
		session.release();
	});

	it('two multi-lock commands with opposite lock sets both complete — the deadlock test', async () => {
		const locks = new ReferenceLocks();
		// Z1's requirements reassigned to Z2 while Z2's are reassigned to Z1: under
		// first-come-first-served per-id acquisition this hangs forever; under the sorted
		// single batch one waits for the other. The timeout is what makes a regression a
		// FAILURE rather than a hung suite.
		const run = async (source: string, target: string): Promise<void> => {
			const session = locks.beginSession();
			await session.acquire([source, target], []);
			// Hold long enough that the other command must contend for real.
			await new Promise((resolve) => {
			setTimeout(resolve, 10);
		});
			session.release();
		};
		await Promise.all([
			run('zone-1', 'zone-2'),
			run('zone-2', 'zone-1'),
		]);
		expect(locks.isHeld(1, 'zone-1')).toBe(false);
		expect(locks.isHeld(1, 'zone-2')).toBe(false);
	}, 2000);

	it('a blocked acquirer does not spin while waiting', async () => {
		const locks = new ReferenceLocks();
		const release = await locks.acquire(['zone-a'], []);
		let resolved = false;
		const contender = locks.acquire(['zone-a'], []).then(() => {
			resolved = true;
			return undefined;
		});
		await vi.waitFor(() => expect(resolved).toBe(false));
		release();
		await contender;
		expect(resolved).toBe(true);
	});

	it('serializes two acquirers of the same level-2 id', async () => {
		const locks = new ReferenceLocks();
		const order: string[] = [];
		const first = (async () => {
			const releaseFirst = await locks.acquire([], ['requirement-1']);
			order.push('first');
			releaseFirst();
		})();
		const second = (async () => {
			const release = await locks.acquire([], ['requirement-1']);
			order.push('second');
			release();
		})();
		await Promise.all([first, second]);
		expect(order).toEqual(['first', 'second']);
	});

	it('a level-2 contender waits for its id without taking the level-1 ids of the holder', async () => {
		const locks = new ReferenceLocks();
		const holder = locks.beginSession();
		await holder.acquire(['zone-a'], ['requirement-1']);

		let resolved = false;
		const contender = (async () => {
			const release = await locks.acquire(['zone-b'], ['requirement-1']);
			resolved = true;
			release();
		})();
		await vi.waitFor(() => expect(locks.isHeld(1, 'zone-b')).toBe(true));
		expect(resolved).toBe(false);

		holder.release();
		await contender;
		expect(resolved).toBe(true);
	});
});
