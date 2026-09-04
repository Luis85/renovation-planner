import { assembleStyles } from '../../../scripts/styles-assemble.mjs';

/**
 * §7's narrow composition, installed as a plain stylesheet so a jsdom suite can drive it.
 *
 * **Shared by two suites rather than copied into the second.** `assetLibraryKeyboard.test.ts`
 * built this for §6.2's focus handoff and `assetDelete.test.ts` needs the identical stand-in
 * for §3.5's post-deletion rule, which has its own ordering claim about this composition. A
 * hand-rolled second copy is the drift `assetLibraryRootHarness.ts`'s own header argues
 * against: two suites installing different rules certify two different programs.
 *
 * **It sits beside its two consumers rather than in `tests/helpers/`, and that placement was
 * decided by an instrument rather than by taste.** `tests/helpers/` is one of the three ROOTS
 * `tests/harness/harness.test.ts` walks, because modules there (`mount.ts`, `planEditor.ts`) are
 * RUNTIME modules of the browser harness page — so that walk refuses a specifier leaving the
 * roots, and this file's `scripts/styles-assemble.mjs` import is exactly such an escape. The
 * refusal is correct: it cannot know that this module reads the sheet at runtime rather than
 * importing one, and a helper that DID import a stylesheet would reach the harness page through
 * the same edge. Nothing under `tests/harness/` or `tests/helpers/` imports this, so it is not a
 * harness module at all; `tests/presentation/library/` is where both of its consumers live. Found
 * by that check going red on the move, not by reading it.
 *
 * §7's third rung, DERIVED from the assembled sheet rather than transcribed from it — every rule
 * inside every `@container rp-al (width < 35rem)` block, with the wrapper this jsdom cannot
 * evaluate stripped off. Two partials contribute one: the shell hides `.rp-al-body` once
 * something is selected (`styles/asset-library.css`), and the rail takes the pane while its
 * resting and stood-aside states withdraw (`styles/asset-library-inspector.css`).
 *
 * **Copied is not derived, which is why this is a scan.** A hand-transcribed pair of selectors
 * leaves this whole file green on the day the shipped rule changes and production stops hiding
 * anything — the drift would redden only in `tests/build/styles.test.ts`, one file away, and
 * only for the one rule that file pins by text. Reading the sheet means the composition these
 * cases drive IS the composition that ships.
 *
 * Comments are stripped first: both partials discuss `rp-al (width < 35rem)` in prose, and a
 * scan that matched a sentence would slice from the wrong offset.
 */
function narrowRules(): string {
	const sheet = assembleStyles().replace(/\/\*[\s\S]*?\*\//gu, '');
	const marker = '@container rp-al (width < 35rem)';
	let rules = '';
	for (let from = sheet.indexOf(marker); from !== -1; from = sheet.indexOf(marker, from)) {
		const open = sheet.indexOf('{', from);
		let depth = 0;
		let at = open;
		for (; at < sheet.length; at += 1) {
			if (sheet[at] === '{') depth += 1;
			else if (sheet[at] === '}') {
				depth -= 1;
				if (depth === 0) break;
			}
		}
		rules += sheet.slice(open + 1, at);
		from = at;
	}
	return rules;
}

/**
 * Installs those rules and answers the `<style>` element, which the CALLER removes in its own
 * `afterEach` — a helper that registered its own cleanup would need to know which suite's
 * teardown list to join, and both suites already keep one.
 */
export function installNarrowComposition(): HTMLStyleElement {
	const style = document.createElement('style');
	style.textContent = narrowRules();
	document.head.append(style);
	return style;
}
