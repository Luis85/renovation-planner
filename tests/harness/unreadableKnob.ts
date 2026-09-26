/**
 * `?unreadable=N` — WHICH zones the refusal takes out of the harness fixture, and the refusal
 * when a URL asks for more than it holds.
 *
 * The knob itself is armed in `harnessDeps` (`planEditor.ts`); this module owns the half that
 * needed an argument. A real listing answers the zones that LOADED plus a count of the notes
 * that did not (`zoneListingSkips.test.ts` over `tests/vault/unreadable-zone/`), so a fake that
 * answers the whole list with a count bolted on is kinder than the real thing: it drew four
 * polygons under a strip saying two of them were never read, and the Floor Inspector summed all
 * four under the same claim.
 *
 * **The prunable set is `harness-bath` and `harness-terrace`, in that order, and the maximum is
 * therefore two.** Those two are the only seeded zones named by nothing in `HARNESS_STRUCTURE` —
 * no wall, no opening and no `boundaries` entry — which `unreadableKnob.test.ts` re-runs rather
 * than leaving to this paragraph. The other two are excluded for two different reasons, and
 * neither is fidelity: `harness-garden` holds all fourteen free-standing walls AND is
 * `planEditor.ts`'s `STALE_TRIGGER_ZONE_ID`, so dropping it would leave `?stale`'s own
 * `selectZoneOnceReady` clicking nothing and then timing out on a Delete button that never
 * arrives — a failure blaming the wrong knob; `harness-kitchen` owns the only walls, openings and
 * boundary in frame, so pruning it would gut the picture the two captures exist to take. That
 * second one is a PICTURE-CONTENT reason, not a faithfulness one — a sidecar boundary naming a
 * refused room is exactly what a real vault yields — so an `N` of three is available to whoever
 * needs it and needs no new argument about the structure.
 *
 * **Pruning from the END of the list is the obvious one-liner and is wrong**: at `N=1`
 * `slice(0, -N)` drops the Garden, which is both of the Garden's two problems above at once.
 *
 * **Above the maximum this THROWS rather than clamping**, and the throw fires synchronously
 * inside `harnessDeps` so a jsdom case sees it immediately and a real capture records a page
 * error. Clamping at the top would photograph a two-refusal state under a seven-refusal URL and
 * exit 0 — the silent-wrong-picture class `parseRoomKnob` and `staleTriggerZoneSnapshot` already
 * refuse in the same file. Clamping at the BOTTOM stays where it is, because `0` is a state this
 * page genuinely has.
 *
 * A call at `0` answers the seeded list unchanged, so no capture that does not ask for a refusal
 * can be reached by this at all.
 */
import type { ZoneDto } from '../../src/presentation/read-models/PlanDto';

/**
 * Taken as an argument rather than imported back out of `planEditor.ts`, which is the shape
 * `areaNumericWorkspace(base, HARNESS_PLAN, HARNESS_ZONES)` already takes in this directory and
 * which keeps the two modules out of an import cycle.
 */
const PRUNABLE: readonly string[] = ['harness-bath', 'harness-terrace'];

export function loadedZones(zones: readonly ZoneDto[], unreadable: number): readonly ZoneDto[] {
	if (unreadable > PRUNABLE.length) {
		throw new Error(
			`?unreadable=${unreadable} is above this fixture's maximum of ${PRUNABLE.length}: only ${PRUNABLE.join(', ')} may refuse`,
		);
	}
	if (unreadable === 0) return zones;
	const refused = new Set(PRUNABLE.slice(0, unreadable));
	return zones.filter((zone) => !refused.has(zone.id));
}
