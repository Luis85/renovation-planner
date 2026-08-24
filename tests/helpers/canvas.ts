import { createCanvas, DOMMatrix, ImageData, loadImage, Path2D, type Canvas, type Image } from '@napi-rs/canvas';

/**
 * A REAL 2D canvas behind jsdom's `<canvas>`, and a real image decoder behind its
 * `<img>`.
 *
 * jsdom implements neither: `getContext('2d')` answers `null` ("without installing the
 * canvas npm package"), `DOMMatrix` and `Path2D` do not exist, and no image ever loads.
 * All three are load-bearing here — Konva constructs a `Context` unconditionally and
 * throws without one, pdf.js builds a `DOMMatrix` at module scope, and a background is a
 * decoded raster or it is nothing.
 *
 * The alternative was an inert stub whose every method returns `undefined`. It was built,
 * it worked, and it is not what this is: a stub that accepts every call and draws nothing
 * is precisely the fake KINDER than the real thing that this project has already paid for
 * once (`SVG_CLASS_TOKENS` in `eslint.config.mjs` records that bill). `@napi-rs/canvas` is
 * prebuilt per platform — no build toolchain, which is what makes it viable on all four CI
 * legs — and it is the same package pdf.js's own Node support reaches for, so what runs
 * here is a real rasterizer answering real questions about real pixels.
 *
 * **What this is still not.** The pixels live in a BACKING canvas, not in the jsdom
 * element: jsdom's `<canvas>` has no pixel buffer to lend, so `getContext` hands back the
 * backing's context and the element stays an empty shell. In the plugin the element IS
 * what gets painted. So a test that wants to look at pixels asks `backingCanvas(el)`, and
 * anything asserting "the element the model carries is the one that was painted" is true
 * here only through this indirection. Nothing else about the rasterization is simulated.
 */
const backings = new WeakMap<HTMLCanvasElement, Canvas>();

/** Decoded rasters, by the jsdom <img> they were decoded for; see `bridgeDrawImage`. */
const decoded = new WeakMap<HTMLImageElement, Image>();

/**
 * What `Vault.getResourcePath` would hand out, and the bytes behind it. A registry rather
 * than a data URI: the plugin is forbidden from base64-ing a background (SDD §55), and a
 * fake that made the bytes travel inside the URL would be modelling the one thing the
 * production path must never do.
 */
const resources = new Map<string, Uint8Array>();

/**
 * URLs whose `decode()` is held open until `releaseResource` is called.
 *
 * Real decoding here is effectively instantaneous, which makes the ORDER of two overlapping
 * loads unobservable — and "the slower load wins and the canvas shows the previous
 * document" is a race that only exists between a load starting and finishing. This is the
 * only way to put a test on the far side of that gap.
 */
const deferred = new Map<string, () => void>();

export function registerResource(url: string, bytes: Uint8Array, options: { defer?: boolean } = {}): void {
	resources.set(url, bytes);
	if (options.defer === true) deferred.set(url, () => undefined);
}

/** Let a deferred decode finish. Harmless for a URL that was never deferred. */
export function releaseResource(url: string): void {
	const release = deferred.get(url);
	deferred.delete(url);
	release?.();
}

export function clearResources(): void {
	resources.clear();
	// Released rather than dropped: a pending decode still holds a promise, and leaving it
	// unresolved leaks the awaiting component into the next test file.
	const pending = Array.from(deferred.values());
	deferred.clear();
	for (const release of pending) release();
}

/** The canvas that actually holds the pixels for a jsdom `<canvas>`; see the header. */
export function backingCanvas(el: HTMLCanvasElement): Canvas | undefined {
	return backings.get(el);
}

function backingFor(el: HTMLCanvasElement): Canvas {
	let backing = backings.get(el);
	if (backing === undefined) {
		// 1×1 rather than 0×0: a zero-dimension canvas is not constructible, and the real
		// default (300×150) would hide a caller that forgot to size one.
		backing = createCanvas(1, 1);
		backings.set(el, backing);
	}
	return backing;
}

function installGlobals(): void {
	const globals = globalThis as unknown as Record<string, unknown>;
	globals.DOMMatrix ??= DOMMatrix;
	globals.Path2D ??= Path2D;
	globals.ImageData ??= ImageData;
}

