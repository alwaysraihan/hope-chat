/**
 * Hermes / React Native often omit `global.DOMException`, but `livekit-client` reads it at module load.
 * Install a minimal subclass before any LiveKit imports.
 */
const g = globalThis as typeof globalThis & {
  DOMException?: typeof DOMException;
};

if (typeof g.DOMException === 'undefined') {
  class DOMExceptionPolyfill extends Error {
    readonly code: number | undefined;

    constructor(message = '', name = 'Error') {
      super(message);
      this.name = name;
      Object.setPrototypeOf(this, DOMExceptionPolyfill.prototype);
    }
  }

  (g as { DOMException: typeof DOMException }).DOMException =
    DOMExceptionPolyfill as unknown as typeof DOMException;
}
