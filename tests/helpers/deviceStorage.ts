import type { DeviceStorage } from '../../src/presentation/editor/PlanEditorContext';

/** An in-memory `DeviceStorage`: what was written is what is read, and every write is recorded. */
export function memoryDeviceStorage(initial: unknown = null): DeviceStorage & { readonly writes: unknown[] } {
	let stored = initial;
	const writes: unknown[] = [];
	return {
		read: () => stored,
		write: (value) => {
			stored = value;
			writes.push(value);
		},
		writes,
	};
}
