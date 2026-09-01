/**
 * `expectedCurrency` is REQUIRED, which is a claim only the compiler can hold — a runtime
 * test cannot distinguish "omitted" from "omitted and defaulted". An unsatisfied
 * `@ts-expect-error` is itself a build error, so making the field optional fails
 * `npm run build` here.
 */
import { Decimal } from 'decimal.js';
import { computeEstimatedCost } from '../../../src/domain/cost/costPipeline';
import { currencyOf, of } from '../../../src/core/money/Money';

const quantity = { value: new Decimal('1'), unit: 'm2' } as const;

// @ts-expect-error — an input without expectedCurrency is not a CostPipelineInput.
void computeEstimatedCost({ quantity, unitPrice: of('1.00', 'EUR') });

// The complete input compiles.
void computeEstimatedCost({
	quantity,
	unitPrice: of('1.00', 'EUR'),
	expectedCurrency: currencyOf('EUR'),
});
