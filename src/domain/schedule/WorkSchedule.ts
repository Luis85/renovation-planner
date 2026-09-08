/** Explicit calendar dates; dependencies never manufacture dates or working-day assumptions. */
export interface WorkSchedule { readonly start?: string; readonly end?: string }
export function isCalendarDate(value: string): boolean {
 if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const date = new Date(value + 'T12:00:00Z');
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validWorkSchedule(schedule: WorkSchedule | undefined): boolean {
 if (schedule === undefined) return true;
 const { start, end } = schedule;
 if (start === undefined && end === undefined) return false;
 if (start !== undefined && !isCalendarDate(start)) return false;
 if (end !== undefined && !isCalendarDate(end)) return false;
 return start === undefined || end === undefined || start <= end;
}
