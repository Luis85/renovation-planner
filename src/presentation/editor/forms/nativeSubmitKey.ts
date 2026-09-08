/** Keep composed, repeated and chorded Enter within native editing. */
export function nativeSubmitKey(event: KeyboardEvent): void {
	if (event.key === 'Enter' && (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)) event.preventDefault();
}
