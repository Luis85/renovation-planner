import type { PlanId } from '../plan/PlanId';
import type { ZoneId } from '../zone/ZoneId';
import type { SpatialLink } from '../renovation/SharedLinks';
import type { RequirementSource } from './RequirementSource';

/**
 * Where a Requirement's figures come FROM — a reference, never a copy of geometry (SDD §3.6).
 * `plan` is a contextual material on a wall, opening or element with no room (ADR-0031): its
 * source names the target, so the origin only has to name the plan.
 */
export type RequirementOrigin =
	| { readonly kind: 'zone'; readonly zoneId: ZoneId }
	| { readonly kind: 'plan'; readonly planId: PlanId };

export function originRoomId(origin: RequirementOrigin): ZoneId | undefined {
	return origin.kind === 'zone' ? origin.zoneId : undefined;
}
/** A requirement's context in `spatialContexts`' terms: its Room, or its source target when it has none (ADR-0030). */
export function requirementContext(requirement: { readonly origin: RequirementOrigin; readonly source?: RequirementSource }): SpatialLink {
	const room = originRoomId(requirement.origin), targetId = requirement.source?.targetId ?? room ?? '';
	return { roomId: room ?? targetId, targetId };
}
