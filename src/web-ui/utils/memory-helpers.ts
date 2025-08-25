/**
 * Utility functions for safely handling Memory object properties
 * that may be undefined, preventing TypeScript errors and improving UX
 */

import { Memory } from '../types/memory'

/**
 * Safely get memory namespace with fallback
 */
export function getMemoryNamespace(memory: Memory): string {
  return memory.namespace || 'general'
}

/**
 * Safely get memory content with fallback
 */
export function getMemoryContent(memory: Memory): string {
  return memory.content || ''
}

/**
 * Safely get memory content for display with fallback text
 */
export function getMemoryContentDisplay(memory: Memory): string {
  return memory.content || 'No content'
}

/**
 * Safely truncate memory content
 */
export function truncateMemoryContent(memory: Memory, maxLength: number = 200): string {
  const content = memory.content
  if (!content) return ''
  if (content.length <= maxLength) return content
  return content.substring(0, maxLength) + '...'
}

/**
 * Safely get memory labels with fallback to empty array
 */
export function getMemoryLabels(memory: Memory): string[] {
  return memory.labels || []
}

/**
 * Check if memory has labels
 */
export function hasMemoryLabels(memory: Memory): boolean {
  return memory.labels && memory.labels.length > 0
}

/**
 * Format memory date with safe handling
 */
export function formatMemoryDate(memory: Memory): string {
  if (!memory.createdAt) {
    return 'Unknown date'
  }
  
  // Handle both Date objects and ISO strings from API
  const date = memory.createdAt instanceof Date ? memory.createdAt : new Date(memory.createdAt)
  
  if (isNaN(date.getTime())) {
    return 'Invalid date'
  }
  
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

/**
 * Get memory date for grouping with safe handling
 */
export function getMemoryDateGroup(memory: Memory): string {
  const dateValue = memory.createdAt ? new Date(memory.createdAt) : new Date()
  return isNaN(dateValue.getTime()) ? 'Unknown Date' : dateValue.toDateString()
}

/**
 * Safely get memory ID with fallback
 */
export function getMemoryId(memory: Memory): string {
  return memory.id || `memory-${Date.now()}-${Math.random()}`
}