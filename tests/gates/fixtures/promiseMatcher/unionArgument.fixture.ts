import { expect } from 'vitest';

declare const either: number[] | Promise<number[]>;

export function unionWithPromise(): void {
	expect([1]).toStrictEqual(either);
}
