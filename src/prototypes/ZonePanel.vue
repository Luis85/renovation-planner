<!--
	The headline workflow, as a file rather than as a sentence: a template-only mock that
	composes a REAL component (`StatusBar`, from `src/presentation/editor/shell/`) beside a
	SIBLING MOCK (`ZoneSummary`, next to this file). It imports neither, and cannot — this
	tree is template-only, so there is no script block for an import to live in. Both tags
	resolve through the registry `tests/harness/page.ts` builds from
	`registrableComponents([...componentEntries(), ...prototypeEntries()])` and installs on
	the index app.

	That is why this file exists at all. Before it, "compose mocks beside real components"
	was exercised by nothing: `registrableComponents` was unit-tested as a pure function and
	the `app.component` loop was executed by a source scan, but no test anywhere mounted a
	prototype that composed anything. `tests/harness/indexRealEntries.test.ts` is what holds
	it now, and it drives this file through the real glob.

	`StatusBar` renders the seeded plan's name, so this also shows what the shared fixture
	(`tests/harness/fixture.ts`) puts behind every entry: no per-entry setup, one world.
-->
<template>
	<div class="rp-zone-panel">
		<ZoneSummary />
		<StatusBar />
	</div>
</template>
