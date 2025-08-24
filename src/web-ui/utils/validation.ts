// Validation utilities for user input
export function sanitizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/<[^>]*>/g, '') // Remove HTML tags entirely
    .substring(0, 10000) // Limit length
}

export function validateMemoryContent(content: string): string | null {
  const sanitized = sanitizeText(content)

  if (!sanitized || sanitized.length === 0) {
    return 'Memory content is required'
  }

  if (sanitized.length < 3) {
    return 'Memory content must be at least 3 characters'
  }

  if (sanitized.length > 8000) {
    return 'Memory content must be less than 8000 characters'
  }

  return null
}

export function validateNamespace(namespace: string): string | null {
  const sanitized = sanitizeText(namespace)

  if (!sanitized || sanitized.length === 0) {
    return 'Namespace is required'
  }

  if (!/^[a-zA-Z0-9-_]+$/.test(sanitized)) {
    return 'Namespace can only contain letters, numbers, hyphens, and underscores'
  }

  if (sanitized.length > 50) {
    return 'Namespace must be less than 50 characters'
  }

  return null
}

export function validateLabels(labelsText: string): string | null {
  if (!labelsText.trim()) return null // Labels are optional

  const sanitized = sanitizeText(labelsText)

  if (sanitized.length > 500) {
    return 'Labels text must be less than 500 characters'
  }

  const labels = sanitized
    .split(',')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (labels.length > 20) {
    return 'Maximum 20 labels allowed'
  }

  for (const label of labels) {
    if (label.length > 50) {
      return 'Each label must be less than 50 characters'
    }
    if (!/^[a-zA-Z0-9\s-_]+$/.test(label)) {
      return 'Labels can only contain letters, numbers, spaces, hyphens, and underscores'
    }
  }

  return null
}

export function validateSearchQuery(query: string): string | null {
  if (!query.trim()) return null // Empty queries are allowed

  const sanitized = sanitizeText(query)

  if (sanitized.length > 200) {
    return 'Search query must be less than 200 characters'
  }

  return null
}
