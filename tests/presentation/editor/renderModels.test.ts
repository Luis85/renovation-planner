/**
 * @vitest-environment jsdom
 *
 * The pure half of the render pipeline: `ZoneDto → ZoneRenderModel`, the appearance
 * lookups beside it, and the theme-token resolver the canvas gets its colours from.
 *
 * jsdom only for the resolver, which reads computed styles; everything else is pure.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { KONVA_LAYER_IDS, defaultLayerVisibility } from '../../../src/presentation/editor/scene/KonvaLayers';
import {
	labelAnchor,
	statusAppearance,
	toZoneRenderModel,
	zoneFillToken,
} from '../../../src/presentation/editor/layers/zone/ZoneRenderModel';
import { resolveThemeTokens, THEME_TOKENS } from '../../../src/presentation/editor/theme/themeTokens';
import { ZONE_STATUSES } from '../../../src/domain/zone/ZoneStatus';
import { ZONE_TYPES } from '../../../src/domain/zone/ZoneType';
import { FIXTURE_ZONES } from '../../helpers/planFixtures';

describe('turning a zone DTO into a render model', () => {
	it('carries the id, type, status and name across', () => {
		const model = toZoneRenderModel(FIXTURE_ZONES[0]);

		expect(model).toEqual({
			id: 'zone-kitchen',
			zoneType: 'Room',
			status: 'Planned',
			label: 'Kitchen',
			points: FIXTURE_ZONES[0].points,
		});
	});

	/**
	 * The SAME array, not a copy — DoD 5's reference-identity assertion is what proves the
	 * viewport transform lives on the layer rather than in a per-vertex conversion, and it
	 * can only hold if this mapping passes the reference through.
	 */
	it('passes the point array through by reference', () => {
		expect(toZoneRenderModel(FIXTURE_ZONES[0]).points).toBe(FIXTURE_ZONES[0].points);
	});
});

describe('how a zone looks', () => {
	it.each(ZONE_TYPES)('resolves a fill token for the %s type', (zoneType) => {
		expect(THEME_TOKENS[zoneFillToken(zoneType)]).toBeDefined();
	});

	it('gives distinct fills to distinct types, so the canvas is readable', () => {
		const tokens = new Set(ZONE_TYPES.map((type) => zoneFillToken(type)));

		expect(tokens.size).toBe(ZONE_TYPES.length);
	});

	/**
	 * A `ZoneDto` widens the domain union to `string`, which is what a flat read model is
	 * for — and it is also why both lookups need an answer for a value outside the
	 * vocabulary. A note hand-edited to an unknown type still has to DRAW rather than throw
	 * inside a render.
	 */
	it('falls back to a generic appearance for a type it does not know', () => {
		expect(zoneFillToken('Submarine')).toBe('zoneCustom');
	});

	it.each(ZONE_STATUSES)('gives the %s status its own caption key', (status) => {
		expect(statusAppearance(status).captionKey).toMatch(/^zone\.status\./);
	});

	/**
	 * §85: status must be distinguishable without colour. The dash pattern is one of the two
	 * non-colour channels, so no two statuses may share one — a duplicate would silently
	 * merge two states on a grayscale print.
	 */
	it('gives every status a distinct dash pattern', () => {
		const patterns = ZONE_STATUSES.map((status) => statusAppearance(status).dash.join(','));

		expect(new Set(patterns).size).toBe(ZONE_STATUSES.length);
	});

	it('answers for an unknown status too, with its own caption', () => {
		expect(statusAppearance('Demolished')).toEqual({ dash: [2, 2], captionKey: 'zone.status.unknown' });
	});
});

describe('where a zone caption sits', () => {
	it('anchors at the top-left of the bounding box, in world millimetres', () => {
		expect(labelAnchor([{ x: 300, y: -50 }, { x: 100, y: 200 }, { x: 250, y: 40 }])).toEqual({
			x: 100,
			y: -50,
		});
	});

	/**
	 * A `Polygon` is unvalidated by design (slice 2) — an editor legitimately holds a
	 * not-yet-valid point buffer — so a render model can arrive with none. `Math.min()` of
	 * nothing is `Infinity`, and a caption at infinity takes the whole layer's bounding box
	 * with it.
	 */
	it('answers the origin for an empty point list rather than infinity', () => {
		expect(labelAnchor([])).toEqual({ x: 0, y: 0 });
	});
});

describe('the layer vocabulary', () => {
	it('builds a visibility record covering exactly the declared layers', () => {
		expect(Object.keys(defaultLayerVisibility())).toEqual([...KONVA_LAYER_IDS]);
	});

	it('starts every layer visible', () => {
		expect(Object.values(defaultLayerVisibility()).every(Boolean)).toBe(true);
	});

	it('hands back a fresh record each time, so two editors cannot share one', () => {
		expect(defaultLayerVisibility()).not.toBe(defaultLayerVisibility());
	});
});

describe('resolving the theme', () => {
	afterEach(() => {
		for (const variable of Object.values(THEME_TOKENS)) {
			document.documentElement.style.removeProperty(variable);
		}
		document.documentElement.style.removeProperty('color');
	});

	/**
	 * Keyed by the VARIABLE, not by the token's position: two roles may legitimately name
	 * the same variable (`zoneStroke` and `zoneLabel` are both `--text-normal`), so a
	 * per-token sentinel would have them overwrite each other and the assertion would be
	 * about the loop rather than about the resolver.
	 */
	it('reads every token from the Obsidian variable it names', () => {
		const variables = [...new Set(Object.values(THEME_TOKENS))];
		// Typed as the ELEMENT of `variables` rather than `string`: `THEME_TOKENS` is a const
		// object, so its values are a union of literal variable names and `indexOf` takes that
		// union, not any string. Widening the parameter is what made the call fail.
		const sentinel = (variable: (typeof variables)[number]) => `rgb(${variables.indexOf(variable)}, 0, 0)`;
		for (const variable of variables) {
			document.documentElement.style.setProperty(variable, sentinel(variable));
		}

		const tokens = resolveThemeTokens(document.documentElement);

		for (const [name, variable] of Object.entries(THEME_TOKENS)) {
			expect(tokens[name as keyof typeof THEME_TOKENS]).toBe(sentinel(variable));
		}
	});

	/**
	 * A theme that defines none of these still has to draw something legible. The fallback
	 * is the element's own computed `color` and NOT a literal — a hard-coded hex here would
	 * be the global palette §84 refuses, smuggled in through a branch nobody looks at.
	 */
	it('falls back to the element own colour when a variable is undefined', () => {
		document.documentElement.style.setProperty('color', 'rgb(7, 7, 7)');

		const tokens = resolveThemeTokens(document.documentElement);

		expect(tokens.zoneRoom).toBe('rgb(7, 7, 7)');
		expect(tokens.canvasBackground).toBe('rgb(7, 7, 7)');
	});

	it('treats a variable defined as whitespace as undefined', () => {
		document.documentElement.style.setProperty('color', 'rgb(7, 7, 7)');
		document.documentElement.style.setProperty(THEME_TOKENS.zoneRoom, '   ');

		expect(resolveThemeTokens(document.documentElement).zoneRoom).toBe('rgb(7, 7, 7)');
	});
});
