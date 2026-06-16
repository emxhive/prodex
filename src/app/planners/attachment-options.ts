import type { ProdexFlags, CommandAttachmentOptions } from "../../types";

export function parseCommandAttachmentOptions(flags: Partial<ProdexFlags>, errors: string[]): CommandAttachmentOptions | undefined {
	const commands = flags.cmd ?? [];
	const hasCmd = commands.length > 0;
	const hasTimeout = flags.cmdTimeout !== undefined && flags.cmdTimeout !== null;
	const hasFailOnError = flags.failOnCmdError !== undefined;

	// Reject command-specific flags when no command is provided
	if ((hasTimeout || hasFailOnError) && !hasCmd) {
		errors.push("Command attachment options (--cmd-timeout, --fail-on-cmd-error) require providing at least one command using --cmd.");
	}

	// Reject blank commands
	for (const cmd of commands) {
		if (!cmd.trim()) {
			errors.push("Command string specified via --cmd cannot be blank.");
		}
	}

	// Always validate timeout if specified
	let timeoutSeconds = 180;
	if (hasTimeout) {
		const val = flags.cmdTimeout;
		if (typeof val !== "number" || !Number.isFinite(val) || val <= 0) {
			errors.push("Flag --cmd-timeout expects a positive finite number.");
		} else {
			timeoutSeconds = val;
		}
	}

	if (commands.length === 0) {
		return undefined;
	}

	const failOnError = !!flags.failOnCmdError;

	return {
		commands,
		timeoutSeconds,
		failOnError,
	};
}
