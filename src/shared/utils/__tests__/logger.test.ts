import { logger } from '../logger'

// Mock console methods to capture calls
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}

// Replace global console
const originalConsole = global.console
global.console = mockConsole as any

describe.skip('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2023-01-01T12:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  afterAll(() => {
    global.console = originalConsole
  })

  describe('basic logging methods', () => {
    it('should log info messages', () => {
      logger.info('Test info message')

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringMatching(/"level":"info".*"message":"Test info message"/)
      )
    })

    it('should log error messages', () => {
      logger.error('Test error message')

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        'Test error message'
      )
    })

    it('should log warn messages', () => {
      logger.warn('Test warning message')

      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]'),
        'Test warning message'
      )
    })

    it('should log debug messages', () => {
      logger.debug('Test debug message')

      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]'),
        'Test debug message'
      )
    })
  })

  describe('logging with context', () => {
    it('should log with additional context', () => {
      const context = { userId: 'test-user', operation: 'storeMemory' }

      logger.info('Operation started', context)

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        'Operation started',
        context
      )
    })

    it('should log error with error object', () => {
      const error = new Error('Test error')
      const context = { userId: 'test-user' }

      logger.error('Operation failed', { error, ...context })

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        'Operation failed',
        { error, ...context }
      )
    })
  })

  describe('withContext method', () => {
    it('should create logger with persistent context', () => {
      const contextLogger = logger.withContext({ userId: 'test-user', operation: 'test' })

      contextLogger.info('Test message')

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        'Test message',
        { userId: 'test-user', operation: 'test' }
      )
    })

    it('should merge context with additional context', () => {
      const contextLogger = logger.withContext({ userId: 'test-user' })

      contextLogger.warn('Warning message', { operation: 'delete', memoryId: '123' })

      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]'),
        'Warning message',
        { userId: 'test-user', operation: 'delete', memoryId: '123' }
      )
    })

    it('should allow chaining withContext calls', () => {
      const contextLogger = logger
        .withContext({ userId: 'test-user' })
        .withContext({ operation: 'search' })

      contextLogger.debug('Search started')

      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]'),
        'Search started',
        { userId: 'test-user', operation: 'search' }
      )
    })
  })

  describe('time method', () => {
    it('should measure execution time of synchronous function', () => {
      const result = logger.time('test operation', () => {
        // Simulate some work
        return 'test result'
      })

      expect(result).toBe('test result')
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.stringMatching(/test operation completed in \d+ms/)
      )
    })

    it('should measure execution time of async function', async () => {
      const result = await logger.time('async operation', async () => {
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 100))
        return 'async result'
      })

      expect(result).toBe('async result')
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.stringMatching(/async operation completed in \d+ms/)
      )
    })

    it('should handle errors in timed functions', () => {
      expect(() => {
        logger.time('failing operation', () => {
          throw new Error('Test error')
        })
      }).toThrow('Test error')

      // The timing log should still happen even when error is thrown
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.stringMatching(/failing operation completed in \d+ms/)
      )
    })

    it('should handle async errors in timed functions', async () => {
      await expect(
        logger.time('failing async operation', async () => {
          throw new Error('Async test error')
        })
      ).rejects.toThrow('Async test error')

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.stringMatching(/failing async operation completed in \d+ms/)
      )
    })
  })

  describe('time method with context', () => {
    it('should work with context logger', () => {
      const contextLogger = logger.withContext({ userId: 'test-user' })

      const result = contextLogger.time('context operation', () => {
        return 'context result'
      })

      expect(result).toBe('context result')
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.stringMatching(/context operation completed in \d+ms/),
        { userId: 'test-user' }
      )
    })
  })

  describe('timestamp formatting', () => {
    it('should include ISO timestamp in log messages', () => {
      logger.info('Test message')

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('2023-01-01T12:00:00.000Z'),
        'Test message'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle undefined context', () => {
      logger.info('Test message', undefined)

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        'Test message',
        undefined
      )
    })

    it('should handle null context', () => {
      logger.error('Error message', null)

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        'Error message',
        null
      )
    })

    it('should handle empty context object', () => {
      logger.warn('Warning message', {})

      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]'),
        'Warning message',
        {}
      )
    })

    it('should handle complex context objects', () => {
      const complexContext = {
        user: { id: 'test-user', name: 'Test User' },
        memory: { id: 'memory-123', content: 'Test content' },
        metadata: { tags: ['test', 'complex'], timestamp: new Date() },
      }

      logger.debug('Complex context message', complexContext)

      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]'),
        'Complex context message',
        complexContext
      )
    })
  })
})