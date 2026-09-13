// @vitest-environment jsdom
/**
 * `EditorViewMenu` in an Obsidian POP-OUT leaf, where the menu's element belongs to another
 * document than the plugin's `document`: an outside press there has to close it, which a
 * listener on the main document never hears. The second document is a REAL one — an iframe's —
 * never a stub, per the fake rule.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import EditorViewMenu from '../../../../src/presentation/editor/shell/EditorViewMenu.vue';
import { EDITOR_RUNTIME, type EditorRuntime } from '../../../../src/presentation/editor/runtime';

describe('EditorViewMenu in a pop-out leaf', () => {
	it('closes on an outside press in the document that owns it, as a pop-out leaf has', async () => {
		const frame = document.createElement('iframe');
		document.body.append(frame);
		const doc = frame.contentDocument as Document;
		const host = doc.createElement('div');
		doc.body.append(host);
		// `gestureInFlight` is the one runtime member the menu reads, and only once a button is pressed.
		const runtime = { toolManager: { gestureInFlight: false } } as unknown as EditorRuntime;
		const wrapper = mount(EditorViewMenu, { attachTo: host, global: { plugins: [createPinia()], provide: { [EDITOR_RUNTIME as symbol]: runtime } } });
		const details = wrapper.find('details').element as HTMLDetailsElement;
		expect(details.ownerDocument).toBe(doc);
		await wrapper.find('summary').trigger('click');
		expect(details.open).toBe(true);
		doc.dispatchEvent(new Event('pointerdown'));
		expect(details.open).toBe(false);
		wrapper.unmount();
		frame.remove();
	});
});
