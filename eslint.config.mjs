import tsparser from '@typescript-eslint/parser';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import { DEFAULT_ACRONYMS } from 'eslint-plugin-obsidianmd/dist/lib/rules/ui/acronyms.js';

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
 * Every extension `src/` can compile into the built plugin — not the extensions the tree
 * happens to hold today. `tsconfig.json` sets `allowJs: true`, which is TypeScript's own
 * JavaScript bucket: `.js`, `.jsx`, `.mjs`, `.cjs`, alongside `.ts`. Vite's bundler resolves
 * and transforms every one of those on `import` regardless of what tsconfig's `include`
 * names — Rollup/esbuild do not consult it — so `allowJs` is not a formality here, it is
 * the difference between a `.js` file under `src/` shipping in `dist/main.js` and not.
 * `.tsx`, `.mts` and `.cts` are TypeScript's OWN extension bucket, native regardless of
 * `allowJs`, and Vite-resolvable the same way `.ts` is (`.cts` is not in Vite's own
 * extension-less resolution list, but still compiles from an import that names it
 * explicitly) — so the BAN covers all three, same as every other extension here.
 *
 * What those three do NOT get is a TEST, and that is a narrower claim than the rest of
 * this list gets — said plainly, because leaving it unsaid is the defect this repository's
 * own guide refuses. `eslint-plugin-obsidianmd`'s own recommended config applies
 * `tseslint.configs.recommendedTypeChecked` to `**\/*.{ts,cts,mts,tsx}`, and the only block
 * in this file giving typescript-eslint's parser type information (`parserOptions.projectService`)
 * is scoped to `files: ['**\/*.ts']` — `.cts`/`.mts`/`.tsx` get none. Measured against BOTH
 * a nonexistent path (what this test file's fixtures use for `.vue`/`.js`) and a REAL file
 * written to `src/` and then removed: both throw the identical
 * `@typescript-eslint/await-thenable` error, which is what says the gap is the missing
 * `parserOptions` itself, not a project-service "file not found" the way an absent `.ts`
 * path was. No fixture this test file can build reaches them, so it does not try —
 * banning them costs nothing (a glob matching no file on disk is free; `npm run lint`
 * stays green with zero `.tsx`/`.mts`/`.cts` files under `src/` today), but PROVING the ban
 * fires for them would need this file's own `parserOptions.projectService` gap closed
 * first, which is a bigger, unrelated fix. `.json` is resolvable too but cannot contain an
 * `import` statement, so there is nothing here for `no-restricted-imports` to catch.
 *
 * Every extension for one `src/` subtree. A block widened on the ban but not on its
 * carve-out fails INWARD — the sink's own `.js` files would be the one place a `.js` file
 * could not use the console — so every caller is spelled by the same function.
 *
 * What actually catches a forgotten block is `tests/build/vue-rules.test.ts` (`.vue`) and
 * `tests/build/prototypes-one-way-door.test.ts` (`.ts` and `.js`, the root-of-`src/` block
 * below) — `.tsx`, `.mts` and `.cts` are the three extensions this helper covers that no
 * test drives, for the reason above. This helper only makes the spellings impossible to
 * write apart by hand; it does not make every one of them equally verified.
 */
const SRC_EXTENSIONS = ['ts', 'tsx', 'mts', 'cts', 'vue', 'js', 'jsx', 'mjs', 'cjs'];
const srcFiles = (subtree) => SRC_EXTENSIONS.map((ext) => `**/src/${subtree}/**/*.${ext}`);

/** Every SFC under `src/`, and the only files any Vue rule may be pointed at. */
const VUE_FILES = ['**/src/**/*.vue', '**/tests/harness/**/*.vue'];

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
 * The three glob shapes ONE banned group name expands to: bare (the barrel spelling,
 * `import … from '../prototypes'`), one level (`../prototypes/X`), and any depth
 * (`../../a/prototypes/X`). `forbidden()`'s own `groups.flatMap` computes exactly this
 * shape for every OTHER group it bans; `prototypes` needs its own copy of the same three
 * because the root-of-`src/` block and the catch-all block below both ban ONLY this one
 * group, from OUTSIDE `forbidden()`'s machinery — one constant so the two cannot spell it
 * differently from each other, or from what `forbidden()` would have computed.
 */
/**
 * Design slice 11's Definition of Done item 7 — "no dependency on a network client,
 * analytics SDK, or remote endpoint exists in `infrastructure/logging/` or the diagnostics
 * query" — as a rule rather than as an inspection. Nothing checked it: the diagnostics
 * snapshot is content-free BY POLICY and never leaves the device BY POLICY, and both
 * policies were one edit away from being false with `npm run check` green.
 *
 * The two directories are where the snapshot is assembled and where refusals accumulate,
 * which makes them the two places a "just send us the diagnostics" line would be written.
 *
 * **What these lists SEE**, because a guarantee wider than its check is this repository's
 * most expensive recurring defect:
 *
 * - `NETWORK_GLOBALS` are bare identifier references, which is what `no-restricted-globals`
 *   resolves — `fetch(...)` and `navigator.sendBeacon(...)`. `window`, `globalThis` and
 *   `self` are in the list for the indirect spelling (`globalThis.fetch`), not because a
 *   host object is otherwise interesting here. Neither directory names any of them today,
 *   which is what made adopting them one line each.
 * - `NETWORK_MODULES` and `NETWORK_MEMBERS` are static `import` specifiers. `requestUrl`
 *   and `request` are Obsidian's own network door and they are IMPORTS, not globals, so
 *   they need the member half of the rule — and `application/` already bans the whole
 *   `obsidian` package, so the member ban is added only where the package itself is legal,
 *   which is `infrastructure/`.
 *
 * **What they CANNOT see**: a dynamic `import()`; a global reached through a computed
 * member (`globalThis['fetch']`); a network call made in a module these two directories
 * merely CALL rather than import from — the ban is per-directory, so a helper elsewhere in
 * `infrastructure/` that fetches is invisible here; and a dependency that wraps one of
 * these, since a package name nobody listed is a package this rule has never heard of.
 * `npm run analyze`'s dependency hygiene sees packages but not calls, so nothing else in
 * the gate closes those. `tests/build/network-boundary.test.ts` pins each blind spot as an
 * absence rather than leaving it in prose.
 */
/**
 * `eslint-plugin-obsidianmd`'s OWN `no-restricted-globals` list, read out of its config
 * rather than copied — and this constant exists because of a trap sprung during the review
 * that added the network ban below.
 *
 * That plugin bans `app`, `fetch` and `localStorage` across every file in `src/`, at `warn`
 * (which `--max-warnings 0` fails anyway). Two flat-config blocks matching one file OVERRIDE
 * `no-restricted-globals` rather than merging it — the same trap this file documents twice
 * for `no-restricted-syntax` and `no-restricted-imports` — so ANY later block naming that
 * rule for a subtree of `src/` silently takes the marketplace's three bans away from it. The
 * `core`/`domain` DOM block below had already done exactly that: it happens to restate
 * `fetch` and `localStorage`, so the loss was invisible, but `app` — the global the
 * marketplace review bot actually rejects plugins for — has not been banned in `core/` or
 * `domain/` since that block was written.
 *
 * Derived rather than transcribed, because a hand copy is the second list this repository
 * keeps paying for: a global the plugin adds in a future version would reach every directory
 * except the ones that had restated its list. The severity element is dropped (index 0) and
 * the options are deduplicated by name, LAST WINS — so a caller appending its own entry for
 * a name the plugin also bans replaces the message with the one that fits its subtree, which
 * is what `NETWORK_GLOBALS` does for `fetch`: the plugin's advice there is "use `requestUrl`
 * instead", and `requestUrl` is precisely what the network ban also refuses. In these two
 * directories the point is not to make the request a different way.
 *
 * A bare string entry is `no-restricted-globals`' other accepted spelling (a name with no
 * message); the plugin's list contains one by accident, and it is carried through as-is
 * rather than filtered, because narrowing someone else's ban is not this constant's job.
 */
const namedGlobals = (...entries) => [
	...new Map(entries.flat(Infinity).map((entry) => (typeof entry === 'string' ? { name: entry } : entry)).map((entry) => [entry.name, entry])).values(),
];
const OBSIDIAN_RESTRICTED_GLOBALS = namedGlobals(
	obsidianmd.configs.recommendedWithLocalesEn.map((config) => (config.rules?.['no-restricted-globals'] ?? []).slice(1)),
);

const NETWORK_REASON =
	'Diagnostics are computed on demand and never leave the device (SDD §68, §86). infrastructure/logging/ and application/queries/ may not reach the network — no fetch, no socket, no requestUrl, no beacon.';
const NETWORK_GLOBALS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'navigator', 'window', 'globalThis', 'self'];
const NETWORK_MODULES = ['http', 'https', 'http2', 'net', 'tls', 'dgram', 'node:http', 'node:https', 'node:http2', 'node:net', 'node:tls', 'node:dgram', 'electron'];
const NETWORK_MEMBERS = [{ name: 'obsidian', importNames: ['request', 'requestUrl'] }];

