import { beforeAll, describe, expect, it } from 'vitest';
import { ESLINT_BOOT_MS, lintText, warmUpEslint } from '../helpers/eslint';

// The ESLint boot, paid once here rather than by whichever test ran first — see
// ESLINT_BOOT_MS in tests/helpers/eslint.ts for the measurement.
beforeAll(warmUpEslint, ESLINT_BOOT_MS);

/**
 * The Vue half of the lint gate, proven by fixtures rather than by reading the config.
 *
 * A rule present in a flat config but scoped to files it never matches reports nothing and
 * looks correct — which is the failure this whole file is about, and the reason each
 * assertion reads the reported RULE ID rather than a pass/fail. Each fixture below violates
 * exactly one rule and otherwise conforms; the counts in each describe block's own title are
 * the number of fixtures IN that block, not a total for the file, and stay accurate as long
 * as each block's title is updated alongside its fixtures. Beside the six named rules sit the
 * architecture blocks, which are the ones that were `.ts`-scoped until the edit this file
 * guards, and the prototypes-only scope of `vue/no-restricted-block`, which is scoped to a
 * subtree the others don't reach.
 *
 * `PARSE_ERROR` in a result means `vue-eslint-parser` is not configured for the block —
 * a distinct failure from a rule being absent, and worth reading as such.
 */
const COMPONENT = 'src/presentation/views/Fixture.vue';
const SINK = 'src/infrastructure/logging/Fixture.vue';

const conforming = (script: string, template = '<div class="x" />'): string =>
	`<script setup lang="ts">\n${script}\n</script>\n\n<template>\n\t${template}\n</template>\n`;

describe('the six named rules flat/recommended does not enable', () => {
	/**
	 * An Options-API component is also the natural place to write a plain `<script>` block,
	 * so this one fixture carries two violations — and that is fine: it still fails with
	 * either rule absent or misscoped, which is the silence being gated against. What the
	 * assertions must not do is confuse the two, which reading rule ids is what prevents.
	 *
	 * `data()` and not merely `name`, measured: `vue/component-api-style` reports on the
	 * Options API being USED, and an `export default` carrying only a `name` property is not
	 * a use of it — that fixture reported `vue/block-lang` alone, which would have read as
	 * this rule being misscoped when it was the fixture that was wrong.
	 */
	it('refuses the Options API and a script block with no lang', async () => {
		const reported = await lintText('<script>\nexport default { data() { return { a: 1 }; } };\n</script>\n\n<template>\n\t<div />\n</template>\n', COMPONENT);

		expect(reported).toContain('vue/component-api-style');
		expect(reported).toContain('vue/block-lang');
	});

	it('refuses a runtime-object defineProps', async () => {
		const reported = await lintText(conforming('const props = defineProps({ title: String });\nvoid props;'), COMPONENT);

		expect(reported).toContain('vue/define-props-declaration');
	});

	it('refuses a runtime-array defineEmits', async () => {
		const reported = await lintText(conforming("const emit = defineEmits(['change']);\nvoid emit;"), COMPONENT);

		expect(reported).toContain('vue/define-emits-declaration');
	});

	// This project's override of Vue's scoped-styles guidance: the marketplace rejects
	// inline styles, so the plugin's CSS lives in `styles/` and an SFC may not carry any.
	it('refuses a style block', async () => {
		const reported = await lintText(`${conforming('')}\n<style>\n.x { display: block; }\n</style>\n`, COMPONENT);

		expect(reported).toContain('vue/no-restricted-block');
	});

	/**
	 * The component is IMPORTED in the fixture, because that is the case the rule is about:
	 * its default `registeredComponentsOnly: true` checks components the SFC actually knows,
	 * and a bare unimported `<view-root />` is indistinguishable from a custom element — it
	 * reported nothing, measured. That is the narrower guarantee, so it is the one written
	 * down: an unregistered kebab-case tag is NOT caught, and the rule is left at its
	 * default rather than widened, since nothing here uses custom elements and a rule
	 * widened past its subject would fail the day one arrives.
	 */
	it('refuses a kebab-case tag for a component it knows', async () => {
		const reported = await lintText(conforming("import ViewRoot from './ViewRoot.vue';\nvoid ViewRoot;", '<view-root />'), COMPONENT);

		expect(reported).toContain('vue/component-name-in-template-casing');
	});

	// This one flat/recommended DOES carry, in its essential tier — asserted anyway,
	// because what is being checked is that the tier reaches `.vue` files here at all.
	it('refuses a single-word component name', async () => {
		const reported = await lintText(conforming(''), 'src/presentation/views/Root.vue');

		expect(reported).toContain('vue/multi-word-component-names');
	});
});

