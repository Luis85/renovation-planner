# Creation delivery reconstruction

Status: **cumulative validation pending**. Branch `codex/editor-deliver-creation`
starts at clean rotation presentation `6d676e0c`, after shell `6fee2df4` and the
published PR94 → PR95 → PR96 stack. Source tip before this mapping:
`1b7306b753cb9bf836c137dd8da92ca079658923`.

| Original source | Reconstructed source |
|---|---|
| `44d83685157646b35d0d43fbd82b9c6de9db083f` | `d9013e567399be4abe9cb153e89a4437f08dcd82` |
| `818047922e45e8382e37fa554f478ad9b2f3f70b` | `e583aa67e8c226b4c94773e040c830b689a529a8` |
| `2fa68a8f884ddefbe96badcb2caf778d0900c6cc` | `3b079762926055283c863264eadabaa65c971817` |
| `ff249ef1` | `1b7306b753cb9bf836c137dd8da92ca079658923` |

The final concern retains canvas-first activation, explicit Details for numeric
editing, draft Room outlines/vertices/dimensions, wall dimensions/corner feedback,
FloorStart helpers and taskbar clearance above the Select/Add kernel. The temporary
auto-opening Inspector watcher in the first source commit is removed by the second;
it is not the final delivered behavior. Duplicate cherry `c94a3a05` was not copied.

## Shared context and changed-file audit

The two cherry-pick conflicts were EntityInspector's heading class and the
stylesheet import tail. Preserve both shell heading classes and both shell/creation
stylesheet imports. Automatic context merges preserve shell locale spreads and the
rotation obstacle publication/invalidation contract in RoomDimensionLabels.
No hover/gesture/selection implementation was replaced.

The four source commits touch 26 distinct paths. Comparing final blobs with the
latest owning source commit gives 21 exact matches. The five differences are
RoomDimensionLabels (rotation obstacle contract), EntityInspector (shell heading
class), both editor locale aggregators (shell spread), and index.css (shell import).
All are inherited prerequisite behavior retained alongside creation. The three
creation/visual/taskbar historical receipts match their original owning blobs.
No screenshot or capture provenance changed. This mapping adds one document.

Only source/conflict inspection, Git blob/diff comparison and `git diff --check`
were performed. Tests, types, lint, browser/native captures and the cumulative full
gate are **unrun** for this reconstructed tip. Original check/capture claims retain
their original SHAs and limitations. No heavy process, push, PR, published-branch
rewrite or merge of integration ancestry was performed. Root owns cumulative
verification and publication.
