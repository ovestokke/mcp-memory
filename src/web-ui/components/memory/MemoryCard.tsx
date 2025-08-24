'use client'

import { useState } from 'react'
import { Memory } from '../../types/memory'

interface MemoryCardProps {
  memory: Memory
  onDelete: () => Promise<void>
}

export function MemoryCard({ memory, onDelete }: MemoryCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showFullContent, setShowFullContent] = useState(false)

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this memory?')) {
      setIsDeleting(true)
      try {
        await onDelete()
      } catch (error) {
        console.error('Failed to delete memory:', error)
      }
      setIsDeleting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString))
  }

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  const getNamespaceColor = (namespace: string) => {
    const colors = [
      'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
      'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
      'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300',
      'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
      'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300',
      'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300'
    ]
    
    // Simple hash function to consistently assign colors
    let hash = 0
    for (let i = 0; i < namespace.length; i++) {
      const char = namespace.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    return colors[Math.abs(hash) % colors.length]
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 hover:shadow-lg dark:hover:shadow-gray-900/25 transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getNamespaceColor(memory.namespace)}`}>
            {memory.namespace}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {formatDate(memory.createdAt)}
          </span>
        </div>
        
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"
          title="Delete memory"
        >
          {isDeleting ? (
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4">
        <div className="prose dark:prose-invert max-w-none">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {showFullContent ? memory.content : truncateContent(memory.content)}
            {memory.content.length > 200 && (
              <button
                onClick={() => setShowFullContent(!showFullContent)}
                className="ml-2 text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium text-sm transition-colors"
              >
                {showFullContent ? 'Show less' : 'Show more'}
              </button>
            )}
          </p>
        </div>

        {/* Labels */}
        {memory.labels.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <div className="flex flex-wrap gap-1">
                {memory.labels.map((label, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-xs"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}