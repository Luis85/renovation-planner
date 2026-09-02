import { err, type Result } from '../../core/result/Result';
import { currencyOf, type Currency } from '../../core/money/Money';
import type { AppError, PersistenceError } from '../../core/errors/AppError';
import type { CreateAssetInput } from '../../application/commands/asset/CreateAsset';
import type { SetAssetFootprintFromDimensionsInput } from '../../application/commands/asset/SetAssetFootprint';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import type { Asset } from '../../domain/asset/Asset';
import type { Command } from '../../application/commands/Command';
import type { CreatePlanError, CreatePlanInput } from '../../application/commands/plan/CreatePlan';
import type { CreateProjectInput } from '../../application/commands/project/CreateProject';
import type {
	SetAssetPriceOverrideErrors,
	SetAssetPriceOverrideInput,
	SetAssetPriceOverrideResult,
} from '../../application/commands/asset-price/SetAssetPriceOverride';
import type {
	ClearAssetPriceOverrideErrors,
	ClearAssetPriceOverrideInput,
	ClearAssetPriceOverrideResult,
} from '../../application/commands/asset-price/ClearAssetPriceOverride';
import type { Logger } from '../../application/ports/Logger';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import type { Loaded } from '../../application/ports/versioning';
import type { Plan } from '../../domain/plan/Plan';
import type { Project } from '../../domain/project/Project';

export type CreateProjectResult = Result<{ project: Loaded<Project> }, RepositoryError>;

/**
 * `CreatePlanError` rather than `RepositoryError`: `CreatePlanCommand` refuses a project that
 * is not there with a `ReferenceError` of its own, which is the one refusal `NewPlanForm`
 * treats as neither a field nor a banner. Widening the alias here is what keeps that code
 * inside the type the form narrows on.
 *
 * EXPORTED, like `CreateProjectResult` above, and the asymmetry it replaces was arbitrary:
 * neither alias has an importer outside this file, and both are named by an exported
 * signature. `private-type-leaks` was `warn` when this was written and became `error` on
 * `main`, so the merge is what surfaced it. Exporting rather than suppressing, because the two
 * cases that must NOT be exported have a reason (`Routed`'s unique-symbol access lock,
 * `ReversibleOverrideBase` trading its leak for an unused export) and this one has none —
 * measured: analyze reports no unused export for either alias afterwards.
 */
export type CreatePlanResult = Result<{ plan: Loaded<Plan> }, CreatePlanError>;

/**
 * The price section's two dispatch results, aliased here for the same reason the two above are:
 * both are named by an exported signature, and `private-type-leaks` is an `error`.
 */
export type SetAssetPriceResult = Result<SetAssetPriceOverrideResult, SetAssetPriceOverrideErrors>;
export type ClearAssetPriceResult = Result<ClearAssetPriceOverrideResult, ClearAssetPriceOverrideErrors>;

/**
 * The write side of the Renovation Project view — the mirror of
 * `RenovationProjectQueryServices`, and the same bargain `PlanEditorCommandServices` makes:
 * application-layer interfaces handed to presentation, composed and GUARDED at the root,
 * never a repository the view built.
 *
 * Typed structurally (`Command<I, Result<T, E>>`) rather than as the concrete class, because
 * what leaves the root is a `guardCommand` wrapper with the same `execute` — a field typed as
 * the class would be a lie the compiler would then have to be argued out of.
 */
