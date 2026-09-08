<script setup lang="ts">
import { setIcon } from 'obsidian';
import type { ThemeTokens } from '../theme/themeTokens';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from '../renovation/renovationSession';
import type { EvidencePin } from './evidencePins';
import { evidencePinWidth } from '../layers/zone/captionPlacement';
defineProps<{ pins: readonly EvidencePin[]; tokens: ThemeTokens; zoom: number }>();
const runtime = useEditorRuntime(), session = useRenovationSession();
const svgNumber = (node: Element, attribute: string) => Number(node.getAttribute(attribute));

/** Use the host's existing Lucide geometry, without another icon catalogue or raster resource. */
function hostIcon(name: string) {
	const host = document.createElement('span'); setIcon(host, name);
	return {
		paths: [...host.querySelectorAll('path')].map(node => node.getAttribute('d') ?? ''),
		rects: [...host.querySelectorAll('rect')].map(node => ({ x: svgNumber(node, 'x'), y: svgNumber(node, 'y'), width: svgNumber(node, 'width'), height: svgNumber(node, 'height'), cornerRadius: svgNumber(node, 'rx') })),
		circles: [...host.querySelectorAll('circle')].map(node => ({ x: svgNumber(node, 'cx'), y: svgNumber(node, 'cy'), radius: svgNumber(node, 'r') })),
	};
}
const icons = { photo: hostIcon('image'), document: hostIcon('file-text'), note: hostIcon('sticky-note') };
const iconStroke = { strokeWidth: 2, lineCap: 'round', lineJoin: 'round', listening: false } as const;
</script>
<template>
	<VGroup
		v-for="item in pins"
		:key="item.id"
		:config="{ name: 'evidence-pin', x: item.x, y: item.y, onClick: () => runtime.renovation.focus(item.roomId, session.mode, item.id), onTap: () => runtime.renovation.focus(item.roomId, session.mode, item.id) }"
	>
		<VRect :config="{ name: 'evidence-pin-target', x: -evidencePinWidth(item.number) / (2 * zoom), y: -14 / zoom, width: evidencePinWidth(item.number) / zoom, height: 28 / zoom, cornerRadius: 6 / zoom, fill: tokens.canvasBackground, stroke: session.focusedId === item.id ? tokens.accent : tokens.zoneStroke, strokeWidth: 2 / zoom }" />
		<VGroup :config="{ name: 'evidence-icon-' + item.type, x: (-evidencePinWidth(item.number) / 2 + 6) / zoom, y: -8 / zoom, scaleX: 2 / (3 * zoom), scaleY: 2 / (3 * zoom), listening: false }">
			<VPath
				v-for="(path, index) in icons[item.type].paths"
				:key="'path-' + index"
				:config="{ ...iconStroke, data: path, stroke: tokens.zoneLabel }"
			/>
			<VRect
				v-for="(rect, index) in icons[item.type].rects"
				:key="'rect-' + index"
				:config="{ ...iconStroke, ...rect, stroke: tokens.zoneLabel }"
			/>
			<VCircle
				v-for="(circle, index) in icons[item.type].circles"
				:key="'circle-' + index"
				:config="{ ...iconStroke, ...circle, stroke: tokens.zoneLabel }"
			/>
		</VGroup>
		<VText :config="{ x: (-evidencePinWidth(item.number) / 2 + 26) / zoom, y: -7 / zoom, width: (evidencePinWidth(item.number) - 30) / zoom, text: String(item.number), fontSize: 14 / zoom, fill: tokens.zoneLabel, listening: false, wrap: 'none' }" />
	</VGroup>
</template>
