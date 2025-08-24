'use client'

import { useState, useEffect } from 'react'
import { Memory, MemoryStats, MemoryFormData } from '../types/memory'
import { isApiError } from '../utils/api'
import { clientLogger } from '../utils/logger'
import { memoryApi } from '../lib/api-client'
import { useAuth } from '../contexts/AuthContext'
import { LoginForm } from '../components/auth/LoginForm'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { Sidebar } from '../components/navigation/Sidebar'
import { ExploreView } from '../components/views/ExploreView'
import { TimelineView } from '../components/views/TimelineView'
import { CollectionsView } from '../components/views/CollectionsView'
import { AddMemoryView } from '../components/views/AddMemoryView'

export default function Home() {
  const { user, loading: authLoading } = useAuth()
  const [currentView, setCurrentView] = useState('explore')
  const [memories, setMemories] = useState<Memory[]>([])
  const [filteredMemories, setFilteredMemories] = useState<Memory[]>([])
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [stats, setStats] = useState<MemoryStats>({
    total: 0,
    namespaces: 0,
    recentlyAdded: 0
  })

  // Load memories on component mount
  useEffect(() => {
    if (user) {
      loadMemories()
    }
  }, [user])

  // Update filtered memories when filters change
  useEffect(() => {
    filterMemories()
  }, [memories, selectedNamespace, searchQuery])

  // Calculate stats when memories change
  useEffect(() => {
    calculateStats()
  }, [memories])

  const loadMemories = async () => {
    setLoading(true)
    setError('')
    try {
      const memories = await memoryApi.getMemories()
      setMemories(memories)
      
      // Extract unique namespaces
      const uniqueNamespaces = Array.from(
        new Set(memories.map((m: Memory) => m.namespace))
      ).sort()
      setNamespaces(uniqueNamespaces)
    } catch (err) {
      if (isApiError(err)) {
        setError(`Failed to load memories: ${err.message}`)
      } else {
        setError('An unexpected error occurred while loading memories')
      }
    } finally {
      setLoading(false)
    }
  }

  const filterMemories = () => {
    let filtered = memories

    // Filter by namespace
    if (selectedNamespace !== 'all') {
      filtered = filtered.filter(m => m.namespace === selectedNamespace)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(m => 
        m.content.toLowerCase().includes(query) ||
        m.labels.some(label => label.toLowerCase().includes(query))
      )
    }

    setFilteredMemories(filtered)
  }

  const calculateStats = () => {
    const uniqueNamespaces = new Set(memories.map(m => m.namespace)).size
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const recentlyAdded = memories.filter(m => 
      new Date(m.createdAt) > oneDayAgo
    ).length

    setStats({
      total: memories.length,
      namespaces: uniqueNamespaces,
      recentlyAdded
    })
  }

  const handleAddMemory = async (memoryData: MemoryFormData) => {
    setError('')
    try {
      await memoryApi.createMemory(memoryData)
      await loadMemories()
      return true
    } catch (err) {
      if (isApiError(err)) {
        setError(`Failed to add memory: ${err.message}`)
      } else {
        setError('An unexpected error occurred while adding memory')
      }
      return false
    }
  }

  const handleDeleteMemory = async (memoryId: string) => {
    setError('')
    try {
      await memoryApi.deleteMemory(memoryId)
      setMemories(memories.filter(m => m.id !== memoryId))
    } catch (err) {
      if (isApiError(err)) {
        setError(`Failed to delete memory: ${err.message}`)
      } else {
        setError('An unexpected error occurred while deleting memory')
      }
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    
    if (query.trim()) {
      setLoading(true)
      try {
        const results = await memoryApi.searchMemories(
          query,
          selectedNamespace !== 'all' ? selectedNamespace : undefined
        )
        setFilteredMemories(results)
      } catch (err) {
        clientLogger.warn('Semantic search failed, using local search', { error: err, query })
        filterMemories()
      } finally {
        setLoading(false)
      }
    }
  }

  const renderCurrentView = () => {
    const commonProps = {
      memories,
      filteredMemories,
      namespaces,
      selectedNamespace,
      searchQuery,
      loading,
      error,
      stats,
      onNamespaceChange: setSelectedNamespace,
      onSearch: handleSearch,
      onDeleteMemory: handleDeleteMemory,
      onRefresh: loadMemories
    }

    switch (currentView) {
      case 'explore':
        return <ExploreView {...commonProps} />
      case 'timeline':
        return <TimelineView {...commonProps} />
      case 'namespaces':
        return <CollectionsView {...commonProps} />
      case 'add':
        return (
          <AddMemoryView
            namespaces={namespaces}
            onSubmit={handleAddMemory}
            error={error}
            onSuccess={() => setCurrentView('explore')}
          />
        )
      default:
        return <ExploreView {...commonProps} />
    }
  }

  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Connecting to your memory...</p>
        </div>
      </div>
    )
  }

  // Show login form if not authenticated
  if (!user) {
    return <LoginForm />
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8">
          {renderCurrentView()}
        </div>
      </main>
    </div>
  )
}