/**
 * `drawImage` is the one call whose ARGUMENT is a DOM node, and the rasterizer refuses one:
 * a jsdom `<img>` holds no pixels and a jsdom `<canvas>` is the empty shell this module's
 * header describes, so `@napi-rs/canvas` answers `Value is not one of these types` and
 * throws out of Konva's own draw — as an unhandled rejection, several frames from anything
 * a test can see.
 *
 * So the argument is swapped for the backing that DOES hold the pixels. That is what makes
 * a background raster genuinely drawn here rather than skipped, and it is the narrowest
 * possible intervention: one method, one argument, everything else untouched.
 */
function bridgeDrawImage(context: ReturnType<Canvas['getContext']>): unknown {
	const backed = (source: unknown): unknown => {
		if (source instanceof HTMLCanvasElement) return backings.get(source) ?? source;
		if (source instanceof HTMLImageElement) return decoded.get(source) ?? source;
		return source;
	};
	return new Proxy(context as object, {
		// `Reflect.get(target, property)` and deliberately NOT the three-argument form: the
		// context is a native object whose accessors require the real instance as `this`, and
		// passing the proxy as the receiver makes every one of them throw — which surfaces as
		// a Vue "error during execution of setup function" with nothing about canvases in it.
		get(target, property) {
			const value = Reflect.get(target, property) as unknown;
			if (typeof value !== 'function') return value;
			if (property !== 'drawImage') return value.bind(target);
			return (source: unknown, ...rest: unknown[]) =>
				(value as (...args: unknown[]) => unknown).call(target, backed(source), ...rest);
		},
		set(target, property, value) {
			// Written straight through to the real context, for the same reason: a proxy
			// holding its own `fillStyle` would leave the rasterizer painting in the last
			// colour anything actually set on it.
			Reflect.set(target, property, value);
			return true;
		},
	});
}

/**
 * `width`/`height` are intercepted as well as `getContext`, because setting either is how
 * Konva sizes its stage (`Canvas.setWidth` writes the element's width and then scales the
 * context it already holds) — a backing that did not follow would leave every Konva draw
 * clipped to 1×1 while every assertion about the element's own width passed.
 */
function installCanvasBacking(): void {
	const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;

	for (const dimension of ['width', 'height'] as const) {
		const original = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, dimension);
		Object.defineProperty(HTMLCanvasElement.prototype, dimension, {
			configurable: true,
			get(this: HTMLCanvasElement): number {
				return original?.get?.call(this) as number;
			},
			set(this: HTMLCanvasElement, value: number) {
				original?.set?.call(this, value);
				backingFor(this)[dimension] = Math.max(1, Math.floor(value));
			},
		});
	}

	proto.getContext = function (this: HTMLCanvasElement, kind: string): unknown {
		// Only '2d'. Konva asks for nothing else and pdf.js asks for nothing else, and a
		// fake that answered 'webgl' with something would be inventing a capability neither
		// the plugin nor Obsidian's renderer is being tested against.
		if (kind !== '2d') return null;
		return bridgeDrawImage(backingFor(this).getContext('2d'));
	};
}

/**
 * `decode()` is what `loadBackground` awaits, so it is what has to be real. It resolves
 * ONLY for a registered URL holding bytes a real decoder accepts, and rejects otherwise —
 * which is what makes the `unavailable`/`unreadable` arm reachable by a test instead of
 * being an arm nothing can take.
 */
function installImageDecoding(): void {
	const proto = HTMLImageElement.prototype as unknown as Record<string, unknown>;

	proto.decode = async function (this: HTMLImageElement): Promise<void> {
		const bytes = resources.get(this.src);
		if (bytes === undefined) {
			throw new Error(`No registered resource for ${this.src}`);
		}
		if (deferred.has(this.src)) {
			await new Promise<void>((resolve) => {
				deferred.set(this.src, resolve);
			});
		}
		const image = await loadImage(Buffer.from(bytes));
		// Kept, so `drawImage` can be handed the thing that actually holds pixels; see
		// `bridgeDrawImage`.
		decoded.set(this, image);
		// jsdom's naturalWidth/naturalHeight are getters over an image it never loaded, so
		// the decoded size is written onto the instance. Own properties shadow the prototype
		// getters; nothing else about the element changes.
		Object.defineProperty(this, 'naturalWidth', { value: image.width, configurable: true });
		Object.defineProperty(this, 'naturalHeight', { value: image.height, configurable: true });
	};
}

export function installCanvas(): void {
	const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
	if (proto.__canvasBackingInstalled) return;
	proto.__canvasBackingInstalled = true;

	installGlobals();
	installCanvasBacking();
	installImageDecoding();
}
