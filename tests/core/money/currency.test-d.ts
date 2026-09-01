/**
 * The brand's ACCESS rule, which has no runtime form: a `Currency` can only be obtained
 * from a door that validated one. Two `@ts-expect-error` directives, and an unsatisfied
 * directive is itself a build error — so widening `Currency` back to `string` fails
 * `npm run build` here rather than passing quietly.
 *
 * What this deliberately does NOT prove: that a caller passed the RIGHT currency. See the
 * brand's own docblock in `Money.ts`.
 */
import { currencyOf, of, type Currency } from '../../../src/core/money/Money';

// @ts-expect-error — a bare string literal is not a validated Currency.
const fromLiteral: Currency = 'EUR';

// @ts-expect-error — nor is an arbitrary string.
const fromString: Currency = String('EUR');

// A Money's currency IS one, and a Currency is still usable as a string.
const fromMoney: Currency = of('1.00', 'EUR').currency;
const asString: string = currencyOf('GBP');

void fromLiteral;
void fromString;
void fromMoney;
void asString;
