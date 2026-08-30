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
	private readonly superseded = new Map<string, ObservationToken>();

	matches(path: string, token: ObservationToken): boolean {
		return this.tokens.get(path) === token;
	}

	mark(path: string, token: ObservationToken): void {
		this.tokens.set(path, token);
	}

	/**
	 * Has this plugin written at `path` at all — the question `matches` answers precisely
	 * and this one answers cheaply.
	 *
	 * For a caller that cannot compute a digest: the geometry sidecars are JSON in a FILE,
	 * so digesting one means reading it, and `VaultChangeAdapter` is synchronous. It is a
	 * weaker claim and the caller says what the weakness costs it.
	 */
	knows(path: string): boolean {
		return this.tokens.has(path);
	}

	/**
	 * `mark` for note-shaped content, retaining the frontmatter as well as its token. Not
	 * a mere convenience wrapper any more, which is why the sidecar writers still call
	 * `mark`: a `.rpgeo` document is not frontmatter and nothing reads one back through
	 * `frontmatterOf`.
	 *
	 * `supersedes` is the token of the frontmatter Obsidian's metadata cache answered
	 * IMMEDIATELY BEFORE this write, and it is what bounds `frontmatterOf`'s stale-cache
	 * fallback to the window it belongs in — see that function. A caller that has no such
	 * reading passes none: an insert has no prior entry, and the load-time scan is reading
	 * the cache rather than racing it.
	 */
	markFrontmatter(path: string, frontmatter: Record<string, unknown>, supersedes?: ObservationToken): void {
		this.mark(path, observeFrontmatter(frontmatter));
		this.notes.set(path, { ...frontmatter });
		if (supersedes === undefined) this.superseded.delete(path);
		else this.superseded.set(path, supersedes);
	}

	/**
	 * What the metadata cache was showing for `path` just before this plugin last wrote
	 * there, or `undefined` if that is not known.
	 *
	 * A cache still answering exactly this has not been re-parsed since — the parse-lag
	 * window. A cache answering anything else has moved on, whether because it caught up
	 * with our write or because somebody edited the note, and in both of those the cache is
	 * the authority. That is the whole discrimination, and it is why this is a TOKEN of the
	 * pre-write reading rather than a revision or a timestamp: a revision cannot tell a
	 * lagging cache from a hand edit that dropped the key.
	 */
	supersededToken(path: string): ObservationToken | undefined {
		return this.superseded.get(path);
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
		this.superseded.delete(path);
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
		const supersedes = this.superseded.get(oldPath);
		if (supersedes !== undefined) {
			this.superseded.delete(oldPath);
			this.superseded.set(newPath, supersedes);
		}
	}
}
