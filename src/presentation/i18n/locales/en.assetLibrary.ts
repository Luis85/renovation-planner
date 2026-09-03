/**
 * The Asset library's own copy, split out of `en.ts` rather than appended to it.
 *
 * `en.ts` had 29 lines of `max-lines` headroom left and this surface's §8 inventory is 58
 * keys — spreading it in here rather than inline is the extraction CLAUDE.md's own rule asks
 * for ("a budget bought back by reformatting is a budget already spent … the answer is an
 * extraction"), not a second source of truth: `en.ts` spreads `enAssetLibrary` into the one
 * `en` object `StringKey` derives from, so there is still exactly one place a key is declared.
 *
 * This file is itself an "English locale module" by the obsidianmd sentence-case rule's own
 * filename regex (`en(?:[._-][^/]+)?\.ts$`), so `en.assetLibrary.ts` is linted for sentence
 * case exactly as `en.ts` is — the split does not exempt this copy from that gate.
 *
 * Every key here is copied from design "Asset library overview" §8's own list, key by key —
 * that list is exhaustive for visible copy, and a builder is not to invent, rename or omit
 * one. Where §8 names a state but not its wording, the comment beside the key says so.
 */
export const enAssetLibrary = {
	'view.asset-library.title': 'Asset library',
	'command.open-asset-library': 'Open asset library',
	'view.asset-library.search.label': 'Search assets',
	'view.asset-library.search.placeholder': 'Search by name, supplier or item number',
	// §6.1's live region: '12 matching assets', announced so a search's effect reaches a
	// keyboard or screen-reader user who cannot see the list it just filtered.
	'view.asset-library.search.results': '{count} matching assets',
	'view.asset-library.unselected': 'Nothing selected.',
	// The status bar (§3.6): '54 assets · Renovation/Library'. The folder half is a vault
	// path, not copy, so it is appended as raw text beside this key rather than through a
	// second one.
	'view.asset-library.assets': '{count} assets',
	'view.asset-library.used-in': 'Used in',
	'view.asset-library.used-in.none': 'Not used in any project',
	'view.asset-library.used-in.project': '{name} — {count} requirement(s)',
	// §3.5's *Used in* row label for a project whose `Project.md` sits at the vault root,
	// where `projectFolderOf` derives `''` (§3.5, "the empty string renders a root label
	// rather than nothing"). An empty string is not something a row can print, so this names
	// the case in words.
	'view.asset-library.used-in.vault-root': 'Vault root',
	'view.asset-library.open-designer': 'Open designer',
	'view.asset-library.open-note': 'Open note',
	// §6.2's narrow-composition control, quoted verbatim from the spec.
	'view.asset-library.back': 'Back to library',
	'view.asset-library.delete': 'Delete',
	'view.asset-library.shape': 'Shape',
	'view.asset-library.footprint': 'Footprint',
	'view.asset-library.clearance': 'Clearance',
	'view.asset-library.spec-sheet': 'Spec sheet',
	// The generic absent-value word for a nullable Shape-section row — §3.5's own Clearance
	// table gives its Absent cell as `None`, quoted verbatim.
	'view.asset-library.none': 'None',
	'view.asset-library.shape.loading': 'Loading shape…',
	// §3.5's Shape-section refusal table is keyed on the CODE, never on the union arm.
	// `asset.not-found` here is narrower than the panel-level `asset-gone` below: this is the
	// shape read alone finding no such asset, while `asset-gone` is a selection that resolves
	// to no catalogue entry at all (Definition included).
	'view.asset-library.shape.gone': 'This asset no longer exists.',
	// Every other `asset-geometry.*` refusal, and every domain `asset.*`/`calibration.*` code
	// from a sidecar that parsed but failed validation, both name the sidecar via the read
	// model's own `sidecarPath` (§3.5) — which is why this is the one shape-section key that
	// carries a hole.
	'view.asset-library.shape.read-failed': 'This asset’s shape could not be read: {path}',
	// §3.5's per-coordinate-group pending warning for Clearance. The Footprint's own warning
	// is deliberately NOT a new key here: it reuses `designer.inspector.dimensions.unscaled`,
	// since both surfaces ask about the identical fact — a footprint traced before this asset
	// had a scale — and a second translation of one sentence is a second place for the two to
	// drift apart.
	'view.asset-library.clearance.unscaled':
		'This clearance was traced before a scale existed, so this number is not a real measurement yet.',
	'view.asset-library.loading': 'Loading assets…',
	// §4's "Some unreadable" strip headline, counted like `editor.some-zones-unreadable` and
	// `view.project.some-plans-unreadable` rather than left as "some": the count is what
	// tells a user "one bad note" from "the whole library".
	'view.asset-library.some-unreadable':
		'{count} asset note(s) could not be read. Open the diagnostics report to see which notes refused.',
	'view.asset-library.some-unreadable.open-note': 'Open note',
	// The strip's per-row reason (§5.1a's `UnreadableReason`, plus the future-schema code §4
	// carves out of `read-failed` because its remedy differs — upgrading the plugin, not
	// editing the note — which is also why `Open note` is withheld for exactly this one, per
	// §4's own rule that an action that cannot work is worse than no action).
	'view.asset-library.unreadable.read-failed': 'Could not be read',
	'view.asset-library.unreadable.no-id': 'No id',
	'view.asset-library.unreadable.duplicate-id': 'Duplicate id',
	'view.asset-library.unreadable.future-schema': 'Written by a newer plugin version',
	// The panel-level Definition-section state (§3.5): the selected id IS in `unreadable`,
	// with a repairable code. Distinct from `shape.read-failed` above, which is the sidecar
	// failing while the note itself read fine.
	'view.asset-library.note-unreadable': 'This asset’s note could not be read: {path}',
	// The panel-level state for a selected id in NEITHER `entries` nor `unreadable` — the
	// asset is simply gone. Narrower than `shape.gone`: §3.5's own table gives this row no
	// way back to the shape or used-in sections, only "a way back" to the list.
	'view.asset-library.asset-gone': 'This asset no longer exists.',
	'view.asset-library.shape.unusable-id':
		'This asset’s id cannot name a shape file, so no shape can be stored for it.',
	'view.asset-library.shape.extent-overflow': 'This shape is too large to measure.',
	'view.asset-library.failed.headline': 'Assets could not be loaded',
	'view.asset-library.new-asset': 'New asset',
	// §6.1: the flat list a search collapses every shelf into.
	'view.asset-library.results': 'Results',
	'view.asset-library.category': 'Category',
	'view.asset-library.unit': 'Unit',
	'view.asset-library.unit-cost': 'Unit cost',
	'view.asset-library.waste': 'Waste',
	'view.asset-library.supplier': 'Supplier',
	'view.asset-library.sku': 'SKU',
	'view.asset-library.height': 'Height',
	'view.asset-library.notes': 'Notes',
	// §3.4's row mark, described in words beside the (`aria-hidden`) drawing it sits next to.
	// Four of the mark's five states get a word here; the fifth, measured, needs none — its
	// extent alone, printed plainly, is what the other four are stated against.
	'view.asset-library.shape.none': 'No footprint',
	'view.asset-library.shape.unscaled': 'Unscaled footprint',
	'view.asset-library.shape.pending': 'Footprint not yet read',
	'view.asset-library.shape.unreadable': 'Footprint could not be read',
	'view.asset-library.used-in.loading': 'Loading where this is used…',
	// The reason on the disabled `Delete` control while the usage read has not succeeded
	// (§3.5): an edit stays available, because a price correction is recoverable and only
	// the destructive gesture is withheld.
	'view.asset-library.used-in.failed':
		'Where this is used could not be checked, so deleting it is unavailable.',
	// §4's two empty states. `noAssets` hands off to `New asset`, which CREATES something;
	// `noMatches` hands off to clearing the search field, which RESTORES the previous view —
	// an action that created something from a no-matches state would be the wrong gesture.
	'empty.asset-library.no-assets.headline': 'No assets yet',
	'empty.asset-library.no-assets.body':
		'An asset is a material, fixture, plant or piece of furniture you price once and use across every project. Create one to start the library.',
	'empty.asset-library.no-assets.action': 'New asset',
	'empty.asset-library.no-matches.headline': 'No matching assets',
	'empty.asset-library.no-matches.body':
		'No asset matches that search. Try a different name, supplier or item number.',
	'empty.asset-library.no-matches.action': 'Clear search',
} as const;
