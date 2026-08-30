import type { ObservationToken } from '../../../application/ports/versioning';
import { observeFrontmatter } from '../../obsidian/repositories/digest';

/**
 * What a writer observed around its own write, for `frontmatterOf`s two-part test.
 *
 * Both halves are taken at different MOMENTS and that is why this is a pair rather than one
 * value: `reading` is the cache BEFORE the write, `stat` is the file AFTER it.
 */
export interface CacheObservation {
	/** What `MetadataCache` answered for this path immediately before the write. */
	readonly reading: ObservationToken | undefined;
	/** The file own mtime and size immediately after the write, as one comparable string. */
	readonly stat: string | undefined;
}

const EMPTY: ReadonlySet<ObservationToken> = new Set();

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
	private readonly superseded = new Map<string, Set<ObservationToken>>();
	private readonly fileStat = new Map<string, string>();

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
	 * `observed` is what bounds `frontmatterOf`'s stale-cache fallback to the window it
	 * belongs in, and it carries TWO readings because that fallback has to answer two
	 * questions no single comparison can (see that function):
	 *
	 * - `reading` — what the metadata cache answered IMMEDIATELY BEFORE this write. It joins
	 *   the set of states that are ours and superseded, together with whatever we had written
	 *   there before, so a cache that catches up with an INTERMEDIATE write of ours is still
	 *   recognised as behind. Comparing against the latest reading alone missed exactly that,
	 *   which is the second of the two P1s a review of this mechanism found.
	 * - `stat` — the FILE's own mtime and size immediately AFTER this write. A cache token
	 *   cannot see an external edit at all: an unparsed edit is by definition invisible to
	 *   the cache, so a hand edit landing inside the window left the cache still showing the
	 *   pre-plugin state, the fallback recognised that state as ours, and served our bytes
	 *   over somebody else's newer ones. That was the first P1, and it was a REGRESSION: the
	 *   stale cached revision used to refuse the next save, and the fallback turned that
	 *   refusal into a silent overwrite.
	 *
	 * A caller with no such readings passes none — an insert has no prior cache entry, and
	 * the load-time scan is reading the cache rather than racing it — and the fallback is
	 * then simply not offered for that path.
	 */
	markFrontmatter(path: string, frontmatter: Record<string, unknown>, observed?: CacheObservation): void {
		// BEFORE `mark`, which overwrites it: what we had written here previously is a state
		// the cache may still be about to parse.
		const previous = this.tokens.get(path);
		this.mark(path, observeFrontmatter(frontmatter));
		this.notes.set(path, { ...frontmatter });

		if (observed === undefined) {
			this.superseded.delete(path);
			this.fileStat.delete(path);
			return;
		}
		// A reading equal to what we last wrote means the cache had CAUGHT UP before this
		// write, so everything older is no longer a state it can be showing. Starting a fresh
		// chain there is what stops this set growing for the life of the session.
		const chain =
			observed.reading !== undefined && observed.reading === previous
				? new Set<ObservationToken>()
				: (this.superseded.get(path) ?? new Set<ObservationToken>());
		if (observed.reading !== undefined) chain.add(observed.reading);
		if (previous !== undefined) chain.add(previous);
		this.superseded.set(path, chain);

		if (observed.stat === undefined) this.fileStat.delete(path);
		else this.fileStat.set(path, observed.stat);
	}

	/**
	 * The states this plugin knows to be ITS OWN AND SUPERSEDED at `path` — the cache reading
	 * taken before each write in the current window, plus each frontmatter this plugin wrote
	 * and has since replaced.
	 *
	 * A cache answering any of these has not caught up with our latest write. A cache
	 * answering anything else has moved on to something we do not recognise, and is the
	 * authority — which is what keeps a hand edit winning.
	 */
	supersededStates(path: string): ReadonlySet<ObservationToken> {
		return this.superseded.get(path) ?? EMPTY;
	}

	/**
	 * The file's own mtime and size as they stood immediately after this plugin last wrote
	 * at `path`, or `undefined` when that is not known.
	 *
	 * **This is a heuristic and says so.** Two writes inside one clock tick that leave the
	 * file the same size are indistinguishable here, and a host whose `TFile.stat` lags its
	 * own writes reports a value that no longer matches, which withdraws the fallback rather
	 * than widening it. Both directions of that error are SAFE: the guard can only ever
	 * refuse to serve the echo more often than a version without it, never less, so it
	 * cannot introduce an overwrite. What it can do is let the parse-lag defect resurface on
	 * such a host, which is why the live-vault case is what settles it.
	 */
	observedFileStat(path: string): string | undefined {
		return this.fileStat.get(path);
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
		this.fileStat.delete(path);
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
		const stat = this.fileStat.get(oldPath);
		if (stat !== undefined) {
			this.fileStat.delete(oldPath);
			this.fileStat.set(newPath, stat);
		}
	}
}
