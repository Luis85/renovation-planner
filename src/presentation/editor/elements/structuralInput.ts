import type { Point } from '../../../core/geometry/Point';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { postSection, resizedPost } from '../../../domain/spatial/structuralElement';
import { formatMetres, parseMetres } from '../shell/formatLength';

export interface StructuralText { name: string; width: string; depth: string }
export interface StructuralEdit { readonly name: string; readonly points: readonly Point[]; readonly width?: number }
export type StructuralShapeFacts = Pick<SpatialElement, 'kind' | 'points' | 'width'>;

export function structuralText(element: StructuralShapeFacts, name: string): StructuralText {
	const section = element.kind === 'post' ? postSection(element.points) : null;
	return { name, width: formatMetres(section?.width ?? element.width ?? 0), depth: section ? formatMetres(section.depth) : '' };
}

/** A field still showing its stored value keeps the stored millimetres, never their rounded display. */
function lengthOf(text: string, stored: number) {
	return text === formatMetres(stored) ? { ok: true as const, mm: stored } : parseMetres(text);
}
type Length = ReturnType<typeof lengthOf>;
type Section = NonNullable<ReturnType<typeof postSection>>;

/** The edit for readable fields: a beam's new width on its unchanged axis, or a post resized about its centre. */
function proposedEdit(element: StructuralShapeFacts, name: string, width: number, section: Section | null, depth: Length | null): StructuralEdit | null {
	if (element.kind === 'beam') return { name, points: element.points, width };
	if (!section || !depth?.ok) return null;
	const points = width === section.width && depth.mm === section.depth ? element.points : resizedPost(element.points, width, depth.mm);
	return points ? { name, points } : null;
}

/** What the dimensions form proposes, or which of its fields refuse; position is edited by moving, never here. */
export function structuralEdit(element: StructuralShapeFacts, text: StructuralText): { edit: StructuralEdit | null; errors: ReadonlySet<'width' | 'depth'> } {
	const section = element.kind === 'post' ? postSection(element.points) : null;
	const width = lengthOf(text.width, section?.width ?? element.width ?? 0), depth = section ? lengthOf(text.depth, section.depth) : null;
	const errors = new Set<'width' | 'depth'>();
	if (!width.ok) errors.add('width');
	if (depth && !depth.ok) errors.add('depth');
	const name = text.name.trim();
	if (!width.ok || errors.size || !name) return { edit: null, errors };
	return { edit: proposedEdit(element, name, width.mm, section, depth), errors };
}
