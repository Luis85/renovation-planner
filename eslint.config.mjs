import tsparser from '@typescript-eslint/parser';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';

/**
 * The layers the SDD declares (§8), innermost last. Each may reach anything below it and
 * nothing above:
 *
 *   presentation → application → domain → core
 *   infrastructure → application (its ports) → domain → core
 *
 * `plugin/` is the composition root and the one place allowed to reach every layer — it
 * wires infrastructure into the ports the inner layers declare, which is the whole reason
 * the inner layers can stay ignorant of Obsidian.
 *
 * These rules are what keep that a fact rather than an aspiration: a layering documented
 * only in prose is one commit away from being wrong, and the SDD asks for exactly this
 * check (§76). A rule matching no directory yet is not dead — it is the rule waiting for
 * the directory, and it fails the first import that would have broken the design.
 */

/**
 * Anchored on `**\/` rather than on the repository root: every `files`/`ignores` pattern
 * is matched against the LINTER's base path, and an editor's ESLint server need not put
 * that where the CLI does. A test excluded by `tests/**` alone is only excluded when it
 * is — otherwise the type-aware rules meet a file the tsconfig does not cover.
 */
const TESTS = '**/tests/**';

/**
 * Both extensions for one `src/` subtree. A block widened to `.vue` on the ban but not on
 * its carve-out fails INWARD — the sink's own `.vue` files would be the one place a `.vue`
 * file could not use the console — so the two are spelled by the same function.
 *
 * What actually catches a forgotten block is `tests/build/vue-rules.test.ts`, which
 * exercises a layer ban, `no-console` and the carve-out through real `.vue` paths. This
 * helper only makes the two spellings impossible to write apart by hand.
 */
const srcFiles = (subtree) => [`**/src/${subtree}/**/*.ts`, `**/src/${subtree}/**/*.vue`];

/** Every SFC under `src/`, and the only files any Vue rule may be pointed at. */
const VUE_FILES = ['**/src/**/*.vue'];

/**
 * `groups` are sibling LAYERS this one may not reach; `packages` are npm packages it may
 * not name at all. Both in one rule because both are the same statement — what this layer
 * is not allowed to know about — and because two `no-restricted-imports` entries for one
 * file would override rather than merge.
 */
const forbidden = (layer, { groups = [], packages = [] }, reason) => ({
	// `**/`-anchored like TESTS above, and for the same reason: patterns match against
	// the linter's base path, which an editor's ESLint server need not put where the
	// CLI does.
	files: srcFiles(layer),
	rules: {
		'no-restricted-imports': [
			'error',
			{
				paths: packages.map((name) => ({ name, message: reason })),
				patterns: [
					{
						group: [
							// `**/${g}` bare is the barrel spelling: once a layer grows an
							// `index.ts`, `import … from '../../${g}'` resolves through it and
							// would match neither of the other two.
							...groups.flatMap((g) => [`**/${g}`, `**/${g}/*`, `**/${g}/**/*`]),
							// A package's subpaths too: `vue/dist/…`, `konva/lib/…`, `obsidian/…`.
							...packages.map((name) => `${name}/*`),
						],
						message: reason,
					},
				],
			},
		],
	},
});

/**
 * The four the SDD prohibits in the inner layers (§3.4): a `Zone` is not a Konva polygon
 * and a `WorkPackage` is not a Markdown file, so the code that decides what they ARE may
 * not be able to name the technologies that merely present or store them.
 *
 * `obsidian` is in the list for the layer that would most plausibly want it. Domain reads
 * nothing and writes nothing; a repository does, and it lives in `infrastructure/` behind
 * a port `application/` declares.
 */
const PRESENTATION_AND_HOST = ['vue', 'pinia', 'konva', 'vue-konva', 'obsidian'];

/**
 * The Obsidian ruleset is about *shipped plugin* code, and it is type-aware, which
 * `test/` cannot satisfy: tsconfig.json covers `src/` only, and the test doubles exist
 * precisely to do what those rules forbid. So the plugin rules stop at `src/`, and
 * `test/` gets the TypeScript baseline plus this repo's own budgets, below.
 */
// The locales variant, not plain `recommended`: it adds the sentence-case rules for
// English locale files (`**/en.ts`, `**/en*.json`), which is what lints the string
// table in `src/presentation/i18n/locales/en.ts` instead of leaving case to review.
const pluginRules = obsidianmd.configs.recommendedWithLocalesEn.map((c) => ({
	...c,
	ignores: [...(c.ignores ?? []), TESTS],
}));

