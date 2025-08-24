// Web UI specific types that adapt shared types for frontend use
export interface Memory {
  id: string
  content: string
  namespace: string
  labels: string[]
  createdAt: string  // String dates for JSON serialization
  updatedAt: string
}

export interface MemoryStats {
  total: number
  namespaces: number
  recentlyAdded: number
}

export interface MemoryFormData {
  content: string
  namespace: string
  labels: string[]
}

export interface SearchFormData {
  query: string
  namespace?: string
}