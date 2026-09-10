# Room edge measurement delivery reconstruction

Status: **cumulative validation pending**. Branch `codex/editor-deliver-room-edges`
starts at clean creation tip `2f3f9092e9c39edb273a46156b059ac947960a67`, following
rotation presentation, shell, details, native icons and published PR94 → PR95 → PR96.
Source/compatibility tip before this mapping:
`2960da1352fa9379068e660d3bd195d77680aeea`.

| Original source | Reconstructed source |
|---|---|
| `e0feef740cd7c66b90bf181faea41152ead5fd96` | `02d68a8749d087bae593c429c2e392c6916e5a12` |
| Exactly the two-line Room-edge hover amendment from `da58c82215341f81833678a777ea17d4dcb6a2e4`, plus true CLI declaration | `2960da1352fa9379068e660d3bd195d77680aeea` |

This concern displays actual Room edge lengths during rotation, outline editing and
free-form creation, and exposes free-form drawing from the task banner and numeric
Inspector. The existing Room/Zone and independent-wall boundaries remain intact.

## Shared context and changed-file audit

- Resolve the changelog conflict by adding the Room-edge entry alongside the
  current hover-arrow claim. Do not resurrect the source ancestor's superseded
  permanent labelled-rotation-control description.
- Transfer exactly the M03 all-edge/free-form amendment. The source ancestor's
  separate Exact retyped dimensions section was context, not part of `e0feef74`;
  it was absent from the clean predecessor and remains allocated to its numeric
  intent concern. This is not cancellation of that accepted requirement.
- Preserve creation's taskbar-clearance hook, custom property and explicit Finish
  walls/opening labels in TemporaryToolBanner while adding free-form entry.
- The driver now gets `rotationHoverPoint(id)`, moves the actual pointer there and
  awaits two animation frames before reading the rotation scene. Its complete blob
  equals `da58c822`; no assertion was removed. `.fallowrc.json` declares the genuine
  `scripts/editor-room-edge-check.mjs` CLI entry, which was not yet listed.

Of the original 15 changed paths, 11 final blobs match `e0feef74` exactly. The four
differences are the reviewed changelog/M03 context, the exactly restored later
driver amendment, and preserved creation taskbar behavior. The original Room-edge
implementation/evidence-status document is unchanged. No capture or image bytes
were modified. The CLI declaration makes 16 paths relative to creation; this mapping
adds one document.

Only source/conflict inspection, Git blob/diff comparison and `git diff --check`
were performed. Tests, types, lint, browser/native captures and cumulative full
validation are **unrun** for this reconstructed revision. Original source/build
identifiers, evidence hashes, timestamps and limitations remain historical claims
about their named revisions. No heavy checks, push, PR, published-branch rewrite or
integration-ancestry merge was performed. Root owns the final combined comparison,
verification and publication.
