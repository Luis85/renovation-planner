/**
 * The Renovation Lifecycle stages (PRD §35), adopted as `Project.status` — the only
 * lifecycle-shaped enum the source material offers. New projects start at `IDEA`.
 */
export type ProjectStatus =
	| 'IDEA'
	| 'SURVEY'
	| 'DESIGN'
	| 'ESTIMATE'
	| 'PROCUREMENT'
	| 'READY'
	| 'EXECUTION'
	| 'INSPECTION'
	| 'COMPLETE'
	| 'AS_BUILT';

const VALUES: readonly ProjectStatus[] = [
	'IDEA',
	'SURVEY',
	'DESIGN',
	'ESTIMATE',
	'PROCUREMENT',
	'READY',
	'EXECUTION',
	'INSPECTION',
	'COMPLETE',
	'AS_BUILT',
];

export function isProjectStatus(value: unknown): value is ProjectStatus {
	return typeof value === 'string' && VALUES.includes(value as ProjectStatus);
}
