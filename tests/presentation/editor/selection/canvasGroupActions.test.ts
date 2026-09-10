// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { useCanvasGroupActions } from '../../../../src/presentation/editor/selection/canvasGroupActions';

/**
 * The injection's default (`{ actions: () => [] }`) is what a consumer reads with no
 * `provideCanvasGroupActions` above it. Every mounted editor provides one (`groupActions.ts`), so
 * no editor test reaches the default; a bare consumer does.
 */
describe('canvasGroupActions', () => {
	it('falls back to no actions with nothing provided above it', () => {
		const Leaf = defineComponent({ setup() { return () => h('div', useCanvasGroupActions().actions([]).length); } });

		const wrapper = mount(Leaf);

		expect(wrapper.text()).toBe('0');
	});
});
