'use client'

import { useState } from 'react'
import { Memory } from '../../types/memory'
import { LoadingSpinner } from '../LoadingSpinner'
import { getMemoryNamespace, getMemoryContentDisplay, formatMemoryDate, hasMemoryLabels, getMemoryLabels, getMemoryId, getMemoryContent } from '../../utils/memory-helpers'

interface MemoryListProps {
  memories: Memory[]
  loading: boolean
  onDelete: (id: string) => Promise<void>
}

export function MemoryList({ memories, loading, onDelete }: MemoryListProps) {
  const [deletingId, setDeletingId] = useState<string>('')

  const handleDelete = async (id: string) => {
    if (!(globalThis as any).confirm('Are you sure you want to delete this memory?')) return

    setDeletingId(id)
    try {
      await onDelete(id)
    } finally {
      setDeletingId('')
    }
  }


  if (loading) {
    return (
      <div className="p-8 text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-2 text-gray-600 dark:text-gray-400">Loading memories...</p>
      </div>
    )
  }

  if (memories.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-gray-400 text-4xl mb-4">🧠</div>
        <p className="text-gray-600 dark:text-gray-400 mb-2">No memories found</p>
        <p className="text-sm text-gray-500">Add your first memory above to get started</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {memories.map((memory) => (
        <div key={getMemoryId(memory)} className="p-6 hover:bg-gray-50 dark:hover:bg-slate-750 transition-colors">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400">
                {getMemoryNamespace(memory)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{formatMemoryDate(memory)}</span>
            </div>
            <button
              onClick={() => handleDelete(memory.id)}
              disabled={deletingId === memory.id}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
              aria-label={`Delete memory: ${getMemoryContent(memory).substring(0, 50)}...`}
            >
              {deletingId === memory.id ? (
                <LoadingSpinner size="sm" className="border-red-300 border-t-red-600" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              )}
            </button>
          </div>

          <p className="text-gray-900 dark:text-white mb-3 leading-relaxed">{getMemoryContentDisplay(memory)}</p>

          {hasMemoryLabels(memory) && (
            <div className="flex flex-wrap gap-1">
              {getMemoryLabels(memory).map((label, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-gray-300"
                >
                  #{label}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
