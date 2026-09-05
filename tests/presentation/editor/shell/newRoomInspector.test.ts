// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { t } from '../../../../src/presentation/i18n/strings';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { mountPlanEditor, mountPlanEditorCanvas, runtimeOf, settle, settleUntil as until } from '../../../helpers/editor';
import { resizeTo } from '../../../helpers/layout';
import { PLAN_DTO, pointer, rig } from '../../../helpers/planEditorRig';
import { expectOk } from '../../../helpers/domain';

/**
 * Task 7's `NewRoomInspector.vue` and the frame arm that routes to it (design spec §2.3,
 * §5.1): while `activeToolId === 'draw-room'` the Inspector shows the New room FORM rather
 * than the floor or room body, whatever is selected. Driven through the REAL mounted Plan
 * Editor, so the form's reads and writes are against the same `roomDraft` store the canvas
 * drag writes — which is the property the whole increment rests on ("dragging and typing
 * converge on the same creation command"), and one no standalone mount of this component
 * could show.
 *
 * Each case mounts its own editor and the four cases added past the brief's six unmount
 * theirs, following `roomCreationWiring.test.ts` rather than a file-level `afterEach`: the
 * six declare their harness as a local `const harness`, which an outer binding of that name
 * would shadow.
 */
describe('NewRoomInspector', () => {
	it('replaces the floor and room bodies while the room tool is active, even with a selection', async () => {
		const harness = await mountPlanEditorCanvas();
		useSelectionStore(harness.pinia).select(['zone-a' as never]);
		runtimeOf(harness).setTool('draw-room');
		await settle();
		expect(harness.wrapper.find('.rp-new-room').exists()).toBe(true);
		expect(harness.wrapper.find('.rp-room-inspector').exists()).toBe(false);
	});

	it('a suggestion sets the name; Create is aria-disabled until the draft is valid, with the reason described', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		const create = harness.wrapper.find('button.rp-new-room__create');
		expect(create.attributes('aria-disabled')).toBe('true');
		const hintId = create.attributes('aria-describedby');
		expect(harness.wrapper.find(`#${hintId}`).text()).toBe(t('en', 'editor.task.finish.blocked'));
		// `!.trigger(...)` as the brief spells it is `@typescript-eslint/no-non-null-assertion`,
		// which this repository has as an error; a throw says the same thing and says it louder.
		const kitchen = harness.wrapper.findAll('button.rp-new-room__suggestion').find((b) => b.text() === 'Kitchen');
		if (kitchen === undefined) throw new Error('no Kitchen suggestion button');
		await kitchen.trigger('click');
		expect(runtime.roomDraft.name).toBe('Kitchen');
		runtime.roomDraft.setRect({ x: 0, y: 0, width: 4200, depth: 3800 });
		await settle();
		expect(create.attributes('aria-disabled')).toBe('false');
		expect(harness.wrapper.find('.rp-new-room__area').text()).toContain('15.96 m²');
	});

	it('a refused width shows inline, keeps the text, and clears on correction', async () => {
		const harness = await mountPlanEditorCanvas();
		runtimeOf(harness).setTool('draw-room');
		await settle();
		const width = harness.wrapper.find('input[name="width"]');
		await width.setValue('abc');
		await width.trigger('blur');
		expect(width.attributes('aria-invalid')).toBe('true');
		expect(harness.wrapper.find('.rp-field-error__message').text()).toContain(t('en', 'editor.room.error.not-a-number'));
		expect((width.element as HTMLInputElement).value).toBe('abc');
		await width.setValue('4.2');
		await width.trigger('keydown', { key: 'Enter' });
		expect(width.attributes('aria-invalid')).toBeUndefined();
	});

	it('typing both lengths with no pointer places a rectangle centred on the stage', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		await harness.wrapper.find('input[name="width"]').setValue('4.2');
		await harness.wrapper.find('input[name="width"]').trigger('blur');
		await harness.wrapper.find('input[name="depth"]').setValue('3.8');
		await harness.wrapper.find('input[name="depth"]').trigger('blur');
		const rect = runtime.roomDraft.rect;
		expect(rect?.width).toBe(4200);
		expect(rect?.depth).toBe(3800);
		// 800×600 stage at the default camera: centre (400,300) → world (3520, 2520) (see planEditorRig's geometry note)
		expect(rect?.x).toBe(3520 - 2100);
		expect(rect?.y).toBe(2520 - 1900);
	});

	/**
	 * **The moves are FLUSHED one at a time, and that is the whole of what makes this case an
	 * instrument.** The brief spells the loop as twenty synchronous `pointer(...)` calls
	 * followed by one `settle()` — which Vue batches into a SINGLE render, so the observer
	 * sees one mutation whatever the store did in between. Measured rather than argued: with
	 * `settle()` called inside `DrawRoomTool.pointerMove` — the exact defect §5.4 forbids —
	 * that spelling still passed, `seen.length` reading 1. A real device delivers each move in
	 * its own task, so a drag that flushes per move is the grammar the browser actually sends
	 * (this repository's own "a simulated pointer stream has to obey the real device's
	 * grammar" rule), and it is the only spelling under which the mutation goes red.
	 */
	it('the settled-size status changes once per drag, not once per move', async () => {
		const harness = await mountPlanEditorCanvas();
		runtimeOf(harness).setTool('draw-room');
		await settle();
		const status = harness.wrapper.find('.rp-new-room__settled');
		const seen: string[] = [];
		const observer = new MutationObserver(() => seen.push(status.text()));
		observer.observe(status.element, { childList: true, characterData: true, subtree: true });
		const canvas = harness.canvasEl;
		pointer(canvas, 'pointerdown', 100, 100);
		for (let i = 1; i <= 20; i += 1) {
			pointer(canvas, 'pointermove', 100 + i * 10, 100 + i * 5);
			await settle();
		}
		pointer(canvas, 'pointerup', 300, 200);
		await settle();
		observer.disconnect();
		expect(seen.length).toBe(1);
		expect(status.text()).toContain(' m by ');
	});

	it('Create through the form: the room is created, and focus does not fall to body', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		runtime.roomDraft.setRect({ x: 0, y: 0, width: 4200, depth: 3800 });
		runtime.roomDraft.setName('Kitchen');
		await settle();
		const create = harness.wrapper.find('button.rp-new-room__create');
		(create.element as HTMLButtonElement).focus();
		await create.trigger('click');
		await until(async () => expectOk(await zonesRepo.listByPlan(PLAN_DTO.id as never)).loaded.length === 2, 'the room to be written');
		await settle();
		expect(runtime.activeToolId.value).toBe('select');
		expect(document.activeElement).not.toBe(document.body);
		expect(harness.wrapper.find('.rp-editor-inspector').element.contains(document.activeElement)).toBe(true);
	});

	/**
	 * Both fields take BOTH commit gestures, and the brief's cases only ever drive three of
	 * the four — width by blur and by Enter, depth by blur. Its own arm was uncovered, which
	 * for an inline template handler means "this control has no way to be pressed that any
	 * gate watches".
	 */
	it('Enter commits the depth field, the same gesture the width field takes', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		expect(runtime.roomDraft.depthMm).toBeNull();
		const depth = harness.wrapper.find('input[name="depth"]');
		await depth.setValue('3.8');
		await depth.trigger('keydown', { key: 'Enter' });
		expect(runtime.roomDraft.depthMm).toBe(3800);
		expect(runtime.roomDraft.depthError).toBeNull();
		harness.unmount();
	});

	/**
	 * An `aria-describedby` naming an id no element carries is the ARIA defect axe reports as
	 * `aria-valid-attr-value`, and the hint it names is rendered only while the draft is
	 * blocked. Both states are asserted here rather than only the blocked one, because the
	 * dangling half is the half that reads as correct in every screenshot.
	 */
	it('the Create button describes a real element while blocked, and nothing at all once valid', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		const create = harness.wrapper.find('button.rp-new-room__create');
		const hintId = create.attributes('aria-describedby');
		expect(harness.wrapper.find(`#${hintId}`).exists()).toBe(true);
		runtime.roomDraft.setRect({ x: 0, y: 0, width: 4200, depth: 3800 });
		await settle();
		expect(create.attributes('aria-disabled')).toBe('false');
		expect(create.attributes('aria-describedby')).toBeUndefined();
		expect(harness.wrapper.find('.rp-new-room__hint').exists()).toBe(false);
		harness.unmount();
	});

	/**
	 * **"Pressing Create right now would run" and "the draft is incomplete" are two questions,
	 * and one value answered both.** `canCreateRoom` is `draft.valid`, whose last conjunct is
	 * `!submitting` — set synchronously before `createRoomFromDraft`'s one `await` — so for the
	 * whole of a vault write the form told the renovator "Size the room and give it a name
	 * first" about a 4.2 × 3.8 room called Kitchen that was at that moment being written, and
	 * pointed the button's `aria-describedby` at that sentence.
	 *
	 * The button stays disabled, which is right (a second press answers `'busy'`); what goes
	 * is the false reason. `submitting` is set directly rather than by holding a dispatcher
	 * open, because the state under test is exactly "valid draft, write in flight" and that is
	 * the store field which represents it.
	 */
	it('while a Create is in flight the button is disabled and states no false reason', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		runtime.roomDraft.setName('Kitchen');
		runtime.roomDraft.setRect({ x: 0, y: 0, width: 4200, depth: 3800 });
		runtime.roomDraft.setSubmitting(true);
		await settle();
		const create = harness.wrapper.find('button.rp-new-room__create');
		expect(create.attributes('aria-disabled')).toBe('true');
		expect(harness.wrapper.find('.rp-new-room__hint').exists()).toBe(false);
		expect(create.attributes('aria-describedby')).toBeUndefined();
		harness.unmount();
	});

	/**
	 * **A blur is not a gesture, and this form hand-wires `@blur` with no cleanliness guard.**
	 * `beginTask` leaves both texts `''`, so clicking into Width and tabbing through to Create
	 * ran `commitDimension(axis, '')` twice: `parseMetres('')` is `not-a-number`, and both
	 * fields rendered `aria-invalid` with "Enter a length in metres" about input nobody made.
	 * `useFieldCommit.commitOnce` exists in this repository for exactly this reason and returns
	 * early on a CLEAN field; this form re-established no such guard.
	 *
	 * Both directions, because the fix must not make an empty field silently acceptable: an
	 * UNTOUCHED empty field is clean and an EMPTIED one is dirty, and only the second is
	 * refused.
	 */
	it('tabbing through an untouched field says nothing about input nobody made', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		const width = harness.wrapper.find('input[name="width"]');
		const depth = harness.wrapper.find('input[name="depth"]');
		await width.trigger('blur');
		await depth.trigger('blur');
		expect(width.attributes('aria-invalid')).toBeUndefined();
		expect(depth.attributes('aria-invalid')).toBeUndefined();
		expect(harness.wrapper.find('.rp-field-error__message').exists()).toBe(false);
		expect(runtime.roomDraft.widthText).toBe('');
		harness.unmount();
	});

	it('emptying a field that held a length is still refused when it is left', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		const width = harness.wrapper.find('input[name="width"]');
		await width.setValue('4.2');
		await width.trigger('blur');
		expect(runtime.roomDraft.widthMm).toBe(4200);
		await width.setValue('');
		await width.trigger('blur');
		expect(width.attributes('aria-invalid')).toBe('true');
		expect(runtime.roomDraft.widthError).toBe('not-a-number');
		harness.unmount();
	});

	/**
	 * The blur guard is at the CONTROL and not in the store, so the other door has to keep
	 * committing: which gesture counts as explicit is a fact about the input, and the store is
	 * deliberately gesture-agnostic (§2.2 names two SURFACES, not two keystrokes). Enter on an
	 * untouched empty field is a renovator asking, and it is answered.
	 */
	it('Enter on an untouched empty field still commits, because Enter is an explicit gesture', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		const width = harness.wrapper.find('input[name="width"]');
		await width.trigger('keydown', { key: 'Enter' });
		expect(runtime.roomDraft.widthError).toBe('not-a-number');
		harness.unmount();
	});

	it('typing in the name field writes the draft name', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		await harness.wrapper.find('input.rp-new-room__name').setValue('Utility room');
		expect(runtime.roomDraft.name).toBe('Utility room');
		harness.unmount();
	});

	it('Keep adding rooms writes through to the draft', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		expect(runtime.roomDraft.keepAdding).toBe(false);
		await harness.wrapper.find('.rp-new-room__keep input').setValue(true);
		expect(runtime.roomDraft.keepAdding).toBe(true);
		harness.unmount();
	});

	it("Cancel is the form's own door to the same action the banner's Cancel takes", async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		await harness.wrapper.find('button.rp-new-room__cancel').trigger('click');
		await settle();
		expect(runtime.activeToolId.value).toBe('select');
		expect(harness.wrapper.find('.rp-new-room').exists()).toBe(false);
		harness.unmount();
	});

	/**
	 * The `aria-disabled` promise is kept at the CONTROL and not only at the action:
	 * `onCreate` asks `canCreateRoom` and dispatches NOTHING when it answers false.
	 *
	 * **The non-invocation is what this asserts, and the outcome alone would not have.**
	 * `createRoomFromDraft` independently answers `'invalid'` for this same draft, so "no zone
	 * was written" and "the tool stayed" are both true of a build with the guard deleted —
	 * the earlier draft of this case checked exactly those two and discriminated nothing.
	 * Spying on `runtime.createRoom` is what tells the two builds apart: the runtime is a
	 * plain per-leaf object and `onCreate` looks the member up at call time, so a spy
	 * installed after mount is on the door the component actually takes. Mutation-checked by
	 * deleting the guard line and watching this go red at `not.toHaveBeenCalled()`.
	 *
	 * The outcome assertions stay beside it: a control announced as disabled that still writes
	 * is the defect, and a spy alone would not say the vault was left alone.
	 */
	it('pressing Create while the draft is incomplete writes nothing', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		runtime.roomDraft.setName('Kitchen'); // named, and never sized
		await settle();
		const create = harness.wrapper.find('button.rp-new-room__create');
		expect(create.attributes('aria-disabled')).toBe('true');
		const createRoom = vi.spyOn(runtime, 'createRoom');
		await create.trigger('click');
		await settle();
		expect(createRoom).not.toHaveBeenCalled();
		expect(expectOk(await zonesRepo.listByPlan(PLAN_DTO.id as never)).loaded).toHaveLength(1);
		expect(runtime.activeToolId.value).toBe('draw-room');
		harness.unmount();
	});
});


