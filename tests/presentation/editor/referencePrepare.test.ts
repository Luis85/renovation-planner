// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ReferencePrepare from '../../../src/presentation/editor/reference/ReferencePrepare.vue';

afterEach(() => { vi.restoreAllMocks(); });

// L-48, the L-45 precedent (`referenceMeasure.test.ts`): `page` and `rotation` are
// `<input type="number">`, and a CLEARED one hands back `''` through Vue's `vModelText` — so
// the model's declared type has to admit it, or the parent's echo is a prop Vue refuses.
it('takes a cleared page or rotation back from its parent without a prop type warning', async () => {
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	const wrapper = mount(ReferencePrepare, { props: {
		sources: [], pdf: true, paused: false, loading: false, hasRaster: true,
		path: 'plan.pdf', page: 2, rotation: 15, crop: { x: 0, y: 0, width: 800, height: 600 },
	} });
	const received: Record<string, unknown> = {};

	for (const key of ['page', 'rotation']) {
		await wrapper.get(`input[name="${key}"]`).setValue('');
		// What a parent's `v-model:<key>` does: store the emitted value and hand it straight back.
		received[key] = wrapper.emitted(`update:${key}`)?.at(-1)?.[0];
		await wrapper.setProps({ [key]: received[key] });
	}

	expect(received).toEqual({ page: '', rotation: '' });
	expect(warn.mock.calls.map(call => String(call[0])).filter(text => text.includes('Invalid prop'))).toEqual([]);
	wrapper.unmount();
});
