import { expect } from 'vitest';

/** WebdriverIO's element array: `map` is ASYNC, so it hands back a Promise (run 37118058600). */
declare const panes: { map<T>(fn: (pane: string, index: number) => T): Promise<T[]> };
const load = (): Promise<number[]> => Promise.resolve([1]);

export async function redArguments(): Promise<void> {
	expect(await load()).toEqual(panes.map((_, index) => index));
	expect(await load()).toContain(load());
}
