import { vi } from 'vitest';
import { settle } from './editor';

const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
export function installDimensionFrames(): void {
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { const id = ++nextFrame; frames.set(id, callback); return id; });
	vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
}
export function clearDimensionFrames(): void { frames.clear(); }
export function pendingDimensionFrames(): readonly FrameRequestCallback[] { return [...frames.values()]; }
export async function flushDimensionFrames(): Promise<void> {
	for (let pass = 0; pass < 8; pass++) {
		await settle();
		if (!frames.size) return;
		const batch = [...frames.values()]; frames.clear();
		for (const callback of batch) callback(pass * 16);
	}
	throw new Error('layout did not settle after eight animation frames');
}
