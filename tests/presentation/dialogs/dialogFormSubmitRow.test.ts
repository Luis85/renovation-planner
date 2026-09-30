/**
 * Every dialog form ends with `FormSubmitRow` (open-issues round, Task 3).
 *
 * `FormDialog`'s body scrolls and its Cancel stays below it. A form that draws its OWN submit draws
 * it inside that scroller, so on a long form Save scrolled away while Cancel stayed, and even on a
 * short one it drew a second row of footer chrome apart from Cancel. `FormSubmitRow` is the one row
 * that fixes both (Cancel then the submit, pinned at the body's foot), and this holds every form to
 * it, including one written tomorrow: the check is at the markup a dialog form is made of, not a
 * list of the forms that exist today.
 *
 * A dialog form is a `<form>` whose static class names `rp-dialog-form`, the class every form
 * `FormDialog` hosts wears and the one `styles/dialogs.css` lays out. Read through
 * `@vue/compiler-sfc`'s template AST, so a comment or a string spelling either tag is not a hit.
 *
 * **What it does NOT see**: a dialog form that does not wear `rp-dialog-form`; a submit drawn by a
 * CHILD component of the form rather than in the form's own template; and a `type` bound
 * dynamically (`:type="…"`). `AssetDimensionsDialog.vue` is exempt by name: it is its own dialog
 * kind, not a component `FormDialog` hosts, and draws its own Cancel-then-Save row.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '@vue/compiler-sfc';

/** The template AST's types, derived from what `parse` returns rather than named from compiler-core. */
type Root = NonNullable<NonNullable<ReturnType<typeof parse>['descriptor']['template']>['ast']>;
type Child = Root['children'][number];
type Element = Extract<Child, { tag: string }>;

/** compiler-core's `NodeTypes.ELEMENT` and `.ATTRIBUTE`: a `const enum`, erased at runtime. */
const ELEMENT = 1;
const ATTRIBUTE = 6;

const OWN_KIND = new Set(['src/presentation/dialogs/AssetDimensionsDialog.vue']);

const elements = (nodes: readonly Child[]): Element[] =>
	nodes.flatMap((node) => (node.type === ELEMENT && 'tag' in node ? [node, ...elements(node.children)] : []));

const attribute = (node: Element, name: string): string | undefined => {
	for (const prop of node.props) if (prop.type === ATTRIBUTE && prop.name === name && 'value' in prop) return prop.value?.content;
	return undefined;
};

/** Each dialog form in one SFC's template, as what it draws for a submit. */
function dialogForms(source: string): { ownSubmits: number; rows: number }[] {
	const ast = parse(source).descriptor.template?.ast;
	if (!ast) return [];
	return elements(ast.children)
		.filter((node) => node.tag === 'form' && (attribute(node, 'class') ?? '').split(' ').includes('rp-dialog-form'))
		.map((form) => {
			const inside = elements(form.children);
			return {
				ownSubmits: inside.filter((node) => node.tag === 'button' && attribute(node, 'type') === 'submit').length,
				rows: inside.filter((node) => node.tag === 'FormSubmitRow').length,
			};
		});
}

describe('the dialog-form reader', () => {
	it('finds a dialog form’s own submit and its FormSubmitRow, and ignores a form that is not a dialog form', () => {
		const own = '<template><form class="rp-dialog-form x"><div><button type="submit">Save</button></div></form></template>';
		const row = '<template><form class="rp-dialog-form"><!-- <button type="submit"> --><FormSubmitRow :submitting="false" /></form></template>';
		const other = '<template><form class="rp-structure-task"><button type="submit">Add</button></form></template>';

		expect(dialogForms(own)).toEqual([{ ownSubmits: 1, rows: 0 }]);
		expect(dialogForms(row)).toEqual([{ ownSubmits: 0, rows: 1 }]);
		expect(dialogForms(other)).toEqual([]);
	});
});

describe('every dialog form in src/', () => {
	const files = readdirSync('src', { recursive: true, encoding: 'utf8' })
		.filter((file) => file.endsWith('.vue'))
		.map((file) => `src/${file.split(sep).join('/')}`)
		.filter((file) => !OWN_KIND.has(file));
	const found = files.flatMap((file) => dialogForms(readFileSync(file, 'utf8')).map((form) => ({ file, ...form })));

	it('reaches the dialog forms at all', () => {
		// An instrument that reaches nothing reads exactly like a clean tree.
		expect(found.length).toBeGreaterThan(20);
	});

	it('ends each with one FormSubmitRow and draws no submit of its own', () => {
		expect(found.filter((form) => form.ownSubmits !== 0 || form.rows !== 1)).toEqual([]);
	});
});
