/**
 * The registry, and the two claims about it a compiler cannot make.
 *
 * The compiler already guarantees that every value here is a `StringKey`, so a key with no
 * `en.ts` entry fails the build rather than this suite. What it cannot check is that the two
 * Plan Editor entries resolve to DIFFERENT copy: a registry mapping both to one key would
 * type-check perfectly and tell a user with a background and no zones to import a plan.
 */
import { describe, expect, it } from 'vitest';
import { EMPTY_STATE_CONTENT } from '../../../src/presentation/emptyStates/content';
import { t } from '../../../src/presentation/i18n/strings';

const LANGUAGES = ['en', 'de'] as const;

describe('the empty-state content registry', () => {
	it('holds exactly the three entries the slice names', () => {
		expect(Object.keys(EMPTY_STATE_CONTENT.renovationProject)).toEqual(['noProjects']);
		expect(Object.keys(EMPTY_STATE_CONTENT.planEditor)).toEqual(['noBackground', 'noZones']);
	});

	/**
	 * Amendment 1 held while `noProjects` had no hand-off. Design slice 16 built one —
	 * `ViewRoot` opens `NewProjectForm` in slice 15's `FormDialog` — so this is now the
	 * opposite assertion, updated rather than deleted: adding a label was always meant to be
	 * a deliberate, tested change, and this is that change.
	 */
	it('gives the no-projects state an action, because slice 16 built what it hands off to', () => {
		const content = EMPTY_STATE_CONTENT.renovationProject.noProjects;

		expect(content.actionLabel).toBeDefined();
		// Non-empty resolved copy, not just a declared key: `''` would render a nameless
		// button, which is both a control that says nothing and an axe `button-name` failure.
		expect(t('en', content.actionLabel)).not.toBe('');
	});

	/**
	 * Amendment 1 covers `noBackground` too, unchanged from slice 14: its hand-off is slice
	 * 5's `set-plan-background` plugin command, which is not a member of
	 * `PlanEditorCommandServices` — the editor's Vue tree cannot reach it without either
	 * widening `PlanEditorContext` or reaching for the global `app`, both refused. `noZones`
	 * is the only entry left with a button, because its hand-off
	 * (`activeToolId = 'draw-polygon'`) already exists and is reachable from here.
	 */
	it('gives noBackground no action label, since its hand-off is unreachable from the editor tree', () => {
		expect(EMPTY_STATE_CONTENT.planEditor.noBackground.actionLabel).toBeUndefined();
	});

	it('gives noZones an action label, since its hand-off already exists', () => {
		expect(EMPTY_STATE_CONTENT.planEditor.noZones.actionLabel).toBeDefined();
	});

	it.each(LANGUAGES)('resolves the two plan-editor entries to distinct copy in %s', (language) => {
		const { noBackground, noZones } = EMPTY_STATE_CONTENT.planEditor;

		expect(t(language, noBackground.headline)).not.toBe(t(language, noZones.headline));
		expect(t(language, noBackground.body)).not.toBe(t(language, noZones.body));
	});

	it.each(LANGUAGES)('resolves every declared key to a non-empty string in %s', (language) => {
		const entries = [
			EMPTY_STATE_CONTENT.renovationProject.noProjects,
			EMPTY_STATE_CONTENT.planEditor.noBackground,
			EMPTY_STATE_CONTENT.planEditor.noZones,
		];

		for (const entry of entries) {
			expect(t(language, entry.headline).length).toBeGreaterThan(0);
			expect(t(language, entry.body).length).toBeGreaterThan(0);
		}

		// noZones is the one entry whose `actionLabel` is present in the literal type (not
		// optional), so this is unconditional rather than a re-check of the branch above.
		expect(t(language, EMPTY_STATE_CONTENT.planEditor.noZones.actionLabel).length).toBeGreaterThan(0);
	});
});
