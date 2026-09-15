<script setup lang="ts">
/**
 * The curved-arrow rotate handle both editors draw — the plan editor's `RotationHandleGlyph` and the
 * asset designer's selection layer: Obsidian's own lucide `rotate-cw`/`rotate-ccw` paths over a
 * canvas-coloured backing, stroked in the accent like every other handle, sized in screen pixels on a
 * world-space layer.
 */
import { computed } from 'vue';
import { setIcon } from 'obsidian';
import type { Point } from '../../../core/geometry/Point';
import type { ThemeTokens } from '../theme/themeTokens';
import { ROTATION_HANDLE_RADIUS_PX } from '../handleMetrics';

const props = defineProps<{ at: Point; worldPerPixel: number; tokens: ThemeTokens; direction: 'clockwise' | 'counterclockwise' }>();
function iconPaths(name: string): string[] {
	const host = document.createElement('span'); setIcon(host, `lucide-${name}`);
	return [...host.querySelectorAll('path')].map(path => path.getAttribute('d') as string);
}
const icons = { clockwise: iconPaths('rotate-cw'), counterclockwise: iconPaths('rotate-ccw') };
const iconStroke = { strokeWidth: 2, lineCap: 'round', lineJoin: 'round', listening: false } as const;
const backing = computed(() => (ROTATION_HANDLE_RADIUS_PX + 2) * props.worldPerPixel);
const radius = computed(() => ROTATION_HANDLE_RADIUS_PX * props.worldPerPixel);
</script>
<template>
	<VGroup :config="{ name: 'rotation-handle', listening: false }">
		<VRect :config="{ name: 'rotation-handle-button', x: at.x - backing, y: at.y - backing, width: 2 * backing, height: 2 * backing, cornerRadius: 3 * worldPerPixel, fill: tokens.canvasBackground, listening: false }" />
		<VGroup :config="{ name: 'rotation-handle-icon', x: at.x - radius, y: at.y - radius, scaleX: radius / 12, scaleY: radius / 12, listening: false }">
			<VPath
				v-for="(path, index) in icons[direction]"
				:key="index"
				:config="{ ...iconStroke, data: path, stroke: tokens.accent }"
			/>
		</VGroup>
	</VGroup>
</template>
