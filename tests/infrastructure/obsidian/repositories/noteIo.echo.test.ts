import { describe, expect, it } from 'vitest';
import type { MetadataCache, TFile } from 'obsidian';
import { frontmatterOf } from '../../../../src/infrastructure/obsidian/repositories/noteIo';
import { observeFrontmatter } from '../../../../src/infrastructure/obsidian/repositories/digest';
import { EchoWindow } from '../../../../src/infrastructure/persistence/index/EchoWindow';

/**
 * The echo fallback's two guards, asked of `frontmatterOf` directly.
 *
 * The repository-level cases in `contract.test.ts` drive this through a fake vault whose
 * mtime is a monotonic counter, so every write there moves the stat — which is KINDER than a
 * filesystem and cannot produce the one case that matters here. A real clock has finite
 * granularity, and a sync client can restore a file with its source mtime, so two different
 * states CAN carry the same `mtime:size`. That collision is reachable only by building the
 * readings by hand, which is what this file is for.
 */

function fileAt(path: string, mtime: number, size: number): TFile {
	return { path, stat: { mtime, size, ctime: 0 } } as TFile;
}

function cacheShowing(frontmatter: Record<string, unknown> | null): MetadataCache {
	return {
		getFileCache: () => (frontmatter === null ? null : { frontmatter }),
	} as unknown as MetadataCache;
}

const PRE_WRITE = { type: 'renovation-project', id: 'p1', revision: 1, name: 'Original' };
const OURS = { type: 'renovation-project', id: 'p1', revision: 2, name: 'Ours' };

/** A writer that observed the cache showing `PRE_WRITE` and the file at `stat` afterwards. */
function echoAfterWrite(stat: string): EchoWindow {
	const echo = new EchoWindow();
	echo.markFrontmatter('Project.md', OURS, { reading: observeFrontmatter(PRE_WRITE), stat });
	return echo;
}

describe('the echo fallback', () => {
	it('serves what this plugin wrote while the cache still shows the state it superseded', () => {
		const echo = echoAfterWrite('7:120');
		const source = { metadataCache: cacheShowing(PRE_WRITE), echo };

		expect(frontmatterOf(source, fileAt('Project.md', 7, 120))).toEqual(OURS);
	});

	it('withdraws itself when the file no longer matches the one this plugin wrote', () => {
		const echo = echoAfterWrite('7:120');
		const source = { metadataCache: cacheShowing(PRE_WRITE), echo };

		// Same cache reading, different file: somebody else has written since, and an unparsed
		// edit is invisible to the cache by definition, so the stale entry is the honest answer.
		expect(frontmatterOf(source, fileAt('Project.md', 8, 131))).toEqual(PRE_WRITE);
	});

	/**
	 * **The residue, pinned as BEHAVIOUR rather than described in a comment.**
	 *
	 * `mtime:size` is the whole of what a file can say about itself synchronously, and
	 * `frontmatterOf` is synchronous by construction — `VaultChangeAdapter` calls it and has
	 * no `await` to spend, which is why this is not a content hash. So an external edit that
	 * lands within the clock's granularity of our own write AND leaves the byte size
	 * unchanged is indistinguishable from our write, and the echo is served over it.
	 *
	 * That is not a safe direction, which is what `EchoWindow.observedFileStat`'s docblock
	 * claimed for a review round: serving the echo is what makes the caller's expectation
	 * match at the next `checkExpectedVersion`, so this narrow case turns a refusal into a
	 * silent overwrite. It is written down as a bound, checked here so that a build which
	 * closes it fails this case rather than leaving the sentence to go quietly stale.
	 */
	it('cannot see an external edit that preserved both the mtime and the byte size', () => {
		const echo = echoAfterWrite('7:120');
		const edited = { ...PRE_WRITE, name: 'Edited by hand' };
		const source = { metadataCache: cacheShowing(PRE_WRITE), echo };

		// The bytes on disk are `edited`; the cache has parsed neither write; the stat collides.
		expect(frontmatterOf(source, fileAt('Project.md', 7, 120))).toEqual(OURS);
		expect(frontmatterOf(source, fileAt('Project.md', 7, 120))).not.toEqual(edited);
	});

	/**
	 * The guard is offered only to a writer that took both readings. A path this plugin wrote
	 * without them — the load-time scan, which is reading the cache rather than racing it —
	 * gets the cache's answer and no fallback at all.
	 */
	it('is not offered for a path recorded without a stat', () => {
		const echo = new EchoWindow();
		echo.markFrontmatter('Project.md', OURS);
		const source = { metadataCache: cacheShowing(PRE_WRITE), echo };

		expect(frontmatterOf(source, fileAt('Project.md', 7, 120))).toEqual(PRE_WRITE);
	});

	/**
	 * The five writers do not agree on how an INSERT spells "there was nothing to supersede",
	 * and these two cases are why that is harmless rather than why it is tidy.
	 *
	 * `cacheReading` is branch-free by design, so the four writers whose insert and update
	 * arms share one call site pass `{ reading: undefined, stat }` on both;
	 * `ObsidianPlanRepository` splits them and its insert passes nothing at all. On a fresh
	 * path there is no prior cache entry and no previous write of ours, so the chain is empty
	 * either way and step 2 declines before the recorded stat is ever consulted — which is
	 * what makes the stat an insert records DEAD rather than merely unused. A build that
	 * starts distinguishing the two spellings fails here.
	 */
	it('declines the fallback after an insert that recorded a stat', () => {
		const echo = new EchoWindow();
		echo.markFrontmatter('Project.md', OURS, { reading: undefined, stat: '7:120' });
		const source = { metadataCache: cacheShowing(PRE_WRITE), echo };

		expect(echo.supersededStates('Project.md').size).toBe(0);
		// The stat MATCHES, so only the empty chain can be what declines here.
		expect(frontmatterOf(source, fileAt('Project.md', 7, 120))).toEqual(PRE_WRITE);
	});

	it('declines it identically after an insert that recorded nothing', () => {
		const echo = new EchoWindow();
		echo.markFrontmatter('Project.md', OURS);
		const source = { metadataCache: cacheShowing(PRE_WRITE), echo };

		expect(echo.supersededStates('Project.md').size).toBe(0);
		expect(frontmatterOf(source, fileAt('Project.md', 7, 120))).toEqual(PRE_WRITE);
	});
});
