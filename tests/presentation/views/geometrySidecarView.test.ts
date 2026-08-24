// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { installObsidianDom } from '../../helpers/dom';
import { GEOMETRY_SIDECAR_VIEW, GeometrySidecarView } from '../../../src/presentation/views/GeometrySidecarView';
import { FakeLeaf } from '../../helpers/workspace';
import { serializeFrontmatter } from '../../helpers/vault';
import { t } from '../../../src/presentation/i18n/strings';

installObsidianDom();

function makeViewWithVault(entries: Record<string, string>): { view: GeometrySidecarView; leaf: FakeLeaf } {
	const leaf = new FakeLeaf();
	const vault = {
		getAbstractFileByPath: (path: string) => {
			if (entries[path] === undefined) return null;
			const file = new TFile();
			file.path = path;
			return file;
		},
		cachedRead: (file: { path: string }) => Promise.resolve(entries[file.path] ?? ''),
	};
	const view = new GeometrySidecarView(leaf as never);
	(view as unknown as { app: unknown }).app = { vault };
	return { view, leaf };
}

describe('the geometry sidecar viewer', () => {
	it('names itself from the constants and the string table', () => {
		const { view } = makeViewWithVault({});
		expect(view.getViewType()).toBe(GEOMETRY_SIDECAR_VIEW);
		expect(view.getDisplayText()).toBe(t('en', 'view.geometry.name'));
	});

	it('shows the file text for the leaf state path', async () => {
		const entries: Record<string, string> = {
			'Renovation/Geometry/plan-x.rpgeo': serializeFrontmatter({ id: 'plan-x' }),
		};
		const { view } = makeViewWithVault(entries);

		await view.setState({ file: 'Renovation/Geometry/plan-x.rpgeo' }, {} as never);
		await view.onOpen();

		const pre = view.contentEl.querySelector('pre');
		expect(pre?.textContent).toContain('plan-x');
	});

	it('renders nothing for a leaf without a file', async () => {
		const { view } = makeViewWithVault({});
		await view.setState({}, {} as never);
		await view.onOpen();
		expect(view.contentEl.querySelector('pre')).toBeNull();
	});

	it('renders nothing when the state names a file the vault does not have', async () => {
		const { view } = makeViewWithVault({});
		await view.setState({ file: 'Renovation/Geometry/ghost.rpgeo' }, {} as never);
		await view.onOpen();
		expect(view.contentEl.querySelector('pre')).toBeNull();
	});
});
