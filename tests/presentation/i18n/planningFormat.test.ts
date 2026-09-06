import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { of } from '../../../src/core/money/Money';
import { formatPlanningMoney, formatPlanningNumber } from '../../../src/presentation/i18n/planningFormat';

describe('localized planning quantities and money', () => {
 it('formats decimal digits exactly, including huge quantities, negatives and trailing precision', () => {
  expect(formatPlanningNumber('123456789012345678901234567890.005', 'de')).toBe('123.456.789.012.345.678.901.234.567.890,005');
  expect(formatPlanningNumber('-1234.50', 'en')).toBe('-1,234.50');
  expect(formatPlanningNumber(new Decimal('0.000001'), 'de')).toBe('0,000001');
  expect(formatPlanningNumber('0', 'de')).toBe('0');
  expect(formatPlanningNumber('1234', 'unsupported')).toBe('1,234');
  expect(formatPlanningNumber('1e-7', 'de')).toBe('0,0000001');
 });
 it('finalizes with the existing decimal rounding and preserves explicit currency identity', () => {
  const euro = of('594.005', 'EUR'), before = euro.amount;
  expect(formatPlanningMoney(euro, 'de')).toBe('594,01 EUR');
  expect(formatPlanningMoney(of('1234.5', 'USD'), 'en')).toBe('1,234.50 USD');
  expect(formatPlanningMoney(of('-0.001', 'EUR'), 'de')).toBe('0,00 EUR');
  expect(euro.amount).toBe(before);
  expect(formatPlanningMoney(of('2', 'EUR'))).toBe('2.00 EUR');
  expect(formatPlanningNumber('2.5')).toBe('2.5');
 });
});
