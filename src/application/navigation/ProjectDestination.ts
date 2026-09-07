/** Host-owned navigation state. Context carries identities, never copies of planning facts. */
export type ProjectSection = 'details' | 'prices' | 'schedule' | 'quotes';
export interface ProjectOrigin {
 readonly planId: string;
 readonly roomId?: string;
 readonly workId?: string;
 readonly costId?: string;
}
export interface ProjectRoute {
 readonly section: ProjectSection;
 readonly origin?: ProjectOrigin;
}
export type ProjectDestination = ProjectSection | ProjectRoute;

export function projectRouteFrom(value: unknown): ProjectRoute {
 if (typeof value !== 'object' || value === null) return { section: 'details' };
 const record = value as Record<string, unknown>;
 const section = record['section'];
 if (section !== 'prices' && section !== 'schedule' && section !== 'quotes') return { section: 'details' };
 const origin = projectOriginFrom(record['origin']);
 return { section, ...(origin ? { origin } : {}) };
}
export function projectOriginFrom(value: unknown): ProjectOrigin | undefined {
 if (typeof value !== 'object' || value === null) return undefined;
 const record = value as Record<string, unknown>;
 const planId = record['planId'];
 if (typeof planId !== 'string' || !planId.trim()) return undefined;
 const optional: { roomId?: string; workId?: string; costId?: string } = {};
 for (const key of ['roomId', 'workId', 'costId'] as const) {
  const item = record[key];
  if (typeof item === 'string' && item.trim()) optional[key] = item;
 }
 return { planId, ...optional };
}
export function projectDestinationState(destination?: ProjectDestination): Record<string, unknown> {
 const route = projectRouteFrom(typeof destination === 'string' ? { section: destination } : destination);
 return route.section === 'details' ? {} : { ...route };
}
