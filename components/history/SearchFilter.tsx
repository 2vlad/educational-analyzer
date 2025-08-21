'use client'

import { useState, useEffect } from 'react'
import { Search, Calendar, Filter, X } from 'lucide-react'
import { format } from 'date-fns'

interface SearchFilterProps {
  search: string
  onSearchChange: (search: string) => void
  dateRange: { start?: Date; end?: Date }
  onDateRangeChange: (range: { start?: Date; end?: Date }) => void
  selectedModel: string
  onModelChange: (model: string) => void
  onApply: () => void
}

export default function SearchFilter({
  search,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  selectedModel,
  onModelChange,
  onApply,
}: SearchFilterProps) {
  const [localSearch, setLocalSearch] = useState(search)
  const [showFilters, setShowFilters] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout>()

  // Available models (could be fetched from API)
  const models = [
    { value: '', label: 'All Models' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'gpt-4o', label: 'GPT-4' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'yandex-gpt', label: 'YandexGPT' },
  ]

  // Debounced search
  useEffect(() => {
    if (debounceTimer) clearTimeout(debounceTimer)

    const timer = setTimeout(() => {
      if (localSearch !== search) {
        onSearchChange(localSearch)
        onApply()
      }
    }, 500)

    setDebounceTimer(timer)

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [localSearch])

  const handleClearFilters = () => {
    setLocalSearch('')
    onSearchChange('')
    onDateRangeChange({})
    onModelChange('')
    onApply()
  }

  const hasActiveFilters = search || dateRange.start || dateRange.end || selectedModel

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search content..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
            hasActiveFilters
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
              Active
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Clear all filters"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={dateRange.start ? format(dateRange.start, 'yyyy-MM-dd') : ''}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : undefined
                    onDateRangeChange({ ...dateRange, start: date })
                  }}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={dateRange.end ? format(dateRange.end, 'yyyy-MM-dd') : ''}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : undefined
                    onDateRangeChange({ ...dateRange, end: date })
                  }}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Model Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Model Used</label>
              <select
                value={selectedModel}
                onChange={(e) => {
                  onModelChange(e.target.value)
                  onApply()
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {models.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={onApply}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
