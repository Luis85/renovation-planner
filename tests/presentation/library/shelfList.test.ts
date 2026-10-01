/**
 * §3.2's shelf derivation as a function, now that the shelves and AD18-R18's category sidebar
 * both read it. The undeclared half is driven with hand-built DTOs: §3.2 records that no real
 * listing can reach it today, so this asserts the derivation's shape and claims nothing about a
 * vault.
 */
import { describe, expect, it } from 'vitest';
import { shelvesOf } from '../../../src/presentation/library/shelfList';
import { tr } from '../../../src/presentation/i18n/strings';
import { anEntry } from '../../helpers/entities';

describe('the derived shelf list', () => {
	it('puts the declared categories first, then the undeclared ones by name, kept as written', () => {
		const shelves = shelvesOf([
			anEntry({ category: 'stone', name: 'Slate' }),
			anEntry({ category: 'Bespoke', name: 'One-off' }),
			anEntry({ category: 'furniture', name: 'Sofa' }),
		]);

		expect(shelves.map((shelf) => shelf.category)).toEqual([
			'material', 'furniture', 'fixture', 'plant', 'equipment', 'building-element', 'custom', 'Bespoke', 'stone',
		]);
		expect(shelves[1]?.label).toBe(tr('form.new-asset.category.furniture'));
		expect(shelves.at(-1)?.label).toBe('stone');
		expect(shelves.at(-1)?.entries.map((entry) => entry.name)).toEqual(['Slate']);
	});
});
