import { err, isErr, ok } from '../../../core/result/Result';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { AssetBackgroundRef } from '../../../domain/asset/Asset';
import { assetDesignChanged } from '../../../domain/asset/Asset.events';
import { assetError, assetNotFound } from '../../../domain/asset/Asset.errors';
import type { Command } from '../Command';
import { markUncompensated, plainDispatch, type DispatchResult, type VersionedDispatchResult } from '../DispatchOutcome';
import type { AssetGeometryDocument } from '../../ports/AssetGeometrySidecar';
import type { EntityVersion } from '../../ports/versioning';
import type { AssetShapeDeps } from './updateAssetShape';

/**
 * The extension → kind mapping this command validates a caller's claim against — its own copy
 * of `PlanBackgroundRef.backgroundKindFor` rather than an import of it: `domain/asset/` and
 * `domain/plan/` are two entities that happen to share this vocabulary today, and importing
 * across them would tie an asset's background to a plan's the moment the two diverge (the
 * same argument `AssetBackgroundRef`'s own docblock makes about the TYPE). A pure string
 * function costs nothing to keep twice; a cross-domain import costs a coupling neither entity
 * asked for.
 */
function backgroundKindOf(path: string): 'image' | 'pdf' | null {
	const name = path.slice(path.lastIndexOf('/') + 1);
	const dot = name.lastIndexOf('.');
	if (dot <= 0) return null;
	const extension = name.slice(dot + 1).toLowerCase();
	if (extension === 'png' || extension === 'jpg' || extension === 'jpeg') return 'image';
	if (extension === 'pdf') return 'pdf';
	return null;
}

function sameBackground(a: AssetBackgroundRef | null, b: AssetBackgroundRef | null): boolean {
	if (a === null || b === null) return a === b;
	return a.path === b.path && a.kind === b.kind && a.page === b.page;
}

/**
 * What one background-picking gesture supplies (Task B7).
 *
 * `kind` is a bare `string`, not `AssetBackgroundKind` — this is the untrusted-input door
 * (`parseCurrency`'s reasoning, applied to a second value type): a caller may be a hand-typed
 * fixture, a note nobody has read yet, or a picker that DID narrow it, and refusing an
 * unsupported kind is this command's job rather than a precondition on its input type. A
 * `BackgroundPicker` result satisfies this shape without narrowing, since its own `kind` is
 * already `'image' | 'pdf'`.
 */
export interface SetAssetBackgroundInput {
	readonly assetId: AssetId;
	readonly path: string;
	readonly kind: string;
	readonly page: number | null;
	/** The NOTE's version this gesture read, if the caller already has one (an undo does). */
	readonly expected?: EntityVersion;
}

/**
 * Point an asset's designer at the spec sheet it is drawn over, and clear the calibration
 * measured off whatever it pointed at before (Decision 5, Task B7).
 *
 * **Two resources, one gesture.** The reference lives in the NOTE (Task B7's Step 0 adds the
 * three frontmatter keys `planFrontmatter.ts` already models); the calibration lives in the
 * geometry SIDECAR. A stale calibration is worse than none: two points measured against the
 * OLD document would go on reporting a scale that names nothing about the new one, silently,
 * for every dimension the designer derives from it.
 *
 * **Order: clear the calibration first, then write the reference.** A failure between the two
 * writes leaves a surface that says it is uncalibrated — true, and recoverable by calibrating
 * again — where the reverse order leaves a NEW picture measured by the OLD document's scale,
 * which is a wrong answer that looks like a right one.
 *
 * **Compensate: if the note write then fails, restore the calibration that was just
 * cleared**, from the snapshot taken before clearing it. Without this, a failed background
 * change leaves the user on their OLD background with its perfectly valid calibration
 * destroyed, for a change that never happened — the write half refused and the read half
 * (the calibration) paid for it anyway.
 *
 * **A failed compensation is reported, not swallowed.** `markUncompensated` stamps the
 * returned refusal so the save-state indicator does not settle at `Saved` over a vault whose
 * calibration is gone — `DispatchOutcome`'s own account of `deleteResolution.ts`'s `compensate`
 * is the rule this command re-derives for a two-write gesture rather than a multi-entity one.
 */
