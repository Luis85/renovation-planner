/**
 * Copy for the warning a typed size raises when it lands away from the number typed (AD18-R24). Created empty by the
 * integrator so that the task owning it edits one locale module and no other task edits the same file.
 *
 * ONE string for every typed door (the inspector's Width and Depth, the canvas's size labels, Set dimensions), and it
 * names both extents: a curved part's arcs couple its axes, so a typed Width can move the Depth too, and the size that
 * landed is the pair. The numbers are whole millimetres, which is what every one of those fields shows.
 */
export const designerTypedLandingEn = {
	'designer.typed-size.landed': 'The size typed is out of reach for this shape. It now measures {width} × {depth} mm.',
} as const;
