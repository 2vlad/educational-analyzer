'use client'

import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { format } from 'date-fns'

interface AnalysisData {
  id: string
  content: string
  results: any
  model_used: string
  configuration_snapshot: any
  created_at: string
}

interface ComparisonViewProps {
  analysisIds: string[]
  analyses: AnalysisData[]
  onClose: () => void
}

export default function ComparisonView({ analysisIds, analyses, onClose }: ComparisonViewProps) {
  // Sort analyses by date
  const sortedAnalyses = [...analyses].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  // Get all unique metrics across analyses
  const getAllMetrics = () => {
    const metricsSet = new Set<string>()
    sortedAnalyses.forEach((analysis) => {
      const snapshot = analysis.configuration_snapshot || []
      snapshot.forEach((config: any) => {
        metricsSet.add(config.name)
      })
    })
    return Array.from(metricsSet)
  }

  const allMetrics = getAllMetrics()

  // Get metric score for an analysis
  const getMetricScore = (analysis: AnalysisData, metricName: string) => {
    const results =
      typeof analysis.results === 'string' ? JSON.parse(analysis.results) : analysis.results
    return results?.metrics?.[metricName]?.score
  }

  // Calculate score change between analyses
  const getScoreChange = (prevScore: number | undefined, currScore: number | undefined) => {
    if (prevScore === undefined || currScore === undefined) return null
    return currScore - prevScore
  }

  // Get change indicator
  const getChangeIndicator = (change: number | null) => {
    if (change === null) return null
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-600" />
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-600" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }

  const getScoreColor = (score: number | undefined) => {
    if (score === undefined) return 'bg-gray-100 text-gray-500'
    if (score > 0) return 'bg-green-50 text-green-700 border-green-200'
    if (score < 0) return 'bg-red-50 text-red-700 border-red-200'
    return 'bg-gray-50 text-gray-700 border-gray-200'
  }

  const getScoreText = (score: number | undefined) => {
    if (score === undefined) return 'N/A'
    if (score > 0) return '+1'
    if (score < 0) return '-1'
    return '0'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Compare Analyses</h2>
            <p className="text-sm text-gray-600 mt-1">
              Comparing {sortedAnalyses.length} analyses over time
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Timeline Header */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Analysis Timeline</h3>
            <div className="flex items-center gap-4 overflow-x-auto pb-2">
              {sortedAnalyses.map((analysis, index) => (
                <div key={analysis.id} className="flex-shrink-0 text-center">
                  <div className="text-sm font-medium text-gray-900">Analysis {index + 1}</div>
                  <div className="text-xs text-gray-500">
                    {format(new Date(analysis.created_at), 'MMM dd, yyyy')}
                  </div>
                  <div className="text-xs text-gray-500">{analysis.model_used || 'Unknown'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics Comparison Table */}
          <div className="bg-gray-50 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Metric</th>
                  {sortedAnalyses.map((analysis, index) => (
                    <th
                      key={analysis.id}
                      className="px-4 py-3 text-center text-sm font-medium text-gray-700"
                    >
                      Analysis {index + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {allMetrics.map((metric) => (
                  <tr key={metric} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">
                      {metric}
                    </td>
                    {sortedAnalyses.map((analysis, index) => {
                      const score = getMetricScore(analysis, metric)
                      const prevScore =
                        index > 0 ? getMetricScore(sortedAnalyses[index - 1], metric) : undefined
                      const change = getScoreChange(prevScore, score)

                      return (
                        <td key={analysis.id} className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span
                              className={`px-2 py-1 text-sm font-semibold rounded border ${getScoreColor(score)}`}
                            >
                              {getScoreText(score)}
                            </span>
                            {index > 0 && getChangeIndicator(change)}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Content Comparison */}
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Content Analyzed</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedAnalyses.map((analysis, index) => (
                <div key={analysis.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-900 mb-2">Analysis {index + 1}</div>
                  <p className="text-sm text-gray-600 line-clamp-4">{analysis.content}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Insights */}
          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Key Insights</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>
                • {sortedAnalyses.length} analyses compared across {allMetrics.length} metrics
              </li>
              <li>
                • Time span: {format(new Date(sortedAnalyses[0].created_at), 'MMM dd, yyyy')} to{' '}
                {format(
                  new Date(sortedAnalyses[sortedAnalyses.length - 1].created_at),
                  'MMM dd, yyyy',
                )}
              </li>
              <li>• Different models may produce varying results for the same content</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  )
}
