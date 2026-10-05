import { expect } from 'vitest';

const read = (): Promise<number> => Promise.resolve(1);

/** The poll's ARGUMENT is a function and the matcher's argument a value: nothing to refuse. */
export async function poll(): Promise<void> {
	await expect.poll(read).toBe(1);
	await expect.poll(async () => (await read()) + 1).toEqual(2);
}
