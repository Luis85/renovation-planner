import { runAreaBrowserMatrix } from './editor-area-browser.mjs';
import { referenceViewportAcceptance, referenceViewportBaseline } from './editor-reference-viewport-browser.mjs';

// Reference-only backport of #116's supplemental driver onto its owning concern,
// #109. The Photo and Opening journeys remain unchanged on the cumulative stack.
const baseline = process.argv.includes('--reference-baseline');
async function journey(page, scenario, out) {
	if (baseline) return referenceViewportBaseline(page, scenario, out);
	return { reference: await referenceViewportAcceptance(page, scenario, out), scope: 'Reference scaling only; native-host verification is separate' };
}
// Pixel readbacks otherwise switch Chromium from GPU to CPU mid-journey, changing
// raster antialiasing despite identical camera transforms. Keep exact pixel assertions.
await runAreaBrowserMatrix(baseline ? 'editor-reference-legacy' : 'editor-reference-scale', '&reference&fidelity', journey, '[data-rp-empty="floor-start"]', { args: ['--disable-accelerated-2d-canvas'] });