export interface RenovationProjectCommandServices {
	readonly createProject: Command<CreateProjectInput, CreateProjectResult>;
	/**
	 * Design slice 21's detail state, which is the first surface with a Plan to create from.
	 * REQUIRED, like its sibling: an optional member would let a composition forget it and
	 * still compile, which is the self-declared shape this repository refuses everywhere else.
	 */
	readonly createPlan: Command<CreatePlanInput, CreatePlanResult>;
	/**
	 * The project's own price section — the affordance that turns `cost.currency-mismatch` from
	 * a dead end into something a user can act on.
	 *
	 * REQUIRED, like both siblings above and for the same stated reason: an optional member
	 * would let a composition forget it and still compile, and this bundle is the ONLY write
	 * boundary `ProjectDetailState` has. Without these two the section renders and dispatches
	 * nothing — the live control that does nothing, which slice 14's own amendment refuses.
	 */
	readonly setAssetPriceOverride: Command<SetAssetPriceOverrideInput, SetAssetPriceResult>;
	readonly clearAssetPriceOverride: Command<ClearAssetPriceOverrideInput, ClearAssetPriceResult>;
	/**
	 * Design slice A10's creation form, and the pair of doors its submit is a SEQUENCE over.
	 *
	 * **They sit on THIS bundle rather than on a catalogue view's, because there is no
	 * catalogue view.** An Asset is vault-wide since design slice 19 — a catalogue entry
	 * carries no project id at all — so the surface that owns it is the vault-level one, which
	 * is this view's LIST state. When Epic 6's catalogue arrives these two move to it; until
	 * then, putting them anywhere else would mean inventing a second Vue app or a second
	 * dialog host, which is a slice rather than a wiring.
	 *
	 * REQUIRED, like both members above: an optional member would let a composition forget one
	 * and still compile, which is the self-declared shape this repository refuses everywhere.
	 */
	readonly createAsset: Command<CreateAssetInput, Result<Asset, AppError>>;
	/**
	 * The second half of that sequence, and the reason it is a separate member rather than
	 * something the form composes: it is a guarded door of `GuardedAssetDesignServices`, whose
	 * whole bundle belongs to the designer view Phase B builds. Handing the form the one door
	 * it uses is what keeps this bundle from becoming a second spelling of that one.
	 */
	readonly setAssetFootprintFromDimensions: Command<SetAssetFootprintFromDimensionsInput, DispatchResult>;
	/**
	 * The composition root's logger, reaching this view — the same member
	 * `PlanEditorCommandServices` carries, for the same reason and with the same limit.
	 *
	 * Presentation has no logger of its own and this changes nothing about that: it is one more
	 * thing the root hands down. `NewProjectForm` needs it because `useFormCommit` has a door no
	 * guard stands behind (a dispatch that THROWS), where the unmapped cause is the only detail
	 * that exists at all.
	 */
	readonly logger: Logger;
	/**
	 * The plugin's `defaultCurrency` setting, for the creation form's prefill. `CreateProject`
	 * takes it at the composition root; `CreateAsset` takes its currency from its input, so the
	 * FORM is where an asset's default is decided, and a literal there re-denominated every
	 * new asset in a vault configured otherwise.
	 */
	readonly defaultCurrency: Currency;
}

const noop = (): void => undefined;

function persistenceFailure(): PersistenceError {
	return {
		category: 'Persistence',
		code: 'settings.unrecovered',
		message: 'Settings could not be read, so nothing can be written.',
	};
}

/**
 * The write side for a session whose settings could not be recovered.
 *
 * A refusal bundle is the honest stand-in ONLY where the real thing would also have nothing
 * to give, and that holds here: every member is a write, and without the settings there is no
 * default projects root under which `freshProjectFolder` could place a new project's folder.
 * The composition root's own comment names this exact door as the reason it composes no stack
 * at all in that state.
 */
export function unavailableRenovationProjectCommands(): RenovationProjectCommandServices {
	return {
		createProject: {
			execute(): Promise<CreateProjectResult> {
				return Promise.resolve(err(persistenceFailure()) as CreateProjectResult);
			},
		},
		// ONE refusal function behind both, so the shared `settings.unrecovered` code cannot
		// drift into two spellings of the same state.
		createPlan: {
			execute(): Promise<CreatePlanResult> {
				return Promise.resolve(err(persistenceFailure()) as CreatePlanResult);
			},
		},
		// Both price doors through the SAME `persistenceFailure()` the pair above share, so
		// `settings.unrecovered` cannot drift into two spellings of one state. Nothing makes
		// these two a compile error — the interface being required makes the declaration and
		// the root binding build failures, and this function is the entry a composition can
		// quietly leave refusing wrongly.
		setAssetPriceOverride: {
			execute(): Promise<SetAssetPriceResult> {
				return Promise.resolve(err(persistenceFailure()) as SetAssetPriceResult);
			},
		},
		clearAssetPriceOverride: {
			execute(): Promise<ClearAssetPriceResult> {
				return Promise.resolve(err(persistenceFailure()) as ClearAssetPriceResult);
			},
		},
		// Design slice A10's pair. Both are writes, so the refusal bundle is the honest
		// stand-in for exactly the reason the docblock above gives — and `createAsset` in
		// particular has nowhere to write to: without settings there is no library folder for
		// the catalogue note to land in, which is `freshProjectFolder`'s own argument one
		// entity across.
		createAsset: {
			execute(): Promise<Result<Asset, AppError>> {
				return Promise.resolve(err(persistenceFailure()));
			},
		},
		setAssetFootprintFromDimensions: {
			execute(): Promise<DispatchResult> {
				return Promise.resolve(err(persistenceFailure()));
			},
		},
		// A logger member that records nothing, exactly as `unavailablePlanEditorCommands`'s
		// does: this bundle's only failure is the refusal above, which is a resolved `Result`
		// rather than a fault, so there is nothing here for a real logger to be told about.
		logger: { debug: noop, info: noop, warn: noop, error: noop },
		// The refusal bundle writes nothing, so its prefill is never persisted; a valid code is
		// all the form needs.
		defaultCurrency: currencyOf('EUR'),
	};
}
