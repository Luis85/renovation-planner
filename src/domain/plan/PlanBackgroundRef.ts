/**
 * A reference to a Plan's background document — the Vault-relative path plus enough to
 * open it (kind, and a page for PDFs). Never the raw bytes: file access is slice 5,
 * persistence is slice 4. One background-reference type, not three.
 */
export type PlanBackgroundKind = 'image' | 'pdf';

export interface PlanBackgroundRef {
	readonly path: string;
	readonly kind: PlanBackgroundKind;
	/** Meaningful only when `kind` is `'pdf'`; absent otherwise. */
	readonly page?: number;
}
