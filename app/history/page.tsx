'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/src/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import UnifiedHeader from '@/components/layout/UnifiedHeader'
import AnalysisListItem from '@/components/history/AnalysisListItem'
import SearchFilter from '@/components/history/SearchFilter'
import Pagination from '@/components/history/Pagination'
import ExportButton from '@/components/history/ExportButton'
import ComparisonView from '@/components/history/ComparisonView'
import { Loader2, History } from 'lucide-react'
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
        <Loader2 className="w-8 h-8 animate-spin text-black" />
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
    <div className="min-h-screen bg-white">
      <UnifiedHeader />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-[1200px] mx-auto">
          {/* Header - Лёха AI style */}
          <header className="mb-12">
            <div className="mb-4">
              <h1 className="text-[48px] font-bold text-black mb-2">История анализов</h1>
              <p className="text-[16px] text-black/70">
                Просматривайте и управляйте вашими прошлыми анализами контента
              </p>
            </div>
          <div className="flex items-center gap-3">
            {selectedAnalyses.length > 0 && (
              <button
                onClick={() => setCompareMode(true)}
                className="px-6 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
              >
                Сравнить выбранные ({selectedAnalyses.length})
              </button>
            )}
            <ExportButton
              onExport={handleExport}
              selectedCount={selectedAnalyses.length}
              totalCount={analyses.length}
            />
          </div>
        </header>

        {/* Search and Filters */}
        <div className="mb-8">
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
        </div>

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
              <div className="bg-white border border-gray-200 p-12" style={{ borderRadius: '40px' }}>
                <div className="text-center">
                  <History className="w-12 h-12 text-black/40 mx-auto mb-4" />
                  <h3 className="text-[24px] font-medium text-black mb-2">Пока нет анализов</h3>
                  <p className="text-black/60 mb-6">
                    Начните анализировать контент, чтобы увидеть вашу историю
                  </p>
                  <button
                    onClick={() => router.push('/')}
                    className="px-6 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
                  >
                    Начать анализ
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
      </div>
    </div>
  )
}
