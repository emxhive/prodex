 type LogFn = (...args: any[]) => void;
export interface Logger {
  debug: LogFn;
  verbose: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  log: LogFn;
}
