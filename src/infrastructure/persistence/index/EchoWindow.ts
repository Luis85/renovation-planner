import type { ObservationToken } from '../../../application/ports/versioning';
import { observeFrontmatter } from '../../obsidian/repositories/digest';

/**
 * The short memory that keeps the vault-change pipeline from reprocessing this plugin's
 * own writes: Obsidian raises `modify` for them too, and a debounced pipeline that
 * cannot tell its own echo from a hand edit would race the writer it echoes.
 *
 * A path maps to the token of what THIS PLUGIN last wrote or last confirmed there.
 * `matches(path, token)` is the no-op test and `mark` records after a successful write;
 * the full scan records what it saw through `markFrontmatter`, the same entry point the
 * note writers use, rather than a `seed` of its own. A change arriving whose freshly
 * computed token equals the recorded one is an echo; anything else — including a change
 * that arrives while the debounce window is still open from the write — is real and gets
 * processed.
 *
 * **It also KEEPS the frontmatter it is handed, not only that frontmatter's digest**, and
 * `frontmatterAt` is why: Obsidian populates its `MetadataCache` asynchronously, so a note
 * read back in the same tick it was created has no cache entry at all, and `frontmatterOf`
 * needs somewhere truthful to fall back to. This class is already exactly that — "what
 * this plugin last wrote here" — with the lifecycle a fallback needs already built: marked
 * on every successful write, forgotten on delete, moved on rename. Keeping the content
 * makes the token DERIVED from it rather than a second memory of the same fact.
 *
 * The cost, stated because it is real: a small object per note path instead of one string.
 * Frontmatter is a handful of scalars and a renovation vault holds tens of these notes, so
 * this is not a cache with an eviction policy and must not grow into one — the map is
 * bounded by the notes this plugin has written or scanned in one session.
 */
export class EchoWindow {
	private readonly tokens = new Map<string, ObservationToken>();
	private readonly notes = new Map<string, Record<string, unknown>>();

	matches(path: string, token: ObservationToken): boolean {
		return this.tokens.get(path) === token;
	}

	mark(path: string, token: ObservationToken): void {
		this.tokens.set(path, token);
	}

	/**
	 * `mark` for note-shaped content, retaining the frontmatter as well as its token. Not
	 * a mere convenience wrapper any more, which is why the sidecar writers still call
	 * `mark`: a `.rpgeo` document is not frontmatter and nothing reads one back through
	 * `frontmatterOf`.
	 */
	markFrontmatter(path: string, frontmatter: Record<string, unknown>): void {
		this.mark(path, observeFrontmatter(frontmatter));
		this.notes.set(path, { ...frontmatter });
	}

	/**
	 * The frontmatter this plugin last wrote at `path`, for a reader whose metadata cache
	 * has nothing yet. A COPY was taken on the way in, so a caller mutating what it wrote
	 * cannot rewrite this record after the fact.
	 */
	frontmatterAt(path: string): Record<string, unknown> | undefined {
		return this.notes.get(path);
	}

	forget(path: string): void {
		this.tokens.delete(path);
		this.notes.delete(path);
	}

	/** A rename moves the recorded bytes' token — and their content — with the file. */
	move(oldPath: string, newPath: string): void {
		const token = this.tokens.get(oldPath);
		if (token === undefined) return;
		this.tokens.delete(oldPath);
		this.tokens.set(newPath, token);
		const note = this.notes.get(oldPath);
		if (note !== undefined) {
			this.notes.delete(oldPath);
			this.notes.set(newPath, note);
		}
	}
}
