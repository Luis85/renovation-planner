import { expect, it } from 'vitest';
import { applyMaterial, materialChoices } from '../../../../src/presentation/editor/renovation/materialChoices';
import { introducedUnknownMaterials } from '../../../../src/application/commands/renovation/renovationLinkCheck';
import { EMPTY_RENOVATION } from '../../../../src/domain/renovation/Renovation';

const catalogue = [{ id: 'brick', name: 'Clinker brick', category: 'material', unit: 'm2' as const }, { id: 'window', name: 'Timber window', category: 'building-element', unit: 'piece' as const }, { id: 'tap', name: 'Tap', category: 'fixture', unit: 'piece' as const }];

it('lists materials and building elements for walls, and building elements and fixtures for openings', () => {
	expect(materialChoices(catalogue, 'wall').map(item => item.id)).toEqual(['brick', 'window']);
	expect(materialChoices(catalogue, 'window').map(item => item.id)).toEqual(['window', 'tap']);
	expect(materialChoices(catalogue, 'floor')).toEqual([]);
});

it('fills an empty description with the material name, keeps a written one, and clears on none', () => {
	const facts: { description: string; assetId?: string } = { description: '' };
	applyMaterial(facts, 'brick', catalogue); expect(facts).toEqual({ description: 'Clinker brick', assetId: 'brick' });
	facts.description = 'Old brick'; applyMaterial(facts, 'window', catalogue); expect(facts.description).toBe('Old brick');
	applyMaterial(facts, '', catalogue); expect(facts).toEqual({ description: 'Old brick' });
});

it('refuses only a material the proposal introduces, never one a note already names', () => {
	const subject = { id: 's', targetId: 'wall-a', kind: 'wall' as const, existing: { description: 'x', condition: 'good' as const, assetId: 'gone' }, planned: null };
	const proposed = { ...EMPTY_RENOVATION, subjects: [{ ...subject, planned: { change: 'modify' as const, description: 'y', assetId: 'also-gone' } }] };
	expect(introducedUnknownMaterials(proposed, { ...EMPTY_RENOVATION, subjects: [subject] }, new Set(['brick']))).toEqual(['also-gone']);
});

it('keeps an empty description empty for a material the catalogue does not name', () => {
	const facts: { description: string; assetId?: string } = { description: '' };
	applyMaterial(facts, 'gone', catalogue);
	expect(facts).toEqual({ description: '', assetId: 'gone' });
});
