import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toUserMessage, trError } from '../../../src/presentation/i18n/toUserMessage';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import type { AppError, ErrorCategory } from '../../../src/core/errors/AppError';

/**
 * The message/log separation (SDD §66–68): what a user reads comes from the locale
 * tables, keyed by `error.code` — never from the error's own `message`, which is
 * developer English written at the raise site. The en/de case is what proves the text
 * really comes from the tables rather than from a literal that happens to read well.
 */

function error(partial: Partial<AppError>): AppError {
	return {
		category: 'Persistence',
		code: 'zone.save-failed',
		message: 'Internal: ENOSPC while writing /Users/x/Renovation/Zones/a.md',
		...partial,
	} as AppError;
}

/**
 * The category sentence each row below must NOT resolve to. Spelled here rather than inline,
 * because the two cases that use it each drive several codes.
 */
const CATEGORY_KEY: Partial<Record<ErrorCategory, StringKey>> = {
	Validation: 'error.category.validation',
	Persistence: 'error.category.persistence',
};

/**
 * The CATEGORY that the worked examples in `describe('toUserMessage')` are examples OF: every
 * `${kind}.` and `${spec.kind}.` string raised anywhere under `src/infrastructure/` says
 * something of its own to a user. (Declared out here rather than inside that block only because
 * a helper capturing nothing from its scope is an oxlint finding; the case using it is in there.)
 *
 * It replaces a sentence — restated in `en.ts`, in `toUserMessage.ts` and in the docblock over
 * those examples — which quoted a grep, read FOUR shared raise sites off it and concluded that "the
 * class is closed". The same grep prints SIX, and `note-id-mismatch` really did degrade to
 * *The vault could not be read or written* on every note-backed kind. A number nobody re-runs
 * cannot close a class; this scan runs on every gate.
 *
 * **What a text scan cannot settle, and therefore what `NOT_A_CODE` is for.** The pattern
 * finds a per-kind STRING, and this file cannot tell whether that string is handed to
 * `persistenceError` or to `logger.error` — `delete-compensation-failed` is the second, an
 * SDD §42 log line for a failed compensation, and the user is answered by the ORIGINAL
 * refusal (`spec.deleteFailedCode`) rather than by it. A whole review round read the raw grep
 * as six raise sites and reported that one as reaching users; only opening the file says
 * otherwise. So an entry here is a READING somebody made, and it is asserted to still match
 * something the scan finds — a carve-out for a site that no longer exists is a comment that
 * goes on reading as a live exception.
 */
const NOT_A_CODE: Readonly<Record<string, string>> = {
	'delete-compensation-failed':
		'a logger event name in noteEntityWrite.ts, never an AppError code: the caller is ' +
		'answered with the delete failure that provoked the compensation.',
};

/** `src/infrastructure/**` is a different tree from every file that states this claim, so the
 *  scan cannot match its own quotation — which is how the previous version of it was
 *  re-runnable and still never re-run. */
function perKindSuffixes(): ReadonlySet<string> {
	const pattern = /\$\{(?:spec\.)?kind\}\.([a-z-]+)/gu;
	const found = new Set<string>();
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.name.endsWith('.ts'))
				for (const match of readFileSync(full, 'utf8').matchAll(pattern)) found.add(match[1]);
		}
	};
	walk(join('src', 'infrastructure'));
	return found;
}

