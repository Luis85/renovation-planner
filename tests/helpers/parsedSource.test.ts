import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { assignedTo, callsOf, constantsOf, descendants, evaluate, expressionsOf, functionNamed, importsOf, namesIdentifier, parseSource, stringsOf } from './parsedSource';

/**
 * The parsed readers `harness-shot.test.ts` pins with, driven against fixtures first. The shapes
 * that matter are the ones a text scan gets wrong: a comment that spells the call, the constant
 * or the import being asked for, and a string literal that does — neither is a node of the kind
 * asked for, and the readers must say so.
 */
const FIXTURE = `
// resolveShots(process.argv, SHOTS, process.env) is spelled here in prose
/* import { nope } from './nope.mjs'; */
import { page } from './page.mjs';
const VIEW = '.view';
const WIDTH = 460;
const RAIL = \`\${VIEW} .rail\`;
const SHOTS = [{ name: 'a', selector: VIEW, width: WIDTH }, { name: 'b', selector: [VIEW, RAIL] }];
const note = 'page.focus( in a string';
function open() {
	x.value = null;
	x.value = 1;
	if (params.has('index')) resolveShots(process.argv, SHOTS, process.env);
	page.keyboard.press('Tab');
}
`;
const script = parseSource('fixture.mjs', FIXTURE);
const root = script.file;

describe('the parsed readers', () => {
	it('evaluate top-level constants, through identifiers, templates and arrays', () => {
		const constants = constantsOf(script);

		expect(constants.get('VIEW')).toBe('.view');
		expect(constants.get('WIDTH')).toBe(460);
		expect(constants.get('RAIL')).toBe('.view .rail');
		const shots = descendants(root, ts.isVariableDeclaration).find((node) => ts.isIdentifier(node.name) && node.name.text === 'SHOTS');
		const [first, second] = descendants(shots?.initializer ?? root, ts.isObjectLiteralExpression);
		const fieldsOf = (shot: ts.ObjectLiteralExpression): Record<string, unknown> =>
			Object.fromEntries(shot.properties.filter(ts.isPropertyAssignment).map((property) => [property.name.getText(script.file), evaluate(property.initializer, constants)]));

		expect(fieldsOf(first)).toEqual({ name: 'a', selector: '.view', width: 460 });
		expect(fieldsOf(second)).toEqual({ name: 'b', selector: ['.view', '.view .rail'] });
	});

	it('answer null for an expression that is not a literal, rather than a spelling', () => {
		const [call] = descendants(root, ts.isCallExpression);

		expect(evaluate(call, constantsOf(script))).toBeNull();
		expect(constantsOf(parseSource('x.ts', 'const a = f();\nconst b = a;')).size).toBe(0);
	});

	it('find a call by its full callee or by a bare property name, with its arguments, and never in a comment', () => {
		expect(callsOf(root, script, 'resolveShots').map((call) => call.args)).toEqual([['process.argv', 'SHOTS', 'process.env']]);
		expect(callsOf(root, script, 'page.keyboard.press').map((call) => call.args)).toEqual([["'Tab'"]]);
		expect(callsOf(root, script, 'has').map((call) => call.callee)).toEqual(['params.has']);
		expect(callsOf(root, script, 'page.focus')).toEqual([]);
	});

	it('order calls by where they start', () => {
		const [first] = callsOf(root, script, 'resolveShots');
		const [second] = callsOf(root, script, 'page.keyboard.press');

		expect(first.at).toBeLessThan(second.at);
	});

	it('read imports from declarations and not from a comment', () => {
		expect(importsOf(script)).toEqual(['./page.mjs']);
	});

	it('read strings from literals and templates, and identifiers from code, never from a comment', () => {
		expect(stringsOf(root)).toContain('page.focus( in a string');
		expect(stringsOf(root)).toContain(' .rail');
		expect(stringsOf(root).some((text) => text.includes('nope'))).toBe(false);
		expect(namesIdentifier(root, 'resolveShots')).toBe(true);
		expect(namesIdentifier(root, 'nope')).toBe(false);
		expect(namesIdentifier(root, 'focus')).toBe(false);
	});

	it('find a named function, what it assigns, and what it spells', () => {
		const open = functionNamed(script, 'open');

		expect(open).toBeDefined();
		expect(functionNamed(script, 'close')).toBeUndefined();
		expect(assignedTo(open ?? root, script, 'x.value')).toEqual(['null', '1']);
		expect(expressionsOf(open ?? root, script)).toContain("params.has('index')");
	});
});
