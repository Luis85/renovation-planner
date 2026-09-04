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
import { beforeAll, describe, expect, it } from 'vitest';
import { REPO } from '../helpers/repo';
import { ESLINT_BOOT_MS, resolveConfig, severityOf, warmUpEslint } from '../helpers/eslint';

const LOCALES_DIR = 'src/presentation/i18n/locales';

/**
 * "An English locale module" identified from this repository's own naming convention —
 * something directly under `locales/` whose name starts with `en` — rather than from the
 * obsidianmd glob this case exists to check. Reusing that glob to find the files would make
 * the check circular: a file the glob fails to match would also fail to be FOUND, and the
 * exact defect this case exists to catch (a filename the glob does not reach) would once
 * again pass silently.
 *
 * **A DIRECTORY is the second spelling, and the first version of this walk read it as a
 * file.** The obsidianmd config the docblock above quotes reaches four shapes and one of them
 * is *a path under an `en` directory* — so a split that puts its partial at `locales/en/
 * editor.ts` is squarely inside the rule, and this walk handed `resolveConfig` the DIRECTORY
 * path instead. ESLint answers a config with no `rules` for a path that is not a file, so both
 * `it.each` cases threw on `undefined` rather than reporting the module unreached: a failure
 * that names the instrument, not the tree. Found at the merge that created the directory —
 * two branches split this one locale file two different ways on the same day, one by prefix
 * and one by directory, and the prefix half is the one this walk had been written against.
 */
const englishLocaleModules = readdirSync(path.join(REPO, LOCALES_DIR), { withFileTypes: true })
	.filter((entry) => entry.name.startsWith('en'))
	.flatMap((entry) =>
		entry.isDirectory()
			? readdirSync(path.join(REPO, LOCALES_DIR, entry.name)).map(
					(file) => `${LOCALES_DIR}/${entry.name}/${file}`,
				)
			: [`${LOCALES_DIR}/${entry.name}`],
	);

describe('every English locale module carries the sentence-case rule', () => {
	/**
	 * The type-aware boot, paid once here rather than inside the first `resolveConfig` under
	 * vitest's default 5s case budget — the convention `lint-scope.test.ts` already follows for
	 * exactly the same call.
	 *
	 * **This file relied on somebody else's boot and nothing said so.** Under file parallelism
	 * it landed in whichever worker the scheduler chose, and passed whenever that worker had
	 * already run a sibling that warms up; the `build` project's move to a single fork
	 * (`vitest.config.ts`) makes worker placement deterministic and turned that luck into a
	 * reproducible 5000ms timeout on the FIRST case to resolve a config. The defect was
	 * pre-existing and latent — a case whose pass depended on which of its siblings ran first
	 * is not a case anybody had checked.
	 */
	beforeAll(warmUpEslint, ESLINT_BOOT_MS);

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

	/**
	 * The `acronyms` option `eslint.config.mjs` adds for `SKU` (design "Asset library
	 * overview" §5's own vocabulary), pinned rather than left to `npm run lint` alone: the
	 * severity case above stays green with that option deleted entirely, since a stale
	 * `undefined` fourth argument leaves the rule at its bare `"warn"` shape — so nothing
	 * short of THIS assertion would notice `SKU` falling back out of scope. Watched red with
	 * the option removed before writing this comment.
	 */
	it.each(englishLocaleModules)('%s widens the rule with SKU as an acronym', async (file) => {
		const config = await resolveConfig(path.join(REPO, file));
		const options = config.rules['obsidianmd/ui/sentence-case-locale-module'];

		expect(options?.[1]).toMatchObject({ acronyms: expect.arrayContaining(['SKU']) });
	});

	// The other direction, named once rather than left implicit: no German partial in this
	// same directory may be swept into the rule by a widened predicate — the HYPHENATED one is
	// the closer call, since it is the one this repo's own `en-*`/`de-*` naming convention
	// pairs with an English file the rule DOES reach, and `de/editor.ts` is the DIRECTORY
	// spelling's own mirror, added when the walk above learned to descend. German noun
	// capitalization is incompatible with the rule either way (`de.ts`'s own header says so).
	it.each(['de.ts', 'de-assetLibrary.ts', 'de/editor.ts'])('does not reach %s', async (file) => {
		const config = await resolveConfig(path.join(REPO, `${LOCALES_DIR}/${file}`));

		expect(severityOf(config, 'obsidianmd/ui/sentence-case-locale-module')).toBeUndefined();
	});
});
