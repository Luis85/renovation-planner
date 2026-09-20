<script setup lang="ts">
/**
 * Task B8's inspector region: the asset's derived dimensions, an honest warning when they are
 * not yet real measurements, and the one design scalar that lives in the note rather than in
 * the geometry sidecar — its height.
 *
 * **Dimensions are read-only here on purpose (§88).** `AssetDesignDto.dimensions` is DERIVED
 * from the footprint (`GetAssetDesign`'s own docblock: "a traced outline needs no typed numbers
 * beside it and the two can never disagree"), so a text field bound to it would be a second,
 * writable copy of a value with exactly one source of truth. Editing the rectangle is Task B8's
 * OTHER surface instead — the `asset-dimensions` dialog, reached through the `editDimensions`
 * prop this component only CALLS and never opens itself, so the gesture is written once, in
 * `AssetDesignerRoot.vue`, for its one caller and this component's shared use of it.
 *
 * The height field is the opposite shape: `SetAssetHeight`'s own value, nothing else derives
 * it, and it commits on blur/enter through `useFieldCommit` exactly as `RequirementRow`'s two
 * override fields do — the same commit boundary, the same routed field error, the same rule
 * that a clean field blurred dispatches nothing (slice 16's Reset-button lesson, met here at a
 * field that has no reset button to walk past the guard: `useFieldCommit`'s own `submitted ===
 * null` check is the whole of what closes it).
 */
import { computed, ref, useId } from 'vue';
import type { AssetDesignDto } from '../../../application/queries/GetAssetDesign';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { Logger } from '../../../application/ports/Logger';
import { ok } from '../../../core/result/Result';
import type { EditShape } from '../selection/editShape';
import { partKey, type DesignerSelection } from '../selection/designerSelection';
import { rovingIndex } from '../../components/rovingIndex';
import DesignerSelectionInspector from './DesignerSelectionInspector.vue';
import DesignerArrangePanel from './DesignerArrangePanel.vue';
import DesignerReferenceStatus from './DesignerReferenceStatus.vue';
import DesignerReferencePlacement from './DesignerReferencePlacement.vue';
import DesignerClearanceHelper from './DesignerClearanceHelper.vue';
import DesignerClearanceReview from './DesignerClearanceReview.vue';
import DesignerUsageScope from './DesignerUsageScope.vue';
import { useFieldCommit } from '../../composables/use-field-commit';
import type { FieldErrorMap } from '../../errors/route-error';
import { trError } from '../../i18n/toUserMessage';
import { reportDispatchFailure } from '../../editor/report-failure';
import { tr } from '../../i18n/strings';
import FieldError from '../../components/FieldError.vue';

