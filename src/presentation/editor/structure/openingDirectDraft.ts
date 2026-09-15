import { computed, ref } from 'vue';
import { Decimal } from 'decimal.js';
import type { Opening, Structure } from '../../../domain/spatial/Structure';
import { parseExtentMetres } from '../shell/formatLength';
import { formatWallExtent } from './wallExtentInput';
import { parseSwingDraft, swingDraft, type OpeningSwingDraft } from './openingSwingDraft';

function parseOffset(value: string) {
	const text = value.trim(), parsed = parseExtentMetres(text.startsWith('-') ? text.slice(1) : text);
	return parsed.ok ? { ok: true as const, mm: text.startsWith('-') ? -parsed.mm : parsed.mm } : parsed;
}

/** Keep the last numeric centre while a user clears/retypes a field. Invalid text never previews. */
export function createOpeningDirectDraft() {
	const width = ref(''), offset = ref(''), swing = ref<OpeningSwingDraft | null>(null);
	const widthRaw = ref(0), offsetRaw = ref(0), swingEdited = ref(false);
	const numeric = computed(() => {
		const w = parseExtentMetres(width.value), o = parseOffset(offset.value);
		return w.ok && w.mm > 0 && o.ok;
	});
	function reset(opening: Opening): void {
		widthRaw.value = opening.width; offsetRaw.value = opening.offset;
		width.value = formatWallExtent(opening.width); offset.value = formatWallExtent(opening.offset);
		swing.value = opening.kind === 'opening' ? null : swingDraft(opening); swingEdited.value = false;
	}
	function resize(mm: number): void {
		offsetRaw.value = new Decimal(offsetRaw.value).plus(new Decimal(widthRaw.value).minus(mm).div(2)).toNumber();
		widthRaw.value = mm; offset.value = formatWallExtent(offsetRaw.value);
	}
	function update(field: 'width' | 'offset', value: string): void {
		const parsed = field === 'width' ? parseExtentMetres(value) : parseOffset(value);
		if (field === 'width') { width.value = value; if (parsed.ok && parsed.mm > 0) resize(parsed.mm); }
		else { offset.value = value; if (parsed.ok) offsetRaw.value = parsed.mm; }
	}
	function step(field: 'width' | 'offset', direction: -1 | 1): void {
		if (!numeric.value) return;
		if (field === 'width') { const next = new Decimal(widthRaw.value).plus(direction * 10).toNumber(); resize(next); width.value = formatWallExtent(next); }
		else { offsetRaw.value = new Decimal(offsetRaw.value).plus(direction * 10).toNumber(); offset.value = formatWallExtent(offsetRaw.value); }
	}
	function updateSwing(value: OpeningSwingDraft): void { swing.value = value; swingEdited.value = true; }
	function propose(structure: Structure, opening: Opening): Structure | null {
		const parsedSwing = swing.value ? parseSwingDraft(swing.value) : undefined;
		if (!numeric.value || parsedSwing === null) return null;
		const next = { ...opening, width: widthRaw.value, offset: offsetRaw.value, ...(swingEdited.value && parsedSwing ? { swing: parsedSwing } : {}) };
		return { ...structure, openings: structure.openings.map(item => item.id === opening.id ? next : item) };
	}
	return { width, offset, swing, reset, update, step, updateSwing, propose };
}
