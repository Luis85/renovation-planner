import type { EditorTool } from './editor-tool';

/** The existing surface camera owns pointer capture and pan state; this names its explicit mode. */
export class PanTool implements EditorTool {
	readonly id = 'pan';
	activate(): void { /* Camera movement is presentation state, never a command. */ }
	deactivate(): void { /* The surface retires its captured pointer independently. */ }
	pointerDown(): void { /* Routed to the surface camera. */ }
	pointerMove(): void { /* Routed to the surface camera. */ }
	pointerUp(): void { /* Routed to the surface camera. */ }
	cancel(): void { /* Panning does not accumulate a domain draft. */ }
	abandonGesture(): void { /* The surface handles camera interruptions. */ }
	hasDraft(): boolean { return false; }
}
