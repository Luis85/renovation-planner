import { normalizePath, TFile, type Vault } from 'obsidian';
import type { VaultFileProbe } from '../../../application/ports/VaultFileProbe';

/**
 * `VaultFileProbe` against a real Vault.
 *
 * `normalizePath` first, always: the path this is asked about came from a Plan's
 * frontmatter or from a picker, and both are places a user can type. Obsidian's index is
 * keyed by the normalized form, so an un-normalized lookup answers "missing" for a file
 * that is plainly there — one of the recurring plugin review rejections and a defect that
 * only shows up on the platform whose separators differ.
 *
 * `instanceof TFile` and not a null check: `getAbstractFileByPath` answers folders too,
 * and a FOLDER named `plan.pdf` is not a background. That is why this port asks about a
 * file rather than about a path existing.
 */
export function createVaultFileProbe(vault: Vault): VaultFileProbe {
	return {
		fileExists(path: string): boolean {
			return vault.getAbstractFileByPath(normalizePath(path)) instanceof TFile;
		},
	};
}
