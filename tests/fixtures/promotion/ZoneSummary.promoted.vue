<script setup lang="ts">
/**
 * The promoted form of `src/prototypes/ZoneSummary.vue`, kept as a FIXTURE rather than as a
 * component: `tests/build/prototype-promotion.test.ts` diffs its template against the mock's,
 * and that diff is the whole claim the prototypes tree rests on.
 *
 * Written by hand, not generated from the mock. A generated copy would agree with the mock by
 * construction and prove nothing — which is exactly what the first version of that test did.
 */
import { computed } from 'vue';

const zones = computed(() => [
	{ name: 'Kitchen', area: '12.60 m²' },
	{ name: 'Bathroom', area: '4.20 m²' },
]);
</script>

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
