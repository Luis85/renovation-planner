import type { designerTypedLandingEn } from '../en/designerTypedLanding';

/** German for the warning a typed size raises when it lands away from the number typed (AD18-R24). */
export const designerTypedLandingDe: Record<keyof typeof designerTypedLandingEn, string> = {
	'designer.typed-size.landed': 'Die eingegebene Größe ist für diese Form nicht erreichbar. Die Form misst jetzt {width} × {depth} mm.',
	'designer.typed-reach.landed-left': 'Der eingegebene Freiraum ist für diese Form nicht erreichbar, daher reicht er jetzt {reach} mm über die linke Kante hinaus und misst {width} × {depth} mm.',
	'designer.typed-reach.landed-right': 'Der eingegebene Freiraum ist für diese Form nicht erreichbar, daher reicht er jetzt {reach} mm über die rechte Kante hinaus und misst {width} × {depth} mm.',
	'designer.typed-reach.landed-top': 'Der eingegebene Freiraum ist für diese Form nicht erreichbar, daher reicht er jetzt {reach} mm über die obere Kante hinaus und misst {width} × {depth} mm.',
	'designer.typed-reach.landed-bottom': 'Der eingegebene Freiraum ist für diese Form nicht erreichbar, daher reicht er jetzt {reach} mm über die untere Kante hinaus und misst {width} × {depth} mm.',
};
