import { createHash } from 'node:crypto';

/**
 * The shots for ONE named entry, in both schemes.
 *
 * This is what makes the harness usable by an actor with no eyes: `docs/actors/Coding agent.md`
 * describes an agent that verifies by running something that writes a file it can then read,
 * or does not verify at all. Without an argument here, every layout judgement about a mock is
 * deferred to a human and every iteration costs a round.
 *
 * No `?phone` shot: the fixed set has one for the project view because that surface is
 * responsive by design, and a prototype's own breakpoints are the prototype's business — add
 * `&phone` to the URL by hand when that is the question.
 *
 * A PURE function, and lifted into its own module for exactly that reason: `harness-shot.mjs`
 * runs its capture at module scope, so a test that wanted this behaviour used to have to read
 * the source text and assert it SAID the right thing rather than DID it. Importing it here
 * turns four of those source-text pins (the digest, the length cap, the sanitising regex, the
 * URL encoding) into assertions that call the function and check its output — see
 * `tests/build/entryShots.test.ts`.
 */
export const entryShots = (entry) => {
	// The id is a URL and may contain `:` and `/` — both legal in a query value, both ILLEGAL
	// in a Windows filename, and Windows is one of the four legs `npm run check` rides.
	//
	// Sanitising ALONE is not enough, and the plan's own id test names the case: `a-b/C` and
	// `a/b-C` are different entries that collapse to one string the moment `/` and `:` become
	// `-`. Two captures would then write the same two PNGs, the second silently overwriting
	// the first — the same collision `entries.ts` refuses, moved from the URL to the file
	// system. So the readable part is sanitised for humans and a short hash of the REAL id
	// keeps it unique.
	//
	// The readable part is also CAPPED, and the cap is safe precisely because identity lives
	// in the digest rather than in it: a deep path or a long basename is legal on every
	// platform this runs on, and flattening the whole id into a filename is how a legal
	// source path becomes an `ENAMETOOLONG` from `page.screenshot()` — an entry the index
	// opens and the capture cannot write, which is the same criterion-4 failure as the
	// collision above wearing different clothes. 60 leaves room for the `entry-`, the
	// digest, the scheme and `.png` well inside the 255-byte per-component limit, and inside
	// Windows' 260-character whole-path limit once `harness-shots/` is in front of it —
	// Windows being one of the four legs, and the stricter of the two constraints.
	const readable = entry.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 60);
	const digest = createHash('sha1').update(entry).digest('hex').slice(0, 8);
	const fileSafe = `${readable}-${digest}`;

	// `entry` rather than `selector`: `captureOne` waits on `entryHasDrawn` when it is present.
	return [
		{ name: `entry-${fileSafe}-dark`, query: `?entry=${encodeURIComponent(entry)}`, entry },
		{
			name: `entry-${fileSafe}-light`,
			query: `?entry=${encodeURIComponent(entry)}&theme=light`,
			entry,
		},
	];
};

/**
 * `argv[2] → entryShots`, lifted out of `run()` so the argument-index choice itself is behind
 * an import a test can drive rather than a line only source-text scanning could see.
 *
 * The mutation this exists to catch: `process.argv[2]` silently becoming `process.argv[3]` (or
 * any other index) inside `run()`. Every case in this file kept passing against that mutation
 * before this function existed — none of them ran the script, so none of them cared which
 * index it read — while `npm run harness-shot prototype:ZoneSummary` would write the five
 * fixed PNGs instead of capturing the requested entry, and exit 0. Testing THIS function with
 * a real `argv` array closes that: it is the one place the index is read, and nothing else in
 * `harness-shot.mjs` inspects `argv` at all.
 *
 * An entry argument that is present but blank (`npm run harness-shot ""`) is a mistake, not an
 * absent argument — `entryShots('')` would still produce two loadable-looking filenames, so a
 * quoted empty string would otherwise run the five fixed shots and exit 0 rather than reporting
 * an unnamed entry. Truthiness alone conflates the two; this checks presence first.
 */
export function resolveShots(argv, fixedShots) {
	const entry = argv[2];

	if (entry === undefined) return fixedShots;
	if (entry.trim() === '') throw new Error('an entry name must not be empty');

	return entryShots(entry);
}
