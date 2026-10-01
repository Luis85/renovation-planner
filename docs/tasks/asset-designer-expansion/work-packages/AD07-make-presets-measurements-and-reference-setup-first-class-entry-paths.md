# AD07 — Make presets, measurements and reference setup first-class entry paths

**Owner:** UX · **Scope:** beta · **Relative size:** M

**Prerequisites:** AD02, AD03, AD06  
**Exclusive lock groups:** creation. Exact file leases are still required.

## User or delivery outcome

A novice can create a usable object without providing a reference drawing or completing catalogue administration.

## Entry points to inspect

- `src/presentation/designer/presets/AssetPresetForm.vue`
- `src/domain/asset/presets/catalogue.ts (reuse; changes need domain lease)`
- `src/presentation/designer/AssetDesignerRoot.vue (integration lease only)`
- `Existing asset creation/library commands resolved in AD00`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Offer Start from object, Start from measurements and Trace reference at the appropriate empty state. Reuse existing preset builders and parameter validation.
2. Present searchable visual preset choices with live previews and a small set of meaningful fields.
3. Create a named measured rectangle with optional descriptive height; price/category/supplier must not block creation.
4. Explain that initial preset generation yields editable geometry unless persistent parameters are actually implemented. Confirm replacement of an existing manual design.
5. Keep reference import local and optional. Route new asset creation through current catalogue commands, including recoverable failure between note and sidecar creation.

## Acceptance criteria

- [ ] A measured 1200 × 450 mm asset can be created without a background or calibration dialog.
- [ ] Preset preview matches committed geometry and subsequent library/plan rendering.
- [ ] Cancellation creates no orphan catalogue entry or sidecar.
- [ ] Invalid units/values retain the draft and explain the error; valid values are not rounded destructively.
- [ ] Changing a preset never silently overwrites manual edits.
- [ ] Creation returns a real persisted asset ID and a usable designer/plan transition.

## Required verification

- Create-from-measurements and preset flow tests, including repeated submit and cancelled forms.
- Fault-inject partial creation and retry; verify no duplicate asset IDs or orphaned usable-looking objects.
- Usability scenario U01 from ACCEPTANCE-AND-QA.md.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

## Amendments

### Amendment 1 — the optional descriptive height is DEFERRED, not delivered (2026-09-17, accepted at the AD07 review)

Implementation item 3 reads *"Create a named measured rectangle with optional descriptive height;
price/category/supplier must not block creation."* The named measured rectangle and the
non-blocking catalogue fields shipped. **The optional descriptive height did not**, and the reason
recorded in the first candidate's report was the wrong one.

**The binding constraint is a LEASE, not a line budget.** `CreateAssetInput` declares no `height`
field at all, so the value has nowhere to travel from the form to `Asset.create` — and
`src/application/commands/asset/CreateAsset.ts` is not in AD07's lease. The command half of this
item needed a lease this task never held, so it could not have been written here whatever the form
measured. (`src/presentation/views/NewAssetForm.vue` at 399 counted lines against its 400-line
`max-lines` budget is TRUE and was measured — `npx eslint` reported 434 with a height field in
place — but it is a second constraint on the same work rather than the one that decides. The
earlier report named it as the reason; this amendment corrects that.)

**The outcome is deferred to a second screen rather than lost.** `Asset.create` already validates
a height through `checkHeight` inside its own smart constructor, and the designer inspector already
writes one through the existing `SetAssetHeight` command the moment the created asset opens — which
is the very next screen this flow lands on. So a user can give the object a height without this
item; they cannot give it one *at creation time*.

**Trigger.** Do this when a single task holds BOTH leases at once: `CreateAsset.ts` (for
`CreateAssetInput.height` passed into `Asset.create`, which needs no second write, no repository
change and no schema version) and `NewAssetForm.vue` together with room to grow it — the cheapest
way to make that room is to extract the numeric-field row that width and depth already spell
identically into one small component, which takes the file from 399 to roughly 355. The error codes
`asset.invalid-height` and `asset.negative-height` already exist with copy in both locales and need
only routing to a `height` field in `NEW_ASSET_ERRORS`.
