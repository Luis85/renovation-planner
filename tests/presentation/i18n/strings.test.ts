import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { t, tr } from '../../../src/presentation/i18n/strings';
import { de } from '../../../src/presentation/i18n/locales/de';
import { en } from '../../../src/presentation/i18n/locales/en';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import { createMoney } from '../../../src/core/money/Money';
import { isErr } from '../../../src/core/result/Result';
import { REPO, repoRelative } from '../../helpers/repo';

/** Every file under a directory, recursively, skipping `node_modules` and dotfiles. */
const walk = (dir: string): string[] => {
	const found: string[] = [];
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name.startsWith('.')) continue;
		const full = join(dir, name);
		if (statSync(full).isDirectory()) found.push(...walk(full));
		else found.push(full);
	}
	return found;
};

/**
 * Every digit-bearing token in a string — a maximal run anchored at a digit at both ends, so a
 * trailing sentence period is not read as part of the number and `19,50` survives as one token
 * rather than splitting into two acceptable halves. Used by the shown-example case below.
 */
const amountsIn = (value: string): string[] => value.match(/\d[\d.,]*\d|\d/g) ?? [];

/**
 * §8's Asset library inventory, as it appears in a locale table.
 *
 * THREE prefixes, not two. The first draft of the case below filtered `view.` and `empty.` alone
 * and answered 58 — because `command.open-asset-library` is §8's inventory too and carries
 * neither. It caught its own filter on its first run, which is the whole argument for pinning a
 * count rather than describing one: a wrong description reads exactly like a right one, and a
 * wrong assertion goes red.
 */
const assetLibraryKeys = (table: Record<string, string>): string[] =>
	Object.keys(table).filter(
		(key) =>
			key.startsWith('view.asset-library.') ||
			key.startsWith('empty.asset-library.') ||
			key === 'command.open-asset-library',
	);

/**
 * The currency is irrelevant to the question and any valid code answers it: `AMOUNT_PATTERN` is
 * the half under test and it never sees the currency.
 */
const parsesAsAmount = (raw: string): boolean => !isErr(createMoney(raw, 'EUR'));

/**
 * Pure lookups, asked of the function — no view, no mock, no language global. The
 * fallback cases are the contract that makes an incomplete locale safe to ship.
 */
describe('translating a string', () => {
	it('answers English', () => {
		expect(t('en', 'view.project.name')).toBe('Renovation project');
	});

	it('answers a translated locale', () => {
		expect(t('de', 'view.project.name')).toBe('Renovierungsprojekt');
		expect(t('de', 'command.open-project')).toBe('Renovierungsprojekt öffnen');
	});

	it('falls back to English for a language nothing translates', () => {
		expect(t('fr', 'view.project.name')).toBe('Renovation project');
	});

	// `tr` is `t` in the app's own language — the mock answers 'en', so this pins the
	// delegation, and the per-locale behaviour is already driven through `t` above.
	it('tr answers in the app language', () => {
		expect(tr('view.project.name')).toBe(t('en', 'view.project.name'));
	});

	it('has no default room name that says Zone', () => {
		expect('editor.zone.default-name' in en).toBe(false);
		expect(t('en', 'editor.room.default-name', { n: '3' })).toBe('Room 3');
		expect(t('de', 'editor.room.default-name', { n: '3' })).toBe('Raum 3');
	});
});

/**
 * `de` is typed `Partial<Record<StringKey, string>>` and that is deliberate: an incomplete
 * locale must be SAFE, which is exactly what the English-fallback case above proves.
 * Completeness is a different promise, and the project makes it — "every key goes in BOTH
 * `en.ts` and `de.ts`" — with nothing checking it until now. A forgotten German string is
 * therefore invisible: the type permits its absence, the fallback hides it, and the user is
 * quietly shown English. It measures complete today (73 of 73), which is what makes this one
 * assertion rather than a backlog.
 *
 * Only the one direction. An ORPHANED German key — one whose English original was renamed —
 * is already a build failure: `de.ts` annotates its literal as
 * `Partial<Record<StringKey, string>>`, so excess-property checking rejects a key
 * `StringKey` does not carry. The compiler owns that half; this owns the half it cannot see.
 *
 * ORDER is not checked, and that rule is the reason to say so rather than to widen this:
 * `settings.unrecovered` sits third in `de.ts` and sixth in `en.ts`, and has since before
 * design slice 15 — so "same order" is already false, and asserting it here would add a red
 * for something this change did not break. Reordering a locale file is its own edit.
 */
