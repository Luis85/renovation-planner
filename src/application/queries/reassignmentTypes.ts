/**
 * One candidate row of the reassignment picker — `id`/`label` strings only, so slice 15's
 * EntityPickerDialog renders what it is handed and knows nothing about zones or assets.
 */
export interface ReassignmentTargetDto {
	readonly id: string;
	readonly label: string;
}
