type LogFn = (...args: any[]) => void;
export interface Logger {
	debug: LogFn;
	info: LogFn;
	warn: LogFn;
	error: LogFn;
	log: LogFn;
}

export type QuestionSet<T = any> = ReadonlyArray<Record<string, any>> | Record<string, any>;
