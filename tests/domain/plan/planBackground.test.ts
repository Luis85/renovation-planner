/**
 * A Plan's background reference: what it can BE, and the one rule shared by the two doors
 * into it.
 */
import { describe, expect, it } from 'vitest';
import {
	BACKGROUND_EXTENSIONS,
	backgroundKindFor,
	type PlanBackgroundRef,
} from '../../../src/domain/plan/PlanBackgroundRef';
import { Plan } from '../../../src/domain/plan/Plan';
import { expectErr, expectOk } from '../../helpers/domain';
import { makePlan } from '../../helpers/entities';
import { createProjectId } from '../../../src/domain/project/ProjectId';

const plan = () => makePlan({ projectId: createProjectId() });

/**
 * The refusal cases need the RAW Result, which `makePlan` unwraps — so construction goes
 * through `Plan.create` directly here.
 */
function makePlanResult(background: PlanBackgroundRef) {
	return Plan.create({
		id: 'plan-1' as never,
		projectId: createProjectId(),
		name: 'Ground floor',
		background,
	});
}

describe('what a path can be a background of', () => {
	it.each([
		['Plans/ground.png', 'image'],
		['Plans/ground.jpg', 'image'],
		['Plans/ground.jpeg', 'image'],
		['Plans/ground.pdf', 'pdf'],
	])('reads %s as a %s', (path, kind) => {
		expect(backgroundKindFor(path)).toBe(kind);
	});

	it('is case-insensitive about the extension, because file systems are not consistent', () => {
		expect(backgroundKindFor('Plans/GROUND.PNG')).toBe('image');
	});

	it.each([
		['a format this plugin cannot render', 'Plans/ground.dwg'],
		['a note', 'Notes/readme.md'],
		['a file with no extension at all', 'Plans/ground'],
	])('refuses %s', (_name, path) => {
		expect(backgroundKindFor(path)).toBeNull();
	});

	/**
	 * A leading dot is a FILENAME, not an extension: `.png` is a file called `.png`, and
	 * treating it as a PNG would offer the user a dotfile in the picker.
	 */
	it('refuses a dotfile whose whole name looks like an extension', () => {
		expect(backgroundKindFor('.png')).toBeNull();
		// Inside a FOLDER too: comparing against the whole path's first character catches
		// this only at the vault root, and 'Plans/.pdf' was offered in the picker as a PDF.
		expect(backgroundKindFor('Plans/.pdf')).toBeNull();
	});

	it('publishes the extension list the picker and the command share', () => {
		expect([...BACKGROUND_EXTENSIONS].toSorted()).toEqual(['jpeg', 'jpg', 'pdf', 'png']);
	});
});

describe('setting a background on a plan', () => {
	it('returns a NEW plan carrying the reference, leaving the original alone', () => {
		const original = plan();
		const reference: PlanBackgroundRef = { path: 'Plans/ground.png', kind: 'image' };

		const updated = expectOk(original.withBackground(reference));

		expect(updated.background).toEqual(reference);
		expect(original.background).toBeNull();
		expect(updated).not.toBe(original);
	});

	it('accepts null, which is what undoing a first import restores', () => {
		const withOne = expectOk(plan().withBackground({ path: 'Plans/ground.png', kind: 'image' }));

		expect(expectOk(withOne.withBackground(null)).background).toBeNull();
	});

	it('keeps every other field', () => {
		const original = makePlan({ projectId: createProjectId(), name: 'First floor', layers: ['walls'] });

		const updated = expectOk(original.withBackground({ path: 'a.png', kind: 'image' }));

		expect({ id: updated.id, name: updated.name, layers: updated.layers }).toEqual({
			id: original.id,
			name: 'First floor',
			layers: ['walls'],
		});
	});
});

/**
 * `create` and `withBackground` go through ONE validator, so a Plan cannot be constructed
 * with a reference that setting the same reference later would refuse. Each rule is driven
 * through BOTH doors for exactly that reason — a validator wired into one of them is the
 * defect this shape exists to prevent.
 */
describe('the rules, identical through both doors', () => {
	const REFUSED: readonly [string, PlanBackgroundRef, string][] = [
		['an empty path', { path: '   ', kind: 'image' }, 'plan.empty-background-path'],
		['an unknown kind', { path: 'a.png', kind: 'dwg' as never }, 'plan.unknown-background-kind'],
		['a page of zero', { path: 'a.pdf', kind: 'pdf', page: 0 }, 'plan.invalid-background-page'],
		['a negative page', { path: 'a.pdf', kind: 'pdf', page: -3 }, 'plan.invalid-background-page'],
		['a fractional page', { path: 'a.pdf', kind: 'pdf', page: 1.5 }, 'plan.invalid-background-page'],
	];

	it.each(REFUSED)('refuses %s at construction', (_name, background, code) => {
		expect(expectErr(makePlanResult(background))).toMatchObject({ category: 'Validation', code });
	});

	it.each(REFUSED)('refuses %s when set later', (_name, background, code) => {
		expect(expectErr(plan().withBackground(background))).toMatchObject({ category: 'Validation', code });
	});

	/**
	 * Deliberately TOLERATED: a hand-edited note carrying a stray `background-page` on an
	 * image is a file the user still has to be able to open, and the mapper drops the key on
	 * the next write. Refusing it here would turn a harmless extra key into an unloadable
	 * plan — the strict-out, tolerant-in rule.
	 */
	it('tolerates a page on an image rather than making the note unopenable', () => {
		const result = plan().withBackground({ path: 'a.png', kind: 'image', page: 2 });

		expect(expectOk(result).background).toEqual({ path: 'a.png', kind: 'image', page: 2 });
	});
});
