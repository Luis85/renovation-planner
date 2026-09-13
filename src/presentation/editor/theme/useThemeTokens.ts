import { onBeforeUnmount, ref, type Ref } from 'vue';
import { resolveThemeTokens, type ThemeTokens } from './themeTokens';

/**
 * The resolved Obsidian palette, kept current as the user changes theme.
 *
 * Resolved against the editor's OWN root element when it has one, because a theme — or another
 * plugin — may scope variables to a subtree, and the values that matter are the ones in force
 * where the canvas actually sits.
 *
 * **The fallback is `document.body`, never `document.documentElement`.** Obsidian declares its
 * whole palette on `body` and puts `.theme-light`/`.theme-dark` there too, so on `<html>` every
 * token misses and `resolveThemeTokens` falls back to `<html>`'s own `color` — white under a
 * dark OS scheme, which drew the asset designer's outlines white on a light theme's white
 * ground. The designer passes no root at all, so this fallback is the only thing it ever reads.
 *
 * The initial resolve happens at setup against that fallback, since the root element does not
 * exist yet; `refresh()` is called once the component is mounted. Both go through the same
 * function, so there is no "startup palette" that could differ from the live one.
 *
 * **The subscription is a PARAMETER, not a context read.** It used to call
 * `usePlanEditorContext()` itself, which bound the one theme composable in the plugin to one of
 * the three surfaces — so the asset designer, which cannot see that context, resolved its
 * palette once at setup and kept a light-theme stroke on a dark ground until its leaf was
 * reopened. Each caller passes its own context's `onThemeChange`; both spell the same
 * `css-change` the composition root binds.
 */
export function useThemeTokens(
	root: Ref<HTMLElement | null>,
	onThemeChange: (listener: () => void) => () => void,
): {
	tokens: Ref<ThemeTokens>;
	refresh: () => void;
} {
	const tokens = ref<ThemeTokens>(resolveThemeTokens(document.body));

	function refresh(): void {
		tokens.value = resolveThemeTokens(root.value ?? document.body);
	}

	// Registered at setup and disposed with the component: a listener outliving its view
	// would keep re-resolving against a detached element for the rest of the session, and
	// the next open would add a second one.
	const unsubscribe = onThemeChange(refresh);
	onBeforeUnmount(unsubscribe);

	return { tokens, refresh };
}
