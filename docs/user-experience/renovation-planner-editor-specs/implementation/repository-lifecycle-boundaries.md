# Public repository lifecycle boundaries — verified

Five source-prepared cases live in `tests/plugin/repositoryLifecycleBoundaries.test.ts`.
Root approved this exact bounded package. No production code changes are included.
They use real repository commands and vault operations; interleavings forward to the
original implementation rather than fabricating successful or failed Results.

| Case | Public trigger and invariant | Original 430 null arm |
| --- | --- | --- |
| Schema-invalid JSON sidecar | Explicitly delete a valid Asset with its damaged sidecar; preserve other files | `AssetGeometryStore.ts`, b0[1], line132 |
| Late Project removal | Project disappears after Quote link validation but before the real insert; no orphan Quote/folder | `ObsidianQuoteRepository.ts`, b3[0], line26 |
| Parsed Markdown without frontmatter | A stale conditional save must preserve the user's now ordinary Markdown | `noteIo.ts`, b16[1], line298 |
| Removal after landed write | Peer removes the note before echo stat observation; no replay or recreation | `noteIo.ts`, b6[1], line185 |
| Missing origin Plan for evidence lookup | Existing Markdown resolves from the empty source context and requests only its existing native open path | `ObsidianEvidenceFiles.ts`, b1[1], line17 |

The existing sidecar tests cover invalid JSON and readable foreign ownership; this
package uses valid JSON with an invalid schema. Existing Quote deletion tests remove
the Project before service validation; this package removes it at the later real
write boundary. Existing no-frontmatter tests exercise the read helper, while this
case reaches the public conditional save. Existing evidence tests use a present Plan.

The Evidence collaborator models the single ordinary Markdown-basename lookup against
real fixture files, and records the native open request. It does not claim complete
Obsidian link-resolution behavior or actual host navigation. No private Vue handler
is invoked and no UI, browser, physical-device or performance acceptance is claimed.

Verified on owner `067e3bf3`: 5/5 native tests passed (43.51 seconds), types,
whole Oxlint, scoped ESLint and Fallow static analysis passed with zero issues/clones.
The scoped coverage repeat passed 5/5 (13.28 seconds) and hit exactly the five
originally identified branch arms on unchanged source/maps. No statement/function
gain or aggregate full coverage pass is claimed. All global floors stayed unchanged.
[Exact original-map receipt](evidence/repository-lifecycle-counter-gains.json).
