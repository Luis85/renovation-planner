/** Keep native controls focusable while refusing actions marked unavailable. */
export function refuseInoperativeEvent(event: Event): boolean {
	if ((event.currentTarget as HTMLElement).getAttribute('aria-disabled') !== 'true') return false;
	event.preventDefault(); event.stopImmediatePropagation(); return true;
}

/** Capture before v-model consumes a native change, restoring the displayed model value. */
export function restoreInoperativeChoice(event: Event, rendered: string | boolean | readonly string[]): void {
	if (!refuseInoperativeEvent(event)) return;
	const control = event.currentTarget as HTMLInputElement | HTMLSelectElement;
	if (typeof rendered === 'string') control.value = rendered;
	else (control as HTMLInputElement).checked = typeof rendered === 'boolean' ? rendered : rendered.includes(control.value);
}