/**
 * `eslint-plugin-vue`'s flat configs carry NO `files` of their own, so spreading them as
 * shipped applies every Vue rule to every linted file — and that is not a style objection:
 * `vue/multi-word-component-names` loading against `package.json` throws
 * `Cannot read properties of undefined (reading 'getDocumentFragment')` and takes the whole
 * `npm run lint` run down with it, measured. Scoped to `src/`'s SFCs, the same way the
 * obsidianmd ruleset above is scoped away from `tests/`.
 */
const vueRules = pluginVue.configs['flat/recommended'].map((c) => ({ ...c, files: VUE_FILES }));

/**
 * Every mutation of the vault goes through `src/infrastructure/`, so the write-safety
 * invariants can be verified by reading one directory instead of trusting every call
 * site. This is a category invariant — "nothing outside the repositories writes" cannot be
 * checked by driving the paths someone thought of, because the next path is the one that
 * breaks it — so it is a rule at the forbidden call rather than a paragraph.
 *
 * The layer bans above already keep `obsidian` out of core, domain and application, so
 * these catch the layer that IS allowed to name it: a write from a view, a Bases
 * adapter or the composition root, bypassing the repository that owns the file format.
 *
 * The spellings these selectors SEE, honestly: a write call whose receiver is spelled
 * `<x>.vault` / `<x>.adapter` inline, or a local named exactly `vault` / `adapter`.
 * What they cannot see: a differently-named alias (`const v = app.vault`) and a
 * destructured method (`const { modify } = vault`) — if either spelling ever appears in
 * review, rename the local rather than widening the hole.
 */
const VAULT_WRITE_METHODS = /^(create|createBinary|createFolder|modify|modifyBinary|process|append|delete|trash|rename|copy)$/;
const ADAPTER_WRITE_METHODS = /^(write|writeBinary|append|mkdir|rmdir|remove|trashSystem|trashLocal|rename|copy)$/;
const WRITE_BOUNDARY = [
	{
		selector: "MemberExpression[property.name='processFrontMatter']",
		message: 'All frontmatter writes go through a repository in src/infrastructure/obsidian/repositories/.',
	},
	{
		selector: `CallExpression[callee.property.name=${VAULT_WRITE_METHODS}]:matches([callee.object.property.name='vault'], [callee.object.name='vault'])`,
		message: 'Writing to the vault belongs in src/infrastructure/obsidian/.',
	},
	{
		selector: `CallExpression[callee.property.name=${ADAPTER_WRITE_METHODS}]:matches([callee.object.property.name='adapter'], [callee.object.name='adapter'])`,
		message: 'Writing through the vault adapter belongs in src/infrastructure/obsidian/.',
	},
	{
		selector: "MemberExpression[property.name=/^(save|load)LocalStorage$/]",
		message: 'Persisted UI state goes through one module in src/infrastructure/.',
	},
];

/**
 * Obsidian hands an SVG node's `cls` straight to `classList.add` — `addClass` lives on
 * `HTMLElement` — so a space-separated STRING throws `InvalidCharacterError` where
 * `createEl` would have split it happily. This shipped in the source project: a
 * two-class path threw on every render, and because the throw aborted the render before
 * the drag wiring ran, a drop target silently never registered. Stated as a lint rule
 * because the test double was the reason nothing caught it — a fake kinder than the real
 * API — and a faithful fake still only catches a path some test drives.
 *
 * The spellings these SEE: a space-separated literal or template under a `cls` key,
 * whether the key is bare (`key.name`) or quoted (`key.value` — a quoted key is a
 * Literal node, which the bare-key selector alone would let straight through). What
 * they cannot see: a joined array (`CLASSES.join(' ')`), a variable holding a spaced
 * string, and a computed key — the array form is the one that always works.
 */
const CLS_KEY = ":matches(Property[key.name='cls'], Property[key.value='cls'])";
const SVG_CLASS_TOKENS = [
	{
		selector: `CallExpression[callee.property.name='createSvg'] ${CLS_KEY} Literal[value=/ /]`,
		message:
			'createSvg passes cls to classList.add, which rejects spaces. Pass an array of class names, not one space-separated string.',
	},
	{
		selector: `CallExpression[callee.property.name='createSvg'] ${CLS_KEY} TemplateElement[value.raw=/ /]`,
		message:
			'createSvg passes cls to classList.add, which rejects spaces. Build an array of class names rather than interpolating a space-separated string.',
	},
];

