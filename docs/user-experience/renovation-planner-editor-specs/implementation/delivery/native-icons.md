# Native-icon delivery reconstruction

Status: source/evidence transfer complete; cumulative validation **pending**.

The base was verified with `gh pr view 96` on 2026-09-09: the open PR's published
`codex/editor-release-wall-rotation` head was
`037a8496a71b914e55b49e5e06cecb51564db77f`. This isolated delivery branch starts there.

| Original concern commit | Reconstructed commit | Scope |
| --- | --- | --- |
| `518a1af447ead93806d0c4d6bee1d7b92d14cdbe` | `8087e6ede58bf79ea25df3412fc7b5c08515f4eb` | Explicit Lucide namespace and canonical grid icon name; supporting tests/receipt |
| `a7ecbaa61296b443bb59a620c6653e8a35850afb` | `183386a3794d36dff0090336d0b23c836f3191ef` | Original native reload receipt and five screenshots |

Both cherry-picks applied without conflicts. The reconstructed cumulative source/evidence
tip is `183386a3794d36dff0090336d0b23c836f3191ef`; the following documentation-only commit
carries this mapping. Its final branch HEAD is reported in the delivery handoff.

The source diff contains only HostIcon, editorIcons, FloorStart and DirectActionPopover.
The supporting diff contains editorIconNodes, obsidianIcons, HostIcon.test and the icon
fixture README. No styles, runtime commands, persistence, dependencies, package files or
unrelated editor features were transferred. This mapping is the only additional file.

The original [native icon receipt](../evidence/native-icon-audit.md) is unchanged. Its source
SHAs, installed JS/CSS hashes, native-window observations and acceptance limits still name
the original debug build. Those screenshots are historical evidence, not captures of this
new cumulative branch. Git blob equality was checked for the receipt and all five images;
the image working-file bytes also matched their original blobs.

| Preserved file | SHA-256 of original/preserved bytes |
| --- | --- |
| native-icon-audit.md (Git-normalized text) | `ea3ae37756611f8c9f853383f201140366c235ec2272f5755e3d474780c466f6` |
| add-behind-start-dark.jpg | `8898f0822da55b840d05681825d94d81e1e883d18e99f8dc88cabc96a3111334` |
| add-planning-dark.jpg | `565a814bd8c3ef77a302b1fa3e5a4cb179cb3bb4dfe0497a3dde6dc33679d796` |
| add-structure-property-dark.jpg | `0b3ec80195b603768326fb42fd97c70c8b2776687c66fa2844c788ce56dd02c7` |
| after-reload-dark.jpg | `2ad54768ceb08e964223364bd0c958c37ff6d541a26419c9bbac77be0f322635` |
| before-reload-dark.jpg | `d95a833e5f6a0924defbdd4bdb4a3ba6ea2fe17ecc342bbf5c1f5e2740adc589` |

No tests, type check, lint, browser/native run, push or PR creation has been performed for
this reconstructed cumulative SHA. Before publication, validate the new checked-out HEAD
with the appropriate cumulative checks and record any new captures under their actual
source revision. The historical receipt's passing checks do not stand in for that work.
