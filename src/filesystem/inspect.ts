import util from "util";

export function inspectValue(value: unknown): string {
	return util.inspect(value, {
		colors: true,
		depth: null,
		breakLength: 150,
		compact: 3,
	});
}
