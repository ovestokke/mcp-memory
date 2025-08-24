'use client'

import { useState } from 'react'
import { MemoryFormData } from '../../types/memory'
import {
  validateMemoryContent,
  validateNamespace,
  validateLabels,
  sanitizeText,
} from '../../utils/validation'

interface MemoryFormProps {
  onSubmit: (data: MemoryFormData) => Promise<boolean>
  namespaces: string[]
  isSubmitting?: boolean
}

const DEFAULT_NAMESPACES = ['general', 'people', 'projects', 'relationships', 'recipes', 'notes']

export function MemoryForm({ onSubmit, namespaces, isSubmitting: externalSubmitting }: MemoryFormProps) {
  const [content, setContent] = useState('')
  const [namespace, setNamespace] = useState('general')
  const [labelsText, setLabelsText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<{
    content?: string
    namespace?: string
    labels?: string
  }>({})

  const allNamespaces = Array.from(new Set([...DEFAULT_NAMESPACES, ...namespaces])).sort()

  const validateForm = () => {
    const newErrors: typeof errors = {}

    const contentError = validateMemoryContent(content)
    if (contentError) newErrors.content = contentError

    const namespaceError = validateNamespace(namespace)
    if (namespaceError) newErrors.namespace = namespaceError

    const labelsError = validateLabels(labelsText)
    if (labelsError) newErrors.labels = labelsError

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)

    const sanitizedContent = sanitizeText(content)
    const sanitizedLabels = labelsText
      .split(',')
      .map((label) => sanitizeText(label))
      .filter((label) => label.length > 0)

    const success = await onSubmit({
      content: sanitizedContent,
      namespace: sanitizeText(namespace),
      labels: sanitizedLabels,
    })

    if (success) {
      setContent('')
      setLabelsText('')
      setNamespace('general')
      setErrors({})
    }

    setIsSubmitting(false)
  }

  const finalIsSubmitting = isSubmitting || externalSubmitting

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="memory-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Memory Content *
        </label>
        <textarea
          id="memory-content"
          value={content}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.currentTarget.value)}
          placeholder="What would you like to remember? Be specific and descriptive..."
          className={`w-full px-4 py-3 border rounded-xl shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors resize-none ${
            errors.content 
              ? 'border-red-300 dark:border-red-600' 
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
          rows={4}
          maxLength={8000}
          required
          disabled={finalIsSubmitting}
          aria-describedby={errors.content ? 'content-error' : 'content-help'}
          aria-invalid={errors.content ? 'true' : 'false'}
        />
        <div className="flex justify-between items-center mt-2">
          <p id="content-help" className="text-xs text-gray-500 dark:text-gray-400">
            {content.length}/8000 characters
          </p>
          {errors.content && (
            <p id="content-error" className="text-xs text-red-600 dark:text-red-400" role="alert">
              {errors.content}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="memory-namespace" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Collection
          </label>
          <select
            id="memory-namespace"
            value={namespace}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNamespace(e.currentTarget.value)}
            className={`w-full px-4 py-3 border rounded-xl shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors ${
              errors.namespace 
                ? 'border-red-300 dark:border-red-600' 
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
            disabled={finalIsSubmitting}
            aria-describedby={errors.namespace ? 'namespace-error' : undefined}
            aria-invalid={errors.namespace ? 'true' : 'false'}
          >
            {allNamespaces.map((ns) => (
              <option key={ns} value={ns}>
                {ns.charAt(0).toUpperCase() + ns.slice(1)}
              </option>
            ))}
          </select>
          {errors.namespace && (
            <p id="namespace-error" className="text-xs text-red-600 dark:text-red-400 mt-2" role="alert">
              {errors.namespace}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="memory-labels" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Labels (optional)
          </label>
          <input
            id="memory-labels"
            type="text"
            value={labelsText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLabelsText(e.currentTarget.value)}
            placeholder="work, important, personal"
            className={`w-full px-4 py-3 border rounded-xl shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors ${
              errors.labels 
                ? 'border-red-300 dark:border-red-600' 
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
            maxLength={500}
            disabled={finalIsSubmitting}
            aria-describedby={errors.labels ? 'labels-error' : undefined}
            aria-invalid={errors.labels ? 'true' : 'false'}
          />
          {errors.labels && (
            <p id="labels-error" className="text-xs text-red-600 dark:text-red-400 mt-2" role="alert">
              {errors.labels}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button 
          type="submit" 
          disabled={!content.trim() || finalIsSubmitting} 
          className="px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium rounded-xl shadow-sm focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors disabled:cursor-not-allowed"
        >
          {finalIsSubmitting ? (
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Adding Memory...</span>
            </div>
          ) : (
            'Add Memory'
          )}
        </button>
      </div>
    </form>
  )
}