/**
 * `flat/recommended`'s `vue/html-indent` defaults to two spaces and this repository indents
 * with tabs, so the rule is configured rather than obeyed. That is a configuration change,
 * which means it needs a check of its own — otherwise "we told it tabs" and "we turned it
 * off" are indistinguishable from outside the config.
 */
describe('the template indentation this project actually uses', () => {
	it('accepts a tab-indented template', async () => {
		const reported = await lintText(conforming(''), COMPONENT);

		expect(reported).not.toContain('vue/html-indent');
	});

	// The other direction, which is what says the rule is ON rather than merely quiet.
	it('refuses a space-indented template', async () => {
		const reported = await lintText(`<script setup lang="ts">
</script>

<template>
  <div class="x" />
</template>
`, COMPONENT);

		expect(reported).toContain('vue/html-indent');
	});
});

describe('the architecture blocks, now that they match .vue', () => {
	it('refuses a component importing infrastructure directly', async () => {
		const reported = await lintText(conforming("import { createConsoleLogger } from '../../infrastructure/logging/consoleLogger';\nvoid createConsoleLogger;"), COMPONENT);

		expect(reported).toContain('no-restricted-imports');
	});

	it('refuses a console call in a component', async () => {
		const reported = await lintText(conforming("console.warn('mounted');"), COMPONENT);

		expect(reported).toContain('no-console');
	});

	/**
	 * The write boundary, which is the ban with the most to lose from a `.ts`-only scope: a
	 * component is exactly where somebody would reach for `vault.modify` to save what the
	 * user just edited, and it is the layer furthest from the repository that owns the file
	 * format. `no-restricted-syntax` and not an import ban, so the selector has to see the
	 * CALL — which it cannot do in a file no block matches.
	 */
	it('refuses a vault write from a component', async () => {
		const reported = await lintText(conforming("declare const vault: { modify: (p: string, d: string) => void };\nvault.modify('a.md', 'x');"), COMPONENT);

		expect(reported).toContain('no-restricted-syntax');
	});

	// The other selector in the same rule, and the reason both are asserted rather than one:
	// two flat-config blocks matching one file OVERRIDE `no-restricted-syntax` rather than
	// merging it, so a block that forgot to repeat the shared selectors would drop whichever
	// of them no fixture named.
	it('refuses an untranslated literal from a component', async () => {
		const reported = await lintText(conforming("declare const el: { setText: (t: string) => void };\nel.setText('Hard-coded');"), COMPONENT);

		expect(reported).toContain('no-restricted-syntax');
	});

	/**
	 * The inverse failure, and the one the DoD used to omit: a carve-out narrower than the
	 * ban it carves out of makes the sink's own `.vue` files the single place a `.vue` file
	 * cannot use the console.
	 */
	it('allows a console call inside the logging sink', async () => {
		const reported = await lintText(conforming("console.warn('sink');"), SINK);

		expect(reported).not.toContain('no-console');
	});
});

/**
 * `src/prototypes/**\/*.vue` carries its own `vue/no-restricted-block` block
 * (`eslint.config.mjs`), turned OFF for this one directory while the wider VUE_FILES block
 * refuses `<style>` everywhere else. Both directions are driven, because "off here and on
 * there" is the whole claim and a config's own text cannot make it good: an `'off'` that
 * leaked to `VUE_FILES` would let a `<style>` block into a shipped component, and a `files`
 * glob edited away from this directory would put the ban back on mocks with nothing to say so.
 */
