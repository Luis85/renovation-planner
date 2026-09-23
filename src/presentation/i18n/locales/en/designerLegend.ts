/**
 * The canvas legend's copy (AD18-R16 Task 4): the swatch labels board 01 draws over the canvas's
 * bottom-left corner, and the `View` menu's checkbox for it (AD18-R12's precedent — leaf-local,
 * not persisted). AD18-R17 Task 6 adds the rows' detail — the clearance's figure where all four
 * sides agree, the placement point's preset — and the scale bar's end label beneath them.
 */
export const designerLegendEn = {
	'designer.legend': 'Legend',
	'designer.legend.clearance': 'Clearance',
	'designer.legend.clearance.uniform': 'Clearance ({size} mm)',
	'designer.legend.footprint': 'Footprint',
	'designer.legend.details': 'Details',
	'designer.legend.placement-point.back-centre': 'Placement point (back centre)',
	'designer.legend.placement-point.centre': 'Placement point (centre)',
	'designer.legend.placement-point.custom': 'Placement point (custom)',
	'designer.legend.front-direction': 'Front direction',
	'designer.legend.scale-bar.end': '{length} mm',
	'designer.view.legend': 'Legend',
} as const;
