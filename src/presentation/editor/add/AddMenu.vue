<script setup lang="ts">
/**
 * Task 17's Add menu — what the floating Add button opens (design spec §7.1). NOT a dialog:
 * there is no `DialogHost` framework caller here, no `inert` on the background and no focus
 * trap by Tab, because this menu does not block interaction with the rest of the editor the
 * way a dialog must. It is a `role="menu"` with roving `tabindex` instead (WAI-ARIA's own
 * pattern), a search box that filters it live, and Escape/outside-click doors that close it
 * and hand focus back to the button that opened it.
 *
 * **The search input sits OUTSIDE `role="menu"`, not above the groups inside it.** `menu`'s
 * ARIA role permits only `menuitem`/`menuitemradio`/`menuitemcheckbox`/`group` as children,
 * and an `<input type="search">` (implicit role `searchbox`) is none of those — built this
 * way from the first draft rather than measured broken first, since the ARIA contract alone
 * rules it out. `.rp-add-menu` is the true root — the element `@keydown.stop` and the
 * outside-click check both use — and it wraps the search input and the `role="menu"` element
 * as two siblings, which is legal.
 *
 * **The group headings needed a scan to find, which the input placement did not.** A plain
 * `<h3>` inside `role="group"` failed the SAME rule (`aria-required-children`: "Element has
 * children which are not allowed: h3") once the open menu was actually scanned — `menu`'s
 * allowed-owned-elements computation reaches through `group` and finds the heading, which is
 * no more a `menuitem` than the search input was. Each heading carries `role="presentation"`
 * for it, which removes its own ARIA semantics from that computation while leaving the tag
 * itself an `<h3>` and its `id` still resolvable by the group's `aria-labelledby` — accname
 * computation reads a referenced element's text regardless of the role on it.
 *
 * **A single `@keydown.stop` on the root, not one handler per item.** The menu root is where
 * `EditorSurface`'s own `.rp-plan-overlay` wrapper already stops a POINTER press from
 * reaching the canvas (`.stop` on `pointerdown`/`pointerup`/`pointercancel`); `.stop` on
 * `keydown` here is the same rule for the keyboard, so Escape closes this menu and is never
 * seen by `EditorSurface.onKeyDown`'s own Escape branch — the canvas's active tool and its
 * selection are exactly as they were before the menu opened.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { tr, currentLanguage } from '../../i18n/strings';
import type { StringKey } from '../../i18n/locales/en';
import { useEditorRuntime } from '../runtime';
import {
	CREATION_CATALOGUE,
	matchesQuery,
	type CreationEntry,
	type CreationEntryId,
	type CreationGroup,
} from './creationCatalogue';

const props = defineProps<{ anchor: HTMLElement | null }>();
const emit = defineEmits<{ close: [] }>();

const runtime = useEditorRuntime();

/** The locked group order (design spec §7.1) and the heading each one draws. */
const GROUP_ORDER: readonly CreationGroup[] = ['structure', 'property', 'planning'];
const GROUP_LABEL_KEYS: Record<CreationGroup, StringKey> = {
	structure: 'editor.add.group.structure',
	property: 'editor.add.group.property',
	planning: 'editor.add.group.planning',
};

/**
 * One `useId()` per group heading, called UNCONDITIONALLY over the fixed `GROUP_ORDER` rather
 * than lazily per render — `LayerList.vue` carries the reason this file follows the same
 * shape for: a call made only when a group is about to render would answer a different id
 * sequence depending on which groups the current filter happens to include.
 */
const groupHeadingIds: Record<CreationGroup, string> = {
	structure: useId(),
	property: useId(),
	planning: useId(),
};

/** Same reasoning, one id per catalogue entry, for the `aria-describedby` an unsupported item carries. */
const reasonIds: Record<CreationEntryId, string> = Object.fromEntries(
	CREATION_CATALOGUE.map((entry) => [entry.id, useId()]),
) as Record<CreationEntryId, string>;

const query = ref('');
const focusedId = ref<CreationEntryId | null>(null);

