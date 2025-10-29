/**
 * Global augmentations only.
 * Keep this file minimal and explicit.
 */
declare global {
  interface String {
    /** Normalizes backslashes to forward slashes. */
    norm(): string;
  }
}

export {};
