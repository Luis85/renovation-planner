// @vitest-environment jsdom
// The real composition imports native views. These are public command contracts,
// not browser interactions or host acceptance; every repository result is real.
import { afterEach, expect, it, vi } from 'vitest';
import { downstreamStack } from '../helpers/downstream';
import { expectDefined, expectErr, expectFound, expectOk } from '../helpers/domain';
import { createEntityId } from '../../src/core/identity/generateId';
import { of } from '../../src/core/money/Money';
import { createSupplier } from '../../src/domain/supplier/Supplier';
import type { Quote } from '../../src/domain/quote/Quote';
import { saveQuote } from '../../src/application/commands/quote/QuoteServices';
import { elementInput } from '../../src/presentation/editor/elements/elementInput';
import { CalibrateAssetCommand } from '../../src/application/commands/asset/CalibrateAsset';
import { deriveCalibration, validateCalibration } from '../../src/domain/plan/Calibration';
import { ReversibleCalibratePlanCommand } from '../../src/application/commands/plan/ReversibleCalibratePlan';
import { makePlan } from '../helpers/entities';

afterEach(() => { vi.restoreAllMocks(); });

it('rejects an invalid Quote title before repository access and preserves the existing valid offer', async () => {
	const rig = await downstreamStack();
	try {
		const supplier = expectOk(createSupplier(createEntityId('supplier'), 'Local flooring'));
		expectOk(await rig.persistence.suppliers.save(supplier, 'absent'));
		const quote: Quote = { id: createEntityId('quote'), projectId: rig.plan.projectId, supplierId: supplier.id,
			title: 'Floor quotation', issuedOn: '2026-09-07', status: 'draft',
			items: [{ id: 'floor-line', description: 'Floor preparation', amount: of('594', 'EUR'), assetIds: [rig.asset.id], work: [{ planId: rig.plan.id, workId: 'work-sand' }] }] };
		const saved = expectOk(await saveQuote(rig.persistence, { quote, expected: 'absent' }));
		const bytes = [...rig.stack.vault.entries];
		const read = vi.spyOn(rig.persistence.quotes, 'getById'), write = vi.spyOn(rig.persistence.quotes, 'save');
		const failure = expectErr(await saveQuote(rig.persistence, { quote: { ...quote, title: ' ' }, expected: saved.version }));
		expect(failure.code).toBe('quote.invalid');
		expect(read).not.toHaveBeenCalled();
		expect(write).not.toHaveBeenCalled();
		expect([...rig.stack.vault.entries]).toEqual(bytes);
		expect(expectFound(await rig.persistence.quotes.getById(quote.id))).toEqual(saved);
	} finally { rig.dispose(); }
});

it('rejects an empty spatial label before either document write while keeping the valid baseline intact', async () => {
	const rig = await downstreamStack();
	try {
		const baseline = expectOk(await rig.read());
		const element = { id: createEntityId('element'), name: 'Garden path', kind: 'path' as const, points: [{ x: 500, y: 500 }, { x: 2500, y: 500 }] };
		const input = elementInput(baseline, element);
		const spatial = expectDefined(input.spatial, 'spatial command input');
		const bytes = [...rig.stack.vault.entries];
		const planWrite = vi.spyOn(rig.deps.plans, 'save'), geometryWrite = vi.spyOn(rig.geometry, 'write');
		const result = await rig.renovation.command(baseline, { ...input, spatial: { ...spatial, metadata: [{ id: element.id, name: ' ' }] } }, rig.ledger).execute();
		expect(expectErr(result).code).toBe('plan.invalid-spatial-elements');
		expect(planWrite).not.toHaveBeenCalled();
		expect(geometryWrite).not.toHaveBeenCalled();
		expect([...rig.stack.vault.entries]).toEqual(bytes);
		const current = expectOk(await rig.read());
		expect(current.plan).toEqual(baseline.plan);
		expect(current.geometry).toEqual(baseline.geometry);
	} finally { rig.dispose(); }
});

it('refuses finite calibration picks whose rescaled endpoints overflow before creating an asset sidecar', async () => {
	const rig = await downstreamStack();
	try {
		const sidecar = rig.persistence.assetGeometry;
		const before = expectOk(await sidecar.read(rig.asset.id));
		const pointA = { x: 1e308, y: 0 }, pointB = { x: 1.1e308, y: 0 }, knownDistance = 1e308;
		const derived = expectOk(deriveCalibration(pointA, pointB, knownDistance, before.document.calibration));
		expect(Number.isFinite(derived.scaleCorrection)).toBe(true);
		expect(Number.isFinite(derived.calibration.pixelsPerWorldUnit)).toBe(true);
		const bytes = [...rig.stack.vault.entries], write = vi.spyOn(sidecar, 'write'), publish = vi.spyOn(rig.root.eventBus, 'publish');
		const command = new CalibrateAssetCommand({ sidecar, assets: rig.persistence.assets, events: rig.root.eventBus, locks: rig.persistence.locks });
		expect(expectErr(await command.execute({ assetId: rig.asset.id, pointA, pointB, knownDistance })).code).toBe('calibration.degenerate-scale');
		expect(write).not.toHaveBeenCalled();
		expect(publish).not.toHaveBeenCalled();
		expect(expectOk(await sidecar.read(rig.asset.id))).toEqual(before);
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	} finally { rig.dispose(); }
});

it('refuses coincident rescaled Plan endpoints after finite derivation without consuming the previous calibration Undo', async () => {
	const rig = await downstreamStack();
	try {
		const plan = makePlan({ projectId: rig.plan.projectId, name: 'Calibration boundary' });
		expectOk(await rig.deps.plans.save(plan, 'absent'));
		const empty = expectOk(await rig.geometry.read(plan.id));
		const first = new ReversibleCalibratePlanCommand(rig.deps.plans, rig.geometry, rig.deps.events);
		expectOk(await first.execute({ planId: plan.id, pointA: { x: 0, y: 0 }, pointB: { x: 1, y: 0 }, knownDistance: 1e308 }));
		const before = expectOk(await rig.geometry.read(plan.id));
		const calibration = expectDefined(before.document.calibration, 'real persisted first calibration');
		expectOk(validateCalibration(calibration));
		const pointA = { x: 0.6, y: 0 }, pointB = { x: 1.3, y: 0 }, knownDistance = Number.MIN_VALUE;
		const derived = expectOk(deriveCalibration(pointA, pointB, knownDistance, calibration));
		expect(derived.scaleCorrection).toBeGreaterThan(0);
		expect(Number.isFinite(derived.calibration.pixelsPerWorldUnit)).toBe(true);
		const bytes = [...rig.stack.vault.entries], write = vi.spyOn(rig.geometry, 'write'), publish = vi.spyOn(rig.deps.events, 'publish');
		const next = new ReversibleCalibratePlanCommand(rig.deps.plans, rig.geometry, rig.deps.events);
		expect(expectErr(await next.execute({ planId: plan.id, pointA, pointB, knownDistance })).code).toBe('plan.degenerate-points');
		expect(write).not.toHaveBeenCalled();
		expect(publish).not.toHaveBeenCalled();
		expect(expectOk(await rig.geometry.read(plan.id))).toEqual(before);
		expect([...rig.stack.vault.entries]).toEqual(bytes);
		expectOk(await first.undo());
		expect(write).toHaveBeenCalledOnce();
		expect(expectOk(await rig.geometry.read(plan.id)).document).toEqual(empty.document);
	} finally { rig.dispose(); }
});
