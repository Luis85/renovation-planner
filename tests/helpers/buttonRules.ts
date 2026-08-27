import { readFileSync, readdirSync } from 'node:fs';
import type { Selector, SelectorComponent } from 'lightningcss';
import { compoundsOf, importsIn, subjectClasses } from './selectors';

/**
 * Which elements in this project are BUTTONS, and what a selector says about one.
 *
 * Shared because two checks ask about the same set from opposite directions —
 * `buttonSpecificity` asks whether a rule outranks Obsidian's own, `buttonFocusRing` whether a
 * rule that flattens one gives its focus indicator back — and a widening applied to one and not
 * the other has already been a defect twice. Both read the same answer now.
 */

/** Module scope because it captures nothing per-call; `unicorn/consistent-function-scoping`. */
const filesUnder = (dir: string, ext: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? filesUnder(`${dir}/${entry.name}`, ext)
			: entry.name.endsWith(ext)
				? [`${dir}/${entry.name}`]
				: [],
	);

/**
 * How far past a `createEl('button'` call to look for its `cls`. Bounded rather than brace-matched
 * on purpose: the option object nests (`attr: { … }`), so `[^}]*` stops at the wrong brace, and a
 * real parser is far more than this needs. The limit is a stated one — a `cls` further away than
 * this, or built from a variable rather than a literal, is not seen, and the instrument case below
 * pins the one call that exists rather than trusting the window.
 */
const CREATE_WINDOW = 300;

/**
 * A class-bearing attribute of an opening tag, and its value.
 *
 * The scan used to read `rp-*` tokens out of the WHOLE tag, which is one attribute too wide: five
 * real dialog buttons carry `data-rp-action="cancel"`, so `.rp-action` — a class no stylesheet
 * declares and no element wears — entered `buttonClasses()` and, worse, joined
 * `.rp-dialog-button`'s co-occurrence GROUP. A revoking rule for an unrelated `.rp-action` element
 * would then be widened into the dialog button's focus cascade, and a rule whose subject wore it
 * would be governed by the button specificity threshold. Nothing declares that class today, so the
 * damage was latent rather than live — which is exactly how the other spelling holes here have
 * looked right up until a file was added.
 *
 * Both bindings, because `rp-editor-tool-active` arrives only through `:class`, and both quote
 * styles, because nothing stops a template using either.
 */
const CLASS_ATTRIBUTE = /(?::|v-bind:)?class\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/**
 * The `rp-*` classes this project puts on a `<button>`, ONE SET PER BUTTON — from the SOURCE
 * rather than a list, and from both ways a button is made here.
 *
 * Grouped rather than flattened because one button wears several: `ConfirmDialog.vue` and
 * `DeleteReferenceDialog.vue` both put `.rp-dialog-button` and, conditionally,
 * `.rp-dialog-button-danger` on the SAME element. A rule keyed on one and a rule keyed on the
 * other therefore apply to one button and must compete, which a flat set of class names cannot
 * express.
 *
 * It read Vue templates only, so `.rp-harness-scheme` — created in `tests/harness/theme.ts` with
 * `createEl('button', { cls: … })` — was in no class set, and every rule governing it went
 * unchecked by both cases below while `theme.css` sat in `sheets` looking covered. Measured:
 * reverting its doubled selector to the bare class AND deleting its focus ring left this file
 * green. A scan that names one authoring style silently exempts the other.
 */
