import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { parse as parseSfc } from '@vue/compiler-sfc';

/**
 * Parsed reads over a script this suite cannot import — `scripts/harness-shot.mjs` captures at
 * module scope behind a browser, `tests/harness/page.ts` mounts the moment it loads — so what a
 * pin has to say about their WIRING is asked of the TypeScript parser's tree rather than of the
 * text: a call and its arguments, a top-level constant and its evaluated value, an object
 * literal's fields, the identifiers a file names, the module specifiers it imports. A comment
 * spelling any of those is not a node, and a re-ordered property or a re-wrapped line is the same
 * node, which is the whole difference from the `toMatch(/…/)` pins these replaced
 * (`tests/build/harness-shot.test.ts`'s header carries the history). An SFC contributes its
 * `<script>` and `<script setup>` blocks through `@vue/compiler-sfc`, the way
 * `importGraph.ts` reads one.
 *
 * `parsedSource.test.ts` drives every reader here against fixtures before any pin trusts it —
 * including a comment and a string that spell what the reader is asked for, since an instrument
 * that counts prose is the failure these exist to close.
 */
export interface ParsedScript {
	readonly file: ts.SourceFile;
}

/** A value a pin can compare: a string, a number, or a list of those. */
export type Literal = string | number | readonly Literal[];

export function parseSource(name: string, text: string): ParsedScript {
	const kind = name.endsWith('.mjs') || name.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS;
	return { file: ts.createSourceFile(name, text, ts.ScriptTarget.Latest, false, kind) };
}

export function parseScript(path: string): ParsedScript {
	const source = readFileSync(path, 'utf8');
	if (!path.endsWith('.vue')) return parseSource(path, source);
	const { descriptor } = parseSfc(source, { filename: path });
	return parseSource(`${path}.ts`, [descriptor.script, descriptor.scriptSetup].map((block) => block?.content ?? '').join('\n'));
}

/** Every node under `root` the guard admits, in document order. */
export function descendants<T extends ts.Node>(root: ts.Node, admits: (node: ts.Node) => node is T): T[] {
	const found: T[] = [];
	const visit = (node: ts.Node): void => {
		if (admits(node)) found.push(node);
		ts.forEachChild(node, visit);
	};
	visit(root);
	return found;
}

/**
 * A literal expression's value: a string or number literal, a template whose substitutions are
 * themselves evaluable, an array of those, or an identifier naming one of `constants`. `null` for
 * anything else, so a pin over a value that is not a literal fails on absence rather than on a
 * stale spelling.
 */
export function evaluate(node: ts.Expression, constants: ReadonlyMap<string, Literal>): Literal | null {
	if (ts.isStringLiteralLike(node)) return node.text;
	if (ts.isNumericLiteral(node)) return Number(node.text);
	if (ts.isIdentifier(node)) return constants.get(node.text) ?? null;
	if (ts.isTemplateExpression(node)) {
		let text = node.head.text;
		for (const span of node.templateSpans) {
			const part = evaluate(span.expression, constants);
			if (part === null) return null;
			text += `${String(part)}${span.literal.text}`;
		}
		return text;
	}
	if (ts.isArrayLiteralExpression(node)) {
		const items = node.elements.map((element) => evaluate(element, constants));
		return items.every((item): item is Literal => item !== null) ? items : null;
	}
	return null;
}

/** Top-level `const NAME = …` bindings whose initializer evaluates, in declaration order so a later one may name an earlier one. */
export function constantsOf(script: ParsedScript): ReadonlyMap<string, Literal> {
	const constants = new Map<string, Literal>();
	for (const statement of script.file.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations) {
			const value = declaration.initializer === undefined ? null : evaluate(declaration.initializer, constants);
			if (ts.isIdentifier(declaration.name) && value !== null) constants.set(declaration.name.text, value);
		}
	}
	return constants;
}

/** A call, as its callee's and arguments' source text plus where it starts. */
export interface Call {
	readonly callee: string;
	readonly args: readonly string[];
	readonly at: number;
}

/**
 * Every call whose callee prints as `callee` (`page.screenshot`, `resolveShots`) — or, for a
 * bare name, whose callee is a property of that name on anything (`has` finds `params.has(…)`).
 */
export function callsOf(root: ts.Node, script: ParsedScript, callee: string): Call[] {
	return descendants(root, ts.isCallExpression)
		.filter((call) => {
			const text = call.expression.getText(script.file);
			return text === callee || (ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === callee);
		})
		.map((call) => ({
			callee: call.expression.getText(script.file),
			args: call.arguments.map((argument) => argument.getText(script.file)),
			at: call.getStart(script.file),
		}));
}

/** The module specifiers the script imports from or re-exports from. */
export function importsOf(script: ParsedScript): string[] {
	return descendants(script.file, (node): node is ts.ImportDeclaration | ts.ExportDeclaration => ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
		.map((node) => node.moduleSpecifier)
		.filter((specifier): specifier is ts.StringLiteral => specifier !== undefined && ts.isStringLiteral(specifier))
		.map((specifier) => specifier.text);
}

/** The text of every string literal and template chunk under `root` — code, never a comment. */
export function stringsOf(root: ts.Node): string[] {
	return descendants(root, (node): node is ts.LiteralLikeNode => ts.isStringLiteralLike(node) || ts.isTemplateMiddleOrTemplateTail(node) || ts.isTemplateHead(node))
		.map((node) => node.text);
}

/** Whether `name` is an identifier anywhere under `root` — a binding, a call, or a property name. */
export const namesIdentifier = (root: ts.Node, name: string): boolean =>
	descendants(root, ts.isIdentifier).some((identifier) => identifier.text === name);

/** The function declared as `name`, or `undefined`. */
export const functionNamed = (script: ParsedScript, name: string): ts.FunctionDeclaration | undefined =>
	descendants(script.file, ts.isFunctionDeclaration).find((declaration) => declaration.name?.text === name);

/** The `=` assignments under `root` whose left side prints as `target`, as their right sides' text. */
export const assignedTo = (root: ts.Node, script: ParsedScript, target: string): string[] =>
	descendants(root, ts.isBinaryExpression)
		.filter((node) => node.operatorToken.kind === ts.SyntaxKind.EqualsToken && node.left.getText(script.file) === target)
		.map((node) => node.right.getText(script.file));

/** The source text of every expression under `root`, for a pin that asks whether one is spelled at all. */
export const expressionsOf = (root: ts.Node, script: ParsedScript): string[] =>
	descendants(root, ts.isExpression).map((node) => node.getText(script.file));
