/**
 * Declarations for the deliberately plain-JS module beside this file — the boundary is
 * typed once here instead of a pasted, `any`-producing `@ts-expect-error` per consumer.
 */
export declare function headings(text: string): { text: string; index: number }[];
export declare function changelogNotes(changelog: string, version: string): string;