describe('the German locale', () => {
	it('translates every key English declares', () => {
		const untranslated = Object.keys(en).filter((key) => !(key in de));

		expect(untranslated).toEqual([]);
	});

	/**
	 * The gate this file did not have, and the reason it is needed: NOTHING renders `de.ts`
	 * in any gate, so its only reader is a human who happens to look. The first time anyone
	 * did, it held a word slice 11 had already removed once — `Materialien` for an Asset,
	 * forty lines below a German-language comment recording that correction — plus a garbled
	 * `Tresnornder` and a `Das Tresor` disagreeing with a `Der Tresor` — two keys naming the
	 * same noun, each giving it a different gender.
	 *
	 * A vocabulary check, not a spell check. It expresses "this concept has ONE German word
	 * here", which is exactly what drifts when copy is added a slice at a time by different
	 * hands. What it still cannot see is a misspelling of a word nothing forbids: it refuses
	 * synonyms somebody thought of, and the next wrong word is the one nobody did. The case
	 * below covers exactly that gap for the one term where it is expressible.
	 *
	 * `Vault` is on the list because it is Obsidian's OWN name for the thing and is therefore
	 * not translated at all — the same way the product is not renamed. `Tresor` is what five
	 * keys used to say.
	 */
	const FORBIDDEN: ReadonlyArray<readonly [wrong: string, right: string]> = [
		['Material', 'Objekt'],
		['Tresor', 'Vault'],
	];

	it.each(FORBIDDEN)('never says %s where the German UI says %s', (wrong, right) => {
		const offenders = Object.entries(de)
			.filter(([, value]) => value.includes(wrong))
			.map(([key]) => key);

		expect(offenders, `use "${right}" instead of "${wrong}"`).toEqual([]);
	});

	/**
	 * The stronger half, and the one that earns its place: a forbidden-substring row can only
	 * refuse a wrong word somebody thought of, and the wrong word here was `Tresnornder` — a
	 * corruption that contains neither `Tresor` nor `Vault`, so the row above sails straight
	 * past it. Measured, not assumed: `'Tresnornder…'.includes('Tresor')` is `false`.
	 *
	 * This asks the question from the English side instead. Wherever `en.ts` says "vault",
	 * `de.ts` must say "Vault" — so ANY translation of it fails, including a misspelled one,
	 * and including one nobody predicted. That is the difference between banning a synonym
	 * and requiring the term.
	 */
	it('keeps Obsidian’s own name for the Vault in German, wherever English uses it', () => {
		const offenders = Object.entries(en)
			.filter(([key, value]) => value.toLowerCase().includes('vault') && !(de[key as StringKey] ?? '').includes('Vault'))
			.map(([key]) => key);

		expect(offenders, 'Vault is Obsidian’s own name and is not translated').toEqual([]);
	});

	/**
	 * **A string whose job is to SHOW an accepted form must show one the code accepts**, and
	 * the defect that bought this case is what that reads like when it goes wrong:
	 * `view.project.price-invalid` said `Geben Sie einen Preis wie 19,50 ein` while
	 * `AssetPriceRow.validatePrice` mints through `createMoney`, whose `AMOUNT_PATTERN` admits
	 * only a `.`. A German user who typed the example was refused and shown the example again.
	 * Worse than an ordinary mistranslation, because the English entry's own comment fixes the
	 * copy's purpose as showing the SHAPE — so localizing the separator inverts exactly what the
	 * string is for.
	 *
	 * Asked from the ENGLISH side, like the Vault case above and for the same reason: a
	 * forbidden-spelling row can only refuse a separator somebody thought of. A key QUALIFIES
	 * when its English value carries at least one digit-bearing token and `createMoney` accepts
	 * every one of them — which is what "this string shows a monetary example" is expressible as
	 * without a per-key list — and every such token in the translation must be accepted too.
	 *
	 * **Read what it reaches, because the CLASS it comes from is wider than the check.** A
	 * locale string that instructs a user to type a format the code refuses is not cheaply
	 * checkable in general: nothing ties a key to the validator its copy is about, and an
	 * instruction can be prose with no example in it at all (`use a decimal point` carries no
	 * digit and is invisible here). What this pins is the one expressible half — a shown
	 * EXAMPLE, checked against the one parser this plugin's copy has ever quoted. Its blind
	 * spots, named rather than left to be discovered: a key whose ENGLISH example is itself
	 * refused drops out of the qualifying set entirely rather than being reported (the check
	 * has no other way to know which side is the mistake); a translation that drops the example
	 * and describes the rule instead passes; and it says nothing about any other locale, of
	 * which there is one.
	 *
	 * **A SECOND key now qualifies by the same rule, and it is excluded rather than checked —
	 * "the next qualifying key" this docblock already predicted.** Task 6 (design spec
	 * 2026-09-03, Add Room) added `editor.room.error.not-a-number`, whose English example
	 * `4.2` parses as an amount exactly as a price would. But its copy is a LENGTH accepted by
	 * `parseMetres`, not `createMoney` — and `parseMetres` accepts a decimal COMMA in German on
	 * purpose (design spec §2.6, "since `de.ts` exists"), the opposite of what `AMOUNT_PATTERN`
	 * allows. Checking it against `createMoney` would refuse the correctly-localized `4,2` for
	 * showing the separator `parseMetres` actually wants. `NOT_A_MONEY_EXAMPLE` names it rather
	 * than widening the digit-token heuristic to guess which parser a key is about — one key
	 * excluded, with the reason written here rather than left for the next reader to rediscover.
	 */
	const NOT_A_MONEY_EXAMPLE: ReadonlySet<StringKey> = new Set(['editor.room.error.not-a-number']);

	it('never shows a monetary example the amount parser refuses', () => {
		const offenders: string[] = [];
		for (const [key, english] of Object.entries(en) as [StringKey, string][]) {
			if (NOT_A_MONEY_EXAMPLE.has(key)) continue;
			const shown = amountsIn(english);
			if (shown.length === 0 || !shown.every((raw) => parsesAsAmount(raw))) continue;
			for (const example of amountsIn(de[key] ?? '')) {
				if (!parsesAsAmount(example)) offenders.push(`${key}: "${example}"`);
			}
		}

		expect(offenders, 'a shown price must be one `createMoney` accepts').toEqual([]);
	});

	/**
	 * The locale used the formal Sie in every sentence until one increment added six du-form
	 * imperatives beside fourteen Sie-form ones. A register is a fact about the whole file, so the
	 * check is over every value rather than over the six that were found.
	 *
	 * **The boundary is `\p{L}` lookarounds and NOT `\b`, which is the same English-shaped
	 * instrument the "never Zone" check below was measured blind with.** JS's `\b` is defined over
	 * `[A-Za-z0-9_]`, so an UMLAUT is a non-word character: between a space and the `Ö` of `Öffne`
	 * there are two non-word characters and therefore no boundary at all, and
	 * `/\b(Öffne)\b/.test('Öffne den Bericht')` is `false` — measured, and measured again end to
	 * end by planting that value into `de.ts` and watching this case stay green. So a `\b`-anchored
	 * list could not express an umlaut-initial du-form even if somebody wrote one down, and this
	 * locale's own copy carries the two verbs it matters for: `de.ts` says `Öffnen Sie` and
	 * `Überprüfen Sie` today, whose du-forms are exactly `Öffne` and `Überprüfe`. The trailing
	 * guard is what keeps the Sie-forms out: `Öffnen` fails `(?!\p{L})` at its own `n`.
	 *
	 * **What stays a LIST is stated rather than quietly widened.** These ten are the du-forms of
	 * verbs this locale actually uses; a dozen more Sie-forms in it (`Vergrößern`, `Löschen`,
	 * `Verwerfen`, `Erstellen`, …) have du-forms nothing here refuses, so a register slip in one
	 * of those is invisible. Closing that is a judgement about which verbs to enumerate, which is
	 * a different question from the boundary this edit fixes, and the honest answer is that it is
	 * open rather than covered.
	 */
	const INFORMAL_IMPERATIVE =
		/(?<!\p{L})(Gib|Wähle|Setze|Lege|Zeichne|Tippe|Klicke|Ziehe|Öffne|Überprüfe)(?!\p{L})/u;

	it('addresses the user formally throughout: no du-form imperative anywhere in de.ts', () => {
		const offenders = Object.entries(de)
			.filter(([, german]) => INFORMAL_IMPERATIVE.test(german))
			.map(([key]) => key);
		expect(offenders).toEqual([]);
	});

	it('calls a footprint an Umriss everywhere, including the toolbar', () => {
		expect(de['designer.toolbar.trace-footprint']).toBe('Umriss nachzeichnen');
	});
});

