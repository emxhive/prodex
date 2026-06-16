import { spawn } from "child_process";
import type { CommandOutputResult } from "../types";

/**
 * Execute a single command sequentially using child_process.spawn.
 */
export async function executeAttachedCommand(
	command: string,
	cwd: string,
	timeoutSeconds: number
): Promise<CommandOutputResult> {
	const startTime = Date.now();
	let stdout = "";
	let stderr = "";
	let combinedOutput = "";
	let timedOut = false;
	let status: CommandOutputResult["status"] = "success";
	let errorMessage: string | undefined;

	return new Promise<CommandOutputResult>((resolve) => {
		const child = spawn(command, {
			shell: true,
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
			env: {
				...process.env,
				PAGER: "cat",
				GIT_PAGER: "cat",
				CI: process.env.CI ?? "1",
			},
			detached: process.platform !== "win32",
		});

		let timer: NodeJS.Timeout | undefined;
		if (timeoutSeconds > 0) {
			timer = setTimeout(() => {
				timedOut = true;
				status = "timed-out";
				if (child.pid) {
					if (process.platform === "win32") {
						spawn("taskkill", ["/pid", child.pid.toString(), "/t", "/f"], { stdio: "ignore" });
					} else {
						try {
							process.kill(-child.pid, "SIGTERM");
						} catch {}
						setTimeout(() => {
							try {
								process.kill(-child.pid!, "SIGKILL");
							} catch {}
						}, 2000);
					}
				}
			}, timeoutSeconds * 1000);
		}

		child.stdout?.on("data", (chunk) => {
			const str = chunk.toString();
			stdout += str;
			combinedOutput += str;
		});

		child.stderr?.on("data", (chunk) => {
			const str = chunk.toString();
			stderr += str;
			combinedOutput += str;
		});

		child.on("error", (err) => {
			if (timer) clearTimeout(timer);
			status = "error";
			errorMessage = err.message;
			resolve({
				command,
				cwd,
				status: "error",
				exitCode: null,
				signal: null,
				durationMs: Date.now() - startTime,
				timedOut: false,
				stdout,
				stderr,
				combinedOutput,
				errorMessage: err.message,
			});
		});

		child.on("close", (code, signal) => {
			if (timer) clearTimeout(timer);
			const durationMs = Date.now() - startTime;

			if (status === "timed-out") {
				resolve({
					command,
					cwd,
					status: "timed-out",
					exitCode: code,
					signal,
					durationMs,
					timedOut: true,
					stdout,
					stderr,
					combinedOutput,
				});
				return;
			}

			if (code !== 0) {
				status = "failed";
			}

			resolve({
				command,
				cwd,
				status,
				exitCode: code,
				signal,
				durationMs,
				timedOut: false,
				stdout,
				stderr,
				combinedOutput,
			});
		});
	});
}
