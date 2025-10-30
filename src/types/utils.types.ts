 type LogFn = (...args: any[]) => void;
export interface Logger {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  log: LogFn;
}