describe('toUserMessage', () => {
	it('resolves a code the table knows through t()', () => {
		expect(toUserMessage('en', error({ code: 'vault.unexpected-failure' }))).toBe(
			'Reading or writing the vault failed unexpectedly. Try again.',
		);
	});

	it('falls back by suffix for a dynamic per-kind code', () => {
		const future = error({ category: 'Migration', code: 'zone.schema-version-unsupported' });
		expect(toUserMessage('en', future)).toContain('newer version of this plugin');
	});

	/**
	 * Worked EXAMPLES of the per-kind fallback, which the case below then asks as a category.
	 *
	 * Driven with `plan.` and `zone.` prefixes rather than `asset-price.`, deliberately: both
	 * sites are ONE raise parameterised by kind, so a per-kind entry would answer for one kind
	 * and leave the siblings on the generic category sentence — which is where every kind was
	 * until these rows. Asserting the sibling kinds is what makes that a claim about the class.
	 *
	 * This docblock used to carry a grep and a count of what it reports, restating `en.ts`'s and
	 * `toUserMessage.ts`'s copies of the same sentence. All three read FOUR; the grep prints six.
	 * The count is gone from all three, and `perKindSuffixes` above asserts the coverage instead.
	 */
	it.each([
		['plan.schema-version-malformed', 'Validation'],
		['zone.schema-version-malformed', 'Validation'],
		['plan.project-folder-unresolved', 'Persistence'],
		['asset-price.project-folder-unresolved', 'Persistence'],
	] as const)('resolves %s by suffix rather than by category', (code, category) => {
		const refusal = error({ category, code });

		const categoryKey = CATEGORY_KEY[category] as StringKey;
		expect(toUserMessage('en', refusal)).not.toBe(t('en', categoryKey));
		expect(toUserMessage('de', refusal)).not.toBe(t('de', categoryKey));
	});

	it('resolves every per-kind suffix raised in src/infrastructure/ to something other than its category sentence', () => {
		const suffixes = perKindSuffixes();
		// An instrument that reaches nothing looks exactly like a clean tree.
		expect(suffixes.size).toBeGreaterThan(3);
		expect(Object.keys(NOT_A_CODE).filter((suffix) => !suffixes.has(suffix))).toEqual([]);

		for (const suffix of suffixes) {
			if (suffix in NOT_A_CODE) continue;
			// `plan.` because no direct key exists for it, so only the SUFFIX table can answer:
			// a direct-code entry would pass this for one kind and leave its siblings behind,
			// which is the exact defect these rows exist to close.
			const refusal = error({ category: 'Persistence', code: `plan.${suffix}` });
			expect(toUserMessage('en', refusal)).not.toBe(t('en', 'error.category.persistence'));
			expect(toUserMessage('de', refusal)).not.toBe(t('de', 'error.category.persistence'));
		}
	});

	/**
	 * **A direct code key BEATS a matching suffix**, because `hasLocaleKey(error.code)` is asked
	 * first — and these two rely on it. `error.suffix.revision-conflict` says "Reload and try
	 * again", which is wrong on the price section: there is nothing to reload, and the row's
	 * expectation is frozen for exactly as long as the draft is, so a refresh cannot help and the
	 * DISCARD is the gesture that unsticks the field.
	 *
	 * Asserted as "not the suffix sentence" rather than as "equals the entry", because the
	 * failure this guards against is the ORDER of the two lookups rather than the copy: an
	 * implementation that walked the suffixes first would return the suffix sentence and pass
	 * every other case in this file.
	 */
	it.each(['asset-price.revision-conflict', 'asset-price.external-modification'])(
		'%s answers its own copy rather than the suffix it also matches',
		(code) => {
			const refusal = error({ category: 'Validation', code });
			const suffix = code === 'asset-price.revision-conflict'
				? 'error.suffix.revision-conflict'
				: 'error.suffix.external-modification';

			expect(toUserMessage('en', refusal)).toBe(t('en', code as StringKey));
			expect(toUserMessage('en', refusal)).not.toBe(t('en', suffix));
			expect(toUserMessage('de', refusal)).not.toBe(t('de', suffix));
		},
	);

	it('falls back per category when neither the code nor a suffix has an entry', () => {
		for (const category of [
			'Domain',
			'Validation',
			'Persistence',
			'Geometry',
			'Import',
			'Migration',
			'Reference',
			'Calculation',
		] as const) {
			const message = toUserMessage('en', error({ category, code: 'totally.unknown-code' }));
			expect(message.length).toBeGreaterThan(0);
			expect(message).not.toContain('ENOSPC');
		}
	});

	it('never returns the raw exception message, a stack fragment or a file path', () => {
		const leaky = error({
			category: 'Geometry',
			code: 'zone.self-intersecting',
			message: 'polygon self-intersects at (x=3, y=4): see tests/infrastructure/obsidian/repositories',
		});
		const message = toUserMessage('de', leaky);
		expect(message).not.toContain('self-intersect');
		expect(message).not.toContain('.ts');
		expect(message).not.toContain('/');
	});

	it('resolves different text per language, proving the copy comes from the locale tables', () => {
		const future = error({ category: 'Migration', code: 'plan.schema-version-unsupported' });
		const en = toUserMessage('en', future);
		const de = toUserMessage('de', future);
		expect(en).not.toBe(de);
		expect(de).toContain('neueren Version');
	});
});

