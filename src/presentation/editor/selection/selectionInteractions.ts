import type { EditorPointerEvent } from '../tools/editor-tool';

/** Optional group behavior; the owning facade retains command, version and geometry authority. */
export interface SelectionInteractions {
	readonly expandSelection?: (id: string, deep: boolean) => readonly string[];
	readonly selectionMove?: {
		readonly active: boolean;
		start(ids: readonly string[], event: EditorPointerEvent): boolean;
		move(event: EditorPointerEvent): void;
		finish(event: EditorPointerEvent): void;
		cancel(): void;
	};
}
