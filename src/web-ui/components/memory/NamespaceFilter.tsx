import { Memory } from '../../types/memory'

interface NamespaceFilterProps {
  memories: Memory[]
  selectedNamespace: string
  onNamespaceChange: (namespace: string) => void
}

export function NamespaceFilter({ memories, selectedNamespace, onNamespaceChange }: NamespaceFilterProps) {
  // Extract unique namespaces and count memories in each
  const namespaceCounts = memories.reduce((acc, memory) => {
    acc[memory.namespace] = (acc[memory.namespace] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const uniqueNamespaces = Object.keys(namespaceCounts).sort()
  const allNamespaces = ['all', ...uniqueNamespaces]

  return (
    <div>
      <label className="label mb-2">
        Filter by Namespace
      </label>
      <div className="flex flex-wrap gap-2">
        {allNamespaces.map((namespace) => (
          <button
            key={namespace}
            onClick={() => onNamespaceChange(namespace)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedNamespace === namespace
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-500'
            }`}
          >
            {namespace === 'all' ? `All (${memories.length})` : `${namespace.charAt(0).toUpperCase() + namespace.slice(1)} (${namespaceCounts[namespace] || 0})`}
          </button>
        ))}
      </div>
    </div>
  )
}