const props = defineProps<{
	design: AssetDesignDto;
	setHeight: (height: number | null) => Promise<DispatchResult>;
	/**
	 * Take the reference sheet away (AD12-R2), passed straight through to `DesignerReferenceStatus`.
	 *
	 * **REQUIRED, and prop-drilled from `AssetDesignerRoot` rather than read off the runtime**, which
	 * was the other shape on offer and is measured rather than argued: reading
	 * `useDesignerRuntime()` here makes this component throw on any mount without a leaf's runtime
	 * injected, and `designerReferencePanels.test.ts` deliberately mounts the real inspector bare to
	 * prove the three blocks are BOUND. That case went red on the injection form with
	 * *"The asset designer was mounted without a DesignerRuntime"*, which is the component becoming
	 * un-mountable outside a leaf in exchange for saving one binding. Every other collaborator here
	 * — `setHeight`, `editShape`, `lockedGraphics` — already arrives as a prop off the same runtime,
	 * so this is the established shape and not a new one.
	 */
	removeBackground: () => Promise<void>;
	editDimensions: () => Promise<void>;
	startFromPreset: () => Promise<void>;
	logger: Logger;
	/** The part the canvas has selected, `null` for none; its section is keyed by part, so choosing another starts it fresh. */
	selection: DesignerSelection | null;
	/**
	 * The leaf's one write door, at its OWN width rather than narrowed: an edit may answer `null` for
	 * "nothing to do on the shape I was handed", which dispatches nothing and pushes no undo entry.
	 * The composition block below needs that arm for contract C05's no-op rule; the selection
	 * inspector takes the narrower `ShapeEdit` shape and this value still satisfies it.
	 */
	editShape: EditShape;
	select: (next: DesignerSelection | null) => void;
	/*
	 * `openLibrary` and `usePlan` were declared here until AD18 moved both controls into
	 * `DesignerHeader`, and they are DROPPED rather than kept as pass-throughs: a prop nothing
	 * reads is a binding the next author keeps alive for a control that is not here.
	 */
	/** Every selected part, in selection order — the last is the one whose fields show (AD08). */
	selected: readonly DesignerSelection[];
	/** Whether the sticky "select multiple" mode is on (AD08). */
	multiSelectionMode?: boolean;
	/**
	 * Turn that mode on or off, or `undefined` where no runtime binds one.
	 *
	 * A value down and a callback up, rather than the runtime's `Ref` handed over as a prop:
	 * `v-model` on a prop is a mutation of it, which `vue/no-mutating-props` refuses — measured,
	 * the first version of this control failed exactly there. The Plan Editor's own checkbox
	 * escapes the question by reading its runtime directly; this panel takes everything as props,
	 * so it takes this one the same way.
	 */
	setMultiSelectionMode?: (next: boolean) => void;
	/**
	 * The graphic ids this leaf has LOCKED (AD09's `PartView.locked`), which the Arrange block hands
	 * the domain as `immovable` so a composition cannot move a part the user pinned.
	 *
	 * **REQUIRED, unlike `openLibrary` and `setMultiSelectionMode` beside it, and the difference is
	 * what ABSENCE would mean.** Those two are optional because their absence says something true:
	 * no runtime behind this mount, therefore no navigation to offer. Absence says nothing here —
	 * "this leaf has no locks" and "nobody told me about the locks" are different states, and an
	 * `?? new Set()` default collapses them into the permissive one. So a mount that forgot to bind
	 * it would compose a locked part like any other, silently, with all four gates green and a
	 * person the only thing that could ever notice.
	 *
	 * It shipped optional for exactly one commit and that is precisely what it did: `AssetDesignerRoot`
	 * did not bind it, so C06's "locked elements must not move by implication" was live the whole
	 * time the rule existed. Required costs four mount sites and makes the omission a build failure.
	 */
	lockedGraphics: ReadonlySet<string>;
}>();

/** The locks this panel passes on. Required above, so there is no default to write and none to hide behind. */
const locked = computed(() => props.lockedGraphics);

/** How many graphics this design has — what decides whether composing a set is even possible. */
const graphicCount = computed(() => props.design.shape?.details.length ?? 0);

/**
 * Both codes are `SetAssetHeightCommand`'s own — `Asset.ts`'s `checkHeight`, through
 * `withChanges` — read from the raise sites rather than guessed from the field's name (this
 * repository's own rule for every `FieldErrorMap` in the plugin).
 */
const HEIGHT_ERRORS: FieldErrorMap<{ height: number | null }> = {
	'asset.invalid-height': 'height',
	'asset.negative-height': 'height',
};

/**
 * The draft is a raw STRING, exactly as `RequirementRow`'s cost and quantity fields are and
 * for the same reason: a parsed `number` draft rewritten back through `:value` on every
 * keystroke corrupts any prefix that parses to `NaN`, and a leading decimal point could never
 * be typed at all. `Number` is applied once, at `buildCommand`, once `validate` has already
 * passed.
 */
