import { createHash } from 'node:crypto';

/**
 * The shots for ONE named entry, in both schemes.
 *
 * This is what makes the harness usable by an actor with no eyes: `docs/actors/Coding agent.md`
 * describes an agent that verifies by running something that writes a file it can then read,
 * or does not verify at all. Without an argument here, every layout judgement about a mock is
 * deferred to a human and every iteration costs a round.
 *
 * `width` is the one knob beyond the two schemes, and it exists because the first real use of
 * this command hit the defect it could not see: a Work Packages mock captured at the fixed
 * 1280 looked right, and at 460 every package name was ellipsed to a prefix. `npm run check`
 * was green for both. Narrow-width wrapping is squarely inside what CLAUDE.md claims a capture
 * is FOR — spacing, wrapping, overflow — and an Obsidian sidebar leaf is routinely under 400px,
 * so the one width this tool offered was the one width the host often does not give you.
 *
 * It is a viewport WIDTH and not `?phone`: `phone` is a body class the project surface's own
 * fit measurement reads, so it answers a different question (what that surface does when told
 * it is on a phone) than the one a mock author is asking (what my layout does in a narrow
 * pane). Both remain available — `&phone` can still be added to a URL by hand.
 *
 * A PURE function, and lifted into its own module for exactly that reason: `harness-shot.mjs`
 * runs its capture at module scope, so a test that wanted this behaviour used to have to read
 * the source text and assert it SAID the right thing rather than DID it. Importing it here
 * turns four of those source-text pins (the digest, the length cap, the sanitising regex, the
 * URL encoding) into assertions that call the function and check its output — see
 * `tests/build/entryShots.test.ts`.
 */
/**
 * One capture: the PNG's basename, the index query that draws it, the entry it is of, and
 * the viewport width (`undefined` for the caller's default).
 *
 * @typedef {{ name: string, query: string, entry?: string, width?: number }} Shot
 */

/**
 * @param {string} entry
 * @param {number} [width] Absent for the caller's default viewport width.
 * @returns {Shot[]}
 */