/**
 * A layer ban PLUS the network ban, for a subtree that has both.
 *
 * It composes `forbidden(...)`'s own output rather than restating a layer's groups and
 * packages, and that is the whole point: two flat-config blocks matching one file OVERRIDE
 * `no-restricted-imports` rather than merging it, so a block for `src/application/queries/`
 * written by hand would replace the `application` layer ban with a network-only rule —
 * quietly letting a query import a repository while looking like it had closed a hole.
 *
 * The caller passes the SAME OBJECT its parent layer is built from — `APPLICATION_LAYER` and
 * `INFRASTRUCTURE_LAYER` above — never a copy of its contents. The first version of these two
 * blocks transcribed the groups, the packages and the reason string character for character,
 * which made them a second list: a group added to the parent would have reached the layer and
 * not the subtree, and the survival cases in the test can only name the groups that exist
 * today. Sharing the constant is what makes divergence impossible rather than merely absent.
 *
 * `tests/build/network-boundary.test.ts` still checks the outcome instead of trusting the
 * sharing: it drives a cross-layer import through these paths the way `vue-rules.test.ts`
 * does for `presentation/dialogs/`, AND compares each subtree's resolved ban against its
 * parent's for superset, which is what would catch an un-hoisting.
 *
 * `no-restricted-globals` is a different rule KEY from anything else matching these files,
 * so it merges rather than overrides — the same relationship the `core`/`domain` DOM block
 * below has with the write-boundary block above it.
 */
const networkFree = (layer, layerBan, reason) => {
	const base = forbidden(layer, layerBan, reason);
	const [, options] = base.rules['no-restricted-imports'];
	const members = NETWORK_MEMBERS.filter(({ name }) => !(layerBan.packages ?? []).includes(name));
	return {
		files: base.files,
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [
						...options.paths,
						...NETWORK_MODULES.map((name) => ({ name, message: NETWORK_REASON })),
						...members.map((member) => ({ ...member, message: NETWORK_REASON })),
					],
					patterns: [...options.patterns, { group: NETWORK_MODULES.map((name) => `${name}/*`), message: NETWORK_REASON }],
				},
			],
			'no-restricted-globals': [
				'error',
				...namedGlobals(OBSIDIAN_RESTRICTED_GLOBALS, NETWORK_GLOBALS.map((name) => ({ name, message: NETWORK_REASON }))),
			],
		},
	};
};