/**
 * The binding nothing enforced: a locale key that does not EXACTLY equal a minted
 * `AppError.code`.
 *
 * `en` is a plain object literal and `StringKey = keyof typeof en`, so the compiler
 * accepts any key at all. A misspelt one is dutifully translated in `de.ts`, passes
 * `tests/presentation/i18n/strings.test.ts` (which only asks that `de` covers `en`),
 * and then never resolves — falling through to exactly the category sentence design
 * slice 11's Definition of Done item 3 exists to remove. Silent, and identical to the
 * defect this task was written to fix.
 *
 * The table below is the binding. It is copied from the RAISE SITES, not from the locale
 * file — a table derived from `en.ts` would agree with a typo — and each row names the
 * module that mints the code so the pairing is checkable by reading two files.
 *
 * Two assertions per row, because they fail for different reasons:
 *
 *   - the resolved copy IS the code's own entry, which is false the moment the key and
 *     the code differ by one character (`t` answers `undefined` for an unknown key, and
 *     `toUserMessage` then returns the category sentence);
 *   - the resolved copy is NOT the category sentence, in BOTH locales — the behavioural
 *     half, and the test under `en.ts`'s claim that each of these entries exists because
 *     the category sentence does not serve it.
 *
 * What this does NOT check, so the sentence is not read wider than it is: that a raise
 * site still mints the code the row names. Those are inline object literals, so there is
 * no symbol to import; a code renamed at its raise site leaves this green and the user
 * back on the category sentence. That is what the "and the module that mints it" column
 * is for — it is a pointer for a reader, not an instrument.
 */
