---
type: Task
parent: "[[Capture and retrieve evidence from spatial context]]"
order: 20
status: New
horizon: "V1"
release: ""
---

# Link an existing vault document from spatial context

## Evidence

M14 uses an Obsidian file chooser and preserves a vault link. [[Document linking and types]] owns
the document relationship and states that Obsidian already stores the file.

## Why it matters

The quickest way to organize an existing quote, manual or permit is to link it while standing in
the room or wall it concerns, without copying or relocating it.

## Approach

Open the vault file picker from the selected spatial context, collect document type and optional
work relation, then dispatch the common evidence-link command. Refresh the Inspector from the
relationship query and provide Open in Obsidian.

## Acceptance criteria

1. The picker starts with the selected spatial target prefilled.
2. Submitting writes one authoritative relationship and does not duplicate the file's bytes.
3. Cancelling writes neither a relationship nor a new file.
4. The linked document appears after query refresh and opens through Obsidian.
5. A target deleted before submit produces a refusal and leaves the chosen file untouched.

## Risks

- Path normalization or renames could break links if stable vault-link semantics are bypassed.
- A failed relationship write must not be reported as a failed file copy.

## Outcome

Existing vault documents can be attached to spatial context without ceasing to be ordinary files.
