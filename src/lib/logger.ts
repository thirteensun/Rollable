type LogLevel = 'info' | 'warn' | 'error'

function log(level: LogLevel, context: string, message: string, data?: unknown) {
  const entry = {
    level,
    context,
    message,
    ...(data !== undefined ? { data } : {}),
    ts: new Date().toISOString(),
  }
  if (level === 'error') console.error(JSON.stringify(entry))
  else if (level === 'warn') console.warn(JSON.stringify(entry))
  else console.log(JSON.stringify(entry))
}

export const logger = {
  info: (context: string, message: string, data?: unknown) => log('info', context, message, data),
  warn: (context: string, message: string, data?: unknown) => log('warn', context, message, data),
  error: (context: string, message: string, data?: unknown) => log('error', context, message, data),
}