const PROTOTYPES_GROUP = ['**/prototypes', '**/prototypes/*', '**/prototypes/**/*'];

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
 * The two layer bans that have a SECOND block below repeating them, hoisted so the repeat
 * cannot be a transcription.
 *
 * `networkFree('application/queries', …)` and `networkFree('infrastructure/logging', …)`
 * exist only to survive the flat-config override — two blocks matching one file replace
 * `no-restricted-imports` rather than merging it — so each has to restate its parent
 * layer's ban verbatim. Spelling that restatement out by hand made it a SECOND LIST, which
 * is the exact defect the network work was fixing: a group added to `forbidden('application', …)`
 * would silently not reach `application/queries/`, and nothing would report it, because the
 * survival cases in `tests/build/network-boundary.test.ts` can only name the groups that
 * exist today.
 *
 * One constant per layer, passed to BOTH calls, so divergence is not something a reviewer
 * has to notice. `tests/build/network-boundary.test.ts` still checks the outcome rather than
 * trusting this: it compares the two subtrees' RESOLVED configs against their parents' and
 * requires a superset, which catches an un-hoisting as well as an omission.
 *
 * `presentation/dialogs` is deliberately NOT hoisted with them: its list is a genuine
 * superset of `presentation`'s (it adds `application` and `core/events`), so there is
 * nothing there for two callers to share.
 */
const APPLICATION_LAYER = {
	ban: { groups: ['infrastructure', 'presentation', 'plugin', 'prototypes'], packages: PRESENTATION_AND_HOST },
	reason:
		'application/ coordinates use cases against PORTS it declares itself. Infrastructure implements those ports and the composition root wires them; an import the other way inverts the dependency the ports exist to create.',
};
const INFRASTRUCTURE_LAYER = {
	ban: { groups: ['presentation', 'plugin', 'prototypes'], packages: ['vue', 'pinia', 'konva', 'vue-konva'] },
	reason:
		'infrastructure/ implements the ports the inner layers declare. It may name obsidian — that is its job — but nothing about how anything is drawn.',
};

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
 * `SKU` is this plugin's own vocabulary (design "Asset library overview" §5, §8's
 * `view.asset-library.sku`) and `sentence-case-locale-module`'s default acronym list does not
 * carry it — measured: `SKU` mid-sentence is reported wanting `sku`. The fix widens the
 * RULE's vocabulary rather than the product's, per the ruling on that finding: changing what
 * the field is called to satisfy a linter's word list is the wrong direction.
 *
 * `DEFAULT_ACRONYMS` is imported from the rule's own module rather than hand-copied, for the
 * same reason `OBSIDIAN_RESTRICTED_GLOBALS` below reads its list out of the plugin's config
 * instead of transcribing it: a future acronym the plugin adds upstream reaches this list too,
 * rather than silently falling behind a frozen copy. There is no public export for it — the
 * plugin's `configs` object carries only the ASSEMBLED rule configuration (severity, no
 * options), never a rule's internal default options — so this is a deep import into the
 * package's build output. It is read at CONFIG time, in a file that is not part of the shipped
 * bundle, which is a different exposure than reaching into vendor internals from `src/`.
 *
 * The `files` list is DERIVED from `recommendedWithLocalesEn` itself — the one config block
 * whose `rules` names `sentence-case-locale-module` — rather than retyped, so this override
 * cannot drift from the glob the rule is actually scoped to; `assetSkuAcronymRule.test.ts`
 * pins that the derivation finds something (a stale plugin-internal path would otherwise make
 * this whole block a no-op silently).
 */
const localeModuleFiles = obsidianmd.configs.recommendedWithLocalesEn.find(
	(c) => c.rules?.['obsidianmd/ui/sentence-case-locale-module'] !== undefined,
)?.files;
const ASSET_LIBRARY_ACRONYMS = [...DEFAULT_ACRONYMS, 'SKU'];

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
/**
 * `addCommand`'s own copy key, spelled both ways for the reason `TEXT_KEY` is: an object
 * literal may write `name:` or `'name':`, and the two are different AST shapes.
 */
const NAME_KEY = ":matches(Property[key.name='name'], Property[key.value='name'])";
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
	/**
	 * The two REGISTRATION doors, added by design slice 21's improvement pass. Its own task
	 * document had recorded `addCommand({ name })` as a gap this rule could not see —
	 * measured, a raw English literal there reported nothing but the fixture's own
	 * `no-unsafe-*` noise — and left it on the grounds that widening "touches every existing
	 * call site's evidence". Re-measured: it touches none. All five `addCommand` calls and the
	 * one `addRibbonIcon` in `src/` already pass `tr(...)`, which is a `CallExpression` and not
	 * a `Literal` at the position these check, so the widening is green on the tree it lands
	 * on and refuses the next author who forgets.
	 *
	 * A command's `name` and a ribbon's title are the two user-visible strings Obsidian's own
	 * registration API takes, and they are the two most likely to be written as English by
	 * somebody adding a command: neither goes through a DOM helper, so neither is reachable
	 * from the four call sites above. `id` is deliberately NOT covered — a command id is DATA
	 * a user's hotkey binds to, so a literal there is correct.
	 *
	 * The ribbon selector keys on the ARGUMENT LIST rather than on a position, because
	 * `addRibbonIcon(icon, title, callback)` takes its icon as a literal too: `[arguments.0]`
	 * pins the icon and `[arguments.1]` is what this refuses, so the two cannot be confused by
	 * a selector that merely says "a literal somewhere in this call".
	 *
	 * Blind spots, the same three every selector in this file has and asserted as such in
	 * `tests/build/i18n-literal-boundary.test.ts`: a literal held in a variable first, a
	 * TEMPLATE literal (a different node type), and a call reached through a name other than
	 * these two.
	 */
	{
		selector: `CallExpression[callee.property.name='addCommand'] > ObjectExpression.arguments > ${NAME_KEY} > Literal.value[value=/\\S/]`,
		message:
			"addCommand's name received a literal string. Route user-visible text through t/tr in src/presentation/i18n/ (see docs/requirements/Multilanguage.md). The command's id is data and stays a literal.",
	},
	{
		selector: "CallExpression[callee.property.name='addRibbonIcon'] > Literal.arguments:nth-child(2)[value=/\\S/]",
		message:
			"addRibbonIcon's title received a literal string. Route user-visible text through t/tr in src/presentation/i18n/ (see docs/requirements/Multilanguage.md). The icon name beside it is data and stays a literal.",
	},
];

