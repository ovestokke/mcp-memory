// Simple client-side logger for the web UI
export const clientLogger = {
  error: (message: string, context?: Record<string, any>) => {
    console.error('[ERROR]', message, context || {})
  },
  
  warn: (message: string, context?: Record<string, any>) => {
    console.warn('[WARN]', message, context || {})
  },
  
  info: (message: string, context?: Record<string, any>) => {
    console.info('[INFO]', message, context || {})
  },
  
  debug: (message: string, context?: Record<string, any>) => {
    console.debug('[DEBUG]', message, context || {})
  }
}