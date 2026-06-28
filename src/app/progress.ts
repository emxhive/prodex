import readline from "readline";

export interface ProgressReporter {
	start(stage: string, detail?: string): void;
	update(stage: string, detail?: string): void;
	complete(stage: string, detail?: string): void;
	warn(message: string): void;
	finish(): void;
}

export class ConsoleProgressReporter implements ProgressReporter {
	private isInteractive: boolean;
	private stream: NodeJS.WriteStream;
	private activeLine = false;
	private stage = "";
	private detail?: string;
	private startTime = 0;
	private timer: NodeJS.Timeout | null = null;
	private heartbeatInterval: number;

	constructor(options?: {
		isInteractive?: boolean;
		stream?: NodeJS.WriteStream;
		isCI?: boolean;
		heartbeatInterval?: number;
	}) {
		this.stream = options?.stream ?? (process.stderr as unknown as NodeJS.WriteStream);
		const isCI = options?.isCI ?? Boolean(process.env.CI || process.env.CONTINUOUS_INTEGRATION || process.env.GITHUB_ACTIONS);
		this.isInteractive = options?.isInteractive ?? ((this.stream as any).isTTY === true && !isCI);
		this.heartbeatInterval = options?.heartbeatInterval ?? 5000;
	}

	start(stage: string, detail?: string): void {
		this.stopTimer();
		this.stage = stage;
		this.detail = detail;
		this.startTime = Date.now();

		const formattedDetail = detail ? ` "${detail}"` : "";
		const msg = `Prodex: ${stage}${formattedDetail}...`;
		this.write(msg);

		this.startTimer();
	}

	update(stage: string, detail?: string): void {
		this.stopTimer();
		this.stage = stage;
		this.detail = detail;
		this.startTime = Date.now();

		const formattedDetail = detail ? ` "${detail}"` : "";
		const msg = `Prodex: ${stage}${formattedDetail}...`;
		this.write(msg);

		this.startTimer();
	}

	complete(stage: string, detail?: string): void {
		this.stopTimer();
		const formattedDetail = detail ? ` ${detail}` : "";
		const msg = `Prodex: ${stage}${formattedDetail}`;
		if (this.isInteractive) {
			readline.clearLine(this.stream, 0);
			readline.cursorTo(this.stream, 0);
			this.stream.write(`${msg}\n`);
			this.activeLine = false;
		} else {
			this.stream.write(`${msg}\n`);
		}
	}

	warn(message: string): void {
		this.stopTimer();
		const msg = `Prodex: warning: ${message}`;
		if (this.isInteractive) {
			readline.clearLine(this.stream, 0);
			readline.cursorTo(this.stream, 0);
			this.stream.write(`${msg}\n`);
			this.activeLine = false;
		} else {
			this.stream.write(`${msg}\n`);
		}
	}

	finish(): void {
		this.stopTimer();
		if (this.isInteractive && this.activeLine) {
			this.stream.write("\n");
			this.activeLine = false;
		}
	}

	private write(msg: string): void {
		if (this.isInteractive) {
			readline.clearLine(this.stream, 0);
			readline.cursorTo(this.stream, 0);
			this.stream.write(msg);
			this.activeLine = true;
		} else {
			this.stream.write(`${msg}\n`);
		}
	}

	private startTimer(): void {
		if (!this.isInteractive) return;
		this.timer = setInterval(() => {
			const elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);
			if (elapsedSec > 0) {
				const formattedDetail = this.detail ? ` "${this.detail}"` : "";
				const msg = `Prodex: ${this.stage}${formattedDetail}... ${elapsedSec}s`;
				readline.clearLine(this.stream, 0);
				readline.cursorTo(this.stream, 0);
				this.stream.write(msg);
			}
		}, this.heartbeatInterval);
		if (this.timer && typeof this.timer.unref === "function") {
			this.timer.unref();
		}
	}

	private stopTimer(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}
}

export class NoopProgressReporter implements ProgressReporter {
	start(stage: string, detail?: string): void {}
	update(stage: string, detail?: string): void {}
	complete(stage: string, detail?: string): void {}
	warn(message: string): void {}
	finish(): void {}
}
