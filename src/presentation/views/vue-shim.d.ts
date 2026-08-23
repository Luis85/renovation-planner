/**
 * What an SFC import means to tooling that cannot parse one.
 *
 * `vue-tsc` understands `.vue` through Vue's language plugin, so `npm run build` type-checks
 * a component properly. **ESLint does not**: its type-aware rules run on the TypeScript
 * project SERVICE — plain tsserver — which has no such plugin, so `import ViewRoot from
 * './ViewRoot.vue'` in a `.ts` file resolves to an error type and every use of it is an
 * unsafe-any. That surfaced as `@typescript-eslint/no-unsafe-argument` on
 * `createApp(ViewRoot)` in `RenovationProjectView.ts`, three rules deep in a block that has
 * nothing to do with Vue, and there is no inline suppression for it (`noInlineConfig`).
 *
 * An ambient wildcard module declaration only applies where real resolution FAILS, which is
 * what makes this narrow rather than a blanket `any`. All four claims below are measured,
 * not reasoned — each was checked with this file present and absent:
 *
 * - A type error inside an SFC's own `<script setup>`: caught by `vue-tsc` either way.
 * - A wrong prop passed SFC-to-SFC in a template — the case slice 5 onward actually lives
 *   in: caught by `vue-tsc` either way, identically. Real resolution wins for `.vue → .vue`.
 * - A wrong prop in `createApp(Component, props)` from a `.ts` file: caught by NEITHER,
 *   with or without this file. Vue's own signature types that parameter as
 *   `Record<string, unknown> | null`, so this shim is not what loses it.
 * - What this file changes, and the whole of it: ESLint's type-aware rules in a `.ts` file
 *   see `DefineComponent` rather than an unresolved error type.
 *
 * `parserOptions.extraFileExtensions: ['.vue']` was tried first and does nothing on its
 * own — measured — because tsserver still cannot parse the SFC it is then told to include.
 *
 * The trigger for deleting this: the day a `.ts` file needs the real props of a component
 * checked. Then the answer is wiring type-aware linting of `.vue` properly, and this file
 * becomes a lie worth removing rather than a gap worth filling.
 */
declare module '*.vue' {
	import type { DefineComponent } from 'vue';

	const component: DefineComponent;
	export default component;
}