/**
 * **A control removed from the document fires no `blur`** (measured: `document.activeElement`
 * falls to `<body>` with no event at all), so the form's commit-on-blur contract owes its
 * fields one last read on the way out — `NewRoomInspector.onBeforeUnmount`.
 *
 * Driven through the REAL constrained shell rather than by unmounting the component directly,
 * because the thing that decides these three outcomes is not in this component: it is whether
 * `ResponsiveEditorShell` moves focus BEFORE or AFTER Vue patches the drawer away, and a
 * fixture that called `unmount()` itself would model one of those two orders by accident and
 * certify whichever it happened to pick.
 */
/**
 * Opens the drawer on a constrained pane with the room tool live, types into Width and
 * leaves it focused and UNBLURRED — the state every case here is about.
 */
async function typingIntoWidth(): Promise<{ harness: Awaited<ReturnType<typeof mountPlanEditor>>; runtime: ReturnType<typeof runtimeOf> }> {
	const harness = await mountPlanEditor();
	const runtime = runtimeOf(harness);
	resizeTo(harness.rootEl, 460, 800);
	await settle();
	runtime.setTool('draw-room');
	await settle();
	await harness.wrapper.find('button[data-rp-rail="details"]').trigger('click');
	await settle();
	const width = harness.wrapper.find('input[name="width"]');
	(width.element as HTMLInputElement).focus();
	await width.setValue('4.2');
	expect(runtime.roomDraft.widthText).toBe(''); // nothing committed yet: no blur, no Enter
	return { harness, runtime };
}

