import type { Plugin } from 'vite';

/**
 * Declarations for the deliberately plain-JS module beside this file — the boundary is
 * typed ONCE here instead of un-typed per consumer: a pasted `@ts-expect-error` on every
 * import made each one fully `any`, so a renamed or reshaped export kept compiling and
 * failed at build time instead.
 */
export declare function assembledStyles(): Plugin;
