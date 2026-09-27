import { describe, expect } from 'vitest';
import { test } from './fixture';
import { openCatalogue } from './library';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Browse the asset library.md` step 11, GUARD (ruling AD18-R30): "no
 * intermediate width at which the panel is unusable". `assetLibraryWalk.e2e.ts` measures the rail's
 * three rungs at four widths; this walks the whole range between them and asks, at every width,
 * the parts of "unusable" a layout engine CAN answer. What stays human is the rest of the word —
 * whether a width that clips, overflows and overlaps nothing still reads as usable.
 */
const desktop = mobileEmulation ? test.skip : test;

/** One fault; a control cut off sideways also names its class and the share of its width still shown. */
interface Fault { text: string; cut?: string; shown?: number }

/**
 * Everything wrong with the library's layout at its current width, one sentence per fault:
 * - the pane itself scrolls sideways (`scrollWidth` past `clientWidth`);
 * - a control's content overflows its own box;
 * - a control is cut off sideways by an ancestor that clips (the pane, or a scroller);
 * - two controls' visible boxes share area, neither holding the other.
 * A control is anything a user presses or types into that is drawn at all; a box is what is left
 * of it inside every clipping ancestor, so a row scrolled out of view overlaps nothing. A pixel of
 * slack on every comparison absorbs sub-pixel layout.
 */
const faults = (browser: NativeBrowser): Promise<Fault[]> =>
	browser.execute(() => {
		const root = document.querySelector<HTMLElement>('.workspace-leaf.mod-active .renovation-asset-library');
		if (!root) return [{ text: 'no library' }];
		const found: Fault[] = [];
		if (root.scrollWidth > root.clientWidth + 1) found.push({ text: `the pane scrolls: ${String(root.scrollWidth)} in ${String(root.clientWidth)}` });
		const controls = [...root.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [role="button"], [role="tab"]')].flatMap((el) => {
			const box = el.getBoundingClientRect();
			if (box.width < 2 || box.height < 2 || getComputedStyle(el).visibility === 'hidden') return [];
			const name = `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}[${el.textContent?.trim().slice(0, 20) ?? ''}]`;
			let [left, right, top, bottom] = [box.left, box.right, box.top, box.bottom];
			for (let up = el.parentElement; up && root.contains(up); up = up.parentElement) {
				const style = getComputedStyle(up);
				if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
				const clip = up.getBoundingClientRect();
				[left, right, top, bottom] = [Math.max(left, clip.left), Math.min(right, clip.right), Math.max(top, clip.top), Math.min(bottom, clip.bottom)];
			}
			if (box.left < left - 1 || box.right > right + 1) {
				found.push({ text: `${name} is cut off sideways: ${String(box.left)}–${String(box.right)} shows ${String(left)}–${String(right)}`, cut: el.className, shown: (right - left) / box.width });
			}
			if (el.scrollWidth > el.clientWidth + 1) found.push({ text: `${name} overflows: ${String(el.scrollWidth)} in ${String(el.clientWidth)}` });
			return right - left > 1 && bottom - top > 1 ? [{ el, name, left, right, top, bottom }] : [];
		});
		for (const [index, one] of controls.entries()) {
			for (const other of controls.slice(index + 1)) {
				const shared = Math.min(one.right, other.right) - Math.max(one.left, other.left) > 1 && Math.min(one.bottom, other.bottom) - Math.max(one.top, other.top) > 1;
				if (shared && !one.el.contains(other.el) && !other.el.contains(one.el)) found.push({ text: `${one.name} overlaps ${other.name}` });
			}
		}
		return found;
	});

describe('Browse the asset library, every width from a sidebar to a full pane, in the real Obsidian host', () => {
	/**
	 * The sweep runs from 460 px — the sidebar width the review names for this row's "sidebar's width"
	 * — to 980 px, a whole 1024 px window's pane with the docks collapsed, in 20 px steps, so both
	 * rungs (35rem and 45rem at the host's 16 px root) are crossed with a step either side. Each
	 * width is the container the window REACHED, which the walk reads back rather than trusts.
	 *
	 * **CONTRARY, pinned rather than fixed** (AD18-R27): at the narrowest width the 240 px rail is
	 * drawn, the create card's `New asset` button (the grid's last cell) is wider than the card's
	 * body and runs past a clipping ancestor's edge — measured on Windows at a 572 px container, the
	 * narrowest a window resize reached above 35rem, 1.3 px of its 104 px cut off, and nothing at
	 * 576 or wider. CI's wider Linux fonts widen the button, so the width band and the amount there
	 * are not this machine's. That one fault is let through while more than half the button still
	 * shows, which keeps it pressable; any other fault, or that one grown past half, fails.
	 */
	desktop('clips, overflows and overlaps no control at any width from 460 px to a full pane, with an asset selected', async ({
		native: { browser, page, ui },
	}) => {
		const lib = await openCatalogue(browser, page, ui, { layout: 'Grid' });
		const selected = lib.tile('Sofa');
		await selected.click();
		await expect.poll(() => selected.getAttribute('class')).toContain('rp-al-tile--on');
		const reached: number[] = [];
		const found: string[] = [];
		const pinned: string[] = [];
		for (let target = 460; target <= 980; target += 20) {
			const width = await lib.resizeTo(target);
			reached.push(width);
			for (const fault of await faults(browser)) {
				const known = fault.cut === 'rp-al-create-card__action' && (fault.shown ?? 0) > 0.5;
				(known ? pinned : found).push(`${String(width)} px: ${fault.text}`);
			}
		}
		console.log(`step 11 reached ${JSON.stringify(reached)}; pinned ${JSON.stringify(pinned)}`);
		// The walk covered the range it names, not only the widths a resize happened to land on.
		expect(Math.min(...reached)).toBeLessThan(35 * 16);
		expect(Math.max(...reached)).toBeGreaterThan(45 * 16 + 200);
		expect(found).toEqual([]);
	});
});