const height = useFieldCommit<string, { height: number | null }>({
	canonicalValue: () => props.design.height?.toString() ?? '',
	buildCommand: (raw) => ({
		// Reached only once `validate` below has passed, so this parse cannot yield `NaN`.
		execute: () => props.setHeight(raw.trim() === '' ? null : Number(raw.trim())),
		undo: () => Promise.resolve(ok('no-write')),
	}),
	// `props.setHeight` already dispatches through the leaf's own mapped, never-rejecting
	// dispatcher (`DesignerRuntime.commitHeight`), so this "history" is a pass-through rather
	// than a second command stack — the same shape `RequirementRow`'s two fields take over
	// `InspectorStore.commit`.
	history: { run: (command) => command.execute() },
	errorMap: HEIGHT_ERRORS,
	field: 'height',
	toUserMessage: trError,
	notify: reportDispatchFailure,
	logger: props.logger,
	validate: (raw) =>
		raw.trim() === '' || Number.isFinite(Number(raw.trim())) ? null : tr('designer.inspector.height.unparseable'),
});

/**
 * **The button stays, and only its NAME moves with the state.** It used to disappear with the
 * block above, on the reasoning that the empty state's own action was the hand-off while this
 * is `null` — which was true of `noShape` and not of the state a fresh asset actually lands
 * in. A shapeless asset with no sheet selects `noBackground`, whose only action is the picker,
 * and that ordering is deliberate; so the whole of "type a width and a depth" — which needs no
 * sheet, no calibration and no tracing — was reachable only after choosing an unrelated file.
 * This panel is mounted in every state, which is what makes it the right place to fix that.
 *
 * With no shape there is nothing to EDIT, so the label says what the gesture does instead.
 */
const dimensionsLabel = computed(() =>
	props.design.dimensions === null ? tr('designer.inspector.set-dimensions') : tr('designer.inspector.edit-dimensions'),
);

/**
 * **The two tabs, and there are exactly two** — ruling AD18-R2, taken by the user because the
 * concept boards contradict each other: board 01 draws `Object | Style | Reference` and board 02
 * draws `Object | Properties`, so neither could be cited as the target. The split is against what
 * this surface actually HAS rather than against either picture. The object, its placement and its
 * clearance are one subject; the reference sheet and its calibration are another, and are the half
 * a user is not looking at while drawing. There is no `Style`: the designer has no styling
 * controls at all, and a tab that shipped empty is a promise the surface does not keep.
 *
 * The problem it solves is measured: with one part selected this panel was 887 px of content in a
 * 625 px column, 42 % below the fold before any clearance or review block appeared, in a 224 px
 * rail.
 *
 * **What AD18-R2 forbids, and where each refusal is kept:**
 *
 * - The Clearance block and the clearance-review notice stay TOGETHER, both in `object`. That
 *   notice is a `role="status"` live region and step 29 of *Calibrate a sheet and reserve space*
 *   records a real user reading it as belonging to the Clearance block above it — a tab between the
 *   two would destroy the one judgement answer this package owns.
 * - The tab control JOINS the keyboard model already here rather than competing with it. The Parts
 *   panel and the preset gallery both roam a tabindex over their items with `rovingIndex`, and this
 *   is that same function with the same clamping and the same one-tab-stop rule — one Tab reaches
 *   the strip, the arrows and Home/End move within it. The `<aside>`'s own `tabindex="-1"` is
 *   untouched: it is a focus TARGET for `DesignerSelectionInspector`'s delete hand-off, never a Tab
 *   stop, and the strip does not take that role away.
 * - The `design !== null` gate is `AssetDesignerRoot`'s and stays there, so
 *   `.rp-designer-inspector` is still an EMPTY region for a loading or failed leaf rather than an
 *   empty tab strip.
 *
 * **`v-show`, not `v-if`, on the panels**, for two reasons that agree. `DesignerUsageScope` reads
 * its plan usage ONCE at setup with no watch, so unmounting it on every tab switch would re-run
 * that query and re-flash its loading line; and a directive is not a branch, where two `v-if`s
 * would be two more arms against a coverage margin the wave lease measures in single units.
 * `display: none` takes a hidden panel out of the accessibility tree and out of the tab order
 * exactly as `hidden` would.
 */
