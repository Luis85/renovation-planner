---
type: Task
parent: "[[Capture and retrieve evidence from spatial context]]"
order: 50
status: New
horizon: "V1"
release: ""
---

# Create and open a spatially linked Markdown note

## Evidence

M14 requires Add note to use a configured folder and template, then open the note through
Obsidian while preserving the selected spatial context.

## Why it matters

Creating the note where its context is known prevents an unlinked Markdown file and keeps the
result ordinary vault content that remains useful without the editor.

## Approach

Resolve the configured note folder and template through their settings authority, create the
Markdown note through the canonical vault-note path, and link it to the selected target through
the common evidence command. Open the resulting file in Obsidian only after both required writes
complete or are safely compensated.

## Acceptance criteria

1. The new note is created in the configured folder from the configured template.
2. One authoritative evidence relationship links it to the selected spatial target.
3. The note remains ordinary Markdown and opens in an Obsidian workspace leaf.
4. Cancelling creates neither note nor relationship.
5. Missing configuration, template failure, link refusal and open failure are surfaced distinctly
   without presenting unavailable configuration as an empty value.

## Risks

- A note write followed by a failed link could leave an uncontextualized file.
- Reimplementing template expansion in the editor could disagree with the configured authority.

## Outcome

A renovator can create, link and open an ordinary Markdown evidence note from spatial context.