describe('the prototypes-only scope of vue/no-restricted-block', () => {
	const PROTOTYPE = 'src/prototypes/PrototypeFixture.vue';
	const SHIPPED = 'src/presentation/editor/PrototypeFixture.vue';
	const STYLED = '<template>\n\t<div class="x" />\n</template>\n\n<style>\n.x { display: block; }\n</style>\n';

	/**
	 * A scripted mock is the point of the relaxation: every shipped component has a
	 * `<script setup>`, so this is what makes promotion a file move for a mock that needs props,
	 * a `v-for` or any state at all. `conforming` always writes `<script setup lang="ts">`, so
	 * this is also the measured case for the rule matching a block by NAME with `setup` as an
	 * attribute on it.
	 */
	it('accepts a script-setup block in a mock', async () => {
		expect(await lintText(conforming(''), PROTOTYPE)).toEqual([]);
	});

	// The trade, and the half that does not travel: a mock's CSS does not ship, and promotion
	// lifts it into a `styles/` partial because a shipped component is styled from the assembled
	// sheet SDD §84's colour check runs over.
	it('accepts a style block in a mock', async () => {
		expect(await lintText(STYLED, PROTOTYPE)).toEqual([]);
	});

	// The other direction, which is what makes the two cases above a SCOPE rather than a
	// deletion. An `'off'` that reached `VUE_FILES` would read exactly the same up there.
	it('still refuses a style block in a shipped component', async () => {
		expect(await lintText(STYLED, SHIPPED)).toContain('vue/no-restricted-block');
	});

	// Template-only stays legal, and stays the promotion pair's own shape.
	it('lints clean with a template and nothing else', async () => {
		const reported = await lintText('<template>\n\t<div class="x" />\n</template>\n', PROTOTYPE);

		expect(reported).toEqual([]);
	});
});

/**
 * What `flat/recommended` still refuses inside `src/prototypes/`, and the one thing it does
 * not — the check under `eslint.config.mjs`'s `vue/multi-word-component-names: 'off'` block
 * and under `src/prototypes/README.md`'s narrowed sentence about what the relaxations cost.
 *
 * All three spellings are driven in BOTH trees, because the whole decision is where the line
 * between them falls: turning a rule off in one directory is invisible from the config's own
 * text if nothing asks for the other side, and a rule that quietly went off everywhere would
 * read exactly the same here.
 */
describe('the Vue rules a prototype is and is not written to', () => {
	const PROTOTYPE = 'src/prototypes/Kitchen.vue';
	const PROMOTED = 'src/presentation/editor/Kitchen.vue';
	const SINGLE_LINE = '<template>\n\t<div class="x">hello</div>\n</template>\n';
	const SPACE_INDENTED = '<template>\n  <div class="x" />\n</template>\n';

	/**
	 * The relaxation. A single-word file name is what a designer writes when the mock is named
	 * after the SCREEN it draws, and the rule is not auto-fixable because it is about the file
	 * name rather than the markup — which is exactly why it is the one that gets turned off:
	 * it costs the byte-identical template guarantee nothing.
	 */
	it('accepts a single-word mock name, which the rest of src/ does not', async () => {
		expect(await lintText('<template>\n\t<div class="x" />\n</template>\n', PROTOTYPE)).toEqual([]);
		expect(await lintText(conforming(''), PROMOTED)).toContain('vue/multi-word-component-names');
	});

	/**
	 * The two that stay ON, and the reason is promotion: a template that breaks either of them
	 * cannot move into `src/presentation/` unchanged, and "the markup is never redrawn" is the
	 * criterion the whole feature exists for. Both are auto-fixable, which is what makes
	 * keeping them affordable for an actor with no eyes — `eslint --fix` rewrites both.
	 */
	it('still refuses a single-line content element and space indentation in a mock', async () => {
		expect(await lintText(SINGLE_LINE, PROTOTYPE)).toContain('vue/singleline-html-element-content-newline');
		expect(await lintText(SPACE_INDENTED, PROTOTYPE)).toContain('vue/html-indent');
	});
});