const menuRoot = ref<HTMLElement | null>(null);
const searchInputEl = ref<HTMLInputElement | null>(null);
const itemEls = new Map<CreationEntryId, HTMLButtonElement>();

function setItemEl(id: CreationEntryId, el: Element | null): void {
	if (el instanceof HTMLButtonElement) itemEls.set(id, el);
	else itemEls.delete(id);
}

/** The whole catalogue, in its own (already group-ordered) sequence, narrowed by the search box. */
const filteredEntries = computed<readonly CreationEntry[]>(() =>
	CREATION_CATALOGUE.filter((entry) => matchesQuery(entry, query.value, currentLanguage())),
);

/** Only the groups that still have something to show, in the locked order. */
const visibleGroups = computed<readonly CreationGroup[]>(() =>
	GROUP_ORDER.filter((group) => filteredEntries.value.some((entry) => entry.group === group)),
);

/**
 * A roving `tabindex` must always name a rendered item — the ARIA menu pattern's own
 * invariant — and typing in the search box can filter the focused entry OUT of the list
 * without ever moving DOM focus away from the input, since the roving state is a fact about
 * `focusedId` rather than about which element the browser currently has focused. Left alone,
 * every remaining button would read `tabindex="-1"` and Tab would skip the whole group.
 * `moveFocus`'s own `currentIndex === -1` recovery answers the same question for a keyboard
 * press; this is the answer for a press that never arrives.
 */
watch(filteredEntries, (list) => {
	if (list.some((entry) => entry.id === focusedId.value)) return;
	focusedId.value = list[0]?.id ?? null;
});

function entriesFor(group: CreationGroup): readonly CreationEntry[] {
	return filteredEntries.value.filter((entry) => entry.group === group);
}

function reasonIdFor(entry: CreationEntry): string | undefined {
	return entry.availability.kind === 'unsupported' ? reasonIds[entry.id] : undefined;
}

/**
 * Moves the roving `tabindex` AND the real DOM focus together — the ARIA menu pattern's own
 * rule.
 *
 * Every caller (mount, `moveFocus`, `focusFirst`/`focusLast`) names an id already in
 * `filteredEntries` at the moment it calls this, so that entry's button already exists in
 * `itemEls` — its ref callback ran in the same render pass that put the id into the list.
 * A guarded `itemEls.get(id)?.focus()` would be a branch no test could ever take the other
 * arm of; the cast states the same guarantee `DialogHost.vue`'s own casts do, as a type
 * rather than as an unreachable `if`.
 */
function focusEntry(id: CreationEntryId): void {
	focusedId.value = id;
	void nextTick(() => (itemEls.get(id) as HTMLButtonElement).focus());
}

function focusFirst(): void {
	const first = filteredEntries.value[0];
	if (first !== undefined) focusEntry(first.id);
}

function focusLast(): void {
	const last = filteredEntries.value.at(-1);
	if (last !== undefined) focusEntry(last.id);
}

/**
 * ArrowDown/ArrowUp, wrapping — through every item the filter still shows, enabled or not.
 *
 * `nextIndex` is computed with `% list.length` AFTER the `list.length === 0` guard above, so
 * it is always a valid index into a non-empty `list` — indexing it needs no further undefined
 * check the way `focusFirst`/`focusLast` genuinely do for an empty list.
 *
 * `currentIndex` is never -1 here either, which is worth stating because an EARLIER version
 * of this function special-cased it (`currentIndex === -1 ? 0 : …`), for a `focusedId` a
 * filter change had left pointing at an entry no longer in `list`. The `watch(filteredEntries,
 * …)` above is what closed that gap — it resyncs `focusedId` the moment the filter would
 * otherwise strand it, which is also what a roving `tabindex` must never do — so by the time
 * any key reaches this function, `focusedId` already names something `list` contains. Keeping
 * the special case after that fix would have been a branch nothing could take the other arm
 * of.
 */
