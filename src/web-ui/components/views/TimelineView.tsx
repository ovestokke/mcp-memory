'use client'

import { Memory, MemoryStats } from '../../types/memory'
import { MemoryCard } from '../memory/MemoryCard'
import { LoadingSpinner } from '../LoadingSpinner'
import { getMemoryDateGroup, getMemoryId } from '../../utils/memory-helpers'

interface TimelineViewProps {
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

export function TimelineView({
  memories,
  loading,
  error,
  onDeleteMemory,
  onRefresh
}: TimelineViewProps) {
  // Group memories by date
  const groupedMemories = memories.reduce((groups, memory) => {
    const date = getMemoryDateGroup(memory)
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(memory)
    return groups
  }, {} as Record<string, Memory[]>)

  const sortedDates = Object.keys(groupedMemories).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Memory Timeline
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              A chronological journey through your knowledge
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

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading timeline...</p>
          </div>
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-6 p-6 bg-gray-100 dark:bg-gray-800 rounded-full">
            <svg className="w-full h-full text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No memories yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Start adding memories to see your timeline unfold.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedDates.map((date, dateIndex) => (
            <div key={date} className="relative">
              {/* Timeline line */}
              {dateIndex < sortedDates.length - 1 && (
                <div className="absolute left-8 top-16 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
              )}
              
              {/* Date header */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="flex-shrink-0 w-16 h-16 bg-violet-100 dark:bg-violet-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {new Date(date).toLocaleDateString('en-US', { 
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {groupedMemories[date].length} {groupedMemories[date].length === 1 ? 'memory' : 'memories'}
                  </p>
                </div>
              </div>

              {/* Memories for this date */}
              <div className="ml-20 space-y-4">
                {groupedMemories[date].map((memory) => (
                  <MemoryCard
                    key={getMemoryId(memory)}
                    memory={memory}
                    onDelete={() => onDeleteMemory(memory.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}