export const entryShots = (entry, width) => {
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
	// The width is in the NAME for the same reason the digest is: two captures of one entry at
	// two widths are two different pictures, and without this the narrow one silently
	// overwrites the wide one — the collision above, wearing a third set of clothes. Absent
	// from the name when absent from the command, so the default filenames do not churn.
	const fileSafe = width === undefined ? `${readable}-${digest}` : `${readable}-${digest}-w${width}`;

	// `entry` rather than `selector`: `captureOne` waits on `entryHasDrawn` when it is present.
	// `width` is passed through UNRESOLVED — `harness-shot.mjs` owns what a viewport is and
	// merges it over its own default height, so this module states no viewport policy at all
	// and stays a pure function of its two arguments.
	//
	// `&bare` on both: it tells the index to draw the stage and nothing else. Without it the
	// picker — a fixed-width sidebar — took roughly 210px of a 460px capture, so the mock laid
	// itself out in 250px while the picture claimed 460. A person browsing never asks for this;
	// a capture always does, which is why it lives here rather than being the default for
	// `?entry=` (the list is how a person moves between entries, and criterion 8 wants it
	// present when an entry fails).
	return [
		{ name: `entry-${fileSafe}-dark`, query: `?entry=${encodeURIComponent(entry)}&bare`, entry, width },
		{
			name: `entry-${fileSafe}-light`,
			query: `?entry=${encodeURIComponent(entry)}&theme=light&bare`,
			entry,
			width,
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
 * index it read — while `npm run harness-shot prototype:ZoneSummary` would write the fourteen
 * fixed PNGs instead of capturing the requested entry, and exit 0. Testing THIS function with
 * a real `argv` array closes that: it is the one place the index is read, and nothing else in
 * `harness-shot.mjs` inspects `argv` at all.
 *
 * An entry argument that is present but blank (`npm run harness-shot ""`) is a mistake, not an
 * absent argument — `entryShots('')` would still produce two loadable-looking filenames, so a
 * quoted empty string would otherwise run the fourteen fixed shots and exit 0 rather than
 * reporting an unnamed entry. Truthiness alone conflates the two; this checks presence first.
 */
const WIDTH_FLAG = /^--width=(.*)$/;

/**
 * The largest width this accepts. Not a browser limit — Chromium will size a page far wider —
 * but a mistyped `--width=4600000` is a request for a screenshot no filesystem wants and an
 * error from deep inside Playwright, which is a worse message than this one.
 */
const MAX_WIDTH = 4096;

/** `--width=460` → 460, and anything else → an error naming what was wrong with it. */
function parseWidth(raw) {
	if (!/^[0-9]+$/.test(raw)) throw new Error(`--width takes a number of pixels, not ${JSON.stringify(raw)}`);

	const width = Number(raw);

	if (width < 1 || width > MAX_WIDTH) throw new Error(`--width must be between 1 and ${MAX_WIDTH}, not ${width}`);

	return width;
}

/**
 * @param {readonly string[]} argv
 * @param {readonly Shot[]} fixedShots
 * @param {Record<string, string | undefined>} [env]
 * @returns {readonly Shot[]}
 */
export function resolveShots(argv, fixedShots, env = {}) {
	const args = argv.slice(2);
	// Flags are recognised by their leading `--` rather than by position, so
	// `harness-shot --width=460 prototype:X` and `harness-shot prototype:X --width=460` are the
	// same command. An unrecognised flag is an ERROR rather than an entry name: silently
	// treating `--wdith=460` as the id would report "no entry named --wdith=460" from the
	// browser, several seconds later, in a message about the wrong thing.
	const widths = args
		.filter((arg) => arg.startsWith('--'))
		.map((flag) => {
			const match = WIDTH_FLAG.exec(flag);

			if (match === null) throw new Error(`unknown option ${flag}`);

			return parseWidth(match[1]);
		});

	// A REPEATED option is the same mistake as a second entry and is refused for the same
	// reason. `.at(-1)` served the last one: `--width=460 --width=1280` wrote successful PNGs
	// at 1280 and exited 0 while the 460 asked for in the same breath was never captured and
	// never mentioned. The comment below claims every malformed invocation here is refused,
	// and until now this was the one that was not — the file stating the rule its own code
	// broke, three lines above the code that broke it.
	if (widths.length > 1) {
		throw new Error(`one --width at a time; got ${widths.length}: ${widths.join(', ')}`);
	}

	const width = widths.at(-1);
	const positional = args.filter((arg) => !arg.startsWith('--'));

	// A SECOND entry is a mistake, not a request this command can serve: it captures one entry.
	// Taking the first and discarding the rest would write successful PNGs for A and exit 0 while
	// B — asked for in the same breath — was never captured and never mentioned. Every other
	// malformed invocation here is refused for exactly that reason.
	if (positional.length > 1) {
		throw new Error(`one entry at a time; got ${positional.length}: ${positional.join(', ')}`);
	}

	const entry = positional[0];

	// `npm run harness-shot X --width=460` does NOT reach here: npm claims an unknown flag as
	// its own config and exports it as `npm_config_width`, so the script is invoked with the
	// entry alone and captures at the default width — silently, with two PNGs written and exit
	// 0. That is the exact failure this whole command exists to prevent, so it is refused with
	// the spelling that works. Found by running the line this repository's own README had in
	// it, which was wrong for precisely this reason.
	if (width === undefined && env.npm_config_width !== undefined) {
		throw new Error('npm swallowed --width; put it after a separator: npm run harness-shot <id> -- --width=460');
	}

	if (entry === undefined) {
		// The fixed set carries its own viewports — `?phone` among them — so a width with no
		// entry is a command that cannot mean what it says.
		if (width !== undefined) throw new Error('--width applies to a named entry, and the fixed shots carry their own');

		return fixedShots;
	}
	if (entry.trim() === '') throw new Error('an entry name must not be empty');

	return entryShots(entry, width);
}
