<script setup lang="ts">
/**
 * The fallback surface: one message about the form as a whole, anchored to no input.
 *
 * It is NOT a toast — it does not auto-dismiss and it lives inside the form's own layout,
 * not a global notification region — and NOT a modal, since it blocks nothing. Slice 13 owns
 * the toast; this is what a failure with no field to sit under gets instead.
 *
 * `role="alert"` rather than `role="status"`: it appears in response to the user's own
 * submit and is the only feedback that press produced, so it is announced rather than
 * merely present. The empty state's notice in `ViewRoot.vue` is `status` for the opposite
 * reason — nobody pressed anything.
 */
defineProps<{ message: string | null }>();
</script>

<template>
	<p
		v-if="message !== null"
		class="rp-form-banner"
		role="alert"
	>
		<span
			class="rp-form-banner__glyph"
			aria-hidden="true"
		>⚠</span>
		{{ message }}
	</p>
</template>