/**
 * Design spec 2026-09-03 (Add Room), §7.2: "Room, never Zone" — the Plan Editor's own
 * vocabulary and the empty-state copy that names it must say Room to a homeowner, never the
 * persisted `Zone` entity's own name. `editor.zone-type.*` VALUES are exempt by construction:
 * they are ADR-0016's seven homeowner-worded type labels ("Room", "Garden", …), none of which
 * contains the word "zone" itself.
 *
 * **ONE PATTERN CANNOT ASK THIS OF TWO LANGUAGES, and the first version of this check asked it
 * anyway.** It ran `/\bzones?\b/i` over `for (const table of [en, de])`, and a word BOUNDARY is
 * an English-shaped instrument: German's own plural is `Zonen`, where the trailing `n` is a word
 * character, so the `\b` after `Zone` fails and `zones` does not match `Zonen` either. Measured
 * against the very string this increment fixed by hand —
 * `'Die Zonen auf diesem Plan neu skalieren?'`, the pre-diff value of
 * `editor.calibrate.recalibrate.title` — which the old check PASSED. So the German half was
 * structurally unable to report the class it exists for, in the language most likely to produce
 * it, while the English half passed beside it and the whole `it` read as coverage of both.
 *
 * The two arms are taken apart rather than widened together, because their SAFETY arguments are
 * different facts about different languages and only the sentence below says which is which:
 *
 * - **German is the bare stem `/zone/i`**, the pattern the `DELETE_FLOW_KEYS` case below already
 *   spells as `/Zone/i` for this same reason. `Zone` is a feminine noun whose every inflection
 *   (`Zone`, `Zonen`) and every compound (`Bauzone`, `Zonenplan`) keeps the full stem, so the
 *   stem covers the class rather than a list of forms somebody thought of.
 * - **English is `/zon(e|ing)/i`**, one alternative wider than the stem: English derives a
 *   gerund that DROPS the `e` (`zoning`), which no substring of `zone` can see. The `e` arm
 *   covers `zone`, `zones`, `zoned`, `subzone` and `zone-type` — every form the boundary
 *   version missed the moment a hyphen or a prefix was attached.
 *
 * **Neither goes one letter shorter to `/zon/i`**, which would additionally catch `zoniert` and
 * `zoning` in one pattern — and would sweep in `horizontal` and `Horizont`, ordinary geometry
 * copy in BOTH languages. Measured as a PROSPECT rather than as a live false positive: no locale
 * value carries either word today (`grep -i horizont src/presentation/i18n/locales/` prints
 * nothing), so the cost lands on the first author who writes one, silently, against a check
 * nobody re-reads. What each arm still cannot see is a synonym for the entity that does not
 * contain its name (`Bereich`, `region`) and any string outside the two prefixes — the sibling
 * case below carries the two keys that second gap is known to hold.
 */
