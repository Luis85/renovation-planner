import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { REPO } from '../helpers/repo';
import { callsOf, descendants, functionNamed, importsOf, parseScript, stringsOf } from '../helpers/parsedSource';
import { planningEn } from '../../src/presentation/i18n/locales/en/planning';
import { planningDe } from '../../src/presentation/i18n/locales/de/planning';

/**
 * L-44: the BP-08 planning driver (`scripts/editor-planning-check.mjs`, which
 * `editor-recovery-check.mjs` runs as its first journey) reached a cost row's Documents button as
 * `.rp-planning-actions button:last-child`. `58c4fb4d1` appended "Delete record" to that row, so
 * the step opened a delete confirm and timed out. The driver runs only in the browser harness
 * over the in-memory repository stack, so no vault was at risk — but a position in a row that
 * grows at its end names whatever was added last.
 *
 * The driver needs a browser and is outside `npm run check`, so this reads it: parsed, never
 * matched as text, so a comment spelling the old selector is not a hit.
 */
const script = parseScript(join(REPO, 'scripts', 'editor-planning-check.mjs'));
const KEY = 'renovation.documents';

describe('the planning driver reaches Documents by its label', () => {
	it('takes the label from both locale modules', () => {
		expect(importsOf(script)).toEqual(expect.arrayContaining([
			'../src/presentation/i18n/locales/en/planning.ts',
			'../src/presentation/i18n/locales/de/planning.ts',
		]));
		const evidence = functionNamed(script, 'evidence');
		if (!evidence) throw new Error('evidence() is gone; this pin reaches nothing');
		const byName = callsOf(evidence, script, 'getByRole').filter(call => call.args[1]?.includes(`'${KEY}'`));
		expect(byName.length).toBeGreaterThan(0);
	});

	/**
	 * Review M-5: a renamed key would hand the driver `undefined` as the button name, which
	 * Playwright reads as "any name", and the case above would stay green over it.
	 */
	it('names a key both locale modules carry, with a label', () => {
		const label = expect.stringMatching(/\S/);
		expect({ en: planningEn[KEY], de: planningDe[KEY] }).toEqual({ en: label, de: label });
	});

	it('names no action-row button by its last position', () => {
		const selectors = stringsOf(script.file).filter(text => text.includes('.rp-planning-actions'));
		// Found-something-at-all: the driver still reaches other action rows by selector.
		expect(selectors.length).toBeGreaterThan(0);
		expect(selectors.filter(text => text.includes(':last-child'))).toEqual([]);
		// And a template or concatenation cannot rebuild it out of view of `stringsOf`.
		expect(descendants(script.file, ts.isTemplateExpression).map(node => node.getText(script.file)).filter(text => text.includes('last-child'))).toEqual([]);
	});
});
