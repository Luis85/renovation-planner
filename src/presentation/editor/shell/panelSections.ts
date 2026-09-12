import type { IconName } from 'obsidian';
import type { StringKey } from '../../i18n/locales/en';
import type { PanelSide } from './panelLayout';

/** One button on a collapsed strip: the `PanelSection` it opens, its icon and its name. */
export interface PanelSectionEntry {
	readonly key: string;
	readonly icon: IconName;
	readonly labelKey: StringKey;
}

/**
 * What each collapsed strip offers, in panel order. A key is `PanelSection`'s `section` prop, so a
 * strip button finds its section as `[data-rp-section="<key>"]`; the Inspector has no sections of
 * its own, so its one button expands the panel and nothing more.
 */
export const PANEL_SECTIONS: Readonly<Record<PanelSide, readonly PanelSectionEntry[]>> = {
	layers: [
		{ key: 'context', icon: 'house', labelKey: 'editor.shell.property' },
		{ key: 'layers', icon: 'layers', labelKey: 'editor.rail.layers' },
		{ key: 'rooms', icon: 'grid-2x2', labelKey: 'editor.selection.records' },
		{ key: 'elements', icon: 'brick-wall', labelKey: 'editor.structure.list' },
	],
	inspector: [{ key: 'details', icon: 'panels-top-left', labelKey: 'editor.rail.details' }],
};

/** Each panel's own names — its header title and its three controls. */
export const PANEL_COPY: Readonly<Record<PanelSide, { readonly title: StringKey; readonly collapse: StringKey; readonly expand: StringKey; readonly resize: StringKey }>> = {
	layers: {
		title: 'editor.property-panel',
		collapse: 'editor.panel.collapse-layers',
		expand: 'editor.panel.expand-layers',
		resize: 'editor.panel.resize-layers',
	},
	inspector: {
		title: 'editor.rail.details',
		collapse: 'editor.panel.collapse-inspector',
		expand: 'editor.panel.expand-inspector',
		resize: 'editor.panel.resize-inspector',
	},
};
