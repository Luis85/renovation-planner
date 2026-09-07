# Project and Library dependency flows

Status: **Native/type/lint verified in Root; full coverage contribution pending.**. Prepared in the root finalization worktree
on 2026-09-07. Only `tests/presentation/editor/projectLibraryFlows.test.ts` and this
document were added. No production code, existing tests, helpers, shared status
files or review state was changed. Root owns verification and checkpointing.

## Four scenarios

1. The public editor Library navigation reuses an existing `FakeWorkspace` Library
   leaf and preserves its initial selection/expansion and the editor leaf's Plan
   state. The mounted Library uses real `assetLibraryDeps` over `downstreamStack`.
   After a no-match search, native New Asset fields create a real Furniture asset
   at 450.00 EUR per piece. The test discovers its actual generated identity from
   the repository, verifies the exact Money value, cleared search, expanded
   category and selected definition. Returning through public `revealLeaf` leaves
   the editor's state and saved bytes intact.
2. A native Supplier edit remains dirty while the user presses Back, searches for
   the same asset and clicks its row again. The local text returns without a
   discard dialog or Update command. Only the subsequent explicit Discard restores
   the saved value; neither navigation nor discard writes to the vault.
3. A genuine peer Update command creates a definition conflict while local text
   remains dirty. The actual rendered Refresh control is clicked twice while one
   real successful catalogue query result is held before delivery. The test
   requires one query and zero new writes, then releases the original result and
   checks that the local draft and bytes remain unchanged. No fake failure or
   fabricated successful listing is injected.
4. The actual `RenovationProjectView` is mounted with `Platform.isMobile = true`,
   so the production context creates its read-only state. Its dependencies use
   the real root's Project/Plan queries. Native filtering to no matches provides
   Clear but no Create-named/Create action. Clearing, opening the Project and
   returning use rendered controls and public host navigation. Plan opening stays
   disabled; no Create Project, Open Plan, dialog or vault write occurs. The
   original mobile flag is restored in cleanup.

Every mounted Library/View and per-rig subscription is disposed. The held query
is released in `finally`; spies are restored after each case. No private Vue
methods, component `$emit` calls, fake-created identities or altered baseline
objects are used.

## Evidence limits

The editor in the first case is a **FakeLeaf with recorded Plan state**, not a
mounted editor. `FakeWorkspace` verifies public navigation calls and preservation
of that state; it cannot establish actual Obsidian activation, pane rendering,
history or editor focus. The separately mounted Library is real Vue with real
composition. Its helper publishes selection/expansion through its public context
refs, without claiming the host `setState` round trip.

The mobile case mounts the real Project view, including its Platform-to-context
mapping, but the Workspace/leaf are still host fakes. It is not a mobile-device
acceptance result. Device-local Continue memory is empty in this fixture; all
Project/Plan and Asset data comes from real repository producers.

## Coverage provenance and correction

The read-only audit used `ci-45c58609-linux24/missing-counters.json` in
`%TEMP%/rp-finalization-20260907-88b9ee3d/`. The three audited production files were
unchanged since that checkpoint. Expected candidates, **not measured hits**, are:

- `AssetLibraryRoot.vue:162`, branch `20:0`, real created asset found in the listing.
- `AssetLibraryRoot.vue:172`, branch `21:0`, same-asset reselection.
- `ProjectList.vue:522`, branch `51:1`, read-only no-match creation omission.
- `useDefinitionDraft.ts:58`, branch `13:0`, repeated native Refresh while busy.

The last case corrects the initial audit premise: Refresh in
`AssetInspectorFields.vue` has no disabled binding, unlike Save/Discard. Its busy
guard is reachable through actual controls and is now a legitimate test candidate.
No missing-wrapper or artificial thrown-error cases were added.

## Resume

Source and whitespace inspection only; **no tests, types, lint, browser, build or
analyser have run for this package**. Root should run this four-case file with the
scheduled dependency checks, examine actual failures, then run normal shared
verification. Verify counters against a fresh combined coverage artifact and
retain all original full-run evidence. The package does not establish overall
completion or replace the final visual/live-host acceptance.

## Root verification

The combined two-file run passed all8cases in43.84seconds. Whole type checking,
whole Oxlint, scoped ESLint and a fresh static Fallow scan passed; zero dead-code
issues or clone groups. No production change or assertion correction was needed.
Logs: financial-library-native/types/static in the root finalization scratch.
The dedicated coverage session will measure the actual full-run contribution.