const MINTED: ReadonlyArray<readonly [code: string, category: ErrorCategory, categoryKey: StringKey, mintedIn: string]> = [
	['reference.referents-exist', 'Reference', 'error.category.reference', 'application/reference/deleteResolution.ts'],
	['reference.set-changed', 'Reference', 'error.category.reference', 'application/reference/deleteResolution.ts'],
	['reference.resolution-required', 'Validation', 'error.category.validation', 'application/reference/deleteResolution.ts'],
	['reference.no-reassignment-target', 'Validation', 'error.category.validation', 'presentation/editor/deleteZoneFlow.ts'],
	['reference.no-reassignment-asset', 'Validation', 'error.category.validation', 'presentation/library/deleteAssetFlow.ts'],
	['reference.self-reassign', 'Validation', 'error.category.validation', 'application/commands/zone/DeleteZone.ts'],
	['reference.cross-project-reassign', 'Validation', 'error.category.validation', 'application/commands/zone/DeleteZone.ts'],
	['requirement.unit-not-area', 'Validation', 'error.category.validation', 'application/commands/requirement/AssignAsset.ts'],
	['requirement.negative-quantity', 'Domain', 'error.category.domain', 'application/commands/requirement/SetRequirementQuantityOverride.ts'],
	// Design slice 16's New Project form. `project.negative-amount` is deliberately absent:
	// it is raised by the same `Project.create` and would belong here on the same grounds,
	// but no form routes it yet (see `NEW_PROJECT_ERRORS`'s own comment in `NewProjectForm.vue`).
	['project.empty-name', 'Validation', 'error.category.validation', 'domain/project/Project.ts'],
	['project.unknown-status', 'Validation', 'error.category.validation', 'domain/project/Project.ts'],
	['project.target-before-start', 'Validation', 'error.category.validation', 'domain/project/Project.ts'],
	['project.invalid-date', 'Validation', 'error.category.validation', 'domain/project/Project.ts'],
	// Design slice 21's New plan form. `plan.project-not-found` is deliberately absent: it is
	// the one refusal `NewPlanForm` routes to neither a field nor the user-facing banner — the
	// view notifies and navigates on it — so no copy of its own is owed. The three background
	// codes `Plan.create` also mints are absent for the plainer reason that no form sends a
	// background.
	['plan.empty-name', 'Validation', 'error.category.validation', 'domain/plan/Plan.ts'],
	// Design slice A10's New asset form, and the asset designer's whole vocabulary behind it.
	//
	// **Copied from the RAISE SITES, and the count is the point.** The task that added these
	// enumerated seven codes and then said to trust the grep over the enumeration; the grep
	// prints SEVENTEEN — sixteen distinct `assetError` codes plus `assetNotFound`'s.
	//
	// `assetError(code, message)` mints `asset.${code}` from a template, so no whole code string
	// appears anywhere in `src/`: the instrument has to be
	// `grep -rn "assetError(" src/domain/asset src/application/commands/asset` read together
	// with the argument on the FOLLOWING line. Measured rather than eyeballed — 17 call sites,
	// 9 written inline and 8 WRAPPED — and a single-line `grep -o "assetError('[a-z-]*'"`
	// finds only the 9, which is this repository's own recorded "measure a set with an
	// instrument that can see all of it" defect reproduced exactly. `asset.not-found` escapes
	// both spellings, being `assetNotFound`'s own object literal.
	//
	// An earlier draft of this very comment said "nine of the sixteen calls wrap", which is
	// wrong twice over and was written from the shape of the grep output rather than from a
	// count of it.
	//
	// Every one gets a row rather than only the nine the form routes to a field: a code with
	// no entry does not degrade to silence, it degrades to the generic Validation sentence,
	// and absence from the form's `FieldErrorMap` means "put it in the BANNER" — where the
	// generic sentence is exactly what would appear.
	['asset.empty-name', 'Validation', 'error.category.validation', 'domain/asset/Asset.ts'],
	['asset.unknown-category', 'Validation', 'error.category.validation', 'domain/asset/Asset.ts'],
	['asset.negative-unit-cost', 'Validation', 'error.category.validation', 'domain/asset/Asset.ts'],
	['asset.invalid-height', 'Validation', 'error.category.validation', 'domain/asset/Asset.ts'],
	['asset.negative-height', 'Validation', 'error.category.validation', 'domain/asset/Asset.ts'],
	['asset.non-positive-dimension', 'Validation', 'error.category.validation', 'domain/asset/AssetShape.ts'],
	['asset.dimension-underflow', 'Validation', 'error.category.validation', 'domain/asset/AssetShape.ts'],
	['asset.invalid-footprint', 'Validation', 'error.category.validation', 'domain/asset/AssetShape.ts'],
	['asset.degenerate-footprint', 'Validation', 'error.category.validation', 'domain/asset/AssetShape.ts'],
	['asset.invalid-clearance', 'Validation', 'error.category.validation', 'domain/asset/AssetShape.ts'],
	['asset.degenerate-clearance', 'Validation', 'error.category.validation', 'domain/asset/AssetShape.ts'],
	['asset.invalid-anchor', 'Validation', 'error.category.validation', 'domain/asset/AssetShape.ts'],
	['asset.invalid-facing', 'Validation', 'error.category.validation', 'domain/asset/AssetShape.ts'],
	[
		'asset.typed-footprint-cannot-be-pending',
		'Validation',
		'error.category.validation',
		'domain/asset/AssetShape.ts',
	],
	[
		'asset.absent-clearance-cannot-be-pending',
		'Validation',
		'error.category.validation',
		'domain/asset/AssetShape.ts',
	],
	// The one `assetError` call outside the domain, and the only one of the seventeen whose
	// module is an application command.
	['asset.no-footprint', 'Validation', 'error.category.validation', 'application/commands/asset/updateAssetShape.ts'],
	// `assetNotFound` rather than `assetError`, which is why a grep for the latter misses it
	// and why it is a `Reference` refusal: nothing about the input is wrong, the thing it
	// names is not there. Its category sentence is the one slice 11 recorded as actively
	// misleading — it says an entry no longer exists, which here is true, so the row earns
	// its place on the OTHER assertion: the entry names the asset rather than "that entry".
	['asset.not-found', 'Reference', 'error.category.reference', 'domain/asset/Asset.errors.ts'],
	// The picker-race refusal on BOTH surfaces, and the pair is two rows rather than one because
	// the sentences send the user back to different nouns — a spec sheet and a plan document. The
	// asset half arrived with the probe that raises it; the plan half's guard has existed since
	// slice 5 and its copy had not, so a plan whose background file went missing between the
	// picker and the dispatch resolved "That entry no longer exists." about a plan that had not.
	[
		'asset.background-not-found',
		'Reference',
		'error.category.reference',
		'application/commands/asset/SetAssetBackground.ts',
	],
	[
		'plan.background-not-found',
		'Reference',
		'error.category.reference',
		'application/commands/plan/SetPlanBackground.ts',
	],
	// Minted in PRESENTATION, like `reference.no-reassignment-target` above: a rectangle needs
	// both halves and no command refuses one given without the other, because none is asked.
	['asset.dimensions-incomplete', 'Validation', 'error.category.validation', 'presentation/views/NewAssetForm.vue'],
	// `createMoney`'s two, which `NewAssetForm` runs as a PRE-CHECK. They earn their rows for
	// a reason none of the rows above has: `CreateAssetCommand` reaches `Money.of` on its
	// first line and `of` THROWS on either input rather than refusing, so without that
	// pre-check neither code is ever minted at all — the user gets `vault.unexpected-failure`
	// about a vault nothing opened. The rows are what say the refusing path has copy.
	['money.invalid-amount', 'Validation', 'error.category.validation', 'core/money/Money.ts'],
	['money.invalid-currency', 'Validation', 'error.category.validation', 'core/money/Money.ts'],
	// Design slice 19's §83 overlap guard. A `Persistence` refusal rather than a `Validation`
	// one, because it is `persistenceError` at the repository that mints it — and that is
	// precisely why the row earns its place: the generic Persistence sentence is "reading or
	// writing the vault failed unexpectedly", which is false about a refusal that read and
	// wrote nothing and knows exactly what is wrong.
	[
		'project.folder-overlaps-library',
		'Persistence',
		'error.category.persistence',
		'infrastructure/obsidian/repositories/ObsidianProjectRepository.ts',
	],
	// The skip-and-count increment's one refusal. `Persistence`, because `persistenceError`
	// is what the query raises — and the category sentence is wrong for it twice over: nothing
	// failed unexpectedly, and the user needs to know the LIST is short rather than that a
	// read broke.
	[
		'zone.listing-incomplete',
		'Persistence',
		'error.category.persistence',
		'application/queries/ListReassignmentTargets.ts',
	],
	// The asset-side sibling (§5.1a): the same refusal, over the vault-wide catalogue rather
	// than a per-project zone list, raised at the same site.
	[
		'asset.listing-incomplete',
		'Persistence',
		'error.category.persistence',
		'application/queries/ListReassignmentTargets.ts',
	],
	// Slice 19's library-folder migration, and the four rows are the four ways it can
	// refuse. Each category below is copied from the RAISE SITE rather than from what the
	// sentence sounds like: the two refusals are `Validation` because nothing has been read
	// or written when they fire, and the two failures are `Persistence` because a vault
	// operation is exactly what did not work.
	//
	// The last one is why the pair is not one row: `settings.library-move-failed` and
	// `settings.library-persist-failed` share a category and a category sentence, and their
	// RECOVERIES are opposites — one says the setting was not changed, the other says the
	// notes already moved and the setting is what needs setting.
	['settings.library-folder-empty', 'Validation', 'error.category.validation', 'plugin/settings/libraryMigration.ts'],
	[
		'settings.library-overlaps-project',
		'Validation',
		'error.category.validation',
		'plugin/settings/libraryMigration.ts',
	],
	// The SOURCE overlap, and it is a row of its own rather than a synonym of the one above:
	// the project sentence says "inside a project folder, or contains one", which is false
	// about a destination that overlaps the folder the catalogue is currently in, and a user
	// told the wrong thing about which folder is the problem has nothing to act on.
	[
		'settings.library-overlaps-source',
		'Validation',
		'error.category.validation',
		'plugin/settings/libraryMigration.ts',
	],
	// The SOURCE being the vault root, and it is a third row rather than a synonym of the
	// second for the same reason the second is not a synonym of the first: the overlap
	// sentence names the DESTINATION, and the root overlaps every folder there is, so a user
	// reading it picks another folder and is refused again with nothing naming the state.
	[
		'settings.library-source-is-vault-root',
		'Validation',
		'error.category.validation',
		'plugin/settings/libraryMigration.ts',
	],
	// The source SPELLING refusal — narrower than the existence check it replaced, which
	// refused a fresh vault whose library folder had simply not been created yet.
	// `settings.library-move-failed` was read before minting this and is not honest for it:
	// its sentence is true but says nothing a user can act on, and it is `Persistence`, which
	// claims a vault operation failed when none was attempted.
	[
		'settings.library-source-case-mismatch',
		'Validation',
		'error.category.validation',
		'plugin/settings/libraryMigration.ts',
	],
	// Step 0's REFRESH failure, minted rather than folded into the rebuild row below for the
	// reason that row gives about the persist one: both are the same operation failing, and
	// the rebuild sentence opens "The catalogue moved" — false here, where the refusal fires
	// before a single rename. The recovery differs with it: a retry may simply work.
	[
		'settings.library-refresh-failed',
		'Persistence',
		'error.category.persistence',
		'plugin/settings/libraryMigration.ts',
	],
	['settings.library-move-failed', 'Persistence', 'error.category.persistence', 'plugin/settings/libraryMigration.ts'],
	// The REBUILD failure, minted rather than folded into the persist row below. Both leave the
	// notes at the destination and the setting naming the source, but the persist sentence says
	// the setting could not be saved — which is the wrong event here, since nothing was
	// attempted — and the remedy differs: the session's index is what is behind, so it has to
	// catch up with the vault before the setting is pointed anywhere.
	[
		'settings.library-rebuild-failed',
		'Persistence',
		'error.category.persistence',
		'plugin/settings/libraryMigration.ts',
	],
	[
		'settings.library-persist-failed',
		'Persistence',
		'error.category.persistence',
		'plugin/settings/libraryMigration.ts',
	],
	// The currency invariant: `expectedCurrency`, required, refused before arithmetic. The
	// category sentence for `Calculation` ("A quantity could not be calculated.") says
	// nothing about currency, and for `Reference` ("That entry no longer exists.") says
	// nothing about which entry or why it matters here.
	['cost.currency-mismatch', 'Calculation', 'error.category.calculation', 'domain/cost/costPipeline.ts'],
	[
		'requirement.project-not-found',
		'Reference',
		'error.category.reference',
		'application/commands/requirement/AssignAsset.ts',
	],
	[
		'requirement.project-gone',
		'Calculation',
		'error.category.calculation',
		'application/commands/requirement/RecalculateRequirement.ts',
	],
	// The per-project price override increment's section. Every row is copied from its RAISE
	// SITE, not from `en.ts`.
	//
	// THREE `asset-price.*` codes are deliberately absent, and each absence is a decision rather
	// than an omission, exactly as `project.negative-amount` above is:
	// `asset-price.duplicate-pair` is a logger warning, `asset-price.orphaned-by-asset-delete`
	// has its own notice, and `asset-price.pre-write-invalid` has no user-facing door at all.
	[
		'asset-price.currency-mismatch',
		'Validation',
		'error.category.validation',
		'application/commands/asset-price/SetAssetPriceOverride.ts',
	],
	// Held out of reach by `AssetPriceRow`'s own validator, and localized anyway: a code kept
	// unreachable by a GUARD degrades to the wrong sentence the day the guard moves, which is a
	// different kind of unreachability from `project.negative-amount`'s structural one.
	[
		'asset-price.negative-unit-cost',
		'Validation',
		'error.category.validation',
		'domain/asset-price/AssetPriceOverride.ts',
	],
	[
		'asset-price.project-not-found',
		'Reference',
		'error.category.reference',
		'application/commands/asset-price/SetAssetPriceOverride.ts',
	],
	[
		'asset-price.asset-not-found',
		'Reference',
		'error.category.reference',
		'application/commands/asset-price/SetAssetPriceOverride.ts',
	],
	[
		'asset-price.write-failed',
		'Persistence',
		'error.category.persistence',
		'infrastructure/obsidian/repositories/ObsidianAssetPriceOverrideRepository.ts',
	],
	[
		'asset-price.delete-failed',
		'Persistence',
		'error.category.persistence',
		'infrastructure/obsidian/repositories/ObsidianAssetPriceOverrideRepository.ts',
	],
	// `Persistence`, not `Validation`: `readNoteBackedEntity` re-wraps the mapper's own
	// `ValidationError` as a `persistenceError` under this code, so the category is the
	// WRAPPER's. Read from the raise site rather than guessed from the name, which would have
	// put it beside `frontmatter-invalid` below.
	[
		'asset-price.entity-invalid',
		'Persistence',
		'error.category.persistence',
		'infrastructure/obsidian/repositories/ObsidianAssetPriceOverrideRepository.ts',
	],
	[
		'asset-price.frontmatter-invalid',
		'Validation',
		'error.category.validation',
		'infrastructure/persistence/mappers/assetPriceMapper.ts',
	],
	// The two calibration refusals a user can produce, on either surface. Both pre-date the
	// asset designer and had no entry in either locale for fifteen slices, so a refused
	// calibration resolved the `Calculation` category sentence — "A quantity could not be
	// calculated.", which names no point, no distance and nothing to do differently.
	//
	// `calibrationError` is a module-private factory, so these rows are copied from
	// `domain/plan/Calibration.ts`'s own literals like every other row here — the column names
	// that module for a reader, and it is a pointer rather than an instrument.
	//
	// The third code of that union, `calibration.invalid-distance`, is deliberately absent for
	// the reason slice 17 recorded when it WITHDREW a Definition of Done item about it:
	// `KnownDistanceForm` disables its submit unless the value parses positive and finite, so
	// no user can raise it. `calibration.degenerate-scale` is listed ONCE despite two raise
	// sites (`deriveCalibration`'s collapsed scale and `nonFiniteRescaleError`'s overflowed
	// product) — one code, one sentence, and `CalibrateAsset`'s finite-result guard is the
	// second of the two.
	['calibration.coincident-points', 'Calculation', 'error.category.calculation', 'domain/plan/Calibration.ts'],
	['calibration.degenerate-scale', 'Calculation', 'error.category.calculation', 'domain/plan/Calibration.ts'],
	// A failed compensation stops calling itself compensated (the trust-path increment). Both
	// arms, unlike a first draft of this branch that dropped the update one as unreachable
	// through `FakeVault`'s own failure mechanism at the time — `FakeVault.failOnHit` (a
	// counted failure targeting one occurrence of a key) is what let a test isolate the
	// restore from the update's own write, both of which write the SAME note path through
	// `modify`.
	[
		'zone.sidecar-insert-uncompensated',
		'Persistence',
		'error.category.persistence',
		'infrastructure/obsidian/repositories/ObsidianZoneRepository.ts',
	],
	[
		'zone.sidecar-update-uncompensated',
		'Persistence',
		'error.category.persistence',
		'infrastructure/obsidian/repositories/ObsidianZoneRepository.ts',
	],
	// The trust path's own gate (checkpoint C3): Validation on purpose, per that file's own
	// docblock, so a paused write settles the save indicator neutral rather than badging one.
	['editor.stale-write-refused', 'Validation', 'error.category.validation', 'presentation/editor/tools/with-stale-gate.ts'],
];