/**
 * Design slice 11's Definition of Done, item 3, at the forbidden call:
 *
 * > A user-facing error message never contains a raw exception message, stack trace, or
 * > internal file path, and is produced by `t()` from the locale tables rather than by a
 * > literal or by `AppError.message`.
 *
 * Nothing checked that. `notify(message: string)` accepts any string, and
 * `I18N_LITERAL_BAN` above reaches exactly six call sites — `.setText`, the `text:` option of
 * `createEl`/`createDiv`/`createSpan`, `addCommand`'s `name` and `addRibbonIcon`'s title — of
 * which a `notify(...)` argument is none. (It was FOUR when this paragraph was written; the
 * last two arrived with design slice 21's improvement pass and neither is a notice either.) So the whole notice door sat outside every gate: two raw `Error.message` notices
 * shipped, and design slice 10's twenty-odd error codes reached users as the wrong
 * category sentence, with `npm run check` green throughout. It is a category invariant —
 * "no developer text reaches a Notice" cannot be verified by driving the call sites
 * someone thought of, because the next call site is the one that breaks it — so it is a
 * rule at the call, by the same argument that put `WRITE_BOUNDARY` and
 * `I18N_LITERAL_BAN` there.
 *
 * The doors it watches are `notify(...)`, `notifySuccess(...)` and `notifyWarning(...)` —
 * the three string-taking wrappers in `src/presentation/notices/notify.ts` — and
 * `new Notice(...)` (Obsidian's own constructor, so bypassing the wrappers is not an
 * escape). `notifyError` and `notifyFault` need no selector: they take an `AppError` and an
 * unknown cause, not a string, and resolve the user's sentence themselves.
 *
 * The spellings these SEE, honestly:
 *
 *   - `.message` or `.stack` read ANYWHERE inside the call — a descendant combinator, not
 *     a child one, so a bare `notify(err.message)`, a wrapped `notify(format(e.message))`
 *     and an interpolated one are all refused. The correct shapes contain no such member
 *     access at all and pass untouched, which is the whole mechanism: `notify(tr('key'))`
 *     for TEXT, and — for an `AppError` — `notifyError(result.error)`, which takes the
 *     error rather than a string and never reaches these selectors at all.
 *     `notify(toUserMessage(getLanguage(), result.error))` would ALSO pass, and it is not
 *     a shape this repository uses any more: `notifyError` is the one door an `AppError`
 *     takes to a notice, so slices 13 and 17 change what an error notice is in ONE place.
 *     That last part is a convention a reviewer holds, not something these selectors can
 *     see — a rule refusing it would have to refuse `toUserMessage` at a notice, which is
 *     exactly what `notifyError` does internally.
 *   - a bare string LITERAL as a direct argument, which is the "rather than by a literal"
 *     half. `[value=/\S/]` for the reason `I18N_LITERAL_BAN` gives: an empty or
 *     whitespace-only string carries nothing to translate.
 *
 * What they CANNOT see, pinned as absences in `tests/build/notice-text-boundary.test.ts`
 * rather than left in prose:
 *
 *   - a value one hop away — a local assigned `error.message` and then passed — the same
 *     blind spot `I18N_LITERAL_BAN` and `WRITE_BOUNDARY` both declare, and a reviewer is
 *     the backstop for all three.
 *   - a TEMPLATE literal carrying raw English with no member access in it, which is a
 *     TemplateLiteral node and not a Literal — again exactly where `I18N_LITERAL_BAN`
 *     stops.
 *   - a differently-named local alias of `notify`/`notifySuccess`/`notifyWarning`, and a
 *     notice raised through a re-exported wrapper under another name. `notify`,
 *     `notifySuccess`, `notifyWarning` and `Notice` are the four names this repository
 *     uses; a fifth would need adding here.
 *   - any of the four doors reached through a MEMBER EXPRESSION: `o.notify(e.message)`,
 *     `o.notifySuccess(e.message)` and `new n.Notice(e.message)` alike. This is the CALL
 *     FORM rather than a name gap — all four selectors key on `callee.name`, and a
 *     MemberExpression callee has none, so the same functions escape whenever they are
 *     reached through an object. All four are called bare everywhere here; closing it
 *     would mean a second set of selectors on `callee.property.name`, which would then
 *     also refuse every unrelated `x.notify(…)`.
 *
 * Narrowing `notify`'s PARAMETER TYPE to a branded "came from the locale tables" string
 * was the other candidate and is refused for now: `t`, `tr` and `toUserMessage` all return
 * `string` and are consumed by dialogs, components and templates, so the brand would have
 * to travel through every one of them to buy what these two selectors buy at the door.
 * Worth revisiting when a second string-producing seam appears — it would close the
 * one-hop hole a selector structurally cannot.
 */
const NOTICE_DOOR =
	":matches(CallExpression[callee.name=/^(notify|notifySuccess|notifyWarning)$/], NewExpression[callee.name='Notice'])";
