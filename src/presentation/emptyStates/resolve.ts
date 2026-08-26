import { tr } from '../i18n/strings';
import type { EmptyStateContent } from './content';

/**
 * What `EmptyState.vue` takes: strings that are already resolved.
 *
 * The component knows nothing about i18n, which is what keeps it reusable by a future view —
 * or a test — whose copy comes from somewhere else. It is the same division slice 15's dialog
 * framework settled on: a user-facing string in a descriptor is resolved by the CALLER.
 */
export interface EmptyStateProps {
	readonly headline: string;
	readonly body: string;
	readonly actionLabel?: string;
}

/**
 * The ONE place a registry entry's keys become strings.
 *
 * `tr`, not `t`: the app language is resolved per call from Obsidian's own `getLanguage()`,
 * which is what keeps a rendered-per-open surface correct after the user changes it. A cached
 * language, or a language setting of this plugin's own, is a recurring marketplace review
 * rejection.
 *
 * `actionLabel` stays ABSENT rather than becoming an empty string when the entry has none:
 * the component branches on `!== undefined` to decide whether a button exists at all, and
 * `''` would render a nameless button — which is both a live control that does nothing and an
 * axe `button-name` violation.
 */
export function resolveEmptyState(content: EmptyStateContent): EmptyStateProps {
	return {
		headline: tr(content.headline),
		body: tr(content.body),
		...(content.actionLabel === undefined ? {} : { actionLabel: tr(content.actionLabel) }),
	};
}
