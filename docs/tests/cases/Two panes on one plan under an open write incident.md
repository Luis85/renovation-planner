---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 101
sources:
  - ADR-0034 — a write incident is durable and vault-scoped
  - "`docs/using-planning-recovery.md` — the user-facing retirement gesture"
  - BP-02 limitation L-01 (a second pane bypasses the incident) and L-03 (no fake can duplicate a leaf)
status: Ready
---

# Two panes on one plan under an open write incident

**An open write incident pauses every guarded write in the vault, and this is the only
instrument for whether a SECOND pane on the same plan is paused with the first.** ADR-0034
records a durable incident file per vault; BP-02 slice 4 made every Vue surface read it, by
seeding the shared save-state store from `activeWriteIncidentRegistry()` when the store is
created. Each Obsidian leaf mounts its own Vue app and its own Pinia (ADR-0004), so "a second
pane asks for itself" is the whole mechanism — no leaf knows another exists.

**Read "every Vue surface" narrowly**: the Plan Editor and the project view's work section are
gated by it; the Asset Designer is NOT gated at all, and step 5 exists to keep that visible.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and a
project with at least one floor holding rooms. **Create sample renovation project** seeds one.

## Why a human is the only instrument for all of it

The mechanism under the gesture is tested — `tests/presentation/editor/saveState/
saveStateStore.test.ts` drives the seed, `tests/presentation/editor/runtime.test.ts` and
`tests/presentation/designer/designerIncidentGate.test.ts` drive the gate each surface computes
from it, and `tests/presentation/editor/saveState/uncompensatedIncident.test.ts` drives the
already-open pane catching up on a refused write. **The GESTURE is not, and cannot be here.**

- **Nothing in this repository can duplicate a leaf.** `duplicateLeaf` appears nowhere in `src/`
  or `tests/`, `FakeWorkspace` has no split and no layout restore, and no test anywhere drives
  two Plan Editor leaves on the same plan (BP-02 limitation L-03). A fake that pretended to
  would be kinder than Obsidian, which is this repository's most expensive recurring defect —
  so this case exists instead of one.
- **Whether Obsidian's own split really duplicates a leaf with its view state intact** is a
  claim `src/application/events/planChangeSource.ts` makes in prose and nothing checks. Step 2
  is where it is looked at rather than assumed.
- **Whether a restored layout brings back two same-plan leaves** is the same question through a
  restart. Step 7.
- **Whether the plugin reads the incidents file at all in a real plugin folder.** Every
  automated case installs the registry directly; only a vault exercises
  `WriteIncidentFileStore` against Obsidian's own adapter. Steps 1 and 8.

## The fault setup

**Record which one you used, in the Runs table.** There is no control that raises an incident,
by design — ADR-0034 refuses to offer one — so the record is planted by hand.

- **Primary — plant a recognised record.** With Obsidian closed or the plugin disabled, create
  `.obsidian/plugins/renovation-planner/write-incidents.json` containing exactly:

  ```json
  {"schemaVersion":1,"incidents":[{"schemaVersion":1,"incidentId":"incident-manual-1","raisedAt":"2026-09-17T00:00:00.000Z","code":"zone.sidecar-write-uncompensated","category":"Persistence","affected":[]}]}
  ```

  An empty `affected` array is a legal, fully open stamp (ADR-0034's identity ruling: it means
  the raise site could not name what it left standing). **Write it with an editor or with node,
  never with PowerShell 5.1's `Set-Content`/`Out-File -Encoding utf8`** — those write a BOM and
  `JSON.parse` refuses one, which would land you in the alternative below without meaning to.
- **Alternative — plant an UNREADABLE file.** Any file whose top level is not an object with an
  `incidents` array — `{}` will do. This is the fail-closed path (SDD §87 rule 8): the store
  refuses the read, `WriteIncidentRegistry.seed` carries one unknown open incident, and the gate
  shuts anyway. Worth one run of its own, because it is the arm a corrupted file takes and the
  one a user is most likely to reach by accident.
