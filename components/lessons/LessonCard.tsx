'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Play, Trash2, GripVertical } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface LessonMetric {
  name: string
  score: number // -1, 0, +1, +2
  comment?: string
}

interface LessonCardProps {
  title: string
  metrics: LessonMetric[]
  analyzed: boolean // есть ли анализ
  color?: 'green' | 'beige'
  loading?: boolean
  lessonId?: string
  onAnalyze?: (lessonId: string) => void
  onDelete?: (lessonId: string) => void
  draggable?: boolean
}

export default function LessonCard({
  title,
  metrics,
  analyzed,
  color = 'green',
  loading = false,
  lessonId,
  onAnalyze,
  onDelete,
  draggable = false,
}: LessonCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const bgColor = color === 'green' ? 'bg-green-100' : 'bg-amber-50'

  const formatScore = (score: number) => {
    if (score > 0) return `+${score}`
    return score.toString()
  }

  return (
    <Card className={`${bgColor} border-0 rounded-3xl overflow-hidden transition-all`}>
      <div className="flex items-center">
        {/* Drag handle */}
        {draggable && (
          <div className="px-4 py-6 cursor-grab active:cursor-grabbing">
            <GripVertical className="w-5 h-5 text-gray-400" />
          </div>
        )}

        {/* Main content - clickable to expand */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 px-8 py-6 flex items-center justify-between hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-8 flex-1">
            {/* Title */}
            <h3 className="text-xl font-medium">{title}</h3>

            {/* Metrics - только в collapsed state */}
            {!isExpanded && (
              <div className="flex items-center gap-6">
                {loading ? (
                  <div className="text-sm text-gray-400">Загрузка метрик...</div>
                ) : !analyzed ? (
                  <div className="text-sm text-gray-400">Не проанализировано</div>
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

          {/* Expand icon */}
          {isExpanded ? (
            <ChevronDown className="w-6 h-6 text-gray-600" />
          ) : (
            <ChevronRight className="w-6 h-6 text-gray-600" />
          )}
        </button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-8 pb-6 space-y-4">
          {/* Metrics details */}
          {analyzed && metrics.length > 0 && (
            <div className="space-y-4">
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

          {/* Action buttons */}
          {lessonId && (
            <div className="flex gap-2 pt-4 border-t border-gray-300">
              {/* Analyze button */}
              {!analyzed && onAnalyze && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAnalyze(lessonId)
                  }}
                  className="gap-2"
                >
                  <Play className="w-4 h-4" />
                  Анализировать
                </Button>
              )}

              {/* Delete button */}
              {onDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (globalThis.confirm(`Вы уверены, что хотите удалить урок "${title}"?`)) {
                      onDelete(lessonId)
                    }
                  }}
                  className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
