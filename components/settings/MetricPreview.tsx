'use client'

import { MetricConfig } from '@/src/types/metrics'
import { Info } from 'lucide-react'

interface MetricPreviewProps {
  metrics: MetricConfig[]
}

interface PreviewCardProps {
  metric: MetricConfig
  score?: number
}

function PreviewCard({ metric, score = 0 }: PreviewCardProps) {
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
    <div className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-900 capitalize">{metric.name}</h4>
        <span className={`px-2 py-1 text-sm font-semibold rounded ${getScoreColor(score)}`}>
          {getScoreText(score)}
        </span>
      </div>
      <p className="text-xs text-gray-600 line-clamp-2">{metric.prompt_text}</p>
    </div>
  )
}

export default function MetricPreview({ metrics }: MetricPreviewProps) {
  // Simulate different scores for preview
  const sampleScores = [1, 0, -1, 1, 0]

  if (metrics.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          <Info className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">Нет активных метрик</p>
          <p className="text-xs mt-1">Добавьте и активируйте метрики для просмотра</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Overall Score Preview */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600 mb-1">7.5/10</div>
          <div className="text-sm text-gray-600">Общий балл</div>
        </div>
      </div>

      {/* Metrics Preview */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Предпросмотр активных метрик</h3>
        {metrics.slice(0, 5).map((metric, index) => (
          <PreviewCard
            key={metric.id}
            metric={metric}
            score={sampleScores[index % sampleScores.length]}
          />
        ))}
        {metrics.length > 5 && (
          <div className="text-center text-sm text-gray-500 pt-2">
            +{metrics.length - 5} ещё метрик{metrics.length - 5 > 1 ? 'и' : 'а'}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-gray-400 mt-0.5" />
          <div className="text-xs text-gray-600">
            <p className="font-medium mb-1">Как работает оценка:</p>
            <ul className="space-y-0.5">
              <li>
                • <span className="text-green-600 font-medium">+1</span>: Соответствует или превосходит критерии
              </li>
              <li>
                • <span className="text-gray-600 font-medium">0</span>: Частично соответствует критериям
              </li>
              <li>
                • <span className="text-red-600 font-medium">-1</span>: Не соответствует критериям
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
