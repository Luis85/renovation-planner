import { expect } from 'vitest';
import type { DesignerPage } from './designer';
import { createCanvasPage } from './designerCanvas';
import type { NativeBrowser } from './session';

interface Rect { x: number; y: number; width: number; height: number }
/** What a held drag shows before its release writes anything. */
interface MidDrag { legend: string[]; revision: number }
export interface Camera { x: number; y: number; scale: number; centre: { x: number; y: number } }

/** What `thumbnailColours` reads: computed colour strings, before any arithmetic. */
export interface DrawnColours { stroke: string; opacity: number; backgrounds: string[] }

/** A computed `rgb()`/`rgba()` as `[r, g, b, a]`; any other notation throws rather than being guessed at. */
function rgba(colour: string): number[] {
	if (!colour.startsWith('rgb')) throw new Error(`Unread colour ${colour}.`);
	const [r = 0, g = 0, b = 0, a = 1] = colour.slice(colour.indexOf('(') + 1, -1).split(',').map(Number);
	return [r, g, b, a];
}

/** `top` at its alpha over an opaque `under`. */
const over = (top: number[], under: number[]): number[] => [0, 1, 2].map((i) => (top[i] ?? 0) * (top[3] ?? 1) + (under[i] ?? 0) * (1 - (top[3] ?? 1)));

/** WCAG 2.x relative luminance of an opaque sRGB colour. */
const luminance = (rgb: number[]): number =>
	rgb
		.map((c) => c / 255)
		.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
		.reduce((sum, c, i) => sum + c * ([0.2126, 0.7152, 0.0722][i] ?? 0), 0);

/**
 * The drawn stroke and the background under it (every ancestor's own, composited outermost first
 * over white) and the WCAG 2.x contrast ratio between the two.
 */
export function contrastOf(colours: DrawnColours): { stroke: number[]; background: number[]; ratio: number } {
	const background = colours.backgrounds.toReversed().reduce((under, colour) => over(rgba(colour), under), [255, 255, 255]);
	const [r = 0, g = 0, b = 0, a = 1] = rgba(colours.stroke);
	const stroke = over([r, g, b, a * colours.opacity], background);
	const [high = 0, low = 0] = [luminance(stroke), luminance(background)].toSorted((x, y) => y - x);
	return { stroke: stroke.map((c) => Math.round(c)), background: background.map((c) => Math.round(c)), ratio: (high + 0.05) / (low + 0.05) };
}

/** The ACTIVE designer leaf's content element, as a selector the page can resolve. */
const ACTIVE = '.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-asset-designer"]';

/**
 * The AD18-R16 parity round's surfaces as a user reaches them in a real Obsidian: a leaf narrowed
 * or widened by resizing the WINDOW (Obsidian's default 1024 px window gives the designer a 679 px
 * leaf, measured), a right-click, the menu it opens, the Konva marks a handle drag grabs, the camera the layers carry,
 * and whether Obsidian's own graph view opened.
 */
