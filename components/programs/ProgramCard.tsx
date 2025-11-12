'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface ProgramMetric {
  name: string
  score: number // -1, 0, +1, +2
  comment?: string
}

interface ProgramCardProps {
  title: string
  metrics: ProgramMetric[]
  completedLessons: number
  totalLessons: number
  color?: 'green' | 'beige'
  loading?: boolean
}

export default function ProgramCard({
  title,
  metrics,
  completedLessons,
  totalLessons,
  color = 'green',
  loading = false,
}: ProgramCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const bgColor = color === 'green' ? 'bg-green-100' : 'bg-amber-50'
  const progressPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0

  const formatScore = (score: number) => {
    if (score > 0) return `+${score}`
    return score.toString()
  }

  return (
    <Card className={`${bgColor} border-0 rounded-3xl overflow-hidden transition-all`}>
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-8 py-6 flex items-center justify-between hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-8 flex-1">
          {/* Title */}
          <h3 className="text-xl font-medium">{title}</h3>

          {/* Metrics */}
          {!isExpanded && (
            <div className="flex items-center gap-6">
              {loading ? (
                <div className="text-sm text-gray-400">Загрузка метрик...</div>
              ) : metrics.length === 0 ? (
                <div className="text-sm text-gray-400">Нет данных анализа</div>
              ) : (
                metrics.map((metric, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{metric.name}</span>
                    <span className="text-sm font-medium">{formatScore(metric.score)}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Progress indicator and expand button */}
        <div className="flex items-center gap-4">
          {/* Circular progress */}
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-gray-200"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - progressPercentage / 100)}`}
                className="text-gray-800 transition-all duration-300"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-medium">
                {completedLessons}/{totalLessons}
              </span>
            </div>
          </div>

          {/* Expand icon */}
          {isExpanded ? (
            <ChevronDown className="w-6 h-6 text-gray-600" />
          ) : (
            <ChevronRight className="w-6 h-6 text-gray-600" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-8 pb-6 space-y-4">
          {metrics.map((metric, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{metric.name}</span>
                <span className="text-sm">{formatScore(metric.score)}</span>
              </div>
              {metric.comment && <p className="text-sm text-gray-700">{metric.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