const NOTICE_TEXT_BAN = [
	{
		selector: NOTICE_DOOR + " MemberExpression[property.name=/^(message|stack)$/]",
		message:
			"A notice received an error's own message or stack. That is developer English written for a log line (SDD 65): pass the AppError to notifyError, or a thrown fault to notifyFault, which resolve the user's sentence from the locale tables.",
	},
	{
		selector: NOTICE_DOOR + " > Literal[value=/\\S/]",
		message:
			'A notice received a literal string. Route user-visible text through t/tr in src/presentation/i18n/ (see docs/requirements/Multilanguage.md).',
	},
];

/**
 * `src/presentation/i18n/strings.ts` is THE one place the app language is resolved, as a
 * rule rather than as a sentence in that file's docblock.
 *
 * The sentence came first and did not entail its own claim: it said `tr` and `trError` both
 * come through `currentLanguage()`, "so no call site re-decides it" — which says nothing at
 * all about a THIRD call site, and nothing stopped one appearing. It was true only because
 * somebody had counted, on a branch whose entire subject was claims wider than their checks.
 *
 * Two selectors, and both are IMPORT-or-ACCESS shapes rather than a call:
 *
 * - the named import (`import { getLanguage } from 'obsidian'`), which is the spelling every
 *   file here uses, and
 * - any `.getLanguage` member access, which is the namespace spelling
 *   (`import * as obsidian`; `obsidian.getLanguage()`). No object in this repository has a
 *   `getLanguage` member of its own, so the wider selector costs nothing today — and if one
 *   ever does, this is where the exception gets argued rather than a hole nobody notices.
 *
 * A dynamic `import('obsidian')` is NOT a hole, which is worth stating because the first
 * draft of this paragraph listed it as one: the specifier is invisible to the first selector,
 * but `(await import('obsidian')).getLanguage()` still has to reach the function through a
 * member access, and the second selector is about `.getLanguage` rather than about `obsidian`.
 * Measured rather than reasoned — the case is in the test file, as a REACH.
 *
 * **What it cannot see**: a destructured dynamic import (`const { getLanguage } = await
 * import('obsidian')`), which leaves neither an `ImportSpecifier` nor a member access; a
 * computed member access (`obsidian['getLanguage']`); and the language re-decided from
 * something OTHER than `getLanguage` — a hard-coded `'de'`, a plugin-local setting. The last
 * of those is the defect the docblock actually fears, and no selector reaches it; the two
 * above are the doors it would come through.
 *
 * `no-restricted-syntax` rather than `no-restricted-imports`, which is where the wrong
 * choice would have been expensive. `no-restricted-imports` already carries the LAYER BANS,
 * and two flat-config blocks matching one file override a rule rather than merging it — so
 * reaching every subtree of `src/` through that key means editing six blocks, each of which
 * silently deletes a layer ban if it forgets to restate one. This key is already the one the
 * repository's other policy bans live on, and the two blocks below cover ALL of `src/`
 * between them, so the category costs two spreads and one carve-out. ESLint-only either way:
 * oxlint has no `no-restricted-syntax`, so the edit-loop hook cannot see this rule.
 *
 * `tests/build/language-resolution-boundary.test.ts` drives both selectors, the carve-out and
 * the blind spots through real fixture paths.
 */
const LANGUAGE_RESOLUTION_BAN = [
	{
		selector: "ImportDeclaration[source.value='obsidian'] > ImportSpecifier[imported.name='getLanguage']",
		message:
			"The app language is resolved in exactly one place: currentLanguage() in src/presentation/i18n/strings.ts. Call tr/trError, or t(language, key) with the language you were handed, rather than resolving it a second time here.",
	},
	{
		selector: "MemberExpression[property.name='getLanguage']",
		message:
			"The app language is resolved in exactly one place: currentLanguage() in src/presentation/i18n/strings.ts. Call tr/trError, or t(language, key) with the language you were handed, rather than resolving it a second time here.",
	},
];

/**
 * The `no-restricted-syntax` selectors EVERY file in `src/` carries, hoisted because three
 * blocks below now spread them and a hand-restated third copy is how the write boundary's
 * own extension list went stale once already. The two that are NOT here differ per block on
 * purpose: `WRITE_BOUNDARY` is off inside `infrastructure/obsidian/` (the sanctioned writer),
 * and `LANGUAGE_RESOLUTION_BAN` is off inside `strings.ts` (the sanctioned resolver).
 */
