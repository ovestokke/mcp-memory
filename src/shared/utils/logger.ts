// Structured logger for consistent logging across the application
export interface LogContext {
  userId?: string
  requestId?: string
  memoryId?: string
  namespace?: string
  operation?: string
  duration?: number
  error?: string | Error | { name: string; message: string; stack?: string | undefined }
  [key: string]: any
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

class Logger {
  private context: LogContext = {}

  withContext(context: LogContext): Logger {
    const logger = new Logger()
    logger.context = { ...this.context, ...context }
    return logger
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context)
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context)
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context)
  }

  error(message: string, context?: LogContext) {
    this.log(LogLevel.ERROR, message, context)
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString()
    const logContext = { ...this.context, ...context }

    // Serialize error objects properly
    if (logContext.error instanceof Error) {
      logContext.error = {
        name: logContext.error.name,
        message: logContext.error.message,
        stack: logContext.error.stack,
      }
    }

    const logEntry = {
      timestamp,
      level,
      message,
      ...logContext,
    }

    // Use appropriate console method based on log level
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(JSON.stringify(logEntry))
        break
      case LogLevel.INFO:
        console.info(JSON.stringify(logEntry))
        break
      case LogLevel.WARN:
        console.warn(JSON.stringify(logEntry))
        break
      case LogLevel.ERROR:
        console.error(JSON.stringify(logEntry))
        break
    }
  }

  // Utility method for timing operations - sync version
  time<T>(operation: string, fn: () => T, context?: LogContext): T;
  // Utility method for timing operations - async version  
  time<T>(operation: string, fn: () => Promise<T>, context?: LogContext): Promise<T>;
  time<T>(operation: string, fn: () => T | Promise<T>, context?: LogContext): T | Promise<T> {
    const start = Date.now()
    const opLogger = this.withContext({ operation, ...context })

    opLogger.debug(`Starting ${operation}`)

    try {
      const result = fn()
      
      if (result instanceof Promise) {
        // Async case
        return result.then(
          (value) => {
            const duration = Date.now() - start
            opLogger.info(`Completed ${operation}`, { duration })
            return value
          },
          (error) => {
            const duration = Date.now() - start
            const normalizedError: LogContext['error'] =
              error instanceof Error
                ? error
                : typeof error === 'string'
                ? { name: 'Error', message: error }
                : { name: 'Error', message: JSON.stringify(error) }
            opLogger.error(`Failed ${operation}`, { error: normalizedError, duration })
            throw error
          }
        ) as Promise<T>
      } else {
        // Sync case
        const duration = Date.now() - start
        opLogger.info(`Completed ${operation}`, { duration })
        return result as T
      }
    } catch (error) {
      const duration = Date.now() - start
      const normalizedError: LogContext['error'] =
        error instanceof Error
          ? error
          : typeof error === 'string'
          ? { name: 'Error', message: error }
          : { name: 'Error', message: JSON.stringify(error) }
      opLogger.error(`Failed ${operation}`, { error: normalizedError, duration })
      throw error
    }
  }
}

export const logger = new Logger()
export default logger
