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
 * assertion reads the reported RULE ID rather than a pass/fail. Six rules, six fixtures,
 * each violating exactly one of them and otherwise conforming; plus the architecture blocks,
 * which are the ones that were `.ts`-scoped until the edit this file guards.
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
 * Design slice 15's own boundary. `presentation/dialogs/` is display-and-resolve only: a
 * future edit that starts querying a repository from inside `DeleteReferenceDialog.vue`
 * must fail the build rather than pass review by accident.
 *
 * A fixture path rather than a reading of the config object, for the reason this file
 * already gives: two blocks matching one file OVERRIDE `no-restricted-imports` rather than
 * merging, so the only honest question is what ESLint reports for a real path.
 */
describe('the dialogs boundary', () => {
	const DIALOG = 'src/presentation/dialogs/DeleteReferenceDialog.vue';
	const DIALOG_TS = 'src/presentation/dialogs/dialog-store.ts';

	/**
	 * This directory's first `.ts` fixtures in this file: every case above lints a `.vue`
	 * path, and the `.vue` block deliberately carries no `parserOptions.projectService` (see
	 * `eslint.config.mjs`), so none of them ever build TypeScript's project-service program.
	 * `warmUpEslint`'s `calculateConfigForFile` only resolves configuration — no parsing, no
	 * program — so it does not pay this cost either; the file-level `beforeAll` above warms
	 * config resolution, not this. Without paying it up front, whichever `.ts` case happens
	 * to run first inherits the full first-call cost on the suite's default per-test budget,
	 * which is exactly what made `refuses the event bus` time out under `npm run check`'s
	 * full parallel load before this existed. One `lintText` over a throwaway `.ts` path,
	 * result discarded, pays it once for every case below.
	 */
	beforeAll(async () => {
		await lintText('export const warm = 1;\n', DIALOG_TS);
	}, ESLINT_BOOT_MS);

	it('refuses an application import', async () => {
		const reported = await lintText(
			conforming("import type { Command } from '../../application/commands/Command';\nexport type C = Command<unknown, unknown>;"),
			DIALOG,
		);

		expect(reported).toContain('no-restricted-imports');
	});

	it('refuses the event bus', async () => {
		const reported = await lintText(
			"import type { EventBus } from '../../core/events/EventBus';\nexport type B = EventBus;\n",
			DIALOG_TS,
		);

		expect(reported).toContain('no-restricted-imports');
	});

	/**
	 * The half that would silently disappear: a per-directory block REPLACES the wider
	 * `presentation` one, so a block that added `application` and forgot to repeat
	 * `infrastructure` would open the bigger hole while looking like it closed a smaller one.
	 */
	it('still refuses infrastructure, which the wider presentation block owned', async () => {
		const reported = await lintText(
			conforming("import { createConsoleLogger } from '../../infrastructure/logging/consoleLogger';\nvoid createConsoleLogger;"),
			DIALOG,
		);

		expect(reported).toContain('no-restricted-imports');
	});

	// The other half of the same hazard: `plugin` is repeated from the wider `presentation`
	// block for the identical reason `infrastructure` is above, and had no fixture proving
	// it — a future edit trimming `plugin` from this block's `groups` would pass every other
	// case here and go unnoticed.
	it('still refuses plugin, which the wider presentation block owned', async () => {
		const reported = await lintText(
			conforming("import { RenovationPlannerPlugin } from '../../plugin/RenovationPlannerPlugin';\nvoid RenovationPlannerPlugin;"),
			DIALOG,
		);

		expect(reported).toContain('no-restricted-imports');
	});

	it('allows the i18n import every dialog legitimately needs', async () => {
		const reported = await lintText(
			conforming("import { tr } from '../i18n/strings';\nvoid tr;"),
			DIALOG,
		);

		expect(reported).not.toContain('no-restricted-imports');
	});
});
