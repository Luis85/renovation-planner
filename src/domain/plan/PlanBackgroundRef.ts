/**
 * A reference to a Plan's background document — the Vault-relative path plus enough to
 * open it (kind, and a page for PDFs). Never the raw bytes: file access is slice 5,
 * persistence is slice 4. One background-reference type, not three.
 */
export type PlanBackgroundKind = 'image' | 'pdf';

export const PLAN_BACKGROUND_KINDS: readonly PlanBackgroundKind[] = ['image', 'pdf'];

export interface PlanBackgroundRef {
	readonly path: string;
	readonly kind: PlanBackgroundKind;
	/** Meaningful only when `kind` is `'pdf'`; absent otherwise. */
	readonly page?: number;
}

/**
 * The file formats SDD §54 names — PNG, JPEG, PDF — as the extension → kind mapping.
 *
 * Here rather than beside the file picker that reads a Vault, because it is the same
 * question this module already answers ("what can a background BE"), and because two
 * answers to it is how a picker comes to offer a file the command then refuses. A pure
 * string function: `domain/` stays host-free, and nothing here touches a file.
 */
const BACKGROUND_KIND_BY_EXTENSION: Readonly<Record<string, PlanBackgroundKind>> = {
	png: 'image',
	jpg: 'image',
	jpeg: 'image',
	pdf: 'pdf',
};

export const BACKGROUND_EXTENSIONS: readonly string[] = Object.keys(BACKGROUND_KIND_BY_EXTENSION);

/** `null` for a path this plugin cannot render as a background. */
export function backgroundKindFor(path: string): PlanBackgroundKind | null {
	// The FILENAME, not the whole path: a leading dot marks a dotfile, and `.png` is a file
	// called `.png` rather than a PNG. Comparing against the path's own first character
	// instead catches that only at the vault root — `Plans/.pdf` slipped through and was
	// offered in the picker as a PDF.
	const name = path.slice(path.lastIndexOf('/') + 1);
	const dot = name.lastIndexOf('.');
	if (dot <= 0) return null;
	return BACKGROUND_KIND_BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? null;
}
