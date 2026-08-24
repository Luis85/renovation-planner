<script setup lang="ts">
/**
 * §19's transient layer — selection handles, snap guides, measure previews, drawing
 * previews, transform controls. Empty in this slice: there is no `EditorTool` yet to put
 * anything in it, and slice 6 populates it without restructuring the scene.
 *
 * **It is the one layer the viewport transform is NOT bound to, and that is its second
 * job.** Everything §19 lists is a constant-size SCREEN affordance — a `Transformer`'s
 * handles must stay eight pixels across at every zoom — so this layer works in stage
 * pixels while the six below it work in world millimetres. Slice 6's world-space
 * previews put their own transformed `Group` inside it; a handle needs no such group,
 * which is the common case and therefore the default.
 *
 * `listening` is left OFF here like everywhere else in this slice. Slice 6 turns it on for
 * this layer first, since it is the layer pointer interaction actually belongs to.
 */
</script>

<template>
	<VLayer :config="{ name: 'interaction', listening: false }" />
</template>
