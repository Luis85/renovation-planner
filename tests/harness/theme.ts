/**
 * What the page tells the plugin's stylesheet about its environment: the colour scheme,
 * and whether this is a phone. Both are a body class in Obsidian and nothing more, which
 * is why they belong together and why a URL can ask for either.
 *
 * Obsidian marks the scheme with `theme-dark` / `theme-light` on the body and swaps the
 * variables under it; the vendored app.css is built the same way, so applying the class is
 * the whole mechanism. The plugin's partials read the variables and never name a scheme,
 * so this switches the page without the view knowing — which is what makes it worth
 * looking at both ways: anything that only reads in one scheme is the plugin's own
 * contrast to answer for, not the theme's.
 *
 * `?theme=light` opens straight into one, for the same reason a projection knob would
 * exist: a headless screenshot of a URL needs nothing to click, which keeps the refusal of
 * a browser-automation dependency cheap rather than merely principled.
 */
type Scheme = 'dark' | 'light';

const SCHEMES: Scheme[] = ['dark', 'light'];

/** `?theme=light`, else dark — the app's own default. */
function wantedScheme(search: string): Scheme {
	const asked = new URLSearchParams(search).get('theme');
	return SCHEMES.find((scheme) => scheme === asked) ?? 'dark';
}

/**
 * `?phone` — the phone body classes, so the rules keyed on them can be looked at.
 *
 * Obsidian's app shell puts BOTH `is-mobile` and `is-phone` on the body of a phone, and
 * both earn their place: a partial's phone rules key on `.is-phone`, and the vendored
 * sheet's own `.is-mobile` block redefines a batch of variables (the modal radius, the
 * touch sizes) that everything else then reads.
 *
 * It is a class switch and no more: the viewport is still the browser window and the input
 * is still a mouse, so a rule keyed on `@media (hover: none)` is a browser's own device
 * emulation to reach, and a gesture is a real device's.
 *
 * Applied BEFORE the mount, because a toolbar that measures itself as it draws would
 * otherwise measure against the other layout.
 */
export function applyPlatform(search: string): void {
	const phone = new URLSearchParams(search).has('phone');
	// `classList`, not `toggleClass` — Obsidian's prototype extensions are installed by
	// `mountHarness`, which has not run yet at the one call site that matters. The suite
	// cannot see that: every jsdom file installs them at module top, so `toggleClass` here
	// would pass the test and throw on the real page, taking the whole mount with it.
	document.body.classList.toggle('is-mobile', phone);
	document.body.classList.toggle('is-phone', phone);
}

function applyScheme(scheme: Scheme): void {
	document.body.classList.toggle('theme-dark', scheme === 'dark');
	document.body.classList.toggle('theme-light', scheme === 'light');
}

/**
 * Draw the switch — the module's whole surface, since nothing outside the page needs to
 * ask for a scheme. It is the HARNESS's furniture, drawn outside the mounted view and
 * marked as such, because a control in a screenshot that nobody can find in the plugin is
 * worse than no control at all.
 */
export function drawSchemeToggle(): void {
	let scheme = wantedScheme(window.location.search);
	applyScheme(scheme);

	const btn = document.body.createEl('button', {
		cls: 'rp-harness-scheme',
		attr: { type: 'button' },
	});
	const label = () => {
		btn.setText(scheme === 'dark' ? 'Harness: dark' : 'Harness: light');
		btn.setAttribute('aria-label', `Switch the harness to ${scheme === 'dark' ? 'light' : 'dark'}`);
	};
	label();
	btn.addEventListener('click', () => {
		scheme = scheme === 'dark' ? 'light' : 'dark';
		applyScheme(scheme);
		label();
	});
}
