import type { ZoneId } from '../zone/ZoneId';

/**
 * Where a Requirement's figures come FROM — a reference, never a copy of geometry
 * (SDD §3.6). A discriminated union so later epics can add origin kinds (`work-package`,
 * PRD §59) additively, which is also why no new migration category is needed when they do.
 */
export type RequirementOrigin =
	| { readonly kind: 'zone'; readonly zoneId: ZoneId };
