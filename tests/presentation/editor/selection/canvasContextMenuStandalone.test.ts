// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { settle } from '../../../helpers/editor';
import CanvasContextMenu from '../../../../src/presentation/editor/selection/CanvasContextMenu.vue';
import { EDITOR_RUNTIME } from '../../../../src/presentation/editor/runtime';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });

it('finds no plan-editor or canvas ancestor, and attaches no interaction, when mounted outside that shell', async () => {
	// Every real caller nests `CanvasContextMenu` inside `PlanEditorRoot`'s
	// `.renovation-plan-editor` > … > `.rp-plan-canvas` structure, so `onMounted`'s two
	// `anchor.value?.closest(...) ?? null` lookups always find an ancestor there. Mounting the
	// component on its own — same live pinia and EditorRuntime as a real editor, but into a
	// bare host with neither class in its ancestry — is what actually drives that `?? null`
	// fallback for both lookups; the real one still gets these live cases from the tests above.
	const rig = await renovationEditor(); mounted.push(rig); rig.changePlan(); await settle();
	const host = document.createElement('div'); document.body.append(host);
	try {
		const standalone = mount(CanvasContextMenu, {
			attachTo: host,
			global: { plugins: [rig.pinia], provide: { [EDITOR_RUNTIME as unknown as symbol]: rig.runtime } },
		});
		try {
			expect(standalone.find('.rp-context-menu-anchor').exists()).toBe(true);

			standalone.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
			await settle();

			expect(standalone.find('.rp-canvas-context-menu').exists()).toBe(false);
		} finally { standalone.unmount(); }
	} finally { host.remove(); }
});
