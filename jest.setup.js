import '@testing-library/jest-dom'

// Mock fetch for testing
global.fetch = jest.fn()

// Mock crypto.randomUUID for tests
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
  },
  writable: true
})

// Mock Headers for proper header handling
class MockHeaders extends Map {
  constructor(init) {
    super()
    if (init) {
      Object.entries(init).forEach(([key, value]) => {
        this.set(key.toLowerCase(), value)
      })
    }
  }
  
  get(name) {
    return super.get(name?.toLowerCase())
  }
  
  set(name, value) {
    return super.set(name?.toLowerCase(), value)
  }
  
  has(name) {
    return super.has(name?.toLowerCase())
  }
}

if (typeof Headers === 'undefined') {
  global.Headers = MockHeaders
}

// Mock Web APIs for Cloudflare Workers environment
if (typeof Response === 'undefined') {
  global.Response = class MockResponse {
    constructor(body, init) {
      this.body = body
      this.status = init?.status || 200
      this.headers = new MockHeaders(init?.headers || {})
      this.ok = this.status >= 200 && this.status < 300
    }
    
    async text() {
      return typeof this.body === 'string' ? this.body : JSON.stringify(this.body)
    }
    
    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
    }
  }
}

if (typeof Request === 'undefined') {
  global.Request = class MockRequest {
    constructor(url, init) {
      this.url = url
      this.method = init?.method || 'GET'
      this.headers = new MockHeaders(init?.headers || {})
      this.body = init?.body
    }
    
    async json() {
      return JSON.parse(this.body)
    }
  }
}

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}