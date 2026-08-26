<!--
	A prototype in every respect but its directory: a template-only SFC that composes two real
	components it does not import, resolving both through the app registry `indexApp.ts` builds
	— the same registry `tests/harness/page.ts` installs on the browser's index.

	It exists for CRITERION 7 ("two components mounted from one prototype read the same plan"),
	whose first three words the test holding it did not honour: that test mounted `StatusBar` and
	`PlanEditorRoot` as two separate ROOTS, which is two prototypes' worth of mounting and proves
	nothing about one prototype's children sharing a world.

	It lives under `tests/harness/` rather than `src/prototypes/` deliberately. A file in that
	tree is listed in the designer's index and captured by `npm run harness-shot`, and this one is
	a test fixture — an editor with a second status bar bolted above it is not a design anybody
	should be shown. Nothing here needs it discovered: the criterion is about what a prototype's
	children see, and this composes exactly as a discovered one would.
-->
<template>
	<div class="rp-shared-world">
		<StatusBar />
		<PlanEditorRoot />
	</div>
</template>
