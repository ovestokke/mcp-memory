'use client'

import { Memory, MemoryStats } from '../../types/memory'
import { SearchForm } from '../memory/SearchForm'
import { MemoryCard } from '../memory/MemoryCard'
import { LoadingSpinner } from '../LoadingSpinner'

interface ExploreViewProps {
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

export function ExploreView({
  memories,
  filteredMemories,
  namespaces,
  selectedNamespace,
  searchQuery,
  loading,
  error,
  stats,
  onNamespaceChange,
  onSearch,
  onDeleteMemory,
  onRefresh
}: ExploreViewProps) {
  const hasSearchQuery = searchQuery.trim().length > 0
  const displayMemories = hasSearchQuery ? filteredMemories : memories

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Explore Your Memory
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Discover insights from your AI conversations and knowledge base
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

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-violet-100 dark:bg-violet-500/20 rounded-xl">
                <svg className="w-6 h-6 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Total Memories</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-500/20 rounded-xl">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.namespaces}</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Collections</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-green-100 dark:bg-green-500/20 rounded-xl">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.recentlyAdded}</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Added Today</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Search Your Knowledge
          </h2>
          <SearchForm onSearch={onSearch} placeholder="What are you looking for?" />
        </div>
      </div>

      {/* Collection Filter */}
      {namespaces.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onNamespaceChange('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedNamespace === 'all'
                ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            All Collections
          </button>
          {namespaces.map((namespace, index) => (
            <button
              key={`${namespace}-${index}`}
              onClick={() => onNamespaceChange(namespace)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedNamespace === namespace
                  ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {namespace}
            </button>
          ))}
        </div>
      )}

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

      {/* Results */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                {hasSearchQuery ? 'Searching your memories...' : 'Loading memories...'}
              </p>
            </div>
          </div>
        ) : displayMemories.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-6 p-6 bg-gray-100 dark:bg-gray-800 rounded-full">
              <svg className="w-full h-full text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {hasSearchQuery ? 'No matches found' : 'No memories yet'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {hasSearchQuery 
                ? 'Try adjusting your search terms or explore different collections.' 
                : 'Start by adding your first memory to begin building your knowledge base.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {hasSearchQuery ? 'Search Results' : 'Recent Memories'}
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({displayMemories.length} {displayMemories.length === 1 ? 'memory' : 'memories'})
                </span>
              </h3>
            </div>
            
            <div className="grid gap-4">
              {displayMemories.map((memory, index) => (
                <MemoryCard
                  key={memory.id || `memory-${index}`}
                  memory={memory}
                  onDelete={() => onDeleteMemory(memory.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}