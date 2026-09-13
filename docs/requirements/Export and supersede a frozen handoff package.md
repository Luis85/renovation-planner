---
type: PBI
parent: "[[Versioned handoff packages]]"
order: 30
status: New
horizon: "V1"
release: "[[Mighty Dragon]]"
dependsOn:
  - "[[Preview and protect handoff content]]"
  - "[[Review readiness for one handoff purpose]]"
---

# Export and supersede a frozen handoff package

## Actor

[[Private renovator]] issuing a portable package and later determining whether it is still current.

## Main flow

1. The renovator confirms the package preview and readiness result.
2. The plugin creates a locally owned issue with package ID, purpose, recipient, issue date,
   inclusion manifest, source revisions, open questions, warnings and human-readable output.
3. The issue is marked issued only after every promised output is confirmed written.
4. Later source changes are compared with the recorded revisions and shown as an impact list.
5. The renovator may create a new issue carrying the delta; the earlier issue becomes superseded
   only by an explicit link and remains readable.

## Extensions

- **2a** — A source changes after preview but before write. Issue is refused until preview and
  readiness are refreshed from the new baseline.
- **2b** — A source is intentionally unresolved for consultation. Its open-question state is
  frozen with the issue.
- **3a** — One output fails after another succeeds. The package remains unissued and reports the
  partial files; retry cannot silently create a second package identity.
- **4a** — An unrelated source changes. The issue remains current and no false superseded warning
  is produced.

## Guarantee

An issued package is an immutable record of what was prepared from which source revisions; newer
information creates a new issue and never rewrites that record.

## Out of scope

- Treating export as proof that a recipient received or approved the package.
- Editing issued package content in place.
- A required cloud share link or document portal.

## Acceptance criteria

1. Every issue has a stable identity and complete source-revision manifest.
2. Issued status follows confirmed output writes, not the user's click.
3. A baseline change between preview and issue is detected and refused.
4. Only changes to included or readiness-relevant sources make the package potentially outdated.
5. Supersession is explicit, bidirectionally traceable and preserves the earlier issue.
6. Output remains understandable without the plugin and includes purpose, recipient, issue date,
   status and open questions.

## Sources

- PRD §§43, 60–63 and 66.
- SDD §§3.5–3.6, 29–31, 42, 44 and 87.
- Competitive landscape Opportunities 5 and 7.
