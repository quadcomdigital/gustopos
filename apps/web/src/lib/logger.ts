type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  const prefix = `[${formatTimestamp()}] [${level.toUpperCase()}]`;
  if (level === 'debug') {
    console.debug(prefix, message, context ?? '');
  } else if (level === 'warn') {
    console.warn(prefix, message, context ?? '');
  } else if (level === 'error') {
    console.error(prefix, message, context ?? '');
  } else {
    console.info(prefix, message, context ?? '');
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),
};