// Named for the shape rather than for a slice: the table below has carried codes from slices
// 10, 16 and 19, and a describe naming one of them reads as a scope the table does not have.
describe('coded refusals that carry copy of their own', () => {
	it.each(MINTED)('%s resolves its own copy rather than the %s category sentence', (code, category, categoryKey) => {
		const refusal = error({ category, code });

		expect(toUserMessage('en', refusal)).toBe(t('en', code as StringKey));
		expect(toUserMessage('en', refusal)).not.toBe(t('en', categoryKey));
		expect(toUserMessage('de', refusal)).not.toBe(t('de', categoryKey));
	});
});

/**
 * `trError` is `tr` for the error path. The mock's `getLanguage()` answers 'en', so this pins
 * the DELEGATION — that it resolves the language through the one resolution point and maps
 * through `toUserMessage` — and the per-locale behaviour is already driven through
 * `toUserMessage` directly, per locale, above.
 */
describe('trError', () => {
	it('maps an error in the app language', () => {
		// `refusal`, not `error`: this file's own `error()` factory is in scope, and shadowing it
		// fails `no-shadow` under `oxlint --deny-warnings`. The name matches the sibling case above.
		const refusal = { category: 'Persistence', code: 'settings.unrecovered', message: 'dev' } as const;

		expect(trError(refusal)).toBe(toUserMessage('en', refusal));
	});
});
