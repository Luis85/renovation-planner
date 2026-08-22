/** The bundle's entry point. Everything real is in `mount.ts`, which a test can drive. */
import { mountHarness } from './mount';
import { applyPlatform, drawSchemeToggle } from './theme';

// Before the mount: `is-phone` is a body class that a toolbar's own fit measurement can
// see, and applying it afterwards would leave that measurement made against the other
// layout.
applyPlatform(window.location.search);

const { view } = mountHarness(document.body);

// After the mount: the toggle is the harness's own furniture and is appended to the body,
// which `mountHarness` empties.
drawSchemeToggle();

/**
 * The view, for a throwaway probe pasted into a console — does the scroll position survive
 * a redraw, does hovering force layout. Without this hook each of those means editing this
 * file. Nothing in the harness or the suite reads it: it exists so that the thing thrown
 * away afterwards is a paste rather than a commit.
 */
(window as unknown as Record<string, unknown>).__rp = { view };