export function createParityPage(browser: NativeBrowser, designer: DesignerPage) {
	const leafWidth = () =>
		browser.execute((root) => (document.querySelector(root) as HTMLElement | null)?.getBoundingClientRect().width ?? 0, ACTIVE);

	/**
	 * Resize the host WINDOW until the active designer leaf is about `width` px wide — the one way
	 * to narrow a real leaf, since WebDriver's own window commands are unknown to Obsidian's Electron.
	 */
	const setLeafWidth = async (width: number): Promise<number> => {
		for (let attempt = 0; attempt < 4; attempt += 1) {
			const current = await leafWidth();
			if (Math.abs(current - width) < 6) break;
			await browser.execute((delta) => {
				const remote = (window as unknown as { require(id: string): { getCurrentWindow(): { getSize(): number[]; setSize(w: number, h: number): void } } }).require('@electron/remote');
				const [w = 0, h = 0] = remote.getCurrentWindow().getSize();
				remote.getCurrentWindow().setSize(Math.round(w + delta), h);
			}, width - current);
			await browser.pause(400);
		}
		return leafWidth();
	};

	/** Client rects of every Konva shape of this `name` on the active designer's stage. */
	const canvas = createCanvasPage(browser, designer);
	const marks = async (name: string): Promise<Rect[]> =>
		(await canvas.shapeBoxes(name)).map((box) => ({ x: box.left, y: box.top, width: box.width, height: box.height }));

	/**
	 * The centre of one of the selection's box handles, found by where it is DRAWN: the
	 * right-middle one, or the bottom-right corner.
	 */
	const handle = async (where: 'right' | 'bottom-right'): Promise<{ x: number; y: number }> => {
		const centres = (await marks('asset-selection-handle')).map((r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 }));
		const right = Math.max(...centres.map((c) => c.x));
		const column = centres.filter((c) => c.x > right - 2).toSorted((a, b) => a.y - b.y);
		const found = where === 'right' ? column[1] : column.at(-1);
		if (!found || column.length !== 3) throw new Error(`No ${where} handle among ${JSON.stringify(centres)}.`);
		return found;
	};

	/** The camera the designer's layers carry, and the canvas centre in stage pixels. */
	const camera = (): Promise<Camera> =>
		browser.execute((root) => {
			const konva = (window as unknown as { Konva: { stages: { find(sel: string): { name(): string; x(): number; y(): number; scaleX(): number }[]; container(): HTMLElement; width(): number; height(): number }[] } }).Konva;
			const host = document.querySelector(root);
			const stage = konva.stages.find((candidate) => host?.contains(candidate.container()));
			const layer = stage?.find('Layer').find((candidate) => candidate.name() === 'asset-footprint');
			if (!stage || !layer) throw new Error('No designer stage.');
			return { x: layer.x(), y: layer.y(), scale: layer.scaleX(), centre: { x: stage.width() / 2, y: stage.height() / 2 } };
		}, ACTIVE);

	const { canvasPoint } = designer;

	/** A drag from one point to another in ONE action chain, optionally with Shift held. */
	const dragBetween = async (from: { x: number; y: number }, to: { x: number; y: number }, shift = false): Promise<void> => {
		if (shift) await browser.action('key').down('').perform(true);
		// Paced rather than flung: a press and a release 240 ms apart under load was measured to
		// draw nothing now and then, so each phase gets a beat and the path gets several steps.
		const chain = browser.action('pointer').move({ x: Math.round(from.x), y: Math.round(from.y), origin: 'viewport' }).pause(100).down().pause(100);
		for (const step of [0.25, 0.5, 0.75, 1]) {
			chain.move({ x: Math.round(from.x + (to.x - from.x) * step), y: Math.round(from.y + (to.y - from.y) * step), duration: 80, origin: 'viewport' });
		}
		await chain.pause(100).up().perform(true);
		if (shift) await browser.action('key').up('').perform(true);
	};

	/** Draw a box with one of the Add rail's shape tools, between two fractions of the canvas. */
	const drawBox = async (tool: string, from: [number, number], to: [number, number]): Promise<void> => {
		const tile = designer.designer().$(`.rp-designer-add [aria-label="${tool}"]`);
		await tile.click();
		await expect.poll(() => tile.getAttribute('aria-pressed')).toBe('true');
		// Every completed draw hands back to Select. A drag that drew nothing — measured now and then
		// on this host, with the tool still armed and no notice raised — is dragged again, at most twice.
		const select = designer.designer().$('.rp-designer-tools [aria-label="Select"]');
		for (let attempt = 0; attempt < 3; attempt += 1) {
			await dragBetween(await canvasPoint(...from), await canvasPoint(...to));
			const drawn = await browser
				.waitUntil(async () => (await select.getAttribute('aria-pressed')) === 'true', { timeout: 3000 })
				.catch(() => false);
			if (drawn) return;
		}
		throw new Error(`${tool} drew nothing in three drags.`);
	};

	/** A right-click at a viewport point: a real `contextmenu`, through the pointer. */
	const rightClick = (point: { x: number; y: number }) =>
		browser
			.action('pointer')
			.move({ x: Math.round(point.x), y: Math.round(point.y), origin: 'viewport' })
			.down({ button: 2 })
			.up({ button: 2 })
			.perform();

	const menu = () => designer.designer().$('.rp-canvas-context-menu');

	/** The open designer menu as a user reads it: each item's label and shortcut, and `---` per separator. */
	const menuLines = (): Promise<string[]> =>
		browser.execute((root) => {
			const list = document.querySelector(`${root} .rp-canvas-context-menu`);
			if (!list) return [];
			return [...list.children].map((child) =>
				child.getAttribute('role') === 'separator'
					? '---'
					: [...child.childNodes].map((node) => node.textContent?.trim() ?? '').filter(Boolean).join(' | '),
			);
		}, ACTIVE);

	/** Which element holds focus, as a short description a case can compare. */
	const focused = () =>
		browser.execute(() => {
			const el = document.activeElement as HTMLElement | null;
			if (!el) return 'none';
			if (el.classList.contains('rp-designer-part-row')) return `row:${el.getAttribute('name') ?? ''}`;
			if (el.classList.contains('rp-plan-canvas')) return 'canvas';
			return `${el.tagName.toLowerCase()}.${el.className}`;
		});

	/** Obsidian's own graph view leaves — what its default Ctrl+G opens. */
	const graphLeaves = () => browser.executeObsidian(({ app }) => app.workspace.getLeavesOfType('graph').length);

	/** Whatever Obsidian itself has bound to a command, as `Mod+G`-style strings. */
	const hotkeysOf = (command: string) =>
		browser.executeObsidian(({ app }, id) => {
			const manager = (app as unknown as { hotkeyManager: { getHotkeys(id: string): { modifiers: string[]; key: string }[] | undefined; getDefaultHotkeys(id: string): { modifiers: string[]; key: string }[] | undefined } }).hotkeyManager;
			const keys = manager.getHotkeys(id) ?? manager.getDefaultHotkeys(id) ?? [];
			return keys.map((key) => [...key.modifiers, key.key].join('+'));
		}, command);

	/**
	 * Take a command's hotkey away in THIS copied vault, as a user would in Settings ▸ Hotkeys, so a
	 * case can tell the designer's own handling from the host's binding pre-empting it.
	 */
	const unbindHotkey = (command: string) =>
		browser.executeObsidian(({ app }, id) => {
			const manager = (app as unknown as { hotkeyManager: { setHotkeys(id: string, keys: unknown[]): void; bake(): void } }).hotkeyManager;
			manager.setHotkeys(id, []);
			manager.bake();
		}, command);

	/**
	 * Listeners on `window` in BOTH phases recording every Ctrl+G: the capture one sees the chord
	 * before anything in the page can, the bubble one only if nothing stopped it on the way back up,
	 * and each notes whether it arrived default-prevented — the evidence for whether a chord was
	 * "captured" by the designer or left for the host.
	 */
	const watchChords = (letter = 'g') =>
		browser.execute((wanted) => {
			const holder = window as unknown as { rpChords: string[] };
			holder.rpChords = [];
			const record = (phase: string) => (event: KeyboardEvent) => {
				if (event.ctrlKey && event.key.toLowerCase() === wanted) holder.rpChords.push(`${phase}:${event.shiftKey ? 'Ctrl+Shift+' : 'Ctrl+'}${wanted.toUpperCase()}${event.defaultPrevented ? ':prevented' : ''}`);
			};
			window.addEventListener('keydown', record('capture'), true);
			window.addEventListener('keydown', record('bubble'));
		}, letter);
	/** The chords `watchChords` has seen since the last read, which it clears. */
	const chords = () =>
		browser.execute(() => {
			const holder = window as unknown as { rpChords: string[] };
			return holder.rpChords.splice(0);
		});

	/** Ctrl+G through the driver: a real key chord the host's own keymap sees first. */
	const pressCtrlG = async (shift = false): Promise<void> => {
		await browser.keys(shift ? ['Control', 'Shift', 'g'] : ['Control', 'g']);
		await browser.pause(500);
	};

	/** The legend's rows as `kind:text`, the kind read off each row's own swatch. */
	const legendRows = (): Promise<string[]> =>
		browser.execute(
			(root) =>
				[...document.querySelectorAll(`${root} .rp-designer-legend__row`)].map((row) => {
					const swatch = row.querySelector('.rp-designer-legend__swatch');
					const kind = [...(swatch?.classList ?? [])].find((name) => name.startsWith('rp-designer-legend__swatch--'))?.slice(28) ?? 'none';
					return `${kind}:${row.textContent?.trim() ?? ''}`;
				}),
			ACTIVE,
		);

	/** The scale bar as it reads: its marks and its end, space-separated. */
	const scaleBarText = (): Promise<string> =>
		browser.execute(
			(root) =>
				[...document.querySelectorAll(`${root} .rp-designer-scale-bar span`)].map((span) => span.textContent?.trim() ?? '').join(' '),
			ACTIVE,
		);

	/** A uniform clearance on every side, through the Inspector's own generator. */
	const generateClearance = async (setback: number): Promise<void> => {
		await designer.inspectorField('clearance-all-sides').setValue(String(setback));
		const button = designer.designer().$('button[name="generate-clearance"]');
		await button.scrollIntoView({ block: 'center' });
		await button.click();
	};

	/**
	 * A drag HELD at `to` for a second, in ONE action chain — a second chain gets a fresh pointer at
	 * (0, 0), so a release cannot follow separately — with a snapshot taken by a timer INSIDE the
	 * page 700 ms into the hold, since the driver runs nothing of its own until the chain ends: the
	 * legend's rows and the sidecar's revision as the vault reads it at that moment.
	 */
	const sampleMidDrag = async (from: { x: number; y: number }, to: { x: number; y: number }, sidecar: string): Promise<MidDrag> => {
		await browser.execute(
			(root, file) => {
				const holder = window as unknown as { rpSample?: Promise<MidDrag>; app: { vault: { adapter: { read(path: string): Promise<string> } } } };
				holder.rpSample = new Promise((resolve) => {
					setTimeout(() => {
						const legend = [...document.querySelectorAll(`${root} .rp-designer-legend__row`)].map((row) => row.textContent?.trim() ?? '');
						resolve(holder.app.vault.adapter.read(file).then((text) => ({ legend, revision: (JSON.parse(text) as { revision: number }).revision })));
					}, 700);
				});
			},
			ACTIVE,
			sidecar,
		);
		const chain = browser.action('pointer').move({ x: Math.round(from.x), y: Math.round(from.y), origin: 'viewport' }).down();
		await chain.move({ x: Math.round(to.x), y: Math.round(to.y), duration: 200, origin: 'viewport' }).pause(1200).up().perform();
		return browser.execute(() => (window as unknown as { rpSample: Promise<MidDrag> }).rpSample);
	};

	/**
	 * Every Obsidian command whose EFFECTIVE hotkeys (the user's, else the default) include one of
	 * `combos` (`Mod+Z`-style) — the question "what would the host run for this key", asked of the hotkey manager.
	 */
	const boundTo = (combos: string[]) =>
		browser.executeObsidian(({ app }, wanted) => {
			const host = app as unknown as {
				commands: { commands: Record<string, unknown> };
				hotkeyManager: { getHotkeys(id: string): { modifiers: string[]; key: string }[] | undefined; getDefaultHotkeys(id: string): { modifiers: string[]; key: string }[] | undefined };
			};
			return Object.keys(host.commands.commands).filter((id) => {
				const keys = host.hotkeyManager.getHotkeys(id) ?? host.hotkeyManager.getDefaultHotkeys(id) ?? [];
				return keys.some((key) => wanted.includes([...key.modifiers, key.key.toUpperCase()].join('+')));
			});
		}, combos);

	/**
	 * Wrap the host's two command doors so every command that actually RAN (answered truthy) is
	 * recorded — a hotkey reaches a command through `executeCommand`, measured with Ctrl+G, which
	 * records `graph:open`. `commandsRun` reads and clears the record.
	 */
	const recordCommands = () =>
		browser.executeObsidian(({ app }) => {
			const doors = (app as unknown as { commands: Record<string, (...args: unknown[]) => unknown> }).commands;
			const holder = window as unknown as { rpRan: string[] };
			holder.rpRan = [];
			for (const door of ['executeCommand', 'executeCommandById']) {
				const original = doors[door]?.bind(doors);
				if (!original) throw new Error(`No command door ${door}.`);
				doors[door] = (...args: unknown[]) => {
					const answer = original(...args);
					const first = args[0] as { id?: string } | string;
					if (answer) holder.rpRan.push(typeof first === 'string' ? first : (first.id ?? '?'));
					return answer;
				};
			}
		});
	const commandsRun = () => browser.execute(() => (window as unknown as { rpRan: string[] }).rpRan.splice(0));

	/**
	 * The Inspector asset card's thumbnail outline against what it is drawn on, as the page computes
	 * them: the stroke colour, the opacity every level applies to it, and every ancestor's own
	 * background, innermost first. `contrastOf` turns that into a ratio.
	 */
	const thumbnailColours = (): Promise<DrawnColours> =>
		browser.execute((root) => {
			const path = document.querySelector(`${root} .rp-designer-asset-thumbnail__footprint`);
			if (!path) throw new Error('No thumbnail outline.');
			const chain: Element[] = [];
			for (let el = path.parentElement; el; el = el.parentElement) chain.push(el);
			const style = getComputedStyle(path);
			return {
				stroke: style.stroke,
				opacity: [path, ...chain].reduce((product, el) => product * Number(getComputedStyle(el).opacity), Number(style.strokeOpacity)),
				backgrounds: chain.map((el) => getComputedStyle(el).backgroundColor),
			};
		}, ACTIVE);

	/**
	 * What the active designer SHOWS for the four facts a plugin reload must keep beside the shape:
	 * the Reference tab's Scale row, the pressed placement segment, the Front direction and the
	 * Height field. Leaves the Object tab selected, where it found it.
	 */
	const placementReadings = async () => {
		await designer.referenceTab();
		// By its `dt` across EVERY field list: a shaped asset draws a Source list first, and
		// `referenceRow` looks only in the first.
		let scale: string | null = null;
		await expect
			.poll(async () => {
				scale = await browser.execute(
					(root) =>
						[...document.querySelectorAll(`${root} .rp-designer-reference-fields dt`)].find((term) => term.textContent?.trim() === 'Scale')?.nextElementSibling?.textContent?.trim() ?? null,
					ACTIVE,
				);
				return scale;
			})
			.not.toBeNull();
		await designer.designer().$('.rp-designer-tab[data-rp-tab="object"]').click();
		const shown = await browser.execute(
			(root) => ({
				anchor: [...document.querySelectorAll(`${root} .rp-designer-placement-modes button[aria-pressed="true"]`)].map((button) => button.getAttribute('name')),
				front: document.querySelector<HTMLSelectElement>(`${root} select[name="front-direction"]`)?.value ?? null,
				height: document.querySelector<HTMLInputElement>(`${root} input[name="height"]`)?.value ?? null,
			}),
			ACTIVE,
		);
		return { scale, ...shown };
	};

	/** Close the (only) designer leaf and wait until Obsidian holds none. */
	const closeDesigner = async (): Promise<void> => {
		await designer.closeDesigner();
		await expect.poll(() => designer.leafStates('renovation-asset-designer')).toEqual([]);
	};

	/** Wait for the sidecar to reach a revision, and read it. */
	const settle = async (assetId: string, revision: number) => {
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(revision);
		return designer.readSidecar(assetId);
	};

	return { leafWidth, setLeafWidth, marks, camera, canvasPoint, dragBetween, drawBox, rightClick, menu, menuLines, focused, graphLeaves, hotkeysOf, unbindHotkey, watchChords, chords, boundTo, recordCommands, commandsRun, thumbnailColours, placementReadings, pressCtrlG, legendRows, scaleBarText, generateClearance, sampleMidDrag, handle, closeDesigner, settle, ACTIVE,
		/** A sidecar's path as the VAULT names it, for a read made from inside the page. */
		sidecarFile: (assetId: string) => `Renovation/Library/Geometry/${assetId}.rpgeo`,
	};
}

export type ParityPage = ReturnType<typeof createParityPage>;
