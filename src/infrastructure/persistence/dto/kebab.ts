/**
 * The persisted vocabulary is the domain's, kebab-cased (SDD §38): the mapper is the only
 * thing standing between the two spellings, and a near-match set (`done` for `Complete`)
 * maps by coincidence until someone adds a fourth value. Both directions live here so no
 * mapper re-derives a casing rule.
 */
import { z } from 'zod';

export function toKebab(value: string): string {
	return value.replace(/_/g, '-').toLowerCase();
}

export function kebabEnum<T extends string>(vocabulary: readonly T[]) {
	return z
		.string()
		.transform((value, ctx): T => {
			// Casing and separators both normalize away: `in-progress`, `in_progress` and
			// `InProgress` are one value spelled three ways.
			const normalized = value.replace(/[^a-z0-9]/gi, '').toUpperCase();
			const parsed = vocabulary.find((candidate) => candidate.replace(/_/g, '').toUpperCase() === normalized);
			if (parsed === undefined) {
				ctx.addIssue({ code: 'custom', message: `"${value}" is not in the persisted vocabulary.` });
				return z.NEVER;
			}
			return parsed;
		});
}