describe('the plan editor speaks of Room, never Zone (ADR-0016, design spec 2026-09-03 §7.2)', () => {
	const HOMEOWNER_PREFIXES = ['editor.', 'empty.plan.'];

	/** Homeowner-facing keys of one table whose VALUE names the persisted entity, key and text. */
	const namesTheEntity = (table: Partial<Record<StringKey, string>>, forbidden: RegExp): string[] =>
		Object.entries(table)
			.filter(([key]) => HOMEOWNER_PREFIXES.some((prefix) => key.startsWith(prefix)))
			.filter(([, value]) => forbidden.test(value))
			.map(([key, value]) => `${key}: ${value}`);

	it('says Room and never zone, zones or zoning anywhere a homeowner reads the editor', () => {
		expect(namesTheEntity(en, /zon(e|ing)/i)).toEqual([]);
	});

	it('says Raum and never Zone or Zonen — the plural a word-boundary check could not see', () => {
		expect(namesTheEntity(de, /zone/i)).toEqual([]);
	});
});

/**
 * The two sentences the DELETE FLOW puts on screen, which §7.2's prefix scope cannot reach.
 *
 * `reference.no-reassignment-target` and `zone.listing-incomplete` are both raised by the
 * reassign decision the Plan Editor's own Delete button opens — the very control the Add Room
 * increment relabelled — and both said "zone" to a homeowner while every label around them
 * said "room or area". Neither key carries an `editor.` or an `empty.plan.` prefix, so the
 * category check above is silent about them BY DESIGN (the scope is the spec's and stays as
 * drawn): a code raised in `application/` and minted in `presentation/` is not the editor's
 * vocabulary as a rule, and widening the prefix list would sweep in every `reference.*` and
 * `zone.*` sentence, most of which no editing surface shows.
 *
 * So these two are named. A LIST rather than a rule, which this repository normally refuses —
 * and the reason it is right here is that the list is what the prefix scope deliberately
 * excludes: a rule wide enough to cover them is the widening the spec declined. The trigger
 * for a third entry is a third code the delete flow can surface.
 */
