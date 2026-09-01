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

	/**
	 * `stat` is the file's own `mtime:size` immediately AFTER this write, and it is what
	 * `wroteFile` compares against later — the same reading `markFrontmatter` records for a
	 * note, offered here because the sidecar writers have exactly the same question and had
	 * no way to ask it. A caller that cannot take one passes none, which withdraws
	 * `wroteFile` for that path rather than leaving a stale reading standing.
	 *
	 * The rule that reading carries is about the CALL SITE and no signature can hold it: it
	 * is a statement about the file WE wrote, so it must be taken with nothing awaited since
	 * the write. `fileStatToken`'s docblock carries the account of the one writer that got
	 * that wrong.
	 */
	mark(path: string, token: ObservationToken, stat?: string): void {
		this.tokens.set(path, token);
		if (stat === undefined) this.fileStat.delete(path);
		else this.fileStat.set(path, stat);
	}

	/**
	 * Is the file at `path` still the one this plugin last wrote there — `stat` being that
	 * file's CURRENT `mtime:size`, which the caller reads from the handle it already holds.
	 *
	 * **This is IDENTITY, and the door it replaced asked mere acquaintance.** `knows(path)`
	 * answered "has this plugin written here at all", and nothing but a delete removes a path
	 * from that memory — so once a session had written a sidecar, every later sync, restore
	 * and hand edit of that file answered the same `true`. That was tolerable while the only
	 * thing behind the check was an idempotent `upsert`, and it stopped being tolerable the
	 * moment a REFRESH was put behind it: the leaf showing that plan or that asset was never
	 * told again. Which is the general shape rather than one bug — a comment stating what a
	 * guard costs is a claim about everything behind that guard, and it goes stale in the
	 * edit that puts something new there.
	 *
	 * An unrecorded stat answers `false`: a path marked by a caller that took no reading, or
	 * before this window carried one, is not something this plugin can vouch for. That is the
	 * safe direction for the one caller — over-answering `false` costs a redundant re-read,
	 * while over-answering `true` is the silence this method exists to end.
	 *
	 * It inherits `observedFileStat`'s residue unchanged: two states can carry one
	 * `mtime:size`, so an external write landing within the clock's granularity of ours AND
	 * leaving the byte count alone reads as our own echo.
	 */
	wroteFile(path: string, stat: string): boolean {
		return this.fileStat.get(path) === stat;
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
	 * A caller with no such readings passes none — the load-time scan is reading the cache
	 * rather than racing it — and the fallback is then simply not offered for that path.
	 *
	 * **An INSERT may spell that either way, and the two are equivalent**, which is worth
	 * stating because the five writers do not agree on the spelling and a reader should not
	 * have to derive why that is harmless. `cacheReading` is branch-free by design (its own
	 * docblock says why), so the four writers whose insert and update arms share one call
	 * site pass `{ reading: undefined, stat }`; `ObsidianPlanRepository` splits the two into
	 * separate methods and its insert passes nothing. On a fresh path BOTH leave the chain
	 * empty — there is no prior cache entry to supersede and no previous write of ours — so
	 * `frontmatterOf` step 2 declines and the recorded stat is never consulted. The writer's
	 * own shape decides the spelling; neither is a rule the other breaks. Pinned by the two
	 * 'an insert' cases in `noteIo.echo.test.ts` rather than left as this paragraph.
	 */
	markFrontmatter(path: string, frontmatter: Record<string, unknown>, observed?: CacheObservation): void {
		// BEFORE `mark`, which overwrites it: what we had written here previously is a state
		// the cache may still be about to parse.
		const previous = this.tokens.get(path);
		// The stat goes through `mark` rather than being written here, so this class has ONE
		// writer of that map: a note and a sidecar record it for the same reason and compare it
		// the same way, and two spellings of one fact are two facts as soon as either moves.
		this.mark(path, observeFrontmatter(frontmatter), observed?.stat);
		this.notes.set(path, { ...frontmatter });

		if (observed === undefined) {
			this.superseded.delete(path);
			return;
		}
		// A reading equal to what we last wrote means the cache had CAUGHT UP before this
		// write, so everything older is no longer a state it can be showing, and the chain
		// starts again from here.
		//
		// **That bounds the set by the writes inside one UN-DRAINED parse window, not by the
		// session** — an earlier spelling of this comment claimed the second, which is the
		// stronger claim and rests on the queue draining. It does drain, so the practical
		// bound is a burst (the slice-10 cascade's two writes on one requirement is the
		// realistic worst case here); a host whose queue never drained would grow this set
		// for as long as writes kept landing. There is deliberately no cap: evicting an entry
		// is exactly how the fallback stops recognising a window it is still inside, which is
		// the defect this whole mechanism exists to close.
		const chain =
			observed.reading !== undefined && observed.reading === previous
				? new Set<ObservationToken>()
				: (this.superseded.get(path) ?? new Set<ObservationToken>());
		if (observed.reading !== undefined) chain.add(observed.reading);
		if (previous !== undefined) chain.add(previous);
		this.superseded.set(path, chain);
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
	 * at `path`, or `undefined` when that is not known — read by `frontmatterOf` alone
	 * (`grep -rn "observedFileStat" src/`, one call site outside this file), because the
	 * SIDECAR reader of the same recording asks `wroteFile` instead: it holds the current
	 * reading already and wants the comparison, not the record.
	 *
	 * **This is a heuristic, and its two error directions are NOT both safe** — an earlier
	 * draft of this paragraph said they were, and a review round was right to disbelieve it.
	 * The claim under it ("the guard can only refuse the echo more often than a version
	 * without it") is true and measures the wrong baseline: the version without the guard is
	 * the one that shipped the overwrite the guard exists to close, so being no worse than it
	 * is not a safety property. Against the behaviour BEFORE the fallback existed — a stale
	 * cache refusing the next conditional save — the two directions differ:
	 *
	 * - **Stat MISMATCH** (a host whose `TFile.stat` lags its own writes) withdraws the
	 *   fallback. Safe: the read answers the stale cache and the next save is refused, which
	 *   is the pre-fallback behaviour. The cost is that the parse-lag defect can resurface on
	 *   such a host, which is why the live-vault case is what settles it.
	 * - **Stat COLLISION** (an external write landing within the clock's granularity of ours
	 *   AND leaving the byte size unchanged — a sync client restoring a file with its source
	 *   mtime is the realistic path) serves the echo over bytes that are not ours. Not safe:
	 *   the caller's expectation then matches at the next `checkExpectedVersion`, so a save
	 *   that used to be refused overwrites the external edit.
	 *
	 * That residue is not closable here. `mtime:size` is the whole of what a file says about
	 * itself synchronously, and `frontmatterOf` is synchronous by construction —
	 * `VaultChangeAdapter` calls it and has no `await` to spend — so a content hash is not
	 * available at the only moment this question is asked. It is pinned as behaviour by the
	 * 'cannot see an external edit that preserved both the mtime and the byte size' case in
	 * `tests/infrastructure/obsidian/repositories/noteIo.echo.test.ts`, so a build that closes
	 * it fails there rather than leaving this paragraph to go quietly stale.
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
