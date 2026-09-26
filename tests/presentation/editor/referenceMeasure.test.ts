// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ReferenceMeasure from '../../../src/presentation/editor/reference/ReferenceMeasure.vue';

let wrapper: ReturnType<typeof mount> | undefined;
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.restoreAllMocks(); });

// The coordinate fields are `<input type="number">`, and Vue's `vModelText` hands a number
// input's value back as a Number — so the model's DECLARED type has to admit one, or every
// keystroke reaches the parent and comes back as a prop Vue's own type check refuses.
it('takes a typed coordinate back from its parent without a prop type warning', async () => {
	const warn = vi.spyOn(console, 'warn');
	wrapper = mount(ReferenceMeasure, { props: { points: [], paused: false, ax: '', ay: '', bx: '', by: '', length: '' } });
	const received: Record<string, unknown> = {};

	for (const [key, value] of Object.entries({ ax: '100', ay: '100', bx: '300', by: '100', length: '2' })) {
		await wrapper.get(`input[name="${key}"]`).setValue(value);
		// What a parent's `v-model:<key>` does: store the emitted value and hand it straight back.
		received[key] = wrapper.emitted(`update:${key}`)?.at(-1)?.[0];
		await wrapper.setProps({ [key]: received[key] });
	}

	expect(received).toEqual({ ax: 100, ay: 100, bx: 300, by: 100, length: '2' });
	expect(warn.mock.calls.map(call => String(call[0])).filter(text => text.includes('Invalid prop'))).toEqual([]);
});
