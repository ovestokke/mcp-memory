'use client'

import { Memory, MemoryStats } from '../../types/memory'
import { MemoryCard } from '../memory/MemoryCard'
import { LoadingSpinner } from '../LoadingSpinner'
import { getMemoryNamespace, truncateMemoryContent, getMemoryId } from '../../utils/memory-helpers'

interface CollectionsViewProps {
  memories: Memory[]
  filteredMemories: Memory[]
  namespaces: string[]
  selectedNamespace: string
  searchQuery: string
  loading: boolean
  error: string
  stats: MemoryStats
  onNamespaceChange: (namespace: string) => void
  onSearch: (query: string) => void
  onDeleteMemory: (id: string) => Promise<void>
  onRefresh: () => void
}

export function CollectionsView({
  memories,
  namespaces,
  selectedNamespace,
  loading,
  error,
  onNamespaceChange,
  onDeleteMemory,
  onRefresh
}: CollectionsViewProps) {
  // Group memories by namespace
  const groupedMemories = memories.reduce((groups, memory) => {
    const namespace = getMemoryNamespace(memory)
    if (!groups[namespace]) {
      groups[namespace] = []
    }
    groups[namespace].push(memory)
    return groups
  }, {} as Record<string, Memory[]>)

  const getNamespaceIcon = (namespace: string) => {
    const icons = {
      'projects': '🚀',
      'relationships': '👥', 
      'ideas': '💡',
      'recipes': '🍳',
      'learning': '📚',
      'work': '💼',
      'personal': '👤',
      'travel': '✈️',
      'health': '🏥',
      'finance': '💰'
    }
    
    const key = namespace.toLowerCase()
    return icons[key as keyof typeof icons] || '📝'
  }

  const getNamespaceColor = (namespace: string) => {
    const colors = [
      'border-violet-200 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10',
      'border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10',
      'border-green-200 bg-green-50 dark:border-green-500/30 dark:bg-green-500/10',
      'border-yellow-200 bg-yellow-50 dark:border-yellow-500/30 dark:bg-yellow-500/10',
      'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10',
      'border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/10',
      'border-pink-200 bg-pink-50 dark:border-pink-500/30 dark:bg-pink-500/10',
      'border-teal-200 bg-teal-50 dark:border-teal-500/30 dark:bg-teal-500/10'
    ]
    
    let hash = 0
    for (let i = 0; i < namespace.length; i++) {
      const char = namespace.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    
    return colors[Math.abs(hash) % colors.length]
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Memory Collections
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Explore your knowledge organized by topic and context
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            title="Refresh memories"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 px-6 py-4 rounded-2xl">
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium">Something went wrong</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading collections...</p>
          </div>
        </div>
      ) : namespaces.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-6 p-6 bg-gray-100 dark:bg-gray-800 rounded-full">
            <svg className="w-full h-full text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No collections yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Create memories with different namespaces to organize your knowledge.
          </p>
        </div>
      ) : selectedNamespace === 'all' ? (
        // Collection overview
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {namespaces.map((namespace) => {
            const namespaceMemories = groupedMemories[namespace] || []
            const recentMemories = namespaceMemories
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 3)
            
            return (
              <div
                key={namespace}
                className={`border-2 rounded-2xl p-6 cursor-pointer hover:shadow-lg transition-all duration-200 ${getNamespaceColor(namespace)}`}
                onClick={() => onNamespaceChange(namespace)}
              >
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getNamespaceIcon(namespace)}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                        {namespace}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {namespaceMemories.length} {namespaceMemories.length === 1 ? 'memory' : 'memories'}
                      </p>
                    </div>
                  </div>
                  
                  {recentMemories.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Recent Memories
                      </p>
                      {recentMemories.map((memory) => (
                        <div key={getMemoryId(memory)} className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                          {truncateMemoryContent(memory, 80) || 'No content'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // Individual collection view
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => onNamespaceChange('all')}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              title="Back to all collections"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center space-x-3">
              <span className="text-3xl">{getNamespaceIcon(selectedNamespace)}</span>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                  {selectedNamespace}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {(groupedMemories[selectedNamespace] || []).length} memories in this collection
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {(groupedMemories[selectedNamespace] || []).map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onDelete={() => onDeleteMemory(memory.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}