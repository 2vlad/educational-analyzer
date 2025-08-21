'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown, ChevronUp, FileText, Clock, Cpu, Check } from 'lucide-react'

interface AnalysisData {
  id: string
  content: string
  results: any
  model_used: string
  configuration_snapshot: any
  created_at: string
  user_id: string
}

interface AnalysisListItemProps {
  analysis: AnalysisData
  selected: boolean
  onSelect: (selected: boolean) => void
}

export default function AnalysisListItem({ analysis, selected, onSelect }: AnalysisListItemProps) {
  const [expanded, setExpanded] = useState(false)

  // Parse results
  const results =
    typeof analysis.results === 'string' ? JSON.parse(analysis.results) : analysis.results

  // Parse configuration snapshot
  const configSnapshot = analysis.configuration_snapshot || []

  // Calculate overall score
  const calculateOverallScore = () => {
    if (!results || !results.metrics) return 'N/A'

    const scores = Object.values(results.metrics).map((m: any) => {
      if (m.score === 1) return 1
      if (m.score === 0) return 0
      if (m.score === -1) return -1
      return 0
    })

    if (scores.length === 0) return 'N/A'

    const sum = scores.reduce((acc: number, score: number) => acc + score, 0)
    const normalized = ((sum + scores.length) / (scores.length * 2)) * 10
    return normalized.toFixed(1)
  }

  const overallScore = calculateOverallScore()

  // Truncate content for preview
  const contentPreview =
    analysis.content.substring(0, 150) + (analysis.content.length > 150 ? '...' : '')

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <div className="pt-1">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {format(new Date(analysis.created_at), 'MMM dd, yyyy HH:mm')}
                  </span>
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Cpu className="w-4 h-4" />
                    {analysis.model_used || 'Unknown Model'}
                  </span>
                </div>
                <p className="text-gray-700">{contentPreview}</p>
              </div>

              {/* Overall Score */}
              <div className="text-center ml-4">
                <div className="text-2xl font-bold text-blue-600">{overallScore}</div>
                <div className="text-xs text-gray-500">Overall</div>
              </div>
            </div>

            {/* Expand Button */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              {expanded ? 'Hide Details' : 'View Full Analysis'}
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          {/* Full Content */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-2">Content Analyzed</h4>
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-700 whitespace-pre-wrap">{analysis.content}</p>
            </div>
          </div>

          {/* Metrics Results */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">Analysis Results</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {configSnapshot.map((config: any) => {
                const metricResult = results?.metrics?.[config.name] || {}
                const score = metricResult.score || 0

                const getScoreColor = (score: number) => {
                  if (score > 0) return 'text-green-600 bg-green-50 border-green-200'
                  if (score < 0) return 'text-red-600 bg-red-50 border-red-200'
                  return 'text-gray-600 bg-gray-50 border-gray-200'
                }

                const getScoreText = (score: number) => {
                  if (score > 0) return '+1'
                  if (score < 0) return '-1'
                  return '0'
                }

                return (
                  <div key={config.name} className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-medium text-gray-900 capitalize">{config.name}</h5>
                      <span
                        className={`px-2 py-1 text-sm font-semibold rounded ${getScoreColor(score)}`}
                      >
                        {getScoreText(score)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{config.prompt_text}</p>
                    {metricResult.explanation && (
                      <p className="text-sm text-gray-700 italic">"{metricResult.explanation}"</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Configuration Snapshot Info */}
          <div className="text-xs text-gray-500">
            <p className="flex items-center gap-1">
              <Check className="w-3 h-3" />
              This analysis used {configSnapshot.length} metrics with the configuration at the time
              of analysis
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