/**
 * ADR-0016's homeowner split is Room OR Area — one thing is one or the other, never both — so
 * a label that reworded "zone" into a CONJUNCTION says something the split does not.
 * `editor.calibrate.recalibrate.title` shipped as "rooms and areas" while its own message
 * three characters away said "rooms or areas", which is two sentences of one dialog
 * disagreeing about the model.
 */
describe('the reworded zone labels use the split ADR-0016 actually draws', () => {
	it('the recalibration prompt says "or" in its title as well as its message', () => {
		for (const table of [en, de]) {
			const title = table['editor.calibrate.recalibrate.title'];
			const message = table['editor.calibrate.recalibrate.message'];
			const connective = table === en ? /rooms? or areas?/i : /R(aum|äume) oder Fläche/;
			expect(title).toMatch(connective);
			expect(message).toMatch(connective);
			expect(title).not.toMatch(table === en ? /rooms? and areas?/i : /R(aum|äume) und Fläche/);
		}
	});
});

describe('the delete flow the editor opens speaks the same vocabulary as the editor', () => {
	const DELETE_FLOW_KEYS = ['reference.no-reassignment-target', 'zone.listing-incomplete'] as const;

	it('says room or area in English and Raum/Fläche in German, never zone', () => {
		for (const key of DELETE_FLOW_KEYS) {
			expect(en[key]).not.toMatch(/\bzones?\b/i);
			expect(en[key]).toMatch(/rooms? or areas?/i);
			// German's own plural is `Zonen`, which `\bzones?\b` cannot see — measured in the
			// category check above, and the reason this one spells the German stem itself.
			expect(de[key]).not.toMatch(/Zone/i);
			expect(de[key]).toMatch(/R(aum|äume)/);
			expect(de[key]).toMatch(/Fläche/);
		}
	});
});

/** Every `{name}`-shaped hole in a template, sorted so two lists compare by content alone. */
const holesIn = (value: string): string[] => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).toSorted();

