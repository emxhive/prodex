/**
 * Global augmentations only.
 * Keep this file minimal and explicit.
 */
declare global {
	interface String {
		/** Normalizes backslashes to forward slashes. */
		norm(): string;

		/**Clean strings to remove invalid character */
		clean(): string;
	}

	var _2j: (obj: any) => string;

	var _bpt: (params: any) => any;
}

export {};
