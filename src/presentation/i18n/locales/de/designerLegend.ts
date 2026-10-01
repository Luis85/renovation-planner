import type { designerLegendEn } from '../en/designerLegend';

/** German for the canvas legend's copy (AD18-R16 Task 4, AD18-R17 Task 6). */
export const designerLegendDe: Record<keyof typeof designerLegendEn, string> = {
	'designer.legend': 'Legende',
	'designer.legend.clearance': 'Freiraum',
	'designer.legend.clearance.uniform': 'Freiraum ({size} mm)',
	'designer.legend.footprint': 'Umriss',
	'designer.legend.details': 'Details',
	'designer.legend.placement-point.back-centre': 'Platzierungspunkt (hintere Mitte)',
	'designer.legend.placement-point.centre': 'Platzierungspunkt (Mitte)',
	'designer.legend.placement-point.custom': 'Platzierungspunkt (eigener Punkt)',
	'designer.legend.front-direction': 'Ausrichtung',
	'designer.legend.scale-bar.end': '{length} mm',
	'designer.view.legend': 'Legende',
};