/**
 * Obsidian is localized (`docs/requirements/Multilanguage.md`): every string this plugin
 * shows has to reach `t`/`tr` in `src/presentation/i18n/`, because that is the one place
 * German — or any locale added later — can answer it from. Nothing else refuses a
 * hard-coded English literal in a new screen: it passes the build, the sentence-case lint
 * on `locales/en.ts`, and the suite. Twenty product epics of screens are coming, so this
 * is the cheapest point to put the rule at the forbidden call rather than in a paragraph,
 * by the same argument that put `WRITE_BOUNDARY` above.
 *
 * The spellings these SEE: a string literal passed directly as the argument to
 * `.setText(...)`, and a string literal that IS the `value` field of a `text` property
 * that is itself a DIRECT property of the options object — the actual DOM-info argument
 * of `.createEl(...)`/`.createDiv(...)`/`.createSpan(...)`, not any object nested inside
 * it. `createDiv(options)`/`createSpan(options)` take that object as the FIRST argument;
 * `createEl(tag, options)` takes it as the SECOND. The selector does not hard-code either
 * position — `CallExpression > ObjectExpression.arguments` matches whichever argument is
 * the object literal, since a tag argument is a string and never an `ObjectExpression`,
 * so at most one argument can ever match regardless of where it sits.
 *
 * Three combinators, each pinning one hop of that path, and each closes a real
 * over-match this rule shipped with and a reviewer caught by building it:
 *   - `CallExpression > ObjectExpression.arguments` — the options object must be a
 *     direct ARGUMENT of the call. Without this, `el.createDiv(makeOptions({ text: … }))`
 *     would still be reachable by the rest of the selector, and worse, a completely
 *     unrelated call three levels down would be too.
 *   - `> :matches(Property[key.name='text'], Property[key.value='text'])` — that `text`
 *     key must be a direct PROPERTY of the options object, not of an object nested
 *     inside it. Obsidian's `DomElementInfo.attr` is exactly that nesting:
 *     `createDiv({ attr: { text: 'internal-token' } })` sets an HTML `text` ATTRIBUTE,
 *     which is not rendered copy and has nothing to do with `t`/`tr` — the first shipped
 *     version of this selector used a descendant combinator here and flagged it anyway,
 *     with no inline-suppression escape available (`linterOptions.noInlineConfig`), which
 *     is what made it a real defect rather than a false positive with a way out.
 *   - `> Literal.value` — the literal must be the `value` FIELD of that property, not
 *     something nested inside it. `Literal.value` is esquery's field selector: without
 *     it, `{ text: tr('some.key') }` matched the string argument INSIDE the `tr(...)`
 *     call and rejected the idiomatic form this rule exists to allow — the first
 *     round's defect, fixed by this pin alone before the `attr` case above was found.
 * A call to `t`/`tr` is a CallExpression at that `value` position, not a Literal, so
 * `el.setText(tr('x'))` and `createSpan({ text: tr('x') })` both pass untouched — that is
 * the whole mechanism, and every hop above exists to keep it checking that exact
 * position and nothing else nearby.
 *
 * What they cannot see: a literal one hop away from the call (`const label = 'Cancel';
 * el.setText(label)`), a template literal even with no interpolation — `setText(`Cancel`)`
 * is a TemplateLiteral node, not a Literal — and a string built from a joined array
 * (`parts.join(' ')` is a CallExpression). None of those are a Literal node at the
 * position these selectors check. A reviewer who sees one is the backstop, the same as
 * for the spellings `SVG_CLASS_TOKENS` cannot see. `attr:` is the same blind spot in a
 * different shape, deliberately: the accessibility gate
 * (`tests/harness/accessibility.test.ts`) can push a literal like
 * `createDiv({ attr: { 'aria-label': 'Cancel' } })` — real user-visible copy, read aloud by
 * a screen reader — and this rule structurally cannot see it, since `attr`'s own contents
 * are excluded above precisely so a genuine HTML attribute (`attr: { text: '…' }`) is not
 * flagged. Widening the selector to reach inside `attr` would reintroduce that false
 * positive; a reviewer satisfying the a11y gate with an `aria-label` literal is the
 * backstop this rule does not have.
 *
 * `[value=/\S/]` rather than bare `Literal`: an empty string or a whitespace-only one
 * (`el.setText('')` to clear an element, or a padding space) carries no user-visible
 * text, so it has nothing to translate and is exempt rather than flagged.
 */
