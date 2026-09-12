/**
 * `WorkspaceStore`'s side-panel layout (2026-09-12 side panels spec §1). Node: a store is plain
 * reactive state.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { defaultPanelLayout } from '../../../src/presentation/editor/shell/panelLayout';

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('WorkspaceStore, the side panel layout', () => {
	it('opens at the default layout', () => {
		expect(useWorkspaceStore().panelLayout).toEqual(defaultPanelLayout());
	});

	it('patches one side, clamping its width, and replaces the record', () => {
		const workspace = useWorkspaceStore();
		const before = workspace.panelLayout;
		workspace.setPanel('layers', { width: 9999 });
		workspace.setPanel('inspector', { collapsed: true });
		expect(workspace.panelLayout).toEqual({
			layers: { width: 400, collapsed: false },
			inspector: { width: 352, collapsed: true },
		});
		expect(workspace.panelLayout).not.toBe(before);
	});

	it('restores a whole layout and resets to the defaults', () => {
		const workspace = useWorkspaceStore();
		workspace.restorePanelLayout({ layers: { width: 300, collapsed: true }, inspector: { width: 500, collapsed: false } });
		expect(workspace.panelLayout.layers).toEqual({ width: 300, collapsed: true });
		workspace.reset();
		expect(workspace.panelLayout).toEqual(defaultPanelLayout());
	});
});
