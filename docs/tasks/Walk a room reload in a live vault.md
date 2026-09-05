---
type: Task
parent: "[[Reload the editor without losing room data]]"
order: 30
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Walk a room reload in a live vault

## Evidence

Repository fakes cannot prove Obsidian workspace restoration or MetadataCache timing.

## Why it matters

The release claim includes closing a leaf and restarting the host, not only remounting Vue.

## Approach

In the release vault, create and name a room, record its values, close/reopen the leaf, restart
Obsidian, and compare the room, source note, sidecar geometry, and derived area.

## Acceptance criteria

- Both reopen paths restore the same stable room and values.
- No duplicate note, sidecar object, or write notice appears.
- The run records Obsidian version, platform, date, and result.

## Risks

Visual similarity can hide an identity change; inspect the persisted ID.

## Outcome

Live-host evidence covers the reload behavior automation cannot model.

## Closing evidence

**2026-09-05**, the trust path increment. **What this task delivered is the instrument, and the
walk has NOT been run** — [[Reload a room]]'s own Runs table says so. `Done` here means the case
exists, is in [[Smoke Test the Editor]]'s census (seven steps, six of them `obsidian`), and names
what to record; it does not mean anyone has restarted Obsidian and compared. This is why
[[Reload the editor without losing room data]]'s criterion 5 is recorded there as **outstanding**
rather than ticked: an unrun manual case is a plan to find out, not a finding.

It is **the only case in this suite that requires a full restart**, which is exactly the gap the
automated reopen cases cannot close: both of them model a reopen with fresh objects over a vault
that never left memory. Step 5 is a new process, Obsidian's own workspace restoration, and a
`MetadataCache` rebuilding from disk — the three mechanisms behind the defect this suite has
already caught once, a restored Plan Editor saying *This plan no longer exists* because leaves
restore BEFORE the index scan they hydrate against.

Its step 4 is where "reading does not write" is read off the note's own `revision` on disk rather
than inferred from a spy, and its step 7 is where a duplicate note or a second sidecar object under
one id would be visible at all — the shape a reopen taking an INSERT where an update was owed would
produce. Step 6 answers this task's own Risks paragraph directly: visual similarity is exactly what
hides an identity change, so the comparison is on the id recorded at step 2.
