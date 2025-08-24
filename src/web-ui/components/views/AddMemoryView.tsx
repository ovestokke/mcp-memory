'use client'

import { useState } from 'react'
import { MemoryForm } from '../memory/MemoryForm'
import { MemoryFormData } from '../../types/memory'

interface AddMemoryViewProps {
  namespaces: string[]
  onSubmit: (data: MemoryFormData) => Promise<boolean>
  error: string
  onSuccess: () => void
}

export function AddMemoryView({ namespaces, onSubmit, error, onSuccess }: AddMemoryViewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: MemoryFormData) => {
    setIsSubmitting(true)
    try {
      const success = await onSubmit(data)
      if (success) {
        onSuccess()
      }
      return success
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Capture New Memory
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Add new knowledge to your AI memory bank
          </p>
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
              <p className="font-medium">Failed to save memory</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Memory Details
          </h2>
          <MemoryForm
            onSubmit={handleSubmit}
            namespaces={namespaces}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>

      {/* Tips */}
      <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-violet-900 dark:text-violet-100 mb-4">
          💡 Tips for Better Memories
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-violet-800 dark:text-violet-200">
          <div className="space-y-2">
            <div className="flex items-start space-x-2">
              <span className="text-violet-600 dark:text-violet-400 font-bold">•</span>
              <span>Be specific and descriptive in your content</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-violet-600 dark:text-violet-400 font-bold">•</span>
              <span>Use meaningful namespaces to organize topics</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-start space-x-2">
              <span className="text-violet-600 dark:text-violet-400 font-bold">•</span>
              <span>Add relevant labels for better searchability</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-violet-600 dark:text-violet-400 font-bold">•</span>
              <span>Include context and connections to other concepts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}