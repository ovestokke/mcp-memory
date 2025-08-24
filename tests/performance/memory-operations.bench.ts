// Performance benchmarks for memory operations
// This would be used with a benchmarking framework like Vitest bench or benchmark.js

import { validateMemoryContent, validateLabels, sanitizeText } from '../../src/web-ui/utils/validation'

// Mock data generators
const generateRandomContent = (length: number): string => {
  return 'a'.repeat(length)
}

const generateRandomLabels = (count: number): string => {
  return Array.from({ length: count }, (_, i) => `label${i}`).join(', ')
}

// Benchmark suite for validation functions
export const validationBenchmarks = {
  'sanitizeText - short content (100 chars)': () => {
    const content = 'Short content with    multiple   spaces and <script>tags</script>'
    return sanitizeText(content)
  },
  
  'sanitizeText - medium content (1000 chars)': () => {
    const content = generateRandomContent(1000) + '    <script>alert("test")</script>    '
    return sanitizeText(content)
  },
  
  'sanitizeText - long content (8000 chars)': () => {
    const content = generateRandomContent(8000) + '    <script>alert("test")</script>    '
    return sanitizeText(content)
  },
  
  'validateMemoryContent - valid content': () => {
    return validateMemoryContent('This is a valid memory content that should pass validation')
  },
  
  'validateMemoryContent - long content (7000 chars)': () => {
    const content = generateRandomContent(7000)
    return validateMemoryContent(content)
  },
  
  'validateLabels - few labels (5)': () => {
    const labels = generateRandomLabels(5)
    return validateLabels(labels)
  },
  
  'validateLabels - many labels (20)': () => {
    const labels = generateRandomLabels(20)
    return validateLabels(labels)
  }
}

// Benchmark configuration for different scenarios
export const performanceScenarios = {
  // Test with different memory counts
  memoryListRendering: {
    small: 10,
    medium: 100,
    large: 1000
  },
  
  // Test with different search query lengths
  searchPerformance: {
    shortQuery: 'test',
    mediumQuery: 'this is a medium length search query',
    longQuery: 'this is a much longer search query that might be used to find very specific memories with detailed information'
  },
  
  // Test with different content sizes
  memoryContentSizes: {
    small: 100,
    medium: 1000,
    large: 5000,
    xlarge: 8000
  }
}

// Performance thresholds (in milliseconds)
export const performanceThresholds = {
  validation: {
    sanitizeText: 5,
    validateMemoryContent: 2,
    validateLabels: 3
  },
  
  ui: {
    memoryFormSubmission: 100,
    memoryListRender: 50,
    searchExecution: 200
  },
  
  api: {
    createMemory: 500,
    listMemories: 300,
    searchMemories: 800,
    deleteMemory: 200
  }
}

// Simple benchmark runner (would be replaced with proper benchmarking framework)
export async function runBenchmark(name: string, fn: () => any, iterations: number = 1000): Promise<number> {
  const start = performance.now()
  
  for (let i = 0; i < iterations; i++) {
    fn()
  }
  
  const end = performance.now()
  const totalTime = end - start
  const avgTime = totalTime / iterations
  
  console.log(`Benchmark: ${name}`)
  console.log(`  Iterations: ${iterations}`)
  console.log(`  Total time: ${totalTime.toFixed(2)}ms`)
  console.log(`  Average time: ${avgTime.toFixed(4)}ms`)
  console.log(`  Operations per second: ${(1000 / avgTime).toFixed(0)}`)
  
  return avgTime
}

// Memory usage tracking
export function trackMemoryUsage(operation: () => void): { 
  before: number, 
  after: number, 
  delta: number 
} {
  // Force garbage collection if available (Node.js with --expose-gc flag)
  if (global.gc) {
    global.gc()
  }
  
  const before = process.memoryUsage().heapUsed
  
  operation()
  
  const after = process.memoryUsage().heapUsed
  
  return {
    before,
    after,
    delta: after - before
  }
}

// Bundle size analysis helper
export function analyzeBundleSize() {
  // This would integrate with webpack-bundle-analyzer or similar tools
  console.log('Bundle size analysis would go here')
  console.log('Use: npm run build:ui && npx webpack-bundle-analyzer .next/analyze/bundle.json')
}

// Performance test runner
export async function runPerformanceTests() {
  console.log('Running performance benchmarks...\n')
  
  const results: Record<string, number> = {}
  
  // Run validation benchmarks
  for (const [name, fn] of Object.entries(validationBenchmarks)) {
    results[name] = await runBenchmark(name, fn)
    console.log('')
  }
  
  // Check against thresholds
  console.log('Performance Threshold Analysis:')
  console.log('==============================')
  
  Object.entries(results).forEach(([name, avgTime]) => {
    const category = name.includes('sanitize') ? 'sanitizeText' :
                    name.includes('validateMemoryContent') ? 'validateMemoryContent' :
                    name.includes('validateLabels') ? 'validateLabels' : null
    
    if (category) {
      const threshold = performanceThresholds.validation[category as keyof typeof performanceThresholds.validation]
      const status = avgTime <= threshold ? '✅ PASS' : '❌ FAIL'
      console.log(`${name}: ${avgTime.toFixed(4)}ms (threshold: ${threshold}ms) ${status}`)
    }
  })
  
  return results
}

// Export for use in test files
export default {
  validationBenchmarks,
  performanceScenarios,
  performanceThresholds,
  runBenchmark,
  trackMemoryUsage,
  analyzeBundleSize,
  runPerformanceTests
}