const TEXT_KEY = ":matches(Property[key.name='text'], Property[key.value='text'])";
const I18N_LITERAL_BAN = [
	{
		selector: "CallExpression[callee.property.name='setText'] > Literal[value=/\\S/]",
		message:
			"setText received a literal string. Route user-visible text through t/tr in src/presentation/i18n/ (see docs/requirements/Multilanguage.md).",
	},
	{
		selector: `CallExpression[callee.property.name=/^(createEl|createDiv|createSpan)$/] > ObjectExpression.arguments > ${TEXT_KEY} > Literal.value[value=/\\S/]`,
		message:
			"createEl/createDiv/createSpan's text option received a literal string. Route user-visible text through t/tr in src/presentation/i18n/ (see docs/requirements/Multilanguage.md).",
	},
];

export default defineConfig([
	{
		// Everything that is not this plugin's source. The build scripts are Node, not
		// plugin code, so the Obsidian ruleset does not apply to them; `.obsidian/` is the
		// test-build vault. This list is load-bearing for EVERY run — `npm run lint` is
		// `eslint .`, so the CLI walks the whole tree exactly like an editor does, and a
		// type-aware rule on a file outside tsconfig crashes the run.
		ignores: [
			'node_modules/**',
			'coverage/**',
			'dist/**',
			'.obsidian/**',
			'.claude/**',
			'scripts/**',
			'docs/**',
			'**/*.md',
			'eslint.config.mjs',
			'vitest.config.ts',
			'vite.config.ts',
			'vite.harness.config.ts',
		],
	},
	{
		/**
		 * No comment in a linted file may reconfigure the linter. `no-restricted-syntax`
		 * carries the vault write boundary and `no-restricted-imports` carries the layers,
		 * and BOTH are ESLint-only — oxlint has no `no-restricted-syntax` at all — so a
		 * single block comment reading `eslint no-restricted-syntax: off` used to turn the
		 * architecture check off with nothing able to report it. Measured, on `src/`: the
		 * write-boundary error disappeared and `npm run check` stayed green. (Spelled
		 * without its delimiters here because it is a block comment inside one, and a
		 * zero-width space to fake them would be an invisible character in linted source.)
		 *
		 * `noInlineConfig` rather than a rule, because it refuses the whole class — the
		 * disable directives AND the rule-configuration form, which carries no directive
		 * keyword and so is invisible to a scan for one — for code not yet written. The
		 * ruleset's own `reportUnusedDisableDirectives` and `reportUnusedInlineConfigs` see
		 * only the comments that affect nothing, which is the harmless half.
		 *
		 * No `files` key, so it applies to everything ESLint lints here; a comment that now
		 * does nothing is reported, and `--max-warnings 0` fails on it. The complement is
		 * `tests/build/suppressions.test.ts`: oxlint keeps its own directive handling, and
		 * nothing in ESLint's configuration reaches that.
		 */
		linterOptions: { noInlineConfig: true },
	},
	...pluginRules,
	{
		// The ruleset's own manifest validation — the bot's naming, typing and
		// description rules — guards itself: `if the linted file is not manifest.json,
		// return`. The recommended config switches the rule ON (for TS files, where that
		// guard makes it a no-op) but supplies no block that actually lints the
		// manifest, so without THIS block the rule never fires and `manifest.json` is
		// "ignored because no matching configuration was supplied".
		//
		// The parser is the TS parser, NOT a JSON parser, and that is what the rule is
		// built for: it walks TSESTree ObjectExpression nodes, which
		// `jsonc-eslint-parser` does not produce (measured — every manifest, valid or
		// not, reported "must be a single JSON object" under it).
		files: ['manifest.json'],
		plugins: { obsidianmd },
		languageOptions: { parser: tsparser },
		rules: { 'obsidianmd/validate-manifest': 'error' },
	},
	forbidden(
		'core',
		{
			groups: ['domain', 'application', 'infrastructure', 'presentation', 'plugin'],
			packages: PRESENTATION_AND_HOST,
		},
		'core/ is generic technical ground — geometry, units, money, ids, results, events. It knows nothing about renovation and nothing about a host.',
	),
	forbidden(
		'domain',
		{ groups: ['application', 'infrastructure', 'presentation', 'plugin'], packages: PRESENTATION_AND_HOST },
		'domain/ decides what a Zone or a WorkPackage IS. A Konva polygon, a Pinia object and a Markdown file are representations of it, so it may name none of them (SDD §3.3, §3.4).',
	),
	forbidden(
		'application',
		{ groups: ['infrastructure', 'presentation', 'plugin'], packages: PRESENTATION_AND_HOST },
		'application/ coordinates use cases against PORTS it declares itself. Infrastructure implements those ports and the composition root wires them; an import the other way inverts the dependency the ports exist to create.',
	),
	forbidden(
		'infrastructure',
		{ groups: ['presentation', 'plugin'], packages: ['vue', 'pinia', 'konva', 'vue-konva'] },
		'infrastructure/ implements the ports the inner layers declare. It may name obsidian — that is its job — but nothing about how anything is drawn.',
	),
	forbidden(
		'presentation',
		{ groups: ['infrastructure', 'plugin'] },
		'presentation/ talks to application/, never to a repository directly. What it gets handed is composed in plugin/.',
	),
	{
		// -- invariants that are checked rather than described ----------------------
		// Everything in src/ EXCEPT the sanctioned writer: `src/infrastructure/obsidian/`
		// is where the write-boundary messages say writes belong, so the boundary must
		// not fire there — otherwise the first real repository meets a rule whose cheap
		// escapes (an inline disable, renaming the local off `vault`) are exactly what
		// this config forbids. The carve-out is built now, under no pressure, because
		// two flat-config blocks matching one file OVERRIDE `no-restricted-syntax`
		// rather than merging it: the block below repeats the shared SVG selectors for
		// that reason, and any further carve-out must do the same. `**/`-anchored like
		// every other block, for the base-path reason TESTS states.
		// Both globs literally rather than routed through `srcFiles`: `**/src/**/**/*.ts` is
		// a needlessly clever spelling of the same set.
		files: ['**/src/**/*.ts', '**/src/**/*.vue'],
		ignores: ['**/src/infrastructure/obsidian/**'],
		rules: { 'no-restricted-syntax': ['error', ...WRITE_BOUNDARY, ...SVG_CLASS_TOKENS, ...I18N_LITERAL_BAN] },
	},
	{
		// The sanctioned writer. Vault writes are this directory's job; every OTHER
		// shared ban still applies, restated per the override warning above — including
		// I18N_LITERAL_BAN: infrastructure/obsidian/ may show its own UI (a Notice, an
		// error surface) and that text is exactly as translatable as a view's.
		files: srcFiles('infrastructure/obsidian'),
		rules: { 'no-restricted-syntax': ['error', ...SVG_CLASS_TOKENS, ...I18N_LITERAL_BAN] },
	},
	{
		// SDD §3.4 prohibits DOM APIs in domain/ and core/, not only the framework
		// packages: the host-free layers may not reach the browser either. A DIFFERENT
		// rule key than the block above, so the two merge rather than override. Named
		// globals rather than a category — this check sees exactly these spellings.
		files: [...srcFiles('core'), ...srcFiles('domain')],
		rules: {
			'no-restricted-globals': [
				'error',
				...['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'fetch', 'HTMLElement', 'Element', 'customElements'].map(
					(name) => ({ name, message: 'core/ and domain/ are host-free (SDD §3.4): no DOM or browser APIs.' }),
				),
			],
		},
	},
	{
		// Everything but `test/`, rather than `src/**` by name: a `files` pattern is
		// matched against the LINTER's base path, so a run whose working directory is not
		// this one — which is what an editor's ESLint server may be — matches this block
		// on none of its files, leaving the Obsidian ruleset's type-aware rules to run
		// with no type information at all.
		files: ['**/*.ts'],
		ignores: [TESTS],
		languageOptions: {
			parser: tsparser,
			// Likewise `project: './tsconfig.json'` resolves against the working
			// directory. The project service is what the TypeScript language server
			// itself uses, and the root is pinned to this file rather than to whoever
			// invoked eslint.
			parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
		},
		rules: {
			// Un-awaited promises around vault writes silently reorder them; force every
			// async call site to await or explicitly void.
			'@typescript-eslint/no-floating-promises': 'error',
			// Size and complexity budgets keep modules focused and reviewable.
			'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
			'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
			complexity: ['error', 16],
			'max-depth': ['error', 4],
			'max-params': ['error', 5],
			// Logging goes through the Logger port (application/ports/), which the
			// composition root injects. No allowances, console.error included: the reason
			// to permit that one was that there was nothing else to call, and the port is
			// what removes it. The sink itself is carved out below.
			'no-console': 'error',
		},
	},
	...vueRules,
	{
		files: VUE_FILES,
		languageOptions: {
			parser: vueParser,
			// The TypeScript parser INSIDE the SFC, so `<script setup lang="ts">` parses.
			// Deliberately without `projectService`: type-aware linting of SFCs needs
			// `extraFileExtensions` and a file the project service can resolve, which the
			// fixture technique in tests/build/vue-rules.test.ts cannot supply. So
			// `@typescript-eslint/no-floating-promises` stays on `.ts` only, and the first
			// SFC with an async call site is the trigger to wire the type-aware half.
			parserOptions: { parser: tsparser },
		},
		rules: {
			// Each of these six is the CHECK under a rule in docs/setup/vue-conventions.md,
			// and `flat/recommended` enables none of them.
			'vue/component-api-style': ['error', ['script-setup']],
			'vue/block-lang': ['error', { script: { lang: 'ts' } }],
			'vue/define-props-declaration': ['error', 'type-based'],
			'vue/define-emits-declaration': ['error', 'type-based'],
			// This project's override of Vue's scoped-styles guidance: the marketplace
			// rejects inline styles and the plugin's CSS is assembled from `styles/`.
			'vue/no-restricted-block': ['error', 'style'],
			'vue/component-name-in-template-casing': ['error', 'PascalCase'],
			// `flat/recommended` brings `vue/html-indent` defaulting to TWO SPACES, and this
			// repository indents with tabs — `.ts`, `.vue`, `.json` and `.css` alike. Told the
			// project's format rather than reformatting one file away from every other: a
			// formatting rule has no opinion worth overriding the project's with. Checked by a
			// fixture in tests/build/vue-rules.test.ts, so this is not a silencing.
			'vue/html-indent': ['error', 'tab'],
			// The budgets and the console ban the `**/*.ts` block gives every other file.
			// Repeated rather than inherited: that block is `.ts`-scoped by design, since
			// its parser options are.
			'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
			'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
			complexity: ['error', 16],
			'max-depth': ['error', 4],
			'max-params': ['error', 5],
			'no-console': 'error',
		},
	},
	{
		// The one directory whose job IS the console. A per-directory block REPLACES this
		// rule for these files rather than merging with it — the same flat-config
		// behaviour `no-restricted-syntax` has to work around, wanted here — so this block
		// sets that one rule and nothing else, leaving the budgets above in force.
		// It matches nothing until slice 1's console sink lands there, for the reason every
		// other rule here predates its first violation: enforce before it can be broken.
		//
		// NOT a blanket permission, and the difference is measured rather than assumed:
		// the obsidianmd ruleset carries its own console check for the marketplace's
		// "avoid unnecessary logging" guideline, which fails `console.log` and
		// `console.info` while passing `console.debug`, `console.warn` and `console.error`.
		// So the sink maps `info` onto console.debug and carries the level in the line's
		// own text. See design slice 1, "Logging, from the first line that can fail".
		//
		// WHY that rule is not switched off here, since it plainly could be: a config-level
		// `'obsidianmd/rule-custom-message': 'off'` in this very block would work, and
		// `noInlineConfig` above already refuses the comment form repo-wide, so neither of
		// those is the reason. The reason is that the marketplace review bot lints a
		// submission with ITS OWN configuration, not with this file — an override here
		// would not travel, and the rejection would arrive at submission instead of at
		// `npm run check`. Keeping the rule on is what makes the gate agree with the
		// reviewer.
		//
		// Both halves of the claim above are pinned by `tests/build/logging-carve-out.test.ts`,
		// because both are one upstream release from being false: the glob is asked of
		// ESLint's own resolution, and — the fragile one — the obsidianmd rule is a WRAPPER
		// that matches the built-in rule's rendered message against a literal and reports
		// NOTHING on a miss. A reworded message would turn the marketplace check off here
		// silently.
		files: srcFiles('infrastructure/logging'),
		rules: { 'no-console': 'off' },
	},
	{
		files: [`${TESTS}/*.ts`],
		extends: [tseslint.configs.recommended],
		languageOptions: { parser: tsparser },
		rules: {
			// `src/` had a size budget and `test/` had none, which is how one view suite
			// grew to 59% of all test code in the source project while every source file
			// stayed in budget. The cap is looser than src/'s 400 — a test file is mostly
			// fixture setup — and it is there to force a split by subject long before a
			// file becomes the place tests go to hide.
			'max-lines': ['error', { max: 450, skipBlankLines: true, skipComments: true }],
			// The harness deliberately reaches past the view's public surface.
			'@typescript-eslint/no-explicit-any': 'off',
			// A stand-in has to accept the arguments the real API is called with, whether
			// or not the fake reads them; the underscore says so.
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
		},
	},
]);
