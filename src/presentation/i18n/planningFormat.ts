import { round, type Money } from '../../core/money/Money';
import { Decimal } from 'decimal.js';
import { currentLanguage } from './strings';

/** Presentation only: decimal digits never pass through a binary floating-point amount. */
export function formatPlanningNumber(value: string | Decimal, language = currentLanguage()): string {
 const text = typeof value === 'string' ? value : value.toFixed();
 const literal = /[eE]/.test(text) ? new Decimal(text).toFixed() : text;
 const [integer, fraction] = literal.split('.');
 const german = language === 'de', sign = integer.startsWith('-') ? '-' : '';
 const digits = sign ? integer.slice(1) : integer;
 const groups: string[] = [];
 for (let end = digits.length; end > 0; end -= 3) groups.unshift(digits.slice(Math.max(0, end - 3), end));
 return sign + groups.join(german ? '.' : ',') + (fraction === undefined ? '' : (german ? ',' : '.') + fraction);
}
export function formatPlanningMoney(value: Money, language = currentLanguage()): string {
 return formatPlanningNumber(round(value).amount, language) + ' ' + value.currency;
}
