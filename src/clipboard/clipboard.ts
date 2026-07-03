import { spawn as defaultSpawn } from "child_process";
import fs from "fs";
import path from "path";

type SpawnFn = typeof defaultSpawn;

export type ClipCandidate = { bin: string; args: string[] };

export type ClipboardDeps = {
	platform?: NodeJS.Platform;
	env?: NodeJS.ProcessEnv;
	spawn?: SpawnFn;
};

export async function copyFileToClipboard(
	filePath: string,
	deps: ClipboardDeps = {}
): Promise<{ ok: true } | { ok: false; warning: string }> {
	const platform = deps.platform ?? process.platform;
	const env = deps.env ?? process.env;
	const spawnFn = deps.spawn ?? defaultSpawn;

	// Validate/resolve the file path
	let absolutePath = "";
	try {
		absolutePath = path.resolve(filePath);
		if (!fs.existsSync(absolutePath)) {
			return { ok: false, warning: `target file does not exist: ${filePath}` };
		}
	} catch (err: any) {
		return { ok: false, warning: `invalid file path: ${err.message || String(err)}` };
	}

	const candidates = resolveClipboardCandidates(absolutePath, platform, env);
	if (!candidates) {
		return { ok: false, warning: "file clipboard copy is not supported on this platform yet" };
	}

	let lastError: string | undefined;
	for (const candidate of candidates) {
		const res = await tryCandidate(candidate, spawnFn);
		if (res.ok) {
			return { ok: true };
		}
		lastError = res.error;
	}

	return { ok: false, warning: `clipboard write failed (${lastError ?? "unknown error"})` };
}

export function resolveClipboardCandidates(
	filePath: string,
	platform: NodeJS.Platform = process.platform,
	env: NodeJS.ProcessEnv = process.env
): ClipCandidate[] | null {
	if (platform === "win32") {
		return [
			{
				bin: "powershell.exe",
				args: [
					"-NoProfile",
					"-NonInteractive",
					"-Command",
					"& { Set-Clipboard -LiteralPath $args[0] }",
					filePath
				]
			}
		];
	}
	return null;
}

function tryCandidate(
	candidate: ClipCandidate,
	spawnFn: SpawnFn
): Promise<{ ok: boolean; error?: string }> {
	return new Promise((resolve) => {
		let settled = false;

		const child = spawnFn(candidate.bin, candidate.args, {
			stdio: "ignore",
			windowsHide: true
		});

		function finish(result: { ok: boolean; error?: string }, cleanup = false) {
			if (settled) return;
			settled = true;

			if (cleanup) {
				try {
					if (child.pid && !child.killed) {
						child.kill();
					}
				} catch {}
			}

			resolve(result);
		}

		child.on("error", (err) => {
			finish({ ok: false, error: err.message }, true);
		});

		child.on("close", (code) => {
			if (code === 0) {
				finish({ ok: true }, false);
			} else {
				finish({ ok: false, error: `process exited with code ${code}` }, false);
			}
		});
	});
}