const SHARED_SRC_SYNTAX_BANS = [...SVG_CLASS_TOKENS, ...I18N_LITERAL_BAN, ...NOTICE_TEXT_BAN];

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
			// Worktrees, which live inside the repository and hold a FULL COPY of `src/`.
			// Not optional and not tidiness: ESLint's flat config does not read `.gitignore`
			// and no longer skips dot-directories, so `eslint .` walks in, finds a second
			// `tsconfig.json` beside the root's, and fails EVERY file in the run with
			// "multiple candidate TSConfigRootDirs are present". Measured with a real
			// worktree in place — build and oxlint both ignored it and only this step broke,
			// which is the sentence above about this list being load-bearing, proved.
			'.worktrees/**',
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
	// Widens `sentence-case-locale-module`'s acronym vocabulary for `SKU` — see
	// `ASSET_LIBRARY_ACRONYMS`'s own comment above for why the fix lives here rather than in
	// the product's copy. Placed AFTER `...pluginRules` so its `sentence-case-locale-module`
	// entry, for the identical `files`, wins: two flat-config blocks matching one file OVERRIDE
	// a rule key rather than merging it, which is this file's own recorded trap for
	// `no-restricted-globals` and `no-restricted-syntax` alike.
	{
		files: localeModuleFiles,
		rules: {
			'obsidianmd/ui/sentence-case-locale-module': ['warn', { acronyms: ASSET_LIBRARY_ACRONYMS }],
		},
	},
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
	{
		/**
		 * `forbidden(...)` below names six SUBTREES that exist today — one per layer the
		 * SDD's diagram draws. A subtree nobody has named yet (`src/shared/`, say) matches
		 * none of their `srcFiles(layer)` globs, and it matches the root-of-`src/` block
		 * below no better — that block only reaches files sitting directly AT the root, not
		 * one level down. An import of `src/prototypes/` from a subtree with no
		 * `forbidden(...)` call of its own would pass lint clean: the "list the places"
		 * shape this repository's own guide refuses, hiding inside the very fix built to
		 * check at the forbidden thing instead of enumerating them.
		 *
		 * **This block's POSITION in the array is load-bearing, and it is the entire fix —
		 * not the rule it carries.** Two flat-config blocks matching one file OVERRIDE
		 * `no-restricted-imports` rather than merging it (restated at the write-boundary
		 * block below, for `no-restricted-syntax`, because the trap is the same one twice).
		 * Placed AFTER the six `forbidden(...)` calls, this block would win the override for
		 * EVERY layer file too — replacing each layer's full ban (which also covers its
		 * sibling layers and its banned packages) with just this one's `prototypes`-only
		 * rule. One hole, in an unnamed subtree, would be traded for six, in every named
		 * one, silently: the prototypes ban would still fire everywhere and
		 * `tests/build/prototypes-one-way-door.test.ts` would still read green, because
		 * nothing in it checks that a LAYER ban survived — only that the prototypes ban did.
		 *
		 * Placed BEFORE them, as it is here, the same override becomes the fix instead: each
		 * `forbidden(...)` call already restates `'prototypes'` in its own `groups` (added
		 * when the one-way door was built), so for the six known layers the LATER, more
		 * specific block overrides this one right back — restoring the FULL layer ban,
		 * prototypes included, exactly as if this block did not exist. Only a subtree with no
		 * `forbidden(...)` call of its own is left with just this block's rule, which is
		 * exactly the coverage a subtree nobody has named yet should have.
		 *
		 * `tests/build/prototypes-one-way-door.test.ts` drives both halves of that claim: an
		 * unnamed subtree refusing a prototype import, AND a named layer's own
		 * cross-layer ban still firing — proof this block did not quietly take the second
		 * one away. Proving only the first half is the trade above, passing.
		 */
		files: SRC_EXTENSIONS.map((ext) => `**/src/**/*.${ext}`),
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: PROTOTYPES_GROUP,
							message:
								'src/prototypes/ is design scaffolding: nothing outside it may import from it, including a subtree with no forbidden(...) call of its own yet.',
						},
					],
				},
			],
		},
	},
	forbidden(
		'core',
		{
			groups: ['domain', 'application', 'infrastructure', 'presentation', 'plugin', 'prototypes'],
			packages: PRESENTATION_AND_HOST,
		},
		'core/ is generic technical ground — geometry, units, money, ids, results, events. It knows nothing about renovation and nothing about a host.',
	),
	forbidden(
		'domain',
		{
			groups: ['application', 'infrastructure', 'presentation', 'plugin', 'prototypes'],
			packages: PRESENTATION_AND_HOST,
		},
		'domain/ decides what a Zone or a WorkPackage IS. A Konva polygon, a Pinia object and a Markdown file are representations of it, so it may name none of them (SDD §3.3, §3.4).',
	),
	forbidden('application', APPLICATION_LAYER.ban, APPLICATION_LAYER.reason),
	forbidden('infrastructure', INFRASTRUCTURE_LAYER.ban, INFRASTRUCTURE_LAYER.reason),
	forbidden(
		'presentation',
		{ groups: ['infrastructure', 'plugin', 'prototypes'] },
		'presentation/ talks to application/, never to a repository directly. What it gets handed is composed in plugin/.',
	),
	forbidden(
		'plugin',
		{ groups: ['prototypes'] },
		'plugin/ composes every layer, which is why it has no other ban — but src/prototypes/ is design scaffolding that must never reach a built plugin, and the composition root is the one place that could pull it in.',
	),
	{
		/**
		 * The root of `src/` — which today is `src/main.ts` and nothing else, and which no
		 * `forbidden(...)` call can reach: that helper builds `**\/src/<subtree>/**\/*`, so a
		 * file sitting directly in `src/` matches no subtree pattern at all.
		 *
		 * It is also the BUILD ENTRY (`vite.config.ts`, `lib.entry`). A prototype imported
		 * here is a prototype in every user's plugin, so the file with the most to lose was
		 * the one file the layer bans did not cover.
		 *
		 * Same `SRC_EXTENSIONS` list as `srcFiles()` above, and for the same reason: the
		 * build entry could be reauthored in `.js` (`allowJs`) exactly as any subtree could,
		 * and this block is the one place a widened `srcFiles()` cannot reach in turn — it
		 * is spelled out rather than routed through the helper because it is not a subtree.
		 */
		files: SRC_EXTENSIONS.map((ext) => `**/src/*.${ext}`),
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: PROTOTYPES_GROUP,
							message:
								'src/main.ts is the build entry, so an import of src/prototypes/ here puts design scaffolding in every user’s plugin.',
						},
					],
				},
			],
		},
	},
	forbidden(
		'presentation/dialogs',
		// Repeats `infrastructure` and `plugin` from the `presentation` block above ON
		// PURPOSE: two blocks matching one file OVERRIDE `no-restricted-imports` rather than
		// merging it, so a block that named only its own additions would quietly widen the
		// hole it was written to narrow. `tests/build/vue-rules.test.ts` drives all three
		// through real fixture paths rather than reading this object.
		//
		// `prototypes` is in that list for exactly the reason the paragraph above gives, and it
		// was ADDED WHEN THE TWO BRANCHES MET: this block arrived on `main` while the prototypes
		// ban arrived on the harness branch, so each was complete on its own and the merge of
		// the two would have left `presentation/dialogs/` as the one directory in `src/` free to
		// import design scaffolding — the override trap this comment describes, sprung by a
		// merge rather than by an edit.
		{ groups: ['application', 'infrastructure', 'plugin', 'core/events', 'prototypes'] },
		'presentation/dialogs/ renders what it is handed and resolves one typed value. A query, a command, a repository or the event bus reached from here would put a domain decision inside a dialog (design slice 15, Definition of Done 9).',
	),
	// The SAME constants the two layer blocks above are built from, never a copy of them —
	// see `APPLICATION_LAYER`'s docblock for what a copy silently costs.
	networkFree('application/queries', APPLICATION_LAYER.ban, APPLICATION_LAYER.reason),
	networkFree('infrastructure/logging', INFRASTRUCTURE_LAYER.ban, INFRASTRUCTURE_LAYER.reason),
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
		// `SRC_EXTENSIONS`, spelled literally rather than routed through `srcFiles`:
		// `srcFiles('**')` is a needlessly clever spelling of the same set. This glob went
		// stale once already — it named only `.ts`/`.vue` after `SRC_EXTENSIONS` grew past
		// those two, so a `.js` file was covered by every layer ban and still bypassed the
		// vault write boundary. Built from the constant now, the same way the root-of-`src/`
		// block above is, so the two cannot drift apart from `srcFiles()` again. Written
		// without a COUNT deliberately: the earlier version said "grew to six" and the list
		// is nine, having gained `.tsx`/`.mts`/`.cts` in a later round that did not come
		// back here — and the number was never the point, since the whole repair was to stop
		// restating the list at all.
		files: SRC_EXTENSIONS.map((ext) => `**/src/**/*.${ext}`),
		ignores: ['**/src/infrastructure/obsidian/**'],
		rules: { 'no-restricted-syntax': ['error', ...WRITE_BOUNDARY, ...SHARED_SRC_SYNTAX_BANS, ...LANGUAGE_RESOLUTION_BAN] },
	},
	{
		// The sanctioned writer. Vault writes are this directory's job; every OTHER
		// shared ban still applies, restated per the override warning above — including
		// I18N_LITERAL_BAN: infrastructure/obsidian/ may show its own UI (a Notice, an
		// error surface) and that text is exactly as translatable as a view's — and
		// NOTICE_TEXT_BAN for the same reason, since the layer holding the raw exception is
		// the likeliest place for one to be printed.
		files: srcFiles('infrastructure/obsidian'),
		rules: { 'no-restricted-syntax': ['error', ...SHARED_SRC_SYNTAX_BANS, ...LANGUAGE_RESOLUTION_BAN] },
	},
	{
		// The sanctioned RESOLVER, and the mirror image of the block above it: everything the
		// two blocks before this one carry, minus `LANGUAGE_RESOLUTION_BAN`, because this is
		// the one file allowed to import `getLanguage` at all. `WRITE_BOUNDARY` is spread back
		// in for the same reason that block restates the shared list — two blocks matching one
		// file OVERRIDE this rule rather than merging it, so a carve-out naming only its
		// subtraction would take every other selector off this file too.
		//
		// A path rather than a subtree: the carve-out is for ONE module, and a directory-shaped
		// glob would quietly extend it to the next file added beside it.
		files: ['**/src/presentation/i18n/strings.ts'],
		rules: { 'no-restricted-syntax': ['error', ...WRITE_BOUNDARY, ...SHARED_SRC_SYNTAX_BANS] },
	},
	{
		// SDD §3.4 prohibits DOM APIs in domain/ and core/, not only the framework
		// packages: the host-free layers may not reach the browser either. A DIFFERENT
		// rule key than the block above, so the two merge rather than override. Named
		// globals rather than a category — this check sees exactly these spellings.
		files: [...srcFiles('core'), ...srcFiles('domain')],
		rules: {
			// `OBSIDIAN_RESTRICTED_GLOBALS` first, and it is not decoration: this block
			// OVERRIDES `eslint-plugin-obsidianmd`'s own `no-restricted-globals` for these
			// two subtrees rather than merging with it, so before this spread `app` was
			// unbanned in `core/` and `domain/` — the one global the marketplace review bot
			// rejects plugins for, lost in the layers least likely to notice. The DOM list
			// comes second so its own message wins for the two names both lists carry.
			'no-restricted-globals': [
				'error',
				...namedGlobals(
					OBSIDIAN_RESTRICTED_GLOBALS,
					['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'fetch', 'HTMLElement', 'Element', 'customElements'].map(
						(name) => ({ name, message: 'core/ and domain/ are host-free (SDD §3.4): no DOM or browser APIs.' }),
					),
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
		// `no-unused-vars` (below) needs the TypeScript-aware rule registered under this
		// key — `src/**/*.ts` gets it from `eslint-plugin-obsidianmd`'s bundled
		// `typescript-eslint/recommended`, whose OWN `files` pattern is `**/*.{js,cjs,mjs,jsx}`
		// / `**/*.{ts,cts,mts,tsx}` and never matches `.vue`, so this block cannot reach that
		// plugin registration and has to bring its own.
		plugins: { '@typescript-eslint': tseslint.plugin },
		rules: {
			// The base `no-unused-vars` is ESLint core, not the TypeScript-aware rule `.ts`
			// files get from `eslint-plugin-obsidianmd`'s bundled config (same reason as the
			// `plugins` comment above) — and core's rule does not understand a `FunctionType`
			// node, so a NAMED parameter in a function-type annotation (`(input: T) => R`,
			// which nothing here ever WRITES to, because it is a type, not a binding) reads as
			// an unused variable. `NewProjectForm.vue`'s `dispatch` prop is the first `.vue`
			// file to declare one. Off here and replaced by the TypeScript-aware rule with the
			// same `argsIgnorePattern`/`varsIgnorePattern` the `.ts` block already carries,
			// rather than reaching for an inline suppression `linterOptions.noInlineConfig`
			// refuses anyway.
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
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
		/**
		 * The harness's OWN SFCs, which the block above now reaches — and the one rule it
		 * hands them that does not belong to them.
		 *
		 * `VUE_FILES` was `src/` only, so `tests/harness/IndexPage.vue` was linted by no Vue
		 * rules at all and type-checked by nothing either; widening it is what put the largest
		 * component in this repository inside both gates. What came with the widening is
		 * `no-console: 'error'`, and here that rule is backwards: `console.error` is the
		 * channel `scripts/harness-shot.mjs` RECORDS and exits non-zero on, so an unattributable
		 * Vue warning and a failed entry mount are reported through it deliberately. The index's
		 * `.ts` siblings — `page.ts` chief among them — have always been free to call it, since
		 * `no-console` is not in any recommended set and this file only ever turned it on for
		 * `src/`. So this restores parity between a module and its own siblings rather than
		 * granting the harness something new.
		 *
		 * ONE rule and nothing else, for the flat-config reason stated at the logging carve-out:
		 * a second block matching the same file REPLACES the rule rather than merging, so the
		 * budgets and every Vue rule above stay in force. `tests/build/lint-scope.test.ts` asks
		 * ESLint itself for both halves — the Vue rules on, this one off — because a `files`
		 * glob that stopped matching would make the gate quieter rather than redder.
		 */
		files: [`${TESTS}/harness/**/*.vue`],
		rules: { 'no-console': 'off' },
	},
	{
		/**
		 * `src/prototypes/` may carry a `<script setup>` and a `<style>` block, and this is where
		 * that stops being prose. Both are refused everywhere else in this repository; here the
		 * rule is turned OFF entirely.
		 *
		 * **`<script setup>` makes a mock MORE like the thing it becomes, not less.** Every
		 * shipped component has one, so a scripted mock promotes as a file move with nothing to
		 * add — and it lifts the three limits a template-only file imposes, each of which a real
		 * mock author hit and worked around: no props means no `v-for`, so repeated rows are
		 * hand-copied; no bindings means a proportion cannot be drawn at all (an inline `style`
		 * is what the marketplace refuses and what promotion would have to remove); and no state
		 * means no hover, selection or focus to judge, which for a list view is half of what
		 * there is to judge. Template-only remains legal and remains the promotion pair's own
		 * shape — `ZoneSummary.vue` is still exactly that.
		 *
		 * **`<style>` is the trade, and it goes the other way, so it is stated plainly.** A
		 * mock's block does NOT ship, which is the whole gain: nothing imports this tree, so a
		 * screen's provisional CSS stops being downloaded by every vault while the screen it
		 * draws does not exist. What it costs is that the block does not TRAVEL either — a
		 * shipped component is styled from `styles/`, since SDD §84's colour check runs over the
		 * assembled sheet — so promotion lifts the block into a partial. `styles/` stays
		 * available for a mock whose CSS has outgrown the SFC budget: `WorkPackages.vue` is 306
		 * code lines against 200 of CSS, and 506 is past the 400 this config allows an SFC.
		 *
		 * `'off'` EXPLICITLY, not by omission. Two flat-config blocks matching one file override
		 * this rule's options rather than merging them, so leaving it out here would not relax
		 * anything — the wider `VUE_FILES` block's `['error', 'style']` would simply apply. The
		 * same trap this config documents for `no-restricted-syntax`, in the other direction.
		 *
		 * `tests/build/vue-rules.test.ts` drives both blocks in both trees, because "off here and
		 * on there" is exactly the claim a config's own text cannot make good on.
		 */
		files: ['**/src/prototypes/**/*.vue'],
		rules: {
			'vue/no-restricted-block': 'off',
			/**
			 * OFF here, and the choice is between this and narrowing a promise — so the reason
			 * has to be written down rather than assumed.
			 *
			 * `flat/recommended` applies whole to this tree, and three of its rules refuse what a
			 * designer or an eyeless agent actually writes: a single-word screen name
			 * (`Kitchen.vue`), a content-bearing element on one line (`<div class="x">hello</div>`),
			 * and two-space indentation. All three measured against this config, not reasoned
			 * about. `ZoneSummary.vue` passes only by accident — its single-line content elements
			 * are `<span>`s, which are on `singleline-html-element-content-newline`'s inline-element
			 * ignore list, and its `<h2>` carries no attributes.
			 *
			 * Only ONE of the three is turned off, and the line between them is `--fix`. The two
			 * formatting rules are auto-fixable (measured: `eslint --fix` rewrites both spellings
			 * above correctly), and they are what makes a mock's template LEGAL in
			 * `src/presentation/` unchanged — `tests/build/prototype-promotion.test.ts` holds that
			 * the promoted template is byte-identical, so relaxing formatting here would move the
			 * failure to promotion, where the fix is redrawing the markup and the whole feature is
			 * "the markup is never redrawn". This one is not fixable and never could be: it is
			 * about the FILE NAME and says nothing about the template, so switching it off costs
			 * that guarantee nothing. And naming a mock after the screen it draws is the likely
			 * case, not the exotic one — `docs/actors/Designer.md`'s actor names screens, not
			 * component-library entries.
			 *
			 * The cost, stated: a promoted mock still meets this rule in `src/presentation/`, so
			 * `Kitchen.vue` is renamed at promotion. That is a rename of a file, not a redraw of a
			 * template, and it is the trade this block is choosing. `tests/build/vue-rules.test.ts`
			 * drives all three spellings, in both trees.
			 */
			'vue/multi-word-component-names': 'off',
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
