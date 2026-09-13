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

/** Casing and separators both normalize away: `in-progress`, `in_progress` and `InProgress` are one value spelled three ways. */
const normalize = (value: string): string => value.replace(/[^a-z0-9]/gi, '').toUpperCase();

export function kebabEnum<T extends string>(vocabulary: readonly T[]) {
	return z
		.string()
		.transform((value, ctx): T => {
			// ONE rule for both sides. The vocabulary used to lose only `_`, so a member the DOMAIN spells with a
			// hyphen (`building-element`) kept it, matched nothing, and every asset in that category was refused at
			// its own pre-write read-back — `asset.pre-write-invalid`, found in a live vault.
			const normalized = normalize(value);
			const parsed = vocabulary.find((candidate) => normalize(candidate) === normalized);
			if (parsed === undefined) {
				ctx.addIssue({ code: 'custom', message: `"${value}" is not in the persisted vocabulary.` });
				return z.NEVER;
			}
			return parsed;
		});
}
