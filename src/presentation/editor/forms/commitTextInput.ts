/** Keep native text and draft state consistent when a dialog control refuses an edit. */
export function commitTextInput(event: Event, previous: string, refuse: (control: HTMLInputElement, previous: string) => boolean, commit: (value: string) => void): void {
 const control = event.target as HTMLInputElement;
 if (!refuse(control, previous)) commit(control.value);
}