const TABS = ['object', 'reference'] as const;
const activeTab = ref<(typeof TABS)[number]>('object');
const tablist = ref<HTMLElement | null>(null);
/** One pair of ids per mounted inspector, so two open designers cannot point at each other's panels. */
const tabId = { object: useId(), reference: useId() };
const panelId = { object: useId(), reference: useId() };

/**
 * Left/Right/Home/End across the strip, ACTIVATING as it goes — the WAI-ARIA tabs pattern's
 * automatic activation, which is its own recommendation wherever revealing a panel is cheap, and
 * both of these are already rendered.
 *
 * `horizontal` is `true` because this strip is a row; that also admits Up and Down, which is the
 * shared helper's shape rather than this component's choice and costs nothing here. `from` can
 * never be `-1` — `activeTab` is always a member of `TABS` — which is the precondition
 * `rovingIndex`'s own header asks every caller to meet.
 */
function onTabKeydown(event: KeyboardEvent): void {
	const next = TABS[rovingIndex(event.key, TABS.indexOf(activeTab.value), TABS.length, true)];
	if (next === undefined) return;
	event.preventDefault();
	activeTab.value = next;
	tablist.value?.querySelector<HTMLElement>(`[data-rp-tab="${next}"]`)?.focus();
}
</script>

<template>
	<!--
		No class here: this `<aside>` is the whole content of `AssetDesignerRoot.vue`'s
		`.rp-designer-inspector` div (padding, background, border-left already there, and no
		sibling this element needs to stand out from), so an own class would style nothing and
		the widened `libraryComponentStyles.test.ts` scan would keep flagging it undeclared. Kept
		as a landmark for its `aria-label`, dropped as a class.

		`tabindex="-1"` makes it a surviving focus TARGET and not a Tab stop (spec Amendment 2):
		`DesignerSelectionInspector` hands focus here when Delete or Duplicate unmounts the button
		that had it — the plan editor's `EntityInspector` aside, for the same reason.
	-->
	<aside
		tabindex="-1"
		:aria-label="tr('designer.inspector')"
	>
		<h2 class="rp-designer-panel-title">
			{{ tr('designer.inspector') }}
		</h2>
		<!--
			AD18-R2's two tabs. `data-rp-tab` is what the keyboard handler and the suites select on —
			a class is for appearance and an action attribute is for identity, which is the rule
			`DesignerUsePlan`'s own `data-rp-action` already states.
		-->
		<div
			ref="tablist"
			class="rp-designer-tabs"
			role="tablist"
			:aria-label="tr('designer.inspector.tabs')"
			@keydown="onTabKeydown"
		>
			<button
				v-for="tab in TABS"
				:id="tabId[tab]"
				:key="tab"
				type="button"
				role="tab"
				class="rp-designer-tab"
				:data-rp-tab="tab"
				:aria-selected="activeTab === tab"
				:aria-controls="panelId[tab]"
				:tabindex="activeTab === tab ? 0 : -1"
				@click="activeTab = tab"
			>
				{{ tr(`designer.inspector.tab.${tab}`) }}
			</button>
		</div>
		<div
			v-show="activeTab === 'object'"
			:id="panelId.object"
			class="rp-designer-tabpanel"
			role="tabpanel"
			:aria-labelledby="tabId.object"
		>
			<!--
				**How many parts are selected** (AD08). Drawn only for a set of two or more: with one
				selected the section below already says which part it is, and a count of "1" beside it
				would be a second way of saying the same thing.
			-->
			<p
				v-if="selected.length > 1"
				class="rp-designer-selection-count"
				role="status"
			>
				{{ tr('designer.selection.count', { count: String(selected.length) }) }}
			</p>
			<DesignerSelectionInspector
				v-if="selection !== null"
				:key="partKey(selection)"
				:design="design"
				:selection="selection"
				:edit-shape="editShape"
				:select="select"
			/>
			<!--
				**The composition block** (AD10), a SIBLING of the section above rather than part of it:
				that one acts on the focused part and this one on the whole selection, and a single
				graphic can legitimately be in both (it can still be repeated, and its group can still be
				moved to an end). It draws nothing when no graphic is selected, so it costs the other
				selection kinds nothing.
			-->
			<DesignerArrangePanel
				:design="design"
				:selected="selected"
				:edit-shape="editShape"
				:locked="locked"
			/>
			<!--
				The asset's own block gets a heading of its own, so its Dimensions never read as the size of the
				part whose section sits right above them (selection polish critique, finding 4).
			-->
			<h3 class="rp-designer-panel-title rp-designer-section-title">
				{{ tr('designer.inspector.asset') }}
			</h3>
			<!--
				**The usage scope** (AD13-R1): which plans place this definition, stated where the user
				can see it before they change it. Under the `Asset` heading directly above it and above
				every control that rewrites the thing — Edit dimensions, Start from preset, and every
				geometry command the canvas dispatches — because an impact scope drawn after the gesture
				it is about is a receipt rather than a disclosure.

				**The asset's NAME used to sit between the two and is now in the header** (AD18-R1),
				which is the one thing that ruling asked the implementing card to check rather than
				assume. It still reads as being about the asset: `<h3>Asset</h3>` is what sits directly
				above it now, and this block's own `<h4>Used in plans</h4>` reads as a subsection of that
				heading — which a paragraph of plain text never was. So no heading was added here, and no
				            second copy of the name.

				It takes nothing from this panel: the query and the index gate are per-LEAF, so it
				reads them off the designer context and decides on its own what it has to say. A mount
				outside a leaf draws nothing rather than throwing, which is what keeps the four suites
				that mount this inspector bare mounting it — `DesignerUsageScope`'s own header carries
				the grep behind that count and why injecting is what forced the question.
			-->
			<DesignerUsageScope />
			<!--
				`design.dimensions` is `null` exactly when the asset has no footprint — the same field
				`GetAssetDesign`'s own docblock says is "never `{ width: 0, depth: 0 }`" — so the block
				and its warning disappear together rather than showing a rectangle of zeroes.
			-->
			<dl
				v-if="design.dimensions !== null"
				class="rp-designer-inspector-fields"
			>
				<dt>{{ tr('designer.inspector.dimensions') }}</dt>
				<!-- Whole millimetres: a curve's box is irrational, and no drawing is read finer than that. -->
				<dd>{{ Math.round(design.dimensions.width) }} × {{ Math.round(design.dimensions.depth) }} mm</dd>
			</dl>
			<p
				v-if="design.dimensions !== null && design.dimensionsUnscaled"
				class="rp-designer-unscaled"
			>
				{{ tr('designer.inspector.dimensions.unscaled') }}
			</p>
			<button
				type="button"
				class="rp-designer-edit-dimensions"
				@click="() => void editDimensions()"
			>
				{{ dimensionsLabel }}
			</button>
			<button
				type="button"
				class="rp-designer-start-preset"
				@click="() => void startFromPreset()"
			>
				{{ tr('designer.inspector.start-preset') }}
			</button>
			<!--
				**The way BACK and the way FORWARD both left this panel in AD18** and are in the header
				(`DesignerHeader.vue`), which is where AD06 item 1 asks for them. They are still one pair
				drawn side by side, for the reason they were a pair here: they are this surface's only
				navigations, and a user looking for one looks where the other is.
			-->
			<!--
				C05: adding to a selection needs a control a keyboard and a touch user can reach, not a
				modifier alone. The Plan Editor's own "Select multiple elements" checkbox, in the panel
				that governs the same gesture — same shape, same binding, so the two surfaces behave
				alike (C12). It STAYS while on, for that control's own reason: the mode also governs
				canvas presses, so it must never be left unreachable.
			-->
			<label
				v-if="setMultiSelectionMode !== undefined && (graphicCount > 1 || multiSelectionMode === true)"
				class="rp-designer-multi-select"
			>
				<input
					type="checkbox"
					data-rp-action="multiple-selection"
					:checked="multiSelectionMode === true"
					@change="setMultiSelectionMode(($event.target as HTMLInputElement).checked)"
				>
				{{ tr('designer.selection.toggle-mode') }}
			</label>

			<FieldError
				v-slot="{ inputId, aria }"
				:message="height.error.value"
			>
				<label
					class="rp-designer-field"
					:for="inputId"
				>
					{{ tr('designer.inspector.height') }}
					<input
						:id="inputId"
						v-bind="aria"
						type="number"
						name="height"
						min="0"
						step="any"
						:aria-busy="height.pending.value"
						:value="height.draft.value"
						@input="height.onInput(($event.target as HTMLInputElement).value)"
						@blur="height.onCommit()"
						@keydown.enter="height.onCommit()"
						@keydown.esc.stop="height.onCancel()"
					>
				</label>
			</FieldError>
			<!--
				**Placement and reserved space** (AD12), siblings of the asset's own block rather than
				rows inside it: each answers a different question — which point a plan positions this
				object by, and what it needs kept free around it — and each decides on its own whether it
				has anything to say. Both draw nothing until there is a shape.

				After the height, deliberately: height is descriptive metadata on the asset itself
				(ADR-0014) and stays where it was, and nothing below it is an input to any vertical
				calculation — AD12 introduces no clash check and this ordering is not the start of one.

				**The third of AD12's siblings, `DesignerReferenceStatus`, is in the OTHER tab** — where
				the millimetres come from is a fact about the SHEET, which is the subject AD18-R2 split
				out. Placement stays here despite its component's name: the anchor and the facing are the
				object's, and that ruling puts "the object, its placement and its clearance" in one tab.
			-->
			<DesignerReferencePlacement
				:design="design"
				:edit-shape="editShape"
			/>
			<DesignerClearanceHelper
				:design="design"
				:edit-shape="editShape"
			/>
			<!--
				**The clearance review notice and its answer** (AD14), beneath the clearance block it is
				about and LAST in this panel, because it is the only block here that appears and
				disappears in response to an edit made elsewhere on this surface: nothing below it can be
				pushed down when a resize sets the flag. Its notice and its button are one `<section>`,
				so the two never separate. It draws nothing unless `clearanceNeedsReview` is set, which
				leaves every other state of this panel exactly as it was.

				**In the SAME tab as the Clearance block above it**, which is the sharpest of AD18-R2's
				three refusals: this is a `role="status"` live region, and step 29 of the manual case
				*Calibrate a sheet and reserve space* records a real user reading it as belonging to that
				block. A tab between the two would destroy the one judgement answer this package owns.
			-->
			<DesignerClearanceReview
				:design="design"
				:edit-shape="editShape"
			/>
		</div>
		<!--
			The reference sheet and its scale — the half a user is not looking at while drawing, which
			is what makes it a tab of its own rather than a section (AD18-R2).

			`DesignerReferenceStatus` decides on its own whether it has anything to say, and for an
			asset typed from dimensions with no sheet the answer is nothing — so this panel is EMPTY
			in that state. That is the one place this card left short of the ruling's spirit: the
			honest fix is a line inside that component saying there is no sheet yet, and that file is
			outside this card's lease.
		-->
		<div
			v-show="activeTab === 'reference'"
			:id="panelId.reference"
			class="rp-designer-tabpanel"
			role="tabpanel"
			:aria-labelledby="tabId.reference"
		>
			<DesignerReferenceStatus
				:design="design"
				:remove-background="removeBackground"
			/>
		</div>
	</aside>
</template>
