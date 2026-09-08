import { inject, provide, type InjectionKey } from 'vue';
import type { StringKey } from '../../i18n/locales/en';

export interface CanvasGroupAction {
	readonly id: 'group' | 'ungroup' | 'enclose' | 'inspect' | 'select-group';
	readonly label: StringKey;
	readonly disabled?: boolean;
	run(): void | Promise<void>;
}
export interface CanvasGroupActionsProvider {
	actions(ids: readonly string[]): readonly CanvasGroupAction[];
	expandSelection?(id: string, deep: boolean): readonly string[];
}
const KEY: InjectionKey<CanvasGroupActionsProvider> = Symbol('canvas-group-actions');
export function provideCanvasGroupActions(provider: CanvasGroupActionsProvider): void { provide(KEY, provider); }
export function useCanvasGroupActions(): CanvasGroupActionsProvider { return inject(KEY, { actions: () => [] }); }
