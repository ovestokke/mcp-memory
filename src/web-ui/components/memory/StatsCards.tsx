import { MemoryStats } from '../../types/memory'

interface StatsCardsProps {
  stats: MemoryStats
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border p-6">
        <div className="flex items-center">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <span className="text-blue-600 dark:text-blue-400 text-xl">🧠</span>
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Memories
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.total}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border p-6">
        <div className="flex items-center">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
            <span className="text-purple-600 dark:text-purple-400 text-xl">📂</span>
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Namespaces
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.namespaces}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border p-6">
        <div className="flex items-center">
          <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
            <span className="text-green-600 dark:text-green-400 text-xl">✨</span>
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Added Today
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.recentlyAdded}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}