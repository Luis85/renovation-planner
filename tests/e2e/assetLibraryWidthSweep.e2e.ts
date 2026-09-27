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
 *
 * Desktop only: mobile emulation fixes the device metrics, so a window resize sizes nothing there.
 */
const desktop = mobileEmulation ? test.skip : test;

/** One fault, and whether it is the one the sweep tolerates (see the case's docblock). */
interface Fault { text: string; tolerated?: boolean }

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
				// Whether every glyph of the control's own words is still inside what shows of it.
				const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
				const range = document.createRange();
				let words = true;
				for (let node = walker.nextNode(); node; node = walker.nextNode()) {
					if (!node.textContent?.trim()) continue;
					range.selectNodeContents(node);
					const text = range.getBoundingClientRect();
					words &&= text.left >= left - 0.5 && text.right <= right + 0.5;
				}
				const tolerated = el.classList.contains('rp-al-create-card__action') && words;
				found.push({ text: `${name} is cut off sideways: ${String(box.left)}–${String(box.right)} shows ${String(left)}–${String(right)}`, tolerated });
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

/** The host's root font size, which `@container rp-al`'s rem rungs are measured in. */
const rootFont = (browser: NativeBrowser) => browser.execute(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize));

describe('Browse the asset library, widths from a sidebar to a full pane, in the real Obsidian host', () => {
	/**
	 * The sweep runs from 460 px — the sidebar width the review names for this row's "sidebar's width"
	 * — to 980 px, a whole 1024 px window's pane with the docks collapsed: every 20 px, and every 4 px
	 * over the first 40 px above each rung (35rem and 45rem, read in the host's own rem), where the
	 * rail first squeezes the shelves and a fault is likeliest. Each width is the container the window
	 * REACHED, which the walk reads back rather than trusts.
	 *
	 * **Blind spot, named**: this samples widths, it does not prove every width. A fault in a band
	 * narrower than the gap between two reached widths is missed — and a window resize does not reach
	 * every container width at all (on Windows it jumped from 556 to 572 above 35rem and from 700 to
	 * 728 above 45rem, so the first few dense targets over each rung land on the same width).
	 *
	 * **One fault is TOLERATED, and it is a finding rather than a pin**: at the narrowest widths the
	 * 240 px rail is drawn, the create card's `New asset` button (the grid's last cell) is wider than
	 * the card's body and runs past a clipping ancestor's edge — on Windows, 1.3 px of its 104 px at a
	 * 572 px container, and nothing at 576 or wider. CI's wider Linux fonts widen the button, so the
	 * band and the amount there are not this machine's. It is let through only while its words stay
	 * wholly inside what shows of it — the cut takes padding, never the label — and a fix turns
	 * nothing red. Any other fault, or that one reaching the label, fails.
	 */
	desktop('clips, overflows and overlaps no control at every 20 px from 460 px to a full pane and every 4 px above each rung, with an asset selected', async ({
		native: { browser, page, ui },
	}) => {
		const lib = await openCatalogue(browser, page, ui, { layout: 'Grid' });
		const selected = lib.tile('Sofa');
		await selected.click();
		await expect.poll(() => selected.getAttribute('class')).toContain('rp-al-tile--on');
		const rem = await rootFont(browser);
		const rungs = [35 * rem, 45 * rem];
		const targets = new Set<number>();
		for (let target = 460; target <= 980; target += 20) targets.add(target);
		for (const rung of rungs) for (let step = 0; step <= 40; step += 4) targets.add(Math.round(rung + step));
		const reached: number[] = [];
		const found: string[] = [];
		const tolerated: string[] = [];
		for (const target of [...targets].toSorted((a, b) => a - b)) {
			const width = await lib.resizeTo(target);
			reached.push(width);
			for (const fault of await faults(browser)) (fault.tolerated ? tolerated : found).push(`${String(width)} px: ${fault.text}`);
		}
		console.log(`step 11 reached ${JSON.stringify(reached)}; tolerated ${JSON.stringify(tolerated)}`);
		// The walk covered the range it names, not only the widths a resize happened to land on.
		expect(Math.min(...reached)).toBeLessThan(rungs[0]);
		expect(Math.max(...reached)).toBeGreaterThan(rungs[1] + 200);
		expect(found).toEqual([]);
	});
});
