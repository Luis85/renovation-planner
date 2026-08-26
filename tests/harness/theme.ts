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
	// What Obsidian's own `css-change` means: the variables under the body just changed. A
	// Konva canvas cannot read a CSS variable, so the Plan Editor resolves the palette into
	// plain colour strings once and has to be told when to do it again.
	//
	// Fired HERE rather than only from the toggle's click handler, because the FIRST call is
	// the one that matters: `page.ts` mounts the view before `drawSchemeToggle` puts any
	// scheme class on the body, so an editor that resolved at mount saw no `--color-*` at
	// all and fell back to the theme's ink for every zone type. Four differently-typed zones
	// drawn in the same grey is what that looks like, and `npm run harness-shot` is what
	// showed it — jsdom draws nothing and the suite sets the variables itself.
	window.dispatchEvent(new Event('rp-harness-theme'));
}

/**
 * Writes the scheme into the URL, `replaceState`d rather than pushed for the same reason
 * `IndexPage.vue`'s `open()` uses it: this is one page, and a back-button stack of every
 * toggle click is not what a designer wants.
 *
 * The URL is the ONE source of truth for the scheme — `wantedScheme` already reads it that
 * way at load — so the toggle writes here rather than `hrefFor` (in `IndexPage.vue`) or any
 * other reader deriving a link from the scheme currently applied. A second source, kept in
 * sync by hand, is how this diverged in the first place: the toggle used to mutate only the
 * local `scheme` variable below and never touched the URL, which was harmless while nothing
 * read the URL for its scheme — until `hrefFor` started building entry links from
 * `window.location.search` and started faithfully propagating a value that was already
 * stale. This also fixes a second, previously unreported gap the same way: a refresh after
 * toggling used to revert the scheme, because the URL had never learned about the change.
 */
function writeSchemeToURL(scheme: Scheme): void {
	const params = new URLSearchParams(window.location.search);
	params.set('theme', scheme);
	window.history.replaceState(null, '', `?${params.toString()}`);
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
		writeSchemeToURL(scheme);
		label();
	});
}
