import { createApp, type App, type Component } from 'vue';
import { nextAppIdPrefix } from './app-id-prefix';
import { trackVueApp } from './vueGlobals';

/**
 * The one door a view takes to a Vue app: `createApp`, then the two things every mount owes.
 *
 * - **`app.config.idPrefix`**, so two leaves' `useId()` calls cannot collide (`app-id-prefix.ts`).
 * - **`trackVueApp`**, so the release of Vue's window globals waits for this app to unmount
 *   (`vueGlobals.ts`). A mount that skipped it would let the release run under a live app, and
 *   that app's next lifecycle hook would throw or write into another plugin's Vue.
 *
 * Both were a line each at four sites, held by memory. `eslint.config.mjs` now refuses
 * `import { createApp } from 'vue'` anywhere in `src/` but this file (`CREATE_APP_BAN`), so a
 * fifth view reaches Vue through here or fails lint.
 */
export function createViewApp(root: Component): App {
	const app = createApp(root);
	app.config.idPrefix = nextAppIdPrefix();
	trackVueApp(app);
	return app;
}
