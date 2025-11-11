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
  const configSnapshot = analysis.configuration_snapshot?.metrics || []

  // Calculate overall score (matching the main page logic)
  const calculateOverallScore = () => {
    if (!results) return { score: 0, displayScore: '0/10' }

    // Get all metric scores
    const scores: number[] = []
    Object.entries(results).forEach(([key, value]: [string, any]) => {
      if (key !== 'lessonTitle' && value && typeof value === 'object' && 'score' in value) {
        scores.push(value.score)
      }
    })

    if (scores.length === 0) return { score: 0, displayScore: '0/10' }

    // Sum all scores
    const totalScore = scores.reduce((acc, score) => acc + score, 0)

    // Calculate max possible score
    const metricCount = scores.length
    const maxPossibleScore = metricCount * 2 // Since scores range from -2 to +2

    // Shift to 0-based range for display
    const adjustedScore = totalScore + maxPossibleScore // Now ranges from 0 to maxPossibleScore*2
    const totalPossible = maxPossibleScore * 2

    return {
      score: totalScore,
      displayScore: `${adjustedScore}/${totalPossible}`,
    }
  }

  const overallScore = calculateOverallScore()

  // Truncate content for preview
  const contentPreview =
    analysis.content.substring(0, 150) + (analysis.content.length > 150 ? '...' : '')

  return (
    <div className="bg-[#F5F5F5] overflow-hidden" style={{ borderRadius: '30px' }}>
      {/* Header */}
      <div className="p-6">
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <div className="pt-1">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect(e.target.checked)}
              className="w-4 h-4 text-black border-gray-400 rounded focus:ring-black"
            />
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm text-black/60 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {format(new Date(analysis.created_at), 'dd.MM.yyyy HH:mm')}
                  </span>
                  <span className="text-sm text-black/60 flex items-center gap-1">
                    <Cpu className="w-4 h-4" />
                    {analysis.model_used || 'Неизвестная модель'}
                  </span>
                </div>
                <p className="text-black">{contentPreview}</p>
              </div>

              {/* Overall Score */}
              <div className="text-center ml-4">
                <div className="text-[24px] font-bold text-black">{overallScore.displayScore}</div>
                <div className="text-xs text-black/60">Общий балл</div>
              </div>
            </div>

            {/* Expand Button */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-sm text-black hover:text-black/80 transition-colors"
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
            <h4 className="font-medium text-gray-900 mb-3">Результаты анализа</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(results || {})
                .map(([metricName, metricData]: [string, any]) => {
                  if (metricName === 'lessonTitle' || !metricData || typeof metricData !== 'object')
                    return null

                  const score = metricData.score || 0

                  const getScoreColor = (score: number) => {
                    if (score > 0) return 'text-green-600 bg-green-50 border-green-200'
                    if (score < 0) return 'text-red-600 bg-red-50 border-red-200'
                    return 'text-gray-600 bg-gray-50 border-gray-200'
                  }

                  const getScoreText = (score: number) => {
                    if (score === 2) return '+2'
                    if (score === 1) return '+1'
                    if (score === -1) return '-1'
                    if (score === -2) return '-2'
                    return '0'
                  }

                  const metricDisplayNames: Record<string, string> = {
                    logic: 'Логика',
                    practical: 'Польза',
                    complexity: 'Сложность',
                    interest: 'Интерес',
                    care: 'Забота',
                    cognitive_load: 'Когнитивная нагрузка',
                  }

                  return (
                    <div
                      key={metricName}
                      className="p-4 bg-white rounded-lg border border-gray-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h5 className="font-medium text-gray-900">
                          {metricDisplayNames[metricName] || metricName}
                        </h5>
                        <span
                          className={`px-2 py-1 text-sm font-semibold rounded ${getScoreColor(score)}`}
                        >
                          {getScoreText(score)}
                        </span>
                      </div>
                      {metricData.comment && (
                        <p className="text-sm text-gray-700 mb-2">"{metricData.comment}"</p>
                      )}
                      {metricData.suggestions && metricData.suggestions.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-600 mb-1">Рекомендации:</p>
                          <p className="text-xs text-gray-600">→ {metricData.suggestions[0]}</p>
                        </div>
                      )}
                    </div>
                  )
                })
                .filter(Boolean)}
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
