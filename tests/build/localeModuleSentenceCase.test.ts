/**
 * Every English locale MODULE is under `obsidianmd/ui/sentence-case-locale-module`, asked of
 * the tool rather than assumed from a filename convention — the instrument Task 8's fix round
 * did not have.
 *
 * `en-assetLibrary.ts` shipped as `en.assetLibrary.ts` first. The dot-separator spelling reads
 * as an English locale module — it starts with `en` and holds the same kind of key/value
 * table `en.ts` does — and it is not one, because `eslint-plugin-obsidianmd`'s own
 * `recommendedWithLocalesEn` config
 * (`node_modules/eslint-plugin-obsidianmd/dist/lib/index.js`) scopes the rule to a bare
 * `en.ts`, an `en-` prefix, an `en_` prefix, or a path under an `en` directory — never a dot
 * separator. So all 58 strings in it silently left the sentence-case gate, `npx eslint` on the
 * file reported nothing, and a clean lint result was indistinguishable from a rule that had
 * simply never run. Nothing here noticed, because nothing asked the CONFIG the question —
 * this file is that question.
 *
 * Written as a RULE over the directory rather than a list of filenames, which is this
 * repository's own recurring lesson about hand-written lists: `en.ts` names the directory it
 * lives in, and any English partial `en.ts` comes to spread from a future split is
 * IDENTIFIED THE SAME WAY, so this case still catches the next mis-named partial without an
 * edit here.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from '../helpers/repo';
import { resolveConfig, severityOf } from '../helpers/eslint';

const LOCALES_DIR = 'src/presentation/i18n/locales';

/**
 * "An English locale module" identified from this repository's own naming convention —
 * a file directly under `locales/` whose name starts with `en` — rather than from the
 * obsidianmd glob this case exists to check. Reusing that glob to find the files would make
 * the check circular: a file the glob fails to match would also fail to be FOUND, and the
 * exact defect this case exists to catch (a filename the glob does not reach) would once
 * again pass silently.
 */
const englishLocaleModules = readdirSync(path.join(REPO, LOCALES_DIR))
	.filter((file) => file.startsWith('en'))
	.map((file) => `${LOCALES_DIR}/${file}`);

describe('every English locale module carries the sentence-case rule', () => {
	// The instrument before the measurement: a naming convention that stopped matching
	// anything (a directory move, a rename away from the `en` prefix) would make every case
	// below vacuous and green.
	it('finds at least one English locale module', () => {
		expect(englishLocaleModules.length).toBeGreaterThan(0);
	});

	it.each(englishLocaleModules)('%s resolves obsidianmd/ui/sentence-case-locale-module', async (file) => {
		const config = await resolveConfig(path.join(REPO, file));

		expect(severityOf(config, 'obsidianmd/ui/sentence-case-locale-module')).toBe(1);
	});

	// The other direction, named once rather than left implicit: a German partial sitting in
	// the same directory must NOT be swept into the same rule by a widened predicate, since
	// German noun capitalization is incompatible with it (`de.ts`'s own header states this).
	it('does not reach the German partials beside it', async () => {
		const config = await resolveConfig(path.join(REPO, `${LOCALES_DIR}/de.ts`));

		expect(severityOf(config, 'obsidianmd/ui/sentence-case-locale-module')).toBeUndefined();
	});
});
