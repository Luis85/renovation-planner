import type { ObservationToken } from '../../../application/ports/versioning';
import { observeFrontmatter } from '../../obsidian/repositories/digest';

/**
 * The short memory that keeps the vault-change pipeline from reprocessing this plugin's
 * own writes: Obsidian raises `modify` for them too, and a debounced pipeline that
 * cannot tell its own echo from a hand edit would race the writer it echoes.
 *
 * A path maps to the token of what THIS PLUGIN last wrote or last confirmed there.
 * `matches(path, token)` is the no-op test; `mark` records after a successful write;
 * `seed` records what a full scan saw. A change arriving whose freshly computed token
 * equals the recorded one is an echo; anything else — including a change that arrives
 * while the debounce window is still open from the write — is real and gets processed.
 */
export class EchoWindow {
	private readonly tokens = new Map<string, ObservationToken>();

	matches(path: string, token: ObservationToken): boolean {
		return this.tokens.get(path) === token;
	}

	mark(path: string, token: ObservationToken): void {
		this.tokens.set(path, token);
	}

	/** Convenience over `mark` for note-shaped content. */
	markFrontmatter(path: string, frontmatter: Record<string, unknown>): void {
		this.mark(path, observeFrontmatter(frontmatter));
	}

	forget(path: string): void {
		this.tokens.delete(path);
	}

	/** A rename moves the recorded bytes' token with the file. */
	move(oldPath: string, newPath: string): void {
		const token = this.tokens.get(oldPath);
		if (token === undefined) return;
		this.tokens.delete(oldPath);
		this.tokens.set(newPath, token);
	}
}