export function buttonClassGroups(): ReadonlySet<string>[] {
	const groups: Set<string>[] = [];
	const add = (text: string) => {
		const found = new Set<string>();

		for (const [cls] of text.matchAll(/\brp-[\w-]+/g)) found.add(`.${cls}`);
		if (found.size > 0) groups.push(found);
	};

	// `src/prototypes` as well as `src/presentation`. A mock is never shipped, but the sheet that
	// styles it IS — `styles/work-packages.css` is a real partial — and the harness is where that
	// mock is LOOKED AT, which is the whole point of drawing it. Omitting the tree left
	// `.rp-wp-new` undiscovered while its rule lost the cascade, so the screen's primary action
	// was being judged as a plain grey button.
	for (const file of ['src/presentation', 'src/prototypes'].flatMap((dir) => filesUnder(dir, '.vue'))) {
		// The opening tag's CLASS ATTRIBUTES only — the tag alone was one attribute too wide, and a
		// class on a sibling element inside the button's own markup is not the button's either. Every
		// class attribute of one tag is joined into ONE group, because they land on one element.
		for (const [tag] of readFileSync(file, 'utf8').matchAll(/<button\b[^>]*>/g)) {
			add([...tag.matchAll(CLASS_ATTRIBUTE)].map((attribute) => attribute[1] ?? attribute[2] ?? '').join(' '));
		}
	}

	// Obsidian's own DOM helper, which is how anything outside a Vue tree makes an element here.
	// `tests/harness` as well as `src`, because the harness's chrome is styled by a sheet this
	// file scans and is therefore this file's business.
	for (const dir of ['src', 'tests/harness']) {
		for (const file of filesUnder(dir, '.ts')) {
			const source = readFileSync(file, 'utf8');

			for (const match of source.matchAll(/createEl\(\s*['"]button['"]/g)) {
				const cls = /\bcls:\s*['"]([^'"]+)['"]/.exec(source.slice(match.index, match.index + CREATE_WINDOW));

				if (cls !== null) add(cls[1]);
			}
		}
	}

	return groups;
}

/**
 * Every `rp-*` class this project puts on a `<button>`, as one set.
 *
 * Derived from the groups rather than scanned again, so the two cannot answer differently about
 * what a button is.
 */
export const buttonClasses = (): Set<string> => new Set(buttonClassGroups().flatMap((group) => [...group]));

/**
 * Every sheet that can style a button, IN THE ORDER A BROWSER LOADS THEM.
 *
 * The order is load-bearing and was wrong twice over, in the same three lines. It stopped being
 * cosmetic the moment a check began resolving the cascade ACROSS rules — before that, this was a
 * bag of files and any order did.
 *
 * Within `styles/`, the real order is `index.css`'s `@import` list, which is not alphabetical:
 * `view, editor, editor-requirements, dialogs, chrome, work-packages, zone-panel` against
 * `readdirSync`'s `chrome, dialogs, editor-requirements, editor, view, …`. And `theme.css` goes
 * FIRST, not last — `tests/harness/index.html` links it before the assembled plugin sheet,
 * because it stands in for Obsidian's own chrome and everything this project ships is meant to
 * win against it.
 *
 * The imports are read through the parser (`importsIn`), so the order is the cascade's own rather
 * than a pattern matched against text.
 *
 * The assertion below is the point of doing it this way rather than hard-coding the list: a
 * partial nobody imports would silently drop OUT of the scan, and a check that quietly scans less
 * is the failure mode this whole file keeps rediscovering.
 */
const imported = importsIn('styles/index.css', readFileSync('styles/index.css')).map((url) =>
	`styles/${url.replace(/^\.\//, '')}`,
);
const onDisk = filesUnder('styles', '.css').filter((file) => file !== 'styles/index.css');

if (imported.length !== onDisk.length || onDisk.some((file) => !imported.includes(file))) {
	throw new Error(`styles/index.css imports ${imported.join(', ')}; the directory holds ${onDisk.join(', ')}`);
}

/**
 * STATED LIMITATION: a prototype's `<style scoped>` block is NOT scanned, and there is an
 * asymmetry in that which is worth naming rather than leaving to be discovered.
 *
 * `buttonClassGroups` deliberately reads `src/prototypes` as well as `src/presentation`, because
 * the harness is where a mock is looked at — so `.rp-wp-filter` IS a button class here. The CSS that
 * styles it is not: it lives in `WorkPackageFilters.vue`'s own scoped block, and `sheets` holds the
 * harness theme plus the partials `styles/index.css` imports. A scoped rule could therefore flatten
 * a prototype button and go unreported.
 *
 * Adding those blocks NAIVELY is worse, and this was measured rather than reasoned: every selector
 * in that block scores (0,1,0) as written, so `.rp-wp-filter`, `.rp-wp-filter--on` and two siblings
 * would all be reported as losing to Obsidian's (0,1,1) — while in a browser Vue appends its
 * `[data-v-…]` scope attribute and each of them is (0,2,0) and wins. That is a false positive on CSS
 * that renders correctly, which is the same trade the attribute widening in `targetsAButton` made
 * and had to be reverted for.
 *
 * Closing it properly means extracting the scoped blocks AND modelling the scope attribute's
 * contribution to specificity, so a rule is ranked as it renders rather than as it is written. That
 * is the real fix; it is not one line, and it must land with the modelling or not at all.
 */
export const sheets = ['tests/harness/theme.css', ...imported];

/** The button classes a selector's subject wears, as exact names with the leading dot. */
export const buttonClassesOn = (selector: Selector, classes: Set<string>): string[] =>
	subjectClasses(selector)
		.map((name) => `.${name}`)
		.filter((name) => classes.has(name));

/**
 * Does this rule style a BUTTON at all?
 *
 * A known class on the subject is the ordinary case. The other one is a bare `button` type
 * selector — `button:not(.rp-dialog-button)`, `.rp-editor-toolbar button` — which targets buttons
 * without naming any of this project's classes and so was outside the sweep entirely.
 *
 * That gap survived a review finding about the same selector. The finding was that `:not()`'s
 * contents were read as classes the subject WEARS, which exempted the rule; fixing that stopped
 * the exemption and left the rule matching no class at all, so it went from wrongly exempt to
 * silently out of scope — a quieter version of the same miss. Found by re-running every historical
 * hole against the rewritten reader rather than by the unit cases, which is the argument for
 * keeping that sweep.
 */
/**
 * STATED LIMITATION: an ATTRIBUTE-ONLY subject is out of scope, and putting it in was measured to be
 * worse than leaving it out.
 *
 * `[type='button'][data-rp-action]` matches every dialog button, scores (0,2,0) and replaces
 * Obsidian's (0,1,1) focus ring, so a rule spelled that way really can leave those buttons with no
 * indicator and this predicate really does miss it. A widening was written, landed and REVERTED,
 * because the miss is a false negative on a spelling nothing here writes while the widening is a
 * false POSITIVE on valid CSS: a flattening site is keyed by its subject SHAPE and sites are never
 * widened, so `[type='button'][data-rp-action] { box-shadow: none }` filed a site nothing could
 * answer — a `.rp-dialog-button:focus-visible` ring is filed under the class and never reaches it —
 * and the gate failed a stylesheet that visibly rings its buttons.
 *
 * Closing it properly means proving which scanned buttons a selector MATCHES, so that an
 * attribute-keyed site can join the cascades of the buttons it reaches. That is a matcher, and a
 * matcher is a far larger instrument than this file; the two spellings this predicate does know are
 * decidable from the selector alone, and that is the line.
 */
export const targetsAButton = (selector: Selector, classes: Set<string>): boolean =>
	buttonClassesOn(selector, classes).length > 0 ||
	compoundsOf(selector).at(-1)?.components.some((component) => component.type === 'type' && component.name === 'button') ===
		true;

/** A branch's subject — the components after its last combinator, the element the rule styles. */
export const subjectOf = (branch: Selector): SelectorComponent[] =>
	branch.slice(branch.map((component) => component.type).lastIndexOf('combinator') + 1);
