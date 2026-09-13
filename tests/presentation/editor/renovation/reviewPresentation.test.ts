// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { defineComponent, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { provideReviewPresentation } from '../../../../src/presentation/editor/renovation/useReviewPresentation';
import type { PlanEditorContext } from '../../../../src/presentation/editor/PlanEditorContext';
import type { EditorRuntime } from '../../../../src/presentation/editor/runtime';

it('draws no Room rows and reports all clear before any floor has loaded', () => {
	const context = { commands: {} } as unknown as PlanEditorContext;
	const runtime = { planning: { findings: ref([]), loading: ref(false), failed: ref(false), baseline: ref(null) }, writesBlocked: ref(false) } as unknown as EditorRuntime;
	let presentation!: ReturnType<typeof provideReviewPresentation>;
	const wrapper = mount(defineComponent({ setup() { presentation = provideReviewPresentation(context, runtime); return () => null; } }), { global: { plugins: [createPinia()] } });
	expect(presentation.floor.value).toBeNull();
	expect(presentation.rows.value).toEqual([]);
	expect(presentation.clear.value).toBe(true);
	wrapper.unmount();
});
