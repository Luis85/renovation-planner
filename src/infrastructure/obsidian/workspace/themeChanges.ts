import type { Workspace } from 'obsidian';

/**
 * Obsidian's `css-change` event, as a plain subscribe-returns-unsubscribe function.
 *
 * The reason it is here and not in the component that wants it: a Konva canvas cannot read
 * a CSS variable, so the plugin resolves the palette itself and has to re-resolve it when
 * the theme changes — but the presentation layer's interest is exactly "tell me when", and
 * handing a component a `Workspace` to get that would hand it everything else too.
 *
 * `offref` and not `off`: Obsidian's `on` mints a reference and `offref` is what retires
 * that one registration. `off(name, callback)` compares callbacks, which silently fails to
 * detach a bound or wrapped one — and a `css-change` listener that outlives its view
 * re-resolves a palette onto a detached element for the rest of the session.
 */
export function createThemeChangeSource(workspace: Workspace): (listener: () => void) => () => void {
	return (listener: () => void) => {
		const reference = workspace.on('css-change', listener);
		return () => workspace.offref(reference);
	};
}
