// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { restoreInspectorActionFocus, runInspectorAction } from '../../../src/presentation/editor/shell/restoreInspectorActionFocus';
import { defer } from '../../helpers/async';

afterEach(() => { document.body.replaceChildren(); });
function setup() {
	const root = document.createElement('div'), region = document.createElement('div'), opener = document.createElement('button');
	region.dataset.rpShellRegion = 'inspector'; opener.dataset.rpAction = 'rename-room';
	region.append(opener); root.append(region); document.body.append(root); opener.focus();
	return { root, region, opener };
}
function button(root: HTMLElement, attribute: string): HTMLButtonElement {
	const result = document.createElement('button'); result.setAttribute(attribute, 'details'); root.append(result); return result;
}
describe('Inspector action focus after root-owned dialogs', () => {
	it('captures the click target before the dialog resolves and recovers only after it closes', async () => {
		const { root, region, opener } = setup(), rail = button(root, 'data-rp-rail'), pending = defer<void>(); root.className = 'renovation-plan-editor';
		let finished: Promise<void> | undefined;
		opener.addEventListener('click', event => { finished = runInspectorAction(event, 'rename-room', () => pending.promise); }, { once: true });
		opener.click(); region.style.display = 'none'; expect(document.activeElement).toBe(opener);
		pending.resolve(); await finished; expect(document.activeElement).toBe(rail);
	});
	it('leaves the normal visible opener restoration alone', () => {
		const { root, opener } = setup(), other = button(root, 'data-other'); other.focus();
		restoreInspectorActionFocus(opener, root, 'rename-room'); expect(document.activeElement).toBe(other);
	});
	it('returns to the visible rail when the persistent opener is hidden', () => {
		const { root, region, opener } = setup(), rail = button(root, 'data-rp-rail'); region.style.display = 'none';
		restoreInspectorActionFocus(opener, root, 'rename-room'); expect(document.activeElement).toBe(rail);
	});
	it('uses the width notice when reflow hides the supported shell', () => {
		const { root, region, opener } = setup(), notice = button(root, 'data-notice'); notice.className = 'rp-unsupported-width__action'; region.style.display = 'none';
		restoreInspectorActionFocus(opener, root, 'rename-room'); expect(document.activeElement).toBe(notice);
	});
	it('finds a replacement action after the old opener is removed', () => {
		const { root, opener } = setup(); opener.remove();
		const replacement = button(root, 'data-rp-action'); replacement.dataset.rpAction = 'rename-room';
		restoreInspectorActionFocus(opener, root, 'rename-room'); expect(document.activeElement).toBe(replacement);
	});
	it('falls back to the current Inspector when that action no longer exists', () => {
		const { root, region, opener } = setup(); opener.remove(); region.dataset.rpRegion = 'inspector'; region.tabIndex = -1;
		restoreInspectorActionFocus(opener, root, 'rename-room'); expect(document.activeElement).toBe(region);
	});
	it('does not steal focus after disposal or without an editor root or destination', () => {
		const { root, opener } = setup(), outside = button(document.body, 'data-other'); outside.focus(); root.remove();
		restoreInspectorActionFocus(opener, root, 'rename-room'); expect(document.activeElement).toBe(outside);
		restoreInspectorActionFocus(opener, null, 'rename-room'); expect(document.activeElement).toBe(outside);
		root.replaceChildren(); document.body.append(root);
		restoreInspectorActionFocus(opener, root, 'rename-room'); expect(document.activeElement).toBe(outside);
	});
});
