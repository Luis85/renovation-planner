/**
 * @vitest-environment jsdom
 *
 * The space-pan's focus-loss door in an Obsidian POP-OUT leaf, where the canvas belongs to
 * another document with a window of its own: that window's blur is the one an alt-tab away
 * from it delivers, and a listener on the plugin's `window` never hears it — the same defect
 * `canvasNavigation.test.ts`'s "losing focus drops the held key" case holds for the element's
 * own blur, back through the door `EditorSurface.onMounted`'s comment names.
 *
 * Beside that file rather than in it because it measures exactly its 450-line cap, the same
 * seam `canvasGestureOwnership.test.ts` took. `EditorSurface` is mounted STANDALONE, in a REAL
 * second document (an iframe's, never a stub, per the fake rule), because the editor rig mounts
 * into the main one; in camera mode nothing but the held space arms the pan, so the cursor
 * class is the fact asserted — the only one jsdom can see, as the parent file's own header says.
 */
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { markRaw, nextTick, reactive, ref } from 'vue';
import EditorSurface from '../../../src/presentation/editor/surface/EditorSurface.vue';
import { RenderState } from '../../../src/presentation/editor/tools/render-state';
import { ToolManager } from '../../../src/presentation/editor/tools/tool-manager';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { installResizeObserver } from '../../helpers/layout';

function cursorClasses(canvas: HTMLElement): string[] {
	return [...canvas.classList].filter((name) => name.startsWith('rp-plan-canvas-'));
}

describe('holding space to pan, in a pop-out leaf', () => {
	it('the pop-out window losing focus disarms the held key, on the window that owns the canvas', async () => {
		const frame = document.createElement('iframe');
		document.body.append(frame);
		const doc = frame.contentDocument as Document, win = frame.contentWindow as Window;
		const host = doc.createElement('div');
		doc.body.append(host);
		// Named here rather than inherited from a sibling's rig: a case whose pass depends on
		// which sibling ran first is not a case anybody has checked.
		installResizeObserver();
		const pinia = createPinia();
		const wrapper = mount(EditorSurface, {
			attachTo: host,
			global: { plugins: [pinia] },
			props: {
				// `markRaw` because test-utils makes `props` DEEPLY reactive where Vue's own are
				// shallow, and a proxy cannot read the manager's `#private` fields. The factory
				// is never asked: no tool activates in camera mode.
				toolManager: markRaw(new ToolManager(() => { throw new Error('no tool activates in camera mode'); })),
				activeToolId: ref(null),
				renderState: reactive(new RenderState()),
				editor: useEditorStore(pinia),
				framedBounds: () => null,
				canvasLabel: 'editor.canvas',
				setTool: () => undefined,
				hasSelection: () => false,
				clearSelection: () => undefined,
				nudgeSelection: () => Promise.resolve(),
				finishArea: () => undefined,
			},
		});
		const canvas = wrapper.element as HTMLElement;
		expect(canvas.ownerDocument).toBe(doc);
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
		await nextTick();
		expect(cursorClasses(canvas)).toEqual(['rp-plan-canvas-armed']);
		win.dispatchEvent(new Event('blur'));
		await nextTick();
		expect(cursorClasses(canvas)).toEqual([]);
		// And it comes off THAT window on unmount — the removal is registered from inside
		// `onMounted`, so this is what proves the hook landed on the instance at all.
		const removed = vi.spyOn(win, 'removeEventListener');
		wrapper.unmount();
		expect(removed).toHaveBeenCalledWith('blur', expect.any(Function), undefined);
		frame.remove();
	});
});
