// API utilities for consistent error handling and response processing
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public response?: Response) {
    super(message)
    this.name = 'ApiError'
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`

    try {
      const errorData: unknown = await response.json()
      if (typeof errorData === 'object' && errorData !== null && 'error' in errorData) {
        const errVal = (errorData as { error?: unknown }).error
        if (typeof errVal === 'string') {
          errorMessage = errVal
        }
      }
    } catch {
      // Fallback to status text if JSON parsing fails
    }

    throw new ApiError(errorMessage, response.status, response)
  }

  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return await response.json()
  }

  // Handle non-JSON responses
  return (await response.text()) as T
}

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  }

  const mergedOptions = { ...defaultOptions, ...options }

  try {
    const response = await fetch(url, mergedOptions)
    return await handleResponse<T>(response)
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    // Network or other errors
    throw new ApiError(error instanceof Error ? error.message : 'Network error occurred', 0)
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