describe('NewRoomInspector, unmounted with a field still being typed into', () => {
	/**
	 * The reported defect. `measure` must defer its focus move to `nextTick` — the persistent
	 * region it targets does not exist until the `full` branch renders — so by the time focus
	 * lands the input is already gone and no blur ever fired. Watched red before the fix, at
	 * this assertion, reading `''`.
	 */
	it('keeps the typed width when a growth back to the full layout unmounts the drawer', async () => {
		const { harness, runtime } = await typingIntoWidth();
		resizeTo(harness.rootEl, 1280, 800);
		await settle();
		expect(harness.wrapper.find('.rp-inspector-drawer').exists()).toBe(false);
		expect(runtime.roomDraft.widthText).toBe('4.2');
		expect(runtime.roomDraft.widthMm).toBe(4200);
		harness.unmount();
	});

	/**
	 * The other unmount route, which was already safe and is asserted so it stays that way:
	 * `closeOverlay` focuses the rail button SYNCHRONOUSLY, so the input is still in the
	 * document and fires a real blur. The unmount commit's dirty guard is what keeps this from
	 * being written twice — `commitDimension` stores the raw text, so the second read finds it
	 * unchanged and returns.
	 */
	it('keeps the typed width when Escape on the drawer unmounts it', async () => {
		const { harness, runtime } = await typingIntoWidth();
		harness.wrapper.find('input[name="width"]').element
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await settle();
		expect(harness.wrapper.find('.rp-inspector-drawer').exists()).toBe(false);
		expect(runtime.roomDraft.widthText).toBe('4.2');
		harness.unmount();
	});

	/**
	 * The guard, and the reason it is `activeToolId` rather than an unconditional commit: Cancel
	 * ends the task by leaving the tool, and the tool's `deactivate` resets the draft BEFORE
	 * this form unmounts — so the abandoned `4.2` is still sitting in the DOM input when the
	 * hook runs, with a draft that has just been cleared to receive the NEXT room. Committing it
	 * there resurrects a dimension nobody typed into a fresh task.
	 *
	 * Mutation-checked by deleting the `activeToolId` guard and watching this go red at `''`.
	 */
	it('does not resurrect the abandoned text into the draft Cancel has just reset', async () => {
		const { harness, runtime } = await typingIntoWidth();
		await harness.wrapper.find('button.rp-new-room__cancel').trigger('click');
		await settle();
		expect(runtime.activeToolId.value).toBe('select');
		expect(runtime.roomDraft.widthText).toBe('');
		expect(runtime.roomDraft.widthMm).toBeNull();
		harness.unmount();
	});
});
