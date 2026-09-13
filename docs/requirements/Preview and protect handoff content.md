---
type: PBI
parent: "[[Versioned handoff packages]]"
order: 20
status: New
horizon: "V1"
release: "[[Mighty Dragon]]"
dependsOn: "[[Assemble a handoff package from canonical records]]"
---

# Preview and protect handoff content

## Actor

[[Private renovator]] checking exactly what will leave a private Obsidian vault.

## Main flow

1. The plugin shows the complete package outline, recipient, purpose, warnings and attachment
   manifest before issue.
2. The renovator expands a section or file and follows it to its source when clarification is
   needed.
3. They may exclude optional evidence or private notes; required exclusions remain visible as
   declared omissions.
4. The preview identifies broken, unreadable, stale and externally located files separately.
5. The renovator confirms the final inclusion set before any output is written.

## Extensions

- **3a** — A required item is excluded. The package may remain valid for consultation with an
  explicit omission, or readiness may block a quote/execution issue according to its rule.
- **4a** — A file lies outside the vault or no longer resolves. It is never copied implicitly;
  the user must deliberately import/link it or issue without it.
- **5a** — Output generation fails. No issue is marked issued and no partial output is presented
  as the package the recipient received.

## Guarantee

Nothing leaves the vault through a handoff package without appearing in the confirmed preview,
and an omission never masquerades as complete information.

## Out of scope

- Digital-rights management or preventing a recipient from copying issued files.
- Cloud sharing, accounts or automatic email delivery.
- Scanning documents for secrets or legal privilege.

## Acceptance criteria

1. Preview and generated output use the same ordered inclusion manifest.
2. Optional content can be excluded without changing the canonical source.
3. Required omissions are named in readiness and in the package.
4. Broken, unreadable, stale and external files have distinct states.
5. Confirmation is required before output is written.
6. Failed generation leaves the draft unissued and reports any recoverable partial files.

## Sources

- SDD §§54–55, 66, 68, 86–87 and 103.
- PRD §§42–44 and 103.
- PRODUCT.md local-first and Evidence on Hand decisions.
