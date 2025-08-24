import {
  sanitizeText,
  validateMemoryContent,
  validateNamespace,
  validateLabels,
  validateSearchQuery
} from '../validation'

describe('sanitizeText', () => {
  it('should trim whitespace', () => {
    expect(sanitizeText('  hello world  ')).toBe('hello world')
  })

  it('should replace multiple spaces with single space', () => {
    expect(sanitizeText('hello    world')).toBe('hello world')
  })

  it('should remove HTML tags', () => {
    expect(sanitizeText('hello <script>alert("hack")</script> world')).toBe('hello alert("hack") world')
  })

  it('should limit length to 10000 characters', () => {
    const longText = 'a'.repeat(15000)
    expect(sanitizeText(longText)).toHaveLength(10000)
  })

  it('should handle empty string', () => {
    expect(sanitizeText('')).toBe('')
  })
})

describe('validateMemoryContent', () => {
  it('should accept valid content', () => {
    expect(validateMemoryContent('This is a valid memory content')).toBeNull()
  })

  it('should reject empty content', () => {
    expect(validateMemoryContent('')).toBe('Memory content is required')
    expect(validateMemoryContent('   ')).toBe('Memory content is required')
  })

  it('should reject content that is too short', () => {
    expect(validateMemoryContent('hi')).toBe('Memory content must be at least 3 characters')
  })

  it('should reject content that is too long', () => {
    const longContent = 'a'.repeat(8001)
    expect(validateMemoryContent(longContent)).toBe('Memory content must be less than 8000 characters')
  })

  it('should accept content at boundary lengths', () => {
    expect(validateMemoryContent('abc')).toBeNull() // minimum length
    expect(validateMemoryContent('a'.repeat(8000))).toBeNull() // maximum length
  })
})

describe('validateNamespace', () => {
  it('should accept valid namespaces', () => {
    expect(validateNamespace('general')).toBeNull()
    expect(validateNamespace('work-projects')).toBeNull()
    expect(validateNamespace('test_namespace')).toBeNull()
    expect(validateNamespace('namespace123')).toBeNull()
  })

  it('should reject empty namespace', () => {
    expect(validateNamespace('')).toBe('Namespace is required')
    expect(validateNamespace('   ')).toBe('Namespace is required')
  })

  it('should reject namespace with invalid characters', () => {
    expect(validateNamespace('test space')).toBe('Namespace can only contain letters, numbers, hyphens, and underscores')
    expect(validateNamespace('test@namespace')).toBe('Namespace can only contain letters, numbers, hyphens, and underscores')
  })

  it('should reject namespace that is too long', () => {
    const longNamespace = 'a'.repeat(51)
    expect(validateNamespace(longNamespace)).toBe('Namespace must be less than 50 characters')
  })

  it('should accept namespace at boundary length', () => {
    const maxLengthNamespace = 'a'.repeat(50)
    expect(validateNamespace(maxLengthNamespace)).toBeNull()
  })
})

describe('validateLabels', () => {
  it('should accept empty labels', () => {
    expect(validateLabels('')).toBeNull()
    expect(validateLabels('   ')).toBeNull()
  })

  it('should accept valid labels', () => {
    expect(validateLabels('work, important, personal')).toBeNull()
    expect(validateLabels('single-label')).toBeNull()
    expect(validateLabels('label_with_underscores')).toBeNull()
  })

  it('should reject labels text that is too long', () => {
    const longLabels = 'a'.repeat(501)
    expect(validateLabels(longLabels)).toBe('Labels text must be less than 500 characters')
  })

  it('should reject too many labels', () => {
    const manyLabels = Array.from({ length: 21 }, (_, i) => `label${i}`).join(', ')
    expect(validateLabels(manyLabels)).toBe('Maximum 20 labels allowed')
  })

  it('should reject individual labels that are too long', () => {
    const longLabel = 'a'.repeat(51)
    expect(validateLabels(longLabel)).toBe('Each label must be less than 50 characters')
  })

  it('should reject labels with invalid characters', () => {
    expect(validateLabels('valid, invalid@label')).toBe('Labels can only contain letters, numbers, spaces, hyphens, and underscores')
  })

  it('should accept labels at boundary conditions', () => {
    const twentyLabels = Array.from({ length: 20 }, (_, i) => `label${i}`).join(', ')
    expect(validateLabels(twentyLabels)).toBeNull()
    
    const maxLengthLabel = 'a'.repeat(50)
    expect(validateLabels(maxLengthLabel)).toBeNull()
  })
})

describe('validateSearchQuery', () => {
  it('should accept empty query', () => {
    expect(validateSearchQuery('')).toBeNull()
    expect(validateSearchQuery('   ')).toBeNull()
  })

  it('should accept valid search queries', () => {
    expect(validateSearchQuery('search term')).toBeNull()
    expect(validateSearchQuery('complex search with multiple words')).toBeNull()
  })

  it('should reject query that is too long', () => {
    const longQuery = 'a'.repeat(201)
    expect(validateSearchQuery(longQuery)).toBe('Search query must be less than 200 characters')
  })

  it('should accept query at boundary length', () => {
    const maxLengthQuery = 'a'.repeat(200)
    expect(validateSearchQuery(maxLengthQuery)).toBeNull()
  })
})