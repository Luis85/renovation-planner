import { describe, expect, it } from 'vitest';
import { projectDestinationState, projectRouteFrom } from '../../../src/application/navigation/ProjectDestination';
describe('persisted project destination', () => {
 it('preserves old list/details state and prices navigation without synthetic context', () => {
  expect(projectDestinationState()).toEqual({}); expect(projectDestinationState('details')).toEqual({});
  expect(projectDestinationState('prices')).toEqual({ section: 'prices' });
 });
 it('round trips the stable floor, Room, Work and cost identities across host navigation', () => {
  const route = { section: 'quotes' as const, origin: { planId: 'floor', roomId: 'room', workId: 'work', costId: 'cost' } };
  expect(projectRouteFrom(projectDestinationState(route))).toEqual(route);
  expect(projectDestinationState('schedule')).toEqual({ section: 'schedule' });
 });
 it.each([undefined, null, 'schedule', { section: 'unknown' }, { section: 'details', origin: { planId: 'floor' } }])('declines malformed or non-contextual layout %j', value => {
  expect(projectRouteFrom(value)).toEqual({ section: 'details' });
 });
 /**
  * AD13's hand-off rides the same whitelist as the three record ids: `projectOriginFrom` names the
  * keys it copies, so an `assetId` that is not in that list is silently stripped on the way into
  * `PlanEditorView` — which is exactly the state the navigation half shipped in and had to pass no
  * origin at all to avoid.
  */
 it('round trips the asset a designer hand-off names, and trims a blank one like every other id', () => {
  const route = { section: 'schedule' as const, origin: { planId: 'floor', assetId: 'asset-01JABC' } };
  expect(projectRouteFrom(projectDestinationState(route))).toEqual(route);
  expect(projectRouteFrom({ section: 'schedule', origin: { planId: 'floor', assetId: '  ' } })).toEqual({ section: 'schedule', origin: { planId: 'floor' } });
 });
 it.each([undefined, null, 7, {}, { planId: 4 }, { planId: ' ' }])('drops a malformed origin %j without dropping the known section', origin => {
  expect(projectRouteFrom({ section: 'schedule', origin })).toEqual({ section: 'schedule' });
 });
 it('accepts only nonempty identity strings and discards unrelated frontmatter fields', () => {
  expect(projectRouteFrom({ section: 'schedule', origin: { planId: 'floor', roomId: '', workId: 1, costId: 'cost', payload: 'ignored' } })).toEqual({ section: 'schedule', origin: { planId: 'floor', costId: 'cost' } });
 });
});
