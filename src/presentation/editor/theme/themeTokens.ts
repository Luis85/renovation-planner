/**
 * Obsidian CSS variables, resolved into the plain colour strings Konva needs (SDD §84).
 *
 * A canvas is the one surface in this plugin that cannot read a CSS variable: `fill:
 * var(--text-normal)` means nothing to a 2D context, which wants a resolved colour
 * string. So this module is the bridge — it reads the CURRENT computed value of each
 * variable off the view's own root element, and the components consume the resolved
 * object. Nothing in the render path holds a literal colour, which is what keeps a themed
 * vault themed.
 *
 * Re-resolved on Obsidian's `css-change` event rather than cached for the life of the
 * view: switching theme or toggling dark mode changes every one of these, and a canvas
 * that kept the old values would be the one part of the pane that did not follow.
 */
export const THEME_TOKENS = {
	canvasBackground: '--background-primary',
	zoneStroke: '--text-normal',
	zoneLabel: '--text-normal',
	zoneCaption: '--text-muted',
	accent: '--interactive-accent',
	zoneRoom: '--color-blue',
	zoneGarden: '--color-green',
	zoneTerrace: '--color-yellow',
	zoneDriveway: '--color-orange',
	zoneRoof: '--color-purple',
	zoneConstructionArea: '--color-red',
	zoneCustom: '--color-cyan',
} as const;

export type ThemeTokenName = keyof typeof THEME_TOKENS;
export type ThemeTokens = Readonly<Record<ThemeTokenName, string>>;

/**
 * What a token resolves to when the theme does not define its variable.
 *
 * Deliberately NOT a literal colour: a hard-coded hex here would be the global palette
 * §84 refuses, smuggled in through the back door of a fallback nobody looks at. The
 * element's own computed `color` is a real, theme-derived colour that always resolves,
 * so a theme missing `--color-cyan` draws a legible shape in the theme's own ink rather
 * than an invented blue or a Konva default black.
 *
 * The honest cost, stated rather than hidden: under such a theme the zone-type fills stop
 * being distinguishable FROM EACH OTHER by colour. That is survivable precisely because
 * §85 already forbids colour as the only channel — the type and status captions
 * `ZoneShape` draws are what still tell them apart.
 */
function fallbackColor(styles: CSSStyleDeclaration): string {
	return styles.color;
}

export function resolveThemeTokens(el: Element): ThemeTokens {
	const styles = getComputedStyle(el);
	const fallback = fallbackColor(styles);
	const entries = Object.entries(THEME_TOKENS).map(([name, variable]) => {
		const value = styles.getPropertyValue(variable).trim();
		return [name, value === '' ? fallback : value];
	});
	return Object.fromEntries(entries) as ThemeTokens;
}
