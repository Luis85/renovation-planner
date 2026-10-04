import { expect } from 'vitest';

declare const panes: { map<T>(fn: (pane: string, index: number) => T): Promise<T[]> };
const load = (): Promise<number[]> => Promise.resolve([1]);

export async function green(): Promise<void> {
	expect(await load()).toEqual(await panes.map((_, index) => index));
	expect(await load()).toEqual([...(await load())]);
}