function moveFocus(delta: 1 | -1): void {
	const list = filteredEntries.value;
	if (list.length === 0) return;
	const currentIndex = list.findIndex((entry) => entry.id === focusedId.value);
	const nextIndex = (currentIndex + delta + list.length) % list.length;
	focusEntry(list[nextIndex].id);
}

/** Available activates and closes; unsupported does nothing — the only two outcomes a press has. */
function activate(entry: CreationEntry): void {
	if (entry.availability.kind !== 'available') return;
	entry.activate(runtime);
	emit('close');
}

function onItemClick(entry: CreationEntry): void {
	focusedId.value = entry.id;
	activate(entry);
}

function activateFocused(): void {
	const entry = CREATION_CATALOGUE.find((candidate) => candidate.id === focusedId.value);
	if (entry !== undefined) activate(entry);
}

/**
 * Every key this menu answers, asked once at the root rather than once per item.
 *
 * Home/End are withheld while the SEARCH INPUT has focus, because there they mean "start/end
 * of the typed text" — a native editing gesture this menu must not steal. Space is withheld
 * there too, for the plainer reason that "kitchen" and "living room" both contain one: typing
 * a space must type a space. Enter is not withheld: it never types a character, and letting it
 * activate whichever item the roving focus currently names is what lets a user filter and then
 * commit without leaving the search box.
 */
function onKeydown(event: KeyboardEvent): void {
	const inSearchInput = event.target === searchInputEl.value;
	if (event.key === 'Escape') {
		emit('close');
		return;
	}
	if (event.key === 'ArrowDown') {
		event.preventDefault();
		moveFocus(1);
		return;
	}
	if (event.key === 'ArrowUp') {
		event.preventDefault();
		moveFocus(-1);
		return;
	}
	if (event.key === 'Home' && !inSearchInput) {
		event.preventDefault();
		focusFirst();
		return;
	}
	if (event.key === 'End' && !inSearchInput) {
		event.preventDefault();
		focusLast();
		return;
	}
	if (event.key === 'Enter') {
		event.preventDefault();
		activateFocused();
		return;
	}
	if (event.key === ' ' && !inSearchInput) {
		event.preventDefault();
		activateFocused();
	}
}

/**
 * Outside the menu AND outside the button that opened it — a press on the anchor is its own
 * click, not a close.
 *
 * **Registered on `document` with `{ capture: true }`, and that is load-bearing rather than a
 * style choice.** `AddMenu` mounts as a SIBLING of `FloatingPrimaryActions` (Select and Add)
 * inside `EditorSurface`'s `#overlay`, and that slot's own `.rp-plan-overlay` wrapper carries
 * `@pointerdown.stop`/`@pointerup.stop`/`@pointercancel.stop` (Task 8) so a press there never
 * reaches the canvas underneath. A BUBBLE-phase listener on `document` — the first version of
 * this function — sits behind that same `stopPropagation()`, so a press on the Select button,
 * or on this menu's own search input, or on the `anchor` button, never bubbled far enough to
 * arrive: the menu stayed open after the user pressed Select, and the "inside menu"/"on
 * anchor" checks below were never exercised at all by a press anywhere in the real tree.
 * Capture runs top-down, BEFORE the bubble phase a sibling's `stopPropagation()` could ever
 * cut off, so this one listener covers the canvas, Select, this menu's own controls, and every
 * future sibling the overlay slot gains — none of them need to be named here.
 *
 * `event.target` is cast rather than narrowed: an ordinary pointer press always targets the
 * DOM node it landed on (the other `EventTarget` implementors — `window`, an `XMLHttpRequest`,
 * a worker — never fire `pointerdown`), so there is nothing left for an `instanceof Node`
 * branch to decide. `menuRoot` is cast for the same reason `focusEntry`'s docblock gives: it
 * names this component's own root, bound before `onMounted` registers this listener, so it is
 * never null while the listener can run. `props.anchor` is the one genuinely nullable member
 * of this function — see its own prop doc — and is EXCLUDED here rather than closed on:
 * pressing the button that opened this menu is its own gesture — the WAI-ARIA menu-button
 * pattern this file cites, where a second press of the button TOGGLES the menu
 * (`PlanEditorRoot.onOpenAdd` flips `addMenuOpen`) — not an outside press asking to close it.
 *
 * **The exclusion is what makes the toggle work at all, and the ORDER is why.** This listener
 * runs in the CAPTURE phase, ahead of the anchor's own `click` handler; without the exclusion,
 * a second press on the anchor would be read as an outside press HERE first and close the menu
 * — and then the click that follows would toggle `addMenuOpen` back open, one frame later. The
 * user would see the menu flicker rather than close, on every second press. Excluding the
 * anchor leaves that toggle entirely to the click handler that owns it.
 */
