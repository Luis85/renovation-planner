import type { DiagnosticsLedger } from '../../../src/application/ports/diagnostics';
import type { AppError } from '../../../src/core/errors/AppError';
import { createAssetId } from '../../../src/domain/asset/AssetId';

/**
 * `docs/tests/cases/Recover an asset design rather than lose it.md` step 30's D row: a note
 * deleted from Obsidian's file explorer leaves its `.rpgeo` sidecar behind — `VaultChangeAdapter`
 * only mutates the index and writes no files at all, so nothing removes the orphan — and the
 * step's own pass condition is that nothing tells the user, and NO DIAGNOSTIC names it either.
 *
 * That absence is structural rather than merely untested, at two doors:
 *
 * 1. `AssetGeometryStore` (`src/infrastructure/obsidian/repositories/AssetGeometryStore.ts`)
 *    takes a `Vault`, a `FileManager`, the library folder, an `EchoWindow` and a `ProjectIndex`
 *    slice in its constructor — no `DiagnosticsLedger` at all, so it has no door to record
 *    through even for a read it DOES attempt. `grep -n 'DiagnosticsLedger' src/infrastructure/
 *    obsidian/repositories/AssetGeometryStore.ts` prints nothing.
 * 2. Even a caller that DID hold a ledger has nowhere to name this kind of finding under:
 *    `DiagnosticEntityKind` (`src/application/ports/diagnostics.ts`) is a closed union with
 *    `'plan-geometry'` for the PLAN's sidecar and no `'asset-geometry'` counterpart for the
 *    asset's — the omission `CLAUDE.md`'s own account of this store names ("adding
 *    `asset-geometry` to that closed union widens the diagnostics snapshot — a decision this
 *    task does not own").
 *
 * This file pins door 2, compile-time, for `diagnostics.test-d.ts`'s own reason: "contains zero
 * project content" (and, here, "names no orphaned sidecar") is a claim about a shape that CAN
 * carry one, so a ledger built with nothing recorded in it would prove only that THIS file
 * recorded nothing — the forbidden thing has to be refused where a caller could attempt it,
 * which is the union member itself. `vue-tsc --noEmit` in `npm run build` is the mechanism: an
 * unsatisfied `@ts-expect-error` is itself an error, so `DiagnosticEntityKind` widened to admit
 * `'asset-geometry'` fails the build at the directive that no longer has anything to suppress.
 */

declare const ledger: DiagnosticsLedger;
declare const error: AppError;

const assetId = createAssetId();

// @ts-expect-error there is no 'asset-geometry' entity kind: the closed union has
// 'plan-geometry' for the OTHER sidecar and nothing for this one, so an orphaned `.rpgeo` has
// no diagnostic to be named under even in principle.
ledger.record('asset-geometry', assetId, error);