export class SetAssetBackgroundCommand implements Command<SetAssetBackgroundInput, DispatchResult> {
	constructor(private readonly deps: AssetShapeDeps) {}

	execute(input: SetAssetBackgroundInput): Promise<DispatchResult> {
		return plainDispatch(this.executeWithVersion(input));
	}

	/**
	 * The reversible adapter's door: the same write, plus the NOTE version it produced — the
	 * resource `ReversibleAssetDesignCommands`'s spanning adapter conditions its own `expected`
	 * on, for the reason `SetAssetHeightCommand`'s sibling door already states.
	 */
	async executeWithVersion(input: SetAssetBackgroundInput): Promise<VersionedDispatchResult> {
		const { assets, sidecar, events } = this.deps;

		// The cheap refusal, before any read: a kind that does not match the path's own
		// extension is refused here rather than left to the domain, mirroring
		// `SetPlanBackgroundCommand` — a mislabeled or unsupported file would otherwise reach
		// the sidecar clear and the note write before failing at neither.
		const kind = backgroundKindOf(input.path);
		if (kind === null || kind !== input.kind) {
			return err(
				assetError('unsupported-background', `"${input.path}" is not a supported ${input.kind} background.`),
			);
		}

		const loaded = await assets.getById(input.assetId);
		if (isErr(loaded)) return loaded;
		if (loaded.value === null) return err(assetNotFound(input.assetId));
		const { entity: current, version: noteVersion } = loaded.value;

		const background: AssetBackgroundRef = { path: input.path, kind, page: input.page };
		// Validated (and re-validated: `Asset.create` never trusts the candidate that reaches
		// it) BEFORE either write, so a domain refusal — an empty path, an invalid page —
		// touches neither resource.
		const candidate = current.withChanges({ background });
		if (isErr(candidate)) return candidate;

		const snapshot = await sidecar.read(input.assetId);
		if (isErr(snapshot)) return snapshot;
		const { document, version: geometryVersion } = snapshot.value;

		// `ok` is not evidence that anything was written: re-submitting the reference this
		// asset already carries is a no-write REGARDLESS of whether a calibration is present —
		// Decision 5's whole reasoning is that a calibration dies when the document it measures
		// actually CHANGES, and an unchanged reference is not a change. Conditioning this on
		// `document.calibration === null` would clear and rewrite over an unchanged background
		// specifically when a valid calibration exists, destroying the one calibration this
		// guard exists to protect.
		if (sameBackground(candidate.value.background, current.background)) {
			return ok({ outcome: 'no-write' });
		}

		const cleared: AssetGeometryDocument = { ...document, calibration: null };
		const clearedWrite = await sidecar.write(input.assetId, cleared, geometryVersion);
		if (isErr(clearedWrite)) return clearedWrite;

		const saved = await assets.save(candidate.value, input.expected ?? noteVersion);
		if (isErr(saved)) {
			// Restore what was just cleared, from the snapshot taken before clearing it —
			// conditioned on the version the clearing write itself produced, never on a
			// read-back, for `VersionedDispatch`'s reason.
			const restored = await sidecar.write(input.assetId, document, clearedWrite.value);
			if (isErr(restored)) {
				return err(markUncompensated(saved.error));
			}
			return saved;
		}

		await events.publish(assetDesignChanged({ assetId: input.assetId }));
		// `secondaryVersion` is the SIDECAR's — `VersionedDispatch`'s own docblock states why a
		// two-write command reports both rather than leaving the second to a read-back: without
		// it, `ReversibleAssetBackgroundEdit` would condition its calibration restore on the
		// PRE-clear version, which the store has already moved past.
		return ok({ outcome: 'wrote', version: saved.value.version, secondaryVersion: clearedWrite.value });
	}
}