function onDocumentPointerDown(event: Event): void {
	const target = event.target as Node;
	if ((menuRoot.value as HTMLElement).contains(target)) return;
	if (props.anchor?.contains(target) === true) return;
	emit('close');
}

onMounted(() => {
	// The catalogue always has exactly one available entry — `creationCatalogue.test.ts` pins
	// it — so this is a fact about the DATA the whole feature depends on rather than a branch
	// two tests could disagree about.
	const first = CREATION_CATALOGUE.find((entry) => entry.availability.kind === 'available') as CreationEntry;
	focusEntry(first.id);
	document.addEventListener('pointerdown', onDocumentPointerDown, { capture: true });
});

onBeforeUnmount(() => {
	document.removeEventListener('pointerdown', onDocumentPointerDown, { capture: true });
	props.anchor?.focus();
});
</script>

<template>
	<div
		ref="menuRoot"
		class="rp-add-menu"
		@keydown.stop="onKeydown"
	>
		<input
			ref="searchInputEl"
			v-model="query"
			type="search"
			class="rp-add-menu__search"
			:aria-label="tr('editor.add.search')"
		>
		<div
			role="menu"
			:aria-label="tr('editor.add.menu')"
		>
			<div
				v-for="group in visibleGroups"
				:key="group"
				role="group"
				:aria-labelledby="groupHeadingIds[group]"
				class="rp-add-menu__group"
			>
				<!--
					`role="presentation"` on purpose: `menu`'s ARIA role admits only
					`menuitem`/`menuitemradio`/`menuitemcheckbox`/`group` as owned elements, and a
					plain `<h3>` (implicit role `heading`) failed `aria-required-children` for it
					("Element has children which are not allowed: h3") — measured by scanning the
					open menu, not assumed. Stripping the heading's own ARIA role removes it from
					that computation while the tag itself stays `<h3>` (headings still exist in the
					DOM for whatever reads tag names) and `aria-labelledby` still resolves it: accname
					computation reads a referenced element's text regardless of the role on it.
				-->
				<h3
					:id="groupHeadingIds[group]"
					role="presentation"
				>
					{{ tr(GROUP_LABEL_KEYS[group]) }}
				</h3>
				<button
					v-for="entry in entriesFor(group)"
					:key="entry.id"
					:ref="(el) => setItemEl(entry.id, el as Element | null)"
					type="button"
					role="menuitem"
					class="rp-add-menu__item"
					:class="{ 'rp-add-menu__item--unsupported': entry.availability.kind === 'unsupported' }"
					:data-rp-entry="entry.id"
					:tabindex="focusedId === entry.id ? 0 : -1"
					:aria-disabled="entry.availability.kind === 'unsupported'"
					:aria-describedby="reasonIdFor(entry)"
					@click="onItemClick(entry)"
					@focus="focusedId = entry.id"
				>
					<span class="rp-add-menu__item-label">{{ tr(entry.labelKey) }}</span>
					<span class="rp-add-menu__item-description">{{ tr(entry.descriptionKey) }}</span>
					<span
						v-if="entry.availability.kind === 'unsupported'"
						:id="reasonIds[entry.id]"
						class="rp-add-menu__reason"
					>{{ tr(entry.availability.reasonKey) }}</span>
				</button>
			</div>
		</div>
	</div>
</template>
