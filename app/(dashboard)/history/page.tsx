'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/src/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import AnalysisListItem from '@/components/history/AnalysisListItem'
import SearchFilter from '@/components/history/SearchFilter'
import Pagination from '@/components/history/Pagination'
import ExportButton from '@/components/history/ExportButton'
import ComparisonView from '@/components/history/ComparisonView'
import { Loader2, History, Search, Filter } from 'lucide-react'
import { format } from 'date-fns'

interface AnalysisData {
  id: string
  content: string
  results: any
  model_used: string
  configuration_snapshot: any
  created_at: string
  user_id: string
}

interface HistoryResponse {
  analyses: AnalysisData[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<{ start?: Date; end?: Date }>({})
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>([])
  const [compareMode, setCompareMode] = useState(false)

  // Fetch analysis history
  const { data, isLoading, error, refetch } = useQuery<HistoryResponse>({
    queryKey: ['analysisHistory', page, pageSize, search, dateRange, selectedModel],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      })

      if (search) params.append('search', search)
      if (dateRange.start) params.append('startDate', dateRange.start.toISOString())
      if (dateRange.end) params.append('endDate', dateRange.end.toISOString())
      if (selectedModel) params.append('model', selectedModel)

      const response = await fetch(`/api/history?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch history')
      }
      return response.json()
    },
    enabled: !!user,
  })

  // Redirect if not authenticated
  if (!authLoading && !user) {
    router.push('/login')
    return null
  }

  const handleExport = (analysisIds: string[], format: 'pdf' | 'csv') => {
    const analysesToExport =
      analysisIds.length > 0
        ? data?.analyses.filter((a) => analysisIds.includes(a.id))
        : data?.analyses

    if (!analysesToExport) return

    // Export logic will be implemented in ExportButton component
    console.log(`Exporting ${analysesToExport.length} analyses as ${format}`)
  }

  const handleCompare = (analysisIds: string[]) => {
    setSelectedAnalyses(analysisIds)
    setCompareMode(true)
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Failed to load analysis history. Please try again.</p>
        </div>
      </div>
    )
  }

  const analyses = data?.analyses || []
  const pagination = data?.pagination

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analysis History</h1>
              <p className="text-gray-600 mt-1">View and manage your past content analyses</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedAnalyses.length > 0 && (
              <button
                onClick={() => setCompareMode(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Compare Selected ({selectedAnalyses.length})
              </button>
            )}
            <ExportButton
              onExport={handleExport}
              selectedCount={selectedAnalyses.length}
              totalCount={analyses.length}
            />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <SearchFilter
        search={search}
        onSearchChange={setSearch}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onApply={() => {
          setPage(1)
          refetch()
        }}
      />

      {/* Comparison View */}
      {compareMode && selectedAnalyses.length > 0 && (
        <ComparisonView
          analysisIds={selectedAnalyses}
          analyses={analyses.filter((a) => selectedAnalyses.includes(a.id))}
          onClose={() => {
            setCompareMode(false)
            setSelectedAnalyses([])
          }}
        />
      )}

      {/* Analysis List */}
      {!compareMode && (
        <>
          {analyses.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
              <div className="text-center">
                <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No analyses yet</h3>
                <p className="text-gray-600 mb-6">
                  Start analyzing content to see your history here
                </p>
                <button
                  onClick={() => router.push('/')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Analyze Content
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {analyses.map((analysis) => (
                <AnalysisListItem
                  key={analysis.id}
                  analysis={analysis}
                  selected={selectedAnalyses.includes(analysis.id)}
                  onSelect={(selected) => {
                    if (selected) {
                      setSelectedAnalyses([...selectedAnalyses, analysis.id])
                    } else {
                      setSelectedAnalyses(selectedAnalyses.filter((id) => id !== analysis.id))
                    }
                  }}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              hasNextPage={pagination.hasNextPage}
              hasPreviousPage={pagination.hasPreviousPage}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  )
}
