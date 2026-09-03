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
