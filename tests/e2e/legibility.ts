import { expect } from 'vitest';
import type { DrawnColours } from './designerParity';
import type { NativeBrowser } from './session';

/**
 * What the two legibility guard files (`assetDesignerLegibility.e2e.ts`,
 * `assetLibraryLegibility.e2e.ts`) share: Obsidian's two built-in themes applied in turn, and the
 * paint a set of elements puts on screen as `contrastOf` in `designerParity.ts` reads it.
 */

/** WCAG 2.x SC 1.4.3, the text floor, and SC 1.4.11, the non-text floor for a graphic someone must see. */
export const TEXT_CONTRAST = 4.5;
export const NON_TEXT_CONTRAST = 3;

/** Obsidian's own theme switch, as the settings pane calls it. */
const changeTheme = (browser: NativeBrowser, theme: string): Promise<void> =>
	browser.executeObsidian(({ app }, name) => {
		(app as unknown as { changeTheme(theme: string): void }).changeTheme(name);
	}, theme);

/**
 * `read` once in Obsidian's light theme (`moonstone`) and once in its dark one (`obsidian`), each
 * applied through the host's own `changeTheme` and waited for on `body.theme-dark` before reading.
 * The theme the vault had before — its `theme` config, or the scheme the body showed when that is
 * unset — is put back afterwards, on failure too, and on success the body is waited for to show it.
 */
export async function inBothThemes<T>(browser: NativeBrowser, read: () => Promise<T>): Promise<{ light: T; dark: T }> {
	const dark = () => browser.execute(() => document.body.classList.contains('theme-dark'));
	const wasDark = await dark();
	const config = await browser.executeObsidian(({ app }) => (app.vault as unknown as { getConfig(key: string): unknown }).getConfig('theme'));
	const readIn = async (theme: string): Promise<T> => {
		await changeTheme(browser, theme);
		await expect.poll(dark).toBe(theme === 'obsidian');
		return read();
	};
	let measured: { light: T; dark: T };
	try {
		measured = { light: await readIn('moonstone'), dark: await readIn('obsidian') };
	} finally {
		await changeTheme(browser, typeof config === 'string' ? config : wasDark ? 'obsidian' : 'moonstone');
	}
	await expect.poll(dark, { message: 'the theme put back' }).toBe(wasDark);
	return measured;
}

/** One painted element: `contrastOf`'s input, plus what a caller needs beside it. */
export interface Paint extends DrawnColours {
	/** A name for the evidence file and a failure message. */
	name: string;
	/** The element's computed `fill` — `none` or a colour — since a stroke straddles its own edge. */
	fill: string;
	/** Computed font size and stroke width, px. */
	fontSize: number;
	strokeWidth: number;
	vectorEffect: string;
	/** The uniform scale from the element's user units to screen px (`getScreenCTM`); 1 for HTML. */
	userScale: number;
}

/**
 * Every element under `selector`, as the page computes its paint: `property` (`color` for text,
 * `stroke` for a line), the opacity every level applies to it (and `stroke-opacity` for a stroke),
 * and every background from the element itself outwards, innermost first — so a label's own box
 * is the first entry. `name` is read from the attribute `nameAttribute`, or the element's position.
 */
export const paints = (browser: NativeBrowser, selector: string, property: 'color' | 'stroke', nameAttribute: string): Promise<Paint[]> =>
	browser.execute(
		(sel, prop, attribute) =>
			[...document.querySelectorAll(sel)].map((element, index) => {
				const chain: Element[] = [];
				for (let el: Element | null = element; el; el = el.parentElement) chain.push(el);
				const style = getComputedStyle(element);
				const ctm = element instanceof SVGGraphicsElement ? element.getScreenCTM() : null;
				return {
					name: element.closest(`[${attribute}]`)?.getAttribute(attribute) ?? String(index),
					stroke: prop === 'color' ? style.color : style.stroke,
					opacity: chain.reduce((product, el) => product * Number(getComputedStyle(el).opacity), prop === 'stroke' ? Number(style.strokeOpacity) : 1),
					backgrounds: chain.map((el) => getComputedStyle(el).backgroundColor),
					fill: style.fill,
					fontSize: Number.parseFloat(style.fontSize),
					strokeWidth: Number.parseFloat(style.strokeWidth),
					vectorEffect: style.getPropertyValue('vector-effect'),
					userScale: ctm ? Math.sqrt(Math.abs(ctm.a * ctm.d - ctm.b * ctm.c)) : 1,
				};
			}),
		selector,
		property,
		nameAttribute,
	);
