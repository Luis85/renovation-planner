import type { EditorTool } from '../tools/editor-tool';

/** Native dimension entry owns a temporary task; canvas clicks cannot change its subject. */
export class RoomDimensionTool implements EditorTool {
	readonly id = 'edit-room-dimension' as const;
	constructor(private readonly actions: { busy(): boolean; stop(): void; cancel(): void }) {}
	activate(): void { /* The labelled dimension starts its versioned read after tool activation. */ }
	deactivate(): void { this.actions.stop(); }
	canDeactivate(): boolean { return !this.actions.busy(); }
	pointerDown(): void { /* Native input owns this edit; pointer selection cannot discard its text. */ }
	pointerMove(): void { /* The surface still owns temporary pan and zoom. */ }
	pointerUp(): void { /* No pointer gesture is accumulated. */ }
	abandonGesture(): void { /* Native text survives focus and viewport interruptions. */ }
	cancel(): void { this.actions.cancel(); }
	hasDraft(): boolean { return true; }
}
