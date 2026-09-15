import { expect, it } from 'vitest';
import { itemColorInk, itemColorRgb, itemColorTint } from '../../../src/presentation/editor/elements/itemColorAppearance';
import { assetShapeConfig } from '../../../src/presentation/editor/elements/assetShapeConfig';
import { THEME_TOKENS, type ThemeTokens } from '../../../src/presentation/editor/theme/themeTokens';

it('resolves a preset to its content sample and a hex to itself', () => {
	expect(itemColorRgb('blue')).toBe('#518cce');
	expect(itemColorRgb('#3a7bd5')).toBe('#3a7bd5');
});

it('tints presets and hex against light, dark and custom backgrounds, keeping Default and unparseable hosts', () => {
	expect(itemColorTint('blue', '#ffffff')).toBe('rgb(206, 223, 241)');
	expect(itemColorTint('blue', '#1e1e1e')).toBe('rgb(44, 61, 79)');
	expect(itemColorTint('blue', 'rgb(240, 230, 210)')).toBe('rgb(195, 205, 209)');
	expect(itemColorTint('#ff0000', '#ffffff')).toBe('rgb(255, 184, 184)');
	expect(itemColorTint('#ff0000', '#000000')).toBe('rgb(71, 0, 0)');
	expect(itemColorTint(undefined, '#abcdef')).toBe('#abcdef');
	expect(itemColorTint('blue', 'unparseable')).toBe('unparseable');
});

it('inks at full strength and falls back to the token while absent', () => {
	expect(itemColorInk('rose', 'token-zoneStroke')).toBe('#ce6682');
	expect(itemColorInk('#3a7bd5', 'token-zoneStroke')).toBe('#3a7bd5');
	expect(itemColorInk(undefined, 'token-zoneStroke')).toBe('token-zoneStroke');
});

it('colors a missing-asset placeholder while retaining its selected outline, dashed shape and label', () => {
	const tokens = Object.fromEntries(Object.keys(THEME_TOKENS).map(key => [key, key === 'canvasBackground' ? '#ffffff' : '#222222'])) as ThemeTokens;
	const element = { id: 'element-asset', kind: 'asset' as const, points: [{ x: 1000, y: 1000 }, { x: 1100, y: 1000 }], assetId: 'missing', name: 'Armchair', color: 'blue' as const };
	const result = assetShapeConfig(element, () => null, { selected: true, hovered: false, tokens, zoom: 1 });
	expect(result.footprint.fill).toBe('rgb(206, 223, 241)'); expect(result.footprint.stroke).toBe(tokens.accent);
	expect(result.footprint.dash).toEqual([6, 4]); expect(result.label.text).toBe('Armchair'); expect(result.cross).not.toBeNull();
});
