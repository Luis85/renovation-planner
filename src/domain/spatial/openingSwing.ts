import type { Opening, OpeningSwing } from './Structure';

/** Defaults are presentation behavior; reading an old opening never materializes new fields. */
export function openingSwing(opening: Opening): OpeningSwing | null {
	if (opening.kind === 'opening') return null;
	return opening.swing ?? { hinge: 'start', side: 'left', angle: opening.kind === 'door' ? 90 : 0 };
}

export function validOpeningSwing(opening: Opening): boolean {
	const swing = opening.swing;
	return swing === undefined || (opening.kind !== 'opening' && ['start', 'end'].includes(swing.hinge)
		&& ['left', 'right'].includes(swing.side) && Number.isFinite(swing.angle) && swing.angle >= 0 && swing.angle <= 180);
}
