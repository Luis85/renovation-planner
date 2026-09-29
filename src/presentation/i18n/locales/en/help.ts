/**
 * The getting-started guide (owner rulings 47 and 49) and the command that opens it.
 *
 * **Every quoted control name is a `{hole}`**, filled at render time from that control's own
 * key by `src/plugin/help/GettingStartedModal.ts`, so a renamed button renames its mention here.
 * The quotation marks are the TEMPLATE's, never the filled value's, because they are the
 * locale's: “…” here, „…“ in German.
 *
 * **The sentence-case rule skips every string with a hole in it** (measured), so the steps are
 * held by `tests/plugin/help/gettingStarted.test.ts`, which resolves them and compares the whole
 * approved text instead. Edit one and that case is the check, not the linter.
 */
export const enHelp = {
	'command.open-help': 'Open getting-started help',
	'help.guide.title': 'Getting started',
	'help.guide.step-1': 'Run “{openProject}” from the command palette or its ribbon icon. Choose “{createProject}”, or “{newProject}” once one exists, and give it a name.',
	'help.guide.step-2': 'Open the project and choose “{createFirstPlan}”, or “{newPlan}” below the plan list. Select a plan in the list to open it in the plan editor.',
	'help.guide.step-3': 'On an empty plan, choose “{addRooms}”; later, choose “{add}” and then “{room}”. Drag on the floor to size the room or type its width and depth, name it, and choose “{createRoom}”.',
	'help.guide.step-4': 'To draw over an existing floor plan, first put its PNG, JPEG or PDF file in your vault. Choose “{upload}”, enter the file’s path in the vault, then set the scale so areas come out in real units.',
	'help.guide.step-5': 'Choose “{newAsset}” or “{library}” below the project list to build your catalogue. In the plan editor, choose “{add}” and then “{asset}” to place one on the plan.',
	'help.guide.step-6': 'To look around first, run “{sample}” from the command palette. It creates a fictional project with one plan and five rooms and areas, and opens that plan.',
	'help.guide.step-7': 'If something could not be read, run “{diagnostics}” from the command palette or open it from this plugin’s settings. It shows which notes refused to load in this session.',
	'help.guide.reopen': 'Open this guide again at any time with “{openHelp}” in the command palette.',
} as const;
