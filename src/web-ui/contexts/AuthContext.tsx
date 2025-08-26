'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { clientLogger } from '../utils/logger'
import { setAuthErrorHandler } from '../lib/api-client'

export interface User {
  id: string
  email: string
  name?: string | null
  picture?: string | null
}

export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'AuthError'
  }
}

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

interface AuthContextValue extends AuthState {
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { data: session, status } = useSession()
  const [error, setError] = useState<string | null>(null)

  const user: User | null = session?.user ? {
    id: session.user.id || '',
    email: session.user.email || '',
    name: session.user.name,
    picture: session.user.image
  } : null

  const loading = status === 'loading'

  // Set up automatic logout on 401 errors
  useEffect(() => {
    const handleAuthError = () => {
      clientLogger.warn('Authentication error detected, logging out user')
      signOut({ redirect: false }).catch((err) => {
        clientLogger.error('Failed to sign out after auth error', { error: err })
      })
    }

    setAuthErrorHandler(handleAuthError)
  }, [])

  const loginWithGoogle = async () => {
    try {
      setError(null)
      const result = await signIn('google', { redirect: false })
      
      if (result?.error) {
        throw new AuthError('Google login failed', 'GOOGLE_LOGIN_FAILED')
      }
      
      clientLogger.info('User logged in successfully with Google')
    } catch (error) {
      const message = error instanceof AuthError ? error.message : 'Google login failed'
      setError(message)
      
      clientLogger.error('Google login failed', { error })
      throw error
    }
  }

  const logout = async () => {
    try {
      setError(null)
      await signOut({ redirect: false })
      
      clientLogger.info('User logged out successfully')
    } catch (error) {
      const message = 'Logout failed'
      setError(message)
      
      clientLogger.error('Logout failed', { error })
      throw new AuthError(message, 'LOGOUT_FAILED')
    }
  }

  const clearError = () => {
    setError(null)
  }

  const value: AuthContextValue = {
    user,
    loading,
    error,
    loginWithGoogle,
    logout,
    clearError
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Hook for components that require authentication
export function useRequireAuth(): AuthContextValue {
  const auth = useAuth()
  
  useEffect(() => {
    if (!auth.loading && !auth.user) {
      // Could redirect to login page here
      console.warn('Authentication required')
    }
  }, [auth.loading, auth.user])
  
  return auth
}