- **Not an alternative — provoking a real incident.** It needs a write to land and its
  compensating undo to fail, which means failing two vault operations in a chosen order. That is
  [[Recover from a stale read]]'s territory and is not reproducible by hand here.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could
discharge it as written. [[Smoke Test the Editor]]'s *The triage column* section defines
the five values and what they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `obsidian` | Plant the incidents file per the fault setup, then reload the plugin (disable and re-enable it in **Community plugins**, or restart Obsidian). Run **Open plan editor** and pick the sample flat's Ground floor | The editor opens and draws its rooms, and it is PAUSED from the first frame: the warning strip above the canvas reads *A change was written but could not be completed or undone. Inspect the floor's note before editing further.*, every **Add** entry and the Room Inspector's **Delete** and **Assign** are dimmed, and Undo and Redo are dimmed too | The seed not running at all in a real plugin folder — the automated cases install the registry object directly and never read a file. Also the opposite: a pause that only appears after a refused write, which would mean the store starts clean and the gate is catching up rather than being seeded |
| 1a | `judgement` | Read that strip's sentence again, knowing the incident was raised by nothing this floor did | Expected to read WRONG as written: *Inspect the floor's note before editing further* names this floor, and a vault-scoped incident may have been left by a write on another plan, another project, or an earlier session. **This is a recorded copy gap, not a failure of the pause.** Record whether you found it misleading | The copy gap closing or widening unnoticed. `editor.unrecovered` was written when the flag meant "this leaf left a write behind"; BP-02 slice 4 widened the flag to "writes are refused" and deliberately did not rewrite user-facing copy in the same change. `write-incident.writes-paused`, which the refusal in step 4 resolves, already says the right thing — the two sentences now disagree about scope |
| 2 | `obsidian` | With that leaf focused, split it — right-click the tab → **Split right**, or drag the tab to the edge of the pane | Two Plan Editor leaves are open on the SAME floor, both drawing the plan | Obsidian not duplicating the view state at all, which would open an empty or failed pane rather than a second editor on this plan. That is the claim `planChangeSource.ts` makes in prose and nothing in this repository checks |
| 3 | `obsidian` | In the NEW pane, read the warning strip, open **Add**, select a room and read the Room Inspector | The second pane is paused identically to the first: same strip, same dimmed entries, same dimmed **Delete** and **Assign**. **This is L-01's acceptance line** | The whole of L-01. Each leaf owns its own Pinia and its own `writesBlocked`; before BP-02 slice 4 the second pane offered a fully enabled UI over a half-written vault, and every write it dispatched was refused by the guarded door underneath with nothing on screen saying why |
| 4 | `obsidian` | In the second pane, try to make a write anyway: press **Add** → **Room** if the menu still opens, or select a room and press **Delete** | Nothing is written, and the refusal says so rather than failing silently. Record exactly what appeared — a notice, a message under a field, or nothing at all | A paused control that is dimmed but still dispatches. The pause is an affordance; the guarded door is the guarantee, and a silent refusal here would mean the two disagree about which one the user hears |
| 5 | `obsidian` | Open the **Asset designer** on any asset (from the asset library, or **Design an asset**) | The designer opens. **NOTHING about it is expected to look paused — no dimmed button, no warning strip, and a footprint drag still previews normally. That is a recorded gap, not a failure of this case.** What must hold is that no write LANDS: press **Edit dimensions**, commit a height, and drag a footprint vertex to a release, then reopen the asset and confirm the design is unchanged. Record what the surface said, if anything | The Asset Designer is not gated at all — not a tool, not a button, not the inspector, not the preset form. BP-02 slice 4 gave its `EditorContext.writesBlocked` an honest value where it hard-coded `false`, and nothing reads it: `grep -rn "writesBlocked()" src/presentation/editor/` prints 23 call sites in six modules, and the designer registers none of those tools. The guarded doors underneath still refuse, so this is an affordance gap. This row exists so that gap closing — or widening — is noticed, instead of being met cold by a later reader as a new defect |
| 6 | `obsidian` | Open **Settings → Renovation Planner** and change any setting — units will do — then return to both editor panes | Both panes are still paused. The strip, the dimmed controls and the save-state label are all still there | The rebind losing the gate. A settings save unmounts and remounts every leaf's Vue app with a fresh Pinia; the seed is what makes the fresh store come back paused, and this is the one gesture that rebuilds it without a reload |
| 7 | `obsidian` | Quit Obsidian entirely and reopen the vault, leaving both panes in the layout. Look at the restored panes FIRST, before touching anything, then try a write in each | **Expected: a restored pane is NOT paused on its first frame — no strip, controls live — and its first write is refused, after which it is paused and stays so.** A pane you open by hand afterwards IS paused from its first frame. The incidents file is still on disk and unchanged. Record which of the two you saw in each pane | The startup ordering, which is a real limitation rather than a nicety: the registry's file read is started from `startPersistence` at `onLayoutReady`, and `RenovationPlannerPlugin.ts`'s own comment records that Obsidian restores its leaves BEFORE `onLayoutReady`, so a restored leaf asks a registry that has not read anything yet. Nothing in this repository can observe Obsidian's real ordering, which is why this row is written to what the code supports and why a PAUSED restored pane is as interesting a result as a live one — report either. Also whether Obsidian restores two same-plan leaves at all |
| 8 | `obsidian` | Run **Show diagnostics report** from the command palette (or the settings pane's diagnostics row) | The report names the open write incident and the full path of `write-incidents.json`, and tells you to check the affected files against a backup, then remove that file and reload the plugin. It offers no control that clears anything | The retirement gesture being undiscoverable. ADR-0034 refuses a plugin-decided all-clear, so naming the file IS the remedy; a report that named the incident without the path would leave a blocked user with no way out |
| 9 | `obsidian` | Delete `write-incidents.json` and, WITHOUT reloading, return to a pane and try a write | Still paused, still refused. **This is expected and is the reason step 8's copy names the reload** — the registry reads the file once at load and nothing re-reads it | Copy that stopped at "remove the file". An earlier draft of the user-facing sentence did exactly that and sent a blocked user round a loop |
| 10 | `obsidian` | Reload the plugin (or restart Obsidian) with the file gone, and try the same write | Every pane is live again: no strip, no dimmed controls, and the write lands. The vault gains exactly what you wrote and nothing else | A pause that outlives its record — the flag is set-never-unset WITHIN a session, and a reload is the only thing that may clear it. A pane still paused here would mean something cached the gate outside the registry |

## What this case does NOT cover

- **An incident raised in another leaf while this pane is already open.** The registry notifies
  nobody, so an already-mounted pane does not re-render its controls; it catches up at its next
  write, which the gate refuses. Making the gate reactive is a separate increment. To look at
  it you would need two panes and a real half-failed write, which the fault setup above already
  says is not reproducible by hand. Step 7's restored-pane row is the same limitation reached from
  startup rather than from a peer, and it IS walkable.
- **Whether any Asset Designer control is paused.** None is — see step 5. This case observes that
  its writes are refused; it observes nothing about its affordances, because there is nothing
  there to observe.
- **Two Obsidian WINDOWS on one vault.** Those are two processes with two registries and two
  `KeyedQueues` lanes over one file; ADR-0034 states both consequences and fixes neither.
- **Whether any of this is announced by a screen reader.** The paused reason is a
  visually-hidden element pointed at by each control's `aria-describedby`; jsdom proves the
  wiring and axe proves the semantics, and neither proves a reader speaks it.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | **Not yet run in a vault.** Every row above is an expectation derived from ADR-0034, the store and registry source, the English copy and the composition root — never from memory of any of them, and never from a run. No part of this case has been executed in Obsidian. Record the fault setup used, the Obsidian version and the platform. |

## Outcome

Written after the first walk: which steps passed, which fault setup was used, whether Obsidian
duplicated and restored the leaves as step 2 and step 7 assume, and anything only a live vault
showed.
