/**
 * Copy for the warning a typed size raises when it lands away from the number typed (AD18-R24). Created empty by the
 * integrator so that the task owning it edits one locale module and no other task edits the same file.
 *
 * ONE string for every typed door (the inspector's Width and Depth, the canvas's size labels, Set dimensions), and it
 * names both extents: a curved part's arcs couple its axes, so a typed Width can move the Depth too, and the size that
 * landed is the pair. The numbers are whole millimetres, which is what every one of those fields shows.
 *
 * A typed clearance REACH (AD18-R40/R41) misses in its own words, one per side: what was typed was a reach beyond an
 * edge, not a size, so the sentence names the reach that landed on that side and then the size, since a curved
 * boundary's other axis is what can drift.
 */
export const designerTypedLandingEn = {
	'designer.typed-size.landed': 'The typed size is out of reach for this shape. It now measures {width} × {depth} mm.',
	'designer.typed-reach.landed-left': 'The typed reach cannot land on this shape, so the clearance now reaches {reach} mm beyond the left edge and measures {width} × {depth} mm.',
	'designer.typed-reach.landed-right': 'The typed reach cannot land on this shape, so the clearance now reaches {reach} mm beyond the right edge and measures {width} × {depth} mm.',
	'designer.typed-reach.landed-top': 'The typed reach cannot land on this shape, so the clearance now reaches {reach} mm beyond the top edge and measures {width} × {depth} mm.',
	'designer.typed-reach.landed-bottom': 'The typed reach cannot land on this shape, so the clearance now reaches {reach} mm beyond the bottom edge and measures {width} × {depth} mm.',
} as const;