describe('interpolation', () => {
	it('fills a hole from params', () => {
		expect(t('en', 'reference.row.project', { name: 'Kitchen refit' })).toBe('Kitchen refit');
	});

	it('leaves an unmatched hole standing rather than blanking it', () => {
		// A visible `{name}` is a bug report; an empty string is a silent one.
		expect(t('en', 'reference.row.project', {})).toContain('{name}');
	});

	it('substitutes in ONE pass, so a value containing a hole is not re-substituted', () => {
		// `reference.row.project-at-path` is `'{name} — {path}'`, and the `name` VALUE here is
		// itself the literal `{path}`. One pass leaves it standing; an implementation that
		// looped `replace` per parameter would fill `{name}` first and then find the `{path}`
		// it had just written, substituting the folder into a project's own NAME. Nothing else
		// in this file can tell the two apart — every other case has brace-free values, on
		// which the two implementations agree exactly.
		expect(t('en', 'reference.row.project-at-path', { name: '{path}', path: 'Vault/Library' }))
			.toBe('{path} — Vault/Library');
	});

	it('is unchanged for a two-argument call', () => {
		expect(t('en', 'view.project.list-title')).toBe(en['view.project.list-title']);
	});

	it('requires de.ts to name the same holes as en.ts, per key', () => {
		for (const [key, german] of Object.entries(de) as [StringKey, string][]) {
			expect(holesIn(german), `de.ts holes for ${key}`).toEqual(holesIn(en[key]));
		}
	});

	/**
	 * The Asset library's key count, PINNED rather than described.
	 *
	 * This number lived in prose in four docblocks and went stale SIX times on the branch that
	 * introduced it — once fifteen lines above the very comment announcing the key that had just
	 * changed it. Every correction was careful and every one went stale, so a seventh careful
	 * sentence predicts an eighth staleness; the remedy is an assertion, which cannot.
	 *
	 * It is a RANGE-free exact count on purpose. A `toBeGreaterThan` would pass through exactly
	 * the additions this exists to make deliberate: §8's inventory is a closed list the spec
	 * states, so a further key is a spec amendment somebody makes rather than a gap somebody
	 * fills, and this case is where they find that out. Both locales are counted because an
	 * incomplete `de.ts` is permitted by the type and would otherwise drift silently.
	 *
	 * **What this case makes VISIBLE is not what it makes HAPPEN, and the previous wording of the
	 * sentence above blurred the two.** It fires on the key, whoever bumps the number reads why,
	 * and the amendment is then a habit — which failed twice: `view.asset-library.used-in
	 * .overridden` and `view.asset-library.note-future-schema` both reached this pin, both had it
	 * bumped past them, and neither reached §8 until the branch's final review (the spec's
	 * Amendment 4 records both, and withdraws the ordinals the two rounds assigned in passing).
	 * Nothing here can read a design document, so the guarantee is exactly *the count cannot move
	 * silently* and never *the spec was amended*.
	 */
	it('pins the Asset library inventory at 63 keys in both locales', () => {
		expect(assetLibraryKeys(en)).toHaveLength(63);
		expect(assetLibraryKeys(de)).toHaveLength(63);
	});
});

/**
 * Note 33 / R6: the Plan Editor's toolbar retired (Task 13 replaced it with a context bar and
 * a floating Select/Add group), and the Asset Designer's own toolbar had borrowed three of the
 * retired keys — `editor.toolbar.pan`/`.undo`/`.redo` — rather than minting its own. That made
 * a valid designer control look like a regression against the editor-shell retirement contract,
 * and left no way to express which surface owns the copy. R6 renames the three to
 * `designer.toolbar.pan`/`.undo`/`.redo` and retires `editor.toolbar.*` from both locales.
 *
 * A category claim ("no surface names a retired key") is checked at the forbidden thing — a
 * `src/`-wide scan for the literal — rather than by listing the files it must not appear in,
 * per this repository's own rule that a list goes stale and a rule does not.
 */
describe('the Plan Editor toolbar is retired (spec §5.2, R6)', () => {
	it('declares no editor.toolbar.* key in either locale', () => {
		expect(Object.keys(en).filter((key) => key.startsWith('editor.toolbar.'))).toEqual([]);
		expect(Object.keys(de).filter((key) => key.startsWith('editor.toolbar.'))).toEqual([]);
	});

	it('names editor.toolbar. nowhere under src/, and the designer uses its own keys', () => {
		const hits = walk(join(REPO, 'src')).filter((file) => readFileSync(file, 'utf8').includes('editor.toolbar.'));
		expect(hits.map((file) => repoRelative(file))).toEqual([]);

		for (const key of ['designer.toolbar.pan', 'designer.toolbar.undo', 'designer.toolbar.redo']) {
			expect(en[key as StringKey]).toBeDefined();
			expect(de[key as StringKey]).toBeDefined();
		}
	});
});
