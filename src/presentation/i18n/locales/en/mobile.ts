/**
 * What this plugin says on a mobile device, and the whole of it.
 *
 * TWO sentences for two different refusals, never one generic line: a supported surface stays
 * readable and says so where a write control would have been
 * (`docs/requirements/Bound the mobile surface to what it can actually do.md`, extension 4a),
 * and a desktop-only surface says it is not here at all (extension 2a). Collapsing them into one
 * would make "you can look" and "there is nothing here to look at" the same message.
 */
export const enMobile = {
	'view.mobile.read-only': 'Available for viewing on mobile. Changes need a desktop.',
	'view.mobile.desktop-only': 'This surface is not available on mobile. Open it on a desktop.',
} as const;
