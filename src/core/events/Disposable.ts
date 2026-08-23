/**
 * The unsubscribe handle returned by `EventBus.subscribe`. Disposing stops delivery to
 * that subscriber only; sibling subscribers keep receiving events.
 */
export interface Disposable {
	dispose(): void;
}
