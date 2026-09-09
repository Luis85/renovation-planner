# Input and Stair behavioral coverage

Prepared from `f5a28f45` (the stable `b758695c` integration plus its verified contract
repairs). The failed resource-thrashed full run supplied branch locations, not acceptance.
Its missing branches are investigated as behavior gaps; no threshold or exclusion changes
are made here.

The new cases exercise actual editor menus and forms: keyboard menu navigation/focus,
outside dismissal and teardown races, text/modal/draft refusal, disabled actions, stale
selection, typed Room/Area/Wall/Object routes, real metadata/deletion history, platform
undo/redo shortcuts, group selection delegation, and Stair invalid/pending/conflicted or
disposed form lifetimes. Repository-backed write/read failures retain the draft or reject
retired work. SelectTool port cases verify that refusal never falls back to moving a single
group member.

Scoped ESLint/Oxlint and TypeScript passed on the first candidate. The five-file one-worker
batch passed 28 of 29 tests. Its one failure expected a Room-deletion dialog, but the existing
`deleteWithReferences` contract dispatches immediately when there are no referents. The
corrected case requires actual repository deletion with no dialog, exact Undo restoration,
then unchanged bytes across cancelled Wall edits/deletion. That corrected case has not yet
been rerun; its result must not be included in the 28 passing cases above.

At the coordinator's request, these source additions are committed for one combined focused
batch with the other coverage contributions, followed by the unchanged full gate. No separate
coverage boot or coverage-increase claim is made here. Full coverage and visual/native
acceptance remain separate release gates.
