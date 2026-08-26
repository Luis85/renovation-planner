<!--
	A template-only SFC: pure HTML to write, and already a real Vue component. Promotion adds a
	<script setup> block above the template and moves the file into `src/presentation/`; the
	markup goes across unchanged, which is what `tests/build/prototype-promotion.test.ts` holds.
	(That test strips this comment before checking the file is template-only, precisely so this
	sentence can say the tag plainly instead of dodging it.)

	This comment is OUTSIDE the template on purpose, and it deliberately does not spell the
	opening template tag anywhere. `templateBlock()` finds the block with a regex, so a comment
	naming that tag would make the test extract from HERE — the block it compares would start
	mid-comment and the two files could never match. Anything inside the block would also have
	to be copied into the promoted component, carrying a note about mocks into shipped code.

	Nothing marks this file as a prototype, deliberately.
	`tests/build/prototypes-not-bundled.test.ts` asks the build which modules composed the
	chunk, so a mock nobody remembered to mark is caught anyway — the only version of that
	guarantee worth having.
-->
<template>
	<section class="rp-zone-summary">
		<h2>Zones</h2>
		<ul>
			<li>
				<span class="rp-zone-summary__name">Kitchen</span>
				<span class="rp-zone-summary__area">12.60 m²</span>
			</li>
			<li>
				<span class="rp-zone-summary__name">Bathroom</span>
				<span class="rp-zone-summary__area">4.20 m²</span>
			</li>
		</ul>
	</section>